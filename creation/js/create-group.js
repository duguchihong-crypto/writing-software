/* ======================================================
   写作软件 · 新建分组
   文件：creation/js/create-group.js

   功能：
   1. 分组名称验证
   2. 实时字数统计
   3. 检查重复名称
   4. 创建并保存分组
   5. 创建成功与失败提示
   6. 取消创建及返回
   7. 未保存内容提醒
   8. 防止重复提交
   9. 兼容 WritingGroupsStorage
   10. 兼容 WritingStorage
   11. 兼容 GitHub Pages 项目路径
====================================================== */

(function () {
    "use strict";


    /* ==================================================
       一、配置
    ================================================== */

    const CONFIG = {
        maxNameLength: 50,
        redirectDelay: 600
    };


    /* ==================================================
       二、获取页面元素
    ================================================== */

    const $ = id => document.getElementById(id);

    const el = {
        form: $("create-group-form"),

        name: $("group-name"),
        counter: $("group-name-counter"),
        error: $("group-name-error"),

        message: $("create-group-message"),

        submit: $("create-group-submit"),

        cancel: $("cancel-create-group"),
        cancelTop: $("cancel-create-group-top")
    };


    /* ==================================================
       三、检查必要元素
    ================================================== */

    if (!el.form || !el.name || !el.submit) {
        console.error(
            "[WritingCreateGroup] 页面缺少必要元素。"
        );

        return;
    }


    /* ==================================================
       四、运行状态
    ================================================== */

    const state = {
        submitting: false,
        saved: false,
        leaving: false,
        redirectTimer: null
    };

    const originalSubmitHTML = el.submit.innerHTML;


    /* ==================================================
       五、页面地址
    ================================================== */

    // 取消创建：返回 creation/create.html
    function getCreateUrl() {
        return new URL(
            "create.html",
            window.location.href
        ).href;
    }


    // 创建成功：返回项目根目录 index.html
    function getHomeUrl() {
        return new URL(
            "../index.html",
            window.location.href
        ).href;
    }


    function navigateToCreate() {
        state.leaving = true;

        window.location.assign(getCreateUrl());
    }


    function navigateToHome() {
        state.leaving = true;

        window.location.replace(getHomeUrl());
    }


    /* ==================================================
       六、消息提示
    ================================================== */

    function showMessage(text, type = "info") {
        if (!el.message) return;

        el.message.textContent = String(text || "");

        el.message.className = "create-group-message";

        if (type === "success") {
            el.message.classList.add(
                "create-group-message--success"
            );
        } else if (type === "error") {
            el.message.classList.add(
                "create-group-message--error"
            );
        }

        el.message.hidden = false;

        el.message.setAttribute(
            "role",
            type === "error" ? "alert" : "status"
        );
    }


    function hideMessage() {
        if (!el.message) return;

        el.message.hidden = true;
        el.message.textContent = "";

        el.message.className = "create-group-message";

        el.message.removeAttribute("role");
    }


    /* ==================================================
       七、名称错误提示
    ================================================== */

    function setNameError(text = "") {
        if (el.error) {
            el.error.textContent = text;
            el.error.hidden = !text;
        }

        if (text) {
            el.name.setAttribute("aria-invalid", "true");
        } else {
            el.name.removeAttribute("aria-invalid");
        }
    }


    /* ==================================================
       八、名称字数统计
    ================================================== */

    function updateCounter() {
        if (!el.counter) return;

        const length = el.name.value.length;

        el.counter.textContent =
            length + " / " + CONFIG.maxNameLength;

        if (length >= CONFIG.maxNameLength) {
            el.counter.setAttribute("data-limit", "true");
        } else {
            el.counter.removeAttribute("data-limit");
        }
    }


    /* ==================================================
       九、名称验证
    ================================================== */

    function getName() {
        return el.name.value.trim();
    }


    function validateName() {
        const name = getName();

        if (!name) {
            setNameError("请输入分组名称。");
            return false;
        }

        if (name.length > CONFIG.maxNameLength) {
            setNameError(
                "分组名称不能超过 " +
                CONFIG.maxNameLength +
                " 个字符。"
            );

            return false;
        }

        setNameError("");

        return true;
    }


    /* ==================================================
       十、提交状态
    ================================================== */

    function setSubmitting(value) {
        state.submitting = value;

        el.submit.disabled = value;

        if (el.cancel) {
            el.cancel.disabled = value;
        }

        if (el.cancelTop) {
            el.cancelTop.disabled = value;
        }

        if (value) {
            el.submit.innerHTML =
                '<span aria-hidden="true">…</span>' +
                '<span>正在创建</span>';

            el.submit.setAttribute("aria-busy", "true");
        } else {
            el.submit.innerHTML = originalSubmitHTML;

            el.submit.removeAttribute("aria-busy");
        }
    }


    /* ==================================================
       十一、获取分组存储模块
    ================================================== */

    function getStorage() {
        const groupStorage = window.WritingGroupsStorage;
        const writingStorage = window.WritingStorage;

        // 优先使用独立分组存储模块
        if (
            groupStorage &&
            typeof groupStorage.createGroup === "function" &&
            typeof groupStorage.getGroups === "function"
        ) {
            return groupStorage;
        }

        // 兼容统一存储模块
        if (
            writingStorage &&
            typeof writingStorage.createGroup === "function" &&
            typeof writingStorage.getGroups === "function"
        ) {
            return writingStorage;
        }

        throw new Error(
            "分组存储模块未正确加载，请检查 groups-storage.js。"
        );
    }


    /* ==================================================
       十二、检查重复名称
    ================================================== */

    function hasDuplicateName(storage, name) {
        const normalizedName = name
            .trim()
            .toLocaleLowerCase();

        // 优先使用存储模块提供的方法
        if (typeof storage.hasGroupName === "function") {
            return storage.hasGroupName(name);
        }

        // 兼容没有 hasGroupName() 的存储模块
        const groups = storage.getGroups();

        if (!Array.isArray(groups)) {
            throw new Error(
                "无法读取现有分组，请刷新页面后重试。"
            );
        }

        return groups.some(group => {
            return String(group.name || "")
                .trim()
                .toLocaleLowerCase() === normalizedName;
        });
    }


    /* ==================================================
       十三、创建分组
    ================================================== */

    function handleSubmit(event) {
        event.preventDefault();

        // 防止重复提交
        if (state.submitting || state.saved) {
            return;
        }

        hideMessage();
        setNameError("");

        // 验证名称
        if (!validateName()) {
            el.name.focus();
            return;
        }

        const name = getName();

        setSubmitting(true);

        try {
            const storage = getStorage();

            // 检查重名
            if (hasDuplicateName(storage, name)) {
                setSubmitting(false);

                setNameError(
                    "已经存在同名分组，请换一个名称。"
                );

                el.name.focus();

                return;
            }

            // 保存分组
            const group = storage.createGroup({
                name: name
            });

            // 检查保存结果
            if (
                !group ||
                group.id === undefined ||
                group.id === null ||
                String(group.id).trim() === "" ||
                !group.name
            ) {
                throw new Error(
                    "分组未能成功保存，请稍后重试。"
                );
            }

            // 保存成功
            state.saved = true;

            showMessage(
                "分组「" +
                group.name +
                "」创建成功！正在返回书架……",
                "success"
            );

            console.info(
                "[WritingCreateGroup] 创建成功：",
                group
            );

            // 延迟返回首页
            state.redirectTimer = window.setTimeout(
                navigateToHome,
                CONFIG.redirectDelay
            );

        } catch (error) {
            console.error(
                "[WritingCreateGroup] 创建失败：",
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

        // 有未保存内容时确认放弃
        if (getName()) {
            const confirmed = window.confirm(
                "分组名称尚未保存，确定放弃本次创建吗？"
            );

            if (!confirmed) return;
        }

        navigateToCreate();
    }


    /* ==================================================
       十五、输入事件
    ================================================== */

    function handleInput() {
        updateCounter();

        setNameError("");

        hideMessage();
    }


    el.name.addEventListener(
        "input",
        handleInput
    );


    el.name.addEventListener(
        "blur",
        function () {
            if (getName()) {
                validateName();
            }
        }
    );


    /* ==================================================
       十六、表单事件
    ================================================== */

    el.form.addEventListener(
        "submit",
        handleSubmit
    );


    /* ==================================================
       十七、取消按钮事件
    ================================================== */

    if (el.cancel) {
        el.cancel.addEventListener(
            "click",
            handleCancel
        );
    }

    if (el.cancelTop) {
        el.cancelTop.addEventListener(
            "click",
            handleCancel
        );
    }


    /* ==================================================
       十八、离开页面保护
    ================================================== */

    window.addEventListener(
        "beforeunload",
        function (event) {
            if (
                state.submitting ||
                state.saved ||
                state.leaving ||
                !getName()
            ) {
                return;
            }

            event.preventDefault();
            event.returnValue = "";
        }
    );


    /* ==================================================
       十九、初始化
    ================================================== */

    function initialize() {
        el.name.maxLength = CONFIG.maxNameLength;

        updateCounter();

        setNameError("");

        hideMessage();

        console.info(
            "[WritingCreateGroup] 初始化完成。"
        );

        console.info(
            "[WritingCreateGroup] WritingGroupsStorage：",
            Boolean(window.WritingGroupsStorage)
        );

        console.info(
            "[WritingCreateGroup] WritingStorage：",
            Boolean(window.WritingStorage)
        );
    }


    initialize();

})();
