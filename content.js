(() => {
  "use strict";
  if (globalThis.__evennessAnswersToggle) {
    globalThis.__evennessAnswersToggle();
    return;
  }

  const api = globalThis.EvennessPresets;
  let presets = [];
  let lastTarget = null;
  let lastSelection = null;
  const panel = document.createElement("section");
  panel.id = "evenness-answers-panel";
  panel.setAttribute("aria-label", "Predefined Answers");
  panel.innerHTML = `
    <div class="ea-head"><div><h2>Predefined answers</h2><p class="ea-subtitle">Choose a field on this page, then insert an answer.</p></div><button type="button" class="ea-close" aria-label="Close panel">×</button></div>
    <input class="ea-search" type="search" aria-label="Search saved answers" placeholder="Search saved answers…">
    <div class="ea-list"></div>
    <div class="ea-footer"><button type="button" class="ea-settings">Manage answers</button><select class="ea-language" aria-label="Speech language"><option value="en-us">English (US)</option><option value="en-gb">English (UK)</option><option value="zh-cn">中文</option><option value="ja-jp">日本語</option><option value="ko-kr">한국어</option></select></div>
    <p class="ea-status" role="status" aria-live="polite"></p>`;
  document.documentElement.append(panel);

  const search = panel.querySelector(".ea-search");
  const list = panel.querySelector(".ea-list");
  const status = panel.querySelector(".ea-status");

  function setStatus(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function editableTarget(element) {
    if (!(element instanceof HTMLElement) || panel.contains(element)) return null;
    if (element instanceof HTMLTextAreaElement) return element;
    if (element instanceof HTMLInputElement && ["text", "search", "url", "tel"].includes(element.type)) return element;
    return element.closest('[contenteditable="true"]') || (element.isContentEditable ? element : null);
  }

  function remember(element) {
    const target = editableTarget(element);
    if (!target) return;
    lastTarget = target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      lastSelection = { start: target.selectionStart ?? target.value.length, end: target.selectionEnd ?? target.value.length };
    } else {
      const selection = window.getSelection();
      lastSelection = selection?.rangeCount && target.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    }
  }

  remember(document.activeElement);
  document.addEventListener("focusin", (event) => remember(event.target));
  document.addEventListener("selectionchange", () => remember(document.activeElement));
  document.addEventListener("keyup", () => remember(document.activeElement));

  function insertAnswer(text) {
    const target = lastTarget;
    if (!target?.isConnected || !editableTarget(target)) {
      setStatus("Click a text field on the page first, then try Insert.", true);
      return;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const start = Math.min(lastSelection?.start ?? target.value.length, target.value.length);
      const end = Math.min(lastSelection?.end ?? start, target.value.length);
      const value = target.value.slice(0, start) + text + target.value.slice(end);
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value")?.set;
      if (setter) setter.call(target, value);
      else target.value = value;
      target.focus();
      target.setSelectionRange(start + text.length, start + text.length);
    } else {
      target.focus();
      const selection = window.getSelection();
      const range = lastSelection instanceof Range && target.contains(lastSelection.commonAncestorContainer)
        ? lastSelection.cloneRange()
        : document.createRange();
      if (!(lastSelection instanceof Range && target.contains(lastSelection.commonAncestorContainer))) {
        range.selectNodeContents(target);
        range.collapse(false);
      }
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      lastSelection = range.cloneRange();
    }
    target.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    setStatus("Answer inserted. Review it before sending.");
  }

  async function speakAnswer(text) {
    setStatus("Fetching speech audio…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "speak-answer", text: text.slice(0, 500), lang: panel.querySelector(".ea-language").value });
      if (!result?.ok) throw new Error(result?.error || "No audio response.");
      const binary = atob(result.base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      const audio = new Audio(url);
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      audio.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
      setStatus("Playing audio. Only the first 500 characters were sent.");
    } catch (error) {
      setStatus(error.message || "Could not play speech.", true);
    }
  }

  function render() {
    list.replaceChildren();
    const matches = api.searchPresets(presets, search.value);
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "ea-preview";
      empty.textContent = presets.length ? "No matching answers." : "No answers saved yet. Choose Manage answers to add one.";
      list.append(empty);
      return;
    }
    for (const preset of matches) {
      const card = document.createElement("article");
      card.className = "ea-card";
      const heading = document.createElement("p");
      heading.className = "ea-title";
      heading.textContent = preset.title;
      const preview = document.createElement("p");
      preview.className = "ea-preview";
      preview.textContent = preset.body;
      const actions = document.createElement("div");
      actions.className = "ea-card-actions";
      const insert = document.createElement("button");
      insert.type = "button";
      insert.className = "ea-insert";
      insert.textContent = "Insert";
      insert.addEventListener("click", () => insertAnswer(preset.body));
      const speak = document.createElement("button");
      speak.type = "button";
      speak.textContent = "Speak";
      speak.addEventListener("click", () => speakAnswer(preset.body));
      actions.append(insert, speak);
      card.append(heading, preview, actions);
      list.append(card);
    }
  }

  async function load() {
    const data = await chrome.storage.local.get({ presets: [] });
    presets = api.normalizePresets(data.presets);
    render();
  }
  search.addEventListener("input", render);
  panel.querySelector(".ea-close").addEventListener("click", () => { panel.hidden = true; });
  panel.querySelector(".ea-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.presets) {
      presets = api.normalizePresets(changes.presets.newValue);
      render();
    }
  });
  globalThis.__evennessAnswersToggle = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) load().catch((error) => setStatus(error.message, true));
  };
  load().catch((error) => setStatus(`Could not load answers: ${error.message}`, true));
})();
