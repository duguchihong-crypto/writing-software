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
        if (isOpen) {
            return;
        }
        previousFocusElement = document.activeElement;
        isOpen = true;
        settingsElement.hidden = false;
        settingsTrigger.setAttribute("aria-expanded", "true");
        document.body.classList.add("home-settings-open");
        requestAnimationFrame(function () {
            settingsElement.classList.add("is-open");
            const closeButton = settingsElement.querySelector(
                ".home-settings__close"
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
        if (!isOpen) {
            return;
        }
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
     * 设置按钮
     */
    settingsTrigger.addEventListener("click", openSettings);
    /**
     * 关闭按钮和遮罩
     */
    settingsElement.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const closeTarget = target.closest("[data-settings-close]");
        if (closeTarget && settingsElement.contains(closeTarget)) {
            closeSettings();
            return;
        }
        const option = target.closest("[data-settings-action]");
        if (!option || !settingsElement.contains(option)) {
            return;
        }
        const action = option.dataset.settingsAction;
        if (!action) {
            return;
        }
        // 分发事件给排序、网格、列表等模块。
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
     * ESC 关闭弹窗
     */
    document.addEventListener("keydown", function (event) {
        if (isOpen && event.key === "Escape") {
            event.preventDefault();
            closeSettings();
        }
    });
    /**
     * 暴露接口
     */
    window.WritingHomeSettings = Object.freeze({
        open: openSettings,
        close: closeSettings,
        isOpen: function () {
            return isOpen;
        }
    });
})();
