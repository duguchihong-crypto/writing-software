(function () {
“use strict”;

const STORAGE_KEY = "writing-software-home-grid-enabled";
let enabled = false;
let initialized = false;
let observer = null;
/**
 * 获取书籍容器
 */
function getShelf() {
    return document.getElementById("shelf-list");
}
/**
 * 读取保存的网格模式
 */
function loadPreference() {
    try {
        return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (error) {
        return false;
    }
}
/**
 * 保存网格模式
 */
function savePreference() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            enabled ? "true" : "false"
        );
    } catch (error) {
        console.warn("网格模式设置保存失败。", error);
    }
}
/**
 * 应用网格样式
 */
function applyMode() {
    const shelf = getShelf();
    if (!shelf) {
        return;
    }
    shelf.classList.toggle(
        "shelf-list--grid",
        enabled
    );
    document.documentElement.classList.toggle(
        "home-grid-enabled",
        enabled
    );
    const button = document.querySelector(
        '[data-settings-action="grid"]'
    );
    if (button) {
        button.setAttribute(
            "aria-pressed",
            String(enabled)
        );
        const title = button.querySelector(
            ".home-settings__option-title"
        );
        if (title) {
            title.textContent = enabled
                ? "网格模式（已开启）"
                : "网格模式";
        }
    }
}
/**
 * 切换网格模式
 */
function toggleMode() {
    enabled = !enabled;
    savePreference();
    applyMode();
}
/**
 * 关闭设置弹窗
 */
function closeSettings() {
    const closeButton = document.querySelector(
        "[data-settings-close]:not(.home-settings__backdrop)"
    );
    if (closeButton) {
        closeButton.click();
    }
}
/**
 * 直接监听网格按钮点击。
 *
 * 不依赖设置模块派发的自定义事件，
 * 避免不同事件格式造成点击无效。
 */
function bindGridButton() {
    const button = document.querySelector(
        '[data-settings-action="grid"]'
    );
    if (!button || button.dataset.gridBound === "true") {
        return;
    }
    button.dataset.gridBound = "true";
    button.addEventListener("click", function () {
        toggleMode();
        closeSettings();
    });
}
/**
 * 监听书架变化。
 *
 * 首页重新生成书籍卡片时，
 * 自动确保网格模式仍然生效。
 */
function observeShelf() {
    const shelf = getShelf();
    if (!shelf || !window.MutationObserver) {
        return;
    }
    if (observer) {
        observer.disconnect();
    }
    observer = new MutationObserver(function () {
        if (enabled) {
            applyMode();
        }
    });
    observer.observe(shelf, {
        childList: true
    });
}
/**
 * 初始化
 */
function init() {
    if (initialized) {
        return;
    }
    initialized = true;
    enabled = loadPreference();
    bindGridButton();
    applyMode();
    observeShelf();
}
/**
 * 对外提供独立接口。
 */
window.WritingHomeGrid = Object.freeze({
    enable: function () {
        enabled = true;
        savePreference();
        applyMode();
    },
    disable: function () {
        enabled = false;
        savePreference();
        applyMode();
    },
    toggle: toggleMode,
    isEnabled: function () {
        return enabled;
    },
    refresh: applyMode
});
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        init,
        { once: true }
    );
} else {
    init();
}

})();
