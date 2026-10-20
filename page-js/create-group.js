/* ======================================================
   新建分组页面逻辑
   文件：page-js/create-group.js

   功能：
   1. 验证分组名称
   2. 实时统计字数
   3. 检查重复名称
   4. 创建并保存分组
   5. 取消创建
   6. 提示未保存内容
   7. 处理存储错误
====================================================== */

(function () {
    "use strict";

    /* ==================================================
       一、获取页面元素
    ================================================== */

    const form = document.getElementById("create-group-form");

    const nameInput = document.getElementById("group-name");

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
       二、检查页面结构
    ================================================== */

    if (!form || !nameInput || !submitButton) {
        console.error(
            "新建分组页面初始化失败：缺少必要的 HTML 元素。"
        );

        return;
    }


    /* ==================================================
       三、页面状态
    ================================================== */

    let isSubmitting = false;

    let isSaved = false;

    let originalName = nameInput.value;

    /*
     * 保存按钮原始 HTML。
     * 用于恢复原来的加号图标和文字。
     */

    const originalSubmitHTML = submitButton.innerHTML;


    /* ==================================================
       四、消息处理
    ================================================== */

    function showMessage(text, type) {
        if (!message) {
            return;
        }

        message.textContent = text;

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
       五、名称错误提示
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

        nameInput.removeAttribute("aria-invalid");
    }


    /* ==================================================
       六、字数统计
    ================================================== */

    function updateNameCounter() {
        if (!nameCounter) {
            return;
        }

        const length = nameInput.value.length;

        const maxLength = Number(nameInput.maxLength) || 50;

        nameCounter.textContent =
            length + " / " + maxLength;
    }


    /* ==================================================
       七、名称验证
    ================================================== */

    function validateName() {
        const name = nameInput.value.trim();

        clearNameError();

        if (!name) {
            showNameError("请输入分组名称。");

            return false;
        }

        if (name.length > 50) {
            showNameError(
                "分组名称不能超过 50 个字符。"
            );

            return false;
        }

        return true;
    }


    /* ==================================================
       八、按钮状态
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
            submitButton.textContent = "正在创建……";
        } else {
            submitButton.innerHTML = originalSubmitHTML;
        }
    }


    /* ==================================================
       九、获取存储模块
    ================================================== */

    function getStorage() {
        const storage = window.WritingStorage;

        if (!storage) {
            showMessage(
                "存储模块尚未加载，请刷新页面后重试。",
                "error"
            );

            console.error(
                "WritingStorage 不存在。"
            );

            return null;
        }

        if (
            typeof storage.createGroup !== "function" ||
            typeof storage.getGroups !== "function"
        ) {
            showMessage(
                "分组存储功能尚未正确加载，请检查 groups-storage.js。",
                "error"
            );

            console.error(
                "WritingStorage 缺少 createGroup 或 getGroups 方法。"
            );

            return null;
        }

        return storage;
    }


    /* ==================================================
       十、检查重复名称
    ================================================== */

    function hasDuplicateName(storage, name) {
        /*
         * 优先使用存储模块提供的检查方法。
         */

        if (
            typeof storage.hasGroupName === "function"
        ) {
            return storage.hasGroupName(name);
        }

        /*
         * 兼容没有 hasGroupName 方法的情况。
         */

        const groups = storage.getGroups();

        if (!Array.isArray(groups)) {
            throw new Error(
                "无法读取分组列表，请刷新页面后重试。"
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
       十一、创建分组
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

        /*
         * 检查分组名称。
         */

        if (!validateName()) {
            nameInput.focus();

            return;
        }

        const name = nameInput.value.trim();

        /*
         * 获取存储接口。
         */

        const storage = getStorage();

        if (!storage) {
            return;
        }

        /*
         * 开始检查及保存。
         */

        setSubmitting(true);

        try {
            /*
             * 检查是否重名。
             * 如果读取数据失败，将进入 catch，
             * 不会继续创建。
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
             * 调用分组存储模块。
             */

            const group = storage.createGroup({
                name: name
            });

            /*
             * 验证保存结果。
             */

            if (!group || !group.id) {
                throw new Error(
                    "分组创建失败，请稍后重试。"
                );
            }

            /*
             * 创建成功。
             */

            isSaved = true;

            originalName = name;

            showMessage(
                "分组创建成功！正在返回新建页面……",
                "success"
            );

            /*
             * 延迟跳转，让用户看到成功提示。
             */

            window.setTimeout(function () {
                if (window.WritingNavigation) {
                    window.WritingNavigation.navigate(
                        "create"
                    );
                } else {
                    window.location.href = "./create.html";
                }
            }, 500);

        } catch (error) {
            console.error(
                "创建分组失败：",
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
       十二、取消创建
    ================================================== */

    function handleCancel() {
        if (isSubmitting) {
            return;
        }

        const hasChanged =
            nameInput.value.trim() !==
            originalName.trim();

        if (hasChanged && !isSaved) {
            const confirmed = window.confirm(
                "分组名称尚未保存，确定放弃本次创建吗？"
            );

            if (!confirmed) {
                return;
            }
        }

        if (window.WritingNavigation) {
            window.WritingNavigation.navigate("create");
        } else {
            window.location.href = "./create.html";
        }
    }


    /* ==================================================
       十三、监听输入
    ================================================== */

    nameInput.addEventListener(
        "input",
        function () {
            updateNameCounter();

            clearNameError();

            hideMessage();
        }
    );


    /* ==================================================
       十四、失去焦点时验证
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
       十五、绑定表单事件
    ================================================== */

    form.addEventListener(
        "submit",
        handleSubmit
    );


    /* ==================================================
       十六、绑定取消按钮
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
       十七、离开页面提示
    ================================================== */

    window.addEventListener(
        "beforeunload",
        function (event) {
            if (isSubmitting || isSaved) {
                return;
            }

            const hasChanged =
                nameInput.value.trim() !==
                originalName.trim();

            if (!hasChanged) {
                return;
            }

            event.preventDefault();

            event.returnValue = "";
        }
    );


    /* ==================================================
       十八、页面初始化
    ================================================== */

    updateNameCounter();

    clearNameError();

    originalName = nameInput.value;

    console.log("新建分组页面初始化成功。");

})();
