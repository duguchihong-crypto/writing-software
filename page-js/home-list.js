/* ======================================================
   写作软件 · 首页列表模式
   文件：page-js/home-list.js
   功能：
   1. 开启或关闭列表模式
   2. 与网格模式互斥
   3. 保存并恢复列表模式设置
   4. 监听跨标签页的设置变化
   5. 支持首页书籍和分组布局刷新
   6. 保留原有公开接口
   7. 避免重复初始化和重复创建观察器
   8. 不修改书籍、分组数据
====================================================== */
(function () {
    "use strict";
    if (window.WritingHomeList) {
        console.warn(
            "[HomeList] 列表模块已经初始化，跳过重复初始化。"
        );
        return;
    }
    const STORAGE_KEY = "writing-software-home-list-enabled";
    const GRID_STORAGE_KEY = "writing-software-home-grid-enabled";
    const SELECTORS = {
        shelf: "#shelf-list",
        button: '[data-settings-action="list"]',
        buttonTitle: ".home-settings__option-title",
        closeButton:
            "[data-settings-close]:not(.home-settings__backdrop)"
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
        return document.querySelector(SELECTORS.shelf);
    }
    /**
     * 读取列表模式设置。
     */
    function loadPreference() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) === "true";
        } catch (error) {
            console.warn(
                "[HomeList] 读取设置失败：",
                error
            );
            return false;
        }
    }
    /**
     * 保存列表模式设置。
     */
    function savePreference() {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                String(STATE.enabled)
            );
        } catch (error) {
            console.warn(
                "[HomeList] 保存设置失败：",
                error
            );
        }
    }
    /**
     * 保存网格模式设置。
     */
    function saveGridPreference(value) {
        try {
            window.localStorage.setItem(
                GRID_STORAGE_KEY,
                String(Boolean(value))
            );
        } catch (error) {
            console.warn(
                "[HomeList] 更新网格设置失败：",
                error
            );
        }
    }
    /**
     * 判断网格模式是否开启。
     */
    function isGridEnabled() {
        if (
            window.WritingHomeGrid &&
            typeof window.WritingHomeGrid.isEnabled === "function"
        ) {
            return window.WritingHomeGrid.isEnabled();
        }
        try {
            return (
                window.localStorage.getItem(GRID_STORAGE_KEY) === "true"
            );
        } catch (error) {
            console.warn(
                "[HomeList] 读取网格设置失败：",
                error
            );
            return false;
        }
    }
    /**
     * 更新列表设置按钮。
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
     * 只更新布局类名。
     *
     * 不移动卡片，不修改书籍或分组数据。
     */
    function applyClassesOnly() {
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
     * 应用列表模式。
     */
    function applyMode() {
        applyClassesOnly();
        observeShelf();
    }
    /**
     * 关闭列表模式。
     */
    function disable() {
        STATE.enabled = false;
        savePreference();
        applyMode();
        return false;
    }
    /**
     * 开启列表模式。
     *
     * 列表与网格模式互斥。
     */
    function enable() {
        if (
            window.WritingHomeGrid &&
            typeof window.WritingHomeGrid.disable === "function"
        ) {
            window.WritingHomeGrid.disable();
        } else {
            saveGridPreference(false);
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
     * 切换列表模式。
     */
    function toggle() {
        return STATE.enabled ? disable() : enable();
    }
    /**
     * 关闭设置弹窗。
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
     * 监听列表模式按钮。
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
     * 监听书架变化。
     *
     * 观察器只在书架容器发生变化时重新绑定，
     * 不会因为每次刷新而重复创建。
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
            applyClassesOnly();
        });
        STATE.observer.observe(shelf, {
            childList: true
        });
    }
    /**
     * 监听其他标签页的布局设置变化。
     */
    function bindStorageEvents() {
        window.addEventListener(
            "storage",
            function (event) {
                if (event.key === STORAGE_KEY) {
                    STATE.enabled = event.newValue === "true";
                    if (STATE.enabled && isGridEnabled()) {
                        saveGridPreference(false);
                        if (
                            window.WritingHomeGrid &&
                            typeof window.WritingHomeGrid.disable ===
                                "function"
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
            }
        );
    }
    /**
     * 初始化。
     */
    function initialize() {
        if (STATE.initialized) {
            return;
        }
        STATE.initialized = true;
        STATE.enabled = loadPreference();
        /*
         * 如果两种模式同时开启，
         * 优先保留列表模式。
         */
        if (STATE.enabled && isGridEnabled()) {
            saveGridPreference(false);
        }
        bindButton();
        bindStorageEvents();
        applyMode();
    }
    /**
     * 对外公开接口。
     *
     * 保留原来的 enable、disable、toggle、
     * isEnabled 和 refresh，避免其他脚本失效。
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
