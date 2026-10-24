/* =========================================================
   分组排序模块
   文件：page-js/home-group-sort.js
   功能：
   1. 保存分组排列顺序
   2. 恢复分组排列顺序
   3. 拖动分组排序
   4. 上移、下移分组
   5. 保存或取消排序
   6. 兼容首页重新渲染
   7. 通过独立的 localStorage 键保存顺序
   不负责：
   - 小说排序
   - 分组增删改名
   - 小说与分组的关联
   - 书籍和分组的数据存储
   ========================================================= */
(function () {
  "use strict";
  const STORAGE_KEY = "writing-software-home-group-order";
  const SELECTORS = {
    container: "#home-groups-list",
    card: ".home-group-card"
  };
  const STATE = {
    initialized: false,
    sorting: false,
    originalOrder: [],
    observer: null,
    toolbar: null
  };
  /* ---------------------------------------------------------
     基础方法
  --------------------------------------------------------- */
  function getContainer() {
    return document.querySelector(SELECTORS.container);
  }
  function getCards() {
    const container = getContainer();
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(SELECTORS.card)
    );
  }
  function getGroupId(card) {
    if (!card) return "";
    return (
      card.dataset.groupId ||
      card.dataset.id ||
      card.getAttribute("data-group-id") ||
      ""
    );
  }
  function getCurrentOrder() {
    return getCards()
      .map(getGroupId)
      .filter(Boolean);
  }
  function loadOrder() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (!value) return [];
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter(function (id) {
            return typeof id === "string" && id.length > 0;
          })
        : [];
    } catch (error) {
      console.warn("[HomeGroupSort] 读取分组顺序失败：", error);
      return [];
    }
  }
  function saveOrder(order) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(order)
      );
      return true;
    } catch (error) {
      console.warn("[HomeGroupSort] 保存分组顺序失败：", error);
      return false;
    }
  }
  /* ---------------------------------------------------------
     应用排序
     只移动分组卡片，不操作书籍卡片。
     新增分组会自然排在保存顺序之外的末尾。
  --------------------------------------------------------- */
  function applyOrder(savedOrder) {
    const container = getContainer();
    if (!container) return;
    const cards = getCards();
    if (cards.length < 2) return;
    const order = Array.isArray(savedOrder)
      ? savedOrder
      : loadOrder();
    if (!order.length) return;
    const cardMap = new Map();
    cards.forEach(function (card) {
      const id = getGroupId(card);
      if (id) {
        cardMap.set(id, card);
      }
    });
    const fragment = document.createDocumentFragment();
    const used = new Set();
    order.forEach(function (id) {
      const card = cardMap.get(id);
      if (!card || used.has(id)) return;
      fragment.appendChild(card);
      used.add(id);
    });
    // 没有出现在旧顺序中的新分组放在最后。
    cards.forEach(function (card) {
      const id = getGroupId(card);
      if (!id || used.has(id)) return;
      fragment.appendChild(card);
      used.add(id);
    });
    container.appendChild(fragment);
  }
  function synchronizeOrder() {
    const current = getCurrentOrder();
    if (!current.length) return;
    saveOrder(current);
  }
  /* ---------------------------------------------------------
     排序按钮
  --------------------------------------------------------- */
  function createToolbar() {
    if (STATE.toolbar) return STATE.toolbar;
    const toolbar = document.createElement("div");
    toolbar.className = "home-group-sort__toolbar";
    toolbar.setAttribute("aria-label", "分组排序工具");
    toolbar.innerHTML = `
      <span class="home-group-sort__hint">拖动分组调整顺序</span>
      <div class="home-group-sort__actions">
        <button type="button"
                class="home-group-sort__save"
                data-group-sort-save>
          保存
        </button>
        <button type="button"
                class="home-group-sort__cancel"
                data-group-sort-cancel>
          取消
        </button>
      </div>
    `;
    Object.assign(toolbar.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "10px",
      margin: "12px 0",
      padding: "12px",
      border: "1px solid rgba(160, 35, 35, 0.22)",
      borderRadius: "10px",
      background: "#fffaf0"
    });
    const hint = toolbar.querySelector(
      ".home-group-sort__hint"
    );
    Object.assign(hint.style, {
      fontSize: "13px",
      color: "#594b3a"
    });
    const actions = toolbar.querySelector(
      ".home-group-sort__actions"
    );
    Object.assign(actions.style, {
      display: "flex",
      gap: "8px"
    });
    toolbar.querySelectorAll("button").forEach(function (button) {
      Object.assign(button.style, {
        padding: "7px 12px",
        border: "1px solid #9d2929",
        borderRadius: "6px",
        fontSize: "13px",
        cursor: "pointer"
      });
    });
    const saveButton = toolbar.querySelector(
      "[data-group-sort-save]"
    );
    Object.assign(saveButton.style, {
      background: "#9d2929",
      color: "#ffffff"
    });
    const cancelButton = toolbar.querySelector(
      "[data-group-sort-cancel]"
    );
    Object.assign(cancelButton.style, {
      background: "#ffffff",
      color: "#333333"
    });
    saveButton.addEventListener("click", save);
    cancelButton.addEventListener("click", cancel);
    STATE.toolbar = toolbar;
    return toolbar;
  }
  function showToolbar() {
    const container = getContainer();
    if (!container || !container.parentNode) return;
    const toolbar = createToolbar();
    if (!toolbar.isConnected) {
      container.parentNode.insertBefore(toolbar, container);
    }
    toolbar.hidden = false;
  }
  function hideToolbar() {
    if (STATE.toolbar) {
      STATE.toolbar.hidden = true;
    }
  }
  /* ---------------------------------------------------------
     排序状态
  --------------------------------------------------------- */
  function setSortingState(enabled) {
    STATE.sorting = Boolean(enabled);
    const container = getContainer();
    if (!container) return;
    container.classList.toggle(
      "home-group-sort--active",
      STATE.sorting
    );
    getCards().forEach(function (card) {
      card.draggable = STATE.sorting;
      card.classList.toggle(
        "home-group-card--sorting",
        STATE.sorting
      );
      card.setAttribute(
        "aria-grabbed",
        "false"
      );
    });
  }
  function start() {
    const cards = getCards();
    if (cards.length < 2) {
      if (typeof window.WritingHome?.showMessage === "function") {
        window.WritingHome.showMessage("至少需要两个分组才能排序。");
      }
      return false;
    }
    STATE.originalOrder = getCurrentOrder();
    setSortingState(true);
    showToolbar();
    bindDragEvents();
    return true;
  }
  function save() {
    const order = getCurrentOrder();
    saveOrder(order);
    setSortingState(false);
    hideToolbar();
    STATE.originalOrder = order.slice();
    return true;
  }
  function cancel() {
    applyOrder(STATE.originalOrder);
    setSortingState(false);
    hideToolbar();
    return true;
  }
  /* ---------------------------------------------------------
     拖动排序
  --------------------------------------------------------- */
  let draggedCard = null;
  function bindDragEvents() {
    const container = getContainer();
    if (!container || container.dataset.groupSortBound === "true") {
      return;
    }
    container.dataset.groupSortBound = "true";
    container.addEventListener("dragstart", function (event) {
      if (!STATE.sorting) {
        event.preventDefault();
        return;
      }
      const card = event.target.closest(SELECTORS.card);
      if (!card) {
        event.preventDefault();
        return;
      }
      draggedCard = card;
      card.classList.add("home-group-card--dragging");
      card.setAttribute("aria-grabbed", "true");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "text/plain",
          getGroupId(card)
        );
      }
    });
    container.addEventListener("dragover", function (event) {
      if (!STATE.sorting || !draggedCard) return;
      const target = event.target.closest(SELECTORS.card);
      if (!target || target === draggedCard) return;
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      if (insertAfter) {
        target.after(draggedCard);
      } else {
        target.before(draggedCard);
      }
    });
    container.addEventListener("drop", function (event) {
      if (!STATE.sorting) return;
      event.preventDefault();
    });
    container.addEventListener("dragend", function () {
      if (draggedCard) {
        draggedCard.classList.remove(
          "home-group-card--dragging"
        );
        draggedCard.setAttribute(
          "aria-grabbed",
          "false"
        );
      }
      draggedCard = null;
    });
  }
  /* ---------------------------------------------------------
     兼容首页重新渲染
  --------------------------------------------------------- */
  function refresh() {
    if (STATE.sorting) {
      setSortingState(true);
      bindDragEvents();
      return;
    }
    applyOrder(loadOrder());
  }
  function observeContainer() {
    const container = getContainer();
    if (!container || !window.MutationObserver) return;
    if (STATE.observer) {
      STATE.observer.disconnect();
    }
    STATE.observer = new MutationObserver(function () {
      if (STATE.sorting) {
        setSortingState(true);
      } else {
        applyOrder(loadOrder());
      }
    });
    STATE.observer.observe(container, {
      childList: true
    });
  }
  /* ---------------------------------------------------------
     监听设置菜单中的排序入口
     兼容几种常见 action 名称。
     不干涉书籍排序的 "sort" 事件。
  --------------------------------------------------------- */
  function bindSettingsActions() {
    window.addEventListener(
      "writing-home-settings-action",
      function (event) {
        const detail = event.detail || {};
        const action = detail.action;
        if (
          action === "sort-groups" ||
          action === "group-sort" ||
          action === "sortGroups"
        ) {
          start();
        }
      }
    );
  }
  /* ---------------------------------------------------------
     初始化
  --------------------------------------------------------- */
  function initialize() {
    if (STATE.initialized) return;
    STATE.initialized = true;
    applyOrder(loadOrder());
    bindDragEvents();
    bindSettingsActions();
    observeContainer();
  }
  /* ---------------------------------------------------------
     对外公开接口
  --------------------------------------------------------- */
  window.WritingHomeGroupSort = Object.freeze({
    start: start,
    save: save,
    cancel: cancel,
    refresh: refresh,
    isSorting: function () {
      return STATE.sorting;
    },
    getOrder: getCurrentOrder
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
