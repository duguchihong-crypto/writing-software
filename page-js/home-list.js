/* ======================================================
   写作软件 · 首页列表模式
   文件：page-js/home-list.js
   功能：
   1. 开启或关闭列表模式
   2. 与网格模式互斥
   3. 保存并恢复列表模式设置
   4. 监听跨标签页的设置变化
   5. 支持书籍与分组布局刷新
   6. 保留原有公开接口
   7. 避免重复初始化
   8. 兼容书架容器重新生成
   9. 不修改书籍、分组数据
  10. 不清除其他本地数据
====================================================== */
(function () {
    "use strict";
    /* 防止重复初始化 */
    if (window.WritingHomeList) {
        console.warn(
            "[HomeList] 列表模块已经初始化，跳过重复初始化。"
        );
        return;
    }
    const STORAGE_KEY =
        "writing-software-home-list-enabled";
    const GRID_STORAGE_KEY =
        "writing-software-home-grid-enabled";
    const SELECTORS = {
        shelf: "#shelf-list",
        groups: "#home-groups-list",
        button: '[data-settings-action="list"]',
        buttonTitle: ".home-settings__option-title",
        closeButton:
            "[data-settings-close]:not(.home-settings__backdrop)"
    };
    const STATE = {
        enabled: false,
        initialized: false,
        observer: null,
        observedRoot: null,
        pendingRefresh: false
    };
    /* ======================================================
       一、基础工具
    ====================================================== */
    /**
     * 获取书籍容器。
     */
    function getShelf() {
        return document.querySelector(SELECTORS.shelf);
    }
    /**
     * 获取分组容器。
     */
    function getGroups() {
        return document.querySelector(SELECTORS.groups);
    }
    /**
     * 安全读取本地设置。
     */
    function readStorage(key) {
        try {
            return window.localStorage.getItem(key) === "true";
        } catch (error) {
            console.warn(
                "[HomeList] 读取设置失败：",
                error
            );
            return false;
        }
    }
    /**
     * 安全保存指定设置。
     *
     * 只修改列表或网格对应的设置键。
     */
    function saveStorage(key, value) {
        try {
            window.localStorage.setItem(
                key,
                String(Boolean(value))
            );
        } catch (error) {
            console.warn(
                "[HomeList] 保存设置失败：",
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
        return readStorage(GRID_STORAGE_KEY);
    }
    /* ======================================================
       二、设置按钮
    ====================================================== */
    function updateButton() {
        const buttons = document.querySelectorAll(
            SELECTORS.button
        );
        buttons.forEach(function (button) {
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
        });
    }
    /* ======================================================
       三、应用列表布局
    ====================================================== */
    /**
     * 同步列表模式的布局类名。
     *
     * 书籍容器：
     *   shelf-list--list
     *
     * 页面根元素：
     *   home-list-enabled
     *
     * 列表模式开启时，同时确保网格模式关闭。
     */
    function applyClassesOnly() {
        const root = document.documentElement;
        const shelf = getShelf();
        const groups = getGroups();
        root.classList.toggle(
            "home-list-enabled",
            STATE.enabled
        );
        if (shelf) {
            shelf.classList.toggle(
                "shelf-list--list",
                STATE.enabled
            );
            if (STATE.enabled) {
                shelf.classList.remove(
                    "shelf-list--grid"
                );
            }
        }
        /*
         * 列表模式不使用分组网格专用类。
         * 不移动分组，也不修改分组数据。
         */
        if (groups && STATE.enabled) {
            groups.classList.remove(
                "home-groups-list--grid"
            );
        }
        if (STATE.enabled) {
            root.classList.remove(
                "home-grid-enabled"
            );
        }
        updateButton();
    }
    /**
     * 应用当前列表布局。
     */
    function applyMode() {
        applyClassesOnly();
        observePage();
    }
    /* ======================================================
       四、网格模式互斥
    ====================================================== */
    /**
     * 关闭网格模式。
     *
     * 优先调用网格模块的公开接口。
     */
    function disableGridMode() {
        const gridModule = window.WritingHomeGrid;
        if (
            gridModule &&
            typeof gridModule.disable === "function"
        ) {
            gridModule.disable();
        } else {
            saveStorage(
                GRID_STORAGE_KEY,
                false
            );
            const shelf = getShelf();
            if (shelf) {
                shelf.classList.remove(
                    "shelf-list--grid"
                );
            }
            document.documentElement.classList.remove(
                "home-grid-enabled"
            );
            const groups = getGroups();
            if (groups) {
                groups.classList.remove(
                    "home-groups-list--grid"
                );
            }
        }
        saveStorage(
            GRID_STORAGE_KEY,
            false
        );
    }
    /* ======================================================
       五、公开操作
    ====================================================== */
    /**
     * 开启列表模式。
     */
    function enable() {
        /*
         * 先关闭网格模式，确保两种模式互斥。
         */
        disableGridMode();
        STATE.enabled = true;
        saveStorage(
            STORAGE_KEY,
            true
        );
        saveStorage(
            GRID_STORAGE_KEY,
            false
        );
        applyMode();
        return true;
    }
    /**
     * 关闭列表模式。
     */
    function disable() {
        STATE.enabled = false;
        saveStorage(
            STORAGE_KEY,
            false
        );
        applyMode();
        return false;
    }
    /**
     * 切换列表模式。
     */
    function toggle() {
        return STATE.enabled
            ? disable()
            : enable();
    }
    /* ======================================================
       六、设置弹窗
    ====================================================== */
    function closeSettings() {
        const button = document.querySelector(
            SELECTORS.closeButton
        );
        if (button) {
            button.click();
        }
    }
    /**
     * 使用事件委托绑定列表按钮。
     */
    function bindButton() {
        document.addEventListener(
            "click",
            function (event) {
                const target = event.target;
                if (!(target instanceof Element)) {
                    return;
                }
                const button = target.closest(
                    SELECTORS.button
                );
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
    /* ======================================================
       七、观察页面变化
    ====================================================== */
    /**
     * 合并短时间内的多次 DOM 变化。
     */
    function scheduleRefresh() {
        if (STATE.pendingRefresh) {
            return;
        }
        STATE.pendingRefresh = true;
        window.requestAnimationFrame(function () {
            STATE.pendingRefresh = false;
            applyClassesOnly();
            observePage();
        });
    }
    /**
     * 观察页面结构变化。
     *
     * 支持书架或分组容器重新生成。
     * 只监听 DOM 子节点变化，不监听 class 属性，
     * 避免修改布局类名时形成观察循环。
     */
    function observePage() {
        if (!window.MutationObserver) {
            return;
        }
        const root = document.body;
        if (!root) {
            return;
        }
        if (
            STATE.observer &&
            STATE.observedRoot === root
        ) {
            return;
        }
        if (STATE.observer) {
            STATE.observer.disconnect();
        }
        STATE.observedRoot = root;
        STATE.observer = new MutationObserver(
            function (mutations) {
                for (const mutation of mutations) {
                    if (
                        mutation.type === "childList" &&
                        (
                            mutation.addedNodes.length > 0 ||
                            mutation.removedNodes.length > 0
                        )
                    ) {
                        scheduleRefresh();
                        return;
                    }
                }
            }
        );
        STATE.observer.observe(root, {
            childList: true,
            subtree: true
        });
    }
    /* ======================================================
       八、跨标签页同步
    ====================================================== */
    function bindStorageEvents() {
        window.addEventListener(
            "storage",
            function (event) {
                /*
                 * 列表模式设置发生变化。
                 */
                if (event.key === STORAGE_KEY) {
                    STATE.enabled =
                        event.newValue === "true";
                    if (STATE.enabled) {
                        disableGridMode();
                    }
                    applyMode();
                    return;
                }
                /*
                 * 网格模式被其他标签页开启。
                 * 当前页面应退出列表模式。
                 */
                if (
                    event.key === GRID_STORAGE_KEY &&
                    event.newValue === "true"
                ) {
                    STATE.enabled = false;
                    saveStorage(
                        STORAGE_KEY,
                        false
                    );
                    applyMode();
                }
            }
        );
    }
    /* ======================================================
       九、初始化
    ====================================================== */
    function initialize() {
        if (STATE.initialized) {
            return;
        }
        STATE.initialized = true;
        const listEnabled = readStorage(
            STORAGE_KEY
        );
        const gridEnabled = readStorage(
            GRID_STORAGE_KEY
        );
        /*
         * 如果两种模式同时开启，
         * 保留原来的规则：优先列表模式。
         */
        if (listEnabled && gridEnabled) {
            STATE.enabled = true;
            saveStorage(
                GRID_STORAGE_KEY,
                false
            );
        } else {
            STATE.enabled = listEnabled;
        }
        bindButton();
        bindStorageEvents();
        applyMode();
        console.info(
            "[HomeList] 列表模块初始化完成，当前状态：",
            STATE.enabled ? "开启" : "关闭"
        );
    }
    /* ======================================================
       十、保留原有公开接口
    ====================================================== */
    window.WritingHomeList = Object.freeze({
        enable: enable,
        disable: disable,
        toggle: toggle,
        isEnabled: function () {
            return STATE.enabled;
        },
        refresh: applyMode
    });
    /* ======================================================
       十一、启动
    ====================================================== */
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
