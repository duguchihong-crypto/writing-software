/* =========================================================
   分组视图模块
   文件：page-js/home-group-view.js
   功能：
   1. 进入指定分组
   2. 只显示该分组中的小说
   3. 返回书架首页
   4. 显示当前分组名称
   5. 兼容网格和列表模式
   6. 保存当前视图状态，供首页模块查询
   注意：
   - 本模块不创建、删除或修改分组
   - 本模块不删除、修改书籍
   - 本模块不负责书籍与分组的关联
   - 关联关系由 WritingStorage 管理
   ========================================================= */
(function () {
  "use strict";
  const STATE = {
    initialized: false,
    active: false,
    groupId: null,
    groupName: "",
    elements: {}
  };
  const SELECTORS = {
    homePage: "#home-page",
    groupsSection: "#home-groups",
    shelfSection: "#shelf-content",
    shelfList: "#shelf-list",
    groupsList: "#home-groups-list"
  };
  /* ---------------------------------------------------------
     DOM 工具
  --------------------------------------------------------- */
  function getElement(selector) {
    return document.querySelector(selector);
  }
  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function getStorage() {
    return window.WritingStorage || null;
  }
  function getGroupsStorage() {
    return window.WritingGroupsStorage || getStorage();
  }
  /* ---------------------------------------------------------
     分组数据
  --------------------------------------------------------- */
  function getGroups() {
    const storage = getGroupsStorage();
    if (!storage || typeof storage.getGroups !== "function") {
      return [];
    }
    try {
      const result = storage.getGroups();
      if (Array.isArray(result)) {
        return result;
      }
      if (result && Array.isArray(result.groups)) {
        return result.groups;
      }
    } catch (error) {
      console.error("[HomeGroupView] 读取分组失败：", error);
    }
    return [];
  }
  function getGroupId(group) {
    if (!group) return "";
    return String(
      group.id ||
      group.groupId ||
      group.uuid ||
      ""
    );
  }
  function getGroupName(group) {
    if (!group) return "未命名分组";
    return String(
      group.name ||
      group.title ||
      group.groupName ||
      "未命名分组"
    );
  }
  function findGroup(groupId) {
    return getGroups().find(function (group) {
      return getGroupId(group) === String(groupId);
    }) || null;
  }
  /* ---------------------------------------------------------
     读取分组中的书籍
     优先使用 WritingStorage.getGroupBooks。
     如果接口不存在，则尝试通过 group.bookIds 读取。
     不修改原始数据。
  --------------------------------------------------------- */
  function getGroupBooks(groupId) {
    const storage = getStorage();
    if (!storage) return [];
    if (typeof storage.getGroupBooks === "function") {
      try {
        const result = storage.getGroupBooks(groupId);
        if (Array.isArray(result)) {
          return result;
        }
        if (result && Array.isArray(result.books)) {
          return result.books;
        }
      } catch (error) {
        console.error("[HomeGroupView] 读取组内小说失败：", error);
      }
    }
    const group = findGroup(groupId);
    if (!group || !Array.isArray(group.bookIds)) {
      return [];
    }
    if (typeof storage.getBooks !== "function") {
      return [];
    }
    try {
      const books = storage.getBooks();
      if (!Array.isArray(books)) return [];
      const bookIdSet = new Set(
        group.bookIds.map(String)
      );
      return books.filter(function (book) {
        return book && bookIdSet.has(String(book.id));
      });
    } catch (error) {
      console.error("[HomeGroupView] 获取书籍列表失败：", error);
      return [];
    }
  }
  /* ---------------------------------------------------------
     创建分组视图顶部导航
  --------------------------------------------------------- */
  function ensureNavigation() {
    let navigation = document.getElementById(
      "home-group-view-navigation"
    );
    if (navigation) return navigation;
    navigation = document.createElement("div");
    navigation.id = "home-group-view-navigation";
    navigation.className = "home-group-view__navigation";
    navigation.innerHTML = `
      <button
        type="button"
        class="home-group-view__back"
        data-group-view-back
        aria-label="返回书架"
      >
        <span aria-hidden="true">‹</span>
        <span>返回书架</span>
      </button>
      <div class="home-group-view__heading">
        <h2
          class="home-group-view__title"
          data-group-view-title
        ></h2>
        <span
          class="home-group-view__count"
          data-group-view-count
        ></span>
      </div>
    `;
    Object.assign(navigation.style, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginBottom: "16px",
      padding: "12px 0"
    });
    const backButton = navigation.querySelector(
      "[data-group-view-back]"
    );
    Object.assign(backButton.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "8px 12px",
      border: "1px solid #9d2929",
      borderRadius: "8px",
      background: "#ffffff",
      color: "#9d2929",
      fontSize: "14px",
      cursor: "pointer"
    });
    const title = navigation.querySelector(
      "[data-group-view-title]"
    );
    Object.assign(title.style, {
      margin: "0",
      fontSize: "18px",
      fontWeight: "700",
      color: "#29231d",
      overflowWrap: "anywhere"
    });
    const count = navigation.querySelector(
      "[data-group-view-count]"
    );
    Object.assign(count.style, {
      fontSize: "12px",
      color: "#777777"
    });
    backButton.addEventListener("click", backToShelf);
    STATE.elements.navigation = navigation;
    return navigation;
  }
  /* ---------------------------------------------------------
     安置导航栏
  --------------------------------------------------------- */
  function mountNavigation() {
    const shelfSection = getElement(
      SELECTORS.shelfSection
    );
    if (!shelfSection) return false;
    const navigation = ensureNavigation();
    if (navigation.parentNode !== shelfSection) {
      shelfSection.insertBefore(
        navigation,
        shelfSection.firstChild
      );
    }
    return true;
  }
  /* ---------------------------------------------------------
     切换首页区域
  --------------------------------------------------------- */
  function showGroupView() {
    const groupsSection = getElement(
      SELECTORS.groupsSection
    );
    const shelfSection = getElement(
      SELECTORS.shelfSection
    );
    const emptyState = getElement("#empty-state");
    if (groupsSection) {
      groupsSection.hidden = true;
      groupsSection.style.display = "none";
    }
    if (emptyState) {
      emptyState.hidden = true;
      emptyState.style.display = "none";
    }
    if (shelfSection) {
      shelfSection.hidden = false;
      shelfSection.style.display = "";
    }
    document.documentElement.classList.add(
      "home-group-view-active"
    );
  }
  function showShelfView() {
    const groupsSection = getElement(
      SELECTORS.groupsSection
    );
    const shelfSection = getElement(
      SELECTORS.shelfSection
    );
    const emptyState = getElement("#empty-state");
    if (groupsSection) {
      groupsSection.hidden = false;
      groupsSection.style.display = "";
    }
    if (shelfSection) {
      shelfSection.hidden = false;
      shelfSection.style.display = "";
    }
    document.documentElement.classList.remove(
      "home-group-view-active"
    );
    const navigation = document.getElementById(
      "home-group-view-navigation"
    );
    if (navigation) {
      navigation.hidden = true;
      navigation.style.display = "none";
    }
    // 交回首页模块决定空状态和书架的显示方式。
    if (
      window.WritingHome &&
      typeof window.WritingHome.render === "function"
    ) {
      window.WritingHome.render();
    } else if (emptyState) {
      emptyState.hidden = false;
      emptyState.style.display = "";
    }
  }
  /* ---------------------------------------------------------
     设置标题和数量
  --------------------------------------------------------- */
  function updateNavigation(group, books) {
    mountNavigation();
    const navigation = STATE.elements.navigation;
    if (!navigation) return;
    const title = navigation.querySelector(
      "[data-group-view-title]"
    );
    const count = navigation.querySelector(
      "[data-group-view-count]"
    );
    title.textContent = getGroupName(group);
    count.textContent = books.length + " 本小说";
    navigation.hidden = false;
    navigation.style.display = "";
  }
  /* ---------------------------------------------------------
     组内空状态
  --------------------------------------------------------- */
  function showGroupEmptyState(groupName) {
    const shelfList = getElement(
      SELECTORS.shelfList
    );
    if (!shelfList) return;
    shelfList.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "home-group-view__empty";
    empty.innerHTML = `
      <div class="home-group-view__empty-title">
        此分组尚无小说
      </div>
      <div class="home-group-view__empty-description">
        可以返回书架，将已有小说加入「${escapeHTML(groupName)}」。
      </div>
    `;
    Object.assign(empty.style, {
      gridColumn: "1 / -1",
      padding: "36px 16px",
      textAlign: "center",
      color: "#777777",
      lineHeight: "1.8"
    });
    shelfList.appendChild(empty);
  }
  /* ---------------------------------------------------------
     渲染分组中的小说
     优先调用首页公开的 openBook 和书籍卡片渲染接口。
     如果现有 home.js 没有公开卡片接口，则发出事件，
     由首页模块负责渲染。
  --------------------------------------------------------- */
  function renderGroupBooks(groupId) {
    const shelfList = getElement(
      SELECTORS.shelfList
    );
    if (!shelfList) return;
    const group = findGroup(groupId);
    if (!group) {
      showShelfView();
      return;
    }
    const books = getGroupBooks(groupId);
    updateNavigation(group, books);
    shelfList.innerHTML = "";
    const home = window.WritingHome;
    if (home && typeof home.createBookCard === "function") {
      books.forEach(function (book) {
        shelfList.appendChild(
          home.createBookCard(book)
        );
      });
    } else {
      // 现有 home.js 尚未公开卡片创建方法时，
      // 通过事件通知其他模块，不在这里复制书籍卡片逻辑。
      window.dispatchEvent(
        new CustomEvent("writing-home-group-view-render", {
          detail: {
            groupId: String(groupId),
            group: group,
            books: books
          }
        })
      );
      // 若没有其他模块接手渲染，显示明确的空状态，
      // 避免把所有书籍错误地展示到当前分组。
      if (books.length === 0) {
        showGroupEmptyState(getGroupName(group));
      }
    }
    if (books.length === 0) {
      showGroupEmptyState(getGroupName(group));
    }
    if (window.WritingHomeGrid) {
      window.WritingHomeGrid.refresh();
    }
    if (window.WritingHomeList) {
      window.WritingHomeList.refresh();
    }
    document.dispatchEvent(
      new CustomEvent("writing-home-group-view-changed", {
        detail: {
          active: true,
          groupId: String(groupId),
          groupName: getGroupName(group),
          bookCount: books.length
        }
      })
    );
  }
  /* ---------------------------------------------------------
     进入分组
  --------------------------------------------------------- */
  function open(groupId) {
    if (groupId == null || String(groupId) === "") {
      return false;
    }
    const group = findGroup(groupId);
    if (!group) {
      console.warn("[HomeGroupView] 找不到指定分组：", groupId);
      return false;
    }
    STATE.active = true;
    STATE.groupId = String(groupId);
    STATE.groupName = getGroupName(group);
    showGroupView();
    renderGroupBooks(groupId);
    return true;
  }
  /* ---------------------------------------------------------
     返回书架
  --------------------------------------------------------- */
  function backToShelf() {
    STATE.active = false;
    STATE.groupId = null;
    STATE.groupName = "";
    showShelfView();
    document.dispatchEvent(
      new CustomEvent("writing-home-group-view-changed", {
        detail: {
          active: false,
          groupId: null,
          groupName: "",
          bookCount: 0
        }
      })
    );
  }
  /* ---------------------------------------------------------
     监听数据变化
     当前分组被删除时，自动返回书架。
     分组或书籍数据变化时，重新渲染当前分组。
  --------------------------------------------------------- */
  function bindStorageEvents() {
    window.addEventListener(
      "writing-groups-change",
      handleDataChange
    );
    window.addEventListener(
      "writing-group-change",
      handleDataChange
    );
    window.addEventListener(
      "writing-storage-change",
      handleDataChange
    );
    window.addEventListener(
      "writing-book-change",
      handleDataChange
    );
    window.addEventListener(
      "writing-books-change",
      handleDataChange
    );
  }
  function handleDataChange() {
    if (!STATE.active || !STATE.groupId) return;
    const group = findGroup(STATE.groupId);
    if (!group) {
      backToShelf();
      return;
    }
    STATE.groupName = getGroupName(group);
    renderGroupBooks(STATE.groupId);
  }
  /* ---------------------------------------------------------
     初始化
  --------------------------------------------------------- */
  function initialize() {
    if (STATE.initialized) return;
    STATE.initialized = true;
    bindStorageEvents();
    const groupsList = getElement(
      SELECTORS.groupsList
    );
    if (groupsList) {
      groupsList.addEventListener("click", function (event) {
        if (event.target.closest("button")) return;
        const card = event.target.closest(
          SELECTORS.card
        );
        if (!card) return;
        const groupId = getGroupId(card);
        if (groupId) {
          open(groupId);
        }
      });
    }
  }
  /* ---------------------------------------------------------
     对外公开接口
  --------------------------------------------------------- */
  window.WritingHomeGroupView = Object.freeze({
    open: open,
    back: backToShelf,
    isActive: function () {
      return STATE.active;
    },
    getCurrentGroupId: function () {
      return STATE.groupId;
    },
    getCurrentGroupName: function () {
      return STATE.groupName;
    },
    refresh: function () {
      if (STATE.active && STATE.groupId) {
        renderGroupBooks(STATE.groupId);
      }
    }
  });
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
