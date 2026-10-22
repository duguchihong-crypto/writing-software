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

注意：
不主动清空已有书籍。
不冻结 WritingStorage，兼容其他模块扩展。
====================================================== */

(function () {
“use strict”;

/* ==================================================
   一、基础配置
================================================== */
var DATABASE_KEY = "writing-software-books";
var LEGACY_COVERS_KEY = "writing-software-book-covers";
var DATABASE_VERSION = 2;
/* ==================================================
   二、错误处理
================================================== */
function createStorageError(code, message, originalError) {
    var error = new Error(message);
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
function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}
function normalizeCover(value) {
    if (typeof value !== "string") {
        return "";
    }
    var cover = value.trim();
    if (!cover) {
        return "";
    }
    /*
     * 只接受支持的图片 Base64 Data URL。
     * 保持与原有封面存储格式兼容。
     */
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
function isQuotaError(error) {
    return Boolean(
        error &&
        (
            error.name === "QuotaExceededError" ||
            error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            error.code === 22 ||
            error.code === 1014
        )
    );
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
    var now = getCurrentTime();
    var chapters = Array.isArray(book.chapters)
        ? book.chapters
        : [];
    var metadata =
        book.metadata && typeof book.metadata === "object"
            ? book.metadata
            : {};
    var cover = "";
    try {
        cover = normalizeCover(book.cover || "");
    } catch (error) {
        /*
         * 旧数据中的异常封面不应导致整本书无法读取。
         * 此处只对读取到的旧数据进行容错。
         */
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
            Number.isFinite(book.wordCount) &&
            book.wordCount >= 0
                ? book.wordCount
                : 0,
        chapters: chapters,
        metadata: Object.assign({}, metadata, {
            version: DATABASE_VERSION
        })
    };
}
/* ==================================================
   五、读取数据库
================================================== */
function readRawDatabase() {
    try {
        return localStorage.getItem(DATABASE_KEY);
    } catch (error) {
        throw createStorageError(
            "STORAGE_UNAVAILABLE",
            "无法读取本地数据，请检查浏览器的存储权限。",
            error
        );
    }
}
function parseDatabase(rawData) {
    if (!rawData) {
        return [];
    }
    var parsed;
    try {
        parsed = JSON.parse(rawData);
    } catch (error) {
        throw createStorageError(
            "INVALID_DATABASE",
            "书籍数据无法解析。请勿清除浏览器数据，以免丢失作品。",
            error
        );
    }
    var books;
    /*
     * 兼容旧版本：
     * 旧版：直接存储书籍数组。
     * 新版：存储 { version, updatedAt, books }。
     */
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
function readDatabase() {
    return parseDatabase(readRawDatabase());
}
/* ==================================================
   六、保存数据库
================================================== */
function writeDatabase(books) {
    var database = {
        version: DATABASE_VERSION,
        updatedAt: getCurrentTime(),
        books: books
    };
    var serialized;
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
        if (isQuotaError(error)) {
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
    detail = detail || {};
    try {
        window.dispatchEvent(
            new CustomEvent("writing-storage-change", {
                detail: {
                    type: detail.type || "unknown",
                    bookId: detail.bookId || null,
                    timestamp: getCurrentTime()
                }
            })
        );
    } catch (error) {
        /*
         * 通知失败不影响已经成功保存的数据。
         */
        console.warn(
            "[WritingStorage] 数据变化通知失败：",
            error
        );
    }
}
/* ==================================================
   八、迁移旧版封面
================================================== */
function migrateLegacyCovers() {
    var rawLegacyData;
    try {
        rawLegacyData = localStorage.getItem(
            LEGACY_COVERS_KEY
        );
    } catch (error) {
        return;
    }
    if (!rawLegacyData) {
        return;
    }
    var legacyCovers;
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
    var books;
    try {
        books = readDatabase();
    } catch (error) {
        return;
    }
    var changed = false;
    books = books.map(function (book) {
        if (book.cover) {
            return book;
        }
        var legacyEntry = legacyCovers[book.id];
        if (
            !legacyEntry ||
            typeof legacyEntry !== "object"
        ) {
            return book;
        }
        var legacyData = legacyEntry.data;
        if (typeof legacyData !== "string") {
            return book;
        }
        try {
            var cover = normalizeCover(legacyData);
            if (!cover) {
                return book;
            }
            changed = true;
            return Object.assign({}, book, {
                cover: cover,
                metadata: Object.assign(
                    {},
                    book.metadata,
                    {
                        version: DATABASE_VERSION
                    }
                )
            });
        } catch (error) {
            return book;
        }
    });
    if (!changed) {
        return;
    }
    try {
        writeDatabase(books);
        /*
         * 只有保存成功后才删除旧记录。
         * 迁移失败时保留旧数据。
         */
        localStorage.removeItem(LEGACY_COVERS_KEY);
        notifyChange({
            type: "legacy-covers-migrated"
        });
    } catch (error) {
        console.warn(
            "[WritingStorage] 旧封面迁移失败，保留原记录。",
            error
        );
    }
}
/* ==================================================
   九、初始化与旧数据兼容
================================================== */
function initialize() {
    /*
     * 先读取旧数据。
     * 如果数据无法解析，不在初始化时直接覆盖。
     */
    var rawData = readRawDatabase();
    if (!rawData) {
        migrateLegacyCovers();
        return;
    }
    var parsed;
    try {
        parsed = JSON.parse(rawData);
    } catch (error) {
        /*
         * 不覆盖无法解析的原始数据。
         */
        console.error(
            "[WritingStorage] 数据库解析失败，保留原始数据。",
            error
        );
        return;
    }
    var isLegacyArray = Array.isArray(parsed);
    var hasCurrentVersion =
        parsed &&
        typeof parsed === "object" &&
        parsed.version === DATABASE_VERSION &&
        Array.isArray(parsed.books);
    if (!isLegacyArray && !hasCurrentVersion) {
        /*
         * 对于可识别的旧版本格式，尝试迁移。
         * 对于无法识别的格式，不主动覆盖。
         */
        if (
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.books)
        ) {
            var migratedBooks = parseDatabase(rawData);
            writeDatabase(migratedBooks);
        } else {
            console.warn(
                "[WritingStorage] 未识别数据库格式，保留原始数据。"
            );
            return;
        }
    } else if (isLegacyArray) {
        var legacyBooks = parseDatabase(rawData);
        writeDatabase(legacyBooks);
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
    var books = readDatabase();
    var book = books.find(function (item) {
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
    var book = getBook(id);
    return book ? book.cover : "";
}
/* ==================================================
   十一、创建书籍
================================================== */
function createBook(options) {
    options = options || {};
    var title = normalizeText(options.title);
    var description = normalizeText(options.description);
    if (!title) {
        throw createStorageError(
            "TITLE_REQUIRED",
            "请输入书名。"
        );
    }
    var cover = normalizeCover(options.cover || "");
    /*
     * 先读取已有书籍。
     * 只有新书数据准备好后才写入数据库。
     */
    var books = readDatabase();
    var now = getCurrentTime();
    var book = {
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
    /*
     * 如果保存失败，writeDatabase 会抛出明确错误。
     * 不会返回虚假的创建成功结果。
     */
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
    var books = readDatabase();
    var index = books.findIndex(function (book) {
        return book.id === id;
    });
    if (index === -1) {
        throw createStorageError(
            "BOOK_NOT_FOUND",
            "没有找到这本书。"
        );
    }
    var updatedBook = Object.assign(
        {},
        books[index]
    );
    if (
        Object.prototype.hasOwnProperty.call(
            changes,
            "title"
        )
    ) {
        var title = normalizeText(changes.title);
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
    if (
        Object.prototype.hasOwnProperty.call(
            changes,
            "cover"
        )
    ) {
        updatedBook.cover = normalizeCover(
            changes.cover || ""
        );
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
    var books = readDatabase();
    var index = books.findIndex(function (book) {
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
    var books = readDatabase();
    var index = books.findIndex(function (book) {
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
/*
 * 不冻结对象，保留其他模块扩展接口的能力。
 */
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
