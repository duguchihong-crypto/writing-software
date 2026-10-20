/* ======================================================
   写作软件 · 新建书籍
   文件：page-js/create-book.js

   功能：
   1. 输入书名
   2. 选择封面
   3. 预览、更换、移除封面
   4. 自动压缩图片
   5. 通过 WritingStorage 统一保存书籍和封面
   6. 提供表单验证
   7. 创建成功后返回书架
====================================================== */

(function () {
    "use strict";


    /* ==================================================
       一、基础配置
    ================================================== */

    const MAX_TITLE_LENGTH = 100;

    // 原始图片最大允许 10 MB
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

    // 压缩后的图片最大宽度或高度
    const MAX_IMAGE_DIMENSION = 1200;

    // JPEG 压缩质量
    const IMAGE_QUALITY = 0.82;


    /* ==================================================
       二、获取页面元素
    ================================================== */

    const elements = {
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

    let selectedCoverData = "";

    let isSubmitting = false;

    let isProcessingImage = false;

    let imageSelectionToken = 0;


    /* ==================================================
       四、检查页面结构
    ================================================== */

    function validatePageElements() {
        const requiredElements = [
            elements.form,
            elements.title,
            elements.coverInput,
            elements.submitButton
        ];

        return requiredElements.every(Boolean);
    }

    if (!validatePageElements()) {
        console.error(
            "[WritingCreateBook] 页面缺少必要的 HTML 元素。"
        );

        return;
    }


    /* ==================================================
       五、显示提示信息
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
        const title = getTitleValue();

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

        const length = elements.title.value.length;

        elements.titleCounter.textContent =
            length + " / " + MAX_TITLE_LENGTH;
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
       八、更新封面界面
    ================================================== */

    function updateCoverPreview() {
        const hasCover = Boolean(selectedCoverData);

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
        // 使尚未完成的旧图片处理任务失效。
        imageSelectionToken += 1;

        selectedCoverData = "";

        elements.coverInput.value = "";

        clearCoverError();

        updateCoverPreview();
    }


    /* ==================================================
       十、读取图片
    ================================================== */

    function loadImageFromFile(file) {
        return new Promise(function (resolve, reject) {
            const objectUrl = URL.createObjectURL(file);

            const image = new Image();

            image.onload = function () {
                URL.revokeObjectURL(objectUrl);

                resolve(image);
            };

            image.onerror = function () {
                URL.revokeObjectURL(objectUrl);

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
        const image = await loadImageFromFile(file);

        const originalWidth = image.naturalWidth;
        const originalHeight = image.naturalHeight;

        if (!originalWidth || !originalHeight) {
            throw new Error("图片尺寸无效，请重新选择。");
        }

        const scale = Math.min(
            1,
            MAX_IMAGE_DIMENSION / Math.max(
                originalWidth,
                originalHeight
            )
        );

        const width = Math.max(
            1,
            Math.round(originalWidth * scale)
        );

        const height = Math.max(
            1,
            Math.round(originalHeight * scale)
        );

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("图片处理失败，请重新尝试。");
        }

        // JPEG 不支持透明背景，因此使用白色背景。
        context.fillStyle = "#FFFFFF";

        context.fillRect(
            0,
            0,
            width,
            height
        );

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        const dataUrl = canvas.toDataURL(
            "image/jpeg",
            IMAGE_QUALITY
        );

        canvas.width = 0;
        canvas.height = 0;

        if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
            throw new Error("图片压缩失败，请重新选择。");
        }

        return dataUrl;
    }


    /* ==================================================
       十二、处理封面选择
    ================================================== */

    async function handleCoverSelection() {
        clearCoverError();

        hideMessage();

        const file =
            elements.coverInput.files &&
            elements.coverInput.files[0];

        if (!file) {
            return;
        }

        // 记录本次选择，避免连续选图时旧任务覆盖新图片。
        const currentToken = ++imageSelectionToken;

        if (!file.type || !file.type.startsWith("image/")) {
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
            const compressedData = await compressImage(file);

            // 如果用户已经选择了另一张图片，
            // 不再使用当前这次处理的结果。
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
                error.message || "封面处理失败，请重新选择图片。"
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
       十三、更新提交按钮状态
    ================================================== */

    function updateSubmitButton() {
        if (!elements.submitButton) {
            return;
        }

        const disabled =
            isSubmitting ||
            isProcessingImage;

        elements.submitButton.disabled = disabled;

        if (isSubmitting) {
            elements.submitButton.textContent = "正在创建……";
        } else if (isProcessingImage) {
            elements.submitButton.textContent = "正在处理封面……";
        } else {
            elements.submitButton.textContent = "创建书籍";
        }
    }


    /* ==================================================
       十四、创建书籍
    ================================================== */

    function handleSubmit(event) {
        event.preventDefault();

        if (isSubmitting || isProcessingImage) {
            return;
        }

        hideMessage();

        const titleValid = validateTitle();

        if (!titleValid) {
            elements.title.focus();

            return;
        }

        if (
            !window.WritingStorage ||
            typeof window.WritingStorage.createBook !== "function"
        ) {
            showMessage(
                "存储模块尚未加载，请刷新页面后重试。",
                "error"
            );

            return;
        }

        isSubmitting = true;

        updateSubmitButton();

        try {
            // 书名和封面通过同一个接口一起保存。
            const book = window.WritingStorage.createBook({
                title: getTitleValue(),
                description: "",
                cover: selectedCoverData
            });

            if (!book || !book.id) {
                throw new Error("书籍创建失败，请重试。");
            }

            showMessage(
                "《" + book.title + "》创建成功！正在返回书架……",
                "success"
            );

            // 短暂显示成功提示，然后返回首页。
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

            let message = error.message || "创建失败，请重试。";

            if (error.code === "STORAGE_FULL") {
                message =
                    "浏览器存储空间不足。请更换较小的封面图片后重试。";
            } else if (error.code === "STORAGE_UNAVAILABLE") {
                message =
                    "当前浏览器无法使用本地存储，请检查浏览器设置。";
            } else if (error.code === "TITLE_REQUIRED") {
                message = "请输入书名。";
            } else if (error.code === "INVALID_COVER") {
                message = "封面格式不正确，请重新选择图片。";
            }

            showMessage(message, "error");

            isSubmitting = false;

            updateSubmitButton();
        }
    }


    /* ==================================================
       十五、取消创建
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


    function handleCancel() {
        if (isSubmitting) {
            return;
        }

        if (hasUnsavedInput()) {
            const confirmed = window.confirm(
                "当前书籍尚未创建，确定放弃本次填写吗？"
            );

            if (!confirmed) {
                return;
            }
        }

        if (
            window.WritingNavigation &&
            typeof window.WritingNavigation.navigate === "function"
        ) {
            window.WritingNavigation.navigate("create");
        } else {
            window.location.href = "./create.html";
        }
    }


    /* ==================================================
       十六、绑定事件
    ================================================== */

    elements.title.addEventListener("input", function () {
        updateTitleCounter();

        if (elements.titleError && !elements.titleError.hidden) {
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
            function () {
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
       十七、初始化页面
    ================================================== */

    function initialize() {
        elements.title.maxLength = MAX_TITLE_LENGTH;

        updateTitleCounter();

        updateCoverPreview();

        updateSubmitButton();

        setTitleError("");

        clearCoverError();

        hideMessage();
    }


    /* ==================================================
       十八、公开接口
    ================================================== */

    window.WritingCreateBook = Object.freeze({
        validateTitle: validateTitle,
        clearCoverPreview: clearCoverPreview
    });


    initialize();

})();
