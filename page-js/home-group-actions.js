/* =========================================================
   小说分组操作模块
   文件：page-js/home-group-actions.js
   功能：
   1. 将小说加入分组
   2. 将小说从分组移出
   3. 弹窗显示现有分组
   4. 处理分组关联
   5. 提供独立的公开接口
   不负责：
   - 删除小说
   - 删除分组
   - 修改小说正文
   - 修改小说标题或封面
   - 小说排序
   ========================================================= */
(function () {
  "use strict";
  const STATE = {
    initialized: false,
    dialog: null,
    activeBookId: null,
    activeGroupId: null
  };
  /* ---------------------------------------------------------
     存储接口
  --------------------------------------------------------- */
  function getStorage() {
    return window.WritingStorage || null;
  }
  function getGroups() {
    const storage = getStorage();
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
      console.error("[HomeGroupActions] 读取分组失败：", error);
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
  function getBook(bookId) {
    const storage = getStorage();
    if (!storage || typeof storage.getBook !== "function") {
      return null;
    }
    try {
      return storage.getBook(bookId) || null;
    } catch (error) {
      console.error("[HomeGroupActions] 读取小说失败：", error);
      return null;
    }
  }
  /* ---------------------------------------------------------
     检查分组关联接口
  --------------------------------------------------------- */
  function hasAssociationAPI() {
    const storage = getStorage();
    return Boolean(
      storage &&
      typeof storage.addBookToGroup === "function" &&
      typeof storage.removeBookFromGroup === "function"
    );
  }
  function addBookToGroup(bookId, groupId) {
    const storage = getStorage();
    if (!storage || typeof storage.addBookToGroup !== "function") {
      throw new Error(
        "当前存储模块没有提供 addBookToGroup() 接口。"
      );
    }
    return storage.addBookToGroup(
      String(groupId),
      String(bookId)
    );
  }
  function removeBookFromGroup(bookId, groupId) {
    const storage = getStorage();
    if (!storage || typeof storage.removeBookFromGroup !== "function") {
      throw new Error(
        "当前存储模块没有提供 removeBookFromGroup() 接口。"
      );
    }
    return storage.removeBookFromGroup(
      String(groupId),
      String(bookId)
    );
  }
  /* ---------------------------------------------------------
     消息提示
  --------------------------------------------------------- */
  function showMessage(message) {
    if (
      window.WritingHome &&
      typeof window.WritingHome.showMessage === "function"
    ) {
      window.WritingHome.showMessage(message);
      return;
    }
    let notice = document.getElementById(
      "home-group-actions-notice"
    );
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "home-group-actions-notice";
      Object.assign(notice.style, {
        position: "fixed",
        left: "50%",
        bottom: "80px",
        zIndex: "10002",
        maxWidth: "calc(100vw - 32px)",
        padding: "10px 16px",
        borderRadius: "8px",
        background: "#252525",
        color: "#ffffff",
        fontSize: "14px",
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,.18)",
        transform: "translateX(-50%)"
      });
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(notice._messageTimer);
    notice._messageTimer = setTimeout(function () {
      notice.hidden = true;
    }, 2400);
  }
  /* ---------------------------------------------------------
     创建弹窗
  --------------------------------------------------------- */
  function ensureDialog() {
    if (STATE.dialog) {
      return STATE.dialog;
    }
    const backdrop = document.createElement("div");
    backdrop.id = "home-group-actions-dialog";
    backdrop.className = "home-group-actions__backdrop";
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      zIndex: "10000",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "rgba(0,0,0,.45)"
    });
    backdrop.innerHTML = `
      <section
        class="home-group-actions__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-group-actions-title"
      >
        <header class="home-group-actions__header">
          <h2 id="home-group-actions-title">
            选择分组
          </h2>
          <button
            type="button"
            data-group-actions-close
            aria-label="关闭"
          >
            ×
          </button>
        </header>
        <div
          class="home-group-actions__description"
          data-group-actions-description
        ></div>
        <div
          class="home-group-actions__list"
          data-group-actions-list
        ></div>
        <footer class="home-group-actions__footer">
          <button
            type="button"
            data-group-actions-cancel
          >
            取消
          </button>
        </footer>
      </section>
    `;
    const dialog = backdrop.querySelector(
      ".home-group-actions__dialog"
    );
    Object.assign(dialog.style, {
      width: "100%",
      maxWidth: "420px",
      maxHeight: "min(80vh, 620px)",
      overflowY: "auto",
      padding: "20px",
      borderRadius: "12px",
      background: "#fffdf7",
      boxShadow: "0 12px 36px rgba(0,0,0,.22)"
    });
    const header = backdrop.querySelector(
      ".home-group-actions__header"
    );
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px"
    });
    const title = backdrop.querySelector(
      "#home-group-actions-title"
    );
    Object.assign(title.style, {
      margin: "0",
      fontSize: "18px",
      color: "#30271e"
    });
    const closeButton = backdrop.querySelector(
      "[data-group-actions-close]"
    );
    Object.assign(closeButton.style, {
      width: "34px",
      height: "34px",
      border: "none",
      borderRadius: "8px",
      background: "#f1e8d8",
      fontSize: "24px",
      cursor: "pointer"
    });
    const description = backdrop.querySelector(
      "[data-group-actions-description]"
    );
    Object.assign(description.style, {
      margin: "12px 0",
      color: "#6d6255",
      fontSize: "13px",
      lineHeight: "1.6",
      overflowWrap: "anywhere"
    });
    const list = backdrop.querySelector(
      "[data-group-actions-list]"
    );
    Object.assign(list.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    });
    const footer = backdrop.querySelector(
      ".home-group-actions__footer"
    );
    Object.assign(footer.style, {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: "16px"
    });
    const cancelButton = backdrop.querySelector(
      "[data-group-actions-cancel]"
    );
    Object.assign(cancelButton.style, {
      padding: "9px 16px",
      border: "1px solid #cfc3b2",
      borderRadius: "7px",
      background: "#ffffff",
      color: "#453b30",
      cursor: "pointer"
    });
    closeButton.addEventListener("click", closeDialog);
    cancelButton.addEventListener("click", closeDialog);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        closeDialog();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (
        event.key === "Escape" &&
        backdrop.style.display !== "none"
      ) {
        closeDialog();
      }
    });
    document.body.appendChild(backdrop);
    STATE.dialog = backdrop;
    return backdrop;
  }
  /* ---------------------------------------------------------
     关闭弹窗
  --------------------------------------------------------- */
  function closeDialog() {
    if (!STATE.dialog) return;
    STATE.dialog.style.display = "none";
    STATE.activeBookId = null;
    STATE.activeGroupId = null;
  }
  /* ---------------------------------------------------------
     创建分组选择项
  --------------------------------------------------------- */
  function createGroupOption(group, bookId) {
    const groupId = getGroupId(group);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-group-actions__option";
    button.dataset.groupId = groupId;
    button.textContent = getGroupName(group);
    Object.assign(button.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      padding: "12px 14px",
      border: "1px solid #e2d7c7",
      borderRadius: "8px",
      background: "#ffffff",
      color: "#30271e",
      textAlign: "left",
      fontSize: "14px",
      cursor: "pointer",
      overflowWrap: "anywhere"
    });
    button.addEventListener("click", function () {
      try {
        if (!hasAssociationAPI()) {
          throw new Error(
            "当前存储模块尚未提供完整的分组关联接口。"
          );
        }
        const result = addBookToGroup(
          bookId,
          groupId
        );
        if (result === false) {
          throw new Error("添加失败，请检查分组和小说是否存在。");
        }
        closeDialog();
        showMessage(
          "已将小说加入「" + getGroupName(group) + "」"
        );
        document.dispatchEvent(
          new CustomEvent("writing-home-group-membership-change", {
            detail: {
              bookId: String(bookId),
              groupId: groupId,
              action: "add"
            }
          })
        );
        if (
          window.WritingHomeGroupView &&
          typeof window.WritingHomeGroupView.refresh === "function"
        ) {
          window.WritingHomeGroupView.refresh();
        }
        if (
          window.WritingHome &&
          typeof window.WritingHome.render === "function"
        ) {
          window.WritingHome.render();
        }
      } catch (error) {
        console.error("[HomeGroupActions] 添加小说失败：", error);
        showMessage(
          error && error.message
            ? error.message
            : "添加失败，请稍后重试。"
        );
      }
    });
    return button;
  }
  /* ---------------------------------------------------------
     打开“移入分组”弹窗
  --------------------------------------------------------- */
  function openAddDialog(bookId) {
    const book = getBook(bookId);
    if (!book) {
      showMessage("找不到这本小说。");
      return false;
    }
    const groups = getGroups();
    if (groups.length === 0) {
      showMessage("目前没有分组，请先创建分组。");
      return false;
    }
    const dialog = ensureDialog();
    STATE.activeBookId = String(bookId);
    STATE.activeGroupId = null;
    const title = dialog.querySelector(
      "#home-group-actions-title"
    );
    const description = dialog.querySelector(
      "[data-group-actions-description]"
    );
    const list = dialog.querySelector(
      "[data-group-actions-list]"
    );
    title.textContent = "移入分组";
    description.textContent =
      "选择要加入的分组。小说原有内容不会改变。";
    list.replaceChildren();
    groups.forEach(function (group) {
      list.appendChild(
        createGroupOption(group, bookId)
      );
    });
    dialog.style.display = "flex";
    return true;
  }
  /* ---------------------------------------------------------
     从当前分组移出小说
  --------------------------------------------------------- */
  function removeFromGroup(bookId, groupId) {
    const book = getBook(bookId);
    const group = findGroup(groupId);
    if (!book || !group) {
      showMessage("找不到指定的小说或分组。");
      return false;
    }
    if (!hasAssociationAPI()) {
      showMessage("当前存储模块尚未提供分组关联接口。");
      return false;
    }
    const confirmed = window.confirm(
      "确定将《" +
      (book.title || "未命名小说") +
      "》从分组「" +
      getGroupName(group) +
      "」中移出吗？\n\n只会解除分组关联，不会删除小说。"
    );
    if (!confirmed) return false;
    try {
      const result = removeBookFromGroup(
        bookId,
        groupId
      );
      if (result === false) {
        throw new Error("移出失败，请稍后重试。");
      }
      showMessage("已将小说移出分组。");
      document.dispatchEvent(
        new CustomEvent("writing-home-group-membership-change", {
          detail: {
            bookId: String(bookId),
            groupId: String(groupId),
            action: "remove"
          }
        })
      );
      if (
        window.WritingHomeGroupView &&
        typeof window.WritingHomeGroupView.refresh === "function"
      ) {
        window.WritingHomeGroupView.refresh();
      }
      if (
        window.WritingHome &&
        typeof window.WritingHome.render === "function"
      ) {
        window.WritingHome.render();
      }
      return true;
    } catch (error) {
      console.error("[HomeGroupActions] 移出小说失败：", error);
      showMessage(
        error && error.message
          ? error.message
          : "移出失败，请稍后重试。"
      );
      return false;
    }
  }
  /* ---------------------------------------------------------
     公开接口
  --------------------------------------------------------- */
  window.WritingHomeGroupActions = Object.freeze({
    openAddDialog: openAddDialog,
    removeFromGroup: removeFromGroup,
    closeDialog: closeDialog,
    getGroups: getGroups,
    hasAssociationAPI: hasAssociationAPI
  });
  /* ---------------------------------------------------------
     初始化
     这个模块不擅自改动现有小说菜单。
     后续整合时，由 home.js 调用 openAddDialog(bookId)。
  --------------------------------------------------------- */
  function initialize() {
    if (STATE.initialized) return;
    STATE.initialized = true;
    // 预先创建弹窗，后续调用时不必重复创建。
    ensureDialog();
  }
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
