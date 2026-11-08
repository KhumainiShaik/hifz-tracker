import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
let local = {};
try {
  local = parseEnv(readFileSync(".env.local", "utf8"));
} catch {
  /* CI uses environment variables. */
}
const uid = (process.env.VITE_OWNER_UID ?? local.VITE_OWNER_UID ?? "").trim();
if (
  !/^[A-Za-z0-9_-]{1,128}$/.test(uid) ||
  uid === "__OWNER_UID_NOT_CONFIGURED__"
)
  throw new Error(
    "Set VITE_OWNER_UID to the actual Google-authenticated owner UID. Refusing to generate unlocked rules without it.",
  );
const template = readFileSync("firestore.rules", "utf8");
// Replace only the return value; leave the configured() sentinel comparison intact.
const rules = template.replace(
  "return '__OWNER_UID_NOT_CONFIGURED__';",
  `return '${uid}';`,
);
writeFileSync("firestore.production.rules", rules);
console.log(
  "Generated firestore.production.rules for the configured UID. Deploy explicitly with firebase.production.json.",
);
