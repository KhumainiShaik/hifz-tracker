import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const html = readFileSync("dist/index.html", "utf8");
assert(
  html.includes("/hifz-tracker/assets/"),
  "Assets must use the GitHub Pages project base",
);
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
assert.equal(manifest.start_url, "/hifz-tracker/");
assert.equal(manifest.scope, "/hifz-tracker/");
assert(existsSync("dist/sw.js"));
for (const icon of manifest.icons) assert(existsSync(`dist/${icon.src}`));
console.log(
  "Build verified: project-path assets, PWA icons, manifest, and service worker.",
);
