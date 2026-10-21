/* ======================================================
   写作软件 · 新建分组页面逻辑
   文件：page-js/create-group.js

   功能：
   1. 验证分组名称
   2. 实时统计字数
   3. 检查重复名称
   4. 创建并保存分组
   5. 处理创建成功与失败
   6. 取消创建及返回操作
   7. 提示未保存内容
   8. 防止重复提交
   9. 兼容 WritingGroupsStorage
   10. 兼容 WritingStorage
   11. 兼容 WritingNavigation
   12. 创建成功后返回首页
   13. 兼容 GitHub Pages 项目路径
====================================================== */

(function () {
    "use strict";


    /* ==================================================
       一、获取页面元素
    ================================================== */

    const form = document.getElementById(
        "create-group-form"
    );

    const nameInput = document.getElementById(
        "group-name"
    );

    const nameCounter = document.getElementById(
        "group-name-counter"
    );

    const nameError = document.getElementById(
        "group-name-error"
    );

    const message = document.getElementById(
        "create-group-message"
    );

    const submitButton = document.getElementById(
        "create-group-submit"
    );

    const cancelButton = document.getElementById(
        "cancel-create-group"
    );

    const cancelTopButton = document.getElementById(
        "cancel-create-group-top"
    );


    /* ==================================================
       二、检查必要的页面元素
    ================================================== */

    if (
        !form ||
        !nameInput ||
        !submitButton
    ) {
        console.error(
            "[新建分组] 页面初始化失败：缺少必要的 HTML 元素。"
        );

        return;
    }


    /* ==================================================
       三、基础配置
    ================================================== */

    const MAX_NAME_LENGTH = 50;

    const REDIRECT_DELAY = 600;


    /* ==================================================
       四、页面状态
    ================================================== */

    let isSubmitting = false;

    let isSaved = false;

    let originalName = nameInput.value;

    let redirectTimer = null;

    const originalSubmitHTML = submitButton.innerHTML;


    /* ==================================================
       五、消息处理
    ================================================== */

    function showMessage(text, type) {
        if (!message) {
            return;
        }

        message.textContent = String(text || "");

        message.className = "create-group-message";

        if (type === "success") {
            message.classList.add(
                "create-group-message--success"
            );
        }

        if (type === "error") {
            message.classList.add(
                "create-group-message--error"
            );
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
       六、分组名称错误提示
    ================================================== */

    function showNameError(text) {
        if (nameError) {
            nameError.textContent = text;

            nameError.hidden = false;
        }

        nameInput.setAttribute(
            "aria-invalid",
            "true"
        );
    }


    function clearNameError() {
        if (nameError) {
            nameError.textContent = "";

            nameError.hidden = true;
        }

        nameInput.removeAttribute(
            "aria-invalid"
        );
    }


    /* ==================================================
       七、更新名称字数
    ================================================== */

    function updateNameCounter() {
        if (!nameCounter) {
            return;
        }

        const length = nameInput.value.length;

        const maxLength =
            Number(nameInput.maxLength) > 0
                ? Number(nameInput.maxLength)
                : MAX_NAME_LENGTH;

        nameCounter.textContent =
            length + " / " + maxLength;

        if (length >= maxLength) {
            nameCounter.setAttribute(
                "data-limit",
                "true"
            );
        } else {
            nameCounter.removeAttribute(
                "data-limit"
            );
        }
    }


    /* ==================================================
       八、验证分组名称
    ================================================== */

    function validateName() {
        const name = nameInput.value.trim();

        clearNameError();

        if (!name) {
            showNameError(
                "请输入分组名称。"
            );

            return false;
        }

        if (name.length > MAX_NAME_LENGTH) {
            showNameError(
                "分组名称不能超过 50 个字符。"
            );

            return false;
        }

        return true;
    }


    /* ==================================================
       九、设置提交状态
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

        if (submitting) {
            submitButton.innerHTML =
                '<span aria-hidden="true">…</span>' +
                '<span>正在创建</span>';

            submitButton.setAttribute(
                "aria-busy",
                "true"
            );
        } else {
            submitButton.innerHTML =
                originalSubmitHTML;

            submitButton.removeAttribute(
                "aria-busy"
            );
        }
    }


    /* ==================================================
       十、获取分组存储模块
    ================================================== */

    function getStorage() {
        const groupStorage =
            window.WritingGroupsStorage;

        const writingStorage =
            window.WritingStorage;

        /*
         * 优先使用独立分组存储模块。
         */

        if (
            groupStorage &&
            typeof groupStorage.createGroup === "function" &&
            typeof groupStorage.getGroups === "function"
        ) {
            return groupStorage;
        }

        /*
         * 兼容 WritingStorage。
         */

        if (
            writingStorage &&
            typeof writingStorage.createGroup === "function" &&
            typeof writingStorage.getGroups === "function"
        ) {
            return writingStorage;
        }

        throw new Error(
            "分组存储接口不可用，请检查 groups-storage.js 是否正确加载。"
        );
    }


    /* ==================================================
       十一、检查分组名称是否重复
    ================================================== */

    function hasDuplicateName(storage, name) {
        if (
            typeof storage.hasGroupName === "function"
        ) {
            return storage.hasGroupName(name);
        }

        const groups = storage.getGroups();

        if (!Array.isArray(groups)) {
            throw new Error(
                "无法读取现有分组，请刷新页面后重试。"
            );
        }

        const normalizedName = name
            .trim()
            .toLocaleLowerCase();

        return groups.some(function (group) {
            return String(group.name || "")
                .trim()
                .toLocaleLowerCase() === normalizedName;
        });
    }


    /* ==================================================
       十二、清除跳转定时器
    ================================================== */

    function clearRedirectTimer() {
        if (redirectTimer !== null) {
            window.clearTimeout(redirectTimer);

            redirectTimer = null;
        }
    }


    /* ==================================================
       十三、返回首页
       
       优先使用 WritingNavigation.goHome()。
       如果导航模块不可用，则根据当前页面
       的实际 URL 计算项目根目录。
    ================================================== */

    function navigateToHome() {
        clearRedirectTimer();

        console.log(
            "[新建分组] 准备返回首页。"
        );

        /*
         * 方法一：使用统一导航模块。
         */

        if (
            window.WritingNavigation &&
            typeof window.WritingNavigation.goHome === "function"
        ) {
            try {
                window.WritingNavigation.goHome();

                return;

            } catch (error) {
                console.error(
                    "[新建分组] 导航模块跳转失败：",
                    error
                );
            }
        }

        /*
         * 方法二：直接根据当前 URL 计算首页。
         *
         * 例如：
         * /writing-software/pages/create-group.html
         *
         * 转换为：
         * /writing-software/index.html
         *
         * 不把首页错误地指向域名根目录。
         */

        try {
            const currentUrl = new URL(
                window.location.href
            );

            const currentPath = currentUrl.pathname;

            const pageSuffix = "/pages/create-group.html";

            if (currentPath.endsWith(pageSuffix)) {
                currentUrl.pathname =
                    currentPath.slice(
                        0,
                        -pageSuffix.length
                    ) + "/index.html";

            } else {
                /*
                 * 兼容页面目录结构发生变化的情况。
                 */

                const lastSlashIndex =
                    currentPath.lastIndexOf("/");

                const currentDirectory =
                    currentPath.slice(
                        0,
                        lastSlashIndex + 1
                    );

                currentUrl.pathname =
                    currentDirectory + "index.html";
            }

            currentUrl.search = "";

            currentUrl.hash = "";

            console.log(
                "[新建分组] 首页地址：",
                currentUrl.href
            );

            window.location.replace(
                currentUrl.href
            );

        } catch (error) {
            console.error(
                "[新建分组] 无法计算首页地址：",
                error
            );

            showMessage(
                "分组已创建成功，但无法自动返回首页。请点击返回书架。",
                "success"
            );
        }
    }


    /* ==================================================
       十四、返回创建选择页
       
       取消创建时使用，不影响创建成功后的跳转。
    ================================================== */

    function navigateToCreatePage() {
        clearRedirectTimer();

        /*
         * 优先使用统一导航模块。
         */

        if (
            window.WritingNavigation &&
            typeof window.WritingNavigation.goCreate === "function"
        ) {
            try {
                window.WritingNavigation.goCreate();

                return;

            } catch (error) {
                console.error(
                    "[新建分组] 返回创建页面失败：",
                    error
                );
            }
        }

        /*
         * 备用方案。
         *
         * create.html 与 create-group.html
         * 位于同一个 pages/ 目录。
         */

        window.location.href = "./create.html";
    }


    /* ==================================================
       十五、创建分组
    ================================================== */

    function handleSubmit(event) {
        event.preventDefault();

        /*
         * 防止重复提交。
         */

        if (isSubmitting || isSaved) {
            return;
        }

        hideMessage();

        clearNameError();

        /*
         * 验证分组名称。
         */

        if (!validateName()) {
            nameInput.focus();

            return;
        }

        const name = nameInput.value.trim();

        /*
         * 开始提交。
         */

        setSubmitting(true);

        try {
            const storage = getStorage();

            /*
             * 检查名称是否重复。
             */

            if (hasDuplicateName(storage, name)) {
                setSubmitting(false);

                showNameError(
                    "已经存在同名分组，请换一个名称。"
                );

                nameInput.focus();

                return;
            }

            /*
             * 创建并保存分组。
             */

            const group = storage.createGroup({
                name: name
            });

            /*
             * 检查创建结果。
             */

            if (
                !group ||
                !group.id ||
                !group.name
            ) {
                throw new Error(
                    "分组未能成功保存，请稍后重试。"
                );
            }

            /*
             * 标记保存成功。
             */

            isSaved = true;

            originalName = name;

            /*
             * 显示创建成功消息。
             */

            showMessage(
                "分组「" +
                group.name +
                "」创建成功！正在返回首页……",
                "success"
            );

            console.log(
                "[新建分组] 创建成功：",
                group
            );

            /*
             * 创建成功后，延迟 600 毫秒返回首页。
             */

            clearRedirectTimer();

            redirectTimer = window.setTimeout(
                function () {
                    navigateToHome();
                },
                REDIRECT_DELAY
            );

        } catch (error) {
            console.error(
                "[新建分组] 创建失败：",
                error
            );

            setSubmitting(false);

            showMessage(
                error && error.message
                    ? error.message
                    : "创建分组失败，请稍后重试。",
                "error"
            );
        }
    }


    /* ==================================================
       十六、取消创建
    ================================================== */

    function handleCancel() {
        if (isSubmitting || isSaved) {
            return;
        }

        const currentName =
            nameInput.value.trim();

        const hasChanged =
            currentName !== originalName.trim();

        /*
         * 如果输入内容发生变化，提示用户。
         */

        if (hasChanged) {
            const confirmed = window.confirm(
                "分组名称尚未保存，确定放弃本次创建吗？"
            );

            if (!confirmed) {
                return;
            }
        }

        navigateToCreatePage();
    }


    /* ==================================================
       十七、监听输入变化
    ================================================== */

    function handleInput() {
        updateNameCounter();

        clearNameError();

        hideMessage();
    }


    nameInput.addEventListener(
        "input",
        handleInput
    );


    /* ==================================================
       十八、失去焦点时验证
    ================================================== */

    nameInput.addEventListener(
        "blur",
        function () {
            if (nameInput.value.trim()) {
                validateName();
            }
        }
    );


    /* ==================================================
       十九、绑定表单提交事件
    ================================================== */

    form.addEventListener(
        "submit",
        handleSubmit
    );


    /* ==================================================
       二十、绑定取消按钮
    ================================================== */

    if (cancelButton) {
        cancelButton.addEventListener(
            "click",
            handleCancel
        );
    }

    if (cancelTopButton) {
        cancelTopButton.addEventListener(
            "click",
            handleCancel
        );
    }


    /* ==================================================
       二十一、离开页面前提示
    ================================================== */

    window.addEventListener(
        "beforeunload",
        function (event) {
            /*
             * 正在提交或已经成功保存时，不提示。
             */

            if (isSubmitting || isSaved) {
                return;
            }

            const currentName =
                nameInput.value.trim();

            const hasChanged =
                currentName !== originalName.trim();

            if (!hasChanged) {
                return;
            }

            event.preventDefault();

            event.returnValue = "";
        }
    );


    /* ==================================================
       二十二、页面初始化
    ================================================== */

    function init() {
        updateNameCounter();

        clearNameError();

        hideMessage();

        originalName = nameInput.value;

        console.log(
            "[新建分组] 页面初始化成功。"
        );

        console.log(
            "[新建分组] 当前页面地址：",
            window.location.href
        );

        console.log(
            "[新建分组] WritingNavigation：",
            Boolean(window.WritingNavigation)
        );

        console.log(
            "[新建分组] WritingGroupsStorage：",
            Boolean(window.WritingGroupsStorage)
        );

        console.log(
            "[新建分组] WritingStorage：",
            Boolean(window.WritingStorage)
        );
    }


    init();


})();
