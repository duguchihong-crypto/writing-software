/* ======================================================
   写作软件 · 公共数据存储模块
   文件：js/storage.js

   功能：
   1. 统一管理书籍数据
   2. 保存书名、简介、封面
   3. 创建、读取、修改、删除书籍
   4. 兼容旧版本书籍数据
   5. 迁移旧版本单独保存的封面
   6. 通知其他页面数据发生变化
   7. 允许分组模块扩展公共存储接口
====================================================== */

(function () {
    "use strict";

    /* ==================================================
       一、基础配置
    ================================================== */

    const DATABASE_KEY = "writing-software-books";

    // 旧版本单独保存封面的数据键
    const LEGACY_COVERS_KEY = "writing-software-book-covers";

    const DATABASE_VERSION = 2;


    /* ==================================================
       二、错误处理
    ================================================== */

    function createStorageError(code, message, originalError) {
        const error = new Error(message);

        error.name = "WritingStorageError";
        error.code = code;

        if (originalError) {
            error.originalError = originalError;
        }

        return error;
    }


    /* ==================================================
       三、基础工具
    ================================================== */

    function getCurrentTime() {
        return new Date().toISOString();
    }


    function createId() {
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 12)
        );
    }


    function isValidId(id) {
        return typeof id === "string" && id.trim() !== "";
    }


    function normalizeText(value) {
        if (typeof value !== "string") {
            return "";
        }

        return value.trim();
    }


    function normalizeCover(value) {
        if (typeof value !== "string") {
            return "";
        }

        const cover = value.trim();

        if (!cover) {
            return "";
        }

        // 仅允许图片 Data URL。
        if (
            !/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(
                cover
            )
        ) {
            throw createStorageError(
                "INVALID_COVER",
                "封面格式不正确，请重新选择图片。"
            );
        }

        return cover;
    }


    function cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }


    /* ==================================================
       四、书籍数据标准化
    ================================================== */

    function normalizeBook(book) {
        if (!book || typeof book !== "object") {
            return null;
        }

        if (!isValidId(book.id)) {
            return null;
        }

        const now = getCurrentTime();

        const chapters = Array.isArray(book.chapters)
            ? book.chapters
            : [];

        const metadata =
            book.metadata && typeof book.metadata === "object"
                ? book.metadata
                : {};

        let cover = "";

        try {
            cover = normalizeCover(book.cover || "");
        } catch (error) {
            // 旧数据中的异常封面不应导致整本书无法读取。
            cover = "";
        }

        return {
            id: book.id,

            title:
                typeof book.title === "string"
                    ? book.title
                    : "未命名书籍",

            description:
                typeof book.description === "string"
                    ? book.description
                    : "",

            cover: cover,

            createdAt:
                typeof book.createdAt === "string"
                    ? book.createdAt
                    : now,

            updatedAt:
                typeof book.updatedAt === "string"
                    ? book.updatedAt
                    : now,

            wordCount:
                Number.isFinite(book.wordCount) && book.wordCount >= 0
                    ? book.wordCount
                    : 0,

            chapters: chapters,

            metadata: {
                ...metadata,
                version: DATABASE_VERSION
            }
        };
    }


    /* ==================================================
       五、读取数据库
    ================================================== */

    function readDatabase() {
        let rawData;

        try {
            rawData = localStorage.getItem(DATABASE_KEY);
        } catch (error) {
            throw createStorageError(
                "STORAGE_UNAVAILABLE",
                "无法读取本地数据，请检查浏览器的存储权限。",
                error
            );
        }

        if (!rawData) {
            return [];
        }

        let parsed;

        try {
            parsed = JSON.parse(rawData);
        } catch (error) {
            throw createStorageError(
                "INVALID_DATABASE",
                "书籍数据无法解析，请勿清除浏览器数据，以免丢失作品。",
                error
            );
        }

        // 兼容旧版本数组格式和新版数据库格式。
        let books;

        if (Array.isArray(parsed)) {
            books = parsed;
        } else if (
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.books)
        ) {
            books = parsed.books;
        } else {
            throw createStorageError(
                "INVALID_DATABASE",
                "书籍数据库格式异常，暂时无法读取。"
            );
        }

        return books
            .map(normalizeBook)
            .filter(Boolean);
    }


    /* ==================================================
       六、保存数据库
    ================================================== */

    function writeDatabase(books) {
        const database = {
            version: DATABASE_VERSION,
            updatedAt: getCurrentTime(),
            books: books
        };

        let serialized;

        try {
            serialized = JSON.stringify(database);
        } catch (error) {
            throw createStorageError(
                "SERIALIZE_FAILED",
                "书籍数据处理失败，未能保存。",
                error
            );
        }

        try {
            localStorage.setItem(DATABASE_KEY, serialized);
        } catch (error) {
            if (
                error &&
                (
                    error.name === "QuotaExceededError" ||
                    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
                    error.code === 22 ||
                    error.code === 1014
                )
            ) {
                throw createStorageError(
                    "STORAGE_FULL",
                    "浏览器存储空间不足，无法保存。请更换较小的封面图片后重试。",
                    error
                );
            }

            throw createStorageError(
                "STORAGE_WRITE_FAILED",
                "保存失败，请检查浏览器的存储权限。",
                error
            );
        }

        return true;
    }


    /* ==================================================
       七、数据变化通知
    ================================================== */

    function notifyChange(detail) {
        try {
            window.dispatchEvent(
                new CustomEvent("writing-storage-change", {
                    detail: {
                        type: detail.type,
                        bookId: detail.bookId || null,
                        timestamp: getCurrentTime()
                    }
                })
            );
        } catch (error) {
            // 通知失败不影响已经保存的数据。
        }
    }


    /* ==================================================
       八、迁移旧版封面
    ================================================== */

    function migrateLegacyCovers() {
        let rawLegacyData;

        try {
            rawLegacyData = localStorage.getItem(LEGACY_COVERS_KEY);
        } catch (error) {
            return;
        }

        if (!rawLegacyData) {
            return;
        }

        let legacyCovers;

        try {
            legacyCovers = JSON.parse(rawLegacyData);
        } catch (error) {
            return;
        }

        if (
            !legacyCovers ||
            typeof legacyCovers !== "object" ||
            Array.isArray(legacyCovers)
        ) {
            return;
        }

        let books;

        try {
            books = readDatabase();
        } catch (error) {
            return;
        }

        let changed = false;

        books = books.map(function (book) {
            if (book.cover) {
                return book;
            }

            const legacyEntry = legacyCovers[book.id];

            if (!legacyEntry || typeof legacyEntry !== "object") {
                return book;
            }

            const legacyData = legacyEntry.data;

            if (typeof legacyData !== "string") {
                return book;
            }

            try {
                const cover = normalizeCover(legacyData);

                if (!cover) {
                    return book;
                }

                changed = true;

                return {
                    ...book,
                    cover: cover,
                    metadata: {
                        ...book.metadata,
                        version: DATABASE_VERSION
                    }
                };
            } catch (error) {
                return book;
            }
        });

        if (!changed) {
            return;
        }

        try {
            writeDatabase(books);

            // 只有迁移成功后才删除旧记录。
            localStorage.removeItem(LEGACY_COVERS_KEY);
        } catch (error) {
            // 迁移失败时保留旧记录。
        }
    }


    /* ==================================================
       九、初始化与旧数据兼容
    ================================================== */

    function initialize() {
        // 先读取现有数据，绝不直接覆盖旧数据库。
        const books = readDatabase();

        let needsMigration = false;

        try {
            const rawData = localStorage.getItem(DATABASE_KEY);

            if (rawData) {
                const parsed = JSON.parse(rawData);

                if (
                    Array.isArray(parsed) ||
                    !parsed ||
                    parsed.version !== DATABASE_VERSION
                ) {
                    needsMigration = true;
                }

                if (
                    books.some(function (book) {
                        return !Object.prototype.hasOwnProperty.call(
                            book,
                            "cover"
                        );
                    })
                ) {
                    needsMigration = true;
                }
            }
        } catch (error) {
            // 异常数据不在初始化阶段被主动覆盖。
        }

        if (needsMigration) {
            writeDatabase(books);
        }

        migrateLegacyCovers();
    }


    /* ==================================================
       十、查询接口
    ================================================== */

    function getBooks() {
        return cloneData(readDatabase()).sort(function (a, b) {
            return (
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
        });
    }


    function getBook(id) {
        if (!isValidId(id)) {
            return null;
        }

        const books = readDatabase();

        const book = books.find(function (item) {
            return item.id === id;
        });

        return book ? cloneData(book) : null;
    }


    function getBookCount() {
        return readDatabase().length;
    }


    function hasBook(id) {
        return getBook(id) !== null;
    }


    function getBookCover(id) {
        const book = getBook(id);

        return book ? book.cover : "";
    }


    /* ==================================================
       十一、创建书籍
    ================================================== */

    function createBook(options) {
        options = options || {};

        const title = normalizeText(options.title);
        const description = normalizeText(options.description);

        if (!title) {
            throw createStorageError(
                "TITLE_REQUIRED",
                "请输入书名。"
            );
        }

        const cover = normalizeCover(options.cover || "");

        const books = readDatabase();
        const now = getCurrentTime();

        const book = {
            id: createId(),
            title: title,
            description: description,
            cover: cover,
            createdAt: now,
            updatedAt: now,
            wordCount: 0,
            chapters: [],
            metadata: {
                version: DATABASE_VERSION
            }
        };

        books.unshift(book);

        writeDatabase(books);

        notifyChange({
            type: "book-created",
            bookId: book.id
        });

        return cloneData(book);
    }


    /* ==================================================
       十二、更新书籍
    ================================================== */

    function updateBook(id, changes) {
        if (!isValidId(id)) {
            throw createStorageError(
                "INVALID_ID",
                "书籍编号无效。"
            );
        }

        if (!changes || typeof changes !== "object") {
            throw createStorageError(
                "INVALID_CHANGES",
                "没有提供有效的修改内容。"
            );
        }

        const books = readDatabase();

        const index = books.findIndex(function (book) {
            return book.id === id;
        });

        if (index === -1) {
            throw createStorageError(
                "BOOK_NOT_FOUND",
                "没有找到这本书。"
            );
        }

        const currentBook = books[index];
        const updatedBook = { ...currentBook };

        if (Object.prototype.hasOwnProperty.call(changes, "title")) {
            const title = normalizeText(changes.title);

            if (!title) {
                throw createStorageError(
                    "TITLE_REQUIRED",
                    "书名不能为空。"
                );
            }

            updatedBook.title = title;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "description"
            )
        ) {
            updatedBook.description = normalizeText(
                changes.description
            );
        }

        if (Object.prototype.hasOwnProperty.call(changes, "cover")) {
            updatedBook.cover = normalizeCover(changes.cover || "");
        }

        updatedBook.updatedAt = getCurrentTime();

        books[index] = updatedBook;

        writeDatabase(books);

        notifyChange({
            type: "book-updated",
            bookId: id
        });

        return cloneData(updatedBook);
    }


    /* ==================================================
       十三、删除书籍
    ================================================== */

    function deleteBook(id) {
        if (!isValidId(id)) {
            throw createStorageError(
                "INVALID_ID",
                "书籍编号无效。"
            );
        }

        const books = readDatabase();

        const index = books.findIndex(function (book) {
            return book.id === id;
        });

        if (index === -1) {
            return false;
        }

        books.splice(index, 1);

        writeDatabase(books);

        notifyChange({
            type: "book-deleted",
            bookId: id
        });

        return true;
    }


    /* ==================================================
       十四、更新最近编辑时间
    ================================================== */

    function touchBook(id) {
        if (!isValidId(id)) {
            return null;
        }

        const books = readDatabase();

        const index = books.findIndex(function (book) {
            return book.id === id;
        });

        if (index === -1) {
            return null;
        }

        books[index].updatedAt = getCurrentTime();

        writeDatabase(books);

        notifyChange({
            type: "book-touched",
            bookId: id
        });

        return cloneData(books[index]);
    }


    /* ==================================================
       十五、变化监听接口
    ================================================== */

    function onChange(callback) {
        if (typeof callback !== "function") {
            throw createStorageError(
                "INVALID_CALLBACK",
                "监听函数必须是有效的函数。"
            );
        }

        function handler(event) {
            callback(event.detail || {});
        }

        window.addEventListener(
            "writing-storage-change",
            handler
        );

        return function unsubscribe() {
            window.removeEventListener(
                "writing-storage-change",
                handler
            );
        };
    }


    /* ==================================================
       十六、跨标签页同步通知
    ================================================== */

    window.addEventListener("storage", function (event) {
        if (
            event.key === DATABASE_KEY ||
            event.key === LEGACY_COVERS_KEY
        ) {
            notifyChange({
                type: "external-change",
                bookId: null
            });
        }
    });


    /* ==================================================
       十七、公开接口
    ================================================== */

    // 注意：
    // 此处不能使用 Object.freeze()。
    // 分组存储模块需要将分组相关方法挂载到
    // window.WritingStorage 上。
    //
    // 冻结对象会阻止添加属性，导致兼容挂载失败。
    //
    // 同时保留独立的 window.WritingGroupsStorage 接口，
    // 供新建分组页面直接调用。

    window.WritingStorage = {
        getBooks: getBooks,
        getBook: getBook,
        getBookCount: getBookCount,
        hasBook: hasBook,
        getBookCover: getBookCover,

        createBook: createBook,
        updateBook: updateBook,
        deleteBook: deleteBook,
        touchBook: touchBook,

        onChange: onChange
    };


    /* ==================================================
       十八、执行初始化
    ================================================== */

    try {
        initialize();
    } catch (error) {
        console.error(
            "[WritingStorage] 初始化失败：",
            error
        );
    }

})();
