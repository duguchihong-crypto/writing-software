/* ======================================================
   写作软件 · 新建书籍
   文件：page-js/create-book.js
   功能：
   1. 书名验证
   2. 选择、更换、移除封面
   3. 手动裁剪封面，固定 2:3 比例
   4. 拖动、滑块缩放、双指缩放
   5. 输出 400 × 600 JPEG
   6. 创建书籍
   7. 防止重复提交
   8. 取消时确认放弃
   9. 兼容 GitHub Pages 项目路径
   注意：
   书籍数据由 WritingStorage 统一管理。
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
    var REDIRECT_DELAY = 600;
    /* ==================================================
       二、获取 HTML 元素
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
        cropModal: document.getElementById("cover-crop-modal"),
        cropStage: document.getElementById("cover-crop-stage"),
        cropImage: document.getElementById("cover-crop-image"),
        cropZoom: document.getElementById("cover-crop-zoom"),
        cropZoomValue: document.getElementById("cover-crop-zoom-value"),
        cropZoomInButton: document.getElementById("cover-crop-zoom-in"),
        cropZoomOutButton: document.getElementById("cover-crop-zoom-out"),
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
    var pinchSourceCenter = null;
    /* ==================================================
       五、检查必要元素
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
            "[WritingCreateBook] 页面缺少必要元素。",
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
    /* ==================================================
       六、消息提示
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
        if (!elements.message) return;
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
        if (!elements.titleCounter) return;
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
       九、封面预览
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
       十、创建按钮状态
    ================================================== */
    function updateSubmitButton() {
        if (!elements.submitButton) return;
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
       十一、释放裁剪资源
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
            elements.cropImage.style.width = "";
            elements.cropImage.style.height = "";
            elements.cropImage.style.left = "";
            elements.cropImage.style.top = "";
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
        pinchSourceCenter = null;
    }
    /* ==================================================
       十二、关闭裁剪弹窗
    ================================================== */
    function closeCropModal() {
        cropIsOpen = false;
        if (elements.cropModal) {
            elements.cropModal.hidden = true;
        }
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
                reject(new Error("无法读取图片，请重新选择。"));
                return;
            }
            var image = new Image();
            image.onload = function () {
                URL.revokeObjectURL(objectUrl);
                if (!image.naturalWidth || !image.naturalHeight) {
                    reject(new Error("图片尺寸无效，请重新选择。"));
                    return;
                }
                resolve(image);
            };
            image.onerror = function () {
                URL.revokeObjectURL(objectUrl);
                reject(
                    new Error("无法读取这张图片，请更换图片后重试。")
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
        cropLeft = Math.min(0, Math.max(minLeft, cropLeft));
        cropTop = Math.min(0, Math.max(minTop, cropTop));
    }
    /* ==================================================
       十六、更新图片位置
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
        elements.cropImage.style.width = imageWidth + "px";
        elements.cropImage.style.height = imageHeight + "px";
        elements.cropImage.style.left = cropLeft + "px";
        elements.cropImage.style.top = cropTop + "px";
        if (elements.cropZoom) {
            elements.cropZoom.value = String(cropZoom);
        }
        if (elements.cropZoomValue) {
            elements.cropZoomValue.textContent =
                Math.round(cropZoom * 100) + "%";
        }
        if (elements.cropZoomInButton) {
            elements.cropZoomInButton.disabled =
                cropZoom >= MAX_ZOOM;
        }
        if (elements.cropZoomOutButton) {
            elements.cropZoomOutButton.disabled =
                cropZoom <= MIN_ZOOM;
        }
    }
    /* ==================================================
       十七、初始化裁剪区域
    ================================================== */
    function initializeCropGeometry() {
        var rect = elements.cropStage.getBoundingClientRect();
        cropViewportWidth = rect.width;
        cropViewportHeight = rect.height;
        if (
            cropViewportWidth <= 0 ||
            cropViewportHeight <= 0
        ) {
            throw new Error(
                "裁剪区域尺寸无效，请检查 create-book.css。"
            );
        }
        cropFitScale = Math.max(
            cropViewportWidth / cropNaturalWidth,
            cropViewportHeight / cropNaturalHeight
        );
        cropZoom = MIN_ZOOM;
        var imageWidth = cropNaturalWidth * cropFitScale;
        var imageHeight = cropNaturalHeight * cropFitScale;
        cropLeft = (cropViewportWidth - imageWidth) / 2;
        cropTop = (cropViewportHeight - imageHeight) / 2;
        elements.cropZoom.min = String(MIN_ZOOM);
        elements.cropZoom.max = String(MAX_ZOOM);
        elements.cropZoom.step = "0.01";
        elements.cropZoom.value = String(cropZoom);
        updateCropImagePosition();
    }
    /* ==================================================
       十八、缩放图片
    ================================================== */
    function setCropZoom(newZoom) {
        if (!cropNaturalWidth || !cropNaturalHeight) return;
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
       十九、重置裁剪
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
        var imageWidth = cropNaturalWidth * cropFitScale;
        var imageHeight = cropNaturalHeight * cropFitScale;
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
                        "裁剪界面 HTML 元素不完整，请检查 cover-crop-stage 等 ID。"
                    )
                );
                return;
            }
            releaseCropImage();
            cropPreviousFocus = document.activeElement;
            cropIsOpen = true;
            try {
                cropObjectUrl = URL.createObjectURL(file);
            } catch (error) {
                cropIsOpen = false;
                reject(new Error("无法打开图片，请重新选择。"));
                return;
            }
            elements.cropModal.hidden = false;
            document.body.classList.add("cover-crop-open");
            document.addEventListener(
                "keydown",
                handleCropKeydown,
                true
            );
            elements.cropConfirmButton.disabled = true;
            elements.cropCancelButton.disabled = false;
            if (elements.cropResetButton) {
                elements.cropResetButton.disabled = true;
            }
            if (elements.cropZoom) {
                elements.cropZoom.disabled = true;
            }
            elements.cropImage.onload = function () {
                if (
                    token !== imageSelectionToken ||
                    !cropIsOpen
                ) {
                    return;
                }
                cropNaturalWidth = elements.cropImage.naturalWidth;
                cropNaturalHeight = elements.cropImage.naturalHeight;
                if (!cropNaturalWidth || !cropNaturalHeight) {
                    closeCropModal();
                    reject(new Error("图片尺寸无效，请重新选择。"));
                    return;
                }
                window.requestAnimationFrame(function () {
                    if (
                        token !== imageSelectionToken ||
                        !cropIsOpen
                    ) {
                        return;
                    }
                    try {
                        initializeCropGeometry();
                        elements.cropConfirmButton.disabled = false;
                        if (elements.cropResetButton) {
                            elements.cropResetButton.disabled = false;
                        }
                        if (elements.cropZoom) {
                            elements.cropZoom.disabled = false;
                        }
                        if (elements.cropZoomInButton) {
                            elements.cropZoomInButton.disabled = false;
                        }
                        if (elements.cropZoomOutButton) {
                            elements.cropZoomOutButton.disabled = false;
                        }
                        elements.cropConfirmButton.focus();
                        resolve(true);
                    } catch (error) {
                        closeCropModal();
                        reject(error);
                    }
                });
            };
            elements.cropImage.onerror = function () {
                if (token !== imageSelectionToken) return;
                closeCropModal();
                reject(new Error("图片加载失败，请重新选择。"));
            };
            elements.cropImage.src = cropObjectUrl;
        });
    }
    /* ==================================================
       二十一、生成裁剪封面
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
        var sourceX = -cropLeft / scale;
        var sourceY = -cropTop / scale;
        var sourceWidth = cropViewportWidth / scale;
        var sourceHeight = cropViewportHeight / scale;
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
            if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
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
        elements.cropConfirmButton.disabled = true;
        elements.cropConfirmButton.textContent = "正在生成……";
        try {
            selectedCoverData = createCroppedCover();
            updateCoverPreview();
            clearCoverError();
            hideMessage();
            closeCropModal();
            elements.coverInput.value = "";
        } catch (error) {
            console.error("[WritingCreateBook] 裁剪失败：", error);
            showMessage(
                error.message || "裁剪失败，请重试。",
                "error"
            );
        } finally {
            if (elements.cropConfirmButton) {
                elements.cropConfirmButton.textContent = "确认裁剪";
                elements.cropConfirmButton.disabled = true;
            }
            isProcessingImage = false;
            updateSubmitButton();
        }
    }
    /* ==================================================
       二十三、取消裁剪
    ================================================== */
    function cancelCrop() {
        if (!cropIsOpen) return;
        imageSelectionToken++;
        closeCropModal();
        elements.coverInput.value = "";
        isProcessingImage = false;
        updateSubmitButton();
    }
    /* ==================================================
       二十四、裁剪键盘操作
    ================================================== */
    function handleCropKeydown(event) {
        if (!cropIsOpen) return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelCrop();
        }
    }
    /* ==================================================
       二十五、处理图片选择
    ================================================== */
    async function handleCoverSelection(file) {
        clearCoverError();
        hideMessage();
        if (!file) return;
        var currentToken = ++imageSelectionToken;
        if (!file.type || !file.type.startsWith("image/")) {
            setCoverError("请选择有效的图片文件。");
            return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
            setCoverError("图片不能超过 10 MB，请选择较小的图片。");
            return;
        }
        isProcessingImage = true;
        updateSubmitButton();
        showMessage("正在读取图片……", "info");
        try {
            var image = await loadImageFromFile(file);
            if (currentToken !== imageSelectionToken) return;
            if (!image.naturalWidth || !image.naturalHeight) {
                throw new Error("图片尺寸无效，请重新选择。");
            }
            await openCropModal(file, currentToken);
            if (currentToken !== imageSelectionToken) return;
            hideMessage();
        } catch (error) {
            if (currentToken !== imageSelectionToken) return;
            console.error("[WritingCreateBook] 图片处理失败：", error);
            if (cropIsOpen) {
                closeCropModal();
            }
            setCoverError(
                error.message || "封面处理失败，请重新选择图片。"
            );
            hideMessage();
            isProcessingImage = false;
            updateSubmitButton();
        }
    }
    /* ==================================================
       二十六、封面选择器
       同时支持 label 和直接点击按钮
    ================================================== */
    function openNativeFilePicker() {
        if (isSubmitting || isProcessingImage || isSaved) {
            return;
        }
        if (!elements.coverInput) {
            setCoverError("找不到封面文件输入框，请检查 HTML。");
            return;
        }
        clearCoverError();
        hideMessage();
        try {
            elements.coverInput.click();
        } catch (error) {
            console.error("[WritingCreateBook] 打开文件选择器失败：", error);
            setCoverError("无法打开图片选择器，请刷新页面后重试。");
        }
    }
    /*
     * 关键修复：
     * 不再在 change 事件中提前清空 input。
     * 先保存 File，再清空 input，避免部分移动浏览器行为异常。
     */
    elements.coverInput.addEventListener("change", function () {
        var file =
            elements.coverInput.files &&
            elements.coverInput.files[0];
        if (!file) return;
        /*
         * 先清空输入框，让用户下次能再次选择同一张图片。
         * 当前 file 变量仍然持有 File 对象。
         */
        elements.coverInput.value = "";
        handleCoverSelection(file);
    });
    /*
     * 如果封面选择按钮是 label，
     * 保留默认 label 行为，避免阻止原生文件选择器。
     *
     * 如果它是 button，则主动打开文件选择器。
     */
    if (elements.coverSelectLabel) {
        var labelTag = elements.coverSelectLabel.tagName.toLowerCase();
        if (labelTag === "button") {
            elements.coverSelectLabel.type = "button";
            elements.coverSelectLabel.addEventListener(
                "click",
                function (event) {
                    event.preventDefault();
                    openNativeFilePicker();
                }
            );
        }
    }
    /* ==================================================
       二十七、移除封面按钮
    ================================================== */
    if (elements.removeCoverButton) {
        elements.removeCoverButton.type = "button";
        elements.removeCoverButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                if (isSubmitting || isProcessingImage) return;
                clearCoverPreview();
                hideMessage();
            }
        );
    }
    /* ==================================================
       二十八、缩放、重置、取消、确认按钮
    ================================================== */
    if (elements.cropZoom) {
        elements.cropZoom.addEventListener("input", function () {
            setCropZoom(this.value);
        });
    }
    if (elements.cropZoomInButton) {
        elements.cropZoomInButton.type = "button";
        elements.cropZoomInButton.addEventListener("click", function (event) {
            event.preventDefault();
            setCropZoom(cropZoom + 0.1);
        });
    }
    if (elements.cropZoomOutButton) {
        elements.cropZoomOutButton.type = "button";
        elements.cropZoomOutButton.addEventListener("click", function (event) {
            event.preventDefault();
            setCropZoom(cropZoom - 0.1);
        });
    }
    if (elements.cropResetButton) {
        elements.cropResetButton.type = "button";
        elements.cropResetButton.addEventListener("click", function (event) {
            event.preventDefault();
            resetCrop();
        });
    }
    if (elements.cropCancelButton) {
        elements.cropCancelButton.type = "button";
        elements.cropCancelButton.addEventListener("click", function (event) {
            event.preventDefault();
            cancelCrop();
        });
    }
    if (elements.cropConfirmButton) {
        elements.cropConfirmButton.type = "button";
        elements.cropConfirmButton.addEventListener("click", function (event) {
            event.preventDefault();
            confirmCrop();
        });
    }
    if (elements.cropModal) {
        elements.cropModal.addEventListener("click", function (event) {
            if (event.target === elements.cropModal) {
                cancelCrop();
            }
        });
    }
    /* ==================================================
       二十九、拖动和双指缩放
    ================================================== */
    function getPointerDistance(a, b) {
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    function getPointerCenter(a, b) {
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        };
    }
    function getStagePoint(x, y) {
        var rect = elements.cropStage.getBoundingClientRect();
        return {
            x: x - rect.left,
            y: y - rect.top
        };
    }
    function beginPinch() {
        if (activePointers.size < 2) return;
        var pointers = Array.from(activePointers.values());
        var a = getStagePoint(pointers[0].x, pointers[0].y);
        var b = getStagePoint(pointers[1].x, pointers[1].y);
        pinchStartDistance = getPointerDistance(a, b);
        pinchStartZoom = cropZoom;
        var center = getPointerCenter(a, b);
        var scale = cropFitScale * cropZoom;
        pinchSourceCenter = {
            x: (center.x - cropLeft) / scale,
            y: (center.y - cropTop) / scale
        };
    }
    function updatePinch() {
        if (
            activePointers.size < 2 ||
            !pinchStartDistance ||
            !pinchSourceCenter
        ) {
            return;
        }
        var pointers = Array.from(activePointers.values());
        var a = getStagePoint(pointers[0].x, pointers[0].y);
        var b = getStagePoint(pointers[1].x, pointers[1].y);
        var distance = getPointerDistance(a, b);
        var center = getPointerCenter(a, b);
        var newZoom = Math.max(
            MIN_ZOOM,
            Math.min(
                MAX_ZOOM,
                pinchStartZoom * distance / pinchStartDistance
            )
        );
        cropZoom = newZoom;
        var scale = cropFitScale * cropZoom;
        cropLeft = center.x - pinchSourceCenter.x * scale;
        cropTop = center.y - pinchSourceCenter.y * scale;
        updateCropImagePosition();
    }
    function handlePointerMove(event) {
        if (!cropIsOpen || !activePointers.has(event.pointerId)) {
            return;
        }
        activePointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });
        if (activePointers.size >= 2) {
            event.preventDefault();
            updatePinch();
            return;
        }
        if (activePointers.size === 1) {
            event.preventDefault();
            cropLeft = dragImageLeft + event.clientX - dragStartX;
            cropTop = dragImageTop + event.clientY - dragStartY;
            updateCropImagePosition();
        }
    }
    function handlePointerEnd(event) {
        if (!activePointers.has(event.pointerId)) return;
        activePointers.delete(event.pointerId);
        if (activePointers.size === 1) {
            var remaining = Array.from(activePointers.values())[0];
            dragStartX = remaining.x;
            dragStartY = remaining.y;
            dragImageLeft = cropLeft;
            dragImageTop = cropTop;
            pinchStartDistance = 0;
            pinchSourceCenter = null;
        } else if (activePointers.size === 0) {
            pinchStartDistance = 0;
            pinchSourceCenter = null;
        } else {
            beginPinch();
        }
    }
    if (elements.cropStage) {
        elements.cropStage.style.touchAction = "none";
        elements.cropStage.addEventListener("pointerdown", function (event) {
            if (!cropIsOpen) return;
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
            if (activePointers.size === 1) {
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                dragImageLeft = cropLeft;
                dragImageTop = cropTop;
            } else if (activePointers.size === 2) {
                beginPinch();
            }
        });
        elements.cropStage.addEventListener("dragstart", function (event) {
            event.preventDefault();
        });
    }
    /*
     * 在弹窗打开期间才绑定拖动事件，
     * 关闭弹窗后解除，下一次打开仍然可以正常拖动。
     */
    function attachPointerListeners() {
        document.addEventListener("pointermove", handlePointerMove, {
            capture: true,
            passive: false
        });
        document.addEventListener("pointerup", handlePointerEnd, true);
        document.addEventListener("pointercancel", handlePointerEnd, true);
    }
    function detachPointerListeners() {
        document.removeEventListener("pointermove", handlePointerMove, true);
        document.removeEventListener("pointerup", handlePointerEnd, true);
        document.removeEventListener("pointercancel", handlePointerEnd, true);
    }
    var originalOpenCropModal = openCropModal;
    openCropModal = function (file, token) {
        attachPointerListeners();
        return originalOpenCropModal(file, token).catch(function (error) {
            detachPointerListeners();
            throw error;
        });
    };
    var originalCloseCropModal = closeCropModal;
    closeCropModal = function () {
        detachPointerListeners();
        originalCloseCropModal();
    };
    /* ==================================================
       三十、表单提交与存储
    ================================================== */
    function getStorage() {
        var storage = window.WritingStorage;
        if (!storage) {
            throw new Error(
                "书籍存储模块未加载，请检查 ../js/storage.js。"
            );
        }
        if (typeof storage.createBook !== "function") {
            throw new Error(
                "存储模块缺少 createBook() 方法，请检查 storage.js。"
            );
        }
        return storage;
    }
    function getCreateErrorMessage(error) {
        if (!error) return "创建失败，请重试。";
        if (error.code === "STORAGE_FULL") {
            return "浏览器存储空间不足，请移除封面或更换较小的图片。";
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
    function validateCreatedBook(book) {
        if (!book || typeof book !== "object") {
            throw new Error("存储模块没有返回有效的书籍数据。");
        }
        var bookId =
            book.id !== undefined && book.id !== null
                ? book.id
                : book.bookId;
        if (
            bookId === undefined ||
            bookId === null ||
            String(bookId).trim() === ""
        ) {
            throw new Error(
                "书籍创建结果缺少 ID，请检查 storage.js。"
            );
        }
        return book;
    }
    /* ==================================================
       三十一、页面地址
    ================================================== */
    function getPageUrl(fileName) {
        var url = new URL(window.location.href);
        var suffix = "/pages/create-book.html";
        if (url.pathname.endsWith(suffix)) {
            url.pathname =
                url.pathname.slice(0, -suffix.length) +
                "/pages/" +
                fileName;
        } else {
            url.pathname =
                url.pathname.slice(
                    0,
                    url.pathname.lastIndexOf("/") + 1
                ) +
                fileName;
        }
        url.search = "";
        url.hash = "";
        return url.href;
    }
    function getCreatePageUrl() {
        return getPageUrl("create.html");
    }
    function getHomeUrl() {
        var url = new URL(window.location.href);
        var suffix = "/pages/create-book.html";
        if (url.pathname.endsWith(suffix)) {
            url.pathname =
                url.pathname.slice(0, -suffix.length) +
                "/index.html";
        } else {
            var pagesIndex = url.pathname.lastIndexOf("/pages/");
            if (pagesIndex !== -1) {
                url.pathname =
                    url.pathname.slice(0, pagesIndex) +
                    "/index.html";
            } else {
                url.pathname =
                    url.pathname.slice(
                        0,
                        url.pathname.lastIndexOf("/") + 1
                    ) +
                    "index.html";
            }
        }
        url.search = "";
        url.hash = "";
        return url.href;
    }
    /* ==================================================
       三十二、提交书籍
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
            showMessage(getCreateErrorMessage(error), "error");
            return;
        }
        isSubmitting = true;
        updateSubmitButton();
        try {
            var title = getTitleValue();
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
            redirectTimer = window.setTimeout(function () {
                window.location.replace(getHomeUrl());
            }, REDIRECT_DELAY);
        } catch (error) {
            console.error("[WritingCreateBook] 创建失败：", error);
            showMessage(getCreateErrorMessage(error), "error");
            isSubmitting = false;
            updateSubmitButton();
        }
    }
    /* ==================================================
       三十三、取消和返回
    ================================================== */
    function hasUnsavedInput() {
        return Boolean(
            elements.title.value.trim() ||
            selectedCoverData
        );
    }
    function handleCancel(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (isSubmitting || isSaved || isLeavingPage) return;
        if (cropIsOpen) {
            if (!window.confirm("封面正在裁剪，确定取消并离开吗？")) {
                return;
            }
            cancelCrop();
        }
        if (isProcessingImage) {
            if (!window.confirm("封面仍在处理中，确定放弃吗？")) {
                return;
            }
            imageSelectionToken++;
            isProcessingImage = false;
            updateSubmitButton();
        } else if (hasUnsavedInput()) {
            if (!window.confirm("当前书籍尚未创建，确定放弃填写吗？")) {
                return;
            }
        }
        isLeavingPage = true;
        window.location.assign(getCreatePageUrl());
    }
    function bindBackButton(button) {
        if (!button) return;
        button.addEventListener("click", handleCancel);
    }
    /* ==================================================
       三十四、绑定事件
    ================================================== */
    elements.title.maxLength = MAX_TITLE_LENGTH;
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
    elements.form.addEventListener("submit", handleSubmit);
    bindBackButton(elements.cancelButton);
    bindBackButton(elements.cancelTopButton);
    window.addEventListener("beforeunload", function (event) {
        if (isSubmitting || isSaved || isLeavingPage) return;
        if (!hasUnsavedInput()) return;
        event.preventDefault();
        event.returnValue = "";
    });
    /* ==================================================
       三十五、初始化
    ================================================== */
    function initialize() {
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
            elements.cropZoom.step = "0.01";
            elements.cropZoom.value = String(MIN_ZOOM);
        }
        if (elements.cropZoomValue) {
            elements.cropZoomValue.textContent = "100%";
        }
        console.info("[WritingCreateBook] 初始化完成。");
        console.info(
            "[WritingCreateBook] 封面输入框：",
            Boolean(elements.coverInput)
        );
        console.info(
            "[WritingCreateBook] 封面选择按钮：",
            Boolean(elements.coverSelectLabel)
        );
        console.info(
            "[WritingCreateBook] 裁剪界面完整：",
            hasCropElements()
        );
        console.info(
            "[WritingCreateBook] WritingStorage 可用：",
            Boolean(
                window.WritingStorage &&
                typeof window.WritingStorage.createBook === "function"
            )
        );
    }
    /* ==================================================
       三十六、公开接口
    ================================================== */
    window.WritingCreateBook = Object.freeze({
        validateTitle: validateTitle,
        clearCoverPreview: clearCoverPreview,
        resetCrop: resetCrop,
        cancelCrop: cancelCrop
    });
    initialize();
})();
