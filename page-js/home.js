/* ======================================================
   写作软件 · 首页书架与分组
   文件：page-js/home.js
   功能：
   1. 显示书籍与分组
   2. 书籍独立改名、删除
   3. 分组独立改名、删除
   4. 全局浮动操作菜单
   5. 兼容不显示书籍数量的首页
   6. 兼容网格、列表模式
   7. 兼容本地存储变化及跨页面同步
   8. 兼容同步和异步存储读取
   9. 加强异常处理与调试日志
   注意：
   - 书籍数据由 WritingStorage 统一管理。
   - 不直接修改书籍数据库。
   - 保留原有页面元素、CSS 类名和功能。
====================================================== */
(function () {
    "use strict";
    /* ==================================================
       一、避免重复初始化
    ================================================== */
    if (window.WritingHome) {
        console.warn(
            "[WritingHome] 首页模块已经初始化，跳过重复初始化。"
        );
        return;
    }
    /* ==================================================
       二、页面元素
    ================================================== */
    const elements = {
        emptyState: document.getElementById("empty-state"),
        shelfContent: document.getElementById("shelf-content"),
        shelfList: document.getElementById("shelf-list"),
        shelfCount: document.getElementById("shelf-count"),
        groupsContent: document.getElementById("home-groups"),
        groupsList: document.getElementById("home-groups-list")
    };
    let shelfRenderScheduled = false;
    let groupRenderScheduled = false;
    let shelfRequestId = 0;
    let groupRequestId = 0;
    let activeMenuContext = null;
    let activeMenuTrigger = null;
    let shelfChangeListenerRegistered = false;
    let groupChangeListenerRegistered = false;
    /* ==================================================
       三、通用工具
    ================================================== */
    function escapeHTML(value) {
        const text = String(value == null ? "" : value);
        if (
            window.WritingComponents &&
            typeof window.WritingComponents.escapeHTML === "function"
        ) {
            return window.WritingComponents.escapeHTML(text);
        }
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    function formatWordCount(count) {
        const number = Number(count) || 0;
        if (
            window.WritingComponents &&
            typeof window.WritingComponents.formatWordCount === "function"
        ) {
            return window.WritingComponents.formatWordCount(number);
        }
        return number.toLocaleString("zh-CN") + " 字";
    }
    function formatDate(dateValue) {
        if (
            window.WritingComponents &&
            typeof window.WritingComponents.formatRelativeTime === "function"
        ) {
            return window.WritingComponents.formatRelativeTime(dateValue);
        }
        if (!dateValue) {
            return "尚未编辑";
        }
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) {
            return "尚未编辑";
        }
        return date.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
    }
    function showMessage(message) {
        window.alert(String(message || ""));
    }
    function getStorageErrorMessage(error, fallback) {
        if (!error) {
            return fallback;
        }
        const code = error.code;
        const message = error.message;
        const messages = {
            TITLE_REQUIRED: "书名不能为空。",
            INVALID_COVER: "封面格式不正确，请重新选择图片。",
            STORAGE_FULL: "浏览器存储空间不足，请更换较小的封面图片后重试。",
            STORAGE_UNAVAILABLE: "浏览器存储不可用，请检查浏览器设置。",
            STORAGE_WRITE_FAILED: "保存失败，请检查浏览器存储空间后重试。",
            INVALID_DATABASE: "书籍数据格式异常。请勿清除数据，应先检查存储内容。"
        };
        if (code && messages[code]) {
            return messages[code];
        }
        if (message && messages[message]) {
            return messages[message];
        }
        if (typeof message === "string" && message.trim()) {
            return message;
        }
        return fallback;
    }
    function isValidBook(book) {
        return Boolean(
            book &&
            typeof book === "object" &&
            book.id !== undefined &&
            book.id !== null &&
            String(book.id).trim() !== ""
        );
    }
    function isValidGroup(group) {
        return Boolean(
            group &&
            typeof group === "object"
        );
    }
    /* ==================================================
       四、刷新任务调度
    ================================================== */
    function scheduleShelfRender() {
        if (shelfRenderScheduled) {
            return;
        }
        shelfRenderScheduled = true;
        const schedule = window.requestAnimationFrame ||
            function (callback) {
                return window.setTimeout(callback, 0);
            };
        schedule(function () {
            shelfRenderScheduled = false;
            renderShelf();
        });
    }
    function scheduleGroupRender() {
        if (groupRenderScheduled) {
            return;
        }
        groupRenderScheduled = true;
        const schedule = window.requestAnimationFrame ||
            function (callback) {
                return window.setTimeout(callback, 0);
            };
        schedule(function () {
            groupRenderScheduled = false;
            renderGroups();
        });
    }
    /* ==================================================
       五、书籍数据
    ================================================== */
    function getBookTitle(book) {
        const title =
            book && typeof book.title === "string"
                ? book.title.trim()
                : "";
        return title || "未命名书籍";
    }
    function getBookDescription(book) {
        const description =
            book && typeof book.description === "string"
                ? book.description.trim()
                : "";
        return description || "尚未添加简介";
    }
    function getBookCover(book) {
        if (
            book &&
            typeof book.cover === "string" &&
            book.cover.startsWith("data:image/")
        ) {
            return book.cover;
        }
        /*
         * 兼容旧版本封面数据。
         * 此处只读取旧数据，不修改存储内容。
         */
        try {
            const legacyData = localStorage.getItem(
                "writing-software-book-covers"
            );
            if (legacyData && book && book.id != null) {
                const covers = JSON.parse(legacyData);
                const entry = covers ? covers[book.id] : null;
                if (
                    entry &&
                    typeof entry.data === "string" &&
                    entry.data.startsWith("data:image/")
                ) {
                    return entry.data;
                }
                if (
                    typeof entry === "string" &&
                    entry.startsWith("data:image/")
                ) {
                    return entry;
                }
            }
        } catch (error) {
            console.warn(
                "[WritingHome] 读取旧版封面失败。",
                error
            );
        }
        return "";
    }
    /* ==================================================
       六、默认书籍封面
    ================================================== */
    function createDefaultCover(title) {
        const firstCharacter = Array.from(title)[0] || "书";
        return `
            <div
                class="shelf-card__cover shelf-card__cover--default"
                aria-label="默认封面"
            >
                <span
                    class="shelf-card__cover-decoration"
                    aria-hidden="true"
                >卷</span>
                <span class="shelf-card__cover-character">
                    ${escapeHTML(firstCharacter)}
                </span>
                <span class="shelf-card__cover-title">
                    ${escapeHTML(title)}
                </span>
            </div>
        `;
    }
    /* ==================================================
       七、书籍封面
    ================================================== */
    function createCoverHTML(book) {
        const title = getBookTitle(book);
        const cover = getBookCover(book);
        if (!cover) {
            return createDefaultCover(title);
        }
        return `
            <div class="shelf-card__cover">
                <img
                    class="shelf-card__cover-image"
                    src="${escapeHTML(cover)}"
                    alt="${escapeHTML(title)}的封面"
                    loading="lazy"
                >
            </div>
        `;
    }
    /* ==================================================
       八、打开书籍
    ================================================== */
    function openBook(bookId) {
        if (
            bookId === undefined ||
            bookId === null ||
            String(bookId).trim() === ""
        ) {
            showMessage("无法打开书籍：书籍编号无效。");
            return;
        }
        if (
            window.WritingNavigation &&
            typeof window.WritingNavigation.goEditor === "function"
        ) {
            window.WritingNavigation.goEditor(bookId);
            return;
        }
        const url = new URL(
            "./pages/editor.html",
            window.location.href
        );
        url.searchParams.set("id", String(bookId));
        window.location.href = url.href;
    }
    /* ==================================================
       九、全局浮动操作菜单
    ================================================== */
    const actionMenu = document.createElement("div");
    actionMenu.className = "home-action-menu";
    actionMenu.id = "home-action-menu";
    actionMenu.setAttribute("role", "menu");
    actionMenu.setAttribute("aria-label", "项目操作");
    actionMenu.hidden = true;
    actionMenu.innerHTML = `
        <button
            class="home-action-menu__item"
            type="button"
            role="menuitem"
            data-action="rename"
        >
            <span
                class="home-action-menu__icon"
                aria-hidden="true"
            >✎</span>
            <span>改名</span>
        </button>
        <button
            class="home-action-menu__item home-action-menu__item--danger"
            type="button"
            role="menuitem"
            data-action="delete"
        >
            <span
                class="home-action-menu__icon"
                aria-hidden="true"
            >🗑</span>
            <span>删除</span>
        </button>
    `;
    document.body.appendChild(actionMenu);
    function closeActionMenu() {
        actionMenu.hidden = true;
        if (activeMenuTrigger) {
            activeMenuTrigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }
        activeMenuContext = null;
        activeMenuTrigger = null;
    }
    function positionActionMenu(trigger) {
        const margin = 8;
        const gap = 6;
        const triggerRect = trigger.getBoundingClientRect();
        actionMenu.hidden = false;
        actionMenu.style.position = "fixed";
        actionMenu.style.left = "0px";
        actionMenu.style.top = "0px";
        const menuRect = actionMenu.getBoundingClientRect();
        const menuWidth = menuRect.width || 144;
        const menuHeight = menuRect.height || 96;
        let left = triggerRect.right - menuWidth;
        let top = triggerRect.bottom + gap;
        left = Math.max(
            margin,
            Math.min(
                left,
                window.innerWidth - menuWidth - margin
            )
        );
        if (top + menuHeight > window.innerHeight - margin) {
            top = triggerRect.top - menuHeight - gap;
        }
        top = Math.max(
            margin,
            Math.min(
                top,
                window.innerHeight - menuHeight - margin
            )
        );
        actionMenu.style.left = left + "px";
        actionMenu.style.top = top + "px";
    }
    function openActionMenu(trigger, context) {
        if (
            activeMenuTrigger === trigger &&
            !actionMenu.hidden
        ) {
            closeActionMenu();
            return;
        }
        if (activeMenuTrigger) {
            activeMenuTrigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }
        activeMenuTrigger = trigger;
        activeMenuContext = context;
        trigger.setAttribute("aria-expanded", "true");
        positionActionMenu(trigger);
    }
    function createMenuButton(type, id, title) {
        const button = document.createElement("button");
        button.className =
            type === "book"
                ? "shelf-card__menu-button"
                : "home-group-card__menu-button";
        button.type = "button";
        button.textContent = "⋯";
        button.setAttribute("aria-label", "更多操作");
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", "false");
        button.dataset.itemType = type;
        button.dataset.itemId = String(id);
        button.dataset.itemTitle = title || "";
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            openActionMenu(button, {
                type: type,
                id: id,
                title: title || ""
            });
        });
        return button;
    }
    /* ==================================================
       十、书籍改名
    ================================================== */
    function renameBook(bookId, oldTitle) {
        const storage = window.WritingStorage;
        if (
            !storage ||
            typeof storage.updateBook !== "function"
        ) {
            showMessage("书籍存储功能不可用，无法修改书名。");
            return;
        }
        const input = window.prompt(
            "请输入新的书名：",
            oldTitle
        );
        if (input === null) {
            return;
        }
        const newTitle = input.trim();
        if (!newTitle) {
            showMessage("书名不能为空。");
            return;
        }
        try {
            const result = storage.updateBook(bookId, {
                title: newTitle
            });
            Promise.resolve(result)
                .then(function (updatedBook) {
                    if (!updatedBook) {
                        showMessage("修改失败，找不到这本书。");
                        return;
                    }
                    scheduleShelfRender();
                })
                .catch(function (error) {
                    console.error(
                        "[WritingHome] 修改书名失败。",
                        error
                    );
                    showMessage(
                        getStorageErrorMessage(
                            error,
                            "修改书名失败，请稍后重试。"
                        )
                    );
                });
        } catch (error) {
            console.error(
                "[WritingHome] 修改书名失败。",
                error
            );
            showMessage(
                getStorageErrorMessage(
                    error,
                    "修改书名失败，请稍后重试。"
                )
            );
        }
    }
    /* ==================================================
       十一、书籍删除
    ================================================== */
    function deleteBook(bookId, title) {
        const storage = window.WritingStorage;
        if (
            !storage ||
            typeof storage.deleteBook !== "function"
        ) {
            showMessage("书籍存储功能不可用，无法删除书籍。");
            return;
        }
        const confirmed = window.confirm(
            "确定要删除《" + title + "》吗？\n\n" +
            "此操作会删除这本书的数据，不能通过首页撤销。"
        );
        if (!confirmed) {
            return;
        }
        try {
            const result = storage.deleteBook(bookId);
            Promise.resolve(result)
                .then(function (deleted) {
                    if (!deleted) {
                        showMessage("删除失败，找不到这本书。");
                        return;
                    }
                    closeActionMenu();
                    scheduleShelfRender();
                })
                .catch(function (error) {
                    console.error(
                        "[WritingHome] 删除书籍失败。",
                        error
                    );
                    showMessage(
                        getStorageErrorMessage(
                            error,
                            "删除书籍失败，请稍后重试。"
                        )
                    );
                });
        } catch (error) {
            console.error(
                "[WritingHome] 删除书籍失败。",
                error
            );
            showMessage(
                getStorageErrorMessage(
                    error,
                    "删除书籍失败，请稍后重试。"
                )
            );
        }
    }
    /* ==================================================
       十二、分组存储接口
    ================================================== */
    function getGroupsStorage() {
        if (
            window.WritingGroupsStorage &&
            typeof window.WritingGroupsStorage.getGroups === "function"
        ) {
            return window.WritingGroupsStorage;
        }
        if (
            window.WritingStorage &&
            typeof window.WritingStorage.getGroups === "function"
        ) {
            return window.WritingStorage;
        }
        return null;
    }
    /* ==================================================
       十三、分组改名
    ================================================== */
    function renameGroup(groupId, oldName) {
        const storage = getGroupsStorage();
        if (
            !storage ||
            typeof storage.updateGroup !== "function"
        ) {
            showMessage("分组存储功能不可用，无法修改分组名称。");
            return;
        }
        const input = window.prompt(
            "请输入新的分组名称：",
            oldName
        );
        if (input === null) {
            return;
        }
        const newName = input.trim();
        if (!newName) {
            showMessage("分组名称不能为空。");
            return;
        }
        if (newName.length > 50) {
            showMessage("分组名称不能超过 50 个字符。");
            return;
        }
        try {
            const result = storage.updateGroup(groupId, {
                name: newName
            });
            Promise.resolve(result)
                .then(function (updatedGroup) {
                    if (!updatedGroup) {
                        showMessage(
                            "修改分组名称失败，请检查分组是否存在。"
                        );
                        return;
                    }
                    scheduleGroupRender();
                })
                .catch(function (error) {
                    console.error(
                        "[WritingHome] 修改分组名称失败。",
                        error
                    );
                    showMessage(
                        getStorageErrorMessage(
                            error,
                            "修改分组名称失败，请稍后重试。"
                        )
                    );
                });
        } catch (error) {
            console.error(
                "[WritingHome] 修改分组名称失败。",
                error
            );
            showMessage(
                getStorageErrorMessage(
                    error,
                    "修改分组名称失败，请稍后重试。"
                )
            );
        }
    }
    /* ==================================================
       十四、分组删除
       只删除分组，不删除书籍
    ================================================== */
    function deleteGroup(groupId, name) {
        const storage = getGroupsStorage();
        if (
            !storage ||
            typeof storage.deleteGroup !== "function"
        ) {
            showMessage("分组存储功能不可用，无法删除分组。");
            return;
        }
        const confirmed = window.confirm(
            "确定要删除分组「" + name + "」吗？\n\n" +
            "只会删除这个分组，不会删除书籍。"
        );
        if (!confirmed) {
            return;
        }
        try {
            const result = storage.deleteGroup(groupId);
            Promise.resolve(result)
                .then(function (deleted) {
                    if (!deleted) {
                        showMessage(
                            "删除分组失败，可能该分组已经不存在。"
                        );
                        return;
                    }
                    closeActionMenu();
                    scheduleGroupRender();
                })
                .catch(function (error) {
                    console.error(
                        "[WritingHome] 删除分组失败。",
                        error
                    );
                    showMessage(
                        getStorageErrorMessage(
                            error,
                            "删除分组失败，请稍后重试。"
                        )
                    );
                });
        } catch (error) {
            console.error(
                "[WritingHome] 删除分组失败。",
                error
            );
            showMessage(
                getStorageErrorMessage(
                    error,
                    "删除分组失败，请稍后重试。"
                )
            );
        }
    }
    /* ==================================================
       十五、操作菜单事件
    ================================================== */
    actionMenu.addEventListener("click", function (event) {
        const button = event.target.closest(
            "button[data-action]"
        );
        if (!button || !activeMenuContext) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const context = activeMenuContext;
        const action = button.dataset.action;
        closeActionMenu();
        if (context.type === "book") {
            if (action === "rename") {
                renameBook(context.id, context.title);
            } else if (action === "delete") {
                deleteBook(context.id, context.title);
            }
            return;
        }
        if (context.type === "group") {
            if (action === "rename") {
                renameGroup(context.id, context.title);
            } else if (action === "delete") {
                deleteGroup(context.id, context.title);
            }
        }
    });
    document.addEventListener("click", function (event) {
        if (actionMenu.hidden) {
            return;
        }
        if (actionMenu.contains(event.target)) {
            return;
        }
        if (
            activeMenuTrigger &&
            activeMenuTrigger.contains(event.target)
        ) {
            return;
        }
        closeActionMenu();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !actionMenu.hidden) {
            closeActionMenu();
        }
    });
    window.addEventListener(
        "scroll",
        function () {
            if (!actionMenu.hidden) {
                closeActionMenu();
            }
        },
        true
    );
    window.addEventListener("resize", function () {
        if (!actionMenu.hidden) {
            closeActionMenu();
        }
    });
    /* ==================================================
       十六、创建书籍卡片
    ================================================== */
    function createBookCard(book) {
        const card = document.createElement("article");
        card.className = "shelf-card";
        card.dataset.bookId = String(book.id);
        const title = getBookTitle(book);
        const description = getBookDescription(book);
        const wordCount = formatWordCount(book.wordCount);
        const updatedAt = formatDate(book.updatedAt);
        card.innerHTML = `
            <button
                class="shelf-card__open"
                type="button"
                aria-label="打开《${escapeHTML(title)}》"
            >
                ${createCoverHTML(book)}
                <div class="shelf-card__body">
                    <h3 class="shelf-card__title">
                        ${escapeHTML(title)}
                    </h3>
                    <p class="shelf-card__description">
                        ${escapeHTML(description)}
                    </p>
                    <div class="shelf-card__meta">
                        <span class="shelf-card__word-count">
                            ${escapeHTML(wordCount)}
                        </span>
                        <span class="shelf-card__updated-at">
                            ${escapeHTML(updatedAt)}
                        </span>
                    </div>
                </div>
            </button>
        `;
        const openButton = card.querySelector(
            ".shelf-card__open"
        );
        openButton.addEventListener("click", function () {
            openBook(book.id);
        });
        card.appendChild(
            createMenuButton("book", book.id, title)
        );
        const coverImage = card.querySelector(
            ".shelf-card__cover-image"
        );
        if (coverImage) {
            coverImage.addEventListener("error", function () {
                const coverContainer = coverImage.closest(
                    ".shelf-card__cover"
                );
                if (coverContainer) {
                    coverContainer.outerHTML =
                        createDefaultCover(title);
                }
            });
        }
        return card;
    }
    /* ==================================================
       十七、空书架显示
    ================================================== */
    function showEmptyState() {
        if (elements.emptyState) {
            elements.emptyState.hidden = false;
        }
        if (elements.shelfContent) {
            elements.shelfContent.hidden = true;
        }
        if (elements.shelfCount) {
            elements.shelfCount.textContent = "0 本";
        }
        if (elements.shelfList) {
            elements.shelfList.replaceChildren();
        }
    }
    /* ==================================================
       十八、布局刷新
       一个布局模块报错，不影响另一个模块
    ================================================== */
    function refreshLayouts() {
        const layoutModules = [
            window.WritingHomeGrid,
            window.WritingHomeList
        ];
        layoutModules.forEach(function (module) {
            if (
                module &&
                typeof module.refresh === "function"
            ) {
                try {
                    module.refresh();
                } catch (error) {
                    console.error(
                        "[WritingHome] 刷新布局模块失败。",
                        error
                    );
                }
            }
        });
    }
    /* ==================================================
       十九、显示书籍
    ================================================== */
    function showBooks(books) {
        if (
            !elements.emptyState ||
            !elements.shelfContent ||
            !elements.shelfList
        ) {
            console.error(
                "[WritingHome] 首页缺少必要元素。",
                {
                    emptyState: Boolean(elements.emptyState),
                    shelfContent: Boolean(elements.shelfContent),
                    shelfList: Boolean(elements.shelfList)
                }
            );
            return;
        }
        const fragment = document.createDocumentFragment();
        books.forEach(function (book) {
            if (!isValidBook(book)) {
                return;
            }
            fragment.appendChild(createBookCard(book));
        });
        if (!fragment.childNodes.length) {
            showEmptyState();
            return;
        }
        elements.shelfList.replaceChildren(fragment);
        elements.emptyState.hidden = true;
        elements.shelfContent.hidden = false;
        if (elements.shelfCount) {
            elements.shelfCount.textContent =
                books.filter(isValidBook).length + " 本";
        }
        refreshLayouts();
        console.info(
            "[WritingHome] 书架渲染完成。",
            {
                bookCount: books.filter(isValidBook).length
            }
        );
    }
    /* ==================================================
       二十、刷新书架
       兼容同步 getBooks() 和异步 getBooks()
    ================================================== */
    async function renderShelf() {
        const requestId = ++shelfRequestId;
        const storage = window.WritingStorage;
        if (
            !storage ||
            typeof storage.getBooks !== "function"
        ) {
            console.error(
                "[WritingHome] WritingStorage 或 getBooks() 不可用。",
                {
                    storageExists: Boolean(storage),
                    getBooksExists: Boolean(
                        storage &&
                        typeof storage.getBooks === "function"
                    )
                }
            );
            return;
        }
        try {
            const result = await Promise.resolve(
                storage.getBooks()
            );
            /*
             * 如果期间又触发了一次刷新，
             * 忽略较早的读取结果，避免旧结果覆盖新结果。
             */
            if (requestId !== shelfRequestId) {
                return;
            }
            if (!Array.isArray(result)) {
                console.error(
                    "[WritingHome] getBooks() 没有返回数组。",
                    result
                );
                return;
            }
            const validBooks = result.filter(isValidBook);
            console.info(
                "[WritingHome] 已读取书籍数据。",
                {
                    total: result.length,
                    valid: validBooks.length,
                    books: validBooks.map(function (book) {
                        return {
                            id: book.id,
                            title: book.title
                        };
                    })
                }
            );
            if (validBooks.length === 0) {
                showEmptyState();
                return;
            }
            showBooks(validBooks);
        } catch (error) {
            console.error(
                "[WritingHome] 读取书架失败。",
                error
            );
            /*
             * 读取失败时不清除数据，
             * 也不擅自把页面状态当成真正的空书架。
             */
        }
    }
    /* ==================================================
       二十一、读取分组
       兼容同步与异步接口
    ================================================== */
    async function readGroups() {
        const storage = getGroupsStorage();
        if (!storage) {
            console.warn(
                "[WritingHome] 未找到分组存储接口。"
            );
            return null;
        }
        try {
            const result = await Promise.resolve(
                storage.getGroups()
            );
            if (Array.isArray(result)) {
                return result;
            }
            if (
                result &&
                typeof result === "object" &&
                Array.isArray(result.groups)
            ) {
                return result.groups;
            }
            console.error(
                "[WritingHome] 分组数据格式不正确。",
                result
            );
            return null;
        } catch (error) {
            console.error(
                "[WritingHome] 读取分组失败。",
                error
            );
            return null;
        }
    }
    /* ==================================================
       二十二、分组名称和 ID
    ================================================== */
    function getGroupName(group) {
        const names = [
            group.name,
            group.title,
            group.groupName
        ];
        for (const name of names) {
            if (
                typeof name === "string" &&
                name.trim()
            ) {
                return name.trim();
            }
        }
        return "未命名分组";
    }
    function getGroupId(group) {
        if (
            group.id !== undefined &&
            group.id !== null
        ) {
            return group.id;
        }
        if (
            group.groupId !== undefined &&
            group.groupId !== null
        ) {
            return group.groupId;
        }
        if (
            group.uuid !== undefined &&
            group.uuid !== null
        ) {
            return group.uuid;
        }
        return null;
    }
    /* ==================================================
       二十三、创建分组卡片
       修改内容：
       1. 使用透明封面框代替原来的复选框
       2. 分组名称放在透明框下方
       3. 保留右上角的三个点操作菜单
       4. 保留原有分组名称、ID 和操作功能
    ================================================== */
    function createGroupCard(group) {
        const card = document.createElement("article");
        card.className = "home-group-card";
        const groupName = getGroupName(group);
        const groupId = getGroupId(group);
        card.innerHTML = `
            <div
                class="home-group-card__cover"
                aria-hidden="true"
            ></div>
            <h3 class="home-group-card__name">
                ${escapeHTML(groupName)}
            </h3>
        `;
        if (groupId !== null) {
            card.appendChild(
                createMenuButton(
                    "group",
                    groupId,
                    groupName
                )
            );
        }
        return card;
    }
    /* ==================================================
       二十四、显示分组
    ================================================== */
    function showGroups(groups) {
        if (
            !elements.groupsContent ||
            !elements.groupsList
        ) {
            console.error(
                "[WritingHome] 找不到首页分组区域。"
            );
            return;
        }
        if (!Array.isArray(groups)) {
            return;
        }
        const validGroups = groups.filter(isValidGroup);
        const fragment = document.createDocumentFragment();
        validGroups.forEach(function (group) {
            fragment.appendChild(createGroupCard(group));
        });
        elements.groupsList.replaceChildren(fragment);
        elements.groupsContent.hidden =
            validGroups.length === 0;
        console.info(
            "[WritingHome] 分组渲染完成。",
            {
                groupCount: validGroups.length
            }
        );
    }
    /* ==================================================
       二十五、刷新分组
    ================================================== */
    async function renderGroups() {
        const requestId = ++groupRequestId;
        const groups = await readGroups();
        if (requestId !== groupRequestId) {
            return;
        }
        if (groups !== null) {
            showGroups(groups);
        }
    }
    /* ==================================================
       二十六、监听书籍变化
    ================================================== */
    function listenForBookChanges() {
        if (shelfChangeListenerRegistered) {
            return;
        }
        shelfChangeListenerRegistered = true;
        const storage = window.WritingStorage;
        if (
            storage &&
            typeof storage.onChange === "function"
        ) {
            try {
                storage.onChange(scheduleShelfRender);
            } catch (error) {
                console.warn(
                    "[WritingHome] 注册书籍变化监听失败。",
                    error
                );
            }
        }
        window.addEventListener(
            "writing-storage-change",
            scheduleShelfRender
        );
        window.addEventListener(
            "writing-book-change",
            scheduleShelfRender
        );
        window.addEventListener(
            "writing-books-change",
            scheduleShelfRender
        );
    }
    /* ==================================================
       二十七、监听分组变化
    ================================================== */
    function listenForGroupChanges() {
        if (groupChangeListenerRegistered) {
            return;
        }
        groupChangeListenerRegistered = true;
        const storage = getGroupsStorage();
        if (
            storage &&
            typeof storage.onChange === "function"
        ) {
            try {
                storage.onChange(scheduleGroupRender);
            } catch (error) {
                console.warn(
                    "[WritingHome] 注册分组变化监听失败。",
                    error
                );
            }
        }
        window.addEventListener(
            "writing-groups-change",
            scheduleGroupRender
        );
        window.addEventListener(
            "writing-group-change",
            scheduleGroupRender
        );
    }
    /* ==================================================
       二十八、跨页面存储同步
    ================================================== */
    window.addEventListener("storage", function (event) {
        if (
            event.key === "writing-software-groups" ||
            event.key === "writing-software-book-groups"
        ) {
            scheduleGroupRender();
        }
        if (
            event.key === "writing-software-books" ||
            event.key === "writing-software-book-covers"
        ) {
            scheduleShelfRender();
        }
    });
    /* ==================================================
       二十九、公开首页接口
    ================================================== */
    window.WritingHome = Object.freeze({
        render: renderShelf,
        renderGroups: renderGroups,
        openBook: openBook,
        closeActionMenu: closeActionMenu
    });
    /* ==================================================
       三十、初始化
    ================================================== */
    function initialize() {
        console.info(
            "[WritingHome] 开始初始化首页。"
        );
        console.info(
            "[WritingHome] WritingStorage 是否存在：",
            Boolean(window.WritingStorage)
        );
        console.info(
            "[WritingHome] getBooks() 是否可用：",
            Boolean(
                window.WritingStorage &&
                typeof window.WritingStorage.getBooks === "function"
            )
        );
        renderShelf();
        renderGroups();
        listenForBookChanges();
        listenForGroupChanges();
    }
    initialize();
})();
