/* ======================================================
写作软件 · 新建书籍
文件：page-js/create-book.js

功能：

1. 输入书名
2. 选择、预览、更换、移除封面
3. 自动压缩图片
4. 验证书名与图片
5. 通过 WritingStorage 创建书籍
6. 防止重复提交
7. 取消时确认放弃
8. 顶部返回、底部取消均返回新建页面
9. 创建成功后返回书架

注意：
本模块不直接操作 localStorage。
所有书籍数据统一交给 WritingStorage 管理。
====================================================== */

(function () {
“use strict”;

/* ==================================================
   一、配置
================================================== */
var MAX_TITLE_LENGTH = 100;
var MAX_IMAGE_SIZE = 10 * 1024 * 1024;
var MAX_IMAGE_DIMENSION = 1200;
var IMAGE_QUALITY = 0.82;
/* ==================================================
   二、页面元素
================================================== */
var elements = {
    form: document.getElementById("create-book-form"),
    title: document.getElementById("book-title"),
    titleCounter: document.getElementById("book-title-counter"),
    titleError: document.getElementById("book-title-error"),
    coverInput: document.getElementById("book-cover-input"),
    coverPlaceholder: document.getElementById("cover-placeholder"),
    coverPreviewImage: document.getElementById("cover-preview-image"),
    coverSelectLabel: document.getElementById("cover-select-label"),
    removeCoverButton: document.getElementById("remove-cover-button"),
    coverError: document.getElementById("cover-error"),
    message: document.getElementById("create-book-message"),
    submitButton: document.getElementById("create-book-submit"),
    cancelButton: document.getElementById("cancel-create-book"),
    cancelTopButton: document.getElementById("cancel-create-book-top")
};
/* ==================================================
   三、运行状态
================================================== */
var selectedCoverData = "";
var isSubmitting = false;
var isProcessingImage = false;
var imageSelectionToken = 0;
/* 保存创建按钮原始内容，避免更新状态时丢失图标 */
var submitButtonOriginalHTML = elements.submitButton
    ? elements.submitButton.innerHTML
    : "";
/* ==================================================
   四、检查页面结构
================================================== */
function validatePageElements() {
    return Boolean(
        elements.form &&
        elements.title &&
        elements.coverInput &&
        elements.submitButton
    );
}
if (!validatePageElements()) {
    console.error(
        "[WritingCreateBook] 页面缺少必要元素，初始化终止。"
    );
    return;
}
/* ==================================================
   五、提示信息
================================================== */
function showMessage(message, type) {
    if (!elements.message) {
        return;
    }
    elements.message.textContent = message;
    elements.message.classList.remove(
        "is-success",
        "is-error",
        "is-info"
    );
    if (type === "success") {
        elements.message.classList.add("is-success");
    } else if (type === "error") {
        elements.message.classList.add("is-error");
    } else {
        elements.message.classList.add("is-info");
    }
    elements.message.hidden = false;
}
function hideMessage() {
    if (!elements.message) {
        return;
    }
    elements.message.textContent = "";
    elements.message.hidden = true;
    elements.message.classList.remove(
        "is-success",
        "is-error",
        "is-info"
    );
}
/* ==================================================
   六、书名验证
================================================== */
function getTitleValue() {
    return elements.title.value.trim();
}
function setTitleError(message) {
    if (elements.titleError) {
        elements.titleError.textContent = message;
        elements.titleError.hidden = !message;
    }
    elements.title.setAttribute(
        "aria-invalid",
        message ? "true" : "false"
    );
}
function validateTitle() {
    var title = getTitleValue();
    if (!title) {
        setTitleError("请输入书名。");
        return false;
    }
    if (title.length > MAX_TITLE_LENGTH) {
        setTitleError(
            "书名不能超过 " + MAX_TITLE_LENGTH + " 个字符。"
        );
        return false;
    }
    setTitleError("");
    return true;
}
function updateTitleCounter() {
    if (!elements.titleCounter) {
        return;
    }
    elements.titleCounter.textContent =
        elements.title.value.length +
        " / " +
        MAX_TITLE_LENGTH;
}
/* ==================================================
   七、封面错误提示
================================================== */
function setCoverError(message) {
    if (elements.coverError) {
        elements.coverError.textContent = message;
        elements.coverError.hidden = !message;
    }
    elements.coverInput.setAttribute(
        "aria-invalid",
        message ? "true" : "false"
    );
}
function clearCoverError() {
    setCoverError("");
}
/* ==================================================
   八、封面预览
================================================== */
function updateCoverPreview() {
    var hasCover = Boolean(selectedCoverData);
    if (elements.coverPreviewImage) {
        if (hasCover) {
            elements.coverPreviewImage.src = selectedCoverData;
            elements.coverPreviewImage.hidden = false;
        } else {
            elements.coverPreviewImage.removeAttribute("src");
            elements.coverPreviewImage.hidden = true;
        }
    }
    if (elements.coverPlaceholder) {
        elements.coverPlaceholder.hidden = hasCover;
    }
    if (elements.removeCoverButton) {
        elements.removeCoverButton.hidden = !hasCover;
    }
    if (elements.coverSelectLabel) {
        elements.coverSelectLabel.textContent =
            hasCover ? "更换封面" : "选择封面";
    }
}
/* ==================================================
   九、移除封面
================================================== */
function clearCoverPreview() {
    imageSelectionToken += 1;
    selectedCoverData = "";
    elements.coverInput.value = "";
    isProcessingImage = false;
    clearCoverError();
    updateCoverPreview();
    updateSubmitButton();
}
/* ==================================================
   十、读取图片
================================================== */
function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
        var objectUrl = URL.createObjectURL(file);
        var image = new Image();
        var completed = false;
        function cleanup() {
            if (completed) {
                return;
            }
            completed = true;
            URL.revokeObjectURL(objectUrl);
        }
        image.onload = function () {
            cleanup();
            resolve(image);
        };
        image.onerror = function () {
            cleanup();
            reject(
                new Error(
                    "无法读取这张图片，请换一张常见格式的图片。"
                )
            );
        };
        image.src = objectUrl;
    });
}
/* ==================================================
   十一、压缩图片
================================================== */
async function compressImage(file) {
    var image = await loadImageFromFile(file);
    var originalWidth = image.naturalWidth;
    var originalHeight = image.naturalHeight;
    if (!originalWidth || !originalHeight) {
        throw new Error("图片尺寸无效，请重新选择。");
    }
    var scale = Math.min(
        1,
        MAX_IMAGE_DIMENSION /
            Math.max(originalWidth, originalHeight)
    );
    var width = Math.max(
        1,
        Math.round(originalWidth * scale)
    );
    var height = Math.max(
        1,
        Math.round(originalHeight * scale)
    );
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext("2d");
    if (!context) {
        throw new Error("图片处理失败，请重新尝试。");
    }
    /*
     * JPEG 不支持透明背景。
     * 将透明区域处理为白色，避免封面背景变黑。
     */
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(
        image,
        0,
        0,
        width,
        height
    );
    var dataUrl;
    try {
        dataUrl = canvas.toDataURL(
            "image/jpeg",
            IMAGE_QUALITY
        );
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
    if (
        dataUrl.indexOf("data:image/jpeg;base64,") !== 0
    ) {
        throw new Error("图片压缩失败，请重新选择。");
    }
    return dataUrl;
}
/* ==================================================
   十二、选择封面
================================================== */
async function handleCoverSelection() {
    clearCoverError();
    hideMessage();
    var file =
        elements.coverInput.files &&
        elements.coverInput.files[0];
    if (!file) {
        return;
    }
    var currentToken = ++imageSelectionToken;
    if (
        !file.type ||
        file.type.indexOf("image/") !== 0
    ) {
        elements.coverInput.value = "";
        setCoverError("请选择图片文件。");
        return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
        elements.coverInput.value = "";
        setCoverError(
            "图片不能超过 10 MB，请选择较小的图片。"
        );
        return;
    }
    isProcessingImage = true;
    updateSubmitButton();
    showMessage("正在处理封面，请稍候……", "info");
    try {
        var compressedData = await compressImage(file);
        /*
         * 如果用户在处理过程中重新选择或移除了封面，
         * 忽略已经过期的图片处理结果。
         */
        if (currentToken !== imageSelectionToken) {
            return;
        }
        selectedCoverData = compressedData;
        updateCoverPreview();
        hideMessage();
    } catch (error) {
        if (currentToken !== imageSelectionToken) {
            return;
        }
        console.error(
            "[WritingCreateBook] 封面处理失败：",
            error
        );
        elements.coverInput.value = "";
        setCoverError(
            error && error.message
                ? error.message
                : "封面处理失败，请重新选择图片。"
        );
        hideMessage();
    } finally {
        if (currentToken === imageSelectionToken) {
            isProcessingImage = false;
            updateSubmitButton();
        }
    }
}
/* ==================================================
   十三、提交按钮状态
================================================== */
function updateSubmitButton() {
    if (!elements.submitButton) {
        return;
    }
    elements.submitButton.disabled =
        isSubmitting || isProcessingImage;
    /*
     * 使用 textContent 会删除原按钮中的图标和其他 HTML。
     * 这里保留原始内容，恢复时不破坏页面结构。
     */
    if (isSubmitting) {
        elements.submitButton.textContent = "正在创建……";
    } else if (isProcessingImage) {
        elements.submitButton.textContent = "正在处理封面……";
    } else {
        elements.submitButton.innerHTML =
            submitButtonOriginalHTML || "创建书籍";
    }
}
/* ==================================================
   十四、获取存储接口
================================================== */
function getStorage() {
    var storage = window.WritingStorage;
    if (!storage) {
        throw new Error(
            "找不到 WritingStorage 存储模块。请检查 storage.js 是否加载成功。"
        );
    }
    if (typeof storage.createBook !== "function") {
        throw new Error(
            "存储模块没有提供 createBook() 方法。请核对 storage.js 的实际接口。"
        );
    }
    return storage;
}
/* ==================================================
   十五、创建书籍
================================================== */
function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || isProcessingImage) {
        return;
    }
    hideMessage();
    if (!validateTitle()) {
        elements.title.focus();
        return;
    }
    var storage;
    try {
        storage = getStorage();
    } catch (error) {
        console.error(
            "[WritingCreateBook] 存储接口检查失败：",
            error
        );
        showMessage(error.message, "error");
        return;
    }
    isSubmitting = true;
    updateSubmitButton();
    try {
        var book = storage.createBook({
            title: getTitleValue(),
            description: "",
            cover: selectedCoverData
        });
        if (!book || !book.id) {
            throw new Error(
                "存储模块没有返回有效的书籍数据，无法确认创建结果。"
            );
        }
        showMessage(
            "《" +
                (book.title || getTitleValue()) +
                "》创建成功！正在返回书架……",
            "success"
        );
        window.setTimeout(function () {
            /*
             * 创建成功后仍然返回书架，
             * 保留原来的项目导航逻辑。
             */
            if (
                window.WritingNavigation &&
                typeof window.WritingNavigation.goHome === "function"
            ) {
                window.WritingNavigation.goHome();
                return;
            }
            window.location.href = "../index.html";
        }, 500);
    } catch (error) {
        console.error(
            "[WritingCreateBook] 创建失败：",
            error
        );
        var message =
            error && error.message
                ? error.message
                : "创建失败，请重试。";
        if (error && error.code === "STORAGE_FULL") {
            message =
                "浏览器存储空间不足，请移除封面或更换较小的图片后重试。";
        } else if (
            error &&
            error.code === "STORAGE_UNAVAILABLE"
        ) {
            message =
                "当前浏览器无法使用本地存储，请检查浏览器设置。";
        } else if (
            error &&
            error.code === "TITLE_REQUIRED"
        ) {
            message = "请输入书名。";
        } else if (
            error &&
            error.code === "INVALID_COVER"
        ) {
            message =
                "封面格式不正确，请重新选择图片。";
        }
        showMessage(message, "error");
        isSubmitting = false;
        updateSubmitButton();
    }
}
/* ==================================================
   十六、取消创建：返回新建页面
================================================== */
function hasUnsavedInput() {
    return Boolean(
        elements.title.value.trim() ||
        selectedCoverData ||
        (
            elements.coverInput.files &&
            elements.coverInput.files.length > 0
        )
    );
}
function handleCancel(event) {
    /*
     * 防止按钮位于 form 内时触发表单提交。
     */
    if (event) {
        event.preventDefault();
    }
    if (isSubmitting) {
        return;
    }
    if (isProcessingImage) {
        var stopProcessing = window.confirm(
            "封面仍在处理中，确定放弃本次创建吗？"
        );
        if (!stopProcessing) {
            return;
        }
        /*
         * 使正在处理的图片结果失效，
         * 防止异步处理完成后又覆盖状态。
         */
        imageSelectionToken += 1;
        isProcessingImage = false;
    } else if (hasUnsavedInput()) {
        var confirmed = window.confirm(
            "当前书籍尚未创建，确定放弃本次填写吗？"
        );
        if (!confirmed) {
            return;
        }
    }
    /*
     * 统一返回 pages/create.html。
     * 本脚本位于 pages/create-book.html，
     * 因此相对路径应为 ./create.html。
     */
    window.location.href = "./create.html";
}
/* ==================================================
   十七、绑定事件
================================================== */
elements.title.addEventListener("input", function () {
    updateTitleCounter();
    if (
        elements.titleError &&
        !elements.titleError.hidden
    ) {
        validateTitle();
    }
    hideMessage();
});
elements.title.addEventListener("blur", function () {
    if (elements.title.value.trim()) {
        validateTitle();
    }
});
elements.coverInput.addEventListener(
    "change",
    handleCoverSelection
);
if (elements.removeCoverButton) {
    elements.removeCoverButton.addEventListener(
        "click",
        function (event) {
            event.preventDefault();
            if (isSubmitting || isProcessingImage) {
                return;
            }
            clearCoverPreview();
            hideMessage();
        }
    );
}
elements.form.addEventListener(
    "submit",
    handleSubmit
);
if (elements.cancelButton) {
    elements.cancelButton.addEventListener(
        "click",
        handleCancel
    );
}
if (elements.cancelTopButton) {
    elements.cancelTopButton.addEventListener(
        "click",
        handleCancel
    );
}
/* ==================================================
   十八、初始化
================================================== */
function initialize() {
    elements.title.maxLength = MAX_TITLE_LENGTH;
    /*
     * 确保取消、返回和移除封面按钮不会误提交表单。
     */
    if (elements.cancelButton) {
        elements.cancelButton.type = "button";
    }
    if (elements.cancelTopButton) {
        elements.cancelTopButton.type = "button";
    }
    if (elements.removeCoverButton) {
        elements.removeCoverButton.type = "button";
    }
    updateTitleCounter();
    updateCoverPreview();
    updateSubmitButton();
    setTitleError("");
    clearCoverError();
    hideMessage();
}
/* ==================================================
   十九、公开接口
================================================== */
window.WritingCreateBook = Object.freeze({
    validateTitle: validateTitle,
    clearCoverPreview: clearCoverPreview
});
initialize();

})();
