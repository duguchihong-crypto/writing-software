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
       检查必要元素
    ================================= */
    for (const key of Object.keys(elements)) {
        if (!elements[key]) {
            console.error("小说页面缺少必要元素：", key);
            alert("小说页面加载不完整，请检查 book.html。");
            return;
        }
    }
    /* =================================
       独立数据存储
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
    /* =================================
       数据整理
    ================================= */
    function normalizeChapter(chapter, type) {
        if (!chapter || typeof chapter !== "object") {
            return null;
        }
        return {
            id: chapter.id || createId(),
            type: type,
            title: String(chapter.title || ""),
            content: String(chapter.content || "")
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
            const data = createEmptyData();
            if (result.preface) {
                data.preface = normalizeChapter(
                    result.preface,
                    "preface"
                );
            }
            data.volumes = result.volumes
                .filter(function (volume) {
                    return volume && typeof volume === "object";
                })
                .map(function (volume) {
                    const normalizedVolume = {
                        id: volume.id || createId(),
                        type: "volume",
                        title: String(volume.title || "未命名卷"),
                        parts: [],
                        chapters: []
                    };
                    if (Array.isArray(volume.parts)) {
                        normalizedVolume.parts = volume.parts
                            .filter(function (part) {
                                return part && typeof part === "object";
                            })
                            .map(function (part) {
                                return {
                                    id: part.id || createId(),
                                    type: "part",
                                    title: String(part.title || "未命名篇"),
                                    chapters: Array.isArray(part.chapters)
                                        ? part.chapters
                                            .map(function (chapter) {
                                                return normalizeChapter(
                                                    chapter,
                                                    "chapter"
                                                );
                                            })
                                            .filter(Boolean)
                                        : []
                                };
                            });
                    }
                    if (Array.isArray(volume.chapters)) {
                        normalizedVolume.chapters =
                            volume.chapters
                                .map(function (chapter) {
                                    return normalizeChapter(
                                        chapter,
                                        "chapter"
                                    );
                                })
                                .filter(Boolean);
                    }
                    return normalizedVolume;
                });
            return data;
        } catch (error) {
            console.error("读取小说目录失败：", error);
            return createEmptyData();
        }
    }
    let data = loadData();
    /* =================================
       保存小说目录
    ================================= */
    function setSaveStatus(message) {
        if (elements.saveStatus) {
            elements.saveStatus.textContent = message;
        }
    }
    function saveData() {
        try {
            localStorage.setItem(
                DATA_KEY,
                JSON.stringify(data)
            );
            setSaveStatus("已保存");
            return true;
        } catch (error) {
            console.error("保存小说失败：", error);
            setSaveStatus("保存失败");
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
    let infoSaveTimer = null;
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
            // 同步更新书架中的书籍信息
            if (typeof storage.updateBook === "function") {
                storage.updateBook(bookId, {
                    title: bookInfo.title,
                    description: bookInfo.description,
                    cover: bookInfo.cover
                });
            }
            return true;
        } catch (error) {
            console.error("保存书籍信息失败：", error);
            return false;
        }
    }
    function scheduleInfoSave() {
        clearTimeout(infoSaveTimer);
        infoSaveTimer = setTimeout(function () {
            saveBookInfo();
        }, 500);
    }
    elements.bookName.addEventListener(
        "input",
        scheduleInfoSave
    );
    elements.description.addEventListener(
        "input",
        scheduleInfoSave
    );
    /* =================================
       页面切换
    ================================= */
    function setPanelVisible(element, visible) {
        element.hidden = !visible;
        element.classList.toggle("hidden", !visible);
    }
    function showPanel(panel) {
        setPanelVisible(
            elements.allPanel,
            panel === "all"
        );
        setPanelVisible(
            elements.infoPanel,
            panel === "info"
        );
        setPanelVisible(
            elements.editorPanel,
            panel === "editor"
        );
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
        elements.add.style.display =
            panel === "all" ? "" : "none";
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
        clearTimeout(infoSaveTimer);
        saveBookInfo();
        window.location.href = "../index.html";
    });
    /* =================================
       新建菜单
    ================================= */
    function closeMenu() {
        elements.menu.hidden = true;
        elements.menu.classList.add("hidden");
    }
    function toggleMenu() {
        const isHidden =
            elements.menu.hidden ||
            elements.menu.classList.contains("hidden");
        elements.menu.hidden = !isHidden;
        elements.menu.classList.toggle(
            "hidden",
            !isHidden
        );
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
            closeMenu();
        }
    });
    elements.menu.addEventListener("click", function (event) {
        const button = event.target.closest("[data-create]");
        if (!button) return;
        const type = button.dataset.create;
        closeMenu();
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
            "请选择篇所属的卷，输入编号：\n\n" + choices
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
            "请选择章节所属位置，输入编号：\n\n" + choices
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
        // 序始终排在最上方
        if (data.preface) {
            renderChapter(
                data.preface,
                elements.outline
            );
        }
        // 显示卷
        data.volumes.forEach(function (volume) {
            const volumeBox = createBox(
                "outline-volume",
                volume.title
            );
            elements.outline.appendChild(volumeBox);
            // 显示篇
            volume.parts.forEach(function (part) {
                const partBox = createBox(
                    "outline-part",
                    part.title
                );
                volumeBox.appendChild(partBox);
                // 显示篇内章节
                part.chapters.forEach(function (chapter) {
                    renderChapter(chapter, partBox);
                });
            });
            // 显示直接属于卷的章节
            volume.chapters.forEach(function (chapter) {
                renderChapter(chapter, volumeBox);
            });
        });
    }
    /* =================================
       创建目录容器
    ================================= */
    function createBox(className, title) {
        const box = document.createElement("div");
        box.className = className;
        const heading = document.createElement("div");
        heading.className = "outline-heading";
        heading.textContent = title;
        box.appendChild(heading);
        return box;
    }
    /* =================================
       显示章节
    ================================= */
    function renderChapter(chapter, parent) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "outline-chapter";
        button.textContent = chapter.title || "未命名章节";
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
        if (currentChapter) {
            closeEditor();
        }
        currentChapter = chapter;
        elements.chapterTitle.value =
            chapter.title || "";
        elements.chapterContent.value =
            chapter.content || "";
        setSaveStatus("自动保存");
        showPanel("editor");
    }
    /* =================================
       保存正文
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
    /* =================================
       正文自动保存
    ================================= */
    function scheduleSave() {
        if (!currentChapter) return;
        setSaveStatus("正在保存……");
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
       页面离开前保存
    ================================= */
    window.addEventListener("pagehide", function () {
        clearTimeout(saveTimer);
        clearTimeout(infoSaveTimer);
        if (currentChapter) {
            saveCurrentChapter();
        }
        saveBookInfo();
    });
    /* =================================
       页面初始化
    ================================= */
    renderBookInfo();
    renderOutline();
    showPanel("all");
})();
