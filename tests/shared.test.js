const assert = require("node:assert/strict");
const test = require("node:test");
const api = require("../shared.js");

test("adds and normalizes a local answer", () => {
  const presets = api.addPreset([], { title: "  Follow-up  ", body: "  Thank you.\nI will reply soon.  " }, "one", 100);
  assert.deepEqual(presets, [{ id: "one", title: "Follow-up", body: "Thank you.\nI will reply soon.", createdAt: 100, updatedAt: 100 }]);
  assert.deepEqual(api.normalizePresets(presets), presets);
});

test("rejects empty, overlong and duplicate answers", () => {
  assert.throws(() => api.addPreset([], { title: "", body: "Text" }, "one"), /required/);
  assert.throws(() => api.addPreset([], { title: "x".repeat(81), body: "Text" }, "one"), /80/);
  assert.throws(() => api.addPreset([], { title: "Title", body: "x".repeat(4001) }, "one"), /4000/);
  const saved = api.addPreset([], { title: "One", body: "Answer" }, "one");
  assert.throws(() => api.addPreset(saved, { title: "Two", body: "Answer" }, "one"), /unique/);
});

test("updates and removes the selected answer without touching others", () => {
  const initial = api.addPreset(api.addPreset([], { title: "A", body: "a" }, "a", 1), { title: "B", body: "b" }, "b", 2);
  const updated = api.updatePreset(initial, "a", { title: "New A", body: "new" }, 3);
  assert.equal(updated[0].createdAt, 1);
  assert.equal(updated[0].updatedAt, 3);
  assert.equal(updated[1].body, "b");
  assert.deepEqual(api.removePreset(updated, "a").map((item) => item.id), ["b"]);
});

test("search is case-insensitive and storage normalization discards bad records", () => {
  const items = [
    { id: "one", title: "Scheduling", body: "Meet Tuesday", createdAt: 1, updatedAt: 1 },
    { id: "one", title: "Duplicate", body: "bad" },
    { id: "bad", title: "", body: "missing title" },
    { id: "two", title: "Thanks", body: "Appreciate your TIME" },
  ];
  assert.deepEqual(api.normalizePresets(items).map((item) => item.id), ["one", "two"]);
  assert.deepEqual(api.searchPresets(items, "tImE").map((item) => item.id), ["two"]);
});

test("100-answer limit is enforced", () => {
  let items = [];
  for (let index = 0; index < 100; index++) items = api.addPreset(items, { title: `Answer ${index}`, body: "Text" }, String(index));
  assert.throws(() => api.addPreset(items, { title: "Extra", body: "Text" }, "extra"), /Maximum/);
});
