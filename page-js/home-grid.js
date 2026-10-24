(function () {
    "use strict";
    const STORAGE_KEY = "writing-software-home-grid-enabled";
    const LIST_STORAGE_KEY = "writing-software-home-list-enabled";
    let enabled = false;
    let initialized = false;
    let observer = null;
    /**
     * 获取书架容器
     */
    function getShelf() {
        return document.getElementById("shelf-list");
    }
    /**
     * 读取本地设置
     */
    function readPreference(key) {
        try {
            return localStorage.getItem(key) === "true";
        } catch (error) {
            console.warn("读取显示模式失败。", error);
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
            console.warn("保存网格模式失败。", error);
        }
    }
    /**
     * 关闭列表模式
     */
    function disableListMode() {
        if (
            window.WritingHomeList &&
            typeof window.WritingHomeList.disable === "function"
        ) {
            window.WritingHomeList.disable();
        } else {
            const shelf = getShelf();
            if (shelf) {
                shelf.classList.remove("shelf-list--list");
            }
            document.documentElement.classList.remove(
                "home-list-enabled"
            );
            try {
                localStorage.setItem(LIST_STORAGE_KEY, "false");
            } catch (error) {
                console.warn("关闭列表模式失败。", error);
            }
        }
    }
    /**
     * 更新网格按钮状态
     */
    function updateButton() {
        const button = document.querySelector(
            '[data-settings-action="grid"]'
        );
        if (!button) {
            return;
        }
        button.setAttribute("aria-pressed", String(enabled));
        const title = button.querySelector(
            ".home-settings__option-title"
        );
        if (title) {
            title.textContent = enabled
                ? "网格模式（已开启）"
                : "网格模式";
        }
    }
    /**
     * 应用网格模式
     */
    function applyMode() {
        const shelf = getShelf();
        document.documentElement.classList.toggle(
            "home-grid-enabled",
            enabled
        );
        if (shelf) {
            shelf.classList.toggle(
                "shelf-list--grid",
                enabled
            );
        }
        updateButton();
    }
    /**
     * 开启网格模式
     */
    function enable() {
        disableListMode();
        enabled = true;
        savePreference();
        applyMode();
        return true;
    }
    /**
     * 关闭网格模式
     */
    function disable() {
        enabled = false;
        savePreference();
        applyMode();
        return false;
    }
    /**
     * 切换网格模式
     */
    function toggleMode() {
        if (enabled) {
            disable();
        } else {
            enable();
        }
        return enabled;
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
     * 绑定网格按钮
     */
    function bindGridButton() {
        document.addEventListener(
            "click",
            function (event) {
                const target = event.target;
                if (!(target instanceof Element)) {
                    return;
                }
                const button = target.closest(
                    '[data-settings-action="grid"]'
                );
                if (!button) {
                    return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                toggleMode();
                closeSettings();
            },
            true
        );
    }
    /**
     * 监听书架变化
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
            applyMode();
        });
        observer.observe(shelf, {
            childList: true
        });
    }
    /**
     * 监听其他标签页的设置变化
     */
    function bindStorageEvents() {
        window.addEventListener("storage", function (event) {
            if (event.key === STORAGE_KEY) {
                enabled = event.newValue === "true";
                if (enabled) {
                    disableListMode();
                }
                applyMode();
                return;
            }
            if (
                event.key === LIST_STORAGE_KEY &&
                event.newValue === "true"
            ) {
                enabled = false;
                savePreference();
                applyMode();
            }
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
        enabled = readPreference(STORAGE_KEY);
        // 如果两个模式都被保存为开启，优先保留列表模式。
        // 用户之后可以手动切换到网格模式。
        if (enabled && readPreference(LIST_STORAGE_KEY)) {
            enabled = false;
            savePreference();
        }
        bindGridButton();
        bindStorageEvents();
        applyMode();
        observeShelf();
    }
    /**
     * 对外接口
     */
    window.WritingHomeGrid = Object.freeze({
        enable: enable,
        disable: disable,
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
