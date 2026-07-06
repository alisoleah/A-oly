/**
 * Hash a password for ADMIN_PASSWORD_HASH using bcrypt at cost 12.
 * Usage: npx tsx scripts/hash-password.ts <password>
 *   (omitting the arg prompts via stdin so it's not in shell history)
 *
 * CLAUDE.md mandates bcrypt cost ≥ 12. Never commit a real hash to the repo.
 */
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";

async function readFromStdin(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  process.stderr.write(prompt);
  let password = "";
  for await (const chunk of rl[Symbol.asyncIterator]()) {
    password += chunk;
    break;
  }
  rl.close();
  return password.trim();
}

async function main() {
  const arg = process.argv[2];
  const password = arg ?? (await readFromStdin("Enter password to hash: "));
  if (!password) {
    console.error("No password provided.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log("\nAdd this to your .env as ADMIN_PASSWORD_HASH:\n");
  console.log(hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
