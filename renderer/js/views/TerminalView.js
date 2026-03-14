/**
 * TerminalView - 嵌套Linux虚拟机终端视图
 * 在宠物内嵌入xterm.js终端，通过node-pty连接WSL
 */
export class TerminalView {
  /**
   * @param {HTMLElement} panelEl - 终端面板容器
   * @param {number} displayOffsetX
   * @param {number} displayOffsetY
   */
  constructor(panelEl, displayOffsetX = 0, displayOffsetY = 0) {
    this.panelEl = panelEl;
    this.displayOffsetX = displayOffsetX;
    this.displayOffsetY = displayOffsetY;
    this._visible = false;
    this._term = null;
    this._fitAddon = null;
    this._ptyStarted = false;
    this._isDragging = false;
    this._dragOffX = 0;
    this._dragOffY = 0;

    // 阻止鼠标穿透 + 保持焦点
    this.panelEl.addEventListener('mouseenter', () => {
      window.electronAPI.setIgnoreMouseEvents(false);
    });
    this.panelEl.addEventListener('mouseleave', () => {
      // 拖拽过程中不恢复穿透，否则会丢失鼠标事件
      if (this._isDragging) return;
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    });
    // 点击面板时聚焦终端，并阻止事件冒泡到全局click处理器
    this.panelEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      window.electronAPI.setIgnoreMouseEvents(false);
      if (this._term) this._term.focus();
    });
    this.panelEl.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /** 切换终端面板显示/隐藏 */
  async toggle() {
    if (this._visible) {
      this.hide();
    } else {
      await this.show();
    }
  }

  /** 显示终端面板 */
  async show() {
    this._visible = true;
    this.panelEl.classList.add('visible');

    if (!this._term) {
      await this._initTerminal();
    }

    // 适配尺寸并聚焦
    setTimeout(() => {
      if (this._fitAddon) {
        this._fitAddon.fit();
      }
      if (this._term) {
        this._term.focus();
      }
    }, 100);
  }

  /** 隐藏终端面板 */
  hide() {
    this._visible = false;
    this.panelEl.classList.remove('visible');
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }

  /** 初始化xterm终端 */
  async _initTerminal() {
    // 构建面板内容
    this.panelEl.innerHTML = `
      <div class="terminal-titlebar">
        <span class="terminal-title">🐧 Linux 终端</span>
        <div class="terminal-controls">
          <button class="terminal-btn terminal-btn-minimize" title="最小化">─</button>
          <button class="terminal-btn terminal-btn-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="terminal-body" id="terminal-xterm"></div>
      <div class="terminal-statusbar">
        <span class="terminal-status-text" id="terminal-status">连接中...</span>
        <button class="terminal-btn-reconnect" id="terminal-reconnect" title="重新连接">🔄</button>
      </div>
    `;

    // 标题栏拖拽
    const titlebar = this.panelEl.querySelector('.terminal-titlebar');
    titlebar.addEventListener('mousedown', (e) => this._startDrag(e));

    // 关闭按钮
    this.panelEl.querySelector('.terminal-btn-close').addEventListener('click', () => {
      this.hide();
    });

    // 最小化按钮
    this.panelEl.querySelector('.terminal-btn-minimize').addEventListener('click', () => {
      this.hide();
    });

    // 重连按钮
    this.panelEl.querySelector('#terminal-reconnect').addEventListener('click', () => {
      this._reconnect();
    });

    // 动态加载 xterm.js（UMD格式，需要script标签加载）
    if (!window.Terminal) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../node_modules/xterm/lib/xterm.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // 动态加载 addon-fit（ESM格式，路径相对于当前JS模块文件）
    const { FitAddon } = await import('../../../node_modules/@xterm/addon-fit/lib/addon-fit.mjs');

    // 加载xterm CSS
    if (!document.getElementById('xterm-css')) {
      const link = document.createElement('link');
      link.id = 'xterm-css';
      link.rel = 'stylesheet';
      link.href = '../node_modules/xterm/css/xterm.css';
      document.head.appendChild(link);
    }

    const xtermContainer = this.panelEl.querySelector('#terminal-xterm');

    this._term = new window.Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      theme: {
        background: '#1a1b2e',
        foreground: '#e0def4',
        cursor: '#f6c177',
        cursorAccent: '#1a1b2e',
        selectionBackground: 'rgba(110, 106, 134, 0.4)',
        black: '#26233a',
        red: '#eb6f92',
        green: '#31748f',
        yellow: '#f6c177',
        blue: '#9ccfd8',
        magenta: '#c4a7e7',
        cyan: '#ebbcba',
        white: '#e0def4',
        brightBlack: '#6e6a86',
        brightRed: '#eb6f92',
        brightGreen: '#31748f',
        brightYellow: '#f6c177',
        brightBlue: '#9ccfd8',
        brightMagenta: '#c4a7e7',
        brightCyan: '#ebbcba',
        brightWhite: '#e0def4',
      },
      allowTransparency: true,
      scrollback: 1000,
    });

    this._fitAddon = new FitAddon();
    this._term.loadAddon(this._fitAddon);
    this._term.open(xtermContainer);

    // 先适配尺寸并聚焦
    setTimeout(() => {
      this._fitAddon.fit();
      this._term.focus();
    }, 50);

    // 窗口resize时重新适配
    this._resizeHandler = () => {
      if (this._visible && this._fitAddon) {
        this._fitAddon.fit();
      }
    };
    window.addEventListener('resize', this._resizeHandler);

    // 创建ResizeObserver监听面板大小变化
    this._resizeObserver = new ResizeObserver(() => {
      if (this._visible && this._fitAddon) {
        this._fitAddon.fit();
      }
    });
    this._resizeObserver.observe(xtermContainer);

    // 用户输入发送到PTY
    this._term.onData((data) => {
      if (this._ptyStarted) {
        window.electronAPI.ptyWrite(data);
      }
    });

    // 终端尺寸变化通知PTY
    this._term.onResize(({ cols, rows }) => {
      if (this._ptyStarted) {
        window.electronAPI.ptyResize(cols, rows);
      }
    });

    // 接收PTY数据
    window.electronAPI.onPtyData((data) => {
      if (this._term) {
        this._term.write(data);
      }
    });

    // PTY退出
    window.electronAPI.onPtyExit((code) => {
      if (this._term) {
        this._term.write(`\r\n\x1b[33m[进程已退出，代码: ${code}] 按 🔄 重新连接\x1b[0m\r\n`);
      }
      this._ptyStarted = false;
      this._updateStatus('已断开', false);
    });

    // 启动PTY
    await this._startPty();
  }

  /** 启动PTY进程 */
  async _startPty() {
    const cols = this._term ? this._term.cols : 80;
    const rows = this._term ? this._term.rows : 24;

    const result = await window.electronAPI.ptySpawn(cols, rows);
    if (result.error) {
      this._term.write(`\x1b[31m启动失败: ${result.error}\x1b[0m\r\n`);
      if (result.hint) {
        this._term.write(`\x1b[33m${result.hint}\x1b[0m\r\n`);
      }
      this._updateStatus('启动失败', false);
      return;
    }

    this._ptyStarted = true;

    // 根据模式显示不同状态
    if (result.mode === 'qemu') {
      this._updateStatus('Alpine Linux VM', true);
      this._updateTitle('🐧 Linux 虚拟机');
    } else if (result.mode === 'wsl-fallback') {
      this._updateStatus(`${result.shell} (回退)`, true);
      this._updateTitle('🐧 Linux 终端 (WSL)');
      if (result.hint) {
        this._term.write(`\x1b[33m${result.hint}\x1b[0m\r\n`);
      }
    } else {
      this._updateStatus(result.shell || 'Linux', true);
    }

    // 确保终端获得焦点
    if (this._term) this._term.focus();
  }

  /** 重新连接 */
  async _reconnect() {
    window.electronAPI.ptyKill();
    this._ptyStarted = false;

    if (this._term) {
      this._term.clear();
      this._term.write('\x1b[33m正在重新连接...\x1b[0m\r\n');
    }

    await this._startPty();
  }

  /** 更新状态栏 */
  _updateStatus(text, connected) {
    const statusEl = this.panelEl.querySelector('#terminal-status');
    if (statusEl) {
      statusEl.textContent = connected ? `● ${text}` : `○ ${text}`;
      statusEl.className = `terminal-status-text ${connected ? 'connected' : 'disconnected'}`;
    }
  }

  /** 更新标题栏文本 */
  _updateTitle(text) {
    const titleEl = this.panelEl.querySelector('.terminal-title');
    if (titleEl) titleEl.textContent = text;
  }

  /** 标题栏拖拽 */
  _startDrag(e) {
    if (e.target.closest('.terminal-controls')) return;
    this._isDragging = true;
    const rect = this.panelEl.getBoundingClientRect();
    this._dragOffX = e.clientX - rect.left;
    this._dragOffY = e.clientY - rect.top;
    this.panelEl.style.willChange = 'left, top';
    // 使用全局事件捕获，确保鼠标快速移动时不丢失
    window.electronAPI.setIgnoreMouseEvents(false);

    const onMove = (e) => {
      if (!this._isDragging) return;
      if (this._dragRAF) cancelAnimationFrame(this._dragRAF);
      this._dragRAF = requestAnimationFrame(() => {
        let nx = e.clientX - this._dragOffX;
        let ny = e.clientY - this._dragOffY;
        nx = Math.max(0, Math.min(window.innerWidth - 100, nx));
        ny = Math.max(0, Math.min(window.innerHeight - 50, ny));
        this.panelEl.style.left = `${nx}px`;
        this.panelEl.style.top = `${ny}px`;
        this.panelEl.style.transform = 'none';
      });
    };

    const onUp = () => {
      this._isDragging = false;
      this.panelEl.style.willChange = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /** 销毁终端 */
  destroy() {
    window.electronAPI.ptyKill();
    if (this._term) {
      this._term.dispose();
      this._term = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }
}
