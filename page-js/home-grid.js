/* ======================================================
   写作软件 · 首页网格模式
   文件：page-js/home-grid.js
   功能：
   1. 开启或关闭网格模式
   2. 网格模式与列表模式互斥
   3. 记住用户的布局选择
   4. 监听设置变化并同步布局
   5. 支持书籍与分组共用的首页网格
   6. 保留原有公开接口和设置按钮
   7. 避免重复初始化
   8. 不修改书籍、分组数据，不清除其他本地数据
====================================================== */
(function () {
    "use strict";
    if (window.WritingHomeGrid) {
        console.warn("[HomeGrid] 网格模块已经初始化，跳过重复初始化。");
        return;
    }
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
        observer: null,
        observedShelf: null
    };
    /**
     * 获取书架容器。
     */
    function getShelf() {
        return document.querySelector(SELECTOR.shelf);
    }
    /**
     * 安全读取布局设置。
     */
    function readStorage(key) {
        try {
            return window.localStorage.getItem(key) === "true";
        } catch (error) {
            console.warn("[HomeGrid] 读取布局设置失败：", error);
            return false;
        }
    }
    /**
     * 安全保存布局设置。
     * 只操作当前布局对应的设置键。
     */
    function saveStorage(key, value) {
        try {
            window.localStorage.setItem(key, String(Boolean(value)));
        } catch (error) {
            console.warn("[HomeGrid] 保存布局设置失败：", error);
        }
    }
    /**
     * 更新设置按钮的显示状态。
     */
    function updateButton() {
        const button = document.querySelector(SELECTOR.button);
        if (!button) {
            return;
        }
        button.setAttribute("aria-pressed", String(STATE.enabled));
        const title = button.querySelector(SELECTOR.buttonTitle);
        if (title) {
            title.textContent = STATE.enabled
                ? "网格模式（已开启）"
                : "网格模式";
        }
    }
    /**
     * 应用网格模式。
     *
     * 网格模式的 CSS 通过根元素上的
     * home-grid-enabled 类控制。
     *
     * 书籍容器仍保留原有类名，
     * 避免破坏现有 CSS 和其他脚本。
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
        observeShelf();
    }
    /**
     * 关闭列表模式。
     */
    function disableListMode() {
        const listModule = window.WritingHomeList;
        if (
            listModule &&
            typeof listModule.disable === "function"
        ) {
            listModule.disable();
            return;
        }
        const shelf = getShelf();
        if (shelf) {
            shelf.classList.remove("shelf-list--list");
        }
        document.documentElement.classList.remove(
            "home-list-enabled"
        );
        saveStorage(LIST_STORAGE_KEY, false);
    }
    /**
     * 开启网格模式。
     */
    function enable() {
        disableListMode();
        STATE.enabled = true;
        saveStorage(STORAGE_KEY, true);
        saveStorage(LIST_STORAGE_KEY, false);
        applyMode();
        return true;
    }
    /**
     * 关闭网格模式。
     */
    function disable() {
        STATE.enabled = false;
        saveStorage(STORAGE_KEY, false);
        applyMode();
        return false;
    }
    /**
     * 切换网格模式。
     */
    function toggle() {
        return STATE.enabled ? disable() : enable();
    }
    /**
     * 关闭设置弹窗。
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
     *
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
     *
     * 只观察书架的直接子节点变化，
     * 不监听属性变化，避免 applyMode() 引起循环。
     */
    function observeShelf() {
        const shelf = getShelf();
        if (!window.MutationObserver) {
            return;
        }
        if (!shelf) {
            if (STATE.observer) {
                STATE.observer.disconnect();
                STATE.observer = null;
                STATE.observedShelf = null;
            }
            return;
        }
        if (
            STATE.observer &&
            STATE.observedShelf === shelf
        ) {
            return;
        }
        if (STATE.observer) {
            STATE.observer.disconnect();
        }
        STATE.observedShelf = shelf;
        STATE.observer = new MutationObserver(function () {
            /*
             * 内容更新后重新应用布局。
             * 不改变卡片顺序，不操作存储数据。
             */
            applyClassesOnly();
        });
        STATE.observer.observe(shelf, {
            childList: true
        });
    }
    /**
     * 只重新应用布局类名。
     * 避免 MutationObserver 反复重建观察器。
     */
    function applyClassesOnly() {
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
     * 监听其他标签页的布局设置变化。
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
     * 初始化。
     */
    function initialize() {
        if (STATE.initialized) {
            return;
        }
        STATE.initialized = true;
        STATE.enabled = readStorage(STORAGE_KEY);
        /*
         * 如果两个模式同时开启，
         * 保留原有规则：优先恢复列表模式。
         */
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
    }
    /**
     * 对外公开接口。
     * 保留原有接口，避免其他脚本调用失败。
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
     * 启动。
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
