/* ======================================================
   分组数据存储模块
   文件：js/groups-storage.js

   功能：
   1. 创建分组
   2. 获取全部分组
   3. 获取单个分组
   4. 获取分组数量
   5. 检查分组 ID 和名称
   6. 修改分组名称及附加信息
   7. 删除分组
   8. 监听当前页面和其他页面的数据变化
   9. 兼容 WritingStorage
   10. 兼容旧版数组格式
   11. 防止外部直接修改内部数据
   12. 统一处理存储异常
   13. 支持重复加载
   14. 支持延迟连接 WritingStorage

   存储位置：localStorage
   存储键：writing-software-groups

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

    /*
     * 如果模块已经成功初始化，
     * 不再重复创建内部函数和事件监听器。
     *
     * 即使 WritingStorage 尚未连接，
     * 后续加载的脚本也可以尝试重新连接。
     */

    if (window[INITIALIZED_KEY]) {
        if (
            window.WritingGroupsStorage &&
            typeof window.WritingGroupsStorage.createGroup === "function"
        ) {
            attachExistingStorage();

            return;
        }

        /*
         * 如果初始化标记存在，但接口不存在，
         * 清除失效标记，允许重新初始化。
         */

        delete window[INITIALIZED_KEY];
    }


    /* ==================================================
       三、统一错误处理
    ================================================== */

    function createError(message, code) {
        const error = new Error(message);

        error.name = "WritingGroupsError";

        error.code = code || "GROUP_STORAGE_ERROR";

        return error;
    }


    /* ==================================================
       四、生成分组 ID
    ================================================== */

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


    /* ==================================================
       五、标准化分组名称
    ================================================== */

    function normalizeName(name) {
        if (name === null || name === undefined) {
            return "";
        }

        return String(name).trim();
    }


    /* ==================================================
       六、验证分组名称
    ================================================== */

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


    /* ==================================================
       七、比较分组名称
    ================================================== */

    function normalizeNameForComparison(name) {
        return normalizeName(name).toLocaleLowerCase();
    }


    function compareNames(nameA, nameB) {
        return (
            normalizeNameForComparison(nameA) ===
            normalizeNameForComparison(nameB)
        );
    }


    /* ==================================================
       八、检查普通对象
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


    /* ==================================================
       九、复制附加信息
    ================================================== */

    function cloneMetadata(metadata) {
        if (!isPlainObject(metadata)) {
            return {};
        }

        try {
            const serialized = JSON.stringify(metadata);

            if (serialized === undefined) {
                return {};
            }

            const cloned = JSON.parse(serialized);

            return isPlainObject(cloned)
                ? cloned
                : {};
        } catch (error) {
            return {};
        }
    }


    /* ==================================================
       十、标准化单个分组
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

        const now = new Date().toISOString();

        return {
            id: id,

            name: name,

            createdAt:
                typeof group.createdAt === "string" &&
                group.createdAt
                    ? group.createdAt
                    : now,

            updatedAt:
                typeof group.updatedAt === "string" &&
                group.updatedAt
                    ? group.updatedAt
                    : now,

            metadata: cloneMetadata(group.metadata)
        };
    }


    /* ==================================================
       十一、复制单个分组
    ================================================== */

    function cloneGroup(group) {
        return {
            id: group.id,

            name: group.name,

            createdAt: group.createdAt,

            updatedAt: group.updatedAt,

            metadata: cloneMetadata(group.metadata)
        };
    }


    /* ==================================================
       十二、复制全部分组
    ================================================== */

    function cloneGroups(groups) {
        return groups.map(function (group) {
            return cloneGroup(group);
        });
    }


    /* ==================================================
       十三、读取原始数据
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
       十四、标准化分组列表
    ================================================== */

    function normalizeGroups(groups) {
        if (!Array.isArray(groups)) {
            return [];
        }

        const result = [];

        const usedIds = new Set();

        const usedNames = new Set();

        groups.forEach(function (item) {
            const group = normalizeGroup(item);

            if (!group) {
                return;
            }

            const normalizedId = group.id;

            const normalizedName =
                normalizeNameForComparison(group.name);

            if (usedIds.has(normalizedId)) {
                return;
            }

            if (usedNames.has(normalizedName)) {
                return;
            }

            usedIds.add(normalizedId);

            usedNames.add(normalizedName);

            result.push(group);
        });

        return result;
    }


    /* ==================================================
       十五、读取分组数据库
    ================================================== */

    function readDatabase() {
        const raw = readRawData();

        /*
         * 尚未创建数据库。
         */

        if (raw === null || raw === "") {
            return {
                version: STORAGE_VERSION,

                updatedAt: new Date().toISOString(),

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

                updatedAt: new Date().toISOString(),

                groups: normalizeGroups(parsed)
            };
        }

        /*
         * 检查数据库结构。
         */

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
                    : new Date().toISOString(),

            groups: normalizeGroups(parsed.groups)
        };
    }


    /* ==================================================
       十六、通知数据变化
    ================================================== */

    function notifyChange(groups) {
        const detail = {
            groups: cloneGroups(groups),

            updatedAt: new Date().toISOString()
        };

        try {
            window.dispatchEvent(
                new CustomEvent(CHANGE_EVENT, {
                    detail: detail
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
       十七、保存分组数据库
    ================================================== */

    function writeDatabase(groups) {
        const normalizedGroups = normalizeGroups(groups);

        const database = {
            version: STORAGE_VERSION,

            updatedAt: new Date().toISOString(),

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

        /*
         * 保存数据。
         */

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

        /*
         * 保存成功后通知页面。
         */

        notifyChange(database.groups);

        return database;
    }


    /* ==================================================
       十八、获取全部分组
    ================================================== */

    function getGroups() {
        const database = readDatabase();

        return cloneGroups(database.groups);
    }


    /* ==================================================
       十九、获取单个分组
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

        const groups = getGroups();

        const group = groups.find(function (item) {
            return item.id === targetId;
        });

        return group
            ? cloneGroup(group)
            : null;
    }


    /* ==================================================
       二十、获取分组数量
    ================================================== */

    function getGroupCount() {
        return getGroups().length;
    }


    /* ==================================================
       二十一、检查分组 ID 是否存在
    ================================================== */

    function hasGroup(id) {
        return getGroup(id) !== null;
    }


    /* ==================================================
       二十二、检查分组名称是否重复
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

        const groups = getGroups();

        return groups.some(function (group) {
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
        });
    }


    /* ==================================================
       二十三、创建分组
    ================================================== */

    function createGroup(options) {
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

        const now = new Date().toISOString();

        const group = {
            id: createId(),

            name: name,

            createdAt: now,

            updatedAt: now,

            metadata: cloneMetadata(options.metadata)
        };

        database.groups.push(group);

        writeDatabase(database.groups);

        return cloneGroup(group);
    }


    /* ==================================================
       二十四、修改分组
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
         * 修改分组名称。
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
         * 合并附加信息。
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

        updatedGroup.updatedAt = new Date().toISOString();

        database.groups[index] = updatedGroup;

        writeDatabase(database.groups);

        return cloneGroup(updatedGroup);
    }


    /* ==================================================
       二十五、删除分组
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

        database.groups.splice(index, 1);

        writeDatabase(database.groups);

        return true;
    }


    /* ==================================================
       二十六、监听分组数据变化
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
                    "[分组存储] 读取更新后的分组失败：",
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

                updatedAt: new Date().toISOString()
            });
        }

        /*
         * 当前页面的数据变化。
         */

        window.addEventListener(
            CHANGE_EVENT,
            handleChange
        );

        /*
         * 其他标签页的数据变化。
         */

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

        /*
         * 返回取消监听函数。
         */

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
       二十七、公开独立分组接口
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

        onChange: onChange
    });

    window.WritingGroupsStorage = groupsAPI;


    /* ==================================================
       二十八、连接 WritingStorage
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
         * 只添加分组方法。
         * 不修改书籍存储方法。
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

            onGroupsChange: onChange
        };

        try {
            Object.keys(methods).forEach(function (methodName) {
                storage[methodName] = methods[methodName];
            });

            return true;
        } catch (error) {
            console.error(
                "[分组存储] 无法连接 WritingStorage：",
                error
            );

            return false;
        }
    }


    /* ==================================================
       二十九、连接已有接口
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
            "deleteGroup"
        ];

        try {
            methods.forEach(function (methodName) {
                if (typeof storage[methodName] === "function") {
                    writingStorage[methodName] = storage[methodName];
                }
            });

            if (typeof storage.onChange === "function") {
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
       三十、初始化
    ================================================== */

    /*
     * 标记初始化成功。
     */

    window[INITIALIZED_KEY] = true;

    /*
     * 首次尝试连接 WritingStorage。
     */

    attachToWritingStorage();

    /*
     * 如果 storage.js 尚未加载，
     * 页面加载完成后再次尝试连接。
     */

    if (!window.WritingStorage) {
        window.addEventListener(
            "load",
            function () {
                attachToWritingStorage();
            },
            { once: true }
        );
    }

    /*
     * 兼容其他脚本稍后创建 WritingStorage 的情况。
     * 仅在当前接口缺失时尝试连接。
     */

    if (
        !window.WritingStorage ||
        typeof window.WritingStorage.createGroup !== "function"
    ) {
        let retryCount = 0;

        const MAX_RETRIES = 10;

        const retryTimer = window.setInterval(
            function () {
                retryCount++;

                if (attachToWritingStorage()) {
                    window.clearInterval(retryTimer);

                    return;
                }

                if (retryCount >= MAX_RETRIES) {
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

            getGroups: typeof groupsAPI.getGroups
        }
    );


})();
