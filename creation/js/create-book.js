/* ======================================================
   写作软件 · 新建书籍
   文件：creation/js/create-book.js

   功能：
   1. 书名验证
   2. 选择、更换、移除封面
   3. 手动裁剪封面（2:3）
   4. 拖动、滑块缩放、双指缩放
   5. 输出 400 × 600 JPEG
   6. 创建书籍
   7. 防止重复提交
   8. 取消时确认放弃
   9. 兼容 GitHub Pages 项目路径
====================================================== */

(function () {
    "use strict";

    /* ==================================================
       一、配置
    ================================================== */

    const CONFIG = {
        maxTitleLength: 100,
        maxImageSize: 10 * 1024 * 1024,

        outputWidth: 400,
        outputHeight: 600,
        imageQuality: 0.82,

        minZoom: 1,
        maxZoom: 3,
        zoomStep: 0.1,

        redirectDelay: 600
    };


    /* ==================================================
       二、获取页面元素
    ================================================== */

    const $ = id => document.getElementById(id);

    const el = {
        form: $("create-book-form"),

        title: $("book-title"),
        titleCounter: $("book-title-counter"),
        titleError: $("book-title-error"),

        coverInput: $("book-cover-input"),
        coverPlaceholder: $("cover-placeholder"),
        coverPreview: $("cover-preview-image"),
        coverSelectLabel: $("cover-select-label"),
        removeCoverButton: $("remove-cover-button"),
        coverError: $("cover-error"),

        message: $("create-book-message"),
        submitButton: $("create-book-submit"),

        cancelButton: $("cancel-create-book"),
        cancelTopButton: $("cancel-create-book-top"),

        cropModal: $("cover-crop-modal"),
        cropBackdrop: $("cover-crop-backdrop"),
        cropCloseButton: $("cover-crop-close"),

        cropStage: $("cover-crop-stage"),
        cropImage: $("cover-crop-image"),

        cropZoom: $("cover-crop-zoom"),
        cropZoomValue: $("cover-crop-zoom-value"),

        cropZoomIn: $("cover-crop-zoom-in"),
        cropZoomOut: $("cover-crop-zoom-out"),

        cropReset: $("cover-crop-reset"),
        cropCancel: $("cover-crop-cancel"),
        cropConfirm: $("cover-crop-confirm")
    };


    /* ==================================================
       三、检查必要元素
    ================================================== */

    if (
        !el.form ||
        !el.title ||
        !el.coverInput ||
        !el.submitButton
    ) {
        console.error(
            "[WritingCreateBook] 页面缺少必要元素。"
        );

        return;
    }


    /* ==================================================
       四、运行状态
    ================================================== */

    const state = {
        cover: "",

        submitting: false,
        processingImage: false,

        saved: false,
        leaving: false,

        cropOpen: false,

        selectionToken: 0,
        redirectTimer: null
    };


    /* ==================================================
       五、裁剪状态
    ================================================== */

    const crop = {
        objectUrl: "",

        naturalWidth: 0,
        naturalHeight: 0,

        width: 0,
        height: 0,

        fitScale: 1,
        zoom: 1,

        left: 0,
        top: 0,

        pointers: new Map(),

        dragX: 0,
        dragY: 0,

        dragLeft: 0,
        dragTop: 0,

        pinchDistance: 0,
        pinchZoom: 1,
        pinchSource: null,

        previousFocus: null,

        resolve: null
    };


    const originalSubmitHTML = el.submitButton.innerHTML;


    /* ==================================================
       六、页面地址
    ================================================== */

    function getCreateUrl() {
        return new URL(
            "create.html",
            window.location.href
        ).href;
    }


    function getHomeUrl() {
        return new URL(
            "../index.html",
            window.location.href
        ).href;
    }


    /* ==================================================
       七、消息提示
    ================================================== */

    function showMessage(message, type = "info") {
        if (!el.message) return;

        el.message.textContent = String(message || "");

        el.message.classList.remove(
            "is-success",
            "is-error",
            "is-info"
        );

        el.message.classList.add("is-" + type);

        el.message.hidden = false;

        el.message.setAttribute(
            "role",
            type === "error" ? "alert" : "status"
        );
    }


    function hideMessage() {
        if (!el.message) return;

        el.message.textContent = "";
        el.message.hidden = true;

        el.message.classList.remove(
            "is-success",
            "is-error",
            "is-info"
        );

        el.message.removeAttribute("role");
    }


    /* ==================================================
       八、书名验证
    ================================================== */

    function getTitle() {
        return el.title.value.trim();
    }


    function setTitleError(message = "") {
        if (el.titleError) {
            el.titleError.textContent = message;
            el.titleError.hidden = !message;
        }

        if (message) {
            el.title.setAttribute("aria-invalid", "true");
        } else {
            el.title.removeAttribute("aria-invalid");
        }
    }


    function validateTitle() {
        const title = getTitle();

        if (!title) {
            setTitleError("请输入书名。");
            return false;
        }

        if (title.length > CONFIG.maxTitleLength) {
            setTitleError(
                "书名不能超过 " +
                CONFIG.maxTitleLength +
                " 个字符。"
            );

            return false;
        }

        setTitleError("");
        return true;
    }


    function updateTitleCounter() {
        if (!el.titleCounter) return;

        el.titleCounter.textContent =
            el.title.value.length +
            " / " +
            CONFIG.maxTitleLength;
    }


    /* ==================================================
       九、封面错误提示
    ================================================== */

    function setCoverError(message = "") {
        if (el.coverError) {
            el.coverError.textContent = message;
            el.coverError.hidden = !message;
        }

        if (message) {
            el.coverInput.setAttribute("aria-invalid", "true");
        } else {
            el.coverInput.removeAttribute("aria-invalid");
        }
    }


    /* ==================================================
       十、封面预览
    ================================================== */

    function updateCoverPreview() {
        const hasCover = Boolean(state.cover);

        if (el.coverPreview) {
            if (hasCover) {
                el.coverPreview.src = state.cover;
                el.coverPreview.hidden = false;
            } else {
                el.coverPreview.removeAttribute("src");
                el.coverPreview.hidden = true;
            }
        }

        if (el.coverPlaceholder) {
            el.coverPlaceholder.hidden = hasCover;
        }

        if (el.removeCoverButton) {
            el.removeCoverButton.hidden = !hasCover;
        }

        if (el.coverSelectLabel) {
            el.coverSelectLabel.textContent =
                hasCover ? "更换封面" : "选择封面";
        }
    }


    /* ==================================================
       十一、提交按钮
    ================================================== */

    function updateSubmitButton() {
        const busy =
            state.submitting ||
            state.processingImage;

        el.submitButton.disabled = busy;

        if (state.submitting) {
            el.submitButton.textContent = "正在创建……";
        } else if (state.processingImage) {
            el.submitButton.textContent = "正在处理封面……";
        } else {
            el.submitButton.innerHTML =
                originalSubmitHTML || "创建书籍";
        }

        if (busy) {
            el.submitButton.setAttribute("aria-busy", "true");
        } else {
            el.submitButton.removeAttribute("aria-busy");
        }
    }


    /* ==================================================
       十二、裁剪基础计算
    ================================================== */

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }


    function getScale() {
        return crop.fitScale * crop.zoom;
    }


    function clampCropPosition() {
        if (!crop.width || !crop.height) return;

        const scale = getScale();

        const imageWidth = crop.naturalWidth * scale;
        const imageHeight = crop.naturalHeight * scale;

        crop.left = clamp(
            crop.left,
            crop.width - imageWidth,
            0
        );

        crop.top = clamp(
            crop.top,
            crop.height - imageHeight,
            0
        );
    }


    function updateCropImage() {
        if (!el.cropImage || !crop.naturalWidth) return;

        const scale = getScale();

        const imageWidth = crop.naturalWidth * scale;
        const imageHeight = crop.naturalHeight * scale;

        clampCropPosition();

        el.cropImage.style.width = imageWidth + "px";
        el.cropImage.style.height = imageHeight + "px";

        el.cropImage.style.left = crop.left + "px";
        el.cropImage.style.top = crop.top + "px";

        el.cropZoom.value = String(crop.zoom);

        if (el.cropZoomValue) {
            el.cropZoomValue.textContent =
                Math.round(crop.zoom * 100) + "%";
        }

        if (el.cropZoomIn) {
            el.cropZoomIn.disabled =
                crop.zoom >= CONFIG.maxZoom;
        }

        if (el.cropZoomOut) {
            el.cropZoomOut.disabled =
                crop.zoom <= CONFIG.minZoom;
        }
    }


    function initializeCrop() {
        const rect = el.cropStage.getBoundingClientRect();

        crop.width = rect.width;
        crop.height = rect.height;

        if (!crop.width || !crop.height) {
            throw new Error(
                "裁剪区域尺寸无效，请检查 create-book.css。"
            );
        }

        crop.fitScale = Math.max(
            crop.width / crop.naturalWidth,
            crop.height / crop.naturalHeight
        );

        crop.zoom = CONFIG.minZoom;

        const imageWidth =
            crop.naturalWidth * crop.fitScale;

        const imageHeight =
            crop.naturalHeight * crop.fitScale;

        crop.left = (crop.width - imageWidth) / 2;
        crop.top = (crop.height - imageHeight) / 2;

        el.cropZoom.min = String(CONFIG.minZoom);
        el.cropZoom.max = String(CONFIG.maxZoom);
        el.cropZoom.step = "0.01";

        updateCropImage();
    }


    /* ==================================================
       十三、缩放
    ================================================== */

    function setZoom(value, centerX, centerY) {
        if (!crop.naturalWidth) return;

        const oldScale = getScale();

        const x = centerX ?? crop.width / 2;
        const y = centerY ?? crop.height / 2;

        const sourceX = (x - crop.left) / oldScale;
        const sourceY = (y - crop.top) / oldScale;

        crop.zoom = clamp(
            Number(value) || CONFIG.minZoom,
            CONFIG.minZoom,
            CONFIG.maxZoom
        );

        const newScale = getScale();

        crop.left = x - sourceX * newScale;
        crop.top = y - sourceY * newScale;

        updateCropImage();
    }


    function resetCrop() {
        if (!crop.naturalWidth) return;

        crop.zoom = CONFIG.minZoom;

        const imageWidth =
            crop.naturalWidth * crop.fitScale;

        const imageHeight =
            crop.naturalHeight * crop.fitScale;

        crop.left = (crop.width - imageWidth) / 2;
        crop.top = (crop.height - imageHeight) / 2;

        updateCropImage();
    }


    /* ==================================================
       十四、触摸和鼠标坐标
    ================================================== */

    function getStagePoint(x, y) {
        const rect = el.cropStage.getBoundingClientRect();

        return {
            x: x - rect.left,
            y: y - rect.top
        };
    }


    function getDistance(a, b) {
        return Math.hypot(
            a.x - b.x,
            a.y - b.y
        );
    }


    function getCenter(a, b) {
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        };
    }


    /* ==================================================
       十五、双指缩放
    ================================================== */

    function beginPinch() {
        if (crop.pointers.size !== 2) return;

        const points = Array.from(
            crop.pointers.values()
        ).map(point =>
            getStagePoint(point.x, point.y)
        );

        const center = getCenter(points[0], points[1]);

        crop.pinchDistance = getDistance(
            points[0],
            points[1]
        );

        crop.pinchZoom = crop.zoom;

        const scale = getScale();

        crop.pinchSource = {
            x: (center.x - crop.left) / scale,
            y: (center.y - crop.top) / scale
        };
    }


    function updatePinch() {
        if (
            crop.pointers.size !== 2 ||
            !crop.pinchDistance ||
            !crop.pinchSource
        ) {
            return;
        }

        const points = Array.from(
            crop.pointers.values()
        ).map(point =>
            getStagePoint(point.x, point.y)
        );

        const distance = getDistance(
            points[0],
            points[1]
        );

        const center = getCenter(
            points[0],
            points[1]
        );

        crop.zoom = clamp(
            crop.pinchZoom * distance / crop.pinchDistance,
            CONFIG.minZoom,
            CONFIG.maxZoom
        );

        const scale = getScale();

        crop.left =
            center.x - crop.pinchSource.x * scale;

        crop.top =
            center.y - crop.pinchSource.y * scale;

        updateCropImage();
    }


    /* ==================================================
       十六、拖动和指针事件
    ================================================== */

    function onPointerDown(event) {
        if (!state.cropOpen) return;

        if (
            event.pointerType === "mouse" &&
            event.button !== 0
        ) {
            return;
        }

        event.preventDefault();

        crop.pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });

        if (crop.pointers.size === 1) {
            crop.dragX = event.clientX;
            crop.dragY = event.clientY;

            crop.dragLeft = crop.left;
            crop.dragTop = crop.top;
        }

        if (crop.pointers.size === 2) {
            beginPinch();
        }
    }


    function onPointerMove(event) {
        if (
            !state.cropOpen ||
            !crop.pointers.has(event.pointerId)
        ) {
            return;
        }

        event.preventDefault();

        crop.pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });

        if (crop.pointers.size >= 2) {
            updatePinch();
            return;
        }

        crop.left =
            crop.dragLeft +
            event.clientX -
            crop.dragX;

        crop.top =
            crop.dragTop +
            event.clientY -
            crop.dragY;

        updateCropImage();
    }


    function onPointerEnd(event) {
        if (!crop.pointers.has(event.pointerId)) return;

        crop.pointers.delete(event.pointerId);

        crop.pinchDistance = 0;
        crop.pinchSource = null;

        if (crop.pointers.size === 1) {
            const point = Array.from(
                crop.pointers.values()
            )[0];

            crop.dragX = point.x;
            crop.dragY = point.y;

            crop.dragLeft = crop.left;
            crop.dragTop = crop.top;
        }

        if (crop.pointers.size === 2) {
            beginPinch();
        }
    }


    function attachPointerEvents() {
        document.addEventListener(
            "pointermove",
            onPointerMove,
            { capture: true, passive: false }
        );

        document.addEventListener(
            "pointerup",
            onPointerEnd,
            true
        );

        document.addEventListener(
            "pointercancel",
            onPointerEnd,
            true
        );
    }


    function detachPointerEvents() {
        document.removeEventListener(
            "pointermove",
            onPointerMove,
            true
        );

        document.removeEventListener(
            "pointerup",
            onPointerEnd,
            true
        );

        document.removeEventListener(
            "pointercancel",
            onPointerEnd,
            true
        );

        crop.pointers.clear();
    }


    /* ==================================================
       十七、释放裁剪资源
    ================================================== */

    function releaseCropResources() {
        if (crop.objectUrl) {
            URL.revokeObjectURL(crop.objectUrl);
            crop.objectUrl = "";
        }

        if (el.cropImage) {
            el.cropImage.onload = null;
            el.cropImage.onerror = null;

            el.cropImage.removeAttribute("src");

            el.cropImage.style.width = "";
            el.cropImage.style.height = "";
            el.cropImage.style.left = "";
            el.cropImage.style.top = "";
        }

        crop.naturalWidth = 0;
        crop.naturalHeight = 0;

        crop.width = 0;
        crop.height = 0;

        crop.fitScale = 1;
        crop.zoom = 1;

        crop.left = 0;
        crop.top = 0;

        crop.pinchDistance = 0;
        crop.pinchSource = null;

        crop.pointers.clear();
    }


    /* ==================================================
       十八、关闭裁剪弹窗
    ================================================== */

    function closeCropModal(result = false) {
        if (!state.cropOpen) return;

        state.cropOpen = false;

        detachPointerEvents();

        document.removeEventListener(
            "keydown",
            onCropKeydown,
            true
        );

        if (el.cropModal) {
            el.cropModal.hidden = true;
        }

        document.body.classList.remove("cover-crop-open");

        releaseCropResources();

        const resolve = crop.resolve;
        crop.resolve = null;

        if (resolve) {
            resolve(result);
        }

        if (
            crop.previousFocus &&
            document.contains(crop.previousFocus)
        ) {
            crop.previousFocus.focus();
        }

        crop.previousFocus = null;
    }


    /* ==================================================
       十九、取消裁剪
    ================================================== */

    function cancelCrop() {
        if (!state.cropOpen) return;

        state.selectionToken++;

        closeCropModal(false);

        el.coverInput.value = "";

        state.processingImage = false;

        updateSubmitButton();
    }


    function onCropKeydown(event) {
        if (
            state.cropOpen &&
            event.key === "Escape"
        ) {
            event.preventDefault();
            event.stopPropagation();

            cancelCrop();
        }
    }


    /* ==================================================
       二十、打开裁剪弹窗
    ================================================== */

    function openCropModal(file, token) {
        return new Promise((resolve, reject) => {
            if (
                !el.cropModal ||
                !el.cropStage ||
                !el.cropImage ||
                !el.cropZoom ||
                !el.cropConfirm ||
                !el.cropCancel
            ) {
                reject(
                    new Error("裁剪窗口的 HTML 元素不完整。")
                );

                return;
            }

            releaseCropResources();

            crop.previousFocus = document.activeElement;
            crop.resolve = resolve;

            state.cropOpen = true;

            try {
                crop.objectUrl = URL.createObjectURL(file);
            } catch (error) {
                crop.resolve = null;
                state.cropOpen = false;

                reject(
                    new Error("无法打开图片，请重新选择。")
                );

                return;
            }

            el.cropModal.hidden = false;

            document.body.classList.add("cover-crop-open");

            document.addEventListener(
                "keydown",
                onCropKeydown,
                true
            );

            attachPointerEvents();

            el.cropConfirm.disabled = true;
            el.cropCancel.disabled = false;
            el.cropZoom.disabled = true;

            if (el.cropCloseButton) {
                el.cropCloseButton.disabled = false;
            }

            if (el.cropReset) {
                el.cropReset.disabled = true;
            }

            el.cropImage.onload = () => {
                if (
                    token !== state.selectionToken ||
                    !state.cropOpen
                ) {
                    return;
                }

                crop.naturalWidth =
                    el.cropImage.naturalWidth;

                crop.naturalHeight =
                    el.cropImage.naturalHeight;

                if (
                    !crop.naturalWidth ||
                    !crop.naturalHeight
                ) {
                    closeCropModal(false);

                    reject(
                        new Error("图片尺寸无效，请重新选择。")
                    );

                    return;
                }

                requestAnimationFrame(() => {
                    if (
                        token !== state.selectionToken ||
                        !state.cropOpen
                    ) {
                        return;
                    }

                    try {
                        initializeCrop();

                        el.cropConfirm.disabled = false;
                        el.cropZoom.disabled = false;

                        if (el.cropReset) {
                            el.cropReset.disabled = false;
                        }

                        el.cropConfirm.focus();

                    } catch (error) {
                        closeCropModal(false);
                        reject(error);
                    }
                });
            };

            el.cropImage.onerror = () => {
                if (token !== state.selectionToken) return;

                closeCropModal(false);

                reject(
                    new Error("图片加载失败，请重新选择。")
                );
            };

            el.cropImage.src = crop.objectUrl;
        });
    }


    /* ==================================================
       二十一、生成封面图片
    ================================================== */

    function createCroppedCover() {
        if (
            !state.cropOpen ||
            !crop.naturalWidth ||
            !crop.naturalHeight ||
            !crop.width ||
            !crop.height
        ) {
            throw new Error("裁剪区域尚未准备好，请重试。");
        }

        const scale = getScale();

        const sourceX = -crop.left / scale;
        const sourceY = -crop.top / scale;

        const sourceWidth = crop.width / scale;
        const sourceHeight = crop.height / scale;

        const canvas = document.createElement("canvas");

        canvas.width = CONFIG.outputWidth;
        canvas.height = CONFIG.outputHeight;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("无法创建图片，请重试。");
        }

        try {
            context.fillStyle = "#FFFFFF";

            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";

            context.drawImage(
                el.cropImage,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                CONFIG.outputWidth,
                CONFIG.outputHeight
            );

            const result = canvas.toDataURL(
                "image/jpeg",
                CONFIG.imageQuality
            );

            if (!result.startsWith("data:image/jpeg;base64,")) {
                throw new Error("封面生成失败，请重试。");
            }

            return result;

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
            !state.cropOpen ||
            state.submitting ||
            !crop.naturalWidth
        ) {
            return;
        }

        el.cropConfirm.disabled = true;
        el.cropConfirm.textContent = "正在生成……";

        try {
            state.cover = createCroppedCover();

            updateCoverPreview();

            setCoverError("");
            hideMessage();

            closeCropModal(true);

            el.coverInput.value = "";

        } catch (error) {
            console.error(
                "[WritingCreateBook] 裁剪失败：",
                error
            );

            showMessage(
                error.message || "裁剪失败，请重试。",
                "error"
            );

            el.cropConfirm.disabled = false;

        } finally {
            el.cropConfirm.textContent = "确认裁剪";

            if (!state.cropOpen) {
                state.processingImage = false;
                updateSubmitButton();
            }
        }
    }


    /* ==================================================
       二十三、选择封面
    ================================================== */

    async function handleCoverSelection(file) {
        if (!file) return;

        setCoverError("");
        hideMessage();

        const token = ++state.selectionToken;

        if (
            !file.type ||
            !file.type.startsWith("image/")
        ) {
            setCoverError("请选择有效的图片文件。");
            return;
        }

        if (file.size > CONFIG.maxImageSize) {
            setCoverError(
                "图片不能超过 10 MB，请选择较小的图片。"
            );

            return;
        }

        state.processingImage = true;
        updateSubmitButton();

        showMessage("正在读取图片……");

        try {
            const result = await openCropModal(file, token);

            if (token !== state.selectionToken) return;

            if (result) {
                hideMessage();
            }

        } catch (error) {
            if (token !== state.selectionToken) return;

            console.error(
                "[WritingCreateBook] 图片处理失败：",
                error
            );

            if (state.cropOpen) {
                closeCropModal(false);
            }

            setCoverError(
                error.message || "封面处理失败，请重新选择图片。"
            );

            hideMessage();

            state.processingImage = false;
            updateSubmitButton();
        }
    }


    function openFilePicker() {
        if (
            state.submitting ||
            state.processingImage ||
            state.saved
        ) {
            return;
        }

        setCoverError("");
        hideMessage();

        el.coverInput.click();
    }


    el.coverInput.addEventListener("change", () => {
        const file =
            el.coverInput.files &&
            el.coverInput.files[0];

        el.coverInput.value = "";

        if (file) {
            handleCoverSelection(file);
        }
    });


    /* ==================================================
       二十四、移除封面
    ================================================== */

    function clearCoverPreview() {
        state.selectionToken++;

        if (state.cropOpen) {
            closeCropModal(false);
        }

        state.cover = "";

        el.coverInput.value = "";

        state.processingImage = false;

        setCoverError("");
        updateCoverPreview();
        updateSubmitButton();
    }


    if (el.removeCoverButton) {
        el.removeCoverButton.addEventListener("click", event => {
            event.preventDefault();

            if (
                state.submitting ||
                state.processingImage
            ) {
                return;
            }

            clearCoverPreview();
            hideMessage();
        });
    }


    /* ==================================================
       二十五、裁剪控件事件
    ================================================== */

    if (el.cropStage) {
        el.cropStage.style.touchAction = "none";

        el.cropStage.addEventListener(
            "pointerdown",
            onPointerDown
        );

        el.cropStage.addEventListener(
            "dragstart",
            event => event.preventDefault()
        );
    }


    if (el.cropZoom) {
        el.cropZoom.addEventListener("input", () => {
            setZoom(el.cropZoom.value);
        });
    }


    if (el.cropZoomIn) {
        el.cropZoomIn.addEventListener("click", () => {
            setZoom(crop.zoom + CONFIG.zoomStep);
        });
    }


    if (el.cropZoomOut) {
        el.cropZoomOut.addEventListener("click", () => {
            setZoom(crop.zoom - CONFIG.zoomStep);
        });
    }


    if (el.cropReset) {
        el.cropReset.addEventListener("click", resetCrop);
    }


    if (el.cropCancel) {
        el.cropCancel.addEventListener("click", cancelCrop);
    }


    if (el.cropConfirm) {
        el.cropConfirm.addEventListener("click", confirmCrop);
    }


    if (el.cropCloseButton) {
        el.cropCloseButton.addEventListener("click", event => {
            event.preventDefault();
            cancelCrop();
        });
    }


    if (el.cropBackdrop) {
        el.cropBackdrop.addEventListener("click", event => {
            event.preventDefault();
            cancelCrop();
        });
    }


    /* ==================================================
       二十六、存储模块
    ================================================== */

    function getStorage() {
        const storage = window.WritingStorage;

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
        if (!error) {
            return "创建失败，请重试。";
        }

        const messages = {
            STORAGE_FULL:
                "浏览器存储空间不足，请移除封面或更换较小的图片。",

            STORAGE_UNAVAILABLE:
                "当前浏览器无法使用本地存储，请检查浏览器设置。",

            TITLE_REQUIRED:
                "请输入书名。",

            INVALID_COVER:
                "封面格式不正确，请重新选择图片。"
        };

        return messages[error.code] ||
            error.message ||
            "创建失败，请重试。";
    }


    function validateCreatedBook(book) {
        if (!book || typeof book !== "object") {
            throw new Error(
                "存储模块没有返回有效的书籍数据。"
            );
        }

        const id = book.id ?? book.bookId;

        if (
            id === undefined ||
            id === null ||
            String(id).trim() === ""
        ) {
            throw new Error(
                "书籍创建结果缺少 ID，请检查 storage.js。"
            );
        }

        return book;
    }


    /* ==================================================
       二十七、创建书籍
    ================================================== */

    async function handleSubmit(event) {
        event.preventDefault();

        if (
            state.submitting ||
            state.processingImage ||
            state.saved ||
            state.cropOpen
        ) {
            return;
        }

        hideMessage();

        if (!validateTitle()) {
            el.title.focus();
            return;
        }

        let storage;

        try {
            storage = getStorage();
        } catch (error) {
            showMessage(
                getCreateErrorMessage(error),
                "error"
            );

            return;
        }

        state.submitting = true;
        updateSubmitButton();

        try {
            const title = getTitle();

            const result = await storage.createBook({
                title: title,
                description: "",
                cover: state.cover
            });

            const book = validateCreatedBook(result);

            state.saved = true;

            showMessage(
                "《" +
                (book.title || title) +
                "》创建成功！正在返回书架……",
                "success"
            );

            state.redirectTimer = window.setTimeout(() => {
                window.location.replace(getHomeUrl());
            }, CONFIG.redirectDelay);

        } catch (error) {
            console.error(
                "[WritingCreateBook] 创建失败：",
                error
            );

            showMessage(
                getCreateErrorMessage(error),
                "error"
            );

            state.submitting = false;
            updateSubmitButton();
        }
    }


    /* ==================================================
       二十八、取消和返回
    ================================================== */

    function hasUnsavedInput() {
        return Boolean(
            el.title.value.trim() ||
            state.cover
        );
    }


    function handleCancel(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (
            state.submitting ||
            state.saved ||
            state.leaving
        ) {
            return;
        }

        if (
            state.cropOpen ||
            state.processingImage ||
            hasUnsavedInput()
        ) {
            const confirmed = window.confirm(
                "当前书籍尚未创建，确定放弃填写并返回吗？"
            );

            if (!confirmed) return;
        }

        state.selectionToken++;

        if (state.cropOpen) {
            closeCropModal(false);
        }

        state.processingImage = false;

        updateSubmitButton();

        state.leaving = true;

        window.location.assign(getCreateUrl());
    }


    function bindCancelButton(button) {
        if (!button) return;

        button.addEventListener("click", handleCancel);
    }


    bindCancelButton(el.cancelButton);
    bindCancelButton(el.cancelTopButton);


    /* ==================================================
       二十九、输入事件
    ================================================== */

    el.title.maxLength = CONFIG.maxTitleLength;

    el.title.addEventListener("input", () => {
        updateTitleCounter();

        if (
            el.titleError &&
            !el.titleError.hidden
        ) {
            validateTitle();
        }

        hideMessage();
    });


    el.title.addEventListener("blur", () => {
        if (el.title.value.trim()) {
            validateTitle();
        }
    });


    el.form.addEventListener("submit", handleSubmit);


    /* ==================================================
       三十、离开页面保护
    ================================================== */

    window.addEventListener("beforeunload", event => {
        if (
            state.submitting ||
            state.saved ||
            state.leaving ||
            !hasUnsavedInput()
        ) {
            return;
        }

        event.preventDefault();
        event.returnValue = "";
    });


    /* ==================================================
       三十一、初始化
    ================================================== */

    function initialize() {
        updateTitleCounter();

        updateCoverPreview();

        updateSubmitButton();

        setTitleError("");
        setCoverError("");

        hideMessage();

        if (el.cropModal) {
            el.cropModal.hidden = true;
        }

        if (el.cropZoom) {
            el.cropZoom.min = String(CONFIG.minZoom);
            el.cropZoom.max = String(CONFIG.maxZoom);
            el.cropZoom.step = "0.01";
            el.cropZoom.value = String(CONFIG.minZoom);
        }

        if (el.cropZoomValue) {
            el.cropZoomValue.textContent = "100%";
        }

        console.info(
            "[WritingCreateBook] 初始化完成。"
        );

        console.info(
            "[WritingCreateBook] 存储模块：",
            Boolean(
                window.WritingStorage &&
                typeof window.WritingStorage.createBook === "function"
            )
        );
    }


    /* ==================================================
       三十二、公开接口
    ================================================== */

    window.WritingCreateBook = Object.freeze({
        validateTitle: validateTitle,
        clearCoverPreview: clearCoverPreview,
        resetCrop: resetCrop,
        cancelCrop: cancelCrop
    });


    initialize();

})();
