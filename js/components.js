/* ======================================================
   写作软件 · 公共组件工具
   文件：js/components.js

   模块职责：
   1. 提供安全的 HTML 文本转义
   2. 提供日期格式化
   3. 提供数字格式化
   4. 提供 DOM 元素创建工具
   5. 提供统一的确认操作
   6. 提供统一的提示消息
   7. 提供统一的按钮状态管理

   设计原则：
   1. 不管理作品数据
   2. 不管理页面跳转
   3. 不负责具体页面的业务逻辑
   4. 不修改其他模块的内部代码
   5. 所有公共方法通过 WritingComponents 暴露
====================================================== */


(function () {
  "use strict";


  /* ====================================================
     一、基础配置
  ==================================================== */

  const MODULE_NAME = "WritingComponents";


  /* ====================================================
     二、HTML 文本转义
  ==================================================== */


  /**
   * 将文本转换为安全的 HTML 文本。
   *
   * 主要用于需要把用户输入的文本插入 HTML 时，
   * 避免特殊字符被误认为 HTML 标签。
   *
   * 注意：
   * 普通文本优先使用 textContent。
   * 只有确实需要 HTML 字符串时才使用此方法。
   */

  function escapeHTML(value) {
    const text = String(
      value === null || value === undefined
        ? ""
        : value
    );

    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return text.replace(
      /[&<>"']/g,
      function (character) {
        return replacements[character];
      }
    );
  }


  /* ====================================================
     三、日期格式化
  ==================================================== */


  /**
   * 格式化日期。
   *
   * 默认格式：
   * 2026/10/20
   *
   * 无效日期返回空字符串。
   */

  function formatDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "zh-CN",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).format(date);
  }


  /**
   * 格式化日期和时间。
   *
   * 示例：
   * 2026/10/20 20:30
   */

  function formatDateTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "zh-CN",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }
    ).format(date);
  }


  /**
   * 获取相对时间。
   *
   * 示例：
   * 刚刚
   * 5 分钟前
   * 3 小时前
   * 2 天前
   *
   * 超过 30 天时显示具体日期。
   */

  function formatRelativeTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const difference = Date.now() - date.getTime();

    if (difference < 0) {
      return formatDateTime(date);
    }

    const minute = 60 * 1000;

    const hour = 60 * minute;

    const day = 24 * hour;

    if (difference < minute) {
      return "刚刚";
    }

    if (difference < hour) {
      return Math.floor(difference / minute) + " 分钟前";
    }

    if (difference < day) {
      return Math.floor(difference / hour) + " 小时前";
    }

    if (difference < 30 * day) {
      return Math.floor(difference / day) + " 天前";
    }

    return formatDate(date);
  }


  /* ====================================================
     四、数字格式化
  ==================================================== */


  /**
   * 格式化普通数字。
   *
   * 示例：
   * 1234567 → 1,234,567
   */

  function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return new Intl.NumberFormat(
      "zh-CN"
    ).format(number);
  }


  /**
   * 格式化字数。
   *
   * 示例：
   * 0      → 0 字
   * 1200   → 1,200 字
   */

  function formatWordCount(value) {
    const number = Number(value);

    if (
      !Number.isFinite(number) ||
      number < 0
    ) {
      return "0 字";
    }

    return formatNumber(
      Math.floor(number)
    ) + " 字";
  }


  /* ====================================================
     五、DOM 元素创建工具
  ==================================================== */


  /**
   * 创建 HTML 元素。
   *
   * 示例：
   *
   * const title = WritingComponents.createElement(
   *   "h2",
   *   {
   *     className: "book-title",
   *     text: "我的作品"
   *   }
   * );
   *
   * document.body.appendChild(title);
   *
   * 支持的配置：
   *
   * className：设置 class
   * text：设置纯文本
   * attributes：设置 HTML 属性
   * children：添加子元素
   */

  function createElement(tagName, options) {
    if (
      typeof tagName !== "string" ||
      !/^[a-z][a-z0-9-]*$/i.test(tagName)
    ) {
      throw new Error(
        "创建元素时必须提供有效的标签名称。"
      );
    }

    const settings = options || {};

    const element = document.createElement(tagName);


    /* 设置 class */

    if (
      typeof settings.className === "string" &&
      settings.className.trim()
    ) {
      element.className = settings.className;
    }


    /* 设置纯文本 */

    if (
      settings.text !== undefined &&
      settings.text !== null
    ) {
      element.textContent = String(settings.text);
    }


    /* 设置属性 */

    if (
      settings.attributes &&
      typeof settings.attributes === "object"
    ) {
      Object.entries(settings.attributes).forEach(
        function (entry) {
          const name = entry[0];

          const value = entry[1];

          if (
            value === null ||
            value === undefined ||
            typeof value === "function"
          ) {
            return;
          }

          /*
           * 禁止通过此工具直接设置事件处理属性，
           * 例如 onclick。
           *
           * 事件应使用 addEventListener 绑定。
           */

          if (/^on/i.test(name)) {
            return;
          }

          /*
           * 避免通过不安全的 URL 属性
           * 注入 javascript: 地址。
           */

          if (
            /^(href|src|action|formaction)$/i.test(name)
          ) {
            const urlValue = String(value).trim();

            if (
              /^\s*javascript:/i.test(urlValue)
            ) {
              return;
            }
          }

          element.setAttribute(
            name,
            String(value)
          );
        }
      );
    }


    /* 添加子元素 */

    if (Array.isArray(settings.children)) {
      settings.children.forEach(function (child) {
        if (child instanceof Node) {
          element.appendChild(child);
        }
      });
    }

    return element;
  }


  /* ====================================================
     六、统一确认操作
  ==================================================== */


  /**
   * 请求用户确认。
   *
   * 目前使用浏览器原生确认窗口。
   *
   * 后续如果需要设计统一的国风确认弹窗，
   * 可以在不修改调用页面的情况下替换内部实现。
   */

  function confirmAction(message) {
    const text = String(
      message || "确定执行此操作吗？"
    );

    return window.confirm(text);
  }


  /* ====================================================
     七、统一提示消息
  ==================================================== */


  /**
   * 显示提示消息。
   *
   * 当前版本使用浏览器原生提示窗口，
   * 确保不依赖额外 CSS 或 HTML。
   *
   * 后续可以升级为统一的页面内提示组件。
   */

  function showMessage(message) {
    const text = String(
      message === null || message === undefined
        ? ""
        : message
    );

    window.alert(text);
  }


  /* ====================================================
     八、按钮状态管理
  ==================================================== */


  /**
   * 设置按钮的加载状态。
   *
   * 使用场景：
   * 创建作品、保存内容、导出文件等。
   *
   * 开始处理：
   * setButtonLoading(button, true, "正在保存…")
   *
   * 处理结束：
   * setButtonLoading(button, false)
   *
   * 结束后恢复按钮原本的文字和状态。
   */

  const buttonStates = new WeakMap();


  function setButtonLoading(
    button,
    loading,
    loadingText
  ) {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(
        "加载状态只能设置在 HTML button 元素上。"
      );
    }

    if (loading) {
      /*
       * 已经处于加载状态时，不重复保存状态。
       */

      if (buttonStates.has(button)) {
        return;
      }

      const originalState = {
        text: button.textContent,
        disabled: button.disabled,
        ariaBusy: button.getAttribute("aria-busy")
      };

      buttonStates.set(
        button,
        originalState
      );

      button.disabled = true;

      button.setAttribute(
        "aria-busy",
        "true"
      );

      button.textContent =
        typeof loadingText === "string" &&
        loadingText.trim()
          ? loadingText
          : "处理中…";

      return;
    }


    /*
     * 恢复按钮原本的状态。
     */

    const originalState = buttonStates.get(button);

    if (!originalState) {
      return;
    }

    button.textContent = originalState.text;

    button.disabled = originalState.disabled;

    if (originalState.ariaBusy === null) {
      button.removeAttribute("aria-busy");

    } else {
      button.setAttribute(
        "aria-busy",
        originalState.ariaBusy
      );
    }

    buttonStates.delete(button);
  }


  /* ====================================================
     九、统一禁用状态
  ==================================================== */


  /**
   * 设置按钮是否可用。
   *
   * 例如：
   * setButtonDisabled(button, true)
   */

  function setButtonDisabled(button, disabled) {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(
        "只能修改 HTML button 元素的禁用状态。"
      );
    }

    button.disabled = Boolean(disabled);
  }


  /* ====================================================
     十、公开公共接口
  ==================================================== */


  /**
   * 其他模块通过 WritingComponents 调用工具。
   *
   * 不直接访问本模块内部函数。
   */

  window[MODULE_NAME] = Object.freeze({

    /* 文本工具 */

    escapeHTML: escapeHTML,


    /* 日期工具 */

    formatDate: formatDate,

    formatDateTime: formatDateTime,

    formatRelativeTime: formatRelativeTime,


    /* 数字工具 */

    formatNumber: formatNumber,

    formatWordCount: formatWordCount,


    /* DOM 工具 */

    createElement: createElement,


    /* 操作反馈 */

    confirmAction: confirmAction,

    showMessage: showMessage,


    /* 按钮状态 */

    setButtonLoading: setButtonLoading,

    setButtonDisabled: setButtonDisabled

  });


})();
