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

    const INITIALIZED_KEY = "__writingGroupsStorageInitialized";


    /* ==================================================
       二、防止重复初始化
    ================================================== */

    if (window[INITIALIZED_KEY]) {
        return;
    }

    window[INITIALIZED_KEY] = true;


    /* ==================================================
       三、创建统一错误
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
       六、检查分组名称
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

       比较前去除首尾空格。
       比较时不区分大小写。
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

       metadata 用于保存分组的扩展信息。
       不允许非普通对象直接进入存储。
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

            /*
             * 跳过重复 ID。
             */

            if (usedIds.has(normalizedId)) {
                return;
            }

            /*
             * 跳过重复名称。
             */

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
         * 尚未创建分组数据库。
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
         *
         * 旧格式：
         * [
         *     {
         *         id: "...",
         *         name: "..."
         *     }
         * ]
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
                "分组数据变化通知失败：",
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
         * 先保存。
         * 只有保存成功后，才通知页面。
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

        /*
         * 验证分组名称。
         */

        const name = validateName(options.name);

        /*
         * 读取现有数据库。
         */

        const database = readDatabase();

        /*
         * 检查名称是否重复。
         */

        const duplicated = database.groups.some(
            function (group) {
                return compareNames(
                    group.name,
                    name
                );
            }
        );

        if (duplicated) {
            throw createError(
                "已经存在同名分组，请换一个名称。",
                "GROUP_NAME_DUPLICATE"
            );
        }

        /*
         * 创建新分组。
         */

        const now = new Date().toISOString();

        const group = {
            id: createId(),

            name: name,

            createdAt: now,

            updatedAt: now,

            metadata: cloneMetadata(options.metadata)
        };

        /*
         * 写入数据库。
         */

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

        /*
         * 分组不存在时返回 null。
         */

        if (index === -1) {
            return null;
        }

        const updatedGroup = cloneGroup(
            database.groups[index]
        );


        /* ----------------------------------------------
           修改分组名称
        ---------------------------------------------- */

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
                        compareNames(
                            group.name,
                            name
                        )
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


        /* ----------------------------------------------
           合并附加信息
        ---------------------------------------------- */

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


        /* ----------------------------------------------
           更新时间
        ---------------------------------------------- */

        updatedGroup.updatedAt = new Date().toISOString();

        database.groups[index] = updatedGroup;

        /*
         * 保存修改后的数据库。
         */

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

        /*
         * 分组不存在时，不执行保存。
         */

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

        /*
         * 处理当前页面的自定义事件。
         */

        function handleChange(event) {
            let groups;

            try {
                /*
                 * 从最新数据库读取数据，
                 * 不直接使用事件中可能过时的数据。
                 */

                groups = getGroups();
            } catch (error) {
                console.error(
                    "读取更新后的分组失败：",
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
       二十七、公开分组存储接口
    ================================================== */

    const groupsAPI = {
        getGroups: getGroups,

        getGroup: getGroup,

        getGroupCount: getGroupCount,

        hasGroup: hasGroup,

        hasGroupName: hasGroupName,

        createGroup: createGroup,

        updateGroup: updateGroup,

        deleteGroup: deleteGroup,

        onChange: onChange
    };


    /*
     * 独立分组接口。
     */

    window.WritingGroupsStorage = groupsAPI;


    /* ==================================================
       二十八、兼容 WritingStorage
    ================================================== */

    function attachToWritingStorage() {
        if (!window.WritingStorage) {
            console.error(
                "分组存储模块无法连接 WritingStorage。" +
                "请确保 storage.js 在 groups-storage.js 之前加载。"
            );

            return false;
        }

        /*
         * 只添加分组相关方法。
         * 不覆盖原有书籍存储方法。
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

        Object.keys(methods).forEach(function (methodName) {
            window.WritingStorage[methodName] =
                methods[methodName];
        });

        return true;
    }


    /* ==================================================
       二十九、初始化
    ================================================== */

    attachToWritingStorage();


})();
