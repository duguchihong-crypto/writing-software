/* ==================================================
   首页设置弹窗
   文件：page-js/home-settings.js
   功能：
   1. 打开设置弹窗
   2. 关闭设置弹窗
   3. 点击遮罩关闭
   4. 支持 ESC 关闭
   5. 为排序、网格、列表预留独立接口
   ================================================== */

(function () {
  "use strict";

  const settingsElement = document.getElementById("home-settings");
  const settingsDialog = document.getElementById("home-settings-dialog");
  const settingsTrigger = document.getElementById("home-settings-trigger");

  if (!settingsElement || !settingsDialog || !settingsTrigger) {
    console.warn(
      "[HomeSettings] 未找到设置弹窗所需的 HTML 元素。"
    );
    return;
  }

  let isOpen = false;
  let previousFocusElement = null;

  /**
   * 打开设置弹窗
   */
  function openSettings() {
    if (isOpen) return;

    previousFocusElement = document.activeElement;
    isOpen = true;

    settingsElement.hidden = false;

    settingsTrigger.setAttribute("aria-expanded", "true");

    document.body.classList.add("home-settings-open");

    requestAnimationFrame(function () {
      settingsElement.classList.add("is-open");

      const closeButton = settingsElement.querySelector(
        "[data-settings-close]"
      );

      if (closeButton) {
        closeButton.focus();
      } else {
        settingsDialog.focus();
      }
    });
  }

  /**
   * 关闭设置弹窗
   */
  function closeSettings() {
    if (!isOpen) return;

    isOpen = false;

    settingsElement.classList.remove("is-open");

    settingsTrigger.setAttribute("aria-expanded", "false");

    document.body.classList.remove("home-settings-open");

    settingsElement.hidden = true;

    if (
      previousFocusElement &&
      typeof previousFocusElement.focus === "function"
    ) {
      previousFocusElement.focus();
    }

    previousFocusElement = null;
  }

  /**
   * 点击设置按钮
   */
  settingsTrigger.addEventListener("click", function () {
    openSettings();
  });

  /**
   * 点击关闭按钮或遮罩
   */
  settingsElement.addEventListener("click", function (event) {
    const closeTarget = event.target.closest("[data-settings-close]");

    if (closeTarget) {
      closeSettings();
    }
  });

  /**
   * ESC 关闭弹窗
   */
  document.addEventListener("keydown", function (event) {
    if (!isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings();
    }
  });

  /**
   * 点击设置选项
   *
   * 排序、网格、列表的具体功能由各自的 JS 文件负责。
   * 这里仅负责识别选项并分发事件，避免把不同功能写在一起。
   */
  settingsElement.addEventListener("click", function (event) {
    const option = event.target.closest("[data-settings-action]");

    if (!option || !settingsElement.contains(option)) {
      return;
    }

    const action = option.dataset.settingsAction;

    if (!action) return;

    document.dispatchEvent(
      new CustomEvent("writing-home-settings-action", {
        detail: {
          action: action,
          element: option
        }
      })
    );
  });

  /**
   * 暴露设置弹窗接口
   */
  window.WritingHomeSettings = Object.freeze({
    open: openSettings,
    close: closeSettings,
    isOpen: function () {
      return isOpen;
    }
  });
})();
