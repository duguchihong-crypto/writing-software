/* ======================================================
   写作软件 · 首页网格模式
   文件：page-js/home-grid.js
   功能：
   1. 网格模式每行显示三本书
   2. 网格模式与列表模式互斥
   3. 保存用户布局选择
   4. 支持动态生成的书籍和分组
   5. 监听其他标签页的设置变化
   6. 保留原有公开接口
   7. 避免重复初始化
   8. 不修改书籍、分组数据
   9. 不清除其他本地数据
  10. 不阻断其他脚本的点击事件
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
    /* ======================================================
       一、常量与状态
    ====================================================== */
    const STORAGE_KEY =
        "writing-software-home-grid-enabled";
    const LIST_STORAGE_KEY =
        "writing-software-home-list-enabled";
    const SELECTOR = {
        shelf: "#shelf-list",
        groups: "#home-groups-list",
        gridButton: '[data-settings-action="grid"]',
        listButton: '[data-settings-action="list"]',
        buttonTitle: ".home-settings__option-title",
        closeButton:
            '[data-settings-close]:not(.home-settings__backdrop)'
    };
    const STATE = {
        enabled: false,
        initialized: false,
        observer: null,
        observedRoot: null,
        pendingRefresh: false
    };
    /* ======================================================
       二、本地设置
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
       三、获取页面元素
    ====================================================== */
    function getRoot() {
        return document.documentElement;
    }
    function getShelf() {
        return document.querySelector(SELECTOR.shelf);
    }
    function getGroups() {
        return document.querySelector(SELECTOR.groups);
    }
    /* ======================================================
       四、同步设置按钮状态
    ====================================================== */
    function updateButtons() {
        document.querySelectorAll(SELECTOR.gridButton)
            .forEach(function (button) {
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
        document.querySelectorAll(SELECTOR.listButton)
            .forEach(function (button) {
                button.setAttribute(
                    "aria-pressed",
                    String(!STATE.enabled)
                );
                const title = button.querySelector(
                    SELECTOR.buttonTitle
                );
                if (title) {
                    title.textContent = STATE.enabled
                        ? "列表模式"
                        : "列表模式（已开启）";
                }
            });
    }
    /* ======================================================
       五、应用布局类名
    ====================================================== */
    function applyClassesOnly() {
        const root = getRoot();
        const shelf = getShelf();
        const groups = getGroups();
        /*
         * 根元素只保留一种布局状态。
         */
        root.classList.toggle(
            "home-grid-enabled",
            STATE.enabled
        );
        root.classList.toggle(
            "home-list-enabled",
            !STATE.enabled
        );
        /*
         * 书籍容器只保留一种布局状态。
         */
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
        /*
         * 分组容器只保留一种布局状态。
         */
        if (groups) {
            groups.classList.toggle(
                "home-groups-list--grid",
                STATE.enabled
            );
            groups.classList.toggle(
                "home-groups-list--list",
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
       六、切换模式
    ====================================================== */
    function enable() {
        STATE.enabled = true;
        saveCurrentMode();
        applyMode();
        console.info("[HomeGrid] 已启用网格模式。");
        return true;
    }
    function disable() {
        STATE.enabled = false;
        saveCurrentMode();
        applyMode();
        console.info("[HomeGrid] 已关闭网格模式。");
        return false;
    }
    function toggle() {
        return STATE.enabled
            ? disable()
            : enable();
    }
    /* ======================================================
       七、关闭设置窗口
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
       八、绑定设置按钮
    ====================================================== */
    function bindButtons() {
        /*
         * 使用事件委托，支持设置按钮动态生成。
         *
         * 不使用 stopImmediatePropagation，
         * 避免阻断其他功能的事件监听。
         */
        document.addEventListener("click", function (event) {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const gridButton = target.closest(
                SELECTOR.gridButton
            );
            if (gridButton) {
                event.preventDefault();
                enable();
                closeSettings();
                return;
            }
            const listButton = target.closest(
                SELECTOR.listButton
            );
            if (listButton) {
                event.preventDefault();
                disable();
                closeSettings();
            }
        });
    }
    /* ======================================================
       九、监听动态页面变化
    ====================================================== */
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
        STATE.observer = new MutationObserver(function (mutations) {
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
        });
        STATE.observer.observe(root, {
            childList: true,
            subtree: true
        });
    }
    /* ======================================================
       十、同步其他标签页
    ====================================================== */
    function bindStorageEvents() {
        window.addEventListener("storage", function (event) {
            if (
                event.key !== STORAGE_KEY &&
                event.key !== LIST_STORAGE_KEY
            ) {
                return;
            }
            /*
             * 两个键都为 true 时，优先列表模式，
             * 与原有规则保持一致。
             */
            const gridEnabled = readStorage(STORAGE_KEY);
            const listEnabled = readStorage(LIST_STORAGE_KEY);
            STATE.enabled =
                gridEnabled && !listEnabled;
            applyMode();
        });
    }
    /* ======================================================
       十一、初始化
    ====================================================== */
    function initialize() {
        if (STATE.initialized) {
            return;
        }
        STATE.initialized = true;
        const gridEnabled = readStorage(STORAGE_KEY);
        const listEnabled = readStorage(LIST_STORAGE_KEY);
        if (gridEnabled && !listEnabled) {
            STATE.enabled = true;
        } else {
            STATE.enabled = false;
        }
        /*
         * 修正布局设置键，使两个模式互斥。
         * 只操作布局相关键，不碰其他本地数据。
         */
        saveCurrentMode();
        bindButtons();
        bindStorageEvents();
        applyMode();
        console.info(
            "[HomeGrid] 初始化完成，当前模式：",
            STATE.enabled ? "网格模式" : "列表模式"
        );
    }
    /* ======================================================
       十二、公开接口
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
