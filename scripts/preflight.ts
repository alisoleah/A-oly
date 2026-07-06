/**
 * Production-readiness preflight. Run before every deploy (CI or manual):
 *   npm run preflight
 *
 * Fails (exit 1) if any production POLICY check fails. This is separate from
 * the module-load invariants in src/lib/env.ts, which guard correctness only.
 */
import { env, productionPreflight } from "@/lib/env";

const problems = productionPreflight(env);

if (problems.length > 0) {
  console.error("✗ Production preflight failed:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error(
    "\nResolve these before deploying. Local dev may ignore them safely.",
  );
  process.exit(1);
}

console.log("✓ Production preflight passed.");
