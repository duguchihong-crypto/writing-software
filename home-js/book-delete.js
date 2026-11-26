/* ======================================================
   首页书籍删除模块
   文件：page-js/home-book-delete.js

   独立职责：
   1. 创建书籍删除按钮
   2. 确认删除操作
   3. 调用书籍存储接口删除书籍
   4. 删除成功后刷新书架

   不负责：
   1. 分组管理
   2. 分组存储
   3. 其他页面的业务逻辑
====================================================== */

(function () {
    "use strict";

    function createDeleteButton(book) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "shelf-card__delete";
        button.textContent = "删除";

        const title =
            typeof book.title === "string" && book.title.trim()
                ? book.title.trim()
                : "未命名书籍";

        button.setAttribute(
            "aria-label",
            "删除《" + title + "》"
        );

        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            const confirmed = window.confirm(
                "确定要删除《" + title + "》吗？\n\n" +
                "删除后，这本书及其保存的章节数据将被移除，" +
                "且无法通过本软件恢复。\n\n" +
                "此操作不会删除其他书籍或分组。"
            );

            if (!confirmed) {
                return;
            }

            const storage = window.WritingStorage;

            if (
                !storage ||
                typeof storage.deleteBook !== "function"
            ) {
                window.alert("书籍删除功能暂时不可用。");
                return;
            }

            try {
                const deleted = storage.deleteBook(book.id);

                if (!deleted) {
                    window.alert(
                        "删除失败：没有找到这本书。"
                    );
                    return;
                }

                if (
                    window.WritingHome &&
                    typeof window.WritingHome.render === "function"
                ) {
                    window.WritingHome.render();
                }

            } catch (error) {
                console.error(
                    "[WritingBookDelete] 删除书籍失败：",
                    error
                );

                window.alert(
                    "删除书籍失败，请检查存储状态后重试。"
                );
            }
        });

        return button;
    }

    window.WritingBookDelete = Object.freeze({
        createButton: createDeleteButton
    });

})();
