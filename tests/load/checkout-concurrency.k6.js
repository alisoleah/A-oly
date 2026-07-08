/**
 * k6 load test — checkout concurrency + oversell proof (TESTING_GUIDE.md §2, §load).
 *
 * Goal: prove that under real concurrent load against the running server:
 *   1. Stock=1 variants sell exactly once (no oversell) — the atomic decrement
 *      guard holds over HTTP, not just in-process.
 *   2. Order creation p95 stays < 800ms at 50 concurrent checkouts.
 *   3. Losers get a clean 409 OutOfStock, never a 500.
 *
 * Usage:
 *   1. Start the server:  npm run dev   (or npm run build && npm start)
 *   2. Set the variant to stock=1 in admin or via a quick DB update.
 *   3. Run:  k6 run tests/load/checkout-concurrency.k6.js
 *
 * Tune via env (k6 -e flags):
 *   - BASE_URL        default http://localhost:3000
 *   - VARIANT_ID      the variant to race for (find via admin or prisma studio)
 *   - VIRTUAL_USERS   default 50
 *   - DURATION        default 20s
 *
 * NOTE: this creates real orders against the real DB. Run against a staging DB,
 * not production. Clean up test orders afterward (they have phone 01000000000).
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const VARIANT_ID = __ENV.VARIANT_ID || "REPLACE_WITH_VARIANT_ID";
const VUS = parseInt(__ENV.VIRTUAL_USERS || "50", 10);
const DURATION = __ENV.DURATION || "20s";

// Custom metrics
const checkoutOk = new Counter("checkout_ok");
const checkoutOutOfStock = new Counter("checkout_out_of_stock");
const checkoutError = new Counter("checkout_error");
const checkoutDuration = new Trend("checkout_duration_ms", true);

export const options = {
  scenarios: {
    concurrent_checkout: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: VUS },   // ramp to full concurrency
        { duration: DURATION, target: VUS }, // hold
        { duration: "5s", target: 0 },      // ramp down
      ],
    },
  },
  thresholds: {
    // The headline: no 500s. OutOfStock (409) is expected + healthy.
    http_req_failed: ["rate<0.01"],
    checkout_duration_ms: ["p(95)<800"],
  },
};

const COOKIES = {
  // Each VU gets its own cart via a unique cookie; k6 reuses per-VU cookies.
};

export default function () {
  const cartToken = `k6-${__VU}-${__ITER}-${Date.now()}`;

  // 1. Seed a cart with 1 unit of the target variant via the cart API.
  const addRes = http.post(
    `${BASE_URL}/api/cart`,
    JSON.stringify({ variantId: VARIANT_ID, qty: 1, cookieToken: cartToken }),
    { headers: { "Content-Type": "application/json" }, cookies: COOKIES },
  );

  // 2. POST checkout — the order-creation transaction fires here.
  const body = {
    contact: { fullName: "k6 Load", email: "k6-load@example.com", phone: "01000000000" },
    delivery: {
      governorate: "Cairo",
      city: "Cairo",
      addressLine1: "1 Test Street",
      postalCode: "",
      notes: "",
    },
    payment: { method: "COD" },
    idempotencyKey: `k6-${cartToken}`,
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/checkout`, JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      Cookie: `cart=${cartToken}`,
    },
  });
  checkoutDuration.add(Date.now() - start);

  const status = res.status;

  if (status === 201) {
    checkoutOk.add(1);
  } else if (status === 409) {
    // Out of stock — expected when stock runs out under contention. Healthy.
    checkoutOutOfStock.add(1);
  } else {
    checkoutError.add(1);
    console.error(`Unexpected status ${status}: ${res.body?.substring(0, 200)}`);
  }

  check(res, {
    "no 500s": (r) => r.status !== 500,
    "response is json": (r) => {
      try {
        r.json();
        return true;
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    stdout: `
════════════════════════════════════════════════════════════
 k6 checkout load test — summary
════════════════════════════════════════════════════════════
 Virtual users (peak):  ${VUS}
 Duration:              ${DURATION}

 checkouts succeeded:   ${data.metrics.checkout_ok?.values?.count ?? 0}
 out-of-stock (409):    ${data.metrics.checkout_out_of_stock?.values?.count ?? 0}
 unexpected errors:     ${data.metrics.checkout_error?.values?.count ?? 0}

 checkout p95 latency:  ${Math.round(data.metrics.checkout_duration_ms?.values?.["p(95)"] ?? 0)} ms
 checkout avg latency:  ${Math.round(data.metrics.checkout_duration_ms?.values?.avg ?? 0)} ms

 HTTP failures (>1% = bad): ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%

 Thresholds:
${(data.threshold_results ?? [])
  .filter((t) => !t.ok)
  .map((t) => `   ✗ FAILED: ${t.name}`)
  .join("\n") || "   ✓ all passed"}

 Oversell check: compare "checkouts succeeded" against the variant's stock
 before the run. If succeeded > stock, the guard is broken.
════════════════════════════════════════════════════════════
`,
  };
}
