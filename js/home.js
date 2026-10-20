/* =========================================================
   写作软件 · 首页逻辑
   文件：js/home.js

   负责：
   1. 读取作品数据
   2. 判断书架状态
   3. 显示空书架提示
   4. 渲染作品列表
   5. 处理作品卡片点击
   6. 监听作品数据变化

   说明：
   当前版本使用 localStorage 保存的作品数据。
   后续新建作品页面应使用相同的数据格式。
========================================================= */


/* =========================================================
   一、首页模块
========================================================= */

const HomePage = (() => {

    "use strict";


    /* =====================================================
       1. 数据配置
    ===================================================== */

    const CONFIG = {

        // 作品数据的存储键名
        storageKey: "writing-software:works",

        // 作品编辑页面
        editorPage: "pages/editor.html",

        // 作品卡片标题最大显示长度
        titleMaxLength: 80

    };


    /* =====================================================
       2. 页面元素
    ===================================================== */

    const elements = {

        // 空书架提示
        emptyState: document.getElementById("empty-state"),

        // 作品区域
        shelfContent: document.getElementById("shelf-content"),

        // 作品列表容器
        shelfList: document.getElementById("shelf-list")

    };


    /* =====================================================
       3. 初始化状态
    ===================================================== */

    let initialized = false;


    /* =====================================================
       4. 安全读取作品数据
    ===================================================== */

    function getWorks() {

        try {

            const rawData = localStorage.getItem(
                CONFIG.storageKey
            );

            // 没有数据时返回空数组
            if (!rawData) {

                return [];

            }

            const parsedData = JSON.parse(rawData);

            // 当前约定：作品数据必须是数组
            if (!Array.isArray(parsedData)) {

                console.warn(
                    "[首页] 作品数据格式不正确。"
                );

                return [];

            }

            // 只保留合法的作品对象
            return parsedData.filter((work) => {

                return (
                    work !== null &&
                    typeof work === "object" &&
                    !Array.isArray(work) &&
                    typeof work.id === "string" &&
                    typeof work.title === "string"
                );

            });

        } catch (error) {

            console.error(
                "[首页] 读取作品数据失败：",
                error
            );

            return [];

        }

    }


    /* =====================================================
       5. 格式化日期
    ===================================================== */

    function formatDate(value) {

        if (!value) {

            return "";

        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {

            return "";

        }

        const year = date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;

    }


    /* =====================================================
       6. 创建作品卡片
    ===================================================== */

    function createWorkCard(work) {

        const card = document.createElement("article");

        card.className = "work-card";

        card.dataset.workId = work.id;


        /* -------------------------------------------------
           作品标题
        ------------------------------------------------- */

        const title = document.createElement("h2");

        title.className = "work-card__title";

        const safeTitle = work.title.trim();

        title.textContent = safeTitle
            ? safeTitle.slice(0, CONFIG.titleMaxLength)
            : "未命名作品";


        /* -------------------------------------------------
           作品类型
        ------------------------------------------------- */

        const type = document.createElement("p");

        type.className = "work-card__type";

        type.textContent = getWorkTypeLabel(work.type);


        /* -------------------------------------------------
           最近编辑时间
        ------------------------------------------------- */

        const updatedAt = document.createElement("p");

        updatedAt.className = "work-card__updated";

        const dateText = formatDate(
            work.updatedAt || work.createdAt
        );

        updatedAt.textContent = dateText
            ? `最近编辑：${dateText}`
            : "尚未记录编辑时间";


        /* -------------------------------------------------
           作品卡片内容
        ------------------------------------------------- */

        const content = document.createElement("div");

        content.className = "work-card__content";

        content.append(
            title,
            type,
            updatedAt
        );


        /* -------------------------------------------------
           作品卡片入口
        ------------------------------------------------- */

        const link = document.createElement("a");

        link.className = "work-card__link";

        link.href =
            `${CONFIG.editorPage}?id=${encodeURIComponent(work.id)}`;

        link.setAttribute(
            "aria-label",
            `打开作品：${safeTitle || "未命名作品"}`
        );

        link.appendChild(content);

        card.appendChild(link);

        return card;

    }


    /* =====================================================
       7. 获取作品类型名称
    ===================================================== */

    function getWorkTypeLabel(type) {

        const types = {

            novel: "长篇小说",

            short_story: "短篇小说",

            fanfiction: "同人小说",

            essay: "散文",

            script: "剧本",

            other: "其他作品"

        };

        return types[type] || "文学创作";

    }


    /* =====================================================
       8. 清空作品列表
    ===================================================== */

    function clearShelf() {

        if (!elements.shelfList) {

            return;

        }

        elements.shelfList.replaceChildren();

    }


    /* =====================================================
       9. 渲染作品列表
    ===================================================== */

    function renderWorks(works) {

        if (!elements.shelfList) {

            console.error(
                "[首页] 找不到作品列表容器。"
            );

            return;

        }

        clearShelf();

        const fragment = document.createDocumentFragment();

        works.forEach((work) => {

            fragment.appendChild(
                createWorkCard(work)
            );

        });

        elements.shelfList.appendChild(fragment);

    }


    /* =====================================================
       10. 切换首页状态
    ===================================================== */

    function render() {

        const works = getWorks();

        const hasWorks = works.length > 0;


        // 没有作品时显示空书架提示
        if (elements.emptyState) {

            elements.emptyState.hidden = hasWorks;

        }


        // 有作品时显示作品区域
        if (elements.shelfContent) {

            elements.shelfContent.hidden = !hasWorks;

        }


        // 有作品时渲染列表
        if (hasWorks) {

            renderWorks(works);

        } else {

            clearShelf();

        }

    }


    /* =====================================================
       11. 监听其他页面的数据变化
    ===================================================== */

    function handleStorageChange(event) {

        // 只处理作品数据对应的存储键
        if (
            event.key === CONFIG.storageKey ||
            event.key === null
        ) {

            render();

        }

    }


    /* =====================================================
       12. 监听页面重新显示
    ===================================================== */

    function handleVisibilityChange() {

        if (
            document.visibilityState === "visible"
        ) {

            render();

        }

    }


    /* =====================================================
       13. 初始化
    ===================================================== */

    function init() {

        if (initialized) {

            return;

        }

        initialized = true;


        // 首次渲染
        render();


        // 监听其他标签页中的作品变化
        window.addEventListener(
            "storage",
            handleStorageChange
        );


        // 页面重新显示时刷新
        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );


        console.info(
            "[首页] 初始化完成。"
        );

    }


    /* =====================================================
       14. 对外接口
    ===================================================== */

    return {

        init,

        render,

        getWorks

    };

})();


/* =========================================================
   二、启动首页
========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        HomePage.init,
        { once: true }
    );

} else {

    HomePage.init();

}
