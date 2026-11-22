/* ======================================================
 * 写作软件 · 页面导航模块
 * 文件：js/navigation.js
 *
 * 功能：
 * 1. 统一管理页面跳转
 * 2. 返回书架
 * 3. 进入新建页面、书籍页面和分组页面
 * 4. 进入小说编辑页面、工具和设置页面
 * 5. 自动识别当前页面
 * 6. 更新底部导航选中状态
 * 7. 兼容 GitHub Pages 项目路径
 * 8. 提供安全的相对路径解析
 * 9. 支持新建书籍、分组页面返回新建页面
 *
 * 注意：
 * 不管理书籍数据，不修改存储模块。
 * ====================================================== */

(function () {
    "use strict";

    /* ==================================================
       一、模块配置
    ================================================== */

    var MODULE_NAME = "WritingNavigation";

    var ROUTES = Object.freeze({
        home: "index.html",
        create: "pages/create.html",
        createBook: "pages/create-book.html",
        createGroup: "pages/create-group.html",

        // 新小说页面
        editor: "novel-page/book.html",

        tools: "pages/tools.html",
        settings: "pages/settings.html"
    });


    /* ==================================================
       二、获取导航脚本地址
    ================================================== */

    function getScriptUrl() {
        var scripts = document.scripts;

        for (var i = 0; i < scripts.length; i++) {
            var script = scripts[i];

            if (!script.src) {
                continue;
            }

            try {
                var scriptUrl = new URL(
                    script.src,
                    document.baseURI
                );

                if (
                    /\/js\/navigation\.js$/.test(
                        scriptUrl.pathname
                    )
                ) {
                    return scriptUrl;
                }

            } catch (error) {
                // 继续检查其他脚本。
            }
        }

        return null;
    }


    /* ==================================================
       三、获取项目根目录
    ================================================== */

    function getRootUrl() {
        var scriptUrl = getScriptUrl();

        if (scriptUrl) {
            return new URL("../", scriptUrl);
        }

        var pathname = window.location.pathname;

        var markers = [
            "/pages/",
            "/novel-page/"
        ];

        for (var i = 0; i < markers.length; i++) {
            var markerIndex = pathname.lastIndexOf(
                markers[i]
            );

            if (markerIndex !== -1) {
                return new URL(
                    pathname.slice(0, markerIndex + 1),
                    window.location.origin
                );
            }
        }

        return new URL("./", window.location.href);
    }


    /* ==================================================
       四、获取完整页面地址
    ================================================== */

    function getRouteUrl(routeName) {
        var routePath = ROUTES[routeName];

        if (!routePath) {
            throw new Error(
                "[WritingNavigation] 未知页面：" +
                routeName
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

    function navigate(routeName) {
        var targetUrl = getRouteUrl(routeName);

        window.location.assign(targetUrl.href);
    }


    /* ==================================================
       六、常用页面导航
    ================================================== */

    function goHome() {
        navigate("home");
    }

    function goCreate() {
        navigate("create");
    }

    function goCreateBook() {
        navigate("createBook");
    }

    function goCreateGroup() {
        navigate("createGroup");
    }


    // 进入指定小说
    function goEditor(bookId) {

        if (
            bookId === undefined ||
            bookId === null ||
            String(bookId).trim() === ""
        ) {
            throw new Error(
                "[WritingNavigation] 进入小说页面必须提供有效的作品 ID。"
            );
        }

        var targetUrl = getRouteUrl("editor");

        targetUrl.searchParams.set(
            "id",
            String(bookId)
        );

        window.location.assign(targetUrl.href);
    }


    function goTools() {
        navigate("tools");
    }

    function goSettings() {
        navigate("settings");
    }


    /* ==================================================
       七、识别当前页面
    ================================================== */

    function getCurrentPage() {
        var pathname = window.location.pathname;

        var pageName =
            pathname.split("/").filter(Boolean).pop() || "";

        if (
            pageName === "" ||
            pageName === "index.html"
        ) {
            return "home";
        }

        if (pageName === "create.html") {
            return "create";
        }

        if (pageName === "create-book.html") {
            return "create-book";
        }

        if (pageName === "create-group.html") {
            return "create-group";
        }

        // 新小说页面
        if (pageName === "book.html") {
            return "editor";
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
       八、更新底部导航状态
    ================================================== */

    function updateBottomNavigation() {
        var currentPage = getCurrentPage();

        var navItems = document.querySelectorAll(
            ".bottom-nav__item"
        );

        navItems.forEach(function (item) {

            var href = item.getAttribute("href");

            if (!href) {
                return;
            }

            var targetUrl;

            try {
                targetUrl = new URL(
                    href,
                    window.location.href
                );

            } catch (error) {
                return;
            }

            // 外部链接不标记为当前页面
            if (
                targetUrl.origin !==
                window.location.origin
            ) {
                item.classList.remove(
                    "bottom-nav__item--active"
                );

                item.removeAttribute("aria-current");

                return;
            }

            var targetName =
                targetUrl.pathname
                    .split("/")
                    .filter(Boolean)
                    .pop() || "";

            var targetPage = "unknown";

            if (
                targetName === "" ||
                targetName === "index.html"
            ) {
                targetPage = "home";

            } else if (
                targetName === "tools.html"
            ) {
                targetPage = "tools";
            }

            var isActive =
                (
                    currentPage === "home" &&
                    targetPage === "home"
                ) ||
                (
                    currentPage === "tools" &&
                    targetPage === "tools"
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
       九、绑定新建页面的返回按钮
    ================================================== */

    function bindCreatePageBackButtons() {

        var currentPage = getCurrentPage();

        var backButtonIds = [
            "cancel-create-book-top",
            "cancel-create-book",
            "cancel-create-group-top",
            "cancel-create-group",
            "cancel-create-top"
        ];

        backButtonIds.forEach(function (id) {

            var button = document.getElementById(id);

            if (
                !button ||
                button.dataset.navigationBound === "true"
            ) {
                return;
            }

            var isSupportedPage =
                currentPage === "create" ||
                currentPage === "create-book" ||
                currentPage === "create-group";

            if (!isSupportedPage) {
                return;
            }

            button.dataset.navigationBound = "true";

            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    // 优先使用指定的返回地址
                    var returnTo =
                        button.getAttribute("data-return-to");

                    if (returnTo) {

                        var targetUrl;

                        try {
                            targetUrl = new URL(
                                returnTo,
                                window.location.href
                            );

                        } catch (error) {
                            goHome();
                            return;
                        }

                        if (
                            targetUrl.origin !==
                            window.location.origin
                        ) {
                            goHome();
                            return;
                        }

                        window.location.assign(
                            targetUrl.href
                        );

                        return;
                    }

                    // 新建书籍、分组返回新建页面
                    if (
                        currentPage === "create-book" ||
                        currentPage === "create-group"
                    ) {
                        navigate("create");
                        return;
                    }

                    // 新建入口返回书架
                    goHome();
                }
            );
        });
    }


    /* ==================================================
       十、初始化
    ================================================== */

    function init() {
        updateBottomNavigation();

        bindCreatePageBackButtons();
    }


    /* ==================================================
       十一、公开接口
       保留原有接口名称
    ================================================== */

    window[MODULE_NAME] = Object.freeze({

        navigate: navigate,

        goHome: goHome,

        goCreate: goCreate,

        goCreateBook: goCreateBook,

        goCreateGroup: goCreateGroup,

        goEditor: goEditor,

        goTools: goTools,

        goSettings: goSettings,

        getCurrentPage: getCurrentPage,

        getRouteUrl: getRouteUrl,

        updateBottomNavigation:
            updateBottomNavigation,

        bindCreatePageBackButtons:
            bindCreatePageBackButtons,

        init: init
    });


    /* ==================================================
       十二、自动初始化
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
