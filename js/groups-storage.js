/* ======================================================
   分组数据存储模块
   文件：js/groups-storage.js

   主要功能：
   1. 创建、读取、修改、删除分组
   2. 检查分组 ID 和名称
   3. 支持 metadata 附加信息
   4. 兼容旧版数组格式
   5. 兼容 WritingStorage
   6. 支持分组与小说关联
   7. 支持移动小说
   8. 支持移出分组
   9. 删除分组不删除小说
   10. 支持数据变化监听
   11. 支持跨标签页同步
   12. 防止外部直接修改返回的数据
   13. 统一处理存储异常
   14. 支持重复加载
   15. 支持延迟连接 WritingStorage

   存储键：
   writing-software-groups

   依赖：
   js/storage.js

   全局接口：
   window.WritingGroupsStorage
   window.WritingStorage
====================================================== */

(function () {
    "use strict";

    /* ==================================================
       一、基础配置
    ================================================== */

    const STORAGE_KEY = "writing-software-groups";

    const STORAGE_VERSION = 1;

    const CHANGE_EVENT = "writing-groups-change";

    const MAX_NAME_LENGTH = 50;

    const INITIALIZED_KEY =
        "__writingGroupsStorageInitialized";

    /* ==================================================
       二、重复加载检查
    ================================================== */

    if (window[INITIALIZED_KEY]) {
        attachExistingStorage();
        return;
    }

    /* ==================================================
       三、错误处理
    ================================================== */

    function createError(message, code) {
        const error = new Error(message);

        error.name = "WritingGroupsError";

        error.code = code || "GROUP_STORAGE_ERROR";

        return error;
    }

    /* ==================================================
       四、基础工具
    ================================================== */

    function isPlainObject(value) {
        if (
            value === null ||
            typeof value !== "object" ||
            Array.isArray(value)
        ) {
            return false;
        }

        const prototype = Object.getPrototypeOf(value);

        return (
            prototype === Object.prototype ||
            prototype === null
        );
    }

    function normalizeName(name) {
        if (name === null || name === undefined) {
            return "";
        }

        return String(name).trim();
    }

    function normalizeNameForComparison(name) {
        return normalizeName(name).toLocaleLowerCase();
    }

    function compareNames(nameA, nameB) {
        return (
            normalizeNameForComparison(nameA) ===
            normalizeNameForComparison(nameB)
        );
    }

    function validateName(name) {
        const normalizedName = normalizeName(name);

        if (!normalizedName) {
            throw createError(
                "请输入分组名称。",
                "GROUP_NAME_REQUIRED"
            );
        }

        if (normalizedName.length > MAX_NAME_LENGTH) {
            throw createError(
                "分组名称不能超过 50 个字符。",
                "GROUP_NAME_TOO_LONG"
            );
        }

        return normalizedName;
    }

    function createId() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return "group-" + window.crypto.randomUUID();
        }

        return (
            "group-" +
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 14)
        );
    }

    function nowISO() {
        return new Date().toISOString();
    }

    function cloneJSON(value, fallback) {
        try {
            const result = JSON.parse(JSON.stringify(value));

            return result === undefined ? fallback : result;
        } catch (error) {
            return fallback;
        }
    }

    /* ==================================================
       五、metadata 附加信息
    ================================================== */

    function cloneMetadata(metadata) {
        if (!isPlainObject(metadata)) {
            return {};
        }

        const result = cloneJSON(metadata, {});

        return isPlainObject(result) ? result : {};
    }

    /* ==================================================
       六、小说 ID 标准化
    ================================================== */

    function normalizeBookId(bookId) {
        if (
            bookId === null ||
            bookId === undefined ||
            bookId === ""
        ) {
            return "";
        }

        return String(bookId);
    }

    /* ==================================================
       七、标准化分组
    ================================================== */

    function normalizeGroup(group) {
        if (!isPlainObject(group)) {
            return null;
        }

        const id = String(group.id || "").trim();

        const name = normalizeName(group.name);

        if (!id || !name) {
            return null;
        }

        const createdAt =
            typeof group.createdAt === "string" &&
            group.createdAt
                ? group.createdAt
                : nowISO();

        const updatedAt =
            typeof group.updatedAt === "string" &&
            group.updatedAt
                ? group.updatedAt
                : createdAt;

        /*
         * 兼容旧数据：
         * 旧版分组可能没有 bookIds。
         */

        const bookIds = [];

        if (Array.isArray(group.bookIds)) {
            group.bookIds.forEach(function (bookId) {
                const idValue = normalizeBookId(bookId);

                if (
                    idValue &&
                    !bookIds.includes(idValue)
                ) {
                    bookIds.push(idValue);
                }
            });
        }

        return {
            id: id,

            name: name,

            description:
                typeof group.description === "string"
                    ? group.description
                    : "",

            bookIds: bookIds,

            createdAt: createdAt,

            updatedAt: updatedAt,

            metadata: cloneMetadata(group.metadata)
        };
    }

    function cloneGroup(group) {
        return {
            id: group.id,

            name: group.name,

            description: group.description || "",

            bookIds: Array.isArray(group.bookIds)
                ? group.bookIds.slice()
                : [],

            createdAt: group.createdAt,

            updatedAt: group.updatedAt,

            metadata: cloneMetadata(group.metadata)
        };
    }

    function cloneGroups(groups) {
        return groups.map(function (group) {
            return cloneGroup(group);
        });
    }

    /* ==================================================
       八、标准化分组列表
    ================================================== */

    function normalizeGroups(groups) {
        if (!Array.isArray(groups)) {
            return [];
        }

        const result = [];

        const usedIds = new Set();

        const usedNames = new Set();

        /*
         * 一本小说只能属于一个分组。
         */

        const usedBookIds = new Set();

        groups.forEach(function (item) {
            const group = normalizeGroup(item);

            if (!group) {
                return;
            }

            const normalizedId = group.id;

            const normalizedName =
                normalizeNameForComparison(group.name);

            if (
                usedIds.has(normalizedId) ||
                usedNames.has(normalizedName)
            ) {
                return;
            }

            /*
             * 清理重复的小说关联。
             */

            group.bookIds = group.bookIds.filter(
                function (bookId) {
                    if (usedBookIds.has(bookId)) {
                        return false;
                    }

                    usedBookIds.add(bookId);

                    return true;
                }
            );

            usedIds.add(normalizedId);

            usedNames.add(normalizedName);

            result.push(group);
        });

        return result;
    }

    /* ==================================================
       九、读取原始数据
    ================================================== */

    function readRawData() {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            throw createError(
                "无法读取分组数据，请检查浏览器存储权限。",
                "GROUP_STORAGE_UNAVAILABLE"
            );
        }
    }

    /* ==================================================
       十、读取分组数据库
    ================================================== */

    function readDatabase() {
        const raw = readRawData();

        if (raw === null || raw === "") {
            return {
                version: STORAGE_VERSION,

                updatedAt: nowISO(),

                groups: []
            };
        }

        let parsed;

        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw createError(
                "分组数据格式损坏，无法读取。",
                "GROUP_INVALID_DATABASE"
            );
        }

        /*
         * 兼容旧版直接保存数组的格式。
         */

        if (Array.isArray(parsed)) {
            return {
                version: STORAGE_VERSION,

                updatedAt: nowISO(),

                groups: normalizeGroups(parsed)
            };
        }

        if (
            !isPlainObject(parsed) ||
            !Array.isArray(parsed.groups)
        ) {
            throw createError(
                "分组数据库结构不正确。",
                "GROUP_INVALID_DATABASE"
            );
        }

        return {
            version: STORAGE_VERSION,

            updatedAt:
                typeof parsed.updatedAt === "string"
                    ? parsed.updatedAt
                    : nowISO(),

            groups: normalizeGroups(parsed.groups)
        };
    }

    /* ==================================================
       十一、通知数据变化
    ================================================== */

    function notifyChange(groups) {
        try {
            window.dispatchEvent(
                new CustomEvent(CHANGE_EVENT, {
                    detail: {
                        groups: cloneGroups(groups),

                        updatedAt: nowISO()
                    }
                })
            );
        } catch (error) {
            console.warn(
                "[分组存储] 数据变化通知失败：",
                error
            );
        }
    }

    /* ==================================================
       十二、保存分组数据库
    ================================================== */

    function writeDatabase(groups) {
        const normalizedGroups = normalizeGroups(groups);

        const database = {
            version: STORAGE_VERSION,

            updatedAt: nowISO(),

            groups: cloneGroups(normalizedGroups)
        };

        let serialized;

        try {
            serialized = JSON.stringify(database);
        } catch (error) {
            throw createError(
                "分组数据无法转换为保存格式。",
                "GROUP_SERIALIZE_FAILED"
            );
        }

        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                serialized
            );
        } catch (error) {
            const isQuotaError =
                error &&
                (
                    error.name === "QuotaExceededError" ||
                    error.code === 22 ||
                    error.code === 1014
                );

            throw createError(
                isQuotaError
                    ? "浏览器存储空间不足，无法保存分组。"
                    : "分组保存失败，请检查浏览器存储权限。",

                isQuotaError
                    ? "GROUP_STORAGE_FULL"
                    : "GROUP_STORAGE_UNAVAILABLE"
            );
        }

        notifyChange(database.groups);

        return database;
    }

    /* ==================================================
       十三、获取全部分组
    ================================================== */

    function getGroups() {
        return cloneGroups(readDatabase().groups);
    }

    /* ==================================================
       十四、获取单个分组
    ================================================== */

    function getGroup(id) {
        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {
            return null;
        }

        const targetId = String(id);

        const group = readDatabase().groups.find(
            function (item) {
                return item.id === targetId;
            }
        );

        return group ? cloneGroup(group) : null;
    }

    /* ==================================================
       十五、获取分组数量
    ================================================== */

    function getGroupCount() {
        return readDatabase().groups.length;
    }

    /* ==================================================
       十六、检查分组是否存在
    ================================================== */

    function hasGroup(id) {
        return getGroup(id) !== null;
    }

    /* ==================================================
       十七、检查分组名称是否重复
    ================================================== */

    function hasGroupName(name, excludeId) {
        const normalizedName = normalizeName(name);

        if (!normalizedName) {
            return false;
        }

        const targetId =
            excludeId === null ||
            excludeId === undefined
                ? null
                : String(excludeId);

        return readDatabase().groups.some(
            function (group) {
                if (
                    targetId !== null &&
                    group.id === targetId
                ) {
                    return false;
                }

                return compareNames(
                    group.name,
                    normalizedName
                );
            }
        );
    }

    /* ==================================================
       十八、创建分组
    ================================================== */

    function createGroup(options) {
        /*
         * 兼容：
         * createGroup("分组名称")
         * createGroup({ name: "分组名称" })
         */

        if (typeof options === "string") {
            options = {
                name: options
            };
        }

        options = options || {};

        if (!isPlainObject(options)) {
            throw createError(
                "分组创建参数不正确。",
                "GROUP_INVALID_OPTIONS"
            );
        }

        const name = validateName(options.name);

        const database = readDatabase();

        const duplicated = database.groups.some(
            function (group) {
                return compareNames(group.name, name);
            }
        );

        if (duplicated) {
            throw createError(
                "已经存在同名分组，请换一个名称。",
                "GROUP_NAME_DUPLICATE"
            );
        }

        const now = nowISO();

        const group = {
            id: createId(),

            name: name,

            description:
                typeof options.description === "string"
                    ? options.description
                    : "",

            bookIds: [],

            createdAt: now,

            updatedAt: now,

            metadata: cloneMetadata(options.metadata)
        };

        database.groups.push(group);

        writeDatabase(database.groups);

        return cloneGroup(group);
    }

    /* ==================================================
       十九、修改分组
    ================================================== */

    function updateGroup(id, changes) {
        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {
            throw createError(
                "缺少分组 ID。",
                "GROUP_ID_REQUIRED"
            );
        }

        if (!isPlainObject(changes)) {
            throw createError(
                "分组修改参数不正确。",
                "GROUP_INVALID_CHANGES"
            );
        }

        const targetId = String(id);

        const database = readDatabase();

        const index = database.groups.findIndex(
            function (group) {
                return group.id === targetId;
            }
        );

        if (index === -1) {
            return null;
        }

        const updatedGroup = cloneGroup(
            database.groups[index]
        );

        /*
         * 修改名称。
         */

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "name"
            )
        ) {
            const name = validateName(changes.name);

            const duplicated = database.groups.some(
                function (group) {
                    return (
                        group.id !== targetId &&
                        compareNames(group.name, name)
                    );
                }
            );

            if (duplicated) {
                throw createError(
                    "已经存在同名分组，请换一个名称。",
                    "GROUP_NAME_DUPLICATE"
                );
            }

            updatedGroup.name = name;
        }

        /*
         * 修改描述。
         */

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "description"
            )
        ) {
            if (typeof changes.description !== "string") {
                throw createError(
                    "分组描述必须是文本。",
                    "GROUP_INVALID_DESCRIPTION"
                );
            }

            updatedGroup.description = changes.description;
        }

        /*
         * 合并 metadata。
         */

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "metadata"
            )
        ) {
            if (!isPlainObject(changes.metadata)) {
                throw createError(
                    "分组附加信息格式不正确。",
                    "GROUP_INVALID_METADATA"
                );
            }

            updatedGroup.metadata = Object.assign(
                {},
                cloneMetadata(updatedGroup.metadata),
                cloneMetadata(changes.metadata)
            );
        }

        /*
         * 允许明确更新关联列表。
         * 正常移动小说建议使用 moveBookToGroup。
         */

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "bookIds"
            )
        ) {
            if (!Array.isArray(changes.bookIds)) {
                throw createError(
                    "小说关联列表格式不正确。",
                    "GROUP_INVALID_BOOK_IDS"
                );
            }

            updatedGroup.bookIds = [];

            changes.bookIds.forEach(function (bookId) {
                const normalizedId = normalizeBookId(bookId);

                if (
                    normalizedId &&
                    !updatedGroup.bookIds.includes(normalizedId)
                ) {
                    updatedGroup.bookIds.push(normalizedId);
                }
            });
        }

        updatedGroup.updatedAt = nowISO();

        database.groups[index] = updatedGroup;

        writeDatabase(database.groups);

        return cloneGroup(updatedGroup);
    }

    /* ==================================================
       二十、删除分组
    ================================================== */

    function deleteGroup(id) {
        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {
            return false;
        }

        const targetId = String(id);

        const database = readDatabase();

        const index = database.groups.findIndex(
            function (group) {
                return group.id === targetId;
            }
        );

        if (index === -1) {
            return false;
        }

        /*
         * 只删除分组。
         * 不删除任何小说数据。
         */

        database.groups.splice(index, 1);

        writeDatabase(database.groups);

        return true;
    }

    /* ==================================================
       二十一、获取小说所属分组
    ================================================== */

    function getBookGroup(bookId) {
        const normalizedId = normalizeBookId(bookId);

        if (!normalizedId) {
            return null;
        }

        const groups = readDatabase().groups;

        const group = groups.find(function (item) {
            return item.bookIds.includes(normalizedId);
        });

        return group ? cloneGroup(group) : null;
    }

    /* ==================================================
       二十二、获取分组内的小说 ID
    ================================================== */

    function getGroupBookIds(groupId) {
        const group = getGroup(groupId);

        return group ? group.bookIds.slice() : [];
    }

    /* ==================================================
       二十三、添加小说到分组
    ================================================== */

    function addBookToGroup(groupId, bookId) {
        const targetGroupId = String(groupId || "");

        const normalizedBookId = normalizeBookId(bookId);

        if (!targetGroupId) {
            throw createError(
                "缺少目标分组 ID。",
                "GROUP_ID_REQUIRED"
            );
        }

        if (!normalizedBookId) {
            throw createError(
                "缺少小说 ID。",
                "GROUP_BOOK_ID_REQUIRED"
            );
        }

        const database = readDatabase();

        const targetGroup = database.groups.find(
            function (group) {
                return group.id === targetGroupId;
            }
        );

        if (!targetGroup) {
            throw createError(
                "目标分组不存在。",
                "GROUP_NOT_FOUND"
            );
        }

        const currentGroup = database.groups.find(
            function (group) {
                return group.bookIds.includes(normalizedBookId);
            }
        );

        if (currentGroup) {
            if (currentGroup.id === targetGroupId) {
                return cloneGroup(targetGroup);
            }

            throw createError(
                "这本小说已经属于其他分组，请使用移动功能。",
                "BOOK_ALREADY_IN_GROUP"
            );
        }

        targetGroup.bookIds.push(normalizedBookId);

        targetGroup.updatedAt = nowISO();

        writeDatabase(database.groups);

        return cloneGroup(targetGroup);
    }

    /* ==================================================
       二十四、移动小说到分组
    ================================================== */

    function moveBookToGroup(groupId, bookId) {
        const targetGroupId = String(groupId || "");

        const normalizedBookId = normalizeBookId(bookId);

        if (!targetGroupId) {
            throw createError(
                "缺少目标分组 ID。",
                "GROUP_ID_REQUIRED"
            );
        }

        if (!normalizedBookId) {
            throw createError(
                "缺少小说 ID。",
                "GROUP_BOOK_ID_REQUIRED"
            );
        }

        const database = readDatabase();

        const targetGroup = database.groups.find(
            function (group) {
                return group.id === targetGroupId;
            }
        );

        if (!targetGroup) {
            throw createError(
                "目标分组不存在。",
                "GROUP_NOT_FOUND"
            );
        }

        /*
         * 先从所有分组移除该小说，
         * 再加入目标分组。
         *
         * 一本小说只能属于一个分组。
         */

        database.groups.forEach(function (group) {
            const oldLength = group.bookIds.length;

            group.bookIds = group.bookIds.filter(
                function (id) {
                    return id !== normalizedBookId;
                }
            );

            if (group.bookIds.length !== oldLength) {
                group.updatedAt = nowISO();
            }
        });

        targetGroup.bookIds.push(normalizedBookId);

        targetGroup.updatedAt = nowISO();

        writeDatabase(database.groups);

        return cloneGroup(targetGroup);
    }

    /* ==================================================
       二十五、从分组移出小说
    ================================================== */

    function removeBookFromGroup(groupId, bookId) {
        const targetGroupId = String(groupId || "");

        const normalizedBookId = normalizeBookId(bookId);

        if (!targetGroupId || !normalizedBookId) {
            return false;
        }

        const database = readDatabase();

        const group = database.groups.find(
            function (item) {
                return item.id === targetGroupId;
            }
        );

        if (!group) {
            return false;
        }

        const oldLength = group.bookIds.length;

        group.bookIds = group.bookIds.filter(
            function (id) {
                return id !== normalizedBookId;
            }
        );

        if (group.bookIds.length === oldLength) {
            return false;
        }

        group.updatedAt = nowISO();

        writeDatabase(database.groups);

        return true;
    }

    /* ==================================================
       二十六、获取分组内的小说
    ================================================== */

    function getGroupBooks(groupId) {
        const ids = getGroupBookIds(groupId);

        const storage = window.WritingStorage;

        if (
            !storage ||
            typeof storage.getBooks !== "function"
        ) {
            return [];
        }

        const books = storage.getBooks();

        if (!Array.isArray(books)) {
            return [];
        }

        const bookMap = new Map();

        books.forEach(function (book) {
            if (
                book &&
                book.id !== null &&
                book.id !== undefined
            ) {
                bookMap.set(String(book.id), book);
            }
        });

        return ids
            .map(function (id) {
                return bookMap.get(id);
            })
            .filter(Boolean)
            .map(function (book) {
                return cloneJSON(book, book);
            });
    }

    /* ==================================================
       二十七、监听分组数据变化
    ================================================== */

    function onChange(callback) {
        if (typeof callback !== "function") {
            return function () {};
        }

        function handleChange(event) {
            let groups;

            try {
                groups = getGroups();
            } catch (error) {
                console.error(
                    "[分组存储] 读取更新后的数据失败：",
                    error
                );

                return;
            }

            callback({
                groups: groups,

                external: Boolean(
                    event &&
                    event.type === "storage"
                ),

                updatedAt: nowISO()
            });
        }

        window.addEventListener(
            CHANGE_EVENT,
            handleChange
        );

        function handleStorage(event) {
            if (event.key !== STORAGE_KEY) {
                return;
            }

            handleChange({
                type: "storage"
            });
        }

        window.addEventListener(
            "storage",
            handleStorage
        );

        return function unsubscribe() {
            window.removeEventListener(
                CHANGE_EVENT,
                handleChange
            );

            window.removeEventListener(
                "storage",
                handleStorage
            );
        };
    }

    /* ==================================================
       二十八、公开独立接口
    ================================================== */

    const groupsAPI = Object.freeze({
        getGroups: getGroups,

        getGroup: getGroup,

        getGroupCount: getGroupCount,

        hasGroup: hasGroup,

        hasGroupName: hasGroupName,

        createGroup: createGroup,

        updateGroup: updateGroup,

        deleteGroup: deleteGroup,

        getBookGroup: getBookGroup,

        getGroupBookIds: getGroupBookIds,

        getGroupBooks: getGroupBooks,

        addBookToGroup: addBookToGroup,

        moveBookToGroup: moveBookToGroup,

        removeBookFromGroup: removeBookFromGroup,

        onChange: onChange
    });

    window.WritingGroupsStorage = groupsAPI;

    /* ==================================================
       二十九、连接 WritingStorage
    ================================================== */

    function attachToWritingStorage() {
        const storage = window.WritingStorage;

        if (
            !storage ||
            (
                typeof storage !== "object" &&
                typeof storage !== "function"
            )
        ) {
            return false;
        }

        /*
         * 仅补充分组接口。
         * 不覆盖 storage.js 的书籍方法。
         */

        const methods = {
            getGroups: getGroups,

            getGroup: getGroup,

            getGroupCount: getGroupCount,

            hasGroup: hasGroup,

            hasGroupName: hasGroupName,

            createGroup: createGroup,

            updateGroup: updateGroup,

            deleteGroup: deleteGroup,

            getBookGroup: getBookGroup,

            getGroupBookIds: getGroupBookIds,

            getGroupBooks: getGroupBooks,

            addBookToGroup: addBookToGroup,

            moveBookToGroup: moveBookToGroup,

            removeBookFromGroup: removeBookFromGroup,

            onGroupsChange: onChange
        };

        try {
            Object.keys(methods).forEach(function (methodName) {
                /*
                 * 不覆盖原有同名接口。
                 */

                if (typeof storage[methodName] !== "function") {
                    storage[methodName] = methods[methodName];
                }
            });

            return true;
        } catch (error) {
            console.error(
                "[分组存储] 连接 WritingStorage 失败：",
                error
            );

            return false;
        }
    }

    /* ==================================================
       三十、连接已有接口
    ================================================== */

    function attachExistingStorage() {
        const storage = window.WritingGroupsStorage;

        if (!storage) {
            return false;
        }

        const writingStorage = window.WritingStorage;

        if (
            !writingStorage ||
            (
                typeof writingStorage !== "object" &&
                typeof writingStorage !== "function"
            )
        ) {
            return false;
        }

        const methods = [
            "getGroups",
            "getGroup",
            "getGroupCount",
            "hasGroup",
            "hasGroupName",
            "createGroup",
            "updateGroup",
            "deleteGroup",
            "getBookGroup",
            "getGroupBookIds",
            "getGroupBooks",
            "addBookToGroup",
            "moveBookToGroup",
            "removeBookFromGroup"
        ];

        try {
            methods.forEach(function (methodName) {
                if (
                    typeof storage[methodName] === "function" &&
                    typeof writingStorage[methodName] !== "function"
                ) {
                    writingStorage[methodName] = storage[methodName];
                }
            });

            if (
                typeof storage.onChange === "function" &&
                typeof writingStorage.onGroupsChange !== "function"
            ) {
                writingStorage.onGroupsChange = storage.onChange;
            }

            return true;
        } catch (error) {
            console.error(
                "[分组存储] 连接已有接口失败：",
                error
            );

            return false;
        }
    }

    /* ==================================================
       三十一、初始化
    ================================================== */

    window[INITIALIZED_KEY] = true;

    attachToWritingStorage();

    /*
     * 兼容 WritingStorage 延迟加载。
     */

    if (
        !window.WritingStorage ||
        typeof window.WritingStorage.getBooks !== "function"
    ) {
        window.addEventListener(
            "load",
            function () {
                attachToWritingStorage();
            },
            { once: true }
        );
    }

    /*
     * 有限次数重试，避免无限定时器。
     */

    if (
        !window.WritingStorage ||
        typeof window.WritingStorage.getGroups !== "function"
    ) {
        let retryCount = 0;

        const MAX_RETRIES = 10;

        const retryTimer = window.setInterval(
            function () {
                retryCount++;

                attachToWritingStorage();

                if (
                    (
                        window.WritingStorage &&
                        typeof window.WritingStorage.getGroups === "function"
                    ) ||
                    retryCount >= MAX_RETRIES
                ) {
                    window.clearInterval(retryTimer);
                }
            },
            200
        );
    }

    console.log(
        "[分组存储] 初始化成功。",
        {
            independentAPI: Boolean(
                window.WritingGroupsStorage
            ),

            writingStorage: Boolean(
                window.WritingStorage
            ),

            createGroup: typeof groupsAPI.createGroup,

            moveBookToGroup: typeof groupsAPI.moveBookToGroup,

            getGroupBooks: typeof groupsAPI.getGroupBooks
        }
    );

})();
