/* ======================================================
写作软件 · 公共数据存储模块
文件：js/storage.js
功能：
1. 统一管理书籍与分组
2. 创建、读取、修改、删除书籍
3. 创建、读取、修改、删除分组
4. 兼容旧版本书籍数据库
5. 保留旧版封面迁移能力
6. 通过事件通知其他页面数据变化
7. 允许其他模块扩展 WritingStorage
注意：
- 不主动清空已有书籍
- 保留原有书籍接口
- 书籍和分组分别存储
- 不冻结 WritingStorage
====================================================== */
(function () {
    "use strict";
    /* ==================================================
       一、基础配置
    ================================================== */
    var DATABASE_KEY = "writing-software-books";
    var GROUPS_KEY = "writing-software-groups";
    var LEGACY_COVERS_KEY = "writing-software-book-covers";
    var DATABASE_VERSION = 2;
    var GROUPS_VERSION = 1;
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
        return typeof value === "string" ? value.trim() : "";
    }
    function cloneData(data) {
        return JSON.parse(JSON.stringify(data));
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
    function normalizeCover(value) {
        if (typeof value !== "string") {
            return "";
        }
        var cover = value.trim();
        if (!cover) {
            return "";
        }
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
    function safeRead(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            throw createStorageError(
                "STORAGE_UNAVAILABLE",
                "无法读取本地数据，请检查浏览器存储权限。",
                error
            );
        }
    }
    function safeWrite(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            if (isQuotaError(error)) {
                throw createStorageError(
                    "STORAGE_FULL",
                    "浏览器存储空间不足，请减少封面图片大小后重试。",
                    error
                );
            }
            throw createStorageError(
                "STORAGE_WRITE_FAILED",
                "保存失败，请检查浏览器存储权限。",
                error
            );
        }
    }
    function safeRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn(
                "[WritingStorage] 无法删除旧数据：",
                error
            );
        }
    }
    /* ==================================================
       四、数据变化通知
    ================================================== */
    function notifyChange(detail) {
        detail = detail || {};
        try {
            window.dispatchEvent(
                new CustomEvent("writing-storage-change", {
                    detail: {
                        type: detail.type || "unknown",
                        bookId: detail.bookId || null,
                        groupId: detail.groupId || null,
                        timestamp: getCurrentTime()
                    }
                })
            );
        } catch (error) {
            console.warn(
                "[WritingStorage] 数据变化通知失败：",
                error
            );
        }
    }
    /* ==================================================
       五、书籍数据标准化
    ================================================== */
    function normalizeBook(book) {
        if (!book || typeof book !== "object") {
            return null;
        }
        if (!isValidId(book.id)) {
            return null;
        }
        var now = getCurrentTime();
        var cover = "";
        try {
            cover = normalizeCover(book.cover || "");
        } catch (error) {
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
            chapters: Array.isArray(book.chapters)
                ? book.chapters
                : [],
            metadata:
                Object.assign(
                    {},
                    book.metadata &&
                    typeof book.metadata === "object"
                        ? book.metadata
                        : {},
                    {
                        version: DATABASE_VERSION
                    }
                )
        };
    }
    /* ==================================================
       六、读取书籍数据库
    ================================================== */
    function parseBooks(rawData) {
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
    function readBooksDatabase() {
        return parseBooks(safeRead(DATABASE_KEY));
    }
    /* ==================================================
       七、保存书籍数据库
    ================================================== */
    function writeBooksDatabase(books) {
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
        safeWrite(DATABASE_KEY, serialized);
        return true;
    }
    /* ==================================================
       八、书籍查询接口
    ================================================== */
    function getBooks() {
        return cloneData(readBooksDatabase()).sort(function (a, b) {
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
        var books = readBooksDatabase();
        var book = books.find(function (item) {
            return item.id === id;
        });
        return book ? cloneData(book) : null;
    }
    function getBookCount() {
        return readBooksDatabase().length;
    }
    function hasBook(id) {
        return getBook(id) !== null;
    }
    function getBookCover(id) {
        var book = getBook(id);
        return book ? book.cover : "";
    }
    /* ==================================================
       九、创建书籍
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
        var books = readBooksDatabase();
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
        writeBooksDatabase(books);
        notifyChange({
            type: "book-created",
            bookId: book.id
        });
        return cloneData(book);
    }
    /* ==================================================
       十、修改书籍
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
        var books = readBooksDatabase();
        var index = books.findIndex(function (book) {
            return book.id === id;
        });
        if (index === -1) {
            throw createStorageError(
                "BOOK_NOT_FOUND",
                "没有找到这本书。"
            );
        }
        var updatedBook = Object.assign({}, books[index]);
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
        writeBooksDatabase(books);
        notifyChange({
            type: "book-updated",
            bookId: id
        });
        return cloneData(updatedBook);
    }
    /* ==================================================
       十一、删除书籍
    ================================================== */
    function deleteBook(id) {
        if (!isValidId(id)) {
            throw createStorageError(
                "INVALID_ID",
                "书籍编号无效。"
            );
        }
        var books = readBooksDatabase();
        var index = books.findIndex(function (book) {
            return book.id === id;
        });
        if (index === -1) {
            return false;
        }
        books.splice(index, 1);
        writeBooksDatabase(books);
        notifyChange({
            type: "book-deleted",
            bookId: id
        });
        return true;
    }
    /* ==================================================
       十二、更新最近编辑时间
    ================================================== */
    function touchBook(id) {
        if (!isValidId(id)) {
            return null;
        }
        var books = readBooksDatabase();
        var index = books.findIndex(function (book) {
            return book.id === id;
        });
        if (index === -1) {
            return null;
        }
        books[index].updatedAt = getCurrentTime();
        writeBooksDatabase(books);
        notifyChange({
            type: "book-touched",
            bookId: id
        });
        return cloneData(books[index]);
    }
    /* ==================================================
       十三、分组数据标准化
    ================================================== */
    function normalizeGroup(group) {
        if (!group || typeof group !== "object") {
            return null;
        }
        if (!isValidId(group.id)) {
            return null;
        }
        var now = getCurrentTime();
        return {
            id: group.id,
            name:
                typeof group.name === "string"
                    ? group.name
                    : "未命名分组",
            description:
                typeof group.description === "string"
                    ? group.description
                    : "",
            bookIds: Array.isArray(group.bookIds)
                ? group.bookIds.filter(isValidId)
                : [],
            createdAt:
                typeof group.createdAt === "string"
                    ? group.createdAt
                    : now,
            updatedAt:
                typeof group.updatedAt === "string"
                    ? group.updatedAt
                    : now
        };
    }
    /* ==================================================
       十四、读取分组数据库
    ================================================== */
    function readGroupsDatabase() {
        var rawData = safeRead(GROUPS_KEY);
        if (!rawData) {
            return [];
        }
        var parsed;
        try {
            parsed = JSON.parse(rawData);
        } catch (error) {
            throw createStorageError(
                "INVALID_GROUP_DATABASE",
                "分组数据无法解析。请勿清除浏览器数据。",
                error
            );
        }
        var groups;
        if (Array.isArray(parsed)) {
            groups = parsed;
        } else if (
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.groups)
        ) {
            groups = parsed.groups;
        } else {
            throw createStorageError(
                "INVALID_GROUP_DATABASE",
                "分组数据库格式异常，暂时无法读取。"
            );
        }
        return groups
            .map(normalizeGroup)
            .filter(Boolean);
    }
    /* ==================================================
       十五、保存分组数据库
    ================================================== */
    function writeGroupsDatabase(groups) {
        var database = {
            version: GROUPS_VERSION,
            updatedAt: getCurrentTime(),
            groups: groups
        };
        var serialized;
        try {
            serialized = JSON.stringify(database);
        } catch (error) {
            throw createStorageError(
                "SERIALIZE_FAILED",
                "分组数据处理失败，未能保存。",
                error
            );
        }
        safeWrite(GROUPS_KEY, serialized);
        return true;
    }
    /* ==================================================
       十六、查询分组
    ================================================== */
    function getGroups() {
        return cloneData(readGroupsDatabase()).sort(function (a, b) {
            return (
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
        });
    }
    function getGroup(id) {
        if (!isValidId(id)) {
            return null;
        }
        var groups = readGroupsDatabase();
        var group = groups.find(function (item) {
            return item.id === id;
        });
        return group ? cloneData(group) : null;
    }
    function getGroupCount() {
        return readGroupsDatabase().length;
    }
    /* ==================================================
       十七、创建分组
    ================================================== */
    function createGroup(options) {
        options = options || {};
        /*
         * 同时兼容：
         * createGroup({ name: "分组" })
         * createGroup("分组")
         */
        var name = normalizeText(
            typeof options === "string"
                ? options
                : options.name
        );
        if (!name) {
            throw createStorageError(
                "GROUP_NAME_REQUIRED",
                "请输入分组名称。"
            );
        }
        var groups = readGroupsDatabase();
        var now = getCurrentTime();
        var group = {
            id: createId(),
            name: name,
            description:
                typeof options === "object" &&
                options &&
                typeof options.description === "string"
                    ? options.description.trim()
                    : "",
            bookIds:
                typeof options === "object" &&
                options &&
                Array.isArray(options.bookIds)
                    ? options.bookIds.filter(isValidId)
                    : [],
            createdAt: now,
            updatedAt: now
        };
        groups.unshift(group);
        writeGroupsDatabase(groups);
        notifyChange({
            type: "group-created",
            groupId: group.id
        });
        return cloneData(group);
    }
    /* ==================================================
       十八、修改分组
    ================================================== */
    function updateGroup(id, changes) {
        if (!isValidId(id)) {
            throw createStorageError(
                "INVALID_ID",
                "分组编号无效。"
            );
        }
        if (!changes || typeof changes !== "object") {
            throw createStorageError(
                "INVALID_CHANGES",
                "没有提供有效的修改内容。"
            );
        }
        var groups = readGroupsDatabase();
        var index = groups.findIndex(function (group) {
            return group.id === id;
        });
        if (index === -1) {
            throw createStorageError(
                "GROUP_NOT_FOUND",
                "没有找到这个分组。"
            );
        }
        var updatedGroup = Object.assign({}, groups[index]);
        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "name"
            )
        ) {
            var name = normalizeText(changes.name);
            if (!name) {
                throw createStorageError(
                    "GROUP_NAME_REQUIRED",
                    "分组名称不能为空。"
                );
            }
            updatedGroup.name = name;
        }
        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "description"
            )
        ) {
            updatedGroup.description = normalizeText(
                changes.description
            );
        }
        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "bookIds"
            )
        ) {
            if (!Array.isArray(changes.bookIds)) {
                throw createStorageError(
                    "INVALID_BOOK_IDS",
                    "分组中的书籍列表格式不正确。"
                );
            }
            updatedGroup.bookIds = changes.bookIds.filter(
                isValidId
            );
        }
        updatedGroup.updatedAt = getCurrentTime();
        groups[index] = updatedGroup;
        writeGroupsDatabase(groups);
        notifyChange({
            type: "group-updated",
            groupId: id
        });
        return cloneData(updatedGroup);
    }
    /* ==================================================
       十九、删除分组
    ================================================== */
    function deleteGroup(id) {
        if (!isValidId(id)) {
            throw createStorageError(
                "INVALID_ID",
                "分组编号无效。"
            );
        }
        var groups = readGroupsDatabase();
        var index = groups.findIndex(function (group) {
            return group.id === id;
        });
        if (index === -1) {
            return false;
        }
        groups.splice(index, 1);
        writeGroupsDatabase(groups);
        notifyChange({
            type: "group-deleted",
            groupId: id
        });
        return true;
    }
    /* ==================================================
       二十、分组与书籍关联
    ================================================== */
    function addBookToGroup(groupId, bookId) {
        var group = getGroup(groupId);
        if (!group) {
            throw createStorageError(
                "GROUP_NOT_FOUND",
                "没有找到这个分组。"
            );
        }
        if (!hasBook(bookId)) {
            throw createStorageError(
                "BOOK_NOT_FOUND",
                "没有找到这本书。"
            );
        }
        if (group.bookIds.indexOf(bookId) !== -1) {
            return group;
        }
        group.bookIds.push(bookId);
        return updateGroup(groupId, {
            bookIds: group.bookIds
        });
    }
    function removeBookFromGroup(groupId, bookId) {
        var group = getGroup(groupId);
        if (!group) {
            throw createStorageError(
                "GROUP_NOT_FOUND",
                "没有找到这个分组。"
            );
        }
        var bookIds = group.bookIds.filter(function (id) {
            return id !== bookId;
        });
        return updateGroup(groupId, {
            bookIds: bookIds
        });
    }
    function getGroupBooks(groupId) {
        var group = getGroup(groupId);
        if (!group) {
            return [];
        }
        return group.bookIds
            .map(function (bookId) {
                return getBook(bookId);
            })
            .filter(Boolean);
    }
    /* ==================================================
       二十一、旧版封面迁移
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
            books = readBooksDatabase();
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
                typeof legacyEntry !== "object" ||
                typeof legacyEntry.data !== "string"
            ) {
                return book;
            }
            try {
                var cover = normalizeCover(legacyEntry.data);
                if (!cover) {
                    return book;
                }
                changed = true;
                return Object.assign({}, book, {
                    cover: cover
                });
            } catch (error) {
                return book;
            }
        });
        if (!changed) {
            return;
        }
        try {
            writeBooksDatabase(books);
            safeRemove(LEGACY_COVERS_KEY);
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
       二十二、初始化兼容
    ================================================== */
    function initialize() {
        var rawData = safeRead(DATABASE_KEY);
        if (rawData) {
            var parsed;
            try {
                parsed = JSON.parse(rawData);
            } catch (error) {
                console.error(
                    "[WritingStorage] 数据库解析失败，保留原始数据。",
                    error
                );
                return;
            }
            var isLegacyArray = Array.isArray(parsed);
            var isCurrentDatabase =
                parsed &&
                typeof parsed === "object" &&
                parsed.version === DATABASE_VERSION &&
                Array.isArray(parsed.books);
            if (isLegacyArray) {
                writeBooksDatabase(parseBooks(rawData));
            } else if (
                parsed &&
                typeof parsed === "object" &&
                Array.isArray(parsed.books) &&
                !isCurrentDatabase
            ) {
                writeBooksDatabase(parseBooks(rawData));
            } else if (!isCurrentDatabase) {
                console.warn(
                    "[WritingStorage] 未识别数据库格式，保留原始数据。"
                );
                return;
            }
        }
        /*
         * 分组数据库采用独立存储。
         * 第一次使用时只建立空数据库；
         * 不会删除或覆盖已有书籍。
         */
        var rawGroups = safeRead(GROUPS_KEY);
        if (!rawGroups) {
            writeGroupsDatabase([]);
        } else {
            /*
             * 先验证数据格式。
             * 异常时保留原始分组数据，不覆盖。
             */
            readGroupsDatabase();
        }
        migrateLegacyCovers();
    }
    /* ==================================================
       二十三、变化监听
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
       二十四、跨标签页同步
    ================================================== */
    window.addEventListener("storage", function (event) {
        if (
            event.key === DATABASE_KEY ||
            event.key === GROUPS_KEY ||
            event.key === LEGACY_COVERS_KEY
        ) {
            notifyChange({
                type: "external-change"
            });
        }
    });
    /* ==================================================
       二十五、公开接口
    ================================================== */
    /*
     * 先复用已有对象，避免其他脚本扩展的接口被覆盖。
     */
    var storage = window.WritingStorage || {};
    Object.assign(storage, {
        /* 书籍接口 */
        getBooks: getBooks,
        getBook: getBook,
        getBookCount: getBookCount,
        hasBook: hasBook,
        getBookCover: getBookCover,
        createBook: createBook,
        updateBook: updateBook,
        deleteBook: deleteBook,
        touchBook: touchBook,
        /* 分组接口 */
        getGroups: getGroups,
        getGroup: getGroup,
        getGroupCount: getGroupCount,
        createGroup: createGroup,
        updateGroup: updateGroup,
        deleteGroup: deleteGroup,
        /* 分组与书籍关联 */
        addBookToGroup: addBookToGroup,
        removeBookFromGroup: removeBookFromGroup,
        getGroupBooks: getGroupBooks,
        /* 变化监听 */
        onChange: onChange
    });
    window.WritingStorage = storage;
    /* ==================================================
       二十六、执行初始化
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
