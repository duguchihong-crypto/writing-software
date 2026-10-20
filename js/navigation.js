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

   设计原则：
   1. 不管理作品数据
   2. 不负责页面布局
   3. 不修改其他业务模块
   4. 兼容 GitHub Pages 项目路径
====================================================== */


(function () {
  "use strict";


  /* ====================================================
     一、模块配置
  ==================================================== */

  const MODULE_NAME = "WritingNavigation";

  const ROUTES = Object.freeze({
    home: "index.html",

    create: "pages/create.html",

    editor: "pages/editor.html",

    tools: "pages/tools.html",

    settings: "pages/settings.html"
  });


  /* ====================================================
     二、获取导航模块的实际地址
  ==================================================== */


  /**
   * 获取 navigation.js 自身的地址。
   *
   * 通过脚本地址计算网站根目录，
   * 避免页面位于不同文件夹时路径出错。
   */

  function getScriptUrl() {
    const scripts = document.scripts;

    for (let i = scripts.length - 1; i >= 0; i--) {
      const script = scripts[i];

      if (!script.src) {
        continue;
      }

      try {
        const scriptUrl = new URL(script.src);

        if (
          scriptUrl.pathname.endsWith(
            "/js/navigation.js"
          )
        ) {
          return scriptUrl;
        }

      } catch (error) {
        // 忽略无效脚本地址，继续查找。
      }
    }

    return null;
  }


  /**
   * 获取网站根目录。
   *
   * 例如：
   * https://example.github.io/writing-software/
   *
   * 不会错误地跳转到域名根目录。
   */

  function getRootUrl() {
    const scriptUrl = getScriptUrl();

    if (!scriptUrl) {
      throw new Error(
        "无法确定网站根目录，请检查 navigation.js 的引用路径。"
      );
    }

    return new URL("../", scriptUrl);
  }


  /* ====================================================
     三、统一解析页面地址
  ==================================================== */


  /**
   * 根据页面名称获取完整地址。
   *
   * 支持：
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
        "未知的页面名称：" + routeName
      );
    }

    return new URL(
      routePath,
      getRootUrl()
    );
  }


  /**
   * 跳转到指定页面。
   */

  function navigate(routeName) {
    const targetUrl = getRouteUrl(routeName);

    window.location.assign(targetUrl.href);
  }


  /* ====================================================
     四、常用页面跳转接口
  ==================================================== */


  /**
   * 返回书架首页。
   */

  function goHome() {
    navigate("home");
  }


  /**
   * 进入新建作品页面。
   */

  function goCreate() {
    navigate("create");
  }


  /**
   * 进入作品编辑器。
   *
   * bookId 为作品 ID。
   */

  function goEditor(bookId) {
    if (
      typeof bookId !== "string" ||
      !bookId.trim()
    ) {
      throw new Error(
        "进入编辑器时必须提供有效的作品 ID。"
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


  /* ====================================================
     五、识别当前页面
  ==================================================== */


  /**
   * 根据当前页面地址识别页面类型。
   *
   * 返回值：
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


  /* ====================================================
     六、更新底部导航状态
  ==================================================== */


  /**
   * 更新底部导航选中状态。
   *
   * 规则：
   * 1. 首页选中书架。
   * 2. 工具页选中工具。
   * 3. 其他页面默认不选中这两个入口。
   *
   * 只操作底部导航，不修改其他页面元素。
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

      let targetPage = "";

      try {
        const targetUrl = new URL(
          href,
          window.location.href
        );

        const targetName = targetUrl.pathname
          .split("/")
          .filter(Boolean)
          .pop() || "";

        if (
          targetName === "" ||
          targetName === "index.html"
        ) {
          targetPage = "home";

        } else if (targetName === "tools.html") {
          targetPage = "tools";
        }

      } catch (error) {
        return;
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


  /* ====================================================
     七、初始化
  ==================================================== */


  /**
   * 初始化导航模块。
   *
   * 只需要初始化一次。
   */

  function init() {
    updateBottomNavigation();
  }


  /* ====================================================
     八、公开接口
  ==================================================== */


  /**
   * 其他模块通过 WritingNavigation 调用导航功能。
   *
   * 不需要直接操作 window.location。
   */

  window[MODULE_NAME] = Object.freeze({

    /* 页面跳转 */

    navigate: navigate,

    goHome: goHome,

    goCreate: goCreate,

    goEditor: goEditor,

    goTools: goTools,

    goSettings: goSettings,


    /* 页面信息 */

    getCurrentPage: getCurrentPage,

    getRouteUrl: getRouteUrl,


    /* 导航状态 */

    updateBottomNavigation: updateBottomNavigation,


    /* 初始化 */

    init: init

  });


  /* ====================================================
     九、自动初始化
  ==================================================== */

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
