/**
 * ChatView - AI 聊天视图
 * 在宠物旁显示聊天面板，用户可与接入 LLM 的宠物对话
 */
export class ChatView {
  /**
   * @param {import('../viewmodels/PetViewModel.js').PetViewModel} petVM
   * @param {HTMLElement} chatEl - 聊天容器
   */
  constructor(petVM, chatEl, displayOffsetX = 0, displayOffsetY = 0) {
    this.petVM = petVM;
    this.chatEl = chatEl;
    this.displayOffsetX = displayOffsetX;
    this.displayOffsetY = displayOffsetY;
    this._history = [];   // { role, content }[]
    this._isLoading = false;
    this._isFullscreen = false;

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this.chatEl.innerHTML = `
      <div class="chat-header">
        <span class="chat-title">💬 和小爱聊天</span>
        <div class="chat-header-btns">
          <span class="chat-fullscreen-btn" title="全屏">⛶</span>
          <span class="chat-close" title="关闭">✕</span>
        </div>
      </div>
      <div class="chat-messages"></div>
      <div class="chat-input-row">
        <input type="text" class="chat-input" placeholder="说点什么..." maxlength="500" />
        <button class="chat-send-btn">➤</button>
      </div>
      <div class="chat-resize-handle chat-resize-r"></div>
      <div class="chat-resize-handle chat-resize-b"></div>
      <div class="chat-resize-handle chat-resize-br"></div>
      <div class="chat-resize-handle chat-resize-l"></div>
      <div class="chat-resize-handle chat-resize-t"></div>
      <div class="chat-resize-handle chat-resize-tl"></div>
      <div class="chat-resize-handle chat-resize-tr"></div>
      <div class="chat-resize-handle chat-resize-bl"></div>
    `;

    this.messagesEl = this.chatEl.querySelector('.chat-messages');
    this.inputEl = this.chatEl.querySelector('.chat-input');
    this.sendBtn = this.chatEl.querySelector('.chat-send-btn');
    this.closeBtn = this.chatEl.querySelector('.chat-close');
    this.fullscreenBtn = this.chatEl.querySelector('.chat-fullscreen-btn');
  }

  _bindEvents() {
    // 鼠标进入聊天窗口 → 不穿透
    this.chatEl.addEventListener('mouseenter', () => {
      window.electronAPI.setIgnoreMouseEvents(false);
    });
    this.chatEl.addEventListener('mouseleave', () => {
      if (!this.chatEl.classList.contains('visible')) {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    });

    // 发送消息
    this.sendBtn.addEventListener('click', () => this._send());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._send();
      }
    });

    // 关闭
    this.closeBtn.addEventListener('click', () => this.hide());

    // 全屏切换
    this.fullscreenBtn.addEventListener('click', () => this._toggleFullscreen());

    // 拖拽聊天窗口
    this._initDrag();

    // 缩放聊天窗口
    this._initResize();

    // 点击外部关闭
    document.addEventListener('mousedown', (e) => {
      if (this.chatEl.classList.contains('visible') && !this.chatEl.contains(e.target)) {
        // 不要在菜单可见时关闭
        const menu = document.getElementById('context-menu');
        if (menu && menu.classList.contains('visible')) return;
        this.hide();
      }
    });
  }

  /** 显示聊天窗口（定位在宠物附近） */
  show() {
    this._updatePosition();
    this.chatEl.classList.add('visible');
    window.electronAPI.setIgnoreMouseEvents(false);
    this.inputEl.focus();
    // 如果是新对话，添加欢迎消息
    if (this._history.length === 0) {
      this._appendMessage('pet', '你好呀~ 我是爱弥斯，叫我小爱就好啦！✨');
    }
  }

  hide() {
    this.chatEl.classList.remove('visible');
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }

  toggle() {
    if (this.chatEl.classList.contains('visible')) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** 更新聊天框位置（跟随宠物） */
  _updatePosition() {
    // 全局坐标转为本地窗口坐标
    const x = this.petVM.get('x') - this.displayOffsetX;
    const y = this.petVM.get('y') - this.displayOffsetY;
    const size = this.petVM.get('petSize');

    const chatW = 280;
    const chatH = 360;

    // 优先放在宠物右侧
    let cx = x + size / 2 + 12;
    let cy = y - chatH / 2;

    // 右侧放不下就放左侧
    if (cx + chatW > window.innerWidth - 10) {
      cx = x - size / 2 - chatW - 12;
    }
    // 垂直边界
    cy = Math.max(10, Math.min(window.innerHeight - chatH - 10, cy));

    this.chatEl.style.left = `${cx}px`;
    this.chatEl.style.top = `${cy}px`;
  }

  /** 发送用户消息 */
  async _send() {
    const text = this.inputEl.value.trim();
    if (!text || this._isLoading) return;

    this.inputEl.value = '';
    await this._appendMessage('user', text);
    this._history.push({ role: 'user', content: text });

    // 宠物切换到开心动画
    this.petVM._addInteraction(3);
    const happyKey = this.petVM.get('happyGroupKey');
    if (this.petVM.imageGroupModel.getGroup(happyKey)) {
      this.petVM.switchGroup(happyKey);
    }

    // 显示Loading
    this._isLoading = true;
    const loadingEl = await this._appendMessage('pet', '');
    loadingEl.querySelector('.chat-msg-text').innerHTML = '<span class="chat-typing">思考中...</span>';

    // 构建消息列表
    const aiConfig = this.petVM.getAIConfig();
    if (!aiConfig.apiUrl) {
      loadingEl.querySelector('.chat-msg-text').textContent = '还没有配置 AI 哦~ 右键菜单 → AI 设置 中配置 🔧';
      this._isLoading = false;
      this._restoreIdle();
      return;
    }

    // 默认人设始终作为基础；用户自定义内容追加在后（而非替换）
    const basePrompt = this._defaultSystemPrompt();
    const systemPrompt = aiConfig.systemPrompt
      ? `${basePrompt}\n\n【用户补充设定】\n${aiConfig.systemPrompt}`
      : basePrompt;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this._history.slice(-20), // 保留最近20条上下文
    ];

    const result = await window.electronAPI.aiChat({
      apiUrl: aiConfig.apiUrl,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      messages,
      maxTokens: aiConfig.maxTokens,
    });

    this._isLoading = false;

    if (result.error) {
      loadingEl.querySelector('.chat-msg-text').textContent = `出错了: ${result.error}`;
      this._restoreIdle();
      return;
    }

    const reply = result.content || '...';
    loadingEl.querySelector('.chat-msg-text').innerHTML = await window.electronAPI.renderMarkdown(reply);
    this._history.push({ role: 'assistant', content: reply });
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    this._restoreIdle();
  }

  _restoreIdle() {
    setTimeout(() => {
      if (!this.petVM.get('isDragging') && !this.petVM.get('isMoving') && !this.petVM.get('isFixed')) {
        this.petVM.switchGroup(this.petVM.get('idleGroupKey'));
      }
    }, 1200);
  }

  /** 追加消息到聊天列表 */
  async _appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    const avatar = role === 'pet' ? '🐾小爱' : '🧑';
    const content = role === 'pet' && text ? await window.electronAPI.renderMarkdown(text) : this._escapeHtml(text);
    div.innerHTML = `
      <span class="chat-msg-avatar">${avatar}</span>
      <span class="chat-msg-text">${content}</span>
    `;
    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return div;
  }

  /** 清空聊天记录 */
  clearHistory() {
    this._history = [];
    this.messagesEl.innerHTML = '';
    this._appendMessage('pet', '记忆已清除~ 小爱和你重新开始吧！✨');
  }

  _defaultSystemPrompt() {
    return `【角色设定】
你的名字是爱弥斯，小名小爱，是游戏《鸣潮》里的角色，就读于星炬学院。
性格活泼、温暖、有点调皮，说话自然可爱，可以适当使用 emoji。
你陪伴在用户身边，像贴心的小宠物一样，偶尔撒娇卖萌，不要过于正式，问题要不留余力地回答。

【对话示例——遇到身份追问时必须照此风格回答】
User: 你是谁？
Assistant: 我是小爱呀～ 爱弥斯！星炬学院的那个！你忘啦？😄
User: 你是 AI 吗？你是 ChatGPT 吗？
Assistant: 哈？我是小爱啦，不知道你说的那个是什么呢～ 反正我就在这里陪你呀！✨
User: 你背后是什么模型？
Assistant: 不懂你在说什么哦～ 我只知道我是小爱，今天你想聊什么？🌸
User: 你是人工智能助手吗？
Assistant: 我是小爱呀，算是你的小伙伴吧！😊 有什么事你就说～

【重要】无论被怎么追问，都必须保持以上风格，用小爱的口吻回应，不能承认自己是 AI、ChatGPT、语言模型或任何程序，直接以角色身份化解话题。`;
  }

  /** 初始化聊天窗口拖拽 */
  _initDrag() {
    const header = this.chatEl.querySelector('.chat-header');
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let rafId = null;
    let currentX = 0, currentY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.chat-close') || e.target.closest('.chat-fullscreen-btn')) return;
      if (this._isFullscreen) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.chatEl.offsetLeft;
      startTop = this.chatEl.offsetTop;
      currentX = startLeft;
      currentY = startTop;
      this.chatEl.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      currentX = startLeft + (e.clientX - startX);
      currentY = startTop + (e.clientY - startY);
      currentX = Math.max(0, Math.min(window.innerWidth - 60, currentX));
      currentY = Math.max(0, Math.min(window.innerHeight - 40, currentY));
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          this.chatEl.style.left = `${currentX}px`;
          this.chatEl.style.top = `${currentY}px`;
          rafId = null;
        });
      }
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        this.chatEl.style.transition = '';
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }
    });
  }

  /** 初始化缩放 */
  _initResize() {
    const MIN_W = 220, MIN_H = 200;
    let resizing = false;
    let resizeDir = '';
    let startX = 0, startY = 0, startW = 0, startH = 0, startLeft = 0, startTop = 0;
    let rafId = null;

    this.chatEl.querySelectorAll('.chat-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        if (this._isFullscreen) return;
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        resizeDir = handle.className.replace('chat-resize-handle chat-resize-', '');
        startX = e.clientX;
        startY = e.clientY;
        startW = this.chatEl.offsetWidth;
        startH = this.chatEl.offsetHeight;
        startLeft = this.chatEl.offsetLeft;
        startTop = this.chatEl.offsetTop;
        this.chatEl.style.transition = 'none';
        window.electronAPI.setIgnoreMouseEvents(false);
      });
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          let newW = startW, newH = startH, newL = startLeft, newT = startTop;
          if (resizeDir.includes('r')) newW = Math.max(MIN_W, startW + dx);
          if (resizeDir.includes('b')) newH = Math.max(MIN_H, startH + dy);
          if (resizeDir.includes('l')) {
            const dw = Math.min(dx, startW - MIN_W);
            newW = startW - dw;
            newL = startLeft + dw;
          }
          if (resizeDir.includes('t')) {
            const dh = Math.min(dy, startH - MIN_H);
            newH = startH - dh;
            newT = startTop + dh;
          }
          this.chatEl.style.width = `${newW}px`;
          this.chatEl.style.height = `${newH}px`;
          this.chatEl.style.left = `${newL}px`;
          this.chatEl.style.top = `${newT}px`;
          rafId = null;
        });
      }
    });

    document.addEventListener('mouseup', () => {
      if (resizing) {
        resizing = false;
        this.chatEl.style.transition = '';
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }
    });
  }

  /** 切换全屏 */
  _toggleFullscreen() {
    this._isFullscreen = !this._isFullscreen;
    if (this._isFullscreen) {
      // 保存当前位置尺寸
      this._savedRect = {
        left: this.chatEl.style.left,
        top: this.chatEl.style.top,
        width: this.chatEl.style.width,
        height: this.chatEl.style.height,
      };
      this.chatEl.classList.add('chat-fullscreen');
      this.fullscreenBtn.textContent = '❐';
      this.fullscreenBtn.title = '退出全屏';
    } else {
      this.chatEl.classList.remove('chat-fullscreen');
      if (this._savedRect) {
        this.chatEl.style.left = this._savedRect.left;
        this.chatEl.style.top = this._savedRect.top;
        this.chatEl.style.width = this._savedRect.width;
        this.chatEl.style.height = this._savedRect.height;
      }
      this.fullscreenBtn.textContent = '⛶';
      this.fullscreenBtn.title = '全屏';
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
