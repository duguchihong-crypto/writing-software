/* ======================================================
分组数据存储模块
文件：js/groups-storage.js

功能：

1. 创建分组
2. 获取分组
3. 修改分组
4. 删除分组
5. 检查重复名称
6. 通知分组数据变化

存储位置：
localStorage
writing-software-groups
====================================================== */

(function () {
“use strict”;

/* ==================================================
   一、基础配置
================================================== */
const STORAGE_KEY = "writing-software-groups";
const STORAGE_VERSION = 1;
const CHANGE_EVENT = "writing-groups-change";
/* ==================================================
   二、错误创建
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
    return "group-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 12);
}
/* ==================================================
   四、规范化分组数据
================================================== */
function normalizeGroup(group) {
    if (!group || typeof group !== "object") {
        return null;
    }
    const id = String(group.id || "").trim();
    const name = String(group.name || "").trim();
    if (!id || !name) {
        return null;
    }
    return {
        id: id,
        name: name.slice(0, 50),
        createdAt:
            typeof group.createdAt === "string"
                ? group.createdAt
                : new Date().toISOString(),
        updatedAt:
            typeof group.updatedAt === "string"
                ? group.updatedAt
                : new Date().toISOString(),
        metadata:
            group.metadata &&
            typeof group.metadata === "object" &&
            !Array.isArray(group.metadata)
                ? group.metadata
                : {}
    };
}
/* ==================================================
   五、读取分组数据库
================================================== */
function readDatabase() {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        throw createError(
            "无法读取分组数据，请检查浏览器的存储权限。",
            "GROUP_STORAGE_UNAVAILABLE"
        );
    }
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
            "分组数据无法解析，请检查本地存储数据。",
            "GROUP_INVALID_DATABASE"
        );
    }
    /*
     * 兼容直接保存为数组的旧格式。
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
    if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(parsed.groups)
    ) {
        throw createError(
            "分组数据格式不正确。",
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
   六、写入分组数据库
================================================== */
function writeDatabase(groups) {
    const database = {
        version: STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        groups: groups
    };
    let serialized;
    try {
        serialized = JSON.stringify(database);
    } catch (error) {
        throw createError(
            "分组数据无法保存。",
            "GROUP_SERIALIZE_FAILED"
        );
    }
    try {
        localStorage.setItem(STORAGE_KEY, serialized);
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
    notifyChange(groups);
    return database;
}
/* ==================================================
   七、通知数据变化
================================================== */
function notifyChange(groups) {
    const detail = {
        groups: groups.map(function (group) {
            return Object.assign({}, group);
        }),
        updatedAt: new Date().toISOString()
    };
    /*
     * 通知当前页面。
     */
    try {
        window.dispatchEvent(
            new CustomEvent(CHANGE_EVENT, {
                detail: detail
            })
        );
    } catch (error) {
        console.warn("无法发送分组变化通知：", error);
    }
    /*
     * 通知同源的其他浏览器页面。
     * localStorage 的 storage 事件会在其他页面触发。
     */
}
/* ==================================================
   八、获取全部分组
================================================== */
function getGroups() {
    const database = readDatabase();
    return database.groups.map(function (group) {
        return Object.assign({}, group);
    });
}
/* ==================================================
   九、获取单个分组
================================================== */
function getGroup(id) {
    if (!id) {
        return null;
    }
    const database = readDatabase();
    const group = database.groups.find(function (item) {
        return item.id === String(id);
    });
    return group
        ? Object.assign({}, group)
        : null;
}
/* ==================================================
   十、获取分组数量
================================================== */
function getGroupCount() {
    return getGroups().length;
}
/* ==================================================
   十一、检查分组名称是否重复
================================================== */
function hasGroupName(name, excludeId) {
    const normalizedName = String(name || "")
        .trim()
        .toLocaleLowerCase();
    if (!normalizedName) {
        return false;
    }
    return getGroups().some(function (group) {
        if (excludeId && group.id === excludeId) {
            return false;
        }
        return group.name
            .trim()
            .toLocaleLowerCase() === normalizedName;
    });
}
/* ==================================================
   十二、创建分组
================================================== */
function createGroup(options) {
    options = options || {};
    const name = String(options.name || "").trim();
    if (!name) {
        throw createError(
            "请输入分组名称。",
            "GROUP_NAME_REQUIRED"
        );
    }
    if (name.length > 50) {
        throw createError(
            "分组名称不能超过 50 个字符。",
            "GROUP_NAME_TOO_LONG"
        );
    }
    const database = readDatabase();
    const duplicated = database.groups.some(function (group) {
        return group.name
            .trim()
            .toLocaleLowerCase() === name.toLocaleLowerCase();
    });
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
        metadata: {}
    };
    database.groups.push(group);
    writeDatabase(database.groups);
    return Object.assign({}, group);
}
/* ==================================================
   十三、修改分组
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
    const index = database.groups.findIndex(function (group) {
        return group.id === String(id);
    });
    if (index === -1) {
        return null;
    }
    const oldGroup = database.groups[index];
    const updatedGroup = Object.assign({}, oldGroup);
    if (
        Object.prototype.hasOwnProperty.call(changes, "name")
    ) {
        const name = String(changes.name || "").trim();
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
        const duplicated = database.groups.some(function (group) {
            return group.id !== String(id) &&
                group.name
                    .trim()
                    .toLocaleLowerCase() === name.toLocaleLowerCase();
        });
        if (duplicated) {
            throw createError(
                "已经存在同名分组，请换一个名称。",
                "GROUP_NAME_DUPLICATE"
            );
        }
        updatedGroup.name = name;
    }
    if (
        Object.prototype.hasOwnProperty.call(changes, "metadata") &&
        changes.metadata &&
        typeof changes.metadata === "object" &&
        !Array.isArray(changes.metadata)
    ) {
        updatedGroup.metadata = Object.assign(
            {},
            oldGroup.metadata,
            changes.metadata
        );
    }
    updatedGroup.updatedAt = new Date().toISOString();
    database.groups[index] = updatedGroup;
    writeDatabase(database.groups);
    return Object.assign({}, updatedGroup);
}
/* ==================================================
   十四、删除分组
================================================== */
function deleteGroup(id) {
    if (!id) {
        return false;
    }
    const database = readDatabase();
    const index = database.groups.findIndex(function (group) {
        return group.id === String(id);
    });
    if (index === -1) {
        return false;
    }
    database.groups.splice(index, 1);
    writeDatabase(database.groups);
    return true;
}
/* ==================================================
   十五、监听分组变化
================================================== */
function onChange(callback) {
    if (typeof callback !== "function") {
        return function () {};
    }
    function handleChange(event) {
        callback({
            groups: getGroups(),
            external: Boolean(
                event &&
                event.type === "storage"
            )
        });
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    function handleStorage(event) {
        if (event.key !== STORAGE_KEY) {
            return;
        }
        handleChange({
            type: "storage"
        });
    }
    window.addEventListener("storage", handleStorage);
    /*
     * 返回取消监听的方法。
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
   十六、公开接口
================================================== */
window.WritingGroupsStorage = {
    getGroups: getGroups,
    getGroup: getGroup,
    getGroupCount: getGroupCount,
    hasGroupName: hasGroupName,
    createGroup: createGroup,
    updateGroup: updateGroup,
    deleteGroup: deleteGroup,
    onChange: onChange
};
/* ==================================================
   十七、兼容新建分组页面
================================================== */
/*
 * create-group.js 当前通过 WritingStorage.createGroup()
 * 和 WritingStorage.getGroups() 调用分组接口。
 *
 * 因此将分组接口挂接到现有 WritingStorage 对象。
 * 不覆盖原有的书籍、封面及其他存储方法。
 */
function attachToWritingStorage() {
    if (!window.WritingStorage) {
        return false;
    }
    window.WritingStorage.getGroups = getGroups;
    window.WritingStorage.getGroup = getGroup;
    window.WritingStorage.getGroupCount = getGroupCount;
    window.WritingStorage.hasGroupName = hasGroupName;
    window.WritingStorage.createGroup = createGroup;
    window.WritingStorage.updateGroup = updateGroup;
    window.WritingStorage.deleteGroup = deleteGroup;
    return true;
}
if (!attachToWritingStorage()) {
    console.error(
        "分组存储模块未能连接到 WritingStorage。请检查脚本加载顺序。"
    );
}

})();
