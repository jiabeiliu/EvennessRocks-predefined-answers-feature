(function (root) {
  "use strict";

  const MAX_PRESETS = 100;
  const MAX_TITLE = 80;
  const MAX_BODY = 4000;

  function validateDraft(draft) {
    const title = typeof draft?.title === "string" ? draft.title.trim() : "";
    const body = typeof draft?.body === "string" ? draft.body.trim() : "";
    if (!title || !body) throw new Error("Title and answer text are required.");
    if (title.length > MAX_TITLE) throw new Error(`Title must be ${MAX_TITLE} characters or fewer.`);
    if (body.length > MAX_BODY) throw new Error(`Answer must be ${MAX_BODY} characters or fewer.`);
    return { title, body };
  }

  function normalizePresets(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const clean = [];
    for (const item of value) {
      if (clean.length >= MAX_PRESETS) break;
      if (typeof item?.id !== "string" || !item.id || seen.has(item.id)) continue;
      try {
        const draft = validateDraft(item);
        clean.push({
          id: item.id,
          ...draft,
          createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0,
          updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : 0,
        });
        seen.add(item.id);
      } catch {
        // Ignore corrupted or unsupported storage records.
      }
    }
    return clean;
  }

  function addPreset(current, draft, id, now = Date.now()) {
    const presets = normalizePresets(current);
    if (presets.length >= MAX_PRESETS) throw new Error(`Maximum of ${MAX_PRESETS} answers reached.`);
    if (typeof id !== "string" || !id || presets.some((item) => item.id === id)) {
      throw new Error("A unique answer ID is required.");
    }
    return [...presets, { id, ...validateDraft(draft), createdAt: now, updatedAt: now }];
  }

  function updatePreset(current, id, draft, now = Date.now()) {
    const presets = normalizePresets(current);
    if (!presets.some((item) => item.id === id)) throw new Error("Answer not found.");
    const valid = validateDraft(draft);
    return presets.map((item) => item.id === id ? { ...item, ...valid, updatedAt: now } : item);
  }

  function removePreset(current, id) {
    return normalizePresets(current).filter((item) => item.id !== id);
  }

  function searchPresets(current, query) {
    const term = typeof query === "string" ? query.trim().toLocaleLowerCase() : "";
    const presets = normalizePresets(current);
    return term ? presets.filter((item) => `${item.title} ${item.body}`.toLocaleLowerCase().includes(term)) : presets;
  }

  const api = { MAX_PRESETS, MAX_TITLE, MAX_BODY, validateDraft, normalizePresets, addPreset, updatePreset, removePreset, searchPresets };
  root.EvennessPresets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
