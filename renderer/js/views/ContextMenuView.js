/**
 * ContextMenuView - 右键菜单视图
 * 提供设置入口、待办管理、固定/取消固定等功能
 */
export class ContextMenuView {
  /**
   * @param {import('../viewmodels/PetViewModel.js').PetViewModel} petVM
   * @param {import('../viewmodels/TodoViewModel.js').TodoViewModel} todoVM
   * @param {import('../models/ImageGroupModel.js').ImageGroupModel} imageGroupModel
   * @param {HTMLElement} menuEl - 菜单容器
   * @param {Function} onSave - 保存回调
   */
  constructor(
    petVM,
    todoVM,
    imageGroupModel,
    menuEl,
    onSave,
    displayOffsetX = 0,
    displayOffsetY = 0,
  ) {
    this.petVM = petVM;
    this.todoVM = todoVM;
    this.imageGroupModel = imageGroupModel;
    this.menuEl = menuEl;
    this.onSave = onSave;
    this.displayOffsetX = displayOffsetX;
    this.displayOffsetY = displayOffsetY;

    this._currentPanel = null;
    this._overlay = document.getElementById("menu-overlay");

    // 阻止菜单区域的鼠标穿透
    this.menuEl.addEventListener("mouseenter", () => {
      window.electronAPI.setIgnoreMouseEvents(false);
    });
    this.menuEl.addEventListener("mouseleave", () => {
      if (!this.menuEl.classList.contains("visible")) {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    });

    // 遮罩层点击（左键或右键）关闭所有菜单
    const hideAll = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideAll();
    };
    this._overlay.addEventListener("mousedown", hideAll);
    this._overlay.addEventListener("contextmenu", hideAll);
  }

  /** 在宠物旁显示右键菜单（环形布局，以宠物为中心） */
  show(x, y) {
    this._currentPanel = null;

    // 记录宠物中心坐标，供子面板定位使用
    this._petCenterX = this.petVM.get("x") - this.displayOffsetX;
    this._petCenterY = this.petVM.get("y") - this.displayOffsetY;

    this._renderMainMenu();

    this.menuEl.classList.add("visible");
    this._overlay.classList.add("active");
    window.electronAPI.setIgnoreMouseEvents(false);
  }

  /** 将菜单容器切换到环形布局（以宠物为中心） */
  _applyRadialLayout() {
    this.menuEl.classList.add('radial');
    const size = 400;
    let menuX = this._petCenterX - size / 2;
    let menuY = this._petCenterY - size / 2;
    menuX = Math.max(5, Math.min(window.innerWidth - size - 5, menuX));
    menuY = Math.max(5, Math.min(window.innerHeight - size - 5, menuY));
    this.menuEl.style.left = `${menuX}px`;
    this.menuEl.style.top = `${menuY}px`;
  }

  /** 将菜单容器切换到传统面板布局（子菜单使用） */
  _applyPanelLayout() {
    this.menuEl.classList.remove('radial');
    const menuW = 260;
    const menuH = 420;
    const petX = this._petCenterX;
    const petY = this._petCenterY;
    const petSize = this.petVM.get("petSize");

    const spaceRight = window.innerWidth - (petX + petSize / 2);
    let menuX;
    if (spaceRight >= menuW + 16) {
      menuX = petX + petSize / 2 + 12;
    } else {
      menuX = Math.max(10, petX - petSize / 2 - menuW - 12);
    }
    menuX = Math.max(10, Math.min(window.innerWidth - menuW - 10, menuX));
    let menuY = petY - menuH / 2;
    menuY = Math.max(10, Math.min(window.innerHeight - menuH - 10, menuY));
    this.menuEl.style.left = `${menuX}px`;
    this.menuEl.style.top = `${menuY}px`;
  }

  /** 隐藏右键菜单（同时关闭快捷启动菜单） */
  hide() {
    this.menuEl.classList.remove("visible", "radial");
    const qlEl = document.getElementById("quick-launch");
    if (qlEl) qlEl.classList.remove("visible");
    this._overlay.classList.remove("active");
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }

  /** 隐藏所有菜单（遮罩点击时调用） */
  hideAll() {
    this.menuEl.classList.remove("visible", "radial");
    const qlEl = document.getElementById("quick-launch");
    if (qlEl) qlEl.classList.remove("visible");
    this._overlay.classList.remove("active");
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }

  // ==================== 主菜单 ====================

  _renderMainMenu() {
    const isFixed = this.petVM.get("isFixed");
    const moodEmoji = this.petVM.getMoodEmoji();
    const moodLevel = Math.round(this.petVM.get("moodLevel"));
    const autoMove = this.petVM.get("autoMoveEnabled");
    const coachEnabled = this.petVM.get('coachEnabled');

    const items = [
      { icon: '📋', label: '待办事项', action: 'todo' },
      { icon: '🧭', label: '自主移动', action: 'automove', status: autoMove ? '✅' : '❌' },
      { icon: '🏋️', label: '桌面教练', action: 'coach', status: coachEnabled ? '✅' : '❌' },
      { icon: '🤖', label: '聊天', action: 'aichat' },
      { icon: '🐧', label: 'Linux终端', action: 'terminal' },
      { icon: '⚙️', label: '设置', action: 'settings' },
      { icon: '🧠', label: 'AI 工具', action: 'aitools' },
      { icon: isFixed ? '📌' : '📍', label: isFixed ? '取消固定' : '固定位置', action: 'pin' },
      { icon: '😎', label: '酷炫模式', action: 'coolmode' },
      { icon: '❌', label: '退出', action: 'quit', danger: true },
    ];

    const radius = 120;
    const centerX = 200;
    const centerY = 200;
    const angleStep = (2 * Math.PI) / items.length;
    const startAngle = -Math.PI / 2;

    let html = `<div class="radial-ring"></div>`;
    html += `<div class="radial-center"><span class="radial-mood">${moodEmoji}</span><span class="radial-mood-text">${moodLevel}%</span></div>`;

    items.forEach((item, i) => {
      const angle = startAngle + i * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const delay = (0.08 + i * 0.045).toFixed(3);
      html += `<div class="radial-item${item.danger ? ' radial-item-danger' : ''}" data-action="${item.action}" data-label="${item.label}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;--delay:${delay}s"><span class="radial-icon">${item.icon}</span>${item.status ? `<span class="radial-status">${item.status}</span>` : ''}</div>`;
    });

    this.menuEl.innerHTML = html;
    this._applyRadialLayout();

    this.menuEl.querySelectorAll('.radial-item').forEach(el => {
      el.addEventListener('click', () => this._handleAction(el.dataset.action));
    });
  }

  _handleAction(action) {
    // 进入子面板时切换为传统面板布局
    const panelActions = ['todo', 'settings', 'images', 'movement', 'automove', 'keybind', 'bubble', 'aisetting', 'aitools', 'ai-screen', 'ai-clipboard'];
    if (panelActions.includes(action)) {
      this._applyPanelLayout();
    }

    switch (action) {
      case "todo":
        this._renderTodoPanel();
        break;
      case "settings":
        this._renderSettingsMenu();
        break;
      case "images":
        this._renderImagePanel();
        break;
      case "movement":
        this._renderMovementPanel();
        break;
      case "automove":
        this._renderAutoMovePanel();
        break;
      case "keybind":
        this._renderKeyBindPanel();
        break;
      case "bubble":
        this._renderBubblePanel();
        break;
      case "coach":
        this.petVM.set('coachEnabled', !this.petVM.get('coachEnabled'));
        this.onSave();
        this._renderMainMenu();
        break;
      case "aichat":
        this.hideAll();
        if (this._onOpenChat) this._onOpenChat();
        break;
      case "terminal":
        this.hideAll();
        if (this._onOpenTerminal) this._onOpenTerminal();
        break;
      case "aisetting":
        this._renderAISettingPanel();
        break;
      case "aitools":
        this._renderAIToolsMenu();
        break;
      case "ai-screen":
        this._doScreenAnalysis();
        break;
      case "ai-clipboard":
        this._doClipboardSummary();
        break;
      case "pin":
        if (this.petVM.get("isFixed")) {
          this.petVM.unpin();
        } else {
          this.petVM.pin();
        }
        this.onSave();
        this.hide();
        break;
      case "coolmode":
        this.petVM.toggleCoolMode();
        this.hide();
        break;
      case "layertoggle": {
        const newVal = !this.petVM.get("alwaysOnTop");
        this.petVM.set("alwaysOnTop", newVal);
        window.electronAPI.setAlwaysOnTop(newVal);
        this.onSave();
        this.hide();
        break;
      }
      case "quit":
        this.onSave();
        window.electronAPI.quitApp();
        break;
    }
  }

  // ==================== 设置二级菜单 ====================

  _renderSettingsMenu() {
    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back">← </span>⚙️ 设置
      </div>
      <div class="menu-item" data-action="images">🖼️ 图片与分组</div>
      <div class="menu-item" data-action="movement">⚙️ 移动设置</div>
      <div class="menu-item" data-action="keybind">⌨️ 键位绑定</div>
      <div class="menu-item" data-action="bubble">💬 气泡设置</div>
      <div class="menu-item" data-action="aisetting">🧠 AI 设置</div>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderMainMenu());
    this.menuEl.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", () =>
        this._handleAction(item.dataset.action),
      );
    });
  }

  // ==================== AI 工具菜单 ====================

  _renderAIToolsMenu() {
    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back">← </span>🧠 AI 工具
      </div>
      <div class="menu-item" data-action="ai-screen">🖥️ 分析当前屏幕</div>
      <div class="menu-item" data-action="ai-clipboard">📋 总结剪贴板文本</div>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderMainMenu());
    this.menuEl.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", () =>
        this._handleAction(item.dataset.action),
      );
    });
  }

  // ==================== AI 屏幕分析 ====================

  async _doScreenAnalysis() {
    const aiConfig = this.petVM.getAIConfig();
    if (!aiConfig.apiUrl) {
      this._renderAIResultPanel(
        "🖥️ 屏幕分析",
        "请先在 设置 → AI 设置 中配置 API 🔧",
      );
      return;
    }

    this._renderAIResultPanel(
      "🖥️ 屏幕分析",
      '<span class="chat-typing">正在截屏并分析...</span>',
      true,
    );

    const capture = await window.electronAPI.captureScreen();
    if (capture.error) {
      this._renderAIResultPanel("🖥️ 屏幕分析", `截屏失败: ${capture.error}`);
      return;
    }

    const messages = [
      {
        role: "system",
        content:
          "你是一个屏幕内容分析助手。用户会给你一张屏幕截图，请简洁地描述屏幕上显示的主要内容，如果是网页请分析网页的主题和关键信息。回答不超过200字。",
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: capture.dataUrl } },
          { type: "text", text: "请分析这张屏幕截图的内容" },
        ],
      },
    ];

    const result = await window.electronAPI.aiChat({
      apiUrl: aiConfig.apiUrl,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      messages,
      maxTokens: aiConfig.maxTokens,
    });

    if (result.error) {
      this._renderAIResultPanel("🖥️ 屏幕分析", `分析失败: ${result.error}`);
    } else {
      this._renderAIResultPanel("🖥️ 屏幕分析", result.content || "无分析结果");
    }
  }

  // ==================== AI 剪贴板文本总结 ====================

  async _doClipboardSummary() {
    const aiConfig = this.petVM.getAIConfig();
    if (!aiConfig.apiUrl) {
      this._renderAIResultPanel(
        "📋 文本总结",
        "请先在 设置 → AI 设置 中配置 API 🔧",
      );
      return;
    }

    const clipText = await window.electronAPI.getClipboardText();
    if (!clipText || !clipText.trim()) {
      this._renderAIResultPanel(
        "📋 文本总结",
        "剪贴板中没有文本内容。\n请先复制（Ctrl+C）要总结的文本。",
      );
      return;
    }

    this._renderAIResultPanel(
      "📋 文本总结",
      '<span class="chat-typing">正在分析文本...</span>',
      true,
    );

    const truncated = clipText.slice(0, 3000);
    const messages = [
      {
        role: "system",
        content:
          "你是一个文本总结助手。请对用户提供的文本进行简洁的总结和分析，提取关键信息。回答不超过200字。",
      },
      { role: "user", content: `请总结以下文本：\n\n${truncated}` },
    ];

    const result = await window.electronAPI.aiChat({
      apiUrl: aiConfig.apiUrl,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      messages,
      maxTokens: aiConfig.maxTokens,
    });

    if (result.error) {
      this._renderAIResultPanel("📋 文本总结", `分析失败: ${result.error}`);
    } else {
      this._renderAIResultPanel("📋 文本总结", result.content || "无分析结果");
    }
  }

  // ==================== AI 结果展示面板 ====================

  _renderAIResultPanel(title, content, isHtml = false) {
    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back">← </span>${this._escapeHtml(title)}
      </div>
      <div class="ai-result-panel">
        <div class="ai-result-content">${isHtml ? content : this._escapeHtml(content)}</div>
      </div>
    `;
    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderAIToolsMenu());
  }

  // ==================== 文件拖拽 AI 处理 ====================

  /** 显示文件操作选项菜单 */
  showFileActions(filePath) {
    // 切换为面板布局 & 隐藏快捷启动菜单
    this.menuEl.classList.remove('radial');
    const qlEl = document.getElementById("quick-launch");
    if (qlEl) qlEl.classList.remove("visible");

    this._droppedFilePath = filePath;
    const fileName = filePath.replace(/\\/g, "/").split("/").pop();

    const petX = this.petVM.get("x") - this.displayOffsetX;
    const petY = this.petVM.get("y") - this.displayOffsetY;
    const petSize = this.petVM.get("petSize");

    this.menuEl.innerHTML = `
      <div class="menu-title">📁 ${this._escapeHtml(fileName)}</div>
      <div class="menu-item" data-action="file-summarize">📝 总结文件内容</div>
      <div class="menu-item" data-action="file-translate">🌐 翻译文件内容</div>
      <div class="menu-item" data-action="file-explain">🤖 AI 解释文件</div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="file-cancel">❌ 取消</div>
    `;

    this.menuEl.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", () => {
        const action = item.dataset.action;
        if (action === "file-cancel") {
          this.hideAll();
          return;
        }
        this._handleFileAction(action);
      });
    });

    // 定位在宠物旁边
    const menuW = 260;
    const menuH = 240;
    const spaceRight = window.innerWidth - (petX + petSize / 2);
    let menuX =
      spaceRight >= menuW + 16
        ? petX + petSize / 2 + 12
        : Math.max(10, petX - petSize / 2 - menuW - 12);
    let menuY = petY - menuH / 2;
    menuY = Math.max(10, Math.min(window.innerHeight - menuH - 10, menuY));

    this.menuEl.style.left = `${menuX}px`;
    this.menuEl.style.top = `${menuY}px`;
    this.menuEl.classList.add("visible");
    this._overlay.classList.add("active");
    window.electronAPI.setIgnoreMouseEvents(false);
  }

  async _handleFileAction(action) {
    const aiConfig = this.petVM.getAIConfig();
    if (!aiConfig.apiUrl) {
      this._renderFileResultPanel("请先在 设置 → AI 设置 中配置 API 🔧");
      return;
    }

    this._renderFileResultPanel(
      '<span class="chat-typing">正在读取文件...</span>',
      true,
    );

    const fileData = await window.electronAPI.readFileText(
      this._droppedFilePath,
    );
    if (fileData.error) {
      this._renderFileResultPanel(`读取失败: ${fileData.error}`);
      return;
    }

    const truncated = fileData.content.slice(0, 4000);
    let systemPrompt, userPrompt;

    switch (action) {
      case "file-summarize":
        systemPrompt =
          "你是一个文件内容总结助手。请对用户提供的文件内容进行简洁的总结，提取关键信息和要点。回答不超过300字。";
        userPrompt = `请总结以下文件「${fileData.name}」的内容：\n\n${truncated}`;
        break;
      case "file-translate":
        systemPrompt =
          "你是一个翻译助手。请将用户提供的文件内容翻译成中文（如果是中文则翻译成英文）。保持格式和语义。回答不超过500字。";
        userPrompt = `请翻译以下文件「${fileData.name}」的内容：\n\n${truncated}`;
        break;
      case "file-explain":
        systemPrompt =
          "你是一个代码/文件解释助手。请对用户提供的文件内容进行分析和解释，说明其用途、结构和关键部分。回答不超过400字。";
        userPrompt = `请解释以下文件「${fileData.name}」的内容：\n\n${truncated}`;
        break;
      default:
        return;
    }

    this._renderFileResultPanel(
      '<span class="chat-typing">AI 分析中...</span>',
      true,
    );

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const result = await window.electronAPI.aiChat({
      apiUrl: aiConfig.apiUrl,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      messages,
      maxTokens: aiConfig.maxTokens,
    });

    if (result.error) {
      this._renderFileResultPanel(`分析失败: ${result.error}`);
    } else {
      this._renderFileResultPanel(result.content || "无分析结果");
    }
  }

  _renderFileResultPanel(content, isHtml = false) {
    const fileName = (this._droppedFilePath || "")
      .replace(/\\/g, "/")
      .split("/")
      .pop();
    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back">← </span>📁 ${this._escapeHtml(fileName)}
      </div>
      <div class="ai-result-panel">
        <div class="ai-result-content">${isHtml ? content : this._escapeHtml(content)}</div>
      </div>
    `;
    this.menuEl.querySelector(".back-btn").addEventListener("click", () => {
      this.showFileActions(this._droppedFilePath);
    });
  }

  // ==================== 待办事项面板 ====================

  _renderTodoPanel() {
    const items = this.todoVM.getAllTodos();
    const pending = items.filter((t) => !t.completed);
    const completed = items.filter((t) => t.completed);

    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back">← </span>📋 待办事项
      </div>
      <div class="todo-input-row">
        <input type="text" class="todo-input" placeholder="输入新待办..." maxlength="100" />
        <button class="todo-add-btn">添加</button>
      </div>
      <div class="todo-list">
        ${pending.length === 0 && completed.length === 0 ? '<div class="todo-empty">暂无待办事项</div>' : ""}
        ${pending
          .map(
            (t) => `
          <div class="todo-item">
            <span class="todo-check" data-id="${t.id}">☐</span>
            <span class="todo-text">${this._escapeHtml(t.text)}</span>
            <span class="todo-delete" data-id="${t.id}">✕</span>
          </div>
        `,
          )
          .join("")}
        ${
          completed.length > 0
            ? `
          <div class="todo-section-title">已完成 (${completed.length})</div>
          ${completed
            .map(
              (t) => `
            <div class="todo-item todo-completed">
              <span class="todo-check" data-id="${t.id}">☑</span>
              <span class="todo-text">${this._escapeHtml(t.text)}</span>
              <span class="todo-delete" data-id="${t.id}">✕</span>
            </div>
          `,
            )
            .join("")}
        `
            : ""
        }
      </div>
    `;

    // 返回按钮
    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderMainMenu());

    // 添加待办
    const input = this.menuEl.querySelector(".todo-input");
    const addBtn = this.menuEl.querySelector(".todo-add-btn");
    const addTodo = () => {
      const text = input.value.trim();
      if (text) {
        this.todoVM.addTodo(text);
        this.onSave();
        this._renderTodoPanel();
      }
    };
    addBtn.addEventListener("click", addTodo);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTodo();
    });

    // 完成/取消完成
    this.menuEl.querySelectorAll(".todo-check").forEach((el) => {
      el.addEventListener("click", () => {
        this.todoVM.toggleTodo(el.dataset.id);
        this.onSave();
        this._renderTodoPanel();
      });
    });

    // 删除
    this.menuEl.querySelectorAll(".todo-delete").forEach((el) => {
      el.addEventListener("click", () => {
        this.todoVM.deleteTodo(el.dataset.id);
        this.onSave();
        this._renderTodoPanel();
      });
    });

    // 自动聚焦
    input.focus();
  }

  // ==================== 图片管理面板 ====================

  _renderImagePanel() {
    const groupNames = this.imageGroupModel.getGroupNames();
    const currentGroup = this.petVM.get("currentGroupName");

    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back-settings">← </span>🖼️ 图片与分组
      </div>
      <div class="panel-section">
        <div class="section-label">当前播放: <strong>${currentGroup}</strong></div>
        <div class="group-list">
          ${groupNames
            .map((name) => {
              const group = this.imageGroupModel.getGroup(name);
              const isActive = name === currentGroup;
              return `
              <div class="group-item ${isActive ? "active" : ""}">
                <span class="group-name" data-name="${name}">
                  ${name} (${group.frames.length}帧, ${group.interval}ms)
                </span>
                <button class="group-play-btn" data-name="${name}" title="播放此分组">▶</button>
                <button class="group-delete-btn" data-name="${name}" title="删除分组">✕</button>
              </div>`;
            })
            .join("")}
        </div>
      </div>
      <div class="panel-section">
        <div class="section-label">新建分组</div>
        <input type="text" class="setting-input" id="newGroupName" placeholder="分组名称" maxlength="30" />
        <input type="number" class="setting-input small" id="newGroupInterval" placeholder="帧间隔(ms)" value="200" min="50" max="5000" />
        <button class="btn" id="importImagesBtn">📂 导入图片</button>
        <button class="btn" id="addGroupBtn">✅ 创建分组</button>
        <div class="import-preview" id="importPreview"></div>
      </div>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderSettingsMenu());

    // 播放分组
    this.menuEl.querySelectorAll(".group-play-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.petVM.switchGroup(btn.dataset.name);
      });
    });

    // 删除分组
    this.menuEl.querySelectorAll(".group-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.imageGroupModel.removeGroup(btn.dataset.name);
        this.onSave();
        this._renderImagePanel();
      });
    });

    // 导入图片 -> 预览
    let importedFrames = [];
    this.menuEl
      .querySelector("#importImagesBtn")
      .addEventListener("click", async () => {
        const images = await window.electronAPI.importImages();
        if (images.length > 0) {
          importedFrames = images.map((img) => img.dataUrl);
          const preview = this.menuEl.querySelector("#importPreview");
          preview.innerHTML = images
            .map(
              (img) =>
                `<img src="${img.dataUrl}" class="preview-thumb" title="${this._escapeHtml(img.name)}" />`,
            )
            .join("");
        }
      });

    // 创建新分组
    this.menuEl.querySelector("#addGroupBtn").addEventListener("click", () => {
      const nameInput = this.menuEl.querySelector("#newGroupName");
      const intervalInput = this.menuEl.querySelector("#newGroupInterval");
      const name = nameInput.value.trim();
      const interval = parseInt(intervalInput.value) || 200;
      if (!name) return;
      if (importedFrames.length === 0) return;

      this.imageGroupModel.addGroup(
        name,
        importedFrames,
        Math.max(50, Math.min(5000, interval)),
      );
      importedFrames = [];
      this.onSave();
      this._renderImagePanel();
    });
  }

  // ==================== 移动设置面板 ====================

  _renderMovementPanel() {
    const speed = this.petVM.get("movementSpeed");
    const size = this.petVM.get("petSize");
    const groupNames = this.imageGroupModel.getGroupNames();

    const makeSelect = (id, current) => {
      return `<select class="setting-select" id="${id}">
        ${groupNames.map((n) => `<option value="${n}" ${n === current ? "selected" : ""}>${n}</option>`).join("")}
      </select>`;
    };

    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back-settings">← </span>⚙️ 移动设置
      </div>
      <div class="panel-section">
        <label class="setting-row">
          <span>移动速度:</span>
          <input type="range" class="setting-range" id="speedRange" min="1" max="15" value="${speed}" />
          <span id="speedValue">${speed}</span>
        </label>
        <label class="setting-row">
          <span>宠物大小:</span>
          <input type="range" class="setting-range" id="sizeRange" min="60" max="300" value="${size}" />
          <span id="sizeValue">${size}px</span>
        </label>
      </div>
      <div class="panel-section">
        <div class="section-label">状态动画分组</div>
        <label class="setting-row"><span>待机:</span> ${makeSelect("idleGroup", this.petVM.get("idleGroupKey"))}</label>
        <label class="setting-row"><span>行走:</span> ${makeSelect("walkGroup", this.petVM.get("walkGroupKey"))}</label>
        <label class="setting-row"><span>拖拽:</span> ${makeSelect("dragGroup", this.petVM.get("dragGroupKey"))}</label>
        <label class="setting-row"><span>点击:</span> ${makeSelect("clickGroup", this.petVM.get("clickGroupKey"))}</label>
        <label class="setting-row"><span>固定:</span> ${makeSelect("fixedGroup", this.petVM.get("fixedGroupKey"))}</label>
      </div>
      <button class="btn btn-primary" id="saveMovementBtn">💾 保存设置</button>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderSettingsMenu());

    // 实时预览
    const speedRange = this.menuEl.querySelector("#speedRange");
    const sizeRange = this.menuEl.querySelector("#sizeRange");
    speedRange.addEventListener("input", () => {
      this.menuEl.querySelector("#speedValue").textContent = speedRange.value;
    });
    sizeRange.addEventListener("input", () => {
      this.menuEl.querySelector("#sizeValue").textContent =
        sizeRange.value + "px";
    });

    // 保存
    this.menuEl
      .querySelector("#saveMovementBtn")
      .addEventListener("click", () => {
        this.petVM.set("movementSpeed", parseInt(speedRange.value));
        this.petVM.set("petSize", parseInt(sizeRange.value));
        this.petVM.set(
          "idleGroupKey",
          this.menuEl.querySelector("#idleGroup").value,
        );
        this.petVM.set(
          "walkGroupKey",
          this.menuEl.querySelector("#walkGroup").value,
        );
        this.petVM.set(
          "dragGroupKey",
          this.menuEl.querySelector("#dragGroup").value,
        );
        this.petVM.set(
          "clickGroupKey",
          this.menuEl.querySelector("#clickGroup").value,
        );
        this.petVM.set(
          "fixedGroupKey",
          this.menuEl.querySelector("#fixedGroup").value,
        );
        this.onSave();
        this.hide();
      });
  }

  // ==================== 键位绑定面板 ====================

  _renderKeyBindPanel() {
    const bindings = this.petVM.get("keyBindings") || {};
    const groupNames = this.imageGroupModel.getGroupNames();
    const layerKey = this.petVM.get("alwaysOnTopKey") || "";

    const bindingRows = Object.entries(bindings)
      .map(
        ([accel, groupKey]) => `
      <div class="keybind-item">
        <span class="keybind-key">${this._escapeHtml(accel)}</span>
        <span>→ ${this._escapeHtml(groupKey)}</span>
        <span class="keybind-delete" data-key="${this._escapeHtml(accel)}">✕</span>
      </div>
    `,
      )
      .join("");

    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back-settings">← </span>⌨️ 键位绑定
      </div>
      <div class="panel-section">
        <div class="section-label">置顶切换快捷键</div>
        <div class="setting-row">
          <input type="text" class="setting-input" id="layerKeyInput" placeholder="如 Alt+T" value="${this._escapeHtml(layerKey)}" maxlength="30" style="flex:1" />
          <button class="btn" id="saveLayerKeyBtn">保存</button>
        </div>
      </div>
      <div class="panel-section">
        <div class="section-label">已绑定动画快捷键</div>
        ${bindingRows || '<div class="todo-empty">暂无键位绑定</div>'}
      </div>
      <div class="panel-section">
        <div class="section-label">添加新动画绑定</div>
        <input type="text" class="setting-input" id="accelInput" placeholder="快捷键 如: Ctrl+Q" maxlength="30" />
        <select class="setting-select" id="bindGroupSelect">
          ${groupNames.map((n) => `<option value="${n}">${n}</option>`).join("")}
        </select>
        <button class="btn" id="addBindBtn">添加绑定</button>
      </div>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderSettingsMenu());

    // 保存置顶快捷键
    this.menuEl
      .querySelector("#saveLayerKeyBtn")
      .addEventListener("click", () => {
        const key = this.menuEl.querySelector("#layerKeyInput").value.trim();
        this.petVM.set("alwaysOnTopKey", key);
        this._registerAllShortcuts();
        this.onSave();
        this._renderKeyBindPanel();
      });

    // 删除绑定
    this.menuEl.querySelectorAll(".keybind-delete").forEach((el) => {
      el.addEventListener("click", () => {
        const newBindings = { ...bindings };
        delete newBindings[el.dataset.key];
        this.petVM.set("keyBindings", newBindings);
        this._registerAllShortcuts();
        this.onSave();
        this._renderKeyBindPanel();
      });
    });

    // 添加绑定
    this.menuEl.querySelector("#addBindBtn").addEventListener("click", () => {
      const accel = this.menuEl.querySelector("#accelInput").value.trim();
      const groupKey = this.menuEl.querySelector("#bindGroupSelect").value;
      if (!accel) return;
      const newBindings = { ...bindings, [accel]: groupKey };
      this.petVM.set("keyBindings", newBindings);
      this._registerAllShortcuts();
      this.onSave();
      this._renderKeyBindPanel();
    });
  }

  /** 重新注册所有快捷键 */
  _registerAllShortcuts() {
    window.electronAPI.unregisterAllShortcuts();
    const bindings = this.petVM.get("keyBindings") || {};
    for (const [accel, groupKey] of Object.entries(bindings)) {
      window.electronAPI.registerShortcut(accel, groupKey);
    }
    // 注册置顶切换快捷键
    const layerKey = this.petVM.get("alwaysOnTopKey");
    if (layerKey) {
      window.electronAPI.registerShortcut(layerKey, "__toggle_layer__");
    }
  }

  // ==================== 气泡设置面板 ====================

  _renderBubblePanel() {
    const enabled = this.petVM.get("bubbleEnabled");
    const minI = this.petVM.get("bubbleMinInterval") / 1000;
    const maxI = this.petVM.get("bubbleMaxInterval") / 1000;
    const groupNames = this.imageGroupModel.getGroupNames();
    const bubbleGroup = this.petVM.get("bubbleGroupKey");

    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back-settings">← </span>💬 气泡设置
      </div>
      <div class="panel-section">
        <label class="setting-row">
          <span>启用气泡:</span>
          <input type="checkbox" id="bubbleEnabled" ${enabled ? "checked" : ""} />
        </label>
        <label class="setting-row">
          <span>最短间隔(秒):</span>
          <input type="number" class="setting-input small" id="bubbleMin" value="${minI}" min="5" max="600" />
        </label>
        <label class="setting-row">
          <span>最长间隔(秒):</span>
          <input type="number" class="setting-input small" id="bubbleMax" value="${maxI}" min="10" max="3600" />
        </label>
        <label class="setting-row">
          <span>气泡动画组:</span>
          <select class="setting-select" id="bubbleGroup">
            <option value="">无（不切换）</option>
            ${groupNames.map((n) => `<option value="${n}" ${n === bubbleGroup ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </label>
      </div>
      <button class="btn btn-primary" id="saveBubbleBtn">💾 保存设置</button>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderSettingsMenu());

    this.menuEl
      .querySelector("#saveBubbleBtn")
      .addEventListener("click", () => {
        const min =
          parseFloat(this.menuEl.querySelector("#bubbleMin").value) || 20;
        const max =
          parseFloat(this.menuEl.querySelector("#bubbleMax").value) || 60;
        this.petVM.set(
          "bubbleEnabled",
          this.menuEl.querySelector("#bubbleEnabled").checked,
        );
        this.petVM.set("bubbleMinInterval", Math.max(5, min) * 1000);
        this.petVM.set("bubbleMaxInterval", Math.max(min + 5, max) * 1000);
        this.petVM.set(
          "bubbleGroupKey",
          this.menuEl.querySelector("#bubbleGroup").value,
        );
        this.onSave();
        this.hide();
      });
  }

  /** 设置打开聊天的回调 */
  setOnOpenChat(fn) {
    this._onOpenChat = fn;
  }

  /** 设置打开终端的回调 */
  setOnOpenTerminal(fn) {
    this._onOpenTerminal = fn;
  }

  // ==================== AI 设置面板 ====================

  _renderAISettingPanel() {
    const config = this.petVM.getAIConfig();

    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back-settings">← </span>🧠 AI 设置
      </div>
      <div class="panel-section">
        <div class="section-label">API 配置（OpenAI 兼容格式）</div>
        <input type="text" class="setting-input" id="aiApiUrl" placeholder="API 地址 如 https://api.openai.com/v1" value="${this._escapeHtml(config.apiUrl)}" />
        <input type="password" class="setting-input" id="aiApiKey" placeholder="API Key（可选，如本地 Ollama 无需）" value="${this._escapeHtml(config.apiKey)}" />
        <input type="text" class="setting-input" id="aiModel" placeholder="模型名称" value="${this._escapeHtml(config.model)}" />
        <label class="setting-row">
          <span>最大 token:</span>
          <input type="number" class="setting-input small" id="aiMaxTokens" value="${config.maxTokens}" min="50" max="4096" />
        </label>
      </div>
      <div class="panel-section">
        <div class="section-label">宠物人设（留空用默认）</div>
        <textarea class="setting-textarea" id="aiSystemPrompt" rows="4" placeholder="自定义宠物性格和回复风格...">${this._escapeHtml(config.systemPrompt)}</textarea>
      </div>
      <div class="panel-section">
        <div class="section-label">常用预设</div>
        <div class="ai-presets">
          <button class="btn btn-small" data-preset="openai">OpenAI</button>
          <button class="btn btn-small" data-preset="deepseek">DeepSeek</button>
          <button class="btn btn-small" data-preset="ollama">Ollama(本地)</button>
        </div>
      </div>
      <button class="btn btn-primary" id="saveAIBtn">💾 保存设置</button>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderSettingsMenu());

    // 预设按钮
    this.menuEl.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        const urlInput = this.menuEl.querySelector("#aiApiUrl");
        const modelInput = this.menuEl.querySelector("#aiModel");
        if (preset === "openai") {
          urlInput.value = "https://api.openai.com/v1";
          modelInput.value = "gpt-3.5-turbo";
        } else if (preset === "deepseek") {
          urlInput.value = "https://api.deepseek.com/v1";
          modelInput.value = "deepseek-chat";
        } else if (preset === "ollama") {
          urlInput.value = "http://localhost:11434/v1";
          modelInput.value = "llama3";
          this.menuEl.querySelector("#aiApiKey").value = "";
        }
      });
    });

    // 保存
    this.menuEl.querySelector("#saveAIBtn").addEventListener("click", () => {
      this.petVM.set(
        "aiApiUrl",
        this.menuEl.querySelector("#aiApiUrl").value.trim(),
      );
      this.petVM.set(
        "aiApiKey",
        this.menuEl.querySelector("#aiApiKey").value.trim(),
      );
      this.petVM.set(
        "aiModel",
        this.menuEl.querySelector("#aiModel").value.trim() || "gpt-3.5-turbo",
      );
      this.petVM.set(
        "aiMaxTokens",
        parseInt(this.menuEl.querySelector("#aiMaxTokens").value) || 300,
      );
      this.petVM.set(
        "aiSystemPrompt",
        this.menuEl.querySelector("#aiSystemPrompt").value.trim(),
      );
      this.onSave();
      this.hide();
    });
  }

  // ==================== 工具方法 ====================

  /** HTML 转义防止 XSS */
  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== 自主移动设置面板 ====================

  _renderAutoMovePanel() {
    const enabled = this.petVM.get("autoMoveEnabled");
    const minIdle = this.petVM.get("autoMoveMinIdle") / 1000;
    const maxIdle = this.petVM.get("autoMoveMaxIdle") / 1000;
    const range = this.petVM.get("autoMoveRange");
    const groupNames = this.imageGroupModel.getGroupNames();

    const makeGroupSelect = (id, current) => {
      return `<select class="setting-select" id="${id}">
        ${groupNames.map((n) => `<option value="${n}" ${n === current ? "selected" : ""}>${n}</option>`).join("")}
      </select>`;
    };

    this.menuEl.innerHTML = `
      <div class="menu-title">
        <span class="back-btn" data-action="back">← </span>🧭 自主移动设置
      </div>
      <div class="panel-section">
        <label class="setting-row">
          <span>启用自主移动:</span>
          <input type="checkbox" id="autoMoveEnabled" ${enabled ? "checked" : ""} />
        </label>
        <label class="setting-row">
          <span>最短静止(秒):</span>
          <input type="number" class="setting-input small" id="autoMinIdle" value="${minIdle}" min="1" max="120" />
        </label>
        <label class="setting-row">
          <span>最长静止(秒):</span>
          <input type="number" class="setting-input small" id="autoMaxIdle" value="${maxIdle}" min="2" max="300" />
        </label>
        <label class="setting-row">
          <span>移动范围(px):</span>
          <input type="range" class="setting-range" id="autoRange" min="50" max="800" value="${range}" />
          <span id="autoRangeValue">${range}px</span>
        </label>
      </div>
      <div class="panel-section">
        <div class="section-label">特殊动画分组</div>
        <label class="setting-row"><span>酷炫:</span> ${makeGroupSelect("coolGroup", this.petVM.get("coolGroupKey"))}</label>
        <label class="setting-row"><span>开心:</span> ${makeGroupSelect("happyGroup", this.petVM.get("happyGroupKey"))}</label>
        <label class="setting-row"><span>眨眼:</span> ${makeGroupSelect("blinkGroup", this.petVM.get("blinkGroupKey"))}</label>
      </div>
      <button class="btn btn-primary" id="saveAutoMoveBtn">💾 保存设置</button>
    `;

    this.menuEl
      .querySelector(".back-btn")
      .addEventListener("click", () => this._renderMainMenu());

    const rangeInput = this.menuEl.querySelector("#autoRange");
    rangeInput.addEventListener("input", () => {
      this.menuEl.querySelector("#autoRangeValue").textContent =
        rangeInput.value + "px";
    });

    this.menuEl
      .querySelector("#saveAutoMoveBtn")
      .addEventListener("click", () => {
        const wasEnabled = this.petVM.get("autoMoveEnabled");
        const newEnabled =
          this.menuEl.querySelector("#autoMoveEnabled").checked;
        const minV =
          parseFloat(this.menuEl.querySelector("#autoMinIdle").value) || 4;
        const maxV =
          parseFloat(this.menuEl.querySelector("#autoMaxIdle").value) || 12;

        this.petVM.set("autoMoveEnabled", newEnabled);
        this.petVM.set("autoMoveMinIdle", Math.max(1, minV) * 1000);
        this.petVM.set("autoMoveMaxIdle", Math.max(minV + 1, maxV) * 1000);
        this.petVM.set("autoMoveRange", parseInt(rangeInput.value));
        this.petVM.set(
          "coolGroupKey",
          this.menuEl.querySelector("#coolGroup").value,
        );
        this.petVM.set(
          "happyGroupKey",
          this.menuEl.querySelector("#happyGroup").value,
        );
        this.petVM.set(
          "blinkGroupKey",
          this.menuEl.querySelector("#blinkGroup").value,
        );

        // 启动/停止自主移动
        if (newEnabled && !wasEnabled) {
          this.petVM.startAutoMove();
        } else if (!newEnabled) {
          this.petVM.stopAutoMove();
        }

        this.onSave();
        this.hide();
      });
  }
}
