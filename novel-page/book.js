/* =================================
   小说页面功能
================================= */
(function () {
    "use strict";
    /* =================================
       获取小说
    ================================= */
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("id");
    const storage = window.WritingStorage;
    if (
        !bookId ||
        !storage ||
        typeof storage.getBook !== "function"
    ) {
        alert("无法读取小说，请返回书架重新进入。");
        return;
    }
    const book = storage.getBook(bookId);
    if (!book) {
        alert("没有找到这本小说。");
        return;
    }
    /* =================================
       页面元素
    ================================= */
    const elements = {
        title: document.getElementById("book-title"),
        back: document.getElementById("back-to-shelf"),
        add: document.getElementById("open-create-menu"),
        menu: document.getElementById("create-menu"),
        outline: document.getElementById("book-outline"),
        allPanel: document.getElementById("all-books-panel"),
        infoPanel: document.getElementById("book-info-panel"),
        editorPanel: document.getElementById("chapter-editor-panel"),
        allTab: document.getElementById("tab-all-books"),
        infoTab: document.getElementById("tab-book-info"),
        bookName: document.getElementById("book-name"),
        description: document.getElementById("book-description"),
        cover: document.getElementById("book-cover"),
        backOutline: document.getElementById("back-to-outline"),
        chapterTitle: document.getElementById("chapter-title"),
        chapterContent: document.getElementById("chapter-content"),
        saveStatus: document.getElementById("save-status")
    };
    /* =================================
       检查必要页面元素
    ================================= */
    for (const key of Object.keys(elements)) {
        if (!elements[key]) {
            console.error("小说页面缺少必要元素：", key);
            return;
        }
    }
    /* =================================
       小说数据
    ================================= */
    const DATA_KEY = "writing-book-structure:" + bookId;
    const INFO_KEY = "writing-book-info:" + bookId;
    function createId() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return window.crypto.randomUUID();
        }
        return "item-" + Date.now() + "-" +
            Math.random().toString(36).slice(2);
    }
    function createEmptyData() {
        return {
            version: 1,
            preface: null,
            volumes: []
        };
    }
    function loadData() {
        try {
            const saved = localStorage.getItem(DATA_KEY);
            if (!saved) {
                return createEmptyData();
            }
            const result = JSON.parse(saved);
            if (
                !result ||
                !Array.isArray(result.volumes)
            ) {
                return createEmptyData();
            }
            if (!("preface" in result)) {
                result.preface = null;
            }
            result.volumes.forEach(function (volume) {
                if (!Array.isArray(volume.parts)) {
                    volume.parts = [];
                }
                if (!Array.isArray(volume.chapters)) {
                    volume.chapters = [];
                }
                volume.parts.forEach(function (part) {
                    if (!Array.isArray(part.chapters)) {
                        part.chapters = [];
                    }
                });
            });
            return result;
        } catch (error) {
            console.error("读取小说目录失败：", error);
            return createEmptyData();
        }
    }
    let data = loadData();
    /* =================================
       保存小说目录
    ================================= */
    function saveData() {
        try {
            localStorage.setItem(
                DATA_KEY,
                JSON.stringify(data)
            );
            elements.saveStatus.textContent = "已保存";
            return true;
        } catch (error) {
            console.error("保存小说失败：", error);
            elements.saveStatus.textContent = "保存失败";
            alert("保存失败，请检查手机存储空间。");
            return false;
        }
    }
    /* =================================
       书籍信息
    ================================= */
    function loadBookInfo() {
        let info = {
            title: book.title || "未命名小说",
            description: book.description || "",
            cover: book.cover || ""
        };
        try {
            const saved = localStorage.getItem(INFO_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === "object") {
                    info = {
                        ...info,
                        ...parsed
                    };
                }
            }
        } catch (error) {
            console.error("读取书籍信息失败：", error);
        }
        return info;
    }
    let bookInfo = loadBookInfo();
    function renderBookInfo() {
        elements.title.textContent =
            bookInfo.title || "未命名小说";
        elements.bookName.value =
            bookInfo.title || "";
        elements.description.value =
            bookInfo.description || "";
        if (bookInfo.cover) {
            elements.cover.src = bookInfo.cover;
            elements.cover.style.display = "block";
        } else {
            elements.cover.removeAttribute("src");
            elements.cover.style.display = "none";
        }
    }
    function saveBookInfo() {
        bookInfo.title =
            elements.bookName.value.trim() || "未命名小说";
        bookInfo.description =
            elements.description.value;
        try {
            localStorage.setItem(
                INFO_KEY,
                JSON.stringify(bookInfo)
            );
            elements.title.textContent = bookInfo.title;
        } catch (error) {
            console.error("保存书籍信息失败：", error);
            alert("书籍信息保存失败。");
        }
    }
    elements.bookName.addEventListener("change", saveBookInfo);
    elements.description.addEventListener("change", saveBookInfo);
    /* =================================
       页面切换
    ================================= */
    function showPanel(panel) {
        elements.allPanel.hidden = panel !== "all";
        elements.infoPanel.hidden = panel !== "info";
        elements.editorPanel.hidden = panel !== "editor";
        elements.allTab.classList.toggle(
            "active",
            panel === "all"
        );
        elements.infoTab.classList.toggle(
            "active",
            panel === "info"
        );
        elements.menu.hidden = true;
        elements.menu.classList.add("hidden");
        if (panel === "all") {
            elements.add.style.display = "";
        } else {
            elements.add.style.display = "none";
        }
    }
    elements.allTab.addEventListener("click", function () {
        closeEditor();
        showPanel("all");
    });
    elements.infoTab.addEventListener("click", function () {
        closeEditor();
        showPanel("info");
    });
    /* =================================
       返回书架
    ================================= */
    elements.back.addEventListener("click", function () {
        closeEditor();
        saveBookInfo();
        window.location.href = "../index.html";
    });
    /* =================================
       新建菜单
    ================================= */
    function toggleMenu() {
        const isHidden = elements.menu.hidden;
        elements.menu.hidden = !isHidden;
        elements.menu.classList.toggle("hidden", !isHidden);
    }
    elements.add.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleMenu();
    });
    document.addEventListener("click", function (event) {
        if (
            !elements.menu.contains(event.target) &&
            !elements.add.contains(event.target)
        ) {
            elements.menu.hidden = true;
            elements.menu.classList.add("hidden");
        }
    });
    elements.menu.addEventListener("click", function (event) {
        const button = event.target.closest("[data-create]");
        if (!button) return;
        const type = button.dataset.create;
        elements.menu.hidden = true;
        elements.menu.classList.add("hidden");
        if (type === "volume") createVolume();
        if (type === "part") createPart();
        if (type === "chapter") createChapter();
        if (type === "preface") createPreface();
    });
    /* =================================
       新建卷
    ================================= */
    function createVolume() {
        const title = prompt("请输入卷名：", "第一卷");
        if (title === null || !title.trim()) return;
        data.volumes.push({
            id: createId(),
            type: "volume",
            title: title.trim(),
            parts: [],
            chapters: []
        });
        saveData();
        renderOutline();
    }
    /* =================================
       新建篇
    ================================= */
    function createPart() {
        if (data.volumes.length === 0) {
            alert("请先创建一卷。");
            return;
        }
        const choices = data.volumes
            .map(function (volume, index) {
                return (index + 1) + ". " + volume.title;
            })
            .join("\n");
        const answer = prompt(
            "请选择篇所属的卷，输入编号：\n" + choices
        );
        if (answer === null) return;
        const index = Number(answer) - 1;
        const volume = data.volumes[index];
        if (!Number.isInteger(index) || !volume) {
            alert("卷编号不正确。");
            return;
        }
        const title = prompt("请输入篇名：", "第一篇");
        if (title === null || !title.trim()) return;
        volume.parts.push({
            id: createId(),
            type: "part",
            title: title.trim(),
            chapters: []
        });
        saveData();
        renderOutline();
    }
    /* =================================
       新建章
    ================================= */
    function createChapter() {
        const parents = [];
        data.volumes.forEach(function (volume) {
            parents.push({
                volume: volume,
                part: null,
                title: volume.title + "（卷内章节）"
            });
            volume.parts.forEach(function (part) {
                parents.push({
                    volume: volume,
                    part: part,
                    title: volume.title + " / " + part.title
                });
            });
        });
        if (parents.length === 0) {
            alert("请先创建一卷。");
            return;
        }
        const choices = parents
            .map(function (item, index) {
                return (index + 1) + ". " + item.title;
            })
            .join("\n");
        const answer = prompt(
            "请选择章节所属位置，输入编号：\n" + choices
        );
        if (answer === null) return;
        const index = Number(answer) - 1;
        const parent = parents[index];
        if (!Number.isInteger(index) || !parent) {
            alert("选择编号不正确。");
            return;
        }
        const title = prompt("请输入章节名称：", "第一章");
        if (title === null || !title.trim()) return;
        const chapter = {
            id: createId(),
            type: "chapter",
            title: title.trim(),
            content: ""
        };
        if (parent.part) {
            parent.part.chapters.push(chapter);
        } else {
            parent.volume.chapters.push(chapter);
        }
        saveData();
        renderOutline();
    }
    /* =================================
       新建序
    ================================= */
    function createPreface() {
        if (data.preface) {
            alert("每本小说只能创建一次序。");
            return;
        }
        const title = prompt("请输入序的名称：", "序");
        if (title === null || !title.trim()) return;
        data.preface = {
            id: createId(),
            type: "preface",
            title: title.trim(),
            content: ""
        };
        saveData();
        renderOutline();
    }
    /* =================================
       显示目录
    ================================= */
    function renderOutline() {
        elements.outline.replaceChildren();
        /*
         * 序永远显示在目录最上方
         */
        if (data.preface) {
            renderChapter(
                data.preface,
                elements.outline,
                "序"
            );
        }
        /*
         * 显示卷
         */
        data.volumes.forEach(function (volume) {
            const volumeBox = createBox(
                "卷",
                volume.title
            );
            elements.outline.appendChild(volumeBox);
            /*
             * 显示篇
             */
            volume.parts.forEach(function (part) {
                const partBox = createBox(
                    "篇",
                    part.title
                );
                volumeBox.appendChild(partBox);
                part.chapters.forEach(function (chapter) {
                    renderChapter(
                        chapter,
                        partBox,
                        "章"
                    );
                });
            });
            /*
             * 显示直接属于卷的章节
             */
            volume.chapters.forEach(function (chapter) {
                renderChapter(
                    chapter,
                    volumeBox,
                    "章"
                );
            });
        });
    }
    /* =================================
       创建目录容器
    ================================= */
    function createBox(type, title) {
        const box = document.createElement("div");
        box.className = "outline-box";
        box.style.padding = "12px";
        box.style.marginBottom = "10px";
        box.style.border = "1px solid #e5e5e5";
        box.style.borderRadius = "8px";
        const heading = document.createElement("div");
        heading.textContent = type + " · " + title;
        heading.style.fontWeight = "600";
        heading.style.marginBottom = "10px";
        box.appendChild(heading);
        return box;
    }
    /* =================================
       显示章节
    ================================= */
    function renderChapter(chapter, parent, type) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "outline-chapter";
        button.textContent =
            type + " · " + chapter.title;
        button.style.display = "block";
        button.style.width = "100%";
        button.style.padding = "12px";
        button.style.marginBottom = "6px";
        button.style.textAlign = "left";
        button.style.border = "none";
        button.style.borderRadius = "6px";
        button.style.background = "#f5f5f5";
        button.style.color = "inherit";
        button.addEventListener("click", function () {
            openChapter(chapter);
        });
        parent.appendChild(button);
    }
    /* =================================
       打开章节正文
    ================================= */
    let currentChapter = null;
    let saveTimer = null;
    function openChapter(chapter) {
        currentChapter = chapter;
        elements.chapterTitle.value =
            chapter.title || "";
        elements.chapterContent.value =
            chapter.content || "";
        elements.saveStatus.textContent = "自动保存";
        showPanel("editor");
    }
    /* =================================
       编辑正文
    ================================= */
    function saveCurrentChapter() {
        if (!currentChapter) return true;
        currentChapter.title =
            elements.chapterTitle.value.trim() || "未命名章节";
        currentChapter.content =
            elements.chapterContent.value;
        const success = saveData();
        if (success) {
            renderOutline();
        }
        return success;
    }
    function scheduleSave() {
        if (!currentChapter) return;
        elements.saveStatus.textContent = "正在保存……";
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            saveCurrentChapter();
        }, 500);
    }
    elements.chapterTitle.addEventListener(
        "input",
        scheduleSave
    );
    elements.chapterContent.addEventListener(
        "input",
        scheduleSave
    );
    /* =================================
       关闭正文编辑
    ================================= */
    function closeEditor() {
        if (!currentChapter) return;
        clearTimeout(saveTimer);
        saveCurrentChapter();
        currentChapter = null;
    }
    elements.backOutline.addEventListener("click", function () {
        closeEditor();
        showPanel("all");
    });
    /* =================================
       页面初始化
    ================================= */
    renderBookInfo();
    renderOutline();
    showPanel("all");
})();
