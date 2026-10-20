/* ======================================================
   写作软件 · 首页书架与分组
   文件：page-js/home.js
====================================================== */

(function () {
    "use strict";


    /* ==================================================
       一、页面元素
    ================================================== */

    const elements = {
        emptyState: document.getElementById("empty-state"),
        shelfContent: document.getElementById("shelf-content"),
        shelfCount: document.getElementById("shelf-count"),
        shelfList: document.getElementById("shelf-list"),

        groupsContent: document.getElementById("home-groups"),
        groupsList: document.getElementById("home-groups-list")
    };


    /* ==================================================
       二、通用工具
    ================================================== */

    function escapeHTML(value) {
        if (
            window.WritingComponents &&
            typeof window.WritingComponents.escapeHTML === "function"
        ) {
            return window.WritingComponents.escapeHTML(
                String(value == null ? "" : value)
            );
        }

        return String(value == null ? "" : value)
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


    /* ==================================================
       三、书籍数据
    ================================================== */

    function getBookTitle(book) {
        const title =
            typeof book.title === "string"
                ? book.title.trim()
                : "";

        return title || "未命名书籍";
    }


    function getBookDescription(book) {
        const description =
            typeof book.description === "string"
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

        try {
            const legacyData = localStorage.getItem(
                "writing-software-book-covers"
            );

            if (legacyData) {
                const covers = JSON.parse(legacyData);
                const entry = covers && covers[book.id];

                if (
                    entry &&
                    typeof entry.data === "string" &&
                    entry.data.startsWith("data:image/")
                ) {
                    return entry.data;
                }
            }
        } catch (error) {
            console.warn(
                "[WritingHome] 无法读取旧版封面。",
                error
            );
        }

        return "";
    }


    /* ==================================================
       四、默认书籍封面
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
       五、书籍封面
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
       六、打开书籍
    ================================================== */

    function openBook(bookId) {
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

        url.searchParams.set("id", bookId);

        window.location.href = url.href;
    }


    /* ==================================================
       七、创建书籍卡片
    ================================================== */

    function createBookCard(book) {
        const card = document.createElement("article");

        card.className = "shelf-card";
        card.dataset.bookId = book.id;

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

        const openButton = card.querySelector(".shelf-card__open");

        openButton.addEventListener("click", function () {
            openBook(book.id);
        });

        const coverImage = card.querySelector(
            ".shelf-card__cover-image"
        );

        if (coverImage) {
            coverImage.addEventListener("error", function () {
                const coverContainer = coverImage.closest(
                    ".shelf-card__cover"
                );

                if (coverContainer) {
                    coverContainer.innerHTML =
                        createDefaultCover(title);
                }
            });
        }

        return card;
    }


    /* ==================================================
       八、显示空书架
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
    }


    /* ==================================================
       九、显示书籍列表
    ================================================== */

    function showBooks(books) {
        if (
            !elements.emptyState ||
            !elements.shelfContent ||
            !elements.shelfCount ||
            !elements.shelfList
        ) {
            return;
        }

        elements.emptyState.hidden = true;
        elements.shelfContent.hidden = false;
        elements.shelfCount.textContent = books.length + " 本";

        const fragment = document.createDocumentFragment();

        books.forEach(function (book) {
            if (book && typeof book === "object") {
                fragment.appendChild(createBookCard(book));
            }
        });

        elements.shelfList.replaceChildren(fragment);
    }


    /* ==================================================
       十、刷新书架
    ================================================== */

    function renderShelf() {
        if (
            !window.WritingStorage ||
            typeof window.WritingStorage.getBooks !== "function"
        ) {
            console.error(
                "[WritingHome] WritingStorage 尚未加载。"
            );

            return;
        }

        try {
            const books = window.WritingStorage.getBooks();

            if (!Array.isArray(books)) {
                console.error(
                    "[WritingHome] 书籍数据格式不正确。"
                );

                return;
            }

            const validBooks = books.filter(function (book) {
                return book && typeof book === "object";
            });

            if (!validBooks.length) {
                if (elements.shelfList) {
                    elements.shelfList.replaceChildren();
                }

                showEmptyState();
                return;
            }

            showBooks(validBooks);

        } catch (error) {
            console.error(
                "[WritingHome] 读取书架失败：",
                error
            );
        }
    }


    /* ==================================================
       十一、读取分组
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


    function readGroups() {
        const storage = getGroupsStorage();

        if (!storage) {
            console.error(
                "[WritingHome] 未找到分组存储接口。"
            );

            return null;
        }

        try {
            const result = storage.getGroups();

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
       十二、获取分组名称
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


    /* ==================================================
       十三、创建分组卡片
       卡片只显示组名字
    ================================================== */

    function createGroupCard(group) {
        const card = document.createElement("article");

        card.className = "home-group-card";

        card.innerHTML = `
            <h3 class="home-group-card__name">
                ${escapeHTML(getGroupName(group))}
            </h3>
        `;

        return card;
    }


    /* ==================================================
       十四、显示分组
    ================================================== */

    function showGroups(groups) {
        if (!elements.groupsContent || !elements.groupsList) {
            console.error(
                "[WritingHome] 找不到首页分组区域，请检查 index.html。"
            );

            return;
        }

        if (!Array.isArray(groups)) {
            return;
        }

        const validGroups = groups.filter(function (group) {
            return group && typeof group === "object";
        });

        const fragment = document.createDocumentFragment();

        validGroups.forEach(function (group) {
            fragment.appendChild(createGroupCard(group));
        });

        elements.groupsList.replaceChildren(fragment);

        elements.groupsContent.hidden = validGroups.length === 0;
    }


    /* ==================================================
       十五、刷新分组
    ================================================== */

    function renderGroups() {
        const groups = readGroups();

        if (groups !== null) {
            showGroups(groups);
        }
    }


    /* ==================================================
       十六、监听书籍变化
    ================================================== */

    function listenForBookChanges() {
        if (
            window.WritingStorage &&
            typeof window.WritingStorage.onChange === "function"
        ) {
            window.WritingStorage.onChange(renderShelf);
        } else {
            window.addEventListener(
                "writing-storage-change",
                renderShelf
            );
        }
    }


    /* ==================================================
       十七、监听分组变化
    ================================================== */

    function listenForGroupChanges() {
        const storage = getGroupsStorage();

        if (storage && typeof storage.onChange === "function") {
            storage.onChange(renderGroups);
        }

        window.addEventListener(
            "writing-groups-change",
            renderGroups
        );

        window.addEventListener(
            "writing-group-change",
            renderGroups
        );
    }


    /* ==================================================
       十八、跨页面同步
    ================================================== */

    window.addEventListener("storage", function (event) {
        if (event.key === "writing-software-groups") {
            renderGroups();
        }

        if (
            event.key === "writing-software-books" ||
            event.key === "writing-software-book-covers"
        ) {
            renderShelf();
        }
    });


    /* ==================================================
       十九、公开接口
    ================================================== */

    window.WritingHome = Object.freeze({
        render: renderShelf,
        renderGroups: renderGroups,
        openBook: openBook
    });


    /* ==================================================
       二十、初始化
    ================================================== */

    function initialize() {
        renderShelf();
        renderGroups();

        listenForBookChanges();
        listenForGroupChanges();
    }


    initialize();

})();
