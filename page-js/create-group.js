/* ======================================================
新建分组页面逻辑
文件：page-js/create-group.js

功能：

1. 分组名称验证
2. 实时字数统计
3. 创建分组
4. 取消创建
5. 离开页面前提示未保存内容
    ====================================================== */

(function () {
“use strict”;

/* ==================================================
   一、获取页面元素
================================================== */
const form = document.getElementById("create-group-form");
const nameInput = document.getElementById("group-name");
const nameCounter = document.getElementById("group-name-counter");
const nameError = document.getElementById("group-name-error");
const message = document.getElementById("create-group-message");
const submitButton = document.getElementById("create-group-submit");
const cancelButton = document.getElementById("cancel-create-group");
const cancelTopButton = document.getElementById("cancel-create-group-top");
if (!form || !nameInput || !submitButton) {
    console.error("新建分组页面初始化失败：缺少必要的 HTML 元素。");
    return;
}
/* ==================================================
   二、页面状态
================================================== */
let isSubmitting = false;
let isSaved = false;
let originalName = nameInput.value;
/* ==================================================
   三、消息处理
================================================== */
function showMessage(text, type) {
    if (!message) {
        return;
    }
    message.textContent = text;
    message.className = "create-group-message";
    if (type === "success") {
        message.classList.add("create-group-message--success");
    }
    if (type === "error") {
        message.classList.add("create-group-message--error");
    }
    message.hidden = false;
}
function hideMessage() {
    if (!message) {
        return;
    }
    message.hidden = true;
    message.textContent = "";
    message.className = "create-group-message";
}
/* ==================================================
   四、错误处理
================================================== */
function showNameError(text) {
    if (nameError) {
        nameError.textContent = text;
        nameError.hidden = false;
    }
    nameInput.setAttribute("aria-invalid", "true");
}
function clearNameError() {
    if (nameError) {
        nameError.textContent = "";
        nameError.hidden = true;
    }
    nameInput.removeAttribute("aria-invalid");
}
/* ==================================================
   五、字数统计
================================================== */
function updateNameCounter() {
    if (!nameCounter) {
        return;
    }
    const length = nameInput.value.length;
    const maxLength = Number(nameInput.maxLength) || 50;
    nameCounter.textContent = length + " / " + maxLength;
}
/* ==================================================
   六、名称验证
================================================== */
function validateName() {
    const name = nameInput.value.trim();
    clearNameError();
    if (!name) {
        showNameError("请输入分组名称。");
        return false;
    }
    if (name.length > 50) {
        showNameError("分组名称不能超过 50 个字符。");
        return false;
    }
    return true;
}
/* ==================================================
   七、按钮状态
================================================== */
function setSubmitting(submitting) {
    isSubmitting = submitting;
    submitButton.disabled = submitting;
    if (cancelButton) {
        cancelButton.disabled = submitting;
    }
    if (cancelTopButton) {
        cancelTopButton.disabled = submitting;
    }
    submitButton.textContent = submitting
        ? "正在创建……"
        : "创建分组";
}
/* ==================================================
   八、检查存储模块
================================================== */
function getStorage() {
    if (!window.WritingStorage) {
        showMessage(
            "存储模块尚未加载，请刷新页面后重试。",
            "error"
        );
        return null;
    }
    if (typeof window.WritingStorage.createGroup !== "function") {
        showMessage(
            "分组保存功能尚未接入。请完成公共存储模块的分组功能后再试。",
            "error"
        );
        return null;
    }
    return window.WritingStorage;
}
/* ==================================================
   九、检查重复名称
================================================== */
function hasDuplicateName(storage, name) {
    if (typeof storage.getGroups !== "function") {
        return false;
    }
    const groups = storage.getGroups();
    return groups.some(function (group) {
        return String(group.name || "").trim().toLocaleLowerCase()
            === name.toLocaleLowerCase();
    });
}
/* ==================================================
   十、创建分组
================================================== */
function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || isSaved) {
        return;
    }
    hideMessage();
    if (!validateName()) {
        nameInput.focus();
        return;
    }
    const name = nameInput.value.trim();
    const storage = getStorage();
    if (!storage) {
        return;
    }
    if (hasDuplicateName(storage, name)) {
        showNameError("已经存在同名分组，请换一个名称。");
        nameInput.focus();
        return;
    }
    setSubmitting(true);
    try {
        const group = storage.createGroup({
            name: name
        });
        if (!group || !group.id) {
            throw new Error("分组创建失败，请稍后重试。");
        }
        isSaved = true;
        showMessage("分组创建成功！正在返回上一页……", "success");
        window.setTimeout(function () {
            if (window.WritingNavigation) {
                window.WritingNavigation.navigate("create");
            } else {
                window.location.href = "./create.html";
            }
        }, 500);
    } catch (error) {
        console.error("创建分组失败：", error);
        setSubmitting(false);
        showMessage(
            error && error.message
                ? error.message
                : "创建分组失败，请检查存储空间后重试。",
            "error"
        );
    }
}
/* ==================================================
   十一、取消创建
================================================== */
function handleCancel() {
    if (isSubmitting) {
        return;
    }
    const hasChanged = nameInput.value.trim() !== originalName.trim();
    if (hasChanged && !isSaved) {
        const confirmed = window.confirm(
            "分组名称尚未保存，确定放弃本次创建吗？"
        );
        if (!confirmed) {
            return;
        }
    }
    if (window.WritingNavigation) {
        window.WritingNavigation.navigate("create");
    } else {
        window.location.href = "./create.html";
    }
}
/* ==================================================
   十二、绑定事件
================================================== */
nameInput.addEventListener("input", function () {
    updateNameCounter();
    clearNameError();
    hideMessage();
});
nameInput.addEventListener("blur", function () {
    if (nameInput.value.trim()) {
        validateName();
    }
});
form.addEventListener("submit", handleSubmit);
if (cancelButton) {
    cancelButton.addEventListener("click", handleCancel);
}
if (cancelTopButton) {
    cancelTopButton.addEventListener("click", handleCancel);
}
/* ==================================================
   十三、初始化
================================================== */
updateNameCounter();
clearNameError();
originalName = nameInput.value;

})();
