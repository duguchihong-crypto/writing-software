/* ======================================================
   写作软件 · 公共数据存储模块
   文件：js/storage.js

   模块职责：
   1. 保存作品数据
   2. 读取作品数据
   3. 创建、修改、删除作品
   4. 管理作品的基础信息
   5. 为其他模块提供统一的数据接口
   6. 通知其他模块数据发生了变化

   存储方式：
   localStorage

   设计原则：
   1. 不负责页面布局
   2. 不负责按钮事件
   3. 不直接操作 HTML
   4. 不依赖其他业务模块
   5. 其他模块通过 WritingStorage 访问数据
====================================================== */


(function () {
  "use strict";


  /* ====================================================
     一、模块基础配置
  ==================================================== */

  const STORAGE_KEY = "writing-software-books";

  const STORAGE_VERSION = 1;

  const CHANGE_EVENT = "writing-storage-change";


  /* ====================================================
     二、基础工具
  ==================================================== */


  /**
   * 生成唯一标识符。
   *
   * 优先使用浏览器提供的 crypto.randomUUID。
   * 不支持时使用备用方案。
   */

  function createId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return (
      "book-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 12)
    );
  }


  /**
   * 获取当前时间。
   *
   * 使用 ISO 8601 格式保存，
   * 方便不同页面统一处理。
   */

  function getCurrentTime() {
    return new Date().toISOString();
  }


  /**
   * 生成错误对象。
   */

  function createError(code, message) {
    const error = new Error(message);

    error.code = code;

    return error;
  }


  /**
   * 检查浏览器是否支持 localStorage。
   */

  function isStorageAvailable() {
    try {
      if (typeof localStorage === "undefined") {
        return false;
      }

      const testKey = "__writing_storage_test__";

      localStorage.setItem(testKey, "1");

      localStorage.removeItem(testKey);

      return true;

    } catch (error) {
      return false;
    }
  }


  /* ====================================================
     三、默认数据结构
  ==================================================== */


  /**
   * 创建新的作品数据对象。
   *
   * 每部作品使用独立的数据对象。
   *
   * 章节、卷、篇、序等内容，
   * 后续由相应模块逐步扩展。
   */

  function createDefaultBook(title, description) {
    const now = getCurrentTime();

    return {
      id: createId(),

      title: title,

      description: description,

      createdAt: now,

      updatedAt: now,

      wordCount: 0,

      chapters: [],

      metadata: {
        version: STORAGE_VERSION
      }
    };
  }


  /* ====================================================
     四、数据读取
  ==================================================== */


  /**
   * 读取全部作品。
   *
   * 返回数组副本，避免调用者直接修改内部数据。
   */

  function getBooks() {
    const data = readDatabase();

    return data.books.map(function (book) {
      return cloneData(book);
    });
  }


  /**
   * 根据作品 ID 读取单部作品。
   *
   * 找不到时返回 null。
   */

  function getBook(bookId) {
    if (!bookId) {
      return null;
    }

    const books = readDatabase().books;

    const book = books.find(function (item) {
      return item.id === bookId;
    });

    return book ? cloneData(book) : null;
  }


  /**
   * 获取作品数量。
   */

  function getBookCount() {
    return readDatabase().books.length;
  }


  /**
   * 检查作品是否存在。
   */

  function hasBook(bookId) {
    if (!bookId) {
      return false;
    }

    return readDatabase().books.some(function (book) {
      return book.id === bookId;
    });
  }


  /* ====================================================
     五、创建作品
  ==================================================== */


  /**
   * 创建新作品。
   *
   * 参数：
   * {
   *   title: "作品名称",
   *   description: "作品简介"
   * }
   *
   * 成功时返回新作品的数据副本。
   *
   * 失败时抛出错误。
   */

  function createBook(options) {
    if (
      !options ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      throw createError(
        "INVALID_OPTIONS",
        "创建作品时必须提供有效的作品信息。"
      );
    }

    const title = normalizeText(options.title);

    const description = normalizeText(
      options.description
    );

    if (!title) {
      throw createError(
        "EMPTY_TITLE",
        "作品名称不能为空。"
      );
    }

    const database = readDatabase();

    const book = createDefaultBook(
      title,
      description
    );

    database.books.unshift(book);

    writeDatabase(database);

    notifyChange({
      type: "book-created",
      bookId: book.id
    });

    return cloneData(book);
  }


  /* ====================================================
     六、修改作品基础信息
  ==================================================== */


  /**
   * 修改作品信息。
   *
   * 目前允许修改：
   * title
   * description
   *
   * 其他数据由对应模块单独管理，
   * 避免误覆盖章节等内容。
   */

  function updateBook(bookId, changes) {
    if (!bookId) {
      throw createError(
        "MISSING_BOOK_ID",
        "修改作品时缺少作品 ID。"
      );
    }

    if (
      !changes ||
      typeof changes !== "object" ||
      Array.isArray(changes)
    ) {
      throw createError(
        "INVALID_CHANGES",
        "作品修改信息无效。"
      );
    }

    const database = readDatabase();

    const book = database.books.find(function (item) {
      return item.id === bookId;
    });

    if (!book) {
      throw createError(
        "BOOK_NOT_FOUND",
        "找不到需要修改的作品。"
      );
    }

    let changed = false;

    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        "title"
      )
    ) {
      const title = normalizeText(changes.title);

      if (!title) {
        throw createError(
          "EMPTY_TITLE",
          "作品名称不能为空。"
        );
      }

      book.title = title;

      changed = true;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        "description"
      )
    ) {
      book.description = normalizeText(
        changes.description
      );

      changed = true;
    }

    if (!changed) {
      return cloneData(book);
    }

    book.updatedAt = getCurrentTime();

    writeDatabase(database);

    notifyChange({
      type: "book-updated",
      bookId: book.id
    });

    return cloneData(book);
  }


  /* ====================================================
     七、删除作品
  ==================================================== */


  /**
   * 根据作品 ID 删除作品。
   *
   * 删除前由调用页面负责向用户确认。
   *
   * 注意：
   * 删除作品属于破坏性操作，
   * 本方法不会自行弹出确认窗口。
   */

  function deleteBook(bookId) {
    if (!bookId) {
      throw createError(
        "MISSING_BOOK_ID",
        "删除作品时缺少作品 ID。"
      );
    }

    const database = readDatabase();

    const index = database.books.findIndex(
      function (book) {
        return book.id === bookId;
      }
    );

    if (index === -1) {
      throw createError(
        "BOOK_NOT_FOUND",
        "找不到需要删除的作品。"
      );
    }

    const deletedBook = database.books[index];

    database.books.splice(index, 1);

    writeDatabase(database);

    notifyChange({
      type: "book-deleted",
      bookId: bookId
    });

    return cloneData(deletedBook);
  }


  /* ====================================================
     八、更新时间
  ==================================================== */


  /**
   * 更新作品的最后修改时间。
   *
   * 供编辑器等模块调用。
   */

  function touchBook(bookId) {
    if (!bookId) {
      throw createError(
        "MISSING_BOOK_ID",
        "更新作品时间时缺少作品 ID。"
      );
    }

    const database = readDatabase();

    const book = database.books.find(function (item) {
      return item.id === bookId;
    });

    if (!book) {
      throw createError(
        "BOOK_NOT_FOUND",
        "找不到需要更新的作品。"
      );
    }

    book.updatedAt = getCurrentTime();

    writeDatabase(database);

    notifyChange({
      type: "book-touched",
      bookId: bookId
    });

    return cloneData(book);
  }


  /* ====================================================
     九、数据库读取与写入
  ==================================================== */


  /**
   * 读取数据库。
   *
   * 内部统一管理存储格式。
   */

  function readDatabase() {
    if (!isStorageAvailable()) {
      throw createError(
        "STORAGE_UNAVAILABLE",
        "浏览器本地存储不可用，无法读取作品。"
      );
    }

    let rawData;

    try {
      rawData = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      throw createError(
        "STORAGE_READ_FAILED",
        "读取本地作品数据失败。"
      );
    }

    if (rawData === null) {
      return {
        version: STORAGE_VERSION,
        books: []
      };
    }

    let database;

    try {
      database = JSON.parse(rawData);
    } catch (error) {
      throw createError(
        "INVALID_DATABASE",
        "作品数据格式异常，无法正常读取。"
      );
    }

    if (
      !database ||
      typeof database !== "object" ||
      !Array.isArray(database.books)
    ) {
      throw createError(
        "INVALID_DATABASE",
        "作品数据库结构异常。"
      );
    }

    if (
      typeof database.version === "number" &&
      database.version > STORAGE_VERSION
    ) {
      throw createError(
        "UNSUPPORTED_VERSION",
        "作品数据版本高于当前软件支持的版本。"
      );
    }

    return database;
  }


  /**
   * 写入数据库。
   *
   * 先序列化，再写入 localStorage。
   */

  function writeDatabase(database) {
    if (!isStorageAvailable()) {
      throw createError(
        "STORAGE_UNAVAILABLE",
        "浏览器本地存储不可用，无法保存作品。"
      );
    }

    const dataToSave = {
      version: STORAGE_VERSION,
      books: database.books
    };

    let serialized;

    try {
      serialized = JSON.stringify(dataToSave);
    } catch (error) {
      throw createError(
        "SERIALIZATION_FAILED",
        "作品数据无法转换为可保存的格式。"
      );
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        serialized
      );
    } catch (error) {
      throw createError(
        "STORAGE_WRITE_FAILED",
        "保存作品失败，可能是浏览器存储空间不足。"
      );
    }
  }


  /* ====================================================
     十、数据安全辅助方法
  ==================================================== */


  /**
   * 规范化文本。
   *
   * 防止名称和简介被意外保存为非字符串。
   */

  function normalizeText(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim();
  }


  /**
   * 深拷贝数据。
   *
   * 避免调用者修改读取结果时，
   * 意外修改原始数据对象。
   */

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }


  /* ====================================================
     十一、数据变化通知
  ==================================================== */


  /**
   * 通知当前页面中的其他模块。
   *
   * 例如：
   * 创建作品后，首页可以重新读取书架。
   *
   * 通知只传递事件信息，
   * 不把内部数据库对象暴露出去。
   */

  function notifyChange(detail) {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, {
        detail: detail
      })
    );
  }


  /**
   * 注册数据变化监听。
   *
   * 使用方：
   *
   * WritingStorage.onChange(function (event) {
   *   console.log(event.type);
   * });
   *
   * 返回取消监听的函数。
   */

  function onChange(callback) {
    if (typeof callback !== "function") {
      throw createError(
        "INVALID_CALLBACK",
        "数据变化监听必须提供函数。"
      );
    }

    const handler = function (event) {
      callback(event.detail);
    };

    window.addEventListener(
      CHANGE_EVENT,
      handler
    );

    return function unsubscribe() {
      window.removeEventListener(
        CHANGE_EVENT,
        handler
      );
    };
  }


  /* ====================================================
     十二、其他浏览器标签页的数据变化
  ==================================================== */


  /**
   * 当同一网站的其他标签页修改了作品数据时，
   * 通知当前页面刷新。
   *
   * 注意：
   * 这只适用于同一浏览器环境中，
   * 共享相同 localStorage 的标签页。
   */

  window.addEventListener(
    "storage",
    function (event) {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, {
          detail: {
            type: "external-change",
            bookId: null
          }
        })
      );
    }
  );


  /* ====================================================
     十三、公开接口
  ==================================================== */


  /**
   * 其他模块只能通过这个公共接口访问数据。
   *
   * 不需要直接操作 localStorage。
   */

  window.WritingStorage = Object.freeze({

    /* 数据读取 */

    getBooks: getBooks,

    getBook: getBook,

    getBookCount: getBookCount,

    hasBook: hasBook,


    /* 作品管理 */

    createBook: createBook,

    updateBook: updateBook,

    deleteBook: deleteBook,


    /* 时间管理 */

    touchBook: touchBook,


    /* 数据变化监听 */

    onChange: onChange,


    /* 公共信息 */

    version: STORAGE_VERSION

  });


})();
