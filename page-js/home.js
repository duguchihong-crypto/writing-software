/* ======================================================
   写作软件 · 首页书架
   文件：page-js/home.js

   功能：
   1. 读取书籍列表
   2. 显示空书架状态
   3. 显示书籍封面
   4. 显示书名、简介、字数、更新时间
   5. 点击书籍进入编辑器
   6. 监听书籍数据变化并刷新书架
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

        shelfList: document.getElementById("shelf-list")
    };


    /* ==================================================
       二、检查页面
    ================================================== */

    function validatePage() {
        return Boolean(
            elements.emptyState &&
            elements.shelfContent &&
            elements.shelfCount &&
            elements.shelfList
        );
    }

    if (!validatePage()) {
        console.error(
            "[WritingHome] 找不到必要的书架页面元素。"
        );

        return;
    }


    /* ==================================================
       三、通用工具
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

        // 兼容旧版独立封面存储。
        // 如果旧数据尚未迁移，也尝试读取。
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
            // 旧封面数据无法读取时，显示默认封面。
        }

        return "";
    }


    /* ==================================================
       四、创建默认封面
    ================================================== */

    function createDefaultCover(title) {
        const firstCharacter = Array.from(title)[0] || "书";

        return `
            <div class="shelf-card__cover shelf-card__cover--default"
                 aria-label="默认封面">
                <span class="shelf-card__cover-decoration"
                      aria-hidden="true">卷</span>

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
       五、创建书籍封面
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

                <div class="shelf-card__cover-fallback"
                     hidden>
                    ${createDefaultCover(title)}
                </div>
            </div>
        `;
    }


    /* ==================================================
       六、创建书籍卡片
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

        const openButton = card.querySelector(
            ".shelf-card__open"
        );

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

                if (!coverContainer) {
                    return;
                }

                coverContainer.innerHTML = createDefaultCover(title);
            });
        }

        return card;
    }


    /* ==================================================
       七、打开书籍
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
       八、显示空书架
    ================================================== */

    function showEmptyState() {
        elements.emptyState.hidden = false;

        elements.shelfContent.hidden = true;

        elements.shelfCount.textContent = "0 本";
    }


    /* ==================================================
       九、显示书籍列表
    ================================================== */

    function showBooks(books) {
        elements.emptyState.hidden = true;

        elements.shelfContent.hidden = false;

        elements.shelfCount.textContent =
            books.length + " 本";

        const fragment = document.createDocumentFragment();

        books.forEach(function (book) {
            fragment.appendChild(
                createBookCard(book)
            );
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

            if (!books.length) {
                elements.shelfList.replaceChildren();

                showEmptyState();

                return;
            }

            showBooks(books);

        } catch (error) {
            console.error(
                "[WritingHome] 读取书架失败：",
                error
            );
        }
    }


    /* ==================================================
       十一、监听书籍数据变化
    ================================================== */

    function listenForChanges() {
        if (
            window.WritingStorage &&
            typeof window.WritingStorage.onChange === "function"
        ) {
            window.WritingStorage.onChange(function () {
                renderShelf();
            });

            return;
        }

        window.addEventListener(
            "writing-storage-change",
            renderShelf
        );
    }


    /* ==================================================
       十二、初始化
    ================================================== */

    function initialize() {
        renderShelf();

        listenForChanges();
    }


    /* ==================================================
       十三、公开接口
    ================================================== */

    window.WritingHome = Object.freeze({
        render: renderShelf,
        openBook: openBook
    });


    initialize();

})();
