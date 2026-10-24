/* ======================================================
写作软件 · 新建书籍
文件：page-js/create-book.js
功能：
1. 输入书名并验证
2. 选择、预览、更换、移除封面
3. 自动压缩封面图片
4. 检查存储模块是否正常
5. 创建书籍并处理错误
6. 防止重复提交
7. 取消时确认放弃
8. 顶部返回、底部取消返回新建页面
9. 创建成功后返回书架首页
10. 兼容同步和异步存储接口
11. 兼容 GitHub Pages 项目路径
注意：
书籍数据由 WritingStorage 统一管理。
本文件不直接操作 localStorage。
====================================================== */
(function () {
    "use strict";
    /* ==================================================
       一、基础配置
    ================================================== */
    var MAX_TITLE_LENGTH = 100;
    var MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    var MAX_IMAGE_DIMENSION = 1200;
    var IMAGE_QUALITY = 0.82;
    var REDIRECT_DELAY = 600;
    /* ==================================================
       二、获取页面元素
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
    var isSaved = false;
    var isLeavingPage = false;
    var imageSelectionToken = 0;
    var redirectTimer = null;
    var submitButtonOriginalHTML = elements.submitButton
        ? elements.submitButton.innerHTML
        : "创建书籍";
    /* ==================================================
       四、检查页面元素
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
            "[WritingCreateBook] 初始化失败：缺少必要的 HTML 元素。",
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
    function showMessage(text, type) {
        if (!elements.message) {
            console.error("[WritingCreateBook]", text);
            return;
        }
        elements.message.textContent = String(text || "");
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
        elements.message.setAttribute(
            "role",
            type === "error" ? "alert" : "status"
        );
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
        elements.message.removeAttribute("role");
    }
    /* ==================================================
       六、书名验证
    ================================================== */
    function getTitleValue() {
        return elements.title.value.trim();
    }
    function setTitleError(text) {
        if (elements.titleError) {
            elements.titleError.textContent = text;
            elements.titleError.hidden = !text;
        }
        if (text) {
            elements.title.setAttribute("aria-invalid", "true");
        } else {
            elements.title.removeAttribute("aria-invalid");
        }
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
    function setCoverError(text) {
        if (elements.coverError) {
            elements.coverError.textContent = text;
            elements.coverError.hidden = !text;
        }
        if (text) {
            elements.coverInput.setAttribute("aria-invalid", "true");
        } else {
            elements.coverInput.removeAttribute("aria-invalid");
        }
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
        if (isSubmitting || isProcessingImage) {
            elements.submitButton.setAttribute("aria-busy", "true");
        } else {
            elements.submitButton.removeAttribute("aria-busy");
        }
    }
    /* ==================================================
       十、移除封面
    ================================================== */
    function clearCoverPreview() {
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
            image.onload = function () {
                URL.revokeObjectURL(objectUrl);
                resolve(image);
            };
            image.onerror = function () {
                URL.revokeObjectURL(objectUrl);
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
        context.drawImage(image, 0, 0, width, height);
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
       十四、获取书籍存储模块
    ================================================== */
    function getStorage() {
        var storage = window.WritingStorage;
        if (!storage) {
            throw new Error(
                "书籍存储模块未加载。请检查是否引入 ../js/storage.js。"
            );
        }
        if (typeof storage.createBook !== "function") {
            throw new Error(
                "书籍存储模块缺少 createBook() 方法。请检查 js/storage.js 的实际接口。"
            );
        }
        return storage;
    }
    /* ==================================================
       十五、错误信息转换
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
       十六、检查创建结果
    ================================================== */
    function validateCreatedBook(book) {
        if (!book || typeof book !== "object") {
            throw new Error(
                "存储模块没有返回有效的书籍数据。请检查 createBook()。"
            );
        }
        if (
            book.id === undefined ||
            book.id === null ||
            String(book.id).trim() === ""
        ) {
            throw new Error(
                "书籍创建结果缺少 ID，无法确认保存成功。请检查 storage.js 的返回值。"
            );
        }
        return book;
    }
    /* ==================================================
       十七、计算页面地址
       兼容 GitHub Pages 项目路径
    ================================================== */
    function getPageUrl(fileName) {
        var currentUrl = new URL(window.location.href);
        var currentPath = currentUrl.pathname;
        var pageSuffix = "/pages/create-book.html";
        if (currentPath.endsWith(pageSuffix)) {
            currentUrl.pathname =
                currentPath.slice(0, -pageSuffix.length) +
                "/pages/" +
                fileName;
        } else {
            currentUrl.pathname =
                currentPath.slice(
                    0,
                    currentPath.lastIndexOf("/") + 1
                ) +
                fileName;
        }
        currentUrl.search = "";
        currentUrl.hash = "";
        return currentUrl.href;
    }
    /* ==================================================
       十八、获取新建入口页地址
       取消/返回时使用
    ================================================== */
    function getCreatePageUrl() {
        return getPageUrl("create.html");
    }
    /* ==================================================
       十九、获取书架首页地址
       关键修复：从 /pages/create-book.html
       返回项目根目录下的 /index.html
    ================================================== */
    function getHomeUrl() {
        var currentUrl = new URL(window.location.href);
        var currentPath = currentUrl.pathname;
        var pageSuffix = "/pages/create-book.html";
        if (currentPath.endsWith(pageSuffix)) {
            currentUrl.pathname =
                currentPath.slice(0, -pageSuffix.length) +
                "/index.html";
        } else {
            /*
             * 兼容其他目录结构。
             * 如果当前路径中存在 /pages/，返回项目根目录。
             */
            var pagesIndex = currentPath.lastIndexOf("/pages/");
            if (pagesIndex !== -1) {
                currentUrl.pathname =
                    currentPath.slice(0, pagesIndex) +
                    "/index.html";
            } else {
                /*
                 * 兜底：当前页面所在目录下的 index.html
                 */
                currentUrl.pathname =
                    currentPath.slice(
                        0,
                        currentPath.lastIndexOf("/") + 1
                    ) +
                    "index.html";
            }
        }
        currentUrl.search = "";
        currentUrl.hash = "";
        return currentUrl.href;
    }
    /* ==================================================
       二十、创建成功后返回书架
    ================================================== */
    function navigateToHome() {
        if (redirectTimer !== null) {
            window.clearTimeout(redirectTimer);
            redirectTimer = null;
        }
        var homeUrl = getHomeUrl();
        console.info(
            "[WritingCreateBook] 正在返回书架首页：",
            homeUrl
        );
        /*
         * replace() 避免用户按返回键再次回到
         * 已经成功创建书籍的页面。
         */
        window.location.replace(homeUrl);
    }
    /* ==================================================
       二十一、创建书籍
    ================================================== */
    async function handleSubmit(event) {
        event.preventDefault();
        if (isSubmitting || isProcessingImage || isSaved) {
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
            showMessage(getCreateErrorMessage(error), "error");
            return;
        }
        isSubmitting = true;
        updateSubmitButton();
        try {
            var title = getTitleValue();
            /*
             * 统一通过 WritingStorage 创建书籍。
             * 兼容同步返回值和 Promise 返回值。
             */
            var result = await Promise.resolve(
                storage.createBook({
                    title: title,
                    description: "",
                    cover: selectedCoverData
                })
            );
            var book = validateCreatedBook(result);
            /*
             * 只有存储模块成功返回有效书籍后，
             * 才标记创建成功并执行跳转。
             */
            isSaved = true;
            showMessage(
                "《" +
                (book.title || title) +
                "》创建成功！正在返回书架……",
                "success"
            );
            console.info(
                "[WritingCreateBook] 创建成功：",
                book
            );
            console.info(
                "[WritingCreateBook] 目标首页：",
                getHomeUrl()
            );
            redirectTimer = window.setTimeout(
                navigateToHome,
                REDIRECT_DELAY
            );
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
       二十二、检查未保存的输入
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
    /* ==================================================
       二十三、统一处理返回与取消
    ================================================== */
    function handleCancel(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (isSubmitting || isSaved || isLeavingPage) {
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
        isLeavingPage = true;
        /*
         * 顶部返回和底部取消仍返回新建入口页。
         * 只有创建成功后才返回书架首页。
         */
        window.location.assign(getCreatePageUrl());
    }
    /* ==================================================
       二十四、绑定书名事件
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
    /* ==================================================
       二十五、绑定封面事件
    ================================================== */
    elements.coverInput.addEventListener(
        "change",
        handleCoverSelection
    );
    if (elements.removeCoverButton) {
        elements.removeCoverButton.type = "button";
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
    /* ==================================================
       二十六、绑定表单提交
    ================================================== */
    elements.form.addEventListener(
        "submit",
        handleSubmit
    );
    /* ==================================================
       二十七、绑定顶部返回和底部取消
    ================================================== */
    function bindBackButton(button) {
        if (!button) {
            return;
        }
        if (button.dataset.createBookBackBound === "true") {
            return;
        }
        button.dataset.createBookBackBound = "true";
        button.setAttribute("href", getCreatePageUrl());
        button.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
                handleCancel(event);
            },
            true
        );
    }
    bindBackButton(elements.cancelTopButton);
    bindBackButton(elements.cancelButton);
    /* ==================================================
       二十八、离开页面前提示
    ================================================== */
    window.addEventListener("beforeunload", function (event) {
        if (isSubmitting || isSaved || isLeavingPage) {
            return;
        }
        if (!hasUnsavedInput()) {
            return;
        }
        event.preventDefault();
        event.returnValue = "";
    });
    /* ==================================================
       二十九、初始化
    ================================================== */
    function initialize() {
        elements.title.maxLength = MAX_TITLE_LENGTH;
        updateTitleCounter();
        updateCoverPreview();
        updateSubmitButton();
        setTitleError("");
        clearCoverError();
        hideMessage();
        console.info(
            "[WritingCreateBook] 页面初始化完成。"
        );
        console.info(
            "[WritingCreateBook] 当前页面地址：",
            window.location.href
        );
        console.info(
            "[WritingCreateBook] WritingStorage 是否存在：",
            Boolean(window.WritingStorage)
        );
        console.info(
            "[WritingCreateBook] createBook() 是否可用：",
            Boolean(
                window.WritingStorage &&
                typeof window.WritingStorage.createBook === "function"
            )
        );
        console.info(
            "[WritingCreateBook] 新建入口页地址：",
            getCreatePageUrl()
        );
        console.info(
            "[WritingCreateBook] 书架首页地址：",
            getHomeUrl()
        );
    }
    /* ==================================================
       三十、公开接口
    ================================================== */
    window.WritingCreateBook = Object.freeze({
        validateTitle: validateTitle,
        clearCoverPreview: clearCoverPreview
    });
    initialize();
})();
