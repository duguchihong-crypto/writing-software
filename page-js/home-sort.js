/* =========================================================
   书籍排序模块
   文件：page-js/home-sort.js

   独立功能：
   1. 书籍拖动排序
   2. 保存排序
   3. 取消排序
   4. 独立保存书籍顺序
   5. 刷新后恢复顺序
   6. 不修改书籍数据库
   7. 不参与分组排序
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "writing-software-home-book-order";

  const SELECTORS = {
    shelf: "#shelf-list",
    card: ".shelf-card",
    open: ".shelf-card__open"
  };

  const STATE = {
    sorting: false,
    originalOrder: [],
    currentOrder: [],
    draggedCard: null,
    placeholder: null,
    toolbar: null,
    initialized: false
  };

  /* ---------------------------------------------------------
     基础工具
  --------------------------------------------------------- */

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

  function getBookId(card) {
    if (!card) return null;

    return (
      card.dataset.bookId ||
      card.getAttribute("data-id") ||
      null
    );
  }

  function getCurrentOrder() {
    return getCards()
      .map(getBookId)
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

  /* ---------------------------------------------------------
     顺序恢复

     只移动书籍卡片，不触碰分组容器。
  --------------------------------------------------------- */

  function applyOrder(order) {
    const shelf = getShelf();

    if (!shelf) return;

    const cards = getCards();

    if (cards.length < 2) return;

    const cardMap = new Map();

    cards.forEach(function (card) {
      const id = getBookId(card);

      if (id) {
        cardMap.set(id, card);
      }
    });

    const orderedCards = [];

    order.forEach(function (id) {
      const card = cardMap.get(id);

      if (card) {
        orderedCards.push(card);
        cardMap.delete(id);
      }
    });

    // 新书如果不在旧排序记录中，追加到最后。
    cardMap.forEach(function (card) {
      orderedCards.push(card);
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

    const mergedOrder = [];
    const existingIds = new Set(currentOrder);

    savedOrder.forEach(function (id) {
      if (existingIds.has(id) && !mergedOrder.includes(id)) {
        mergedOrder.push(id);
      }
    });

    currentOrder.forEach(function (id) {
      if (!mergedOrder.includes(id)) {
        mergedOrder.push(id);
      }
    });

    applyOrder(mergedOrder);

    // 将删除的书籍从排序记录中清理掉。
    if (
      mergedOrder.length !== savedOrder.length ||
      mergedOrder.some(function (id, index) {
        return id !== savedOrder[index];
      })
    ) {
      writeSavedOrder(mergedOrder);
    }
  }

  /* ---------------------------------------------------------
     排序工具栏
  --------------------------------------------------------- */

  function createToolbar() {
    if (STATE.toolbar) return STATE.toolbar;

    const toolbar = document.createElement("div");

    toolbar.id = "home-sort-toolbar";
    toolbar.className = "home-sort__toolbar";
    toolbar.hidden = true;

    toolbar.innerHTML = `
      <div class="home-sort__toolbar-info">
        <span class="home-sort__toolbar-title">书籍排序</span>
        <span class="home-sort__toolbar-description">
          拖动书籍卡片调整顺序
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

  /* ---------------------------------------------------------
     拖动功能
  --------------------------------------------------------- */

  function createPlaceholder(card) {
    const placeholder = document.createElement("div");

    placeholder.className = "home-sort__placeholder";
    placeholder.setAttribute("aria-hidden", "true");

    const rect = card.getBoundingClientRect();

    placeholder.style.width = rect.width + "px";
    placeholder.style.height = rect.height + "px";

    return placeholder;
  }

  function handleDragStart(event) {
    if (!STATE.sorting) {
      event.preventDefault();
      return;
    }

    const card = event.currentTarget;

    if (!card || !getBookId(card)) {
      event.preventDefault();
      return;
    }

    STATE.draggedCard = card;
    STATE.placeholder = createPlaceholder(card);

    card.classList.add("is-sorting-dragged");

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", getBookId(card));

    requestAnimationFrame(function () {
      if (
        STATE.draggedCard &&
        STATE.placeholder &&
        STATE.placeholder.parentNode
      ) {
        STATE.draggedCard.classList.add("is-sorting-ghost");
      }
    });
  }

  function handleDragOver(event) {
    if (!STATE.sorting || !STATE.draggedCard) return;

    const shelf = getShelf();

    if (!shelf || !shelf.contains(event.target)) return;

    event.preventDefault();

    const target = event.target.closest(SELECTORS.card);

    if (!target || target === STATE.draggedCard) return;

    if (!shelf.contains(target)) return;

    const rect = target.getBoundingClientRect();

    const after = event.clientY > rect.top + rect.height / 2;

    if (after) {
      target.after(STATE.draggedCard);
    } else {
      target.before(STATE.draggedCard);
    }
  }

  function handleDragEnd() {
    if (STATE.draggedCard) {
      STATE.draggedCard.classList.remove(
        "is-sorting-dragged",
        "is-sorting-ghost"
      );
    }

    if (
      STATE.placeholder &&
      STATE.placeholder.parentNode
    ) {
      STATE.placeholder.remove();
    }

    STATE.draggedCard = null;
    STATE.placeholder = null;

    updateMoveButtons();
  }

  /* ---------------------------------------------------------
     触屏及键盘辅助按钮
  --------------------------------------------------------- */

  function moveCard(card, direction) {
    if (!STATE.sorting || !card) return;

    const sibling = direction < 0
      ? card.previousElementSibling
      : card.nextElementSibling;

    if (!sibling || !sibling.matches(SELECTORS.card)) {
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

    if (button) button.focus();
  }

  function createMoveButtons(card) {
    if (card.querySelector(".home-sort__move-controls")) {
      return;
    }

    const controls = document.createElement("div");

    controls.className = "home-sort__move-controls";

    controls.innerHTML = `
      <button
        type="button"
        class="home-sort__move-button"
        data-home-sort-up
        aria-label="上移书籍"
        title="上移"
      >↑</button>

      <button
        type="button"
        class="home-sort__move-button"
        data-home-sort-down
        aria-label="下移书籍"
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

    if (controls) controls.remove();
  }

  function updateMoveButtons() {
    const cards = getCards();

    cards.forEach(function (card, index) {
      const up = card.querySelector("[data-home-sort-up]");
      const down = card.querySelector("[data-home-sort-down]");

      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === cards.length - 1;
    });
  }

  /* ---------------------------------------------------------
     进入排序模式
  --------------------------------------------------------- */

  function startSorting() {
    if (STATE.sorting) return;

    const shelf = getShelf();

    if (!shelf) {
      showNotice("找不到书架容器，暂时无法排序。");
      return;
    }

    const cards = getCards();

    if (!cards.length) {
      showNotice("书架里还没有书籍。");
      return;
    }

    const missingId = cards.some(function (card) {
      return !getBookId(card);
    });

    if (missingId) {
      showNotice(
        "当前书籍卡片缺少稳定的书籍 ID，无法安全排序。"
      );

      console.error(
        "[HomeSort] 每个 .shelf-card 必须具有 data-book-id。"
      );

      return;
    }

    STATE.sorting = true;
    STATE.originalOrder = getCurrentOrder();
    STATE.currentOrder = STATE.originalOrder.slice();

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

    showNotice("已进入书籍排序模式。");
  }

  /* ---------------------------------------------------------
     保存排序
  --------------------------------------------------------- */

  function saveSorting() {
    if (!STATE.sorting) return;

    const order = getCurrentOrder();

    if (!writeSavedOrder(order)) {
      return;
    }

    finishSorting();

    STATE.originalOrder = order.slice();
    STATE.currentOrder = order.slice();

    showNotice("书籍顺序已保存。");
  }

  /* ---------------------------------------------------------
     取消排序
  --------------------------------------------------------- */

  function cancelSorting() {
    if (!STATE.sorting) return;

    applyOrder(STATE.originalOrder);

    finishSorting();

    showNotice("已取消排序，恢复原来的顺序。");
  }

  /* ---------------------------------------------------------
     退出排序模式
  --------------------------------------------------------- */

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
    STATE.placeholder = null;
  }

  /* ---------------------------------------------------------
     事件绑定
  --------------------------------------------------------- */

  function bindDragEvents() {
    const shelf = getShelf();

    if (!shelf || shelf.dataset.homeSortBound === "true") {
      return;
    }

    shelf.dataset.homeSortBound = "true";

    shelf.addEventListener("dragstart", function (event) {
      const card = event.target.closest(SELECTORS.card);

      if (!card || !shelf.contains(card)) return;

      if (!STATE.sorting) {
        event.preventDefault();
        return;
      }

      handleDragStart({
        ...event,
        currentTarget: card
      });
    });

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

        if (event.detail.action === "sort") {
          if (
            window.WritingHomeSettings &&
            typeof window.WritingHomeSettings.close === "function"
          ) {
            window.WritingHomeSettings.close();
          }

          startSorting();
        }
      }
    );
  }

  function initialize() {
    if (STATE.initialized) return;

    STATE.initialized = true;

    bindDragEvents();
    bindSettingsEvents();

    // 首页卡片由 home.js 渲染。
    // 等待卡片存在后再应用已保存顺序。
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

    // 其他页面标签页更新排序记录时，同步应用。
    window.addEventListener("storage", function (event) {
      if (event.key !== STORAGE_KEY || STATE.sorting) {
        return;
      }

      applySavedOrder();
    });

    // 暴露独立接口，供其他模块按需调用。
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
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
