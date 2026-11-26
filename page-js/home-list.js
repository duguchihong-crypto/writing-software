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

    const SELECTORS = {
        shelf: "#shelf-list",
        groups: "#home-groups-list",
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
       四、同步布局按钮状态
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
       五、统一应用布局类名

       列表模式：
       html.home-list-enabled
       #shelf-list.shelf-list--list
       #home-groups-list.home-groups-list--list

       网格模式：
       html.home-grid-enabled
       #shelf-list.shelf-list--grid
       #home-groups-list.home-groups-list--grid
    ====================================================== */

    function applyClassesOnly() {
        const root = document.documentElement;
        const shelf = getShelf();
        const groups = getGroups();

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

        /* 书籍容器 */

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

        /* 分组容器 */

        if (groups) {
            groups.classList.toggle(
                "home-groups-list--list",
                STATE.enabled
            );

            groups.classList.toggle(
                "home-groups-list--grid",
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
       六、布局事件同步

       其他布局模块切换模式时，
       自动更新当前列表模块的内部状态。
    ====================================================== */

    function dispatchLayoutChange(mode) {
        document.dispatchEvent(
            new CustomEvent(
                "writing-home-layout-change",
                {
                    detail: {
                        mode: mode
                    }
                }
            )
        );
    }

    function bindLayoutEvents() {
        document.addEventListener(
            "writing-home-layout-change",
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
       七、公开操作
    ====================================================== */

    function enable() {
        /*
         * 启用列表模式。
         * 同时关闭网格模式。
         */

        const gridModule = window.WritingHomeGrid;

        if (
            gridModule &&
            typeof gridModule.disable === "function"
        ) {
            gridModule.disable();
        }

        STATE.enabled = true;

        saveStorage(STORAGE_KEY, true);
        saveStorage(GRID_STORAGE_KEY, false);

        applyMode();

        dispatchLayoutChange("list");

        console.info(
            "[HomeList] 已启用列表模式。"
        );

        return true;
    }

    function disable() {
        /*
         * 关闭列表模式时切换到网格模式，
         * 保证两种布局互斥。
         */

        const gridModule = window.WritingHomeGrid;

        if (
            gridModule &&
            typeof gridModule.enable === "function"
        ) {
            gridModule.enable();
        }

        STATE.enabled = false;

        saveStorage(STORAGE_KEY, false);
        saveStorage(GRID_STORAGE_KEY, true);

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
       八、关闭设置窗口
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
       九、监听设置模块事件

       home-settings.js 会派发：
       writing-home-settings-action

       此处只处理 list，
       不再重复监听普通 click 事件。
    ====================================================== */

    function bindSettingsEvents() {
        document.addEventListener(
            "writing-home-settings-action",
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
       十、动态 DOM 监听
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
               
