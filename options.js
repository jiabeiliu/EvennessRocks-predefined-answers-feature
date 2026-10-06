(() => {
  "use strict";
  const api = globalThis.EvennessPresets;
  const byId = (id) => document.getElementById(id);
  const form = byId("answer-form");
  const title = byId("answer-title");
  const body = byId("answer-body");
  const list = byId("answer-list");
  const status = byId("status");
  let presets = [];
  let editingId = null;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.style.color = error ? "#a02f43" : "#225b44";
  }

  function resetEditor() {
    editingId = null;
    form.reset();
    byId("editor-title").textContent = "Add an answer";
    byId("save-answer").textContent = "Save answer";
    byId("cancel-edit").hidden = true;
  }

  function render() {
    list.replaceChildren();
    byId("count").textContent = `${presets.length} / ${api.MAX_PRESETS}`;
    if (!presets.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No answers yet. Add one above to start your library.";
      list.append(empty);
      return;
    }
    for (const preset of presets) {
      const article = document.createElement("article");
      article.className = "answer";
      const heading = document.createElement("h3");
      heading.textContent = preset.title;
      const text = document.createElement("p");
      text.textContent = preset.body;
      const actions = document.createElement("div");
      actions.className = "answer-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        editingId = preset.id;
        title.value = preset.title;
        body.value = preset.body;
        byId("editor-title").textContent = "Edit answer";
        byId("save-answer").textContent = "Update answer";
        byId("cancel-edit").hidden = false;
        title.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!confirm(`Delete “${preset.title}”?`)) return;
        presets = api.removePreset(presets, preset.id);
        await chrome.storage.local.set({ presets });
        if (editingId === preset.id) resetEditor();
        render();
        setStatus("Answer deleted.");
      });
      actions.append(edit, remove);
      article.append(heading, text, actions);
      list.append(article);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const draft = { title: title.value, body: body.value };
      presets = editingId
        ? api.updatePreset(presets, editingId, draft)
        : api.addPreset(presets, draft, crypto.randomUUID());
      await chrome.storage.local.set({ presets });
      resetEditor();
      render();
      setStatus("Answer saved locally.");
    } catch (error) {
      setStatus(error.message || String(error), true);
    }
  });
  byId("cancel-edit").addEventListener("click", resetEditor);
  byId("save-key").addEventListener("click", async () => {
    await chrome.storage.local.set({ voicerssKey: byId("voice-key").value.trim() });
    setStatus("VoiceRSS key saved locally.");
  });
  byId("clear-key").addEventListener("click", async () => {
    await chrome.storage.local.remove("voicerssKey");
    byId("voice-key").value = "";
    setStatus("VoiceRSS key removed.");
  });

  (async () => {
    const data = await chrome.storage.local.get({ presets: [], voicerssKey: "" });
    presets = api.normalizePresets(data.presets);
    byId("voice-key").value = data.voicerssKey || "";
    render();
  })().catch((error) => setStatus(`Could not load saved data: ${error.message}`, true));
})();
