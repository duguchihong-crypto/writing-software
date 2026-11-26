/* =========================================================
   统一书架排序模块
   文件：page-js/home-sort.js

   功能：
   1. 分组和书籍统一拖动排序
   2. 分组和书籍可以任意混合排列
   3. 上移、下移支持跨类型移动
   4. 保存统一排序
   5. 取消恢复原始顺序
   6. 刷新后恢复排序
   7. 不修改书籍和分组数据库
   8. 不覆盖旧版排序记录
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "writing-software-home-item-order";

  const SELECTORS = {
    shelf: "#shelf-list",
    card: ".shelf-card, .home-group-card"
  };

  const STATE = {
    sorting: false,
    originalOrder: [],
    draggedCard: null,
    toolbar: null,
    initialized: false
  };

  /* =========================================================
     基础工具
  ========================================================= */

  function getShelf() {
    return document.querySelector(SELECTORS.shelf);
  }

  function getCards() {
    const shelf = getShelf();

    if (!shelf) return [];

    return Array.from(shelf.children).filter(function (element) {
      return element.matches(SELECTORS.card);
    });
  }

  function getOrderKey(card) {
    if (!card) return null;

    // 优先使用统一排序标识。
    if (card.dataset.orderKey) {
      return card.dataset.orderKey;
    }

    // 兼容尚未修改的旧版书籍卡片。
    if (card.dataset.bookId) {
      return "book:" + card.dataset.bookId;
    }

    if (card.dataset.groupId) {
      return "group:" + card.dataset.groupId;
    }

    return null;
  }

  function getCurrentOrder() {
    return getCards()
      .map(getOrderKey)
      .filter(Boolean);
  }

  function readSavedOrder() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);

      if (!value) return [];

      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("[HomeSort] 读取排序失败：", error);
      return [];
    }
  }

  function writeSavedOrder(order) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(order)
      );

      return true;
    } catch (error) {
      console.error("[HomeSort] 保存排序失败：", error);

      showNotice("排序保存失败，请检查浏览器存储空间。");

      return false;
    }
  }

  function showNotice(message) {
    let notice = document.getElementById("home-sort-notice");

    if (!notice) {
      notice = document.createElement("div");

      notice.id = "home-sort-notice";
      notice.className = "home-sort__notice";

      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");

      document.body.appendChild(notice);
    }

    notice.textContent = message;
    notice.classList.add("is-visible");

    clearTimeout(notice._timer);

    notice._timer = setTimeout(function () {
      notice.classList.remove("is-visible");
    }, 2400);
  }

  /* =========================================================
     顺序恢复
  ========================================================= */

  function applyOrder(order) {
    const shelf = getShelf();

    if (!shelf) return;

    const cards = getCards();

    if (!cards.length) return;

    const cardMap = new Map();

    cards.forEach(function (card) {
      const key = getOrderKey(card);

      if (key) {
        cardMap.set(key, card);
      }
    });

    const orderedCards = [];

    // 先恢复已保存的顺序。
    order.forEach(function (key) {
      const card = cardMap.get(key);

      if (card) {
        orderedCards.push(card);
        cardMap.delete(key);
      }
    });

    // 新增项目追加到最后。
    cards.forEach(function (card) {
      const key = getOrderKey(card);

      if (key && cardMap.has(key)) {
        orderedCards.push(card);
        cardMap.delete(key);
      }
    });

    orderedCards.forEach(function (card) {
      shelf.appendChild(card);
    });
  }

  function applySavedOrder() {
    const savedOrder = readSavedOrder();

    if (!savedOrder.length) return;

    const currentOrder = getCurrentOrder();

    if (!currentOrder.length) return;

    const existingKeys = new Set(currentOrder);
    const mergedOrder = [];

    // 保留仍然存在的旧排序项目。
    savedOrder.forEach(function (key) {
      if (
        existingKeys.has(key) &&
        !mergedOrder.includes(key)
      ) {
        mergedOrder.push(key);
      }
    });

    // 新增项目追加到最后。
    currentOrder.forEach(function (key) {
      if (!mergedOrder.includes(key)) {
        mergedOrder.push(key);
      }
    });

    applyOrder(mergedOrder);

    // 删除已经不存在的项目。
    const changed =
      mergedOrder.length !== savedOrder.length ||
      mergedOrder.some(function (key, index) {
        return key !== savedOrder[index];
      });

    if (changed) {
      writeSavedOrder(mergedOrder);
    }
  }

  /* =========================================================
     排序工具栏
  ========================================================= */

  function createToolbar() {
    if (STATE.toolbar) {
      return STATE.toolbar;
    }

    const toolbar = document.createElement("div");

    toolbar.id = "home-sort-toolbar";
    toolbar.className = "home-sort__toolbar";
    toolbar.hidden = true;

    toolbar.innerHTML = `
      <div class="home-sort__toolbar-info">
        <span class="home-sort__toolbar-title">
          统一排序
        </span>

        <span class="home-sort__toolbar-description">
          拖动分组或书籍调整顺序
        </span>
      </div>

      <div class="home-sort__toolbar-actions">
        <button
          type="button"
          class="home-sort__button home-sort__button--cancel"
          data-home-sort-cancel
        >取消</button>

        <button
          type="button"
          class="home-sort__button home-sort__button--save"
          data-home-sort-save
        >保存</button>
      </div>
    `;

    const homePage = document.querySelector("#home-page");

    if (homePage) {
      homePage.insertBefore(toolbar, homePage.firstChild);
    } else {
      document.body.appendChild(toolbar);
    }

    toolbar.addEventListener("click", function (event) {
      if (event.target.closest("[data-home-sort-save]")) {
        saveSorting();
      }

      if (event.target.closest("[data-home-sort-cancel]")) {
        cancelSorting();
      }
    });

    STATE.toolbar = toolbar;

    return toolbar;
  }

  /* =========================================================
     拖动功能
  ========================================================= */

  function handleDragStart(event) {
    if (!STATE.sorting) {
      event.preventDefault();
      return;
    }

    const card = event.target.closest(SELECTORS.card);

    if (!card || !getOrderKey(card)) {
      event.preventDefault();
      return;
    }

    STATE.draggedCard = card;

    card.classList.add("is-sorting-dragged");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";

      event.dataTransfer.setData(
        "text/plain",
        getOrderKey(card)
      );
    }

    requestAnimationFrame(function () {
      if (STATE.draggedCard === card) {
        card.classList.add("is-sorting-ghost");
      }
    });
  }

  function handleDragOver(event) {
    if (!STATE.sorting || !STATE.draggedCard) {
      return;
    }

    const shelf = getShelf();

    if (!shelf || !shelf.contains(event.target)) {
      return;
    }

    const target = event.target.closest(SELECTORS.card);

    if (!target || target === STATE.draggedCard) {
      return;
    }

    if (!shelf.contains(target)) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const rect = target.getBoundingClientRect();

    // 网格模式优先根据左右位置判断。
    const gridMode = shelf.classList.contains("is-grid");

    let after;

    if (gridMode) {
      after = event.clientX > rect.left + rect.width / 2;
    } else {
      after = event.clientY > rect.top + rect.height / 2;
    }

    if (after) {
      target.after(STATE.draggedCard);
    } else {
      target.before(STATE.draggedCard);
    }

    updateMoveButtons();
  }

  function handleDragEnd() {
    if (STATE.draggedCard) {
      STATE.draggedCard.classList.remove(
        "is-sorting-dragged",
        "is-sorting-ghost"
      );
    }

    STATE.draggedCard = null;

    updateMoveButtons();
  }

  /* =========================================================
     上移、下移
  ========================================================= */

  function moveCard(card, direction) {
    if (!STATE.sorting || !card) return;

    const sibling = direction < 0
      ? card.previousElementSibling
      : card.nextElementSibling;

    if (
      !sibling ||
      !sibling.matches(SELECTORS.card)
    ) {
      return;
    }

    if (direction < 0) {
      sibling.before(card);
    } else {
      sibling.after(card);
    }

    updateMoveButtons();

    const button = card.querySelector(
      direction < 0
        ? "[data-home-sort-up]"
        : "[data-home-sort-down]"
    );

    if (button) {
      button.focus();
    }
  }

  function createMoveButtons(card) {
    if (card.querySelector(".home-sort__move-controls")) {
      return;
    }

    const isGroup = card.classList.contains("home-group-card");

    const controls = document.createElement("div");

    controls.className = "home-sort__move-controls";

    controls.innerHTML = `
      <button
        type="button"
        class="home-sort__move-button"
        data-home-sort-up
        aria-label="上移${isGroup ? "分组" : "书籍"}"
        title="上移"
      >↑</button>

      <button
        type="button"
        class="home-sort__move-button"
        data-home-sort-down
        aria-label="下移${isGroup ? "分组" : "书籍"}"
        title="下移"
      >↓</button>
    `;

    controls.addEventListener("click", function (event) {
      if (event.target.closest("[data-home-sort-up]")) {
        event.stopPropagation();
        moveCard(card, -1);
      }

      if (event.target.closest("[data-home-sort-down]")) {
        event.stopPropagation();
        moveCard(card, 1);
      }
    });

    card.appendChild(controls);
  }

  function removeMoveButtons(card) {
    const controls = card.querySelector(
      ".home-sort__move-controls"
    );

    if (controls) {
      controls.remove();
    }
  }

  function updateMoveButtons() {
    const cards = getCards();

    cards.forEach(function (card, index) {
      const up = card.querySelector("[data-home-sort-up]");
      const down = card.querySelector("[data-home-sort-down]");

      if (up) {
        up.disabled = index === 0;
      }

      if (down) {
        down.disabled = index === cards.length - 1;
      }
    });
  }

  /* =========================================================
     进入排序模式
  ========================================================= */

  function startSorting() {
    if (STATE.sorting) return;

    const shelf = getShelf();

    if (!shelf) {
      showNotice("找不到书架容器，暂时无法排序。");
      return;
    }

    const cards = getCards();

    if (!cards.length) {
      showNotice("书架里还没有内容。");
      return;
    }

    const missingKey = cards.some(function (card) {
      return !getOrderKey(card);
    });

    if (missingKey) {
      showNotice("部分卡片缺少排序标识，无法排序。");

      console.error(
        "[HomeSort] 卡片必须具有 data-order-key。"
      );

      return;
    }

    STATE.sorting = true;

    STATE.originalOrder = getCurrentOrder();

    document.body.classList.add("home-sorting-active");

    shelf.classList.add("is-sorting");

    cards.forEach(function (card) {
      card.draggable = true;

      card.classList.add("is-sorting-enabled");

      createMoveButtons(card);
    });

    const toolbar = createToolbar();

    toolbar.hidden = false;

    updateMoveButtons();

    showNotice("已进入统一排序模式。");
  }

  /* =========================================================
     保存排序
  ========================================================= */

  function saveSorting() {
    if (!STATE.sorting) return;

    const order = getCurrentOrder();

    if (!writeSavedOrder(order)) {
      return;
    }

    finishSorting();

    STATE.originalOrder = order.slice();

    showNotice("书籍和分组顺序已保存。");
  }

  /* =========================================================
     取消排序
  ========================================================= */

  function cancelSorting() {
    if (!STATE.sorting) return;

    applyOrder(STATE.originalOrder);

    finishSorting();

    showNotice("已取消排序，恢复原来的顺序。");
  }

  /* =========================================================
     退出排序模式
  ========================================================= */

  function finishSorting() {
    const shelf = getShelf();

    STATE.sorting = false;

    if (shelf) {
      shelf.classList.remove("is-sorting");
    }

    getCards().forEach(function (card) {
      card.draggable = false;

      card.classList.remove(
        "is-sorting-enabled",
        "is-sorting-dragged",
        "is-sorting-ghost"
      );

      removeMoveButtons(card);
    });

    if (STATE.toolbar) {
      STATE.toolbar.hidden = true;
    }

    document.body.classList.remove("home-sorting-active");

    STATE.draggedCard = null;
  }

  /* =========================================================
     事件绑定
  ========================================================= */

  function bindDragEvents() {
    const shelf = getShelf();

    if (!shelf || shelf.dataset.homeSortBound === "true") {
      return;
    }

    shelf.dataset.homeSortBound = "true";

    shelf.addEventListener("dragstart", handleDragStart);

    shelf.addEventListener("dragover", handleDragOver);

    shelf.addEventListener("drop", function (event) {
      if (STATE.sorting) {
        event.preventDefault();
      }
    });

    shelf.addEventListener("dragend", handleDragEnd);
  }

  function bindSettingsEvents() {
    document.addEventListener(
      "writing-home-settings-action",
      function (event) {
        if (!event.detail) return;

        if (event.detail.action !== "sort") {
          return;
        }

        if (
          window.WritingHomeSettings &&
          typeof window.WritingHomeSettings.close === "function"
        ) {
          window.WritingHomeSettings.close();
        }

        startSorting();
      }
    );
  }

  function bindStorageEvents() {
    window.addEventListener("storage", function (event) {
      if (
        event.key !== STORAGE_KEY ||
        STATE.sorting
      ) {
        return;
      }

      applySavedOrder();
    });
  }

  /* =========================================================
     初始化
  ========================================================= */

  function initialize() {
    if (STATE.initialized) return;

    STATE.initialized = true;

    bindDragEvents();
    bindSettingsEvents();
    bindStorageEvents();

    // 等待首页卡片渲染完成。
    let attempts = 0;

    function restoreWhenReady() {
      const shelf = getShelf();

      if (shelf && getCards().length) {
        applySavedOrder();
        return;
      }

      attempts += 1;

      if (attempts < 40) {
        setTimeout(restoreWhenReady, 100);
      }
    }

    restoreWhenReady();

    // 保留原有公开接口。
    window.WritingHomeSort = Object.freeze({
      start: startSorting,
      save: saveSorting,
      cancel: cancelSorting,

      isSorting: function () {
        return STATE.sorting;
      },

      getOrder: getCurrentOrder
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
