/* ======================================================
写作软件 · 新建书籍
文件：page-js/create-book.js
功能：
1. 输入书名并验证
2. 选择、预览、更换、移除封面
3. 手动裁剪封面，固定 2:3 比例
4. 支持拖动、滑块缩放和双指缩放
5. 输出 400 × 600 JPEG 封面
6. 检查存储模块是否正常
7. 创建书籍并处理错误
8. 防止重复提交
9. 取消时确认放弃
10. 顶部返回、底部取消返回新建页面
11. 创建成功后返回书架首页
12. 兼容同步和异步存储接口
13. 兼容 GitHub Pages 项目路径
注意：
书籍数据由 WritingStorage 统一管理。
本文件不直接操作 localStorage。
裁剪 HTML 需要提供：
cover-crop-modal
cover-crop-stage
cover-crop-image
cover-crop-zoom
cover-crop-zoom-value
cover-crop-reset
cover-crop-cancel
cover-crop-confirm
====================================================== */
(function () {
    "use strict";
    /* ==================================================
       一、基础配置
    ================================================== */
    var MAX_TITLE_LENGTH = 100;
    var MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    var OUTPUT_WIDTH = 400;
    var OUTPUT_HEIGHT = 600;
    var IMAGE_QUALITY = 0.82;
    var MIN_ZOOM = 1;
    var MAX_ZOOM = 3;
    var ZOOM_STEP = 0.01;
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
        cancelTopButton: document.getElementById("cancel-create-book-top"),
        /* 封面裁剪元素 */
        cropModal: document.getElementById("cover-crop-modal"),
        cropStage: document.getElementById("cover-crop-stage"),
        cropImage: document.getElementById("cover-crop-image"),
        cropZoom: document.getElementById("cover-crop-zoom"),
        cropZoomValue: document.getElementById("cover-crop-zoom-value"),
        cropResetButton: document.getElementById("cover-crop-reset"),
        cropCancelButton: document.getElementById("cover-crop-cancel"),
        cropConfirmButton: document.getElementById("cover-crop-confirm")
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
       四、裁剪状态
    ================================================== */
    var cropObjectUrl = "";
    var cropNaturalWidth = 0;
    var cropNaturalHeight = 0;
    var cropViewportWidth = 0;
    var cropViewportHeight = 0;
    var cropFitScale = 1;
    var cropZoom = 1;
    var cropLeft = 0;
    var cropTop = 0;
    var cropIsOpen = false;
    var cropPreviousFocus = null;
    var activePointers = new Map();
    var dragStartX = 0;
    var dragStartY = 0;
    var dragImageLeft = 0;
    var dragImageTop = 0;
    var pinchStartDistance = 0;
    var pinchStartZoom = 1;
    var previousBodyOverflow = "";
    /* ==================================================
       五、检查页面元素
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
    function hasCropElements() {
        return Boolean(
            elements.cropModal &&
            elements.cropStage &&
            elements.cropImage &&
            elements.cropZoom &&
            elements.cropConfirmButton &&
            elements.cropCancelButton
        );
    }
    if (!hasCropElements()) {
        console.error(
            "[WritingCreateBook] 裁剪弹窗元素不完整。",
            "请检查 create-book.html 中的裁剪弹窗 ID。"
        );
    }
    /* ==================================================
       六、提示信息
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
       七、书名验证
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
       八、封面错误提示
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
       九、更新封面预览
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
       十、提交按钮状态
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
       十一、释放裁剪图片资源
    ================================================== */
    function releaseCropImage() {
        if (cropObjectUrl) {
            URL.revokeObjectURL(cropObjectUrl);
            cropObjectUrl = "";
        }
        if (elements.cropImage) {
            elements.cropImage.onload = null;
            elements.cropImage.onerror = null;
            elements.cropImage.removeAttribute("src");
        }
        cropNaturalWidth = 0;
        cropNaturalHeight = 0;
        cropViewportWidth = 0;
        cropViewportHeight = 0;
        cropFitScale = 1;
        cropZoom = 1;
        cropLeft = 0;
        cropTop = 0;
        activePointers.clear();
        pinchStartDistance = 0;
        pinchStartZoom = 1;
    }
    /* ==================================================
       十二、关闭裁剪弹窗
    ================================================== */
    function closeCropModal() {
        if (!elements.cropModal) {
            releaseCropImage();
            cropIsOpen = false;
            return;
        }
        cropIsOpen = false;
        elements.cropModal.hidden = true;
        document.body.classList.remove("cover-crop-open");
        document.removeEventListener(
            "keydown",
            handleCropKeydown,
            true
        );
        releaseCropImage();
        if (
            cropPreviousFocus &&
            typeof cropPreviousFocus.focus === "function" &&
            document.contains(cropPreviousFocus)
        ) {
            cropPreviousFocus.focus();
        }
        cropPreviousFocus = null;
    }
    /* ==================================================
       十三、移除封面
    ================================================== */
    function clearCoverPreview() {
        imageSelectionToken++;
        if (cropIsOpen) {
            closeCropModal();
        } else {
            releaseCropImage();
        }
        selectedCoverData = "";
        elements.coverInput.value = "";
        isProcessingImage = false;
        clearCoverError();
        updateCoverPreview();
        updateSubmitButton();
    }
    /* ==================================================
       十四、读取图片
    ================================================== */
    function loadImageFromFile(file) {
        return new Promise(function (resolve, reject) {
            var objectUrl;
            try {
                objectUrl = URL.createObjectURL(file);
            } catch (error) {
                reject(
                    new Error("无法读取图片，请重新选择。")
                );
                return;
            }
            var image = new Image();
            image.onload = function () {
                URL.revokeObjectURL(objectUrl);
                if (
                    !image.naturalWidth ||
                    !image.naturalHeight
                ) {
                    reject(
                        new Error("图片尺寸无效，请重新选择。")
                    );
                    return;
                }
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
       十五、限制图片位置
    ================================================== */
    function clampCropPosition() {
        if (
            !cropViewportWidth ||
            !cropViewportHeight ||
            !cropNaturalWidth ||
            !cropNaturalHeight
        ) {
            return;
        }
        var scale = cropFitScale * cropZoom;
        var imageWidth = cropNaturalWidth * scale;
        var imageHeight = cropNaturalHeight * scale;
        var minLeft = cropViewportWidth - imageWidth;
        var minTop = cropViewportHeight - imageHeight;
        cropLeft = Math.min(
            0,
            Math.max(minLeft, cropLeft)
        );
        cropTop = Math.min(
            0,
            Math.max(minTop, cropTop)
        );
    }
    /* ==================================================
       十六、更新裁剪图片显示
    ================================================== */
    function updateCropImagePosition() {
        if (
            !elements.cropImage ||
            !cropNaturalWidth ||
            !cropNaturalHeight
        ) {
            return;
        }
        var scale = cropFitScale * cropZoom;
        var imageWidth = cropNaturalWidth * scale;
        var imageHeight = cropNaturalHeight * scale;
        clampCropPosition();
        elements.cropImage.style.width =
            imageWidth + "px";
        elements.cropImage.style.height =
            imageHeight + "px";
        elements.cropImage.style.left =
            cropLeft + "px";
        elements.cropImage.style.top =
            cropTop + "px";
        if (elements.cropZoom) {
            elements.cropZoom.value =
                String(cropZoom);
        }
        if (elements.cropZoomValue) {
            elements.cropZoomValue.textContent =
                Math.round(cropZoom * 100) + "%";
        }
    }
    /* ==================================================
       十七、初始化裁剪区域
    ================================================== */
    function initializeCropGeometry() {
        if (
            !elements.cropStage ||
            !cropNaturalWidth ||
            !cropNaturalHeight
        ) {
            throw new Error("无法初始化裁剪区域。");
        }
        var rect = elements.cropStage.getBoundingClientRect();
        cropViewportWidth = rect.width;
        cropViewportHeight = rect.height;
        if (
            cropViewportWidth <= 0 ||
            cropViewportHeight <= 0
        ) {
            throw new Error("裁剪区域尺寸无效，请重试。");
        }
        cropFitScale = Math.max(
            cropViewportWidth / cropNaturalWidth,
            cropViewportHeight / cropNaturalHeight
        );
        cropZoom = MIN_ZOOM;
        var imageWidth =
            cropNaturalWidth * cropFitScale * cropZoom;
        var imageHeight =
            cropNaturalHeight * cropFitScale * cropZoom;
        cropLeft = (cropViewportWidth - imageWidth) / 2;
        cropTop = (cropViewportHeight - imageHeight) / 2;
        if (elements.cropZoom) {
            elements.cropZoom.min = String(MIN_ZOOM);
            elements.cropZoom.max = String(MAX_ZOOM);
            elements.cropZoom.step = String(ZOOM_STEP);
            elements.cropZoom.value = String(cropZoom);
        }
        updateCropImagePosition();
    }
    /* ==================================================
       十八、设置缩放
       默认以裁剪框中心为缩放中心
    ================================================== */
    function setCropZoom(newZoom) {
        if (!cropNaturalWidth || !cropNaturalHeight) {
            return;
        }
        newZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, Number(newZoom) || MIN_ZOOM)
        );
        var oldScale = cropFitScale * cropZoom;
        var centerSourceX =
            (cropViewportWidth / 2 - cropLeft) / oldScale;
        var centerSourceY =
            (cropViewportHeight / 2 - cropTop) / oldScale;
        cropZoom = newZoom;
        var newScale = cropFitScale * cropZoom;
        cropLeft =
            cropViewportWidth / 2 -
            centerSourceX * newScale;
        cropTop =
            cropViewportHeight / 2 -
            centerSourceY * newScale;
        updateCropImagePosition();
    }
    /* ==================================================
       十九、恢复默认裁剪
    ================================================== */
    function resetCrop() {
        if (
            !cropNaturalWidth ||
            !cropNaturalHeight ||
            !cropViewportWidth ||
            !cropViewportHeight
        ) {
            return;
        }
        cropZoom = MIN_ZOOM;
        var imageWidth =
            cropNaturalWidth * cropFitScale;
        var imageHeight =
            cropNaturalHeight * cropFitScale;
        cropLeft = (cropViewportWidth - imageWidth) / 2;
        cropTop = (cropViewportHeight - imageHeight) / 2;
        updateCropImagePosition();
    }
    /* ==================================================
       二十、打开裁剪弹窗
    ================================================== */
    function openCropModal(file, token) {
        return new Promise(function (resolve, reject) {
            if (!hasCropElements()) {
                reject(
                    new Error(
                        "裁剪界面尚未配置，请检查 create-book.html。"
                    )
                );
                return;
            }
            releaseCropImage();
            cropPreviousFocus = document.activeElement;
            cropIsOpen = true;
            var objectUrl;
            try {
                objectUrl = URL.createObjectURL(file);
            } catch (error) {
                cropIsOpen = false;
                reject(
                    new Error("无法打开图片，请重新选择。")
                );
                return;
            }
            cropObjectUrl = objectUrl;
            elements.cropModal.hidden = false;
            document.body.classList.add("cover-crop-open");
            document.addEventListener(
                "keydown",
                handleCropKeydown,
                true
            );
            elements.cropConfirmButton.disabled = true;
            if (elements.cropResetButton) {
                elements.cropResetButton.disabled = true;
            }
            elements.cropImage.onload = function () {
                if (
                    token !== imageSelectionToken ||
                    !cropIsOpen
                ) {
                    return;
                }
                cropNaturalWidth =
                    elements.cropImage.naturalWidth;
                cropNaturalHeight =
                    elements.cropImage.naturalHeight;
                if (
                    !cropNaturalWidth ||
                    !cropNaturalHeight
                ) {
                    reject(
                        new Error("图片尺寸无效，请重新选择。")
                    );
                    closeCropModal();
                    return;
                }
                try {
                    initializeCropGeometry();
                    elements.cropConfirmButton.disabled = false;
                    if (elements.cropResetButton) {
                        elements.cropResetButton.disabled = false;
                    }
                    if (elements.cropCancelButton) {
                        elements.cropCancelButton.disabled = false;
                    }
                    if (elements.cropZoom) {
                        elements.cropZoom.disabled = false;
                    }
                    resolve(true);
                } catch (error) {
                    closeCropModal();
                    reject(error);
                }
            };
            elements.cropImage.onerror = function () {
                if (token !== imageSelectionToken) {
                    return;
                }
                closeCropModal();
                reject(
                    new Error("图片加载失败，请重新选择。")
                );
            };
            elements.cropImage.src = objectUrl;
        });
    }
    /* ==================================================
       二十一、生成裁剪后的封面
    ================================================== */
    function createCroppedCover() {
        if (
            !cropIsOpen ||
            !cropNaturalWidth ||
            !cropNaturalHeight ||
            !cropViewportWidth ||
            !cropViewportHeight
        ) {
            throw new Error("裁剪区域尚未准备好，请重试。");
        }
        var scale = cropFitScale * cropZoom;
        /*
         * 将裁剪框中的显示坐标转换为原图坐标。
         */
        var sourceX = -cropLeft / scale;
        var sourceY = -cropTop / scale;
        var sourceWidth = cropViewportWidth / scale;
        var sourceHeight = cropViewportHeight / scale;
        /*
         * 防止浮点误差导致源区域越界。
         */
        sourceX = Math.max(
            0,
            Math.min(cropNaturalWidth, sourceX)
        );
        sourceY = Math.max(
            0,
            Math.min(cropNaturalHeight, sourceY)
        );
        sourceWidth = Math.min(
            sourceWidth,
            cropNaturalWidth - sourceX
        );
        sourceHeight = Math.min(
            sourceHeight,
            cropNaturalHeight - sourceY
        );
        if (sourceWidth <= 0 || sourceHeight <= 0) {
            throw new Error("裁剪范围无效，请重新调整图片。");
        }
        var canvas = document.createElement("canvas");
        canvas.width = OUTPUT_WIDTH;
        canvas.height = OUTPUT_HEIGHT;
        var context = canvas.getContext("2d");
        if (!context) {
            throw new Error("无法创建图片，请重试。");
        }
        try {
            context.fillStyle = "#FFFFFF";
            context.fillRect(
                0,
                0,
                OUTPUT_WIDTH,
                OUTPUT_HEIGHT
            );
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            context.drawImage(
                elements.cropImage,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                OUTPUT_WIDTH,
                OUTPUT_HEIGHT
            );
            var dataUrl = canvas.toDataURL(
                "image/jpeg",
                IMAGE_QUALITY
            );
            if (
                typeof dataUrl !== "string" ||
                dataUrl.indexOf("data:image/jpeg;base64,") !== 0
            ) {
                throw new Error("封面生成失败，请重试。");
            }
            return dataUrl;
        } finally {
            canvas.width = 0;
            canvas.height = 0;
        }
    }
    /* ==================================================
       二十二、确认裁剪
    ================================================== */
    function confirmCrop() {
        if (
            !cropIsOpen ||
            isSubmitting ||
            !cropNaturalWidth ||
            !cropNaturalHeight
        ) {
            return;
        }
        if (elements.cropConfirmButton) {
            elements.cropConfirmButton.disabled = true;
            elements.cropConfirmButton.textContent = "正在生成……";
        }
        try {
            var croppedData = createCroppedCover();
            /*
             * 只有确认裁剪成功后才替换当前封面。
             * 如果生成失败，旧封面不会被覆盖。
             */
            selectedCoverData = croppedData;
            updateCoverPreview();
            clearCoverError();
            hideMessage();
            closeCropModal();
            elements.coverInput.value = "";
        } catch (error) {
            console.error(
                "[WritingCreateBook] 裁剪封面失败：",
                error
            );
            showMessage(
                error && error.message
                    ? error.message
                    : "裁剪失败，请重试。",
                "error"
            );
        } finally {
            if (elements.cropConfirmButton) {
                elements.cropConfirmButton.textContent = "确认裁剪";
                elements.cropConfirmButton.disabled = false;
            }
            isProcessingImage = false;
            updateSubmitButton();
        }
    }
    /* ==================================================
       二十三、取消裁剪
    ================================================== */
    function cancelCrop() {
        if (!cropIsOpen) {
            return;
        }
        imageSelectionToken++;
        closeCropModal();
        elements.coverInput.value = "";
        isProcessingImage = false;
        updateSubmitButton();
        /*
         * 不修改 selectedCoverData。
         * 因此取消裁剪不会覆盖原有封面。
         */
    }
    /* ==================================================
       二十四、裁剪弹窗键盘操作
    ================================================== */
    function handleCropKeydown(event) {
        if (!cropIsOpen) {
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelCrop();
            return;
        }
        /*
         * 防止弹窗打开时误触底层表单。
         */
        if (
            event.key === "Enter" &&
            event.target === elements.cropZoom
        ) {
            event.preventDefault();
        }
    }
    /* ==================================================
       二十五、选择封面
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
        if (!file.type || file.type.indexOf("image/") !== 0) {
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
        showMessage("正在读取图片……", "info");
        try {
            /*
             * 先确认浏览器能够正常读取图片。
             */
            var image = await loadImageFromFile(file);
            if (currentToken !== imageSelectionToken) {
                return;
            }
            if (
                !image.naturalWidth ||
                !image.naturalHeight
            ) {
                throw new Error("图片尺寸无效，请重新选择。");
            }
            /*
             * 不直接压缩整张原图。
             * 打开裁剪界面，由用户决定最终保留的区域。
             */
            await openCropModal(file, currentToken);
            if (currentToken !== imageSelectionToken) {
                return;
            }
            hideMessage();
        } catch (error) {
            if (currentToken !== imageSelectionToken) {
                return;
            }
            console.error(
                "[WritingCreateBook] 封面处理失败：",
                error
            );
            if (cropIsOpen) {
                closeCropModal();
            }
            elements.coverInput.value = "";
            setCoverError(
                error && error.message
                    ? error.message
                    : "封面处理失败，请重新选择图片。"
            );
            hideMessage();
            isProcessingImage = false;
            updateSubmitButton();
        }
    }
    /* ==================================================
       二十六、获取书籍存储模块
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
       二十七、错误信息转换
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
       二十八、检查创建结果
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
       二十九、计算页面地址
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
       三十、获取新建入口页地址
    ================================================== */
    function getCreatePageUrl() {
        return getPageUrl("create.html");
    }
    /* ==================================================
       三十一、获取书架首页地址
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
            var pagesIndex = currentPath.lastIndexOf("/pages/");
            if (pagesIndex !== -1) {
                currentUrl.pathname =
                    currentPath.slice(0, pagesIndex) +
                    "/index.html";
            } else {
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
       三十二、创建成功后返回书架
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
        window.location.replace(homeUrl);
    }
    /* ==================================================
       三十三、创建书籍
    ================================================== */
    async function handleSubmit(event) {
        event.preventDefault();
        if (
            isSubmitting ||
            isProcessingImage ||
            isSaved ||
            cropIsOpen
        ) {
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
                getCreateErrorMessage(error),
                "error"
            );
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
       三十四、检查未保存的输入
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
       三十五、统一处理返回与取消
    ================================================== */
    function handleCancel(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (isSubmitting || isSaved || isLeavingPage) {
            return;
        }
        if (cropIsOpen) {
            var abandonCrop = window.confirm(
                "封面正在裁剪，确定取消裁剪并放弃本次创建吗？"
            );
            if (!abandonCrop) {
                return;
            }
            cancelCrop();
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
       三十六、绑定书名事件
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
       三十七、绑定封面选择与移除事件
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
       三十八、绑定裁剪弹窗按钮
    ================================================== */
    if (elements.cropZoom) {
        elements.cropZoom.addEventListener(
            "input",
            function () {
                setCropZoom(this.value);
            }
        );
    }
    if (elements.cropResetButton) {
        elements.cropResetButton.type = "button";
        elements.cropResetButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                resetCrop();
            }
        );
    }
    if (elements.cropCancelButton) {
        elements.cropCancelButton.type = "button";
        elements.cropCancelButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                cancelCrop();
            }
        );
    }
    if (elements.cropConfirmButton) {
        elements.cropConfirmButton.type = "button";
        elements.cropConfirmButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                confirmCrop();
            }
        );
    }
    /* ==================================================
       三十九、绑定裁剪区域拖动与双指缩放
    ================================================== */
    function getPointerDistance(pointerA, pointerB) {
        var dx = pointerA.x - pointerB.x;
        var dy = pointerA.y - pointerB.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    function getPointerCenter(pointerA, pointerB) {
        return {
            x: (pointerA.x + pointerB.x) / 2,
            y: (pointerA.y + pointerB.y) / 2
        };
    }
    if (elements.cropStage) {
        elements.cropStage.addEventListener(
            "pointerdown",
            function (event) {
                if (!cropIsOpen) {
                    return;
                }
                if (
                    event.pointerType === "mouse" &&
                    event.button !== 0
                ) {
                    return;
                }
                event.preventDefault();
                activePointers.set(event.pointerId, {
                    x: event.clientX,
                    y: event.clientY
                });
                try {
                    elements.cropStage.setPointerCapture(
                        event.pointerId
                    );
                } catch (error) {
                    /* 部分浏览器可能不支持捕获，继续使用事件处理。 */
                }
                if (activePointers.size === 1) {
                    dragStartX = event.clientX;
                    dragStartY = event.clientY;
                    dragImageLeft = cropLeft;
                    dragImageTop = cropTop;
                } else if (activePointers.size === 2) {
                    var pointers = Array.from(
                        activePointers.values()
                    );
                    pinchStartDistance = getPointerDistance(
                        pointers[0],
                        pointers[1]
                    );
                    pinchStartZoom = cropZoom;
                }
            }
        );
        elements.cropStage.addEventListener(
            "pointermove",
            function (event) {
                if (
                    !cropIsOpen ||
                    !activePointers.has(event.pointerId)
                ) {
                    return;
                }
                event.preventDefault();
                activePointers.set(event.pointerId, {
                    x: event.clientX,
                    y: event.clientY
                });
                if (activePointers.size >= 2) {
                    var pointers = Array.from(
                        activePointers.values()
                    );
                    var distance = getPointerDistance(
                        pointers[0],
                        pointers[1]
                    );
                    if (pinchStartDistance > 0) {
                        var zoomRatio =
                            distance / pinchStartDistance;
                        setCropZoom(
                            pinchStartZoom * zoomRatio
                        );
                    }
                    return;
                }
                if (activePointers.size === 1) {
                    cropLeft =
                        dragImageLeft +
                        event.clientX -
                        dragStartX;
                    cropTop =
                        dragImageTop +
                        event.clientY -
                        dragStartY;
                    updateCropImagePosition();
                }
            }
        );
        function endCropPointer(event) {
            if (!activePointers.has(event.pointerId)) {
                return;
            }
            activePointers.delete(event.pointerId);
            if (activePointers.size === 1) {
                var remainingPointer =
                    Array.from(activePointers.values())[0];
                dragStartX = remainingPointer.x;
                dragStartY = remainingPointer.y;
                dragImageLeft = cropLeft;
                dragImageTop = cropTop;
                pinchStartDistance = 0;
            } else if (activePointers.size === 0) {
                pinchStartDistance = 0;
            } else if (activePointers.size >= 2) {
                var pointers = Array.from(
                    activePointers.values()
                );
                pinchStartDistance = getPointerDistance(
                    pointers[0],
                    pointers[1]
                );
                pinchStartZoom = cropZoom;
            }
        }
        elements.cropStage.addEventListener(
            "pointerup",
            endCropPointer
        );
        elements.cropStage.addEventListener(
            "pointercancel",
            endCropPointer
        );
        elements.cropStage.addEventListener(
            "lostpointercapture",
            endCropPointer
        );
        elements.cropStage.addEventListener(
            "dragstart",
            function (event) {
                event.preventDefault();
            }
        );
    }
    /* ==================================================
       四十、绑定表单提交
    ================================================== */
    elements.form.addEventListener(
        "submit",
        handleSubmit
    );
    /* ==================================================
       四十一、绑定顶部返回和底部取消
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
       四十二、离开页面前提示
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
       四十三、初始化
    ================================================== */
    function initialize() {
        elements.title.maxLength = MAX_TITLE_LENGTH;
        updateTitleCounter();
        updateCoverPreview();
        updateSubmitButton();
        setTitleError("");
        clearCoverError();
        hideMessage();
        if (elements.cropModal) {
            elements.cropModal.hidden = true;
        }
        if (elements.cropZoom) {
            elements.cropZoom.min = String(MIN_ZOOM);
            elements.cropZoom.max = String(MAX_ZOOM);
            elements.cropZoom.step = String(ZOOM_STEP);
            elements.cropZoom.value = String(MIN_ZOOM);
        }
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
            "[WritingCreateBook] 裁剪弹窗是否完整：",
            hasCropElements()
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
       四十四、公开接口
    ================================================== */
    window.WritingCreateBook = Object.freeze({
        validateTitle: validateTitle,
        clearCoverPreview: clearCoverPreview,
        resetCrop: resetCrop,
        cancelCrop: cancelCrop
    });
    initialize();
})();
