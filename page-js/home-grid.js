(function () {
    "use strict";
    const STORAGE_KEY = "writing-software-home-grid-enabled";
    const LIST_STORAGE_KEY = "writing-software-home-list-enabled";
    const SELECTOR = {
        shelf: "#shelf-list",
        button: '[data-settings-action="grid"]',
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
        return document.querySelector(SELECTOR.shelf);
    }
    /**
     * 读取设置
     */
    function readStorage(key) {
        try {
            return localStorage.getItem(key) === "true";
        } catch (error) {
            console.warn("[HomeGrid] 读取设置失败：", error);
            return false;
        }
    }
    /**
     * 保存设置
     */
    function saveStorage(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (error) {
            console.warn("[HomeGrid] 保存设置失败：", error);
        }
    }
    /**
     * 更新按钮状态
     */
    function updateButton() {
        const button = document.querySelector(SELECTOR.button);
        if (!button) {
            return;
        }
        button.setAttribute(
            "aria-pressed",
            String(STATE.enabled)
        );
        const title = button.querySelector(
            SELECTOR.buttonTitle
        );
        if (title) {
            title.textContent = STATE.enabled
                ? "网格模式（已开启）"
                : "网格模式";
        }
    }
    /**
     * 应用网格布局
     */
    function applyMode() {
        const shelf = getShelf();
        document.documentElement.classList.toggle(
            "home-grid-enabled",
            STATE.enabled
        );
        if (shelf) {
            shelf.classList.toggle(
                "shelf-list--grid",
                STATE.enabled
            );
        }
        updateButton();
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
            saveStorage(LIST_STORAGE_KEY, false);
        }
    }
    /**
     * 开启网格模式
     */
    function enable() {
        // 两种模式互斥。
        disableListMode();
        STATE.enabled = true;
        saveStorage(STORAGE_KEY, true);
        applyMode();
        return true;
    }
    /**
     * 关闭网格模式
     */
    function disable() {
        STATE.enabled = false;
        saveStorage(STORAGE_KEY, false);
        applyMode();
        return false;
    }
    /**
     * 切换网格模式
     */
    function toggle() {
        return STATE.enabled ? disable() : enable();
    }
    /**
     * 关闭设置弹窗
     */
    function closeSettings() {
        const button = document.querySelector(
            SELECTOR.closeButton
        );
        if (button) {
            button.click();
        }
    }
    /**
     * 监听网格按钮。
     * 使用事件委托，避免按钮重新生成后失去监听。
     */
    function bindButton() {
        document.addEventListener(
            "click",
            function (event) {
                const target = event.target;
                if (!(target instanceof Element)) {
                    return;
                }
                const button = target.closest(SELECTOR.button);
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
     * 监听书架变化。
     * 只在书架内容发生变化时重新应用布局。
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
                if (STATE.enabled) {
                    disableListMode();
                }
                applyMode();
                return;
            }
            if (
                event.key === LIST_STORAGE_KEY &&
                event.newValue === "true"
            ) {
                STATE.enabled = false;
                saveStorage(STORAGE_KEY, false);
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
        STATE.enabled = readStorage(STORAGE_KEY);
        // 如果两个模式同时开启，优先恢复列表模式。
        if (
            STATE.enabled &&
            readStorage(LIST_STORAGE_KEY)
        ) {
            STATE.enabled = false;
            saveStorage(STORAGE_KEY, false);
        }
        bindButton();
        bindStorageEvents();
        applyMode();
        observeShelf();
    }
    /**
     * 对外公开接口
     */
    window.WritingHomeGrid = Object.freeze({
        enable: enable,
        disable: disable,
        toggle: toggle,
        isEnabled: function () {
            return STATE.enabled;
        },
        refresh: applyMode
    });
    /**
     * 启动
     */
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
