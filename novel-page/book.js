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

    if (!bookId || !storage || typeof storage.getBook !== "function") {
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
        fullPanel: document.getElementById("full-book-panel"),
        fullContent: document.getElementById("full-book-content"),
        infoPanel: document.getElementById("book-info-panel"),
        editorPanel: document.getElementById("chapter-editor-panel"),

        directoryTab: document.getElementById("tab-directory"),
        fullTab: document.getElementById("tab-full-book"),
        infoTab: document.getElementById("tab-book-info"),

        bookName: document.getElementById("book-name"),
        description: document.getElementById("book-description"),
        cover: document.getElementById("book-cover"),

        backOutline: document.getElementById("back-to-outline"),
        chapterTitle: document.getElementById("chapter-title"),
        chapterContent: document.getElementById("chapter-content"),
        saveStatus: document.getElementById("save-status")
    };

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
        if (window.crypto &&
            typeof window.crypto.randomUUID === "function") {
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

            if (!result || !Array.isArray(result.volumes)) {
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
                        normalizedVolume.chapters = volume.chapters
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
        elements.saveStatus.textContent = message;
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

    let currentPanel = "directory";

    function setPanelVisible(element, visible) {
        element.hidden = !visible;
        element.classList.toggle("hidden", !visible);
    }

    function showPanel(panel) {
        currentPanel = panel;

        setPanelVisible(
            elements.allPanel,
            panel === "directory"
        );

        setPanelVisible(
            elements.fullPanel,
            panel === "full"
        );

        setPanelVisible(
            elements.infoPanel,
            panel === "info"
        );

        setPanelVisible(
            elements.editorPanel,
            panel === "editor"
        );

        elements.directoryTab.classList.toggle(
            "active",
            panel === "directory"
        );

        elements.fullTab.classList.toggle(
            "active",
            panel === "full"
        );

        elements.infoTab.classList.toggle(
            "active",
            panel === "info"
        );

        closeMenu();

        elements.add.style.display =
            panel === "directory" ? "" : "none";

        document.querySelector(".book-main").scrollTop = 0;
    }

    /* =================================
       底部三个页面
    ================================= */

    elements.directoryTab.addEventListener("click", function () {
        closeEditor();
        showPanel("directory");
    });

    elements.fullTab.addEventListener("click", function () {
        closeEditor();
        renderFullBook();
        showPanel("full");
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
       目录折叠状态
    ================================= */

    const foldState = {
        volumes: new Set(),
        parts: new Set()
    };

    /* =================================
       显示目录
    ================================= */

    function renderOutline() {
        elements.outline.replaceChildren();

        // 序：始终置顶

        if (data.preface) {
            renderChapter(data.preface, elements.outline, true);
        }

        // 卷：只展开篇

        data.volumes.forEach(function (volume) {
            const volumeBox = document.createElement("div");

            volumeBox.className = "outline-volume";

            const volumeHeading = createFoldHeading(
                volume.title,
                foldState.volumes.has(volume.id)
            );

            volumeBox.appendChild(volumeHeading);

            elements.outline.appendChild(volumeBox);

            const volumeContent = document.createElement("div");

            volumeContent.className = "outline-volume-content";

            volumeContent.hidden =
                !foldState.volumes.has(volume.id);

            volumeBox.appendChild(volumeContent);

            volumeHeading.addEventListener("click", function () {
                toggleVolume(volume.id);
            });

            // 卷内部只展示篇，不展示卷内直接章节

            volume.parts.forEach(function (part) {
                const partBox = document.createElement("div");

                partBox.className = "outline-part";

                const partHeading = createFoldHeading(
                    part.title,
                    foldState.parts.has(part.id)
                );

                partBox.appendChild(partHeading);

                volumeContent.appendChild(partBox);

                const partContent = document.createElement("div");

                partContent.className = "outline-part-content";

                partContent.hidden =
                    !foldState.parts.has(part.id);

                partBox.appendChild(partContent);

                partHeading.addEventListener("click", function () {
                    togglePart(part.id);
                });

                // 篇内章节

                part.chapters.forEach(function (chapter) {
                    renderChapter(chapter, partContent);
                });
            });
        });
    }

    /* =================================
       创建折叠标题
    ================================= */

    function createFoldHeading(title, expanded) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "outline-heading";

        const text = document.createElement("span");

        text.className = "outline-heading-title";
        text.textContent = title || "未命名";

        const icon = document.createElement("span");

        icon.className = "outline-fold-icon";
        icon.textContent = expanded ? "−" : "＋";

        button.appendChild(text);
        button.appendChild(icon);

        button.setAttribute(
            "aria-expanded",
            expanded ? "true" : "false"
        );

        return button;
    }

    /* =================================
       展开或收起卷
    ================================= */

    function toggleVolume(volumeId) {
        if (foldState.volumes.has(volumeId)) {
            foldState.volumes.delete(volumeId);

            // 收起卷时，同时清除内部篇的展开状态

            const volume = data.volumes.find(function (item) {
                return item.id === volumeId;
            });

            if (volume) {
                volume.parts.forEach(function (part) {
                    foldState.parts.delete(part.id);
                });
            }

        } else {
            foldState.volumes.add(volumeId);
        }

        renderOutline();
    }

    /* =================================
       展开或收起篇
    ================================= */

    function togglePart(partId) {
        if (foldState.parts.has(partId)) {
            foldState.parts.delete(partId);
        } else {
            foldState.parts.add(partId);
        }

        renderOutline();
    }

    /* =================================
       显示章节
    ================================= */

    function renderChapter(chapter, parent, isPreface) {
        const button = document.createElement("button");

        button.type = "button";

        button.className = isPreface
            ? "outline-chapter outline-preface"
            : "outline-chapter";

        button.textContent = chapter.title || "未命名章节";

        button.addEventListener("click", function () {
            openChapter(chapter);
        });

        parent.appendChild(button);
    }

    /* =================================
       全书内容
    ================================= */

    function renderFullBook() {
        elements.fullContent.replaceChildren();

        function createFullChapter(chapter, parent) {
            const section = document.createElement("section");

            section.className = "full-chapter";

            const heading = document.createElement("h3");

            heading.className = "full-chapter-title";
            heading.textContent = chapter.title || "未命名章节";

            const content = document.createElement("div");

            content.className = "full-chapter-text";
            content.textContent = chapter.content || "";

            const editButton = document.createElement("button");

            editButton.type = "button";
            editButton.className = "full-edit-button";
            editButton.textContent = "编辑章节";

            editButton.addEventListener("click", function () {
                openChapter(chapter);
            });

            section.appendChild(heading);

            if (chapter.content) {
                section.appendChild(content);
            } else {
                const empty = document.createElement("div");

                empty.className = "full-empty-text";
                empty.textContent = "暂无正文";

                section.appendChild(empty);
            }

            section.appendChild(editButton);
            parent.appendChild(section);
        }

        // 序

        if (data.preface) {
            const prefaceBox = document.createElement("section");

            prefaceBox.className = "full-preface";

            createFullChapter(data.preface, prefaceBox);

            elements.fullContent.appendChild(prefaceBox);
        }

        // 卷、篇、章

        data.volumes.forEach(function (volume) {
            const volumeBox = document.createElement("section");

            volumeBox.className = "full-volume";

            const volumeTitle = document.createElement("h2");

            volumeTitle.className = "full-volume-title";
            volumeTitle.textContent = volume.title;

            volumeBox.appendChild(volumeTitle);

            volume.parts.forEach(function (part) {
                const partTitle = document.createElement("h3");

                partTitle.className = "full-part-title";
                partTitle.textContent = part.title;

                volumeBox.appendChild(partTitle);

                part.chapters.forEach(function (chapter) {
                    createFullChapter(chapter, volumeBox);
                });
            });

            // 保留原有卷内章节的全书显示

            volume.chapters.forEach(function (chapter) {
                createFullChapter(chapter, volumeBox);
            });

            elements.fullContent.appendChild(volumeBox);
        });
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
            elements.chapterTitle.value.trim() ||
            "未命名章节";

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
        showPanel("directory");
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

    showPanel("directory");

})();
