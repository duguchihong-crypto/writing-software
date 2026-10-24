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
   8. 不修改书籍、分组数据
   9. 不清除其他本地数据
  10. 支持书架容器延迟生成
====================================================== */
(function () {
    "use strict";
    /* 防止重复初始化 */
    if (window.WritingHomeGrid) {
        console.warn(
            "[HomeGrid] 网格模块已经初始化，跳过重复初始化。"
        );
        return;
    }
    const STORAGE_KEY = "writing-software-home-grid-enabled";
    const LIST_STORAGE_KEY = "writing-software-home-list-enabled";
    const SELECTOR = {
        shelf: "#shelf-list",
        groups: "#home-groups-list",
        button: '[data-settings-action="grid"]',
        buttonTitle: ".home-settings__option-title",
        closeButton: "[data-settings-close]:not(.home-settings__backdrop)"
    };
    const STATE = {
        enabled: false,
        initialized: false,
        observer: null,
        observedRoot: null,
        pendingRefresh: false
    };
    /* ======================================================
       基础工具
    ====================================================== */
    /**
     * 安全读取本地设置。
     * 只读取指定的布局设置键。
     */
    function readStorage(key) {
        try {
            return window.localStorage.getItem(key) === "true";
        } catch (error) {
            console.warn(
                "[HomeGrid] 读取布局设置失败：",
                error
            );
            return false;
        }
    }
    /**
     * 安全保存本地设置。
     * 不修改其他本地数据。
     */
    function saveStorage(key, value) {
        try {
            window.localStorage.setItem(
                key,
                String(Boolean(value))
            );
        } catch (error) {
            console.warn(
                "[HomeGrid] 保存布局设置失败：",
                error
            );
        }
    }
    /**
     * 获取书籍容器。
     */
    function getShelf() {
        return document.querySelector(SELECTOR.shelf);
    }
    /**
     * 获取分组容器。
     */
    function getGroups() {
        return document.querySelector(SELECTOR.groups);
    }
    /**
     * 获取页面根元素。
     */
    function getRoot() {
        return document.documentElement;
    }
    /* ======================================================
       更新设置按钮
    ====================================================== */
    function updateButton() {
        const buttons = document.querySelectorAll(
            SELECTOR.button
        );
        buttons.forEach(function (button) {
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
        });
    }
    /* ======================================================
       应用网格布局
    ====================================================== */
    /**
     * 同步网格布局类名。
     *
     * 根元素：
     *   home-grid-enabled
     *
     * 书籍容器：
     *   shelf-list--grid
     *
     * 分组容器：
     *   home-groups-list--grid
     *
     * 注意：
     * 不重建卡片，不改变书籍顺序，
     * 不修改书籍或分组数据。
     */
    function applyClassesOnly() {
        const root = getRoot();
        const shelf = getShelf();
        const groups = getGroups();
        root.classList.toggle(
            "home-grid-enabled",
            STATE.enabled
        );
        if (shelf) {
            shelf.classList.toggle(
                "shelf-list--grid",
                STATE.enabled
            );
        }
        if (groups) {
            groups.classList.toggle(
                "home-groups-list--grid",
                STATE.enabled
            );
        }
        updateButton();
    }
    /**
     * 完整应用当前布局。
     */
    function applyMode() {
        applyClassesOnly();
        observePage();
    }
    /* ======================================================
       列表模式互斥
    ====================================================== */
    /**
     * 关闭列表模式。
     *
     * 优先调用原有列表模块的 disable() 接口，
     * 保留其他脚本的既有逻辑。
     */
    function disableListMode() {
        const listModule = window.WritingHomeList;
        if (
            listModule &&
            typeof listModule.disable === "function"
        ) {
            listModule.disable();
        } else {
            const shelf = getShelf();
            if (shelf) {
                shelf.classList.remove(
                    "shelf-list--list"
                );
            }
            getRoot().classList.remove(
                "home-list-enabled"
            );
            saveStorage(
                LIST_STORAGE_KEY,
                false
            );
        }
        /*
         * 再次明确关闭列表模式对应的设置键，
         * 防止列表模块未同步存储状态。
         */
        saveStorage(
            LIST_STORAGE_KEY,
            false
        );
    }
    /* ======================================================
       对外操作接口
    ====================================================== */
    /**
     * 开启网格模式。
     */
    function enable() {
        disableListMode();
        STATE.enabled = true;
        saveStorage(
            STORAGE_KEY,
            true
        );
        saveStorage(
            LIST_STORAGE_KEY,
            false
        );
        applyMode();
        return true;
    }
    /**
     * 关闭网格模式。
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
     * 切换网格模式。
     */
    function toggle() {
        if (STATE.enabled) {
            return disable();
        }
        return enable();
    }
    /* ======================================================
       设置弹窗
    ====================================================== */
    /**
     * 关闭设置弹窗。
     *
     * 如果页面没有关闭按钮，则不执行任何操作。
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
     * 绑定网格模式设置按钮。
     *
     * 使用事件委托，兼容按钮重新生成。
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
                    SELECTOR.button
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
       监听页面变化
    ====================================================== */
    /**
     * 延迟刷新布局，合并短时间内的多次 DOM 变化。
     */
    function scheduleRefresh() {
        if (STATE.pendingRefresh) {
            return;
        }
        STATE.pendingRefresh = true;
        window.requestAnimationFrame(function () {
            STATE.pendingRefresh = false;
            applyClassesOnly();
            /*
             * 如果书架容器刚刚被创建，
             * 确保新的容器也能被观察。
             */
            observePage();
        });
    }
    /**
     * 观察页面中的书籍、分组容器。
     *
     * 页面可能先加载 JS，之后才生成书架。
     * 因此观察 body，兼容容器延迟出现。
     *
     * 这里只监听子节点变化，不监听 class 属性，
     * 避免切换布局时产生观察循环。
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
                let shouldRefresh = false;
                for (const mutation of mutations) {
                    if (
                        mutation.type === "childList" &&
                        (
                            mutation.addedNodes.length > 0 ||
                            mutation.removedNodes.length > 0
                        )
                    ) {
                        shouldRefresh = true;
                        break;
                    }
                }
                if (shouldRefresh) {
                    scheduleRefresh();
                }
            }
        );
        STATE.observer.observe(root, {
            childList: true,
            subtree: true
        });
    }
    /* ======================================================
       监听其他标签页的设置变化
    ====================================================== */
    function bindStorageEvents() {
        window.addEventListener(
            "storage",
            function (event) {
                if (event.key === STORAGE_KEY) {
                    STATE.enabled =
                        event.newValue === "true";
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
       初始化
    ====================================================== */
    function initialize() {
        if (STATE.initialized) {
            return;
        }
        STATE.initialized = true;
        const gridEnabled = readStorage(
            STORAGE_KEY
        );
        const listEnabled = readStorage(
            LIST_STORAGE_KEY
        );
        /*
         * 如果两个模式同时开启，
         * 保留原有规则：优先恢复列表模式。
         */
        if (gridEnabled && listEnabled) {
            STATE.enabled = false;
            saveStorage(
                STORAGE_KEY,
                false
            );
        } else {
            STATE.enabled = gridEnabled;
        }
        bindButton();
        bindStorageEvents();
        applyMode();
        console.info(
            "[HomeGrid] 网格模块初始化完成，当前状态：",
            STATE.enabled ? "开启" : "关闭"
        );
    }
    /* ======================================================
       保留原有公开接口
    ====================================================== */
    window.WritingHomeGrid = Object.freeze({
        enable: enable,
        disable: disable,
        toggle: toggle,
        isEnabled: function () {
            return STATE.enabled;
        },
        refresh: applyMode
    });
    /* ======================================================
       启动
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
