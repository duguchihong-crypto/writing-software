(function () {
“use strict”;

const STORAGE_KEY = “writing-software-home-grid-enabled”;

let enabled = false;
let initialized = false;

function getShelfList() {
return document.getElementById(“shelf-list”);
}

function getCards() {
const shelfList = getShelfList();

if (!shelfList) {
  return [];
}
return Array.from(shelfList.children).filter(function (element) {
  return element.classList.contains("shelf-card");
});

}

function loadPreference() {
try {
return localStorage.getItem(STORAGE_KEY) === “true”;
} catch (error) {
return false;
}
}

function savePreference(value) {
try {
localStorage.setItem(STORAGE_KEY, String(value));
} catch (error) {
console.warn(“网格模式设置保存失败。”, error);
}
}

function applyMode() {
const shelfList = getShelfList();

if (!shelfList) {
  return;
}
shelfList.classList.toggle("shelf-list--grid", enabled);
const button = document.querySelector(
  '[data-settings-action="grid"]'
);
if (button) {
  button.setAttribute("aria-pressed", String(enabled));
  const title = button.querySelector(
    ".home-settings__option-title"
  );
  if (title) {
    title.textContent = enabled ? "网格模式（已开启）" : "网格模式";
  }
}
document.documentElement.classList.toggle(
  "home-grid-enabled",
  enabled
);

}

function setEnabled(value) {
enabled = Boolean(value);
savePreference(enabled);
applyMode();
}

function toggleMode() {
setEnabled(!enabled);
}

function handleSettingsAction(event) {
const action = event.detail && event.detail.action;

if (action !== "grid") {
  return;
}
toggleMode();
/*
 * 关闭设置弹窗。
 * 如果设置模块提供了 close 方法，则调用它；
 * 否则不干预设置模块，避免影响其他功能。
 */
if (
  window.WritingHomeSettings &&
  typeof window.WritingHomeSettings.close === "function"
) {
  window.WritingHomeSettings.close();
}

}

function observeShelf() {
const shelfList = getShelfList();

if (!shelfList || !window.MutationObserver) {
  return;
}
const observer = new MutationObserver(function () {
  applyMode();
});
observer.observe(shelfList, {
  childList: true
});

}

function init() {
if (initialized) {
return;
}

initialized = true;
enabled = loadPreference();
applyMode();
observeShelf();
document.addEventListener(
  "writing-home-settings-action",
  handleSettingsAction
);

}

window.WritingHomeGrid = Object.freeze({
enable: function () {
setEnabled(true);
},

disable: function () {
  setEnabled(false);
},
toggle: toggleMode,
isEnabled: function () {
  return enabled;
},
refresh: applyMode

});

if (document.readyState === “loading”) {
document.addEventListener(“DOMContentLoaded”, init, {
once: true
});
} else {
init();
}
})();
