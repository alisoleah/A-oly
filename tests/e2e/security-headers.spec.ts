import { test, expect } from "@playwright/test";

/**
 * Phase 6 — security header assertions.
 * Every response must carry the launch-hardening headers; this gates regressions.
 */
test.describe("security headers", () => {
  test("home page carries the full header set", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();

    expect(headers["strict-transport-security"]).toMatch(/max-age=31536000.*preload/i);
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toMatch(/camera=\(\)/);

    const csp = headers["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  test("PDP carries the same header set", async ({ request }) => {
    const res = await request.get("/aethra/signature-asymmetric-draped-pants");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("CSP forbids inline scripts from arbitrary origins", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"] ?? "";
    expect(csp.length).toBeGreaterThan(0);
    const scriptSrc = csp.match(/script-src ([^;]+)/)?.[1] ?? "";
    expect(scriptSrc).toBe("'self'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("*");
  });

  test("powered-by header is suppressed", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
