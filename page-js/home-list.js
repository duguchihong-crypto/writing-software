/* ======================================================
   写作软件 · 首页列表模式
   文件：page-js/home-list.js

   功能：
   1. 开启或关闭列表模式
   2. 与网格模式互斥
   3. 保存并恢复布局设置
   4. 监听跨标签页设置变化
   5. 支持统一书架布局刷新
   6. 保留原有公开接口
   7. 避免重复初始化
   8. 兼容书架容器重新生成
   9. 不修改书籍、分组数据
  10. 不清除其他本地数据
  11. 与网格模块同步布局状态
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

    const LAYOUT_EVENT =
        "writing-home-layout-change";

    const SETTINGS_EVENT =
        "writing-home-settings-action";

    const SELECTORS = {
        shelf: "#shelf-list",
        button: '[data-settings-action="list"]',
        gridButton: '[data-settings-action="grid"]',
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
                String(Boolean(value))
            );
        } catch (error) {
            console.warn(
                "[HomeList] 保存设置失败：",
                error
            );
        }
    }

    /* ======================================================
       四、保存当前布局
    ====================================================== */

    function saveCurrentMode() {
        saveStorage(STORAGE_KEY, STATE.enabled);
        saveStorage(GRID_STORAGE_KEY, !STATE.enabled);
    }

    /* ======================================================
       五、同步布局按钮状态
    ====================================================== */

    function updateButton() {
        document.querySelectorAll(
            SELECTORS.button
        ).forEach(function (button) {
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

        document.querySelectorAll(
            SELECTORS.gridButton
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
       六、统一应用布局类名

       列表模式：
       html.home-list-enabled
       #shelf-list.shelf-list--list

       网格模式：
       html.home-grid-enabled
       #shelf-list.shelf-list--grid

       书籍和分组共用同一个书架容器。
    ====================================================== */

    function applyClassesOnly() {
        const root = document.documentElement;
        const shelf = getShelf();

        const gridEnabled = !STATE.enabled;

        /* 根元素 */

        root.classList.toggle(
            "home-list-enabled",
            STATE.enabled
        );

        root.classList.toggle(
            "home-grid-enabled",
            gridEnabled
        );

        /* 统一书架 */

        if (shelf) {
            shelf.classList.toggle(
                "shelf-list--list",
                STATE.enabled
            );

            shelf.classList.toggle(
                "shelf-list--grid",
                gridEnabled
            );
        }

        updateButton();
    }

    function applyMode() {
        applyClassesOnly();
        observePage();
    }

    /* ======================================================
       七、布局事件同步
    ====================================================== */

    function dispatchLayoutChange(mode) {
        document.dispatchEvent(
            new CustomEvent(LAYOUT_EVENT, {
                detail: {
                    mode: mode
                }
            })
        );
    }

    function bindLayoutEvents() {
        document.addEventListener(
            LAYOUT_EVENT,
            function (event) {
                const mode =
                    event.detail &&
                    event.detail.mode;

                if (
                    mode !== "grid" &&
                    mode !== "list"
                ) {
                    return;
                }

                STATE.enabled = mode === "list";

                applyMode();
            }
        );
    }

    /* ======================================================
       八、公开操作
    ====================================================== */

    function enable() {
        STATE.enabled = true;

        saveCurrentMode();
        applyMode();

        dispatchLayoutChange("list");

        console.info(
            "[HomeList] 已启用列表模式。"
        );

        return true;
    }

    function disable() {
        STATE.enabled = false;

        saveCurrentMode();
        applyMode();

        dispatchLayoutChange("grid");

        console.info(
            "[HomeList] 已切换到网格模式。"
        );

        return false;
    }

    function toggle() {
        return STATE.enabled
            ? disable()
            : enable();
    }

    /* ======================================================
       九、关闭设置窗口
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
       十、监听设置模块事件
    ====================================================== */

    function bindSettingsEvents() {
        document.addEventListener(
            SETTINGS_EVENT,
            function (event) {
                const action =
                    event.detail &&
                    event.detail.action;

                if (action !== "list") {
                    return;
                }

                enable();
                closeSettings();
            }
        );
    }

    /* ======================================================
       十一、动态 DOM 监听
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
       十二、跨标签页同步
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
                    const listEnabled =
                        readStorage(STORAGE_KEY);

                    const gridEnabled =
                        readStorage(GRID_STORAGE_KEY);

                    /*
                     * 两个模式同时开启时，
                     * 优先列表模式。
                     */

                    if (listEnabled) {
                        STATE.enabled = true;
                    } else if (gridEnabled) {
                        STATE.enabled = false;
                    } else {
                        STATE.enabled = true;
                    }

                    saveCurrentMode();
                    applyMode();

                    dispatchLayoutChange(
                        STATE.enabled ? "list" : "grid"
                    );

                } finally {
                    STATE.handlingStorage = false;
                }
            }
        );
    }

    /* ======================================================
       十三、初始化
    ====================================================== */

    function initialize() {
        if (STATE.initialized) {
            return;
        }

        STATE.initialized = true;

        const listEnabled =
            readStorage(STORAGE_KEY);

        const gridEnabled =
            readStorage(GRID_STORAGE_KEY);

        /*
         * 优先采用已有布局设置。
         * 两种模式同时开启时，优先列表模式。
         * 两种模式都关闭时，默认列表模式。
         */

        if (listEnabled) {
            STATE.enabled = true;
        } else if (gridEnabled) {
            STATE.enabled = false;
        } else {
            STATE.enabled = true;
        }

        saveCurrentMode();

        bindSettingsEvents();
        bindLayoutEvents();
        bindStorageEvents();

        applyMode();

        console.info(
            "[HomeList] 初始化完成，当前模式：",
            STATE.enabled
                ? "列表模式"
                : "网格模式"
        );
    }

    /* ======================================================
       十四、公开接口
       保留原有方法名称
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
       十五、启动
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
