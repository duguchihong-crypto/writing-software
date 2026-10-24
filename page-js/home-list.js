/* =========================================================
   书籍列表模式模块
   文件：page-js/home-list.js
   功能：
   1. 开启、关闭、切换列表模式
   2. 保存设置并在刷新后恢复
   3. 监听书架变化并保持布局
   4. 与网格模式互斥
   5. 同步设置按钮状态
   6. 不修改书籍数据库
   7. 不参与书籍排序和分组排序
   ========================================================= */
(function () {
  "use strict";
  const STORAGE_KEY = "writing-software-home-list-enabled";
  const GRID_STORAGE_KEY = "writing-software-home-grid-enabled";
  const SELECTORS = {
    shelf: "#shelf-list",
    button: '[data-settings-action="list"]',
    buttonTitle: ".home-settings__option-title",
    closeButton: "[data-settings-close]:not(.home-settings__backdrop)"
  };
  const STATE = {
    enabled: false,
    initialized: false,
    observer: null
  };
  /* =========================================================
     一、基础工具
     ========================================================= */
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
  function saveGridPreference(enabled) {
    try {
      localStorage.setItem(
        GRID_STORAGE_KEY,
        enabled ? "true" : "false"
      );
    } catch (error) {
      console.warn("[HomeList] 更新网格模式设置失败：", error);
    }
  }
  /* =========================================================
     二、检查网格模式
     ========================================================= */
  function isGridEnabled() {
    if (
      window.WritingHomeGrid &&
      typeof window.WritingHomeGrid.isEnabled === "function"
    ) {
      return window.WritingHomeGrid.isEnabled();
    }
    const shelf = getShelf();
    if (shelf && shelf.classList.contains("shelf-list--grid")) {
      return true;
    }
    try {
      return localStorage.getItem(GRID_STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  }
  /* =========================================================
     三、关闭网格模式
     优先使用网格模块公开接口。
     如果网格模块尚未初始化，则直接更新 DOM 和存储。
     ========================================================= */
  function disableGridMode() {
    if (
      window.WritingHomeGrid &&
      typeof window.WritingHomeGrid.disable === "function"
    ) {
      window.WritingHomeGrid.disable();
    } else {
      const shelf = getShelf();
      if (shelf) {
        shelf.classList.remove("shelf-list--grid");
      }
      document.documentElement.classList.remove(
        "home-grid-enabled"
      );
      saveGridPreference(false);
      const gridButton = document.querySelector(
        '[data-settings-action="grid"]'
      );
      if (gridButton) {
        gridButton.setAttribute("aria-pressed", "false");
        const title = gridButton.querySelector(
          ".home-settings__option-title"
        );
        if (title) {
          title.textContent = "网格模式";
        }
      }
    }
    // 再次确保网格状态关闭。
    saveGridPreference(false);
  }
  /* =========================================================
     四、更新列表按钮状态
     ========================================================= */
  function updateButton() {
    const button = getListButton();
    if (!button) {
      return;
    }
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
  /* =========================================================
     五、应用列表模式
     ========================================================= */
  function applyMode() {
    const shelf = getShelf();
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
    updateButton();
  }
  /* =========================================================
     六、开启列表模式
     ========================================================= */
  function enable() {
    // 开启列表模式前，先关闭网格模式。
    if (isGridEnabled()) {
      disableGridMode();
    }
    STATE.enabled = true;
    savePreference();
    applyMode();
    return true;
  }
  /* =========================================================
     七、关闭列表模式
     ========================================================= */
  function disable() {
    STATE.enabled = false;
    savePreference();
    applyMode();
    return true;
  }
  /* =========================================================
     八、切换列表模式
     ========================================================= */
  function toggle() {
    if (STATE.enabled) {
      disable();
    } else {
      enable();
    }
    return STATE.enabled;
  }
  /* =========================================================
     九、关闭设置弹窗
     ========================================================= */
  function closeSettings() {
    const closeButton = document.querySelector(
      SELECTORS.closeButton
    );
    if (closeButton) {
      closeButton.click();
    }
  }
  /* =========================================================
     十、设置按钮事件
     使用事件委托，兼容重新生成的设置按钮。
     通过标记避免重复绑定。
     使用 stopImmediatePropagation 避免其他旧的列表
     模块点击监听器再次切换状态。
     ========================================================= */
  function bindSettingsButton() {
    if (
      document.documentElement.dataset.homeListButtonBound === "true"
    ) {
      return;
    }
    document.documentElement.dataset.homeListButtonBound = "true";
    document.addEventListener(
      "click",
      function (event) {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const button = target.closest(SELECTORS.button);
        if (!button) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        toggle();
        closeSettings();
      },
      true
    );
  }
  /* =========================================================
     十一、监听书架变化
     ========================================================= */
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
  /* =========================================================
     十二、监听其他标签页的设置变化
     ========================================================= */
  function bindStorageEvents() {
    window.addEventListener("storage", function (event) {
      if (event.key === STORAGE_KEY) {
        STATE.enabled = event.newValue === "true";
        if (STATE.enabled && isGridEnabled()) {
          disableGridMode();
        }
        applyMode();
        return;
      }
      if (event.key === GRID_STORAGE_KEY) {
        if (event.newValue === "true" && STATE.enabled) {
          STATE.enabled = false;
          savePreference();
          applyMode();
        }
      }
    });
  }
  /* =========================================================
     十三、初始化
     ========================================================= */
  function initialize() {
    if (STATE.initialized) {
      return;
    }
    STATE.initialized = true;
    STATE.enabled = loadPreference();
    // 如果两个模式同时保存为开启状态，优先保留列表模式，
    // 并关闭网格模式，确保状态一致。
    if (STATE.enabled && isGridEnabled()) {
      disableGridMode();
    }
    bindSettingsButton();
    bindStorageEvents();
    applyMode();
    observeShelf();
  }
  /* =========================================================
     十四、对外公开接口
     ========================================================= */
  window.WritingHomeList = Object.freeze({
    enable: enable,
    disable: disable,
    toggle: toggle,
    isEnabled: function () {
      return STATE.enabled;
    },
    refresh: applyMode
  });
  /* =========================================================
     十五、启动
     ========================================================= */
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
