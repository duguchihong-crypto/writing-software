/* ======================================================
   新建书籍页面逻辑
   文件：page-js/create-book.js

   功能：
   1. 书名字符计数
   2. 封面图片选择
   3. 封面图片预览
   4. 移除封面
   5. 图片压缩
   6. 书名验证
   7. 创建书籍
   8. 保存封面
   9. 防止重复提交
====================================================== */

(function () {
    "use strict";


    /* ==================================================
       一、配置
    ================================================== */

    const CONFIG = Object.freeze({
        titleMaxLength: 100,

        // 原始图片最大允许 10 MB
        maxImageSize: 10 * 1024 * 1024,

        // 压缩后图片最长边
        maxImageDimension: 1200,

        // JPEG 压缩质量
        imageQuality: 0.82,

        // 封面单独保存使用的本地存储键
        coverStorageKey: "writing-software-book-covers"
    });


    /* ==================================================
       二、页面元素
    ================================================== */

    const elements = {};

    let selectedCover = null;

    let selectedCoverData = "";

    let isSubmitting = false;

    let objectUrl = null;


    /* ==================================================
       三、获取页面元素
    ================================================== */

    function collectElements() {
        elements.form =
            document.getElementById("create-book-form");

        elements.title =
            document.getElementById("book-title");

        elements.titleCounter =
            document.getElementById("book-title-counter");

        elements.titleError =
            document.getElementById("book-title-error");

        elements.coverInput =
            document.getElementById("book-cover-input");

        elements.coverPreview =
            document.getElementById("cover-preview");

        elements.coverPlaceholder =
            document.getElementById("cover-placeholder");

        elements.coverImage =
            document.getElementById("cover-preview-image");

        elements.coverSelectLabel =
            document.getElementById("cover-select-label");

        elements.removeCoverButton =
            document.getElementById("remove-cover-button");

        elements.coverError =
            document.getElementById("cover-error");

        elements.message =
            document.getElementById("create-book-message");

        elements.submitButton =
            document.getElementById("create-book-submit");

        elements.cancelButton =
            document.getElementById("cancel-create-book");

        elements.cancelTopButton =
            document.getElementById("cancel-create-book-top");
    }


    /* ==================================================
       四、检查依赖
    ================================================== */

    function checkDependencies() {
        if (!elements.form) {
            console.error(
                "[CreateBook] 找不到新建书籍表单。"
            );

            return false;
        }

        if (!elements.title || !elements.coverInput) {
            console.error(
                "[CreateBook] 缺少必要的输入元素。"
            );

            return false;
        }

        if (!window.WritingStorage) {
            console.error(
                "[CreateBook] WritingStorage 尚未加载。"
            );

            showMessage(
                "本地数据模块尚未加载，请刷新页面后重试。",
                "error"
            );

            return false;
        }

        return true;
    }


    /* ==================================================
       五、通用消息
    ================================================== */

    function showMessage(message, type) {
        if (!elements.message) {
            return;
        }

        elements.message.textContent = message;

        elements.message.hidden = false;

        elements.message.dataset.type = type || "info";
    }


    function hideMessage() {
        if (!elements.message) {
            return;
        }

        elements.message.hidden = true;

        elements.message.textContent = "";

        delete elements.message.dataset.type;
    }


    /* ==================================================
       六、书名字符计数
    ================================================== */

    function updateTitleCounter() {
        if (!elements.title || !elements.titleCounter) {
            return;
        }

        const value = elements.title.value;

        const length = Array.from(value).length;

        elements.titleCounter.textContent =
            length + " / " + CONFIG.titleMaxLength;
    }


    /* ==================================================
       七、书名验证
    ================================================== */

    function clearTitleError() {
        if (!elements.title || !elements.titleError) {
            return;
        }

        elements.title.removeAttribute("aria-invalid");

        elements.titleError.hidden = true;

        elements.titleError.textContent = "";
    }


    function setTitleError(message) {
        if (!elements.title || !elements.titleError) {
            return;
        }

        elements.title.setAttribute(
            "aria-invalid",
            "true"
        );

        elements.titleError.textContent = message;

        elements.titleError.hidden = false;
    }


    function validateTitle() {
        const title = elements.title.value.trim();

        clearTitleError();

        if (!title) {
            setTitleError("请输入书名。");

            elements.title.focus();

            return null;
        }

        if (Array.from(title).length > CONFIG.titleMaxLength) {
            setTitleError(
                "书名不能超过 " +
                CONFIG.titleMaxLength +
                " 个字符。"
            );

            elements.title.focus();

            return null;
        }

        return title;
    }


    /* ==================================================
       八、封面错误提示
    ================================================== */

    function clearCoverError() {
        if (!elements.coverError) {
            return;
        }

        elements.coverError.hidden = true;

        elements.coverError.textContent = "";
    }


    function setCoverError(message) {
        if (!elements.coverError) {
            return;
        }

        elements.coverError.textContent = message;

        elements.coverError.hidden = false;
    }


    /* ==================================================
       九、释放图片预览资源
    ================================================== */

    function revokeObjectUrl() {
        if (!objectUrl) {
            return;
        }

        URL.revokeObjectURL(objectUrl);

        objectUrl = null;
    }


    /* ==================================================
       十、显示封面预览
    ================================================== */

    function showCoverPreview(dataUrl) {
        elements.coverImage.src = dataUrl;

        elements.coverImage.hidden = false;

        elements.coverPlaceholder.hidden = true;

        elements.removeCoverButton.hidden = false;

        elements.coverSelectLabel.textContent = "更换封面";
    }


    /* ==================================================
       十一、清除封面预览
    ================================================== */

    function clearCoverPreview() {
        selectedCover = null;

        selectedCoverData = "";

        revokeObjectUrl();

        elements.coverInput.value = "";

        elements.coverImage.removeAttribute("src");

        elements.coverImage.hidden = true;

        elements.coverPlaceholder.hidden = false;

        elements.removeCoverButton.hidden = true;

        elements.coverSelectLabel.textContent = "选择封面";

        clearCoverError();
    }


    /* ==================================================
       十二、读取图片
    ================================================== */

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.onload = function () {
                if (typeof reader.result !== "string") {
                    reject(
                        new Error("无法读取所选图片。")
                    );

                    return;
                }

                resolve(reader.result);
            };

            reader.onerror = function () {
                reject(
                    new Error("读取图片失败，请重新选择。")
                );
            };

            reader.onabort = function () {
                reject(
                    new Error("图片读取已取消。")
                );
            };

            reader.readAsDataURL(file);
        });
    }


    /* ==================================================
       十三、加载图片对象
    ================================================== */

    function loadImage(dataUrl) {
        return new Promise(function (resolve, reject) {
            const image = new Image();

            image.onload = function () {
                resolve(image);
            };

            image.onerror = function () {
                reject(
                    new Error(
                        "无法识别这张图片，请换一张图片试试。"
                    )
                );
            };

            image.src = dataUrl;
        });
    }


    /* ==================================================
       十四、压缩封面
    ================================================== */

    async function compressCover(file) {
        const originalDataUrl =
            await readFileAsDataUrl(file);

        const image =
            await loadImage(originalDataUrl);

        const originalWidth = image.naturalWidth;

        const originalHeight = image.naturalHeight;

        if (!originalWidth || !originalHeight) {
            throw new Error("图片尺寸无效。");
        }

        const scale = Math.min(
            1,
            CONFIG.maxImageDimension / originalWidth,
            CONFIG.maxImageDimension / originalHeight
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
            throw new Error("当前浏览器无法处理图片。");
        }

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        const compressedDataUrl = canvas.toDataURL(
            "image/jpeg",
            CONFIG.imageQuality
        );

        canvas.width = 0;

        canvas.height = 0;

        return compressedDataUrl;
    }


    /* ==================================================
       十五、选择封面
    ================================================== */

    async function handleCoverSelection() {
        const file = elements.coverInput.files[0];

        clearCoverError();

        hideMessage();

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            clearCoverPreview();

            setCoverError("请选择图片文件。");

            return;
        }

        if (file.size > CONFIG.maxImageSize) {
            clearCoverPreview();

            setCoverError(
                "图片不能超过 10 MB，请先压缩图片后再选择。"
            );

            return;
        }

        if (file.size === 0) {
            clearCoverPreview();

            setCoverError("这张图片是空文件，请重新选择。");

            return;
        }

        elements.coverSelectLabel.textContent = "正在处理…";

        try {
            const compressedDataUrl =
                await compressCover(file);

            selectedCover = file;

            selectedCoverData = compressedDataUrl;

            showCoverPreview(compressedDataUrl);

        } catch (error) {
            console.error(
                "[CreateBook] 封面处理失败：",
                error
            );

            clearCoverPreview();

            setCoverError(
                error.message ||
                "处理封面失败，请重新选择图片。"
            );

        }
    }


    /* ==================================================
       十六、保存封面数据
    ================================================== */

    function readCoverDatabase() {
        const raw = localStorage.getItem(
            CONFIG.coverStorageKey
        );

        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {
            return {};
        }

        return parsed;
    }


    function saveCoverForBook(bookId, coverData) {
        if (!bookId || !coverData) {
            return;
        }

        const covers = readCoverDatabase();

        covers[bookId] = {
            data: coverData,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(
            CONFIG.coverStorageKey,
            JSON.stringify(covers)
        );
    }


    /* ==================================================
       十七、按钮加载状态
    ================================================== */

    function setSubmittingState(submitting) {
        isSubmitting = submitting;

        if (!elements.submitButton) {
            return;
        }

        elements.submitButton.disabled = submitting;

        if (submitting) {
            elements.submitButton.dataset.originalText =
                elements.submitButton.textContent;

            elements.submitButton.textContent =
                "正在创建…";

        } else {
            elements.submitButton.textContent =
                elements.submitButton.dataset.originalText ||
                "＋ 创建书籍";

            delete elements.submitButton.dataset.originalText;
        }
    }


    /* ==================================================
       十八、创建书籍
    ================================================== */

    async function handleSubmit(event) {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        hideMessage();

        const title = validateTitle();

        if (!title) {
            return;
        }

        setSubmittingState(true);

        try {
            /*
             * 先创建书籍。
             *
             * 当前公共存储接口支持：
             * WritingStorage.createBook({
             *     title: "书名",
             *     description: ""
             * })
             */

            const book = window.WritingStorage.createBook({
                title: title,
                description: ""
            });

            if (!book || !book.id) {
                throw new Error(
                    "书籍创建失败，没有获取到书籍编号。"
                );
            }

            /*
             * 封面暂时保存在独立的本地存储表中。
             * 后续扩展公共存储接口时，会统一封面数据管理。
             */

            if (selectedCoverData) {
                try {
                    saveCoverForBook(
                        book.id,
                        selectedCoverData
                    );

                } catch (coverError) {
                    console.error(
                        "[CreateBook] 封面保存失败：",
                        coverError
                    );

                    showMessage(
                        "书籍已创建，但封面保存失败。可能是浏览器本地存储空间不足，请稍后重新设置封面。",
                        "warning"
                    );

                    setSubmittingState(false);

                    return;
                }
            }

            /*
             * 创建完成后返回书架。
             */

            showMessage("书籍创建成功！正在返回书架…", "success");

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
                "[CreateBook] 创建书籍失败：",
                error
            );

            let message = "创建书籍失败，请稍后重试。";

            if (
                error &&
                (
                    error.name === "QuotaExceededError" ||
                    error.code === "QUOTA_EXCEEDED"
                )
            ) {
                message =
                    "浏览器本地存储空间不足，请清理空间后重试。";

            } else if (error && error.message) {
                message = error.message;
            }

            showMessage(message, "error");

            setSubmittingState(false);
        }
    }


    /* ==================================================
       十九、取消创建
    ================================================== */

    function handleCancel() {
        const title = elements.title.value.trim();

        const hasChanges =
            title.length > 0 ||
            Boolean(selectedCoverData);

        if (hasChanges) {
            const confirmed = window.confirm(
                "你已经填写了部分信息，确定放弃本次创建吗？"
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
       二十、绑定事件
    ================================================== */

    function bindEvents() {
        elements.title.addEventListener(
            "input",
            function () {
                updateTitleCounter();

                clearTitleError();

                hideMessage();
            }
        );

        elements.coverInput.addEventListener(
            "change",
            handleCoverSelection
        );

        elements.removeCoverButton.addEventListener(
            "click",
            function () {
                clearCoverPreview();

                hideMessage();
            }
        );

        elements.form.addEventListener(
            "submit",
            handleSubmit
        );

        elements.cancelButton.addEventListener(
            "click",
            handleCancel
        );

        elements.cancelTopButton.addEventListener(
            "click",
            handleCancel
        );

        window.addEventListener(
            "beforeunload",
            revokeObjectUrl
        );
    }


    /* ==================================================
       二十一、初始化
    ================================================== */

    function init() {
        collectElements();

        if (!checkDependencies()) {
            return;
        }

        updateTitleCounter();

        bindEvents();

        console.log(
            "[CreateBook] 新建书籍页面已初始化。"
        );
    }


    /* ==================================================
       二十二、公开接口
    ================================================== */

    window.WritingCreateBook = Object.freeze({
        init: init,

        updateTitleCounter: updateTitleCounter,

        clearCoverPreview: clearCoverPreview
    });


    /* ==================================================
       二十三、启动
    ================================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );

    } else {
        init();
    }

})();
