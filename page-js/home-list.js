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
    /**
     * 获取书架
     */
    function getShelf() {
        return document.querySelector(SELECTORS.shelf);
    }
    /**
     * 读取设置
     */
    function loadPreference() {
        try {
            return localStorage.getItem(STORAGE_KEY) === "true";
        } catch (error) {
            console.warn("[HomeList] 读取设置失败：", error);
            return false;
        }
    }
    /**
     * 保存列表设置
     */
    function savePreference() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                String(STATE.enabled)
            );
        } catch (error) {
            console.warn("[HomeList] 保存设置失败：", error);
        }
    }
    /**
     * 判断网格模式是否开启
     */
    function isGridEnabled() {
        if (
            window.WritingHomeGrid &&
            typeof window.WritingHomeGrid.isEnabled === "function"
        ) {
            return window.WritingHomeGrid.isEnabled();
        }
        try {
            return localStorage.getItem(GRID_STORAGE_KEY) === "true";
        } catch (error) {
            return false;
        }
    }
    /**
     * 更新按钮文字和状态
     */
    function updateButton() {
        const button = document.querySelector(SELECTORS.button);
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
    /**
     * 应用列表样式
     */
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
    /**
     * 关闭列表模式
     */
    function disable() {
        STATE.enabled = false;
        savePreference();
        applyMode();
        return false;
    }
    /**
     * 开启列表模式
     */
    function enable() {
        // 先关闭网格模式，确保两种布局不会同时生效。
        if (
            window.WritingHomeGrid &&
            typeof window.WritingHomeGrid.disable === "function"
        ) {
            window.WritingHomeGrid.disable();
        } else {
            try {
                localStorage.setItem(GRID_STORAGE_KEY, "false");
            } catch (error) {
                console.warn("[HomeList] 更新网格设置失败：", error);
            }
            const shelf = getShelf();
            if (shelf) {
                shelf.classList.remove("shelf-list--grid");
            }
            document.documentElement.classList.remove(
                "home-grid-enabled"
            );
        }
        STATE.enabled = true;
        savePreference();
        applyMode();
        return true;
    }
    /**
     * 切换列表模式
     */
    function toggle() {
        return STATE.enabled ? disable() : enable();
    }
    /**
     * 关闭设置弹窗
     */
    function closeSettings() {
        const button = document.querySelector(
            SELECTORS.closeButton
        );
        if (button) {
            button.click();
        }
    }
    /**
     * 监听列表按钮
     */
    function bindButton() {
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
    /**
     * 监听书架变化
     */
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
    /**
     * 监听其他标签页的设置变化
     */
    function bindStorageEvents() {
        window.addEventListener("storage", function (event) {
            if (event.key === STORAGE_KEY) {
                STATE.enabled = event.newValue === "true";
                if (STATE.enabled && isGridEnabled()) {
                    if (
                        window.WritingHomeGrid &&
                        typeof window.WritingHomeGrid.disable === "function"
                    ) {
                        window.WritingHomeGrid.disable();
                    }
                }
                applyMode();
                return;
            }
            if (
                event.key === GRID_STORAGE_KEY &&
                event.newValue === "true" &&
                STATE.enabled
            ) {
                STATE.enabled = false;
                savePreference();
                applyMode();
            }
        });
    }
    /**
     * 初始化
     */
    function initialize() {
        if (STATE.initialized) {
            return;
        }
        STATE.initialized = true;
        STATE.enabled = loadPreference();
        // 两种模式同时开启时，优先保留列表模式。
        if (STATE.enabled && isGridEnabled()) {
            try {
                localStorage.setItem(GRID_STORAGE_KEY, "false");
            } catch (error) {
                console.warn("[HomeList] 初始化设置失败：", error);
            }
        }
        bindButton();
        bindStorageEvents();
        applyMode();
        observeShelf();
    }
    /**
     * 公开接口
     */
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
