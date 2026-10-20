/* ======================================================
   首页分组删除模块
   文件：page-js/home-group-delete.js

   独立职责：
   1. 创建分组删除按钮
   2. 确认删除操作
   3. 调用分组存储接口删除分组
   4. 删除成功后刷新分组列表

   不负责：
   1. 书籍管理
   2. 书籍存储
   3. 其他页面的业务逻辑
====================================================== */

(function () {
    "use strict";

    function createDeleteButton(group) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "home-group-card__delete";
        button.textContent = "删除";

        const name =
            typeof group.name === "string" && group.name.trim()
                ? group.name.trim()
                : "未命名分组";

        button.setAttribute(
            "aria-label",
            "删除分组：" + name
        );

        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            const confirmed = window.confirm(
                "确定要删除分组「" + name + "」吗？\n\n" +
                "删除分组不会自动删除书籍。\n" +
                "此操作不会影响其他分组。"
            );

            if (!confirmed) {
                return;
            }

            const storage = window.WritingGroupsStorage;

            if (
                !storage ||
                typeof storage.deleteGroup !== "function"
            ) {
                window.alert("分组删除功能暂时不可用。");
                return;
            }

            try {
                const deleted = storage.deleteGroup(group.id);

                if (!deleted) {
                    window.alert(
                        "删除失败：没有找到这个分组。"
                    );
                    return;
                }

                if (
                    window.WritingHome &&
                    typeof window.WritingHome.renderGroups === "function"
                ) {
                    window.WritingHome.renderGroups();
                }

            } catch (error) {
                console.error(
                    "[WritingGroupDelete] 删除分组失败：",
                    error
                );

                window.alert(
                    "删除分组失败，请检查存储状态后重试。"
                );
            }
        });

        return button;
    }

    window.WritingGroupDelete = Object.freeze({
        createButton: createDeleteButton
    });

})();
