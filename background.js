"use strict";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["shared.js", "content.js"] });
  } catch (error) {
    // Chrome internal pages and protected tabs do not allow extensions to inject scripts.
    console.warn("Predefined Answers cannot open on this page:", error);
  }
});

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let output = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    output += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(output);
}

async function speakWithVoiceRSS(text, lang) {
  if (typeof text !== "string" || !text.trim() || text.length > 500) {
    throw new Error("Speech text must be between 1 and 500 characters.");
  }
  const { voicerssKey = "" } = await chrome.storage.local.get("voicerssKey");
  if (!voicerssKey) throw new Error("Set a VoiceRSS API key in extension settings to enable speech.");
  const language = ["en-us", "en-gb", "zh-cn", "ja-jp", "ko-kr"].includes(lang) ? lang : "en-us";
  const url = new URL("https://api.voicerss.org/");
  url.search = new URLSearchParams({ key: voicerssKey, hl: language, src: text, c: "MP3", f: "44khz_16bit_stereo" }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`VoiceRSS request failed (${response.status}).`);
  const mime = response.headers.get("content-type") || "";
  if (!mime.toLowerCase().startsWith("audio/")) throw new Error("VoiceRSS did not return audio. Check the key and usage limits.");
  const audio = await response.arrayBuffer();
  if (audio.byteLength > 5_000_000) throw new Error("VoiceRSS audio response was too large.");
  return { base64: arrayBufferToBase64(audio), mime };
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== "speak-answer") return false;
  speakWithVoiceRSS(message.text, message.lang)
    .then((audio) => respond({ ok: true, ...audio }))
    .catch((error) => respond({ ok: false, error: error.message || "Speech failed." }));
  return true;
});
