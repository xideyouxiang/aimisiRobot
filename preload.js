/**
 * 预加载脚本 - 安全地暴露主进程能力给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** 设置鼠标事件穿透 */
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },

  /** 加载持久化数据 */
  loadData: () => ipcRenderer.invoke('load-data'),

  /** 保存数据 */
  saveData: (data) => ipcRenderer.invoke('save-data', data),

  /** 获取屏幕尺寸 */
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),

  /** 导入图片文件（返回 Data URL 数组） */
  importImages: () => ipcRenderer.invoke('import-images'),

  /** 注册全局快捷键 */
  registerShortcut: (accelerator, id) => {
    ipcRenderer.send('register-shortcut', accelerator, id);
  },

  /** 注销所有快捷键 */
  unregisterAllShortcuts: () => {
    ipcRenderer.send('unregister-all-shortcuts');
  },

  /** 监听快捷键触发事件 */
  onShortcutTriggered: (callback) => {
    ipcRenderer.removeAllListeners('shortcut-triggered');
    ipcRenderer.on('shortcut-triggered', (_event, id) => callback(id));
  },

  /** 退出应用 */
  quitApp: () => ipcRenderer.send('quit-app'),

  /** 加载内置图片目录 */
  loadBuiltinImages: () => ipcRenderer.invoke('load-builtin-images'),

  /** AI 聊天请求 */
  aiChat: (params) => ipcRenderer.invoke('ai-chat', params),

  /** 启动外部程序 */
  launchApp: (exePath) => ipcRenderer.invoke('launch-app', exePath),

  /** 微信多开 */
  launchWechatMulti: (wechatPath) => ipcRenderer.invoke('launch-wechat-multi', wechatPath),

  /** 选择可执行文件 */
  selectExe: () => ipcRenderer.invoke('select-exe'),

  /** 获取文件图标 */
  getFileIcon: (filePath) => ipcRenderer.invoke('get-file-icon', filePath),

  /** 获取剪贴板文本 */
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),

  /** 读取文件文本内容 */
  readFileText: (filePath) => ipcRenderer.invoke('read-file-text', filePath),

  /** 截取屏幕 */
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  /** 设置窗口置顶状态 */
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),

  /** 向副屏广播宠物状态 */
  broadcastPetState: (state) => ipcRenderer.send('broadcast-pet-state', state),

  /** 副屏监听宠物状态 */
  onPetState: (callback) => {
    ipcRenderer.removeAllListeners('pet-state');
    ipcRenderer.on('pet-state', (_event, state) => callback(state));
  },

  /** 副屏将输入事件中转到主窗口 */
  relayInput: (type, x, y) => ipcRenderer.send('relay-secondary-input', type, x, y),

  /** 主窗口监听来自副屏的输入 */
  onRelayedInput: (callback) => {
    ipcRenderer.removeAllListeners('relayed-input');
    ipcRenderer.on('relayed-input', (_event, type, x, y) => callback(type, x, y));
  },

  /** Markdown 渲染（支持代码高亮和数学公式） */
  renderMarkdown: (mdText) => ipcRenderer.invoke('render-markdown', mdText),

  // ==================== PTY 终端 / QEMU 虚拟机 ====================

  /** 获取 VM 信息 */
  vmGetInfo: () => ipcRenderer.invoke('vm-get-info'),

  /** 安装 QEMU */
  vmInstallQemu: () => ipcRenderer.invoke('vm-install-qemu'),

  /** 启动 PTY 进程（QEMU VM 或 WSL 回退） */
  ptySpawn: (cols, rows) => ipcRenderer.invoke('pty-spawn', cols, rows),

  /** 写入 PTY */
  ptyWrite: (data) => ipcRenderer.send('pty-write', data),

  /** 调整 PTY 大小 */
  ptyResize: (cols, rows) => ipcRenderer.send('pty-resize', cols, rows),

  /** 终止 PTY */
  ptyKill: () => ipcRenderer.send('pty-kill'),

  /** 接收 PTY 数据 */
  onPtyData: (callback) => {
    ipcRenderer.removeAllListeners('pty-data');
    ipcRenderer.on('pty-data', (_event, data) => callback(data));
  },

  /** 接收 PTY 退出事件 */
  onPtyExit: (callback) => {
    ipcRenderer.removeAllListeners('pty-exit');
    ipcRenderer.on('pty-exit', (_event, code) => callback(code));
  },
});
