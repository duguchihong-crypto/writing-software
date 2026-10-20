/* ======================================================
   新建分组页面逻辑
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
       五、通用消息处理
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

       优先使用独立的分组接口。

       如果独立接口不存在，再尝试
       WritingStorage 中的兼容接口。
    ================================================== */

    function getStorage() {
        const groupStorage =
            window.WritingGroupsStorage;

        const writingStorage =
            window.WritingStorage;

        /*
         * 优先检查独立分组存储接口。
         */

        if (
            groupStorage &&
            typeof groupStorage.createGroup === "function" &&
            typeof groupStorage.getGroups === "function"
        ) {
            return groupStorage;
        }

        /*
         * 其次检查兼容接口。
         */

        if (
            writingStorage &&
            typeof writingStorage.createGroup === "function" &&
            typeof writingStorage.getGroups === "function"
        ) {
            return writingStorage;
        }

        /*
         * 尝试明确判断加载问题。
         */

        if (!window.WritingGroupsStorage) {
            throw new Error(
                "未找到独立分组存储接口。请检查 " +
                "js/groups-storage.js 是否加载成功，以及文件路径是否正确。"
            );
        }

        throw new Error(
            "分组存储接口缺少必要的方法。请检查 " +
            "js/groups-storage.js 中的 createGroup 和 getGroups 方法。"
        );
    }


    /* ==================================================
       十一、检查分组名称是否重复
    ================================================== */

    function hasDuplicateName(storage, name) {
        /*
         * 优先使用存储模块提供的方法。
         */

        if (
            typeof storage.hasGroupName === "function"
        ) {
            return storage.hasGroupName(name);
        }

        /*
         * 兼容没有 hasGroupName 的旧版本。
         */

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
       十二、返回新建选择页
    ================================================== */

    function navigateToCreatePage() {
        if (redirectTimer !== null) {
            window.clearTimeout(redirectTimer);

            redirectTimer = null;
        }

        if (
            window.WritingNavigation &&
            typeof window.WritingNavigation.navigate === "function"
        ) {
            window.WritingNavigation.navigate("create");

            return;
        }

        window.location.href = "./create.html";
    }


    /* ==================================================
       十三、创建分组
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
         * 验证名称。
         */

        if (!validateName()) {
            nameInput.focus();

            return;
        }

        const name = nameInput.value.trim();

        /*
         * 开始创建。
         */

        setSubmitting(true);

        try {
            /*
             * 获取正确的分组存储接口。
             */

            const storage = getStorage();

            /*
             * 检查重复名称。
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
             * 验证返回结果。
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
             * 标记创建成功。
             */

            isSaved = true;

            originalName = name;

            showMessage(
                "分组「" +
                group.name +
                "」创建成功！正在返回……",
                "success"
            );

            /*
             * 创建成功后延迟返回。
             */

            redirectTimer = window.setTimeout(
                function () {
                    navigateToCreatePage();
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
       十四、取消创建
    ================================================== */

    function handleCancel() {
        if (isSubmitting) {
            return;
        }

        const currentName = nameInput.value.trim();

        const hasChanged =
            currentName !== originalName.trim();

        /*
         * 输入内容发生变化时，提示用户。
         */

        if (hasChanged && !isSaved) {
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
       十五、监听输入变化
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
       十六、失去焦点时验证
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
       十七、绑定表单提交事件
    ================================================== */

    form.addEventListener(
        "submit",
        handleSubmit
    );


    /* ==================================================
       十八、绑定取消按钮
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
       十九、离开页面前提示
    ================================================== */

    window.addEventListener(
        "beforeunload",
        function (event) {
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
       二十、页面初始化
    ================================================== */

    function init() {
        updateNameCounter();

        clearNameError();

        hideMessage();

        originalName = nameInput.value;

        console.log(
            "[新建分组] 页面初始化成功。"
        );

        /*
         * 输出接口加载情况，便于排查问题。
         */

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
