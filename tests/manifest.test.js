const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("Manifest V3 references existing files and injects only on action", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting", "storage"]);
  const files = [manifest.background.service_worker, manifest.options_page, ...Object.values(manifest.icons)];
  for (const file of files) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
});

test("extension settings use local packaged scripts, not inline JavaScript", () => {
  const html = fs.readFileSync(path.join(root, manifest.options_page), "utf8");
  assert.match(html, /<script src="shared\.js"><\/script>/);
  assert.match(html, /<script src="options\.js"><\/script>/);
  assert.doesNotMatch(html, /<script(?:\s+[^>]*?)?>\s*[^\s<]/i);
});

test("no API credentials are embedded in the packaged source", () => {
  for (const file of ["manifest.json", "background.js", "content.js", "options.js", "shared.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,}/);
  }
});
