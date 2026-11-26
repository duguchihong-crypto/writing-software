/* ======================================================
   写作软件 · 首页统一书架
   文件：page-js/home.js

   功能：
   1. 书籍与分组统一显示在 #shelf-list
   2. 支持书籍和分组混合排列
   3. 书籍独立打开、改名、删除
   4. 分组独立改名、删除
   5. 全局浮动操作菜单
   6. 兼容网格模式与列表模式
   7. 兼容同步和异步存储
   8. 监听本地存储变化及跨页面同步
   9. 保留书籍封面和旧版封面读取
  10. 空书架判断同时考虑书籍与分组
  11. 保留原有公开接口
  12. 不修改或清除原有数据

   统一卡片标识：
   书籍：data-item-type="book"
         data-item-id="书籍ID"
         data-order-key="book:书籍ID"

   分组：data-item-type="group"
         data-item-id="分组ID"
         data-order-key="group:分组ID"
====================================================== */

(function () {
    "use strict";

    /* ==================================================
       一、重复初始化保护
    ================================================== */

    if (window.WritingHome) {
        console.warn("[WritingHome] 已初始化，跳过重复执行。");
        return;
    }

    /* ==================================================
       二、页面元素
    ================================================== */

    const elements = {
        emptyState: document.getElementById("empty-state"),
        shelfContent: document.getElementById("shelf-content"),
        shelfList: document.getElementById("shelf-list"),
        shelfCount: document.getElementById("shelf-count")
    };

    const STATE = {
        renderScheduled: false,
        requestId: 0,
        activeMenuContext: null,
        activeMenuTrigger: null,
        bookListenerRegistered: false,
        groupListenerRegistered: false
    };

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

        const messages = {
            TITLE_REQUIRED: "书名不能为空。",
            INVALID_COVER: "封面格式不正确，请重新选择图片。",
            STORAGE_FULL: "浏览器存储空间不足，请更换较小的封面图片后重试。",
            STORAGE_UNAVAILABLE: "浏览器存储不可用，请检查浏览器设置。",
            STORAGE_WRITE_FAILED: "保存失败，请检查浏览器存储空间后重试。",
            INVALID_DATABASE: "书籍数据格式异常。请勿清除数据，应先检查存储内容。"
        };

        if (error.code && messages[error.code]) {
            return messages[error.code];
        }

        if (error.message && messages[error.message]) {
            return messages[error.message];
        }

        if (
            typeof error.message === "string" &&
            error.message.trim()
        ) {
            return error.message;
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

    function getGroupId(group) {
        if (group.id !== undefined && group.id !== null) {
            return group.id;
        }

        if (group.groupId !== undefined && group.groupId !== null) {
            return group.groupId;
        }

        if (group.uuid !== undefined && group.uuid !== null) {
            return group.uuid;
        }

        return null;
    }

    /* ==================================================
       四、统一刷新调度
    ================================================== */

    function scheduleRender() {
        if (STATE.renderScheduled) {
            return;
        }

        STATE.renderScheduled = true;

        const schedule =
            window.requestAnimationFrame ||
            function (callback) {
                return window.setTimeout(callback, 0);
            };

        schedule(function () {
            STATE.renderScheduled = false;
            renderShelf();
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

        // 兼容旧版封面数据，只读取，不修改。

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
            console.warn("[WritingHome] 读取旧版封面失败。", error);
        }

        return "";
    }

    function createDefaultCover() {
        return `
            <div
                class="shelf-card__cover shelf-card__cover--default"
                aria-label="默认封面"
                role="img"
            ></div>
        `;
    }

    function createCoverHTML(book) {
        const title = getBookTitle(book);
        const cover = getBookCover(book);

        if (!cover) {
            return createDefaultCover();
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
       六、打开书籍
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
            "./novel-page/book.html",
            window.location.href
        );

        url.searchParams.set("id", String(bookId));

        window.location.href = url.href;
    }

    /* ==================================================
       七、全局浮动操作菜单
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
            <span class="home-action-menu__icon" aria-hidden="true">✎</span>
            <span>改名</span>
        </button>

        <button
            class="home-action-menu__item home-action-menu__item--danger"
            type="button"
            role="menuitem"
            data-action="delete"
        >
            <span class="home-action-menu__icon" aria-hidden="true">🗑</span>
            <span>删除</span>
        </button>
    `;

    document.body.appendChild(actionMenu);

    function closeActionMenu() {
        actionMenu.hidden = true;

        if (STATE.activeMenuTrigger) {
            STATE.activeMenuTrigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        STATE.activeMenuContext = null;
        STATE.activeMenuTrigger = null;
    }

    function positionActionMenu(trigger) {
        const margin = 8;
        const gap = 6;
        const rect = trigger.getBoundingClientRect();

        actionMenu.hidden = false;
        actionMenu.style.position = "fixed";
        actionMenu.style.left = "0px";
        actionMenu.style.top = "0px";

        const menuRect = actionMenu.getBoundingClientRect();
        const width = menuRect.width || 144;
        const height = menuRect.height || 96;

        let left = rect.right - width;
        let top = rect.bottom + gap;

        left = Math.max(
            margin,
            Math.min(left, window.innerWidth - width - margin)
        );

        if (top + height > window.innerHeight - margin) {
            top = rect.top - height - gap;
        }

        top = Math.max(
            margin,
            Math.min(top, window.innerHeight - height - margin)
        );

        actionMenu.style.left = left + "px";
        actionMenu.style.top = top + "px";
    }

    function openActionMenu(trigger, context) {
        if (
            STATE.activeMenuTrigger === trigger &&
            !actionMenu.hidden
        ) {
            closeActionMenu();
            return;
        }

        if (STATE.activeMenuTrigger) {
            STATE.activeMenuTrigger.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        STATE.activeMenuTrigger = trigger;
        STATE.activeMenuContext = context;

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
       八、书籍改名与删除
    ================================================== */

    function renameBook(bookId, oldTitle) {
        const storage = window.WritingStorage;

        if (!storage || typeof storage.updateBook !== "function") {
            showMessage("书籍存储功能不可用，无法修改书名。");
            return;
        }

        const input = window.prompt("请输入新的书名：", oldTitle);

        if (input === null) {
            return;
        }

        const newTitle = input.trim();

        if (!newTitle) {
            showMessage("书名不能为空。");
            return;
        }

        try {
            Promise.resolve(
                storage.updateBook(bookId, {
                    title: newTitle
                })
            )
                .then(function (updatedBook) {
                    if (!updatedBook) {
                        showMessage("修改失败，找不到这本书。");
                        return;
                    }

                    scheduleRender();
                })
                .catch(function (error) {
                    console.error("[WritingHome] 修改书名失败。", error);

                    showMessage(
                        getStorageErrorMessage(
                            error,
                            "修改书名失败，请稍后重试。"
                        )
                    );
                });
        } catch (error) {
            console.error("[WritingHome] 修改书名失败。", error);

            showMessage(
                getStorageErrorMessage(
                    error,
                    "修改书名失败，请稍后重试。"
                )
            );
        }
    }

    function deleteBook(bookId, title) {
        const storage = window.WritingStorage;

        if (!storage || typeof storage.deleteBook !== "function") {
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
            Promise.resolve(storage.deleteBook(bookId))
                .then(function (deleted) {
                    if (!deleted) {
                        showMessage("删除失败，找不到这本书。");
                        return;
                    }

                    closeActionMenu();
                    scheduleRender();
                })
                .catch(function (error) {
                    console.error("[WritingHome] 删除书籍失败。", error);

                    showMessage(
                        getStorageErrorMessage(
                            error,
                            "删除书籍失败，请稍后重试。"
                        )
                    );
                });
        } catch (error) {
            console.error("[WritingHome] 删除书籍失败。", error);

            showMessage(
                getStorageErrorMessage(
                    error,
                    "删除书籍失败，请稍后重试。"
                )
            );
        }
    }

    /* ==================================================
       九、分组存储接口
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

    function getGroupName(group) {
        const names = [
            group.name,
            group.title,
            group.groupName
        ];

        for (const name of names) {
            if (typeof name === "string" && name.trim()) {
                return name.trim();
            }
        }

        return "未命名分组";
    }

    /* ==================================================
       十、分组改名与删除
    ================================================== */

    function renameGroup(groupId, oldName) {
        const storage = getGroupsStorage();

        if (!storage || typeof storage.updateGroup !== "function") {
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
            Promise.resolve(
                storage.updateGroup(groupId, {
                    name: newName
                })
            )
                .then(function (updatedGroup) {
                    if (!updatedGroup) {
                        showMessage(
                            "修改分组名称失败，请检查分组是否存在。"
                        );
                        return;
                    }

                    scheduleRender();
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

    function deleteGroup(groupId, name) {
        const storage = getGroupsStorage();

        if (!storage || typeof storage.deleteGroup !== "function") {
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
            Promise.resolve(storage.deleteGroup(groupId))
                .then(function (deleted) {
                    if (!deleted) {
                        showMessage(
                            "删除分组失败，可能该分组已经不存在。"
                        );
                        return;
                    }

                    closeActionMenu();
                    scheduleRender();
                })
                .catch(function (error) {
                    console.error("[WritingHome] 删除分组失败。", error);

                    showMessage(
                        getStorageErrorMessage(
                            error,
                            "删除分组失败，请稍后重试。"
                        )
                    );
                });
        } catch (error) {
            console.error("[WritingHome] 删除分组失败。", error);

            showMessage(
                getStorageErrorMessage(
                    error,
                    "删除分组失败，请稍后重试。"
                )
            );
        }
    }

    /* ==================================================
       十一、操作菜单事件
    ================================================== */

    actionMenu.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button || !STATE.activeMenuContext) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const context = STATE.activeMenuContext;
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
            STATE.activeMenuTrigger &&
            STATE.activeMenuTrigger.contains(event.target)
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
       十二、创建统一卡片标识
    ================================================== */

    function setCardIdentity(card, type, id) {
        const stringId = String(id);

        card.dataset.itemType = type;
        card.dataset.itemId = stringId;
        card.dataset.orderKey = type + ":" + stringId;
    }

    /* ==================================================
       十三、创建书籍卡片
    ================================================== */

    function createBookCard(book) {
        const card = document.createElement("article");

        card.className = "shelf-card";

        setCardIdentity(card, "book", book.id);

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

        // 图片加载失败时恢复默认封面。

        const coverImage = card.querySelector(
            ".shelf-card__cover-image"
        );

        if (coverImage) {
            coverImage.addEventListener("error", function () {
                const coverContainer = coverImage.closest(
                    ".shelf-card__cover"
                );

                if (coverContainer) {
                    coverContainer.outerHTML = createDefaultCover();
                }
            });
        }

        return card;
    }

    /* ==================================================
       十四、创建分组卡片
    ================================================== */

    function createGroupCard(group) {
        const card = document.createElement("article");

        card.className = "home-group-card";

        const groupName = getGroupName(group);
        const groupId = getGroupId(group);

        if (groupId !== null) {
            setCardIdentity(card, "group", groupId);
            card.dataset.groupId = String(groupId);
        }

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
       十五、读取书籍
    ================================================== */

    async function readBooks() {
        const storage = window.WritingStorage;

        if (!storage || typeof storage.getBooks !== "function") {
            throw new Error("WritingStorage.getBooks() 不可用。");
        }

        const result = await Promise.resolve(storage.getBooks());

        if (!Array.isArray(result)) {
            throw new Error("getBooks() 没有返回数组。");
        }

        return result.filter(isValidBook);
    }

    /* ==================================================
       十六、读取分组
    ================================================== */

    async function readGroups() {
        const storage = getGroupsStorage();

        if (!storage) {
            console.warn("[WritingHome] 未找到分组存储接口。");
            return [];
        }

        const result = await Promise.resolve(storage.getGroups());

        if (Array.isArray(result)) {
            return result.filter(isValidGroup);
        }

        if (
            result &&
            typeof result === "object" &&
            Array.isArray(result.groups)
        ) {
            return result.groups.filter(isValidGroup);
        }

        console.error("[WritingHome] 分组数据格式不正确。", result);

        return [];
    }

    /* ==================================================
       十七、保留当前混合顺序
    ================================================== */

    function getCurrentOrder() {
        if (!elements.shelfList) {
            return [];
        }

        return Array.from(elements.shelfList.children)
            .map(function (card) {
                return card.dataset.orderKey || "";
            })
            .filter(Boolean);
    }

    function applyCurrentOrder(cards, previousOrder) {
        if (!previousOrder.length) {
            return cards;
        }

        const cardMap = new Map();

        cards.forEach(function (card) {
            cardMap.set(card.dataset.orderKey, card);
        });

        const ordered = [];

        previousOrder.forEach(function (key) {
            const card = cardMap.get(key);

            if (card) {
                ordered.push(card);
                cardMap.delete(key);
            }
        });

        // 新增项目放在末尾，不改变已有项目的相对顺序。

        cardMap.forEach(function (card) {
            ordered.push(card);
        });

        return ordered;
    }

    /* ==================================================
       十八、更新首页显示状态
    ================================================== */

    function updatePageState(bookCount, groupCount) {
        const hasItems = bookCount + groupCount > 0;

        if (elements.emptyState) {
            elements.emptyState.hidden = hasItems;
        }

        if (elements.shelfContent) {
            elements.shelfContent.hidden = !hasItems;
        }

        if (elements.shelfCount) {
            elements.shelfCount.textContent = bookCount + " 本";
        }
    }

    /* ==================================================
       十九、刷新布局
    ================================================== */

    function refreshLayouts() {
        [
            window.WritingHomeGrid,
            window.WritingHomeList
        ].forEach(function (module) {
            if (
                module &&
                typeof module.refresh === "function"
            ) {
                try {
                    module.refresh();
                } catch (error) {
                    console.error(
                        "[WritingHome] 布局刷新失败。",
                        error
                    );
                }
            }
        });
    }

    /* ==================================================
       二十、统一渲染书籍与分组
    ================================================== */

    function renderItems(books, groups) {
        if (!elements.shelfList) {
            console.error("[WritingHome] 找不到 #shelf-list。");
            return;
        }

        const previousOrder = getCurrentOrder();
        const cards = [];

        groups.forEach(function (group) {
            const groupId = getGroupId(group);

            // 没有有效 ID 的分组无法进行独立管理和排序。

            if (groupId === null || String(groupId).trim() === "") {
                console.warn(
                    "[WritingHome] 跳过没有有效 ID 的分组。",
                    group
                );
                return;
            }

            cards.push(createGroupCard(group));
        });

        books.forEach(function (book) {
            cards.push(createBookCard(book));
        });

        const orderedCards = applyCurrentOrder(
            cards,
            previousOrder
        );

        const fragment = document.createDocumentFragment();

        orderedCards.forEach(function (card) {
            fragment.appendChild(card);
        });

        elements.shelfList.replaceChildren(fragment);

        updatePageState(books.length, groups.length);

        refreshLayouts();

        console.info("[WritingHome] 统一书架渲染完成。", {
            bookCount: books.length,
            groupCount: groups.length,
            totalCount: orderedCards.length
        });
    }

    /* ==================================================
       二十一、统一刷新书架
       兼容同步和异步存储。
    ================================================== */

    async function renderShelf() {
        const requestId = ++STATE.requestId;

        try {
            const results = await Promise.all([
                readBooks(),
                readGroups()
            ]);

            // 忽略较早的读取结果。

            if (requestId !== STATE.requestId) {
                return;
            }

            const books = results[0];
            const groups = results[1];

            console.info("[WritingHome] 已读取首页数据。", {
                bookCount: books.length,
                groupCount: groups.length
            });

            renderItems(books, groups);

        } catch (error) {
            console.error("[WritingHome] 刷新首页失败。", error);

            // 读取失败时不清空现有页面和本地数据。
        }
    }

    /* ==================================================
       二十二、兼容旧版分组刷新接口
    ================================================== */

    function renderGroups() {
        return renderShelf();
    }

    /* ==================================================
       二十三、监听书籍变化
    ================================================== */

    function listenForBookChanges() {
        if (STATE.bookListenerRegistered) {
            return;
        }

        STATE.bookListenerRegistered = true;

        const storage = window.WritingStorage;

        if (
            storage &&
            typeof storage.onChange === "function"
        ) {
            try {
                storage.onChange(scheduleRender);
            } catch (error) {
                console.warn(
                    "[WritingHome] 注册书籍变化监听失败。",
                    error
                );
            }
        }

        [
            "writing-storage-change",
            "writing-book-change",
            "writing-books-change"
        ].forEach(function (eventName) {
            window.addEventListener(eventName, scheduleRender);
        });
    }

    /* ==================================================
       二十四、监听分组变化
    ================================================== */

    function listenForGroupChanges() {
        if (STATE.groupListenerRegistered) {
            return;
        }

        STATE.groupListenerRegistered = true;

        const storage = getGroupsStorage();

        if (
            storage &&
            typeof storage.onChange === "function"
        ) {
            try {
                storage.onChange(scheduleRender);
            } catch (error) {
                console.warn(
                    "[WritingHome] 注册分组变化监听失败。",
                    error
                );
            }
        }

        [
            "writing-groups-change",
            "writing-group-change"
        ].forEach(function (eventName) {
            window.addEventListener(eventName, scheduleRender);
        });
    }

    /* ==================================================
       二十五、跨页面存储同步
    ================================================== */

    window.addEventListener("storage", function (event) {
        const groupKeys = [
            "writing-software-groups",
            "writing-software-book-groups"
        ];

        const bookKeys = [
            "writing-software-books",
            "writing-software-book-covers"
        ];

        if (
            groupKeys.includes(event.key) ||
            bookKeys.includes(event.key)
        ) {
            scheduleRender();
        }
    });

    /* ==================================================
       二十六、公开首页接口
    ================================================== */

    window.WritingHome = Object.freeze({
        render: renderShelf,
        renderGroups: renderGroups,
        openBook: openBook,
        closeActionMenu: closeActionMenu
    });

    /* ==================================================
       二十七、初始化
    ================================================== */

    function initialize() {
        console.info("[WritingHome] 开始初始化统一书架。");

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

        listenForBookChanges();
        listenForGroupChanges();
    }

    initialize();

})();
