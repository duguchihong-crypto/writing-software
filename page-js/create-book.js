/* ======================================================

* 写作软件 · 新建书籍
* 文件：page-js/create-book.js
* 功能：
* 1.	输入书名并验证
* 2.	选择、预览、更换、移除封面
* 3.	自动压缩封面图片
* 4.	检查存储模块是否正常
* 5.	创建书籍并处理错误
* 6.	防止重复提交
* 7.	取消时确认放弃
* 8.	顶部返回、底部取消返回新建页面
* 9.	创建成功后返回书架
* 注意：
* 书籍数据由 WritingStorage 统一管理。
* 本文件不直接操作 localStorage。
* ====================================================== */

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
var submitButtonOriginalHTML = elements.submitButton
    ? elements.submitButton.innerHTML
    : "创建书籍";
/* ==================================================
   四、检查页面
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
        "[WritingCreateBook] 初始化失败：页面缺少必要元素。",
        {
            form: Boolean(elements.form),
            title: Boolean(elements.title),
            coverInput: Boolean(elements.coverInput),
            submitButton: Boolean(elements.submitButton)
        }
    );
    return;
}
/* ==================================================
   五、提示信息
================================================== */
function showMessage(message, type) {
    if (!elements.message) {
        console.error("[WritingCreateBook]", message);
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
            "书名不能超过 " +
            MAX_TITLE_LENGTH +
            " 个字符。"
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
   八、更新封面预览
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
   九、提交按钮状态
================================================== */
function updateSubmitButton() {
    if (!elements.submitButton) {
        return;
    }
    elements.submitButton.disabled =
        isSubmitting || isProcessingImage;
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
   十、移除封面
================================================== */
function clearCoverPreview() {
    /*
     * 使正在执行的旧图片处理任务失效，
     * 防止旧任务结束后覆盖新的封面状态。
     */
    imageSelectionToken++;
    selectedCoverData = "";
    elements.coverInput.value = "";
    isProcessingImage = false;
    clearCoverError();
    updateCoverPreview();
    updateSubmitButton();
}
/* ==================================================
   十一、读取图片
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
                    "无法读取这张图片，请更换图片后重试。"
                )
            );
        };
        image.src = objectUrl;
    });
}
/* ==================================================
   十二、压缩图片
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
        typeof dataUrl !== "string" ||
        dataUrl.indexOf("data:image/jpeg;base64,") !== 0
    ) {
        throw new Error("图片压缩失败，请重新选择。");
    }
    return dataUrl;
}
/* ==================================================
   十三、选择封面
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
        setCoverError("请选择有效的图片文件。");
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
   十四、获取存储模块
================================================== */
function getStorage() {
    var storage = window.WritingStorage;
    if (!storage) {
        throw new Error(
            "书籍存储模块未加载。请检查 pages/create-book.html " +
            "是否正确引入 ../js/storage.js。"
        );
    }
    if (typeof storage.createBook !== "function") {
        throw new Error(
            "书籍存储模块缺少 createBook() 方法。" +
            "需要检查 js/storage.js 中的接口名称。"
        );
    }
    return storage;
}
/* ==================================================
   十五、处理创建结果
================================================== */
function getCreateErrorMessage(error) {
    if (!error) {
        return "创建失败，请重试。";
    }
    if (error.code === "STORAGE_FULL") {
        return "浏览器存储空间不足，请移除封面或更换较小的图片后重试。";
    }
    if (error.code === "STORAGE_UNAVAILABLE") {
        return "当前浏览器无法使用本地存储，请检查浏览器设置。";
    }
    if (error.code === "TITLE_REQUIRED") {
        return "请输入书名。";
    }
    if (error.code === "INVALID_COVER") {
        return "封面格式不正确，请重新选择图片。";
    }
    return error.message || "创建失败，请重试。";
}
/* ==================================================
   十六、创建书籍
================================================== */
async function handleSubmit(event) {
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
            "[WritingCreateBook] 存储模块检查失败：",
            error
        );
        showMessage(
            error.message || "无法连接书籍存储模块。",
            "error"
        );
        return;
    }
    isSubmitting = true;
    updateSubmitButton();
    try {
        /*
         * 兼容同步和异步存储接口。
         * 最终的数据结构仍以 storage.js 的实现为准。
         */
        var book = await Promise.resolve(
            storage.createBook({
                title: getTitleValue(),
                description: "",
                cover: selectedCoverData
            })
        );
        if (!book || book.id === undefined || book.id === null) {
            throw new Error(
                "存储模块未返回有效的书籍 ID。" +
                "请检查 createBook() 的返回值。"
            );
        }
        showMessage(
            "《" +
                (book.title || getTitleValue()) +
                "》创建成功！正在返回书架……",
            "success"
        );
        window.setTimeout(function () {
            if (
                window.WritingNavigation &&
                typeof window.WritingNavigation.goHome === "function"
            ) {
                window.WritingNavigation.goHome();
            } else {
                window.location.href = "../index.html";
            }
        }, 500);
    } catch (error) {
        console.error(
            "[WritingCreateBook] 创建失败：",
            error
        );
        showMessage(
            getCreateErrorMessage(error),
            "error"
        );
        isSubmitting = false;
        updateSubmitButton();
    }
}
/* ==================================================
   十七、取消创建
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
        imageSelectionToken++;
        isProcessingImage = false;
        updateSubmitButton();
    } else if (hasUnsavedInput()) {
        var confirmed = window.confirm(
            "当前书籍尚未创建，确定放弃本次填写吗？"
        );
        if (!confirmed) {
            return;
        }
    }
    window.location.href = "./create.html";
}
/* ==================================================
   十八、绑定事件
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
    elements.cancelButton.type = "button";
    elements.cancelButton.addEventListener(
        "click",
        handleCancel
    );
}
if (elements.cancelTopButton) {
    elements.cancelTopButton.type = "button";
    elements.cancelTopButton.addEventListener(
        "click",
        handleCancel
    );
}
/* ==================================================
   十九、初始化
================================================== */
function initialize() {
    elements.title.maxLength = MAX_TITLE_LENGTH;
    if (elements.removeCoverButton) {
        elements.removeCoverButton.type = "button";
    }
    updateTitleCounter();
    updateCoverPreview();
    updateSubmitButton();
    setTitleError("");
    clearCoverError();
    hideMessage();
    console.info(
        "[WritingCreateBook] 新建书籍页面初始化完成。"
    );
}
/* ==================================================
   二十、公开接口
================================================== */
window.WritingCreateBook = Object.freeze({
    validateTitle: validateTitle,
    clearCoverPreview: clearCoverPreview
});
initialize();

})();
