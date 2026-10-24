/* =========================================================
   书籍列表模式模块
   文件：page-js/home-list.js
   独立功能：
   1. 开启列表模式
   2. 关闭列表模式
   3. 切换列表模式
   4. 保存列表模式设置
   5. 刷新后恢复列表模式
   6. 监听书架变化并保持布局
   7. 与网格模式协调
   8. 不修改书籍数据库
   9. 不参与书籍排序和分组排序
   ========================================================= */
(function () {
  "use strict";
  const STORAGE_KEY = "writing-software-home-list-enabled";
  const SELECTORS = {
    shelf: "#shelf-list",
    button: '[data-settings-action="list"]',
    buttonTitle: ".home-settings__option-title"
  };
  const STATE = {
    enabled: false,
    initialized: false,
    observer: null
  };
  /* ---------------------------------------------------------
     基础工具
  --------------------------------------------------------- */
  function getShelf() {
    return document.querySelector(SELECTORS.shelf);
  }
  function getListButton() {
    return document.querySelector(SELECTORS.button);
  }
  function loadPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (error) {
      console.warn("[HomeList] 读取列表模式设置失败：", error);
      return false;
    }
  }
  function savePreference() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        STATE.enabled ? "true" : "false"
      );
      return true;
    } catch (error) {
      console.warn("[HomeList] 保存列表模式设置失败：", error);
      return false;
    }
  }
  function showNotice(message) {
    let notice = document.getElementById("home-list-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "home-list-notice";
      notice.className = "home-list__notice";
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      Object.assign(notice.style, {
        position: "fixed",
        left: "50%",
        bottom: "82px",
        zIndex: "10001",
        maxWidth: "calc(100vw - 32px)",
        padding: "10px 16px",
        borderRadius: "8px",
        background: "#252525",
        color: "#ffffff",
        fontSize: "14px",
        lineHeight: "1.6",
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
        transform: "translate(-50%, 8px)",
        opacity: "0",
        pointerEvents: "none",
        transition: "opacity 0.2s ease, transform 0.2s ease"
      });
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.style.opacity = "1";
    notice.style.transform = "translate(-50%, 0)";
    clearTimeout(notice._homeListTimer);
    notice._homeListTimer = setTimeout(function () {
      notice.style.opacity = "0";
      notice.style.transform = "translate(-50%, 8px)";
    }, 2200);
  }
  /* ---------------------------------------------------------
     检查网格模式
     如果网格模块存在，则通过其公开接口协调布局。
     不直接修改网格模块内部状态。
  --------------------------------------------------------- */
  function isGridEnabled() {
    if (
      window.WritingHomeGrid &&
      typeof window.WritingHomeGrid.isEnabled === "function"
    ) {
      return window.WritingHomeGrid.isEnabled();
    }
    const shelf = getShelf();
    return Boolean(
      shelf && shelf.classList.contains("shelf-list--grid")
    );
  }
  function disableGridMode() {
    if (
      window.WritingHomeGrid &&
      typeof window.WritingHomeGrid.disable === "function"
    ) {
      window.WritingHomeGrid.disable();
      return;
    }
    const shelf = getShelf();
    if (shelf) {
      shelf.classList.remove("shelf-list--grid");
    }
    document.documentElement.classList.remove("home-grid-enabled");
    try {
      localStorage.setItem(
        "writing-software-home-grid-enabled",
        "false"
      );
    } catch (error) {
      console.warn("[HomeList] 关闭网格模式失败：", error);
    }
  }
  /* ---------------------------------------------------------
     应用列表模式
  --------------------------------------------------------- */
  function applyMode() {
    const shelf = getShelf();
    const button = getListButton();
    if (shelf) {
      shelf.classList.toggle(
        "shelf-list--list",
        STATE.enabled
      );
    }
    document.documentElement.classList.toggle(
      "home-list-enabled",
      STATE.enabled
    );
    if (button) {
      button.setAttribute(
        "aria-pressed",
        String(STATE.enabled)
      );
      const title = button.querySelector(
        SELECTORS.buttonTitle
      );
      if (title) {
        title.textContent = STATE.enabled
          ? "列表模式（已开启）"
          : "列表模式";
      }
    }
  }
  /* ---------------------------------------------------------
     启用列表模式
  --------------------------------------------------------- */
  function enable() {
    if (!STATE.enabled && isGridEnabled()) {
      disableGridMode();
    }
    STATE.enabled = true;
    savePreference();
    applyMode();
    return true;
  }
  /* ---------------------------------------------------------
     关闭列表模式
  --------------------------------------------------------- */
  function disable() {
    STATE.enabled = false;
    savePreference();
    applyMode();
    return true;
  }
  /* ---------------------------------------------------------
     切换列表模式
  --------------------------------------------------------- */
  function toggle() {
    if (STATE.enabled) {
      disable();
    } else {
      enable();
    }
    return STATE.enabled;
  }
  /* ---------------------------------------------------------
     设置按钮
     使用事件委托，避免首页重新渲染后丢失监听。
     不覆盖 home-settings.js 的其他事件。
  --------------------------------------------------------- */
  function bindSettingsButton() {
    if (document.documentElement.dataset.homeListButtonBound === "true") {
      return;
    }
    document.documentElement.dataset.homeListButtonBound = "true";
    document.addEventListener("click", function (event) {
      const button = event.target.closest(SELECTORS.button);
      if (!button) return;
      toggle();
      // 与现有设置弹窗保持兼容。
      const closeButton = document.querySelector(
        "[data-settings-close]:not(.home-settings__backdrop)"
      );
      if (closeButton) {
        closeButton.click();
      }
      event.stopPropagation();
    });
  }
  /* ---------------------------------------------------------
     监听书架变化
     首页重新生成书籍卡片时，重新应用当前布局。
     只观察直接子元素变化，避免无意义的重复刷新。
  --------------------------------------------------------- */
  function observeShelf() {
    const shelf = getShelf();
    if (!shelf || !window.MutationObserver) {
      return;
    }
    if (STATE.observer) {
      STATE.observer.disconnect();
    }
    STATE.observer = new MutationObserver(function () {
      applyMode();
    });
    STATE.observer.observe(shelf, {
      childList: true
    });
  }
  /* ---------------------------------------------------------
     监听其他标签页的设置变化
  --------------------------------------------------------- */
  function bindStorageEvents() {
    window.addEventListener("storage", function (event) {
      if (event.key !== STORAGE_KEY) return;
      STATE.enabled = event.newValue === "true";
      if (STATE.enabled && isGridEnabled()) {
        disableGridMode();
      }
      applyMode();
    });
  }
  /* ---------------------------------------------------------
     初始化
  --------------------------------------------------------- */
  function initialize() {
    if (STATE.initialized) return;
    STATE.initialized = true;
    STATE.enabled = loadPreference();
    if (STATE.enabled && isGridEnabled()) {
      disableGridMode();
    }
    bindSettingsButton();
    bindStorageEvents();
    applyMode();
    observeShelf();
  }
  /* ---------------------------------------------------------
     对外公开接口
  --------------------------------------------------------- */
  window.WritingHomeList = Object.freeze({
    enable: enable,
    disable: disable,
    toggle: toggle,
    isEnabled: function () {
      return STATE.enabled;
    },
    refresh: applyMode
  });
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
