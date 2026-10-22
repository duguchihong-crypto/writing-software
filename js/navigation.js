/* ======================================================
写作软件 · 页面导航模块
文件：js/navigation.js

功能：

1. 统一管理页面跳转
2. 返回书架
3. 进入新建作品页面
4. 进入编辑器、工具和设置页面
5. 自动识别当前页面
6. 更新底部导航选中状态
7. 兼容 GitHub Pages 项目路径
8. 提供安全的相对路径解析

注意：
不管理书籍数据，不修改存储模块。
====================================================== */

(function () {
“use strict”;

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
    const scriptUrl = getScriptUrl();
    if (!scriptUrl) {
        /*
         * 备用方案：
         * 根据当前页面的位置判断项目根目录。
         *
         * 适用于：
         * /writing-software/index.html
         * /writing-software/pages/create.html
         */
        const pathname = window.location.pathname;
        const marker = "/pages/";
        const markerIndex = pathname.lastIndexOf(marker);
        if (markerIndex !== -1) {
            return new URL(
                pathname.slice(0, markerIndex + 1),
                window.location.origin
            );
        }
        return new URL("./", window.location.href);
    }
    return new URL("../", scriptUrl);
}
/* ==================================================
   四、获取完整页面地址
================================================== */
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
function navigate(routeName) {
    const targetUrl = getRouteUrl(routeName);
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
    targetUrl.searchParams.set("id", bookId);
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
    const pathname = window.location.pathname;
    const pageName =
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
        if (
            targetUrl.origin !== window.location.origin
        ) {
            item.classList.remove(
                "bottom-nav__item--active"
            );
            item.removeAttribute("aria-current");
            return;
        }
        const targetName =
            targetUrl.pathname.split("/").filter(Boolean).pop() || "";
        let targetPage = "unknown";
        if (
            targetName === "" ||
            targetName === "index.html"
        ) {
            targetPage = "home";
        } else if (targetName === "tools.html") {
            targetPage = "tools";
        }
        const isActive =
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
            item.setAttribute("aria-current", "page");
        } else {
            item.removeAttribute("aria-current");
        }
    });
}
/* ==================================================
   九、初始化
================================================== */
function init() {
    updateBottomNavigation();
}
/* ==================================================
   十、公开接口
================================================== */
window[MODULE_NAME] = Object.freeze({
    navigate: navigate,
    goHome: goHome,
    goCreate: goCreate,
    goEditor: goEditor,
    goTools: goTools,
    goSettings: goSettings,
    getCurrentPage: getCurrentPage,
    getRouteUrl: getRouteUrl,
    updateBottomNavigation: updateBottomNavigation,
    init: init
});
/* ==================================================
   十一、自动初始化
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
