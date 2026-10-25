/* ======================================================
   写作软件 · 首页列表模式
   文件：page-js/home-list.js
   功能：
   1. 开启或关闭列表模式
   2. 与网格模式互斥
   3. 保存并恢复布局设置
   4. 监听跨标签页设置变化
   5. 支持书籍与分组布局刷新
   6. 保留原有公开接口
   7. 避免重复初始化
   8. 兼容书架容器重新生成
   9. 不修改书籍、分组数据
  10. 不清除其他本地数据
====================================================== */
(function () {
    "use strict";
    /* ======================================================
       一、重复初始化保护
    ====================================================== */
    if (window.WritingHomeList) {
        console.warn(
            "[HomeList] 列表模块已经初始化，跳过重复初始化。"
        );
        return;
    }
    /* ======================================================
       二、常量与状态
    ====================================================== */
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
            '[data-settings-close]:not(.home-settings__backdrop)'
    };
    const STATE = {
        enabled: false,
        initialized: false,
        observer: null,
        observedRoot: null,
        pendingRefresh: false,
        handlingStorage: false
    };
    /* ======================================================
       三、基础工具
    ====================================================== */
    function getShelf() {
        return document.querySelector(SELECTORS.shelf);
    }
    function getGroups() {
        return document.querySelector(SELECTORS.groups);
    }
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
    function saveStorage(key, value) {
        try {
            window.localStorage.setItem(
                key,
                value ? "true" : "false"
            );
        } catch (error) {
            console.warn(
                "[HomeList] 保存设置失败：",
                error
            );
        }
    }
    function updateButton() {
        document.querySelectorAll(SELECTORS.button).forEach(
            function (button) {
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
        );
        document.querySelectorAll(
            '[data-settings-action="grid"]'
        ).forEach(function (button) {
            button.setAttribute(
                "aria-pressed",
                String(!STATE.enabled)
            );
            const title = button.querySelector(
                SELECTORS.buttonTitle
            );
            if (title) {
                title.textContent = !STATE.enabled
                    ? "网格模式（已开启）"
                    : "网格模式";
            }
        });
    }
    /* ======================================================
       四、统一应用布局类名
       列表模式开启：
       html.home-list-enabled
       #shelf-list.shelf-list--list
       #home-groups-list.home-groups-list--list
       列表模式关闭：
       由网格模块决定是否应用网格类名。
    ====================================================== */
    function applyClassesOnly() {
        const root = document.documentElement;
        const shelf = getShelf();
        const groups = getGroups();
        root.classList.toggle(
            "home-list-enabled",
            STATE.enabled
        );
        if (STATE.enabled) {
            root.classList.remove("home-grid-enabled");
        }
        if (shelf) {
            shelf.classList.toggle(
                "shelf-list--list",
                STATE.enabled
            );
            if (STATE.enabled) {
                shelf.classList.remove("shelf-list--grid");
            }
        }
        if (groups) {
            groups.classList.toggle(
                "home-groups-list--list",
                STATE.enabled
            );
            if (STATE.enabled) {
                groups.classList.remove(
                    "home-groups-list--grid"
                );
            }
        }
        updateButton();
    }
    function applyMode() {
        applyClassesOnly();
        observePage();
    }
    /* ======================================================
       五、关闭网格模式
       优先调用网格模块的公开接口。
       不修改任何书籍或分组数据。
    ====================================================== */
    function disableGridMode() {
        const gridModule = window.WritingHomeGrid;
        if (
            gridModule &&
            typeof gridModule.disable === "function"
        ) {
            gridModule.disable();
        } else {
            saveStorage(GRID_STORAGE_KEY, false);
            const root = document.documentElement;
            const shelf = getShelf();
            const groups = getGroups();
            root.classList.remove("home-grid-enabled");
            if (shelf) {
                shelf.classList.remove("shelf-list--grid");
            }
            if (groups) {
                groups.classList.remove(
                    "home-groups-list--grid"
                );
            }
        }
        saveStorage(GRID_STORAGE_KEY, false);
    }
    /* ======================================================
       六、公开操作
    ====================================================== */
    function enable() {
        /*
         * 先关闭网格模式，再启用列表模式。
         */
        disableGridMode();
        STATE.enabled = true;
        saveStorage(STORAGE_KEY, true);
        saveStorage(GRID_STORAGE_KEY, false);
        applyMode();
        return true;
    }
    function disable() {
        STATE.enabled = false;
        saveStorage(STORAGE_KEY, false);
        applyMode();
        return false;
    }
    function toggle() {
        return STATE.enabled
            ? disable()
            : enable();
    }
    /* ======================================================
       七、设置窗口
    ====================================================== */
    function closeSettings() {
        const button = document.querySelector(
            SELECTORS.closeButton
        );
        if (button) {
            button.click();
        }
    }
    /* ======================================================
       八、设置按钮事件
       使用事件委托，支持动态生成的设置按钮。
       只拦截列表模式按钮，不拦截其他按钮。
    ====================================================== */
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
                /*
                 * 不使用 stopImmediatePropagation，
                 * 避免阻断其他必要的页面事件。
                 */
                enable();
                closeSettings();
            },
            true
        );
    }
    /* ======================================================
       九、动态 DOM 监听
       书架或分组容器重新生成后，
       重新应用当前布局类名。
    ====================================================== */
    function scheduleRefresh() {
        if (STATE.pendingRefresh) {
            return;
        }
        STATE.pendingRefresh = true;
        const schedule =
            window.requestAnimationFrame ||
            function (callback) {
                return window.setTimeout(callback, 0);
            };
        schedule(function () {
            STATE.pendingRefresh = false;
            applyClassesOnly();
            observePage();
        });
    }
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
       十、跨标签页同步
    ====================================================== */
    function bindStorageEvents() {
        window.addEventListener(
            "storage",
            function (event) {
                if (STATE.handlingStorage) {
                    return;
                }
                if (
                    event.key !== STORAGE_KEY &&
                    event.key !== GRID_STORAGE_KEY
                ) {
                    return;
                }
                STATE.handlingStorage = true;
                try {
                    const listEnabled = readStorage(
                        STORAGE_KEY
                    );
                    const gridEnabled = readStorage(
                        GRID_STORAGE_KEY
                    );
                    /*
                     * 两种模式同时开启时，优先列表模式，
                     * 与原模块的处理规则保持一致。
                     */
                    if (listEnabled && gridEnabled) {
                        STATE.enabled = true;
                        saveStorage(
                            GRID_STORAGE_KEY,
                            false
                        );
                    } else if (listEnabled) {
                        STATE.enabled = true;
                    } else if (gridEnabled) {
                        STATE.enabled = false;
                    } else {
                        STATE.enabled = false;
                    }
                    applyMode();
                } finally {
                    STATE.handlingStorage = false;
                }
            }
        );
    }
    /* ======================================================
       十一、初始化
    ====================================================== */
    function initialize() {
        if (STATE.initialized) {
            return;
        }
        STATE.initialized = true;
        const listEnabled = readStorage(STORAGE_KEY);
        const gridEnabled = readStorage(GRID_STORAGE_KEY);
        /*
         * 保留原来的规则：
         * 两种模式同时开启时，优先列表模式。
         *
         * 两种模式都没有开启时，默认保持列表模式关闭，
         * 避免擅自覆盖用户原有设置。
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
       十二、公开接口
       保留原有方法名称，兼容 home.js
       及其他模块的调用。
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
       十三、启动
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
