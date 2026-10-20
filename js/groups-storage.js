/* ======================================================
   分组数据存储模块
   文件：js/groups-storage.js

   功能：
   1. 创建分组
   2. 获取全部分组
   3. 获取单个分组
   4. 获取分组数量
   5. 检查分组名称是否重复
   6. 修改分组名称及信息
   7. 删除分组
   8. 监听分组数据变化
   9. 兼容 WritingStorage 调用方式

   存储位置：
   localStorage

   存储键：
   writing-software-groups
====================================================== */

(function () {
    "use strict";

    /* ==================================================
       一、基础配置
    ================================================== */

    const STORAGE_KEY = "writing-software-groups";

    const STORAGE_VERSION = 1;

    const CHANGE_EVENT = "writing-groups-change";


    /* ==================================================
       二、创建统一错误
    ================================================== */

    function createError(message, code) {
        const error = new Error(message);

        error.code = code || "GROUP_STORAGE_ERROR";

        return error;
    }


    /* ==================================================
       三、生成分组 ID
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
            Math.random().toString(36).slice(2, 12)
        );
    }


    /* ==================================================
       四、标准化分组名称
    ================================================== */

    function normalizeName(name) {
        return String(name == null ? "" : name).trim();
    }


    /* ==================================================
       五、比较分组名称
    ================================================== */

    function compareNames(nameA, nameB) {
        return normalizeName(nameA).toLocaleLowerCase() ===
            normalizeName(nameB).toLocaleLowerCase();
    }


    /* ==================================================
       六、标准化分组数据
    ================================================== */

    function normalizeGroup(group) {
        if (!group || typeof group !== "object") {
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

            name: name.slice(0, 50),

            createdAt:
                typeof group.createdAt === "string"
                    ? group.createdAt
                    : now,

            updatedAt:
                typeof group.updatedAt === "string"
                    ? group.updatedAt
                    : now,

            metadata:
                group.metadata &&
                typeof group.metadata === "object" &&
                !Array.isArray(group.metadata)
                    ? Object.assign({}, group.metadata)
                    : {}
        };
    }


    /* ==================================================
       七、复制分组数据
    ================================================== */

    function cloneGroup(group) {
        return {
            id: group.id,

            name: group.name,

            createdAt: group.createdAt,

            updatedAt: group.updatedAt,

            metadata: Object.assign({}, group.metadata || {})
        };
    }


    function cloneGroups(groups) {
        return groups.map(function (group) {
            return cloneGroup(group);
        });
    }


    /* ==================================================
       八、读取分组数据库
    ================================================== */

    function readDatabase() {
        let raw;

        try {
            raw = window.localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            throw createError(
                "无法读取分组数据，请检查浏览器存储权限。",
                "GROUP_STORAGE_UNAVAILABLE"
            );
        }

        /*
         * 尚无分组数据时，返回空数据库。
         */

        if (!raw) {
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

                groups: parsed
                    .map(normalizeGroup)
                    .filter(Boolean)
            };
        }

        /*
         * 检查数据库结构。
         */

        if (
            !parsed ||
            typeof parsed !== "object" ||
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

            groups: parsed.groups
                .map(normalizeGroup)
                .filter(Boolean)
        };
    }


    /* ==================================================
       九、通知分组数据变化
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
       十、保存分组数据库
    ================================================== */

    function writeDatabase(groups) {
        const database = {
            version: STORAGE_VERSION,

            updatedAt: new Date().toISOString(),

            groups: cloneGroups(groups)
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

        /*
         * 保存成功后再通知页面。
         */

        notifyChange(database.groups);

        return database;
    }


    /* ==================================================
       十一、获取全部分组
    ================================================== */

    function getGroups() {
        const database = readDatabase();

        return cloneGroups(database.groups);
    }


    /* ==================================================
       十二、获取单个分组
    ================================================== */

    function getGroup(id) {
        if (!id) {
            return null;
        }

        const database = readDatabase();

        const group = database.groups.find(function (item) {
            return item.id === String(id);
        });

        return group ? cloneGroup(group) : null;
    }


    /* ==================================================
       十三、获取分组数量
    ================================================== */

    function getGroupCount() {
        return getGroups().length;
    }


    /* ==================================================
       十四、检查分组是否存在
    ================================================== */

    function hasGroup(id) {
        if (!id) {
            return false;
        }

        return getGroup(id) !== null;
    }


    /* ==================================================
       十五、检查分组名称是否重复
    ================================================== */

    function hasGroupName(name, excludeId) {
        const normalizedName = normalizeName(name);

        if (!normalizedName) {
            return false;
        }

        const groups = getGroups();

        return groups.some(function (group) {
            if (
                excludeId &&
                group.id === String(excludeId)
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
       十六、创建分组
    ================================================== */

    function createGroup(options) {
        options = options || {};

        const name = normalizeName(options.name);

        /*
         * 检查名称是否为空。
         */

        if (!name) {
            throw createError(
                "请输入分组名称。",
                "GROUP_NAME_REQUIRED"
            );
        }

        /*
         * 检查名称长度。
         */

        if (name.length > 50) {
            throw createError(
                "分组名称不能超过 50 个字符。",
                "GROUP_NAME_TOO_LONG"
            );
        }

        const database = readDatabase();

        /*
         * 检查重名。
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

            metadata:
                options.metadata &&
                typeof options.metadata === "object" &&
                !Array.isArray(options.metadata)
                    ? Object.assign({}, options.metadata)
                    : {}
        };

        /*
         * 保存。
         */

        database.groups.push(group);

        writeDatabase(database.groups);

        return cloneGroup(group);
    }


    /* ==================================================
       十七、修改分组
    ================================================== */

    function updateGroup(id, changes) {
        if (!id) {
            throw createError(
                "缺少分组 ID。",
                "GROUP_ID_REQUIRED"
            );
        }

        changes = changes || {};

        const database = readDatabase();

        const index = database.groups.findIndex(
            function (group) {
                return group.id === String(id);
            }
        );

        if (index === -1) {
            return null;
        }

        const oldGroup = database.groups[index];

        const updatedGroup = cloneGroup(oldGroup);


        /*
         * 修改分组名称。
         */

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "name"
            )
        ) {
            const name = normalizeName(changes.name);

            if (!name) {
                throw createError(
                    "分组名称不能为空。",
                    "GROUP_NAME_REQUIRED"
                );
            }

            if (name.length > 50) {
                throw createError(
                    "分组名称不能超过 50 个字符。",
                    "GROUP_NAME_TOO_LONG"
                );
            }

            const duplicated = database.groups.some(
                function (group) {
                    return (
                        group.id !== String(id) &&
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
         * 修改分组附加信息。
         */

        if (
            Object.prototype.hasOwnProperty.call(
                changes,
                "metadata"
            ) &&
            changes.metadata &&
            typeof changes.metadata === "object" &&
            !Array.isArray(changes.metadata)
        ) {
            updatedGroup.metadata = Object.assign(
                {},
                updatedGroup.metadata,
                changes.metadata
            );
        }


        /*
         * 更新时间。
         */

        updatedGroup.updatedAt = new Date().toISOString();

        database.groups[index] = updatedGroup;

        writeDatabase(database.groups);

        return cloneGroup(updatedGroup);
    }


    /* ==================================================
       十八、删除分组
    ================================================== */

    function deleteGroup(id) {
        if (!id) {
            return false;
        }

        const database = readDatabase();

        const index = database.groups.findIndex(
            function (group) {
                return group.id === String(id);
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
       十九、监听分组数据变化
    ================================================== */

    function onChange(callback) {
        if (typeof callback !== "function") {
            return function () {};
        }

        /*
         * 当前页面的数据变化。
         */

        function handleChange(event) {
            let groups;

            try {
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
                )
            });
        }

        window.addEventListener(
            CHANGE_EVENT,
            handleChange
        );

        /*
         * 同源其他页面的数据变化。
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
       二十、公开分组存储接口
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
       二十一、兼容现有 WritingStorage
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
         * 只添加分组接口。
         * 不替换现有书籍存储方法。
         */

        window.WritingStorage.getGroups = getGroups;

        window.WritingStorage.getGroup = getGroup;

        window.WritingStorage.getGroupCount = getGroupCount;

        window.WritingStorage.hasGroup = hasGroup;

        window.WritingStorage.hasGroupName = hasGroupName;

        window.WritingStorage.createGroup = createGroup;

        window.WritingStorage.updateGroup = updateGroup;

        window.WritingStorage.deleteGroup = deleteGroup;

        window.WritingStorage.onGroupsChange = onChange;

        return true;
    }


    /* ==================================================
       二十二、初始化
    ================================================== */

    attachToWritingStorage();


})();
