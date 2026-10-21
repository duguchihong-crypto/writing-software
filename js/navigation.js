/* ======================================================
   写作软件 · 页面导航模块
   文件：js/navigation.js

   模块职责：
   1. 统一管理页面跳转
   2. 提供返回书架的方法
   3. 提供进入新建作品页面的方法
   4. 提供进入工具页面的方法
   5. 提供进入设置页面的方法
   6. 自动识别当前页面
   7. 更新底部导航的选中状态
   8. 兼容 GitHub Pages 项目路径

   设计原则：
   1. 不管理作品数据
   2. 不负责页面布局
   3. 不拦截普通链接的默认行为
   4. 不修改其他业务模块
====================================================== */

(function () {
    "use strict";


    /* ==================================================
       一、模块配置
    ================================================== */

    const MODULE_NAME = "WritingNavigation";

    const ROUTES = Object.freeze({
        home: "index.html",
        create: "pages/create.html",
        editor: "pages/editor.html",
        tools: "pages/tools.html",
        settings: "pages/settings.html"
    });


    /* ==================================================
       二、获取导航脚本地址
    ================================================== */

    /**
     * 获取 navigation.js 的实际地址。
     *
     * 例如：
     * https://example.github.io/writing-software/js/navigation.js
     */

    function getScriptUrl() {
        const scripts = document.scripts;

        for (let i = 0; i < scripts.length; i++) {
            const script = scripts[i];

            if (!script.src) {
                continue;
            }

            try {
                const scriptUrl = new URL(
                    script.src,
                    document.baseURI
                );

                if (
                    scriptUrl.pathname.endsWith(
                        "/js/navigation.js"
                    )
                ) {
                    return scriptUrl;
                }

            } catch (error) {
                // 忽略无效地址，继续查找。
            }
        }

        return null;
    }


    /* ==================================================
       三、获取网站根目录
    ================================================== */

    /**
     * 根据 navigation.js 的实际地址计算网站根目录。
     *
     * 示例：
     *
     * 脚本地址：
     * https://example.github.io/writing-software/js/navigation.js
     *
     * 网站根目录：
     * https://example.github.io/writing-software/
     *
     * 注意：
     * 这里的根目录是网站项目根目录，
     * 不是一定指域名的根目录。
     */

    function getRootUrl() {
        const scriptUrl = getScriptUrl();

        if (!scriptUrl) {
            throw new Error(
                "[WritingNavigation] 无法定位 navigation.js。"
            );
        }

        return new URL("../", scriptUrl);
    }


    /* ==================================================
       四、解析页面地址
    ================================================== */

    /**
     * 获取指定页面的完整 URL。
     *
     * 可用名称：
     * home
     * create
     * editor
     * tools
     * settings
     */

    function getRouteUrl(routeName) {
        const routePath = ROUTES[routeName];

        if (!routePath) {
            throw new Error(
                "[WritingNavigation] 未知页面：" + routeName
            );
        }

        return new URL(
            routePath,
            getRootUrl()
        );
    }


    /* ==================================================
       五、统一页面跳转
    ================================================== */

    /**
     * 跳转到指定页面。
     *
     * 只负责跳转，不拦截页面中的其他链接。
     */

    function navigate(routeName) {
        const targetUrl = getRouteUrl(routeName);

        window.location.assign(targetUrl.href);
    }


    /**
     * 返回书架首页。
     */

    function goHome() {
        navigate("home");
    }


    /**
     * 进入新建页面。
     */

    function goCreate() {
        navigate("create");
    }


    /**
     * 进入作品编辑器。
     *
     * @param {string} bookId 作品 ID
     */

    function goEditor(bookId) {
        if (
            typeof bookId !== "string" ||
            bookId.trim() === ""
        ) {
            throw new Error(
                "[WritingNavigation] 进入编辑器必须提供有效的作品 ID。"
            );
        }

        const targetUrl = getRouteUrl("editor");

        targetUrl.searchParams.set(
            "id",
            bookId
        );

        window.location.assign(targetUrl.href);
    }


    /**
     * 进入工具页面。
     */

    function goTools() {
        navigate("tools");
    }


    /**
     * 进入设置页面。
     */

    function goSettings() {
        navigate("settings");
    }


    /* ==================================================
       六、识别当前页面
    ================================================== */

    /**
     * 根据当前 URL 判断所在页面。
     *
     * 返回：
     * home
     * create
     * editor
     * tools
     * settings
     * unknown
     */

    function getCurrentPage() {
        const pathname = window.location.pathname;

        const pageName = pathname
            .split("/")
            .filter(Boolean)
            .pop() || "";

        if (
            pageName === "" ||
            pageName === "index.html"
        ) {
            return "home";
        }

        if (pageName === "create.html") {
            return "create";
        }

        if (pageName === "editor.html") {
            return "editor";
        }

        if (pageName === "tools.html") {
            return "tools";
        }

        if (pageName === "settings.html") {
            return "settings";
        }

        return "unknown";
    }


    /* ==================================================
       七、更新底部导航状态
    ================================================== */

    /**
     * 自动更新底部导航的选中状态。
     *
     * 规则：
     * 1. 首页选中书架。
     * 2. 工具页选中工具。
     * 3. 其他页面不选中书架或工具。
     *
     * 只修改底部导航项目的状态。
     */

    function updateBottomNavigation() {
        const currentPage = getCurrentPage();

        const navItems = document.querySelectorAll(
            ".bottom-nav__item"
        );

        navItems.forEach(function (item) {
            const href = item.getAttribute("href");

            if (!href) {
                return;
            }

            let targetUrl;

            try {
                targetUrl = new URL(
                    href,
                    window.location.href
                );

            } catch (error) {
                return;
            }

            // 外部链接不参与本站导航状态判断。
            if (
                targetUrl.origin !== window.location.origin
            ) {
                item.classList.remove(
                    "bottom-nav__item--active"
                );

                item.removeAttribute("aria-current");

                return;
            }

            const targetName = targetUrl.pathname
                .split("/")
                .filter(Boolean)
                .pop() || "";

            let targetPage = "unknown";

            if (
                targetName === "" ||
                targetName === "index.html"
            ) {
                targetPage = "home";

            } else if (targetName === "tools.html") {
                targetPage = "tools";
            }

            const isActive = (
                currentPage === targetPage &&
                (
                    targetPage === "home" ||
                    targetPage === "tools"
                )
            );

            item.classList.toggle(
                "bottom-nav__item--active",
                isActive
            );

            if (isActive) {
                item.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {
                item.removeAttribute("aria-current");
            }
        });
    }


    /* ==================================================
       八、初始化
    ================================================== */

    /**
     * 初始化导航状态。
     */

    function init() {
        updateBottomNavigation();
    }


    /* ==================================================
       九、公开接口
    ================================================== */

    /**
     * 其他模块可以通过以下方式调用：
     *
     * WritingNavigation.goHome();
     * WritingNavigation.goCreate();
     * WritingNavigation.goTools();
     * WritingNavigation.goSettings();
     *
     * 不需要直接操作 window.location。
     */

    window[MODULE_NAME] = Object.freeze({

        // 页面跳转
        navigate: navigate,
        goHome: goHome,
        goCreate: goCreate,
        goEditor: goEditor,
        goTools: goTools,
        goSettings: goSettings,

        // 页面信息
        getCurrentPage: getCurrentPage,
        getRouteUrl: getRouteUrl,

        // 导航状态
        updateBottomNavigation: updateBottomNavigation,

        // 初始化
        init: init

    });


    /* ==================================================
       十、自动初始化
    ================================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );

    } else {
        init();
    }

})();
