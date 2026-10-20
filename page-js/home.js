/* ======================================================
   写作软件 · 首页书架逻辑
   文件：page-js/home.js

   模块职责：
   1. 读取作品列表
   2. 判断书架是否为空
   3. 显示或隐藏空书架提示
   4. 生成作品卡片
   5. 显示作品名称、简介、字数和修改时间
   6. 监听作品数据变化
   7. 通过公共导航接口打开作品

   依赖：
   js/storage.js
   js/navigation.js
   js/components.js

   设计原则：
   1. 只管理首页书架
   2. 不直接操作 localStorage
   3. 不修改其他模块的内部实现
   4. 使用 DOM API 创建作品卡片
   5. 用户输入的文本一律作为纯文本显示
====================================================== */


(function () {
  "use strict";


  /* ====================================================
     一、模块配置
  ==================================================== */

  const MODULE_NAME = "WritingHome";


  /* ====================================================
     二、页面元素
  ==================================================== */

  const ELEMENTS = {
    emptyState: null,

    shelfContent: null,

    shelfCount: null,

    shelfList: null
  };


  /* ====================================================
     三、模块状态
  ==================================================== */

  let initialized = false;

  let unsubscribeStorage = null;


  /* ====================================================
     四、获取页面元素
  ==================================================== */


  /**
   * 获取首页需要使用的 DOM 元素。
   *
   * 这些元素由 index.html 提供。
   *
   * 本模块不负责创建首页整体结构。
   */

  function collectElements() {
    ELEMENTS.emptyState = document.getElementById(
      "empty-state"
    );

    ELEMENTS.shelfContent = document.getElementById(
      "shelf-content"
    );

    ELEMENTS.shelfCount = document.getElementById(
      "shelf-count"
    );

    ELEMENTS.shelfList = document.getElementById(
      "shelf-list"
    );

    const missingElements = [];

    if (!ELEMENTS.emptyState) {
      missingElements.push("#empty-state");
    }

    if (!ELEMENTS.shelfContent) {
      missingElements.push("#shelf-content");
    }

    if (!ELEMENTS.shelfCount) {
      missingElements.push("#shelf-count");
    }

    if (!ELEMENTS.shelfList) {
      missingElements.push("#shelf-list");
    }

    if (missingElements.length > 0) {
      console.error(
        "[WritingHome] 首页缺少必要的 HTML 元素：",
        missingElements.join(", ")
      );

      return false;
    }

    return true;
  }


  /* ====================================================
     五、检查公共模块
  ==================================================== */


  /**
   * 确认公共模块已经加载。
   *
   * 如果依赖没有加载，
   * 显示明确错误，方便排查文件路径。
   */

  function checkDependencies() {
    const missing = [];

    if (
      !window.WritingStorage ||
      typeof window.WritingStorage.getBooks !== "function"
    ) {
      missing.push("js/storage.js");
    }

    if (
      !window.WritingNavigation ||
      typeof window.WritingNavigation.goEditor !== "function"
    ) {
      missing.push("js/navigation.js");
    }

    if (
      !window.WritingComponents ||
      typeof window.WritingComponents.createElement !== "function"
    ) {
      missing.push("js/components.js");
    }

    if (missing.length > 0) {
      console.error(
        "[WritingHome] 以下公共模块不可用：",
        missing.join(", ")
      );

      return false;
    }

    return true;
  }


  /* ====================================================
     六、读取作品数据
  ==================================================== */


  /**
   * 从公共存储模块读取作品。
   *
   * 首页不直接读取 localStorage。
   */

  function loadBooks() {
    try {
      const books = window.WritingStorage.getBooks();

      if (!Array.isArray(books)) {
        throw new Error(
          "作品存储接口返回的数据不是数组。"
        );
      }

      return books;

    } catch (error) {
      console.error(
        "[WritingHome] 读取作品失败：",
        error
      );

      showStorageError();

      return null;
    }
  }


  /* ====================================================
     七、更新首页状态
  ==================================================== */


  /**
   * 根据作品数量切换页面状态。
   *
   * 没有作品：
   * 显示空书架。
   *
   * 有作品：
   * 显示作品列表。
   */

  function updateShelfState(books) {
    const hasBooks = books.length > 0;

    ELEMENTS.emptyState.hidden = hasBooks;

    ELEMENTS.shelfContent.hidden = !hasBooks;

    updateBookCount(books.length);
  }


  /**
   * 更新作品数量。
   *
   * 例如：
   * 共 3 部作品
   */

  function updateBookCount(count) {
    ELEMENTS.shelfCount.textContent =
      "共 " + count + " 部作品";
  }


  /* ====================================================
     八、创建作品卡片
  ==================================================== */


  /**
   * 创建单部作品的卡片。
   *
   * 使用 DOM API 创建元素，
   * 不将用户输入拼接进 HTML 字符串。
   */

  function createBookCard(book) {
    const components = window.WritingComponents;

    const card = components.createElement(
      "article",
      {
        className: "shelf-card",

        attributes: {
          "data-book-id": book.id
        }
      }
    );


    /* -----------------------------------------------
       作品标题
    ----------------------------------------------- */

    const title = components.createElement(
      "h2",
      {
        className: "shelf-card__title",

        text: book.title || "未命名作品"
      }
    );

    card.appendChild(title);


    /* -----------------------------------------------
       作品简介
    ----------------------------------------------- */

    const description = components.createElement(
      "p",
      {
        className: "shelf-card__description",

        text: book.description || "尚未填写作品简介。"
      }
    );

    card.appendChild(description);


    /* -----------------------------------------------
       作品信息
    ----------------------------------------------- */

    const meta = components.createElement(
      "div",
      {
        className: "shelf-card__meta"
      }
    );


    /* 作品字数 */

    const wordCount = components.createElement(
      "span",
      {
        className: "shelf-card__info",

        text: components.formatWordCount(
          book.wordCount
        )
      }
    );


    /* 最后修改时间 */

    const updatedAt = components.createElement(
      "span",
      {
        className: "shelf-card__info",

        text: "更新于 " +
          (
            components.formatRelativeTime(
              book.updatedAt
            ) || "暂无记录"
          )
      }
    );

    meta.appendChild(wordCount);

    meta.appendChild(updatedAt);

    card.appendChild(meta);


    /* -----------------------------------------------
       作品操作区域
    ----------------------------------------------- */

    const actions = components.createElement(
      "div",
      {
        className: "shelf-card__actions"
      }
    );


    /* 打开作品按钮 */

    const openButton = components.createElement(
      "button",
      {
        className:
          "shelf-card__button shelf-card__button--open",

        text: "打开作品",

        attributes: {
          type: "button",
          "aria-label": "打开作品：" +
            (book.title || "未命名作品")
        }
      }
    );


    /*
     * 点击按钮后通过公共导航接口打开编辑器。
     */

    openButton.addEventListener(
      "click",
      function () {
        openBook(book.id);
      }
    );

    actions.appendChild(openButton);

    card.appendChild(actions);

    return card;
  }


  /* ====================================================
     九、打开作品
  ==================================================== */


  /**
   * 打开指定作品。
   *
   * 跳转之前先检查作品是否存在，
   * 避免跳转到无效的作品 ID。
   */

  function openBook(bookId) {
    if (!bookId) {
      window.WritingComponents.showMessage(
        "无法打开作品：作品编号无效。"
      );

      return;
    }

    try {
      const book = window.WritingStorage.getBook(
        bookId
      );

      if (!book) {
        window.WritingComponents.showMessage(
          "这部作品可能已被删除，请刷新书架后重试。"
        );

        refresh();

        return;
      }

      window.WritingNavigation.goEditor(
        book.id
      );

    } catch (error) {
      console.error(
        "[WritingHome] 打开作品失败：",
        error
      );

      window.WritingComponents.showMessage(
        "暂时无法打开作品，请稍后重试。"
      );
    }
  }


  /* ====================================================
     十、渲染作品列表
  ==================================================== */


  /**
   * 将作品数据转换成作品卡片。
   *
   * 先创建完整的新列表，
   * 再统一替换旧列表。
   *
   * 避免逐张添加卡片时出现中间状态。
   */

  function renderBooks(books) {
    const fragment = document.createDocumentFragment();

    books.forEach(function (book) {
      if (!book || !book.id) {
        console.warn(
          "[WritingHome] 跳过无效的作品数据：",
          book
        );

        return;
      }

      try {
        const card = createBookCard(book);

        fragment.appendChild(card);

      } catch (error) {
        console.error(
          "[WritingHome] 创建作品卡片失败：",
          error
        );
      }
    });

    ELEMENTS.shelfList.replaceChildren(fragment);
  }


  /* ====================================================
     十一、刷新书架
  ==================================================== */


  /**
   * 重新读取作品并更新页面。
   *
   * 创建、修改或删除作品后，
   * 都可以调用此方法刷新首页。
   */

  function refresh() {
    if (
      !ELEMENTS.shelfList ||
      !ELEMENTS.emptyState ||
      !ELEMENTS.shelfContent
    ) {
      return false;
    }

    const books = loadBooks();

    if (books === null) {
      return false;
    }

    updateShelfState(books);

    renderBooks(books);

    return true;
  }


  /* ====================================================
     十二、存储错误提示
  ==================================================== */


  /**
   * 显示存储错误。
   *
   * 不清空原有作品列表，
   * 避免读取失败时误导用户认为作品已丢失。
   */

  function showStorageError() {
    if (ELEMENTS.emptyState) {
      ELEMENTS.emptyState.hidden = true;
    }

    if (ELEMENTS.shelfContent) {
      ELEMENTS.shelfContent.hidden = false;
    }

    if (ELEMENTS.shelfCount) {
      ELEMENTS.shelfCount.textContent =
        "作品读取失败";
    }

    if (ELEMENTS.shelfList) {
      const message = window.WritingComponents
        ? window.WritingComponents.createElement(
            "p",
            {
              className: "shelf-error",

              text:
                "暂时无法读取作品。请检查浏览器存储权限，然后刷新页面。"
            }
          )
        : document.createTextNode(
            "暂时无法读取作品，请检查浏览器存储权限。"
          );

      ELEMENTS.shelfList.replaceChildren(message);
    }
  }


  /* ====================================================
     十三、监听作品数据变化
  ==================================================== */


  /**
   * 当作品发生变化时自动刷新书架。
   *
   * 例如：
   * book-created
   * book-updated
   * book-deleted
   * book-touched
   * external-change
   */

  function subscribeToStorageChanges() {
    if (unsubscribeStorage) {
      unsubscribeStorage();

      unsubscribeStorage = null;
    }

    unsubscribeStorage =
      window.WritingStorage.onChange(
        function () {
          refresh();
        }
      );
  }


  /* ====================================================
     十四、初始化首页
  ==================================================== */


  /**
   * 初始化首页书架。
   *
   * 初始化顺序：
   * 1. 检查公共模块
   * 2. 获取页面元素
   * 3. 读取作品数据
   * 4. 渲染书架
   * 5. 监听数据变化
   */

  function init() {
    if (initialized) {
      return;
    }

    if (!checkDependencies()) {
      return;
    }

    if (!collectElements()) {
      return;
    }

    initialized = true;

    refresh();

    subscribeToStorageChanges();

    console.log(
      "[WritingHome] 首页书架初始化完成。"
    );
  }


  /* ====================================================
     十五、公开接口
  ==================================================== */


  /**
   * 公开少量必要的方法。
   *
   * 其他模块可以请求刷新首页，
   * 但不应直接修改本模块内部状态。
   */

  window[MODULE_NAME] = Object.freeze({

    init: init,

    refresh: refresh,

    openBook: openBook

  });


  /* ====================================================
     十六、自动启动
  ==================================================== */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {
    init();
  }


})();
