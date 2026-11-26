/* ======================================================
   写作软件 · 首页网格模式
   文件：page-js/home-grid.js

   功能：
   1. 网格模式每行显示三项
   2. 网格模式与列表模式互斥
   3. 保存用户布局选择
   4. 支持动态生成的书籍和分组
   5. 监听其他标签页的设置变化
   6. 保留原有公开接口
   7. 避免重复初始化
   8. 不修改书籍、分组数据
   9. 不清除其他本地数据
  10. 与列表模块同步布局状态
  11. 监听设置模块派发的布局事件
  12. 统一控制书籍和分组所在的书架
====================================================== */
(function () {
    "use strict";

    /* ======================================================
       一、重复初始化保护
    ====================================================== */

    if (window.WritingHomeGrid) {
        console.warn(
            "[HomeGrid] 网格模块已经初始化，跳过重复初始化。"
        );
        return;
    }

    /* ======================================================
       二、常量与状态
    ====================================================== */

    const STORAGE_KEY =
        "writing-software-home-grid-enabled";

    const LIST_STORAGE_KEY =
        "writing-software-home-list-enabled";

    const LAYOUT_EVENT =
        "writing-home-layout-change";

    const SETTINGS_EVENT =
        "writing-home-settings-action";

    const SELECTOR = {
        shelf: "#shelf-list",

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
       三、本地设置
    ====================================================== */

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

    function saveCurrentMode() {
        saveStorage(STORAGE_KEY, STATE.enabled);
        saveStorage(LIST_STORAGE_KEY, !STATE.enabled);
    }

    /* ======================================================
       四、获取页面元素
    ====================================================== */

    function getRoot() {
        return document.documentElement;
    }

    function getShelf() {
        return document.querySelector(SELECTOR.shelf);
    }

    /* ======================================================
       五、同步设置按钮状态
    ====================================================== */

    function updateButtons() {
        document.querySelectorAll(
            '[data-settings-action="grid"]'
        ).forEach(function (button) {
            button.setAttribute(
                "aria-pressed",
                String(STATE.enabled)
            );

            const title = button.querySelector(
                ".home-settings__option-title"
            );

            if (title) {
                title.textContent = STATE.enabled
                    ? "网格模式（已开启）"
                    : "网格模式";
            }
        });

        document.querySelectorAll(
            '[data-settings-action="list"]'
        ).forEach(function (button) {
            button.setAttribute(
                "aria-pressed",
                String(!STATE.enabled)
            );

            const title = button.querySelector(
                ".home-settings__option-title"
            );

            if (title) {
                title.textContent = STATE.enabled
                    ? "列表模式"
                    : "列表模式（已开启）";
            }
        });
    }

    /* ======================================================
       六、应用布局类名

       现在书籍和分组共用 #shelf-list。

       不再单独操作：
       #home-groups-list
    ====================================================== */

    function applyClassesOnly() {
        const root = getRoot();
        const shelf = getShelf();

        /* 首页根元素 */

        root.classList.toggle(
            "home-grid-enabled",
            STATE.enabled
        );

        root.classList.toggle(
            "home-list-enabled",
            !STATE.enabled
        );

        /* 统一书架 */

        if (shelf) {
            shelf.classList.toggle(
                "shelf-list--grid",
                STATE.enabled
            );

            shelf.classList.toggle(
                "shelf-list--list",
                !STATE.enabled
            );
        }

        updateButtons();
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

                STATE.enabled = mode === "grid";

                applyMode();
            }
        );
    }

    /* ======================================================
       八、切换模式
    ====================================================== */

    function enable() {
        STATE.enabled = true;

        saveCurrentMode();
        applyMode();

        dispatchLayoutChange("grid");

        console.info(
            "[HomeGrid] 已启用网格模式。"
        );

        return true;
    }

    function disable() {
        STATE.enabled = false;

        saveCurrentMode();
        applyMode();

        dispatchLayoutChange("list");

        console.info(
            "[HomeGrid] 已切换到列表模式。"
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
            SELECTOR.closeButton
        );

        if (button) {
            button.click();
        }
    }

    /* ======================================================
       十、监听设置模块事件

       home-settings.js 派发：
       writing-home-settings-action

       本模块只处理 grid。
    ====================================================== */

    function bindSettingsEvents() {
        document.addEventListener(
            SETTINGS_EVENT,
            function (event) {
                const action =
                    event.detail &&
                    event.detail.action;

                if (action !== "grid") {
                    return;
                }

                enable();
                closeSettings();
            }
        );
    }

    /* ======================================================
       十一、动态页面监听
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
                    event.key !== LIST_STORAGE_KEY
                ) {
                    return;
                }

                STATE.handlingStorage = true;

                try {
                    const gridEnabled =
                        readStorage(STORAGE_KEY);

                    const listEnabled =
                        readStorage(LIST_STORAGE_KEY);

                    /*
                     * 两个模式同时开启时，
                     * 优先列表模式。
                     */

                    if (listEnabled) {
                        STATE.enabled = false;
                    } else if (gridEnabled) {
                        STATE.enabled = true;
                    } else {
                        STATE.enabled = false;
                    }

                    saveCurrentMode();
                    applyMode();

                    dispatchLayoutChange(
                        STATE.enabled ? "grid" : "list"
                    );

                } finally {
                    STATE.handlingStorage = false;
                }

                console.info(
                    "[HomeGrid] 已同步其他标签页的布局设置。"
                );
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

        const gridEnabled =
            readStorage(STORAGE_KEY);

        const listEnabled =
            readStorage(LIST_STORAGE_KEY);

        /*
         * 优先列表模式。
         * 如果只有网格模式开启，则恢复网格。
         * 两个设置都关闭时，默认列表模式。
         */

        if (listEnabled) {
            STATE.enabled = false;
        } else if (gridEnabled) {
            STATE.enabled = true;
        } else {
            STATE.enabled = false;
        }

        saveCurrentMode();

        bindSettingsEvents();
        bindLayoutEvents();
        bindStorageEvents();

        applyMode();

        console.info(
            "[HomeGrid] 初始化完成，当前模式：",
            STATE.enabled
                ? "网格模式"
                : "列表模式"
        );
    }

    /* ======================================================
       十四、公开接口
       保留原有接口名称
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
