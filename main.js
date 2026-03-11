/**
 * 主进程 - 管理窗口、IPC通信、数据持久化
 */
const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const { marked } = require('marked');
const hljs = require('highlight.js');
const katex = require('katex');

const DATA_PATH = path.join(app.getPath('userData'), 'pet-data.json');

let mainWindow = null;
const allWindows = [];

/** 计算所有屏幕的综合边界 */
function getAllDisplayBounds() {
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of displays) {
    const { x, y, width, height } = d.bounds;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + width > maxX) maxX = x + width;
    if (y + height > maxY) maxY = y + height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 每个显示器创建独立透明覆盖窗口（Windows 透明窗口无法跨屏，需多窗口方案） */
function createWindows() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    const isPrimary = display.id === primary.id;

    const win = new BrowserWindow({
      width,
      height,
      x,
      y,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      type: 'toolbar',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.setAlwaysOnTop(true, 'pop-up-menu');
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setVisibleOnAllWorkspaces(true);
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
      query: {
        role: isPrimary ? 'primary' : 'secondary',
        dx: String(x),
        dy: String(y),
        dw: String(width),
        dh: String(height)
      }
    });

    allWindows.push(win);
    if (isPrimary) mainWindow = win;
  }
}

// ==================== Markdown 渲染配置 ====================
marked.setOptions({ breaks: true, gfm: true });
const mdRenderer = new marked.Renderer();
mdRenderer.code = function(code, lang) {
  let highlighted;
  if (lang && hljs.getLanguage(lang)) {
    highlighted = hljs.highlight(code, { language: lang }).value;
  } else {
    highlighted = hljs.highlightAuto(code).value;
  }
  return `<pre><code class="hljs language-${lang || ''}">${highlighted}</code></pre>`;
};
marked.use({ renderer: mdRenderer });

function renderMath(text) {
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try { return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }); }
    catch { return _; }
  });
  text = text.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_, expr) => {
    try { return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }); }
    catch { return _; }
  });
  return text;
}

function renderMarkdownText(mdText) {
  if (!mdText) return '';
  let html = renderMath(mdText);
  html = marked.parse(html);
  return html;
}

// ==================== IPC 处理器 ====================

/** Markdown 渲染 */
ipcMain.handle('render-markdown', (_event, mdText) => {
  return renderMarkdownText(mdText);
});

/** 切换鼠标穿透状态（作用于发送者所在的窗口） */
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(ignore, options || {});
});

/** 设置窗口置顶状态（作用于所有窗口） */
ipcMain.on('set-always-on-top', (_event, flag) => {
  for (const win of allWindows) {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, flag ? 'pop-up-menu' : 'floating');
    }
  }
});

/** 加载持久化数据 */
ipcMain.handle('load-data', async () => {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('加载数据失败:', e);
  }
  return null;
});

/** 保存数据到本地 */
ipcMain.handle('save-data', async (_event, data) => {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('保存数据失败:', e);
    return false;
  }
});

/** 获取虚拟屏幕总尺寸及主显示器信息 */
ipcMain.handle('get-screen-size', async () => {
  const primary = screen.getPrimaryDisplay();
  const bounds = getAllDisplayBounds();
  return {
    width: bounds.width,
    height: bounds.height,
    offsetX: bounds.x,
    offsetY: bounds.y,
    primaryWidth: primary.workAreaSize.width,
    primaryHeight: primary.workAreaSize.height,
    primaryX: primary.bounds.x,
    primaryY: primary.bounds.y
  };
});

/** 打开文件选择对话框并将图片读取为 Data URL 返回 */
ipcMain.handle('import-images', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }]
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  const mimeMap = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp'
  };

  const imported = [];
  for (const filePath of result.filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    if (!allowed.includes(ext)) continue;

    const data = fs.readFileSync(filePath);
    const mime = mimeMap[ext] || 'image/png';
    const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
    imported.push({ name: path.basename(filePath), dataUrl });
  }
  return imported;
});

/** 注册全局快捷键 */
ipcMain.on('register-shortcut', (_event, accelerator, id) => {
  try {
    // 先尝试取消已有的同名快捷键
    try { globalShortcut.unregister(accelerator); } catch (_) { /* ignore */ }
    globalShortcut.register(accelerator, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-triggered', id);
      }
    });
  } catch (e) {
    console.error('注册快捷键失败:', accelerator, e.message);
  }
});

/** 注销所有快捷键 */
ipcMain.on('unregister-all-shortcuts', () => {
  globalShortcut.unregisterAll();
});

/** 读取内置图片目录下所有文件为 Data URL（首次加载默认宠物） */
ipcMain.handle('load-builtin-images', async () => {
  // 打包后 img 在 extraResources 中，开发时在项目根目录
  const imgDir = app.isPackaged
    ? path.join(process.resourcesPath, 'img')
    : path.join(__dirname, 'img');
  if (!fs.existsSync(imgDir)) return [];

  const mimeMap = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp'
  };
  const allowed = Object.keys(mimeMap);
  const files = fs.readdirSync(imgDir)
    .filter(f => allowed.includes(path.extname(f).toLowerCase()))
    .sort(); // 确保顺序稳定

  const results = [];
  for (const file of files) {
    const filePath = path.join(imgDir, file);
    const ext = path.extname(file).toLowerCase();
    const data = fs.readFileSync(filePath);
    const mime = mimeMap[ext] || 'image/png';
    results.push({
      name: file,
      dataUrl: `data:${mime};base64,${data.toString('base64')}`
    });
  }
  return results;
});

/** 退出应用 */
ipcMain.on('quit-app', () => {
  app.quit();
});

/** 启动外部程序 */
ipcMain.handle('launch-app', async (_event, exePath) => {
  try {
    const { exec } = require('child_process');
    exec(`"${exePath}"`, { windowsHide: false });
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

/** 微信多开 - 通过 start 命令绕过微信单实例检测 */
ipcMain.handle('launch-wechat-multi', async (_event, wechatPath) => {
  try {
    const { exec } = require('child_process');
    // 使用 start 命令在新进程中启动微信，绕过单实例互斥锁
    exec(`start "" "${wechatPath.replace(/"/g, '')}"`, { windowsHide: false });
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

/** 选择可执行文件 */
ipcMain.handle('select-exe', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '可执行文件', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

/** 获取剪贴板文本 */
ipcMain.handle('get-clipboard-text', async () => {
  return clipboard.readText();
});

/** 读取文件文本内容（拖拽文件用） */
ipcMain.handle('read-file-text', async (_event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    // 限制文件大小 500KB
    if (stat.size > 500 * 1024) {
      return { error: '文件过大（超过500KB），无法读取' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, name: path.basename(filePath) };
  } catch (e) {
    return { error: e.message };
  }
});

/** 截取屏幕内容 */
ipcMain.handle('capture-screen', async () => {
  try {
    const { desktopCapturer } = require('electron');
    // 隐藏所有宠物窗口避免截到自身
    for (const win of allWindows) { if (win && !win.isDestroyed()) win.hide(); }
    await new Promise(r => setTimeout(r, 300));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    for (const win of allWindows) { if (win && !win.isDestroyed()) win.show(); }
    if (sources.length > 0) {
      const dataUrl = sources[0].thumbnail.toDataURL();
      return { dataUrl };
    }
    return { error: '无法捕获屏幕' };
  } catch (e) {
    for (const win of allWindows) { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }
    return { error: e.message };
  }
});

/** 将宠物状态广播给所有副屏窗口 */
ipcMain.on('broadcast-pet-state', (_event, state) => {
  for (const win of allWindows) {
    if (win && !win.isDestroyed() && win !== mainWindow) {
      win.webContents.send('pet-state', state);
    }
  }
});

/** 将副屏的用户交互转发到主窗口 */
ipcMain.on('relay-secondary-input', (_event, type, x, y) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('relayed-input', type, x, y);
  }
});

// ==================== AI / LLM ====================

/** 调用 OpenAI 兼容 API（支持 OpenAI、DeepSeek、Ollama 等） */
ipcMain.handle('ai-chat', async (_event, { apiUrl, apiKey, model, messages, maxTokens }) => {
  const url = apiUrl.replace(/\/+$/, '') + '/chat/completions';

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    model: model || 'gpt-3.5-turbo',
    messages,
    max_tokens: maxTokens || 300,
    temperature: 0.8,
  });

  try {
    // 使用 Node.js 内置 fetch (Electron 28+ 支持)
    const resp = await fetch(url, { method: 'POST', headers, body });
    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `API Error ${resp.status}: ${errText.slice(0, 200)}` };
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { content };
  } catch (e) {
    return { error: e.message };
  }
});

// ==================== 生命周期 ====================

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
