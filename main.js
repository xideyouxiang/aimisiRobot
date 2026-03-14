/**
 * 主进程 - 管理窗口、IPC通信、数据持久化
 */
const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const net = require('net');
const { execSync, spawn } = require('child_process');

const { marked } = require('marked');
const hljs = require('highlight.js');
const katex = require('katex');
const pty = require('node-pty');

const DATA_PATH = path.join(app.getPath('userData'), 'pet-data.json');

let mainWindow = null;
const allWindows = [];
let ptyProcess = null;
let qemuProcess = null;   // QEMU child process
let qemuSocket = null;    // TCP socket to QEMU serial

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
    if (isPrimary) {
      mainWindow = win;
    }
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

/** 获取文件图标（返回 NativeImage 的 Data URL） */
ipcMain.handle('get-file-icon', async (_event, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.toDataURL();
  } catch {
    return null;
  }
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

// ==================== QEMU 虚拟机（Linux 独立虚拟机） ====================

const VM_DIR = path.join(app.getPath('userData'), 'vm');
const ALPINE_ISO_PATH = path.join(VM_DIR, 'alpine-virt.iso');
const DISK_IMAGE_PATH = path.join(VM_DIR, 'alpine.qcow2');
const DISK_SIZE = '4G';
const VM_MEMORY = '512';
const ALPINE_ISO_URL = 'https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/x86_64/alpine-virt-3.21.6-x86_64.iso';

/** 查找 QEMU 可执行文件 */
function findQemu() {
  // 检查 PATH
  try {
    const result = execSync('where.exe qemu-system-x86_64', { timeout: 5000, stdio: 'pipe' });
    return result.toString().trim().split('\n')[0].trim();
  } catch (_) {}

  // 常见安装位置
  const locations = [
    'C:\\Program Files\\qemu\\qemu-system-x86_64.exe',
    'C:\\Program Files (x86)\\qemu\\qemu-system-x86_64.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'qemu', 'qemu-system-x86_64.exe'),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) return loc;
  }
  return null;
}

/** 查找 qemu-img 工具 */
function findQemuImg(qemuPath) {
  if (!qemuPath) return null;
  const dir = path.dirname(qemuPath);
  const imgPath = path.join(dir, 'qemu-img.exe');
  if (fs.existsSync(imgPath)) return imgPath;
  return null;
}

/** 下载文件（支持重定向） */
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.dirname(dest))) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }
    const file = fs.createWriteStream(dest);
    const doRequest = (reqUrl) => {
      const mod = reqUrl.startsWith('https') ? https : http;
      mod.get(reqUrl, (resp) => {
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          resp.resume();
          doRequest(resp.headers.location);
          return;
        }
        if (resp.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${resp.statusCode}`));
          return;
        }
        const total = parseInt(resp.headers['content-length'], 10) || 0;
        let downloaded = 0;
        resp.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && total > 0) {
            onProgress(Math.round((downloaded / total) * 100));
          }
        });
        resp.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (e) => {
        file.close();
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(e);
      });
    };
    doRequest(url);
  });
}

/** 创建磁盘镜像 */
function createDiskImage(qemuImgPath) {
  if (fs.existsSync(DISK_IMAGE_PATH)) return;
  if (!fs.existsSync(VM_DIR)) fs.mkdirSync(VM_DIR, { recursive: true });
  execSync(`"${qemuImgPath}" create -f qcow2 "${DISK_IMAGE_PATH}" ${DISK_SIZE}`, { stdio: 'pipe' });
}

/** 获取 VM 状态信息 */
ipcMain.handle('vm-get-info', async () => {
  const qemuPath = findQemu();
  return {
    qemuInstalled: !!qemuPath,
    qemuPath,
    isoExists: fs.existsSync(ALPINE_ISO_PATH),
    diskExists: fs.existsSync(DISK_IMAGE_PATH),
    vmRunning: !!ptyProcess,
  };
});

/** 安装 QEMU（通过 winget） */
ipcMain.handle('vm-install-qemu', async () => {
  try {
    execSync('winget --version', { timeout: 5000, stdio: 'pipe' });
  } catch (_) {
    return { error: 'winget 不可用，请手动安装 QEMU.\n下载地址: https://qemu.weilnetz.de/w64/' };
  }
  try {
    // 使用 winget 安装 QEMU（需要用户确认）
    const { exec } = require('child_process');
    exec('winget install SoftwareFreedomConservancy.QEMU --accept-package-agreements --accept-source-agreements');
    return { success: true, message: 'QEMU 正在安装中，请等待安装完成后重新启动...' };
  } catch (e) {
    return { error: `安装失败: ${e.message}` };
  }
});

/** 停止 QEMU 虚拟机 */
function killQemu() {
  if (qemuSocket) {
    try { qemuSocket.destroy(); } catch (_) {}
    qemuSocket = null;
  }
  if (qemuProcess) {
    try { qemuProcess.kill(); } catch (_) {}
    qemuProcess = null;
  }
}

/** 查找空闲 TCP 端口 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** 调试日志写入文件 */
const LOG_FILE = path.join(app.getPath('userData'), 'vm-debug.log');
function vmLog(msg) {
  const ts = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`);
}

/** 向所有窗口发送终端数据 */
function sendPtyData(data) {
  for (const win of allWindows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('pty-data', data);
    }
  }
}

/** 向所有窗口发送终端退出事件 */
function sendPtyExit(code) {
  for (const win of allWindows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('pty-exit', code);
    }
  }
}

/** 启动 PTY 进程（QEMU 虚拟机 / WSL 回退） */
ipcMain.handle('pty-spawn', async (_event, cols, rows) => {
  vmLog(`pty-spawn called: cols=${cols} rows=${rows}`);
  try {
    // 如果已有进程，先终止
    if (ptyProcess) {
      try { ptyProcess.kill(); } catch (_) {}
      ptyProcess = null;
    }
    killQemu();

    const qemuPath = findQemu();

    if (qemuPath) {
      // ========== QEMU 真正独立虚拟机模式 ==========
      const qemuImgPath = findQemuImg(qemuPath);

      // 确保 VM 目录存在
      if (!fs.existsSync(VM_DIR)) fs.mkdirSync(VM_DIR, { recursive: true });

      // 下载 Alpine ISO（如果不存在）
      if (!fs.existsSync(ALPINE_ISO_PATH)) {
        sendPtyData('\x1b[33m正在下载 Alpine Linux ISO...\x1b[0m\r\n');
        try {
          await downloadFile(ALPINE_ISO_URL, ALPINE_ISO_PATH, (pct) => {
            sendPtyData(`\r\x1b[33m下载进度: ${pct}%\x1b[0m`);
          });
          sendPtyData('\r\n\x1b[32mISO 下载完成！\x1b[0m\r\n');
        } catch (e) {
          return { error: `下载 Alpine ISO 失败: ${e.message}`, hint: '请检查网络连接' };
        }
      }

      // 创建磁盘镜像（如果不存在）
      if (qemuImgPath && !fs.existsSync(DISK_IMAGE_PATH)) {
        try {
          createDiskImage(qemuImgPath);
        } catch (e) {
          return { error: `创建磁盘镜像失败: ${e.message}` };
        }
      }

      // 找空闲端口用于串口TCP连接
      const serialPort = await findFreePort();

      // 构建 QEMU 命令参数（串口走 TCP）
      const qemuArgs = [
        '-m', VM_MEMORY,
        '-nographic',
        '-serial', `tcp:127.0.0.1:${serialPort},server=on,wait=off`,
        '-boot', 'order=cd',
        '-cdrom', ALPINE_ISO_PATH,
      ];

      // 如果有磁盘镜像，添加硬盘
      if (fs.existsSync(DISK_IMAGE_PATH)) {
        qemuArgs.push('-drive', `file=${DISK_IMAGE_PATH},format=qcow2,if=virtio`);
      }

      // 网络：用户态NAT模式
      qemuArgs.push('-netdev', 'user,id=net0,hostfwd=tcp::2222-:22');
      qemuArgs.push('-device', 'virtio-net-pci,netdev=net0');

      // 尝试硬件加速
      let accel = 'tcg';
      try {
        const whpxCheck = execSync(
          'powershell -NoProfile -Command "(Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform).State"',
          { timeout: 8000, stdio: 'pipe' }
        ).toString().trim();
        if (whpxCheck === 'Enabled') accel = 'whpx,kernel-irqchip=off';
      } catch (_) {}
      qemuArgs.push('-accel', accel);

      sendPtyData('\x1b[33m正在启动 Alpine Linux 虚拟机...\x1b[0m\r\n');
      vmLog(`Spawning QEMU: ${qemuPath} ${qemuArgs.join(' ')}`);

      // 用 child_process.spawn 启动 QEMU（非 PTY，因为 Windows 下 node-pty + QEMU 有兼容问题）
      qemuProcess = spawn(qemuPath, qemuArgs, {
        cwd: VM_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      qemuProcess.on('error', (err) => {
        vmLog(`QEMU error: ${err.message}`);
        sendPtyData(`\r\n\x1b[31mQEMU 启动失败: ${err.message}\x1b[0m\r\n`);
        sendPtyExit(1);
        qemuProcess = null;
      });

      // 注意：Windows 下 child_process.spawn 的 exit 事件可能会误触发
      // （QEMU 进程仍然在运行但 Node 认为它已退出）
      // 因此不在这里调用 sendPtyExit，完全依赖 TCP 串口的 end/error 事件判断 VM 状态
      qemuProcess.on('exit', (code) => {
        vmLog(`QEMU process exit event: code=${code} (ignored - using TCP socket for lifecycle)`);
        qemuProcess = null;
      });

      // 转发 QEMU 的 stderr 到终端（显示启动信息/错误）
      qemuProcess.stderr.on('data', (data) => {
        const text = data.toString();
        // 只转发重要错误信息，忽略常见的 warning
        if (text.includes('error') || text.includes('Error') || text.includes('failed')) {
          sendPtyData(`\x1b[31m${text}\x1b[0m`);
        }
      });

      // 等待 QEMU 启动，然后通过 TCP 连接串口
      vmLog(`Waiting 1.5s before TCP connect to port ${serialPort}`);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 连接 QEMU 串口 TCP
      return new Promise((resolve) => {
        const connectSerial = (retries) => {
          const sock = net.createConnection({ host: '127.0.0.1', port: serialPort }, () => {
            vmLog(`TCP connected to serial port ${serialPort}`);
            qemuSocket = sock;

            // 串口数据 -> 渲染进程（用 Buffer 避免编码问题）
            sock.on('data', (chunk) => {
              const text = chunk.toString('utf-8');
              sendPtyData(text);
            });

            sock.on('end', () => {
              vmLog('TCP serial socket ended - VM disconnected');
              sendPtyData('\r\n\x1b[33m[虚拟机串口已断开]\x1b[0m\r\n');
              sendPtyExit(0);
              qemuSocket = null;
            });

            sock.on('error', (err) => {
              vmLog(`TCP serial socket error: ${err.message}`);
              sendPtyData(`\r\n\x1b[31m串口连接错误: ${err.message}\x1b[0m\r\n`);
              sendPtyExit(1);
              qemuSocket = null;
            });

            sendPtyData('\x1b[32m已连接到 Alpine Linux 虚拟机串口，正在启动...\x1b[0m\r\n');
            // 发送回车触发 login prompt 显示
            setTimeout(() => {
              if (qemuSocket && !qemuSocket.destroyed) {
                qemuSocket.write('\r\n');
              }
            }, 3000);

            resolve({ success: true, shell: 'QEMU Alpine Linux VM', mode: 'qemu' });
          });

          sock.on('error', (connErr) => {
            vmLog(`TCP connect error (retries=${retries}): ${connErr.message}`);
            if (retries > 0) {
              setTimeout(() => connectSerial(retries - 1), 1000);
            } else {
              sendPtyData('\x1b[31m无法连接虚拟机串口\x1b[0m\r\n');
              resolve({ error: '无法连接虚拟机串口', hint: 'QEMU 可能启动失败' });
            }
          });
        };
        connectSerial(10);
      });

    } else {
      // ========== WSL 回退模式 ==========
      const detected = detectShell();

      ptyProcess = pty.spawn(detected.shell, detected.args, {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.HOME || process.env.USERPROFILE,
        env: process.env,
      });

      ptyProcess.onData((data) => { sendPtyData(data); });
      ptyProcess.onExit(({ exitCode }) => {
        sendPtyExit(exitCode);
        ptyProcess = null;
      });

      return {
        success: true,
        shell: detected.name,
        mode: 'wsl-fallback',
        hint: '未检测到 QEMU，使用 WSL 模式。安装 QEMU 可获得独立虚拟机体验。'
      };
    }
  } catch (e) {
    return { error: e.message, hint: '请确保已安装 QEMU 或 WSL' };
  }
});

/** 检测 WSL（WSL 回退用） */
function detectShell() {
  try {
    execSync('wsl.exe --list --quiet', { timeout: 5000, stdio: 'pipe' });
    return { shell: 'wsl.exe', args: [], name: 'WSL' };
  } catch (_) {}
  return { shell: 'powershell.exe', args: ['-NoLogo'], name: 'PowerShell' };
}

/** 渲染进程 -> PTY/VM 写入数据 */
ipcMain.on('pty-write', (_event, data) => {
  if (qemuSocket && !qemuSocket.destroyed) {
    qemuSocket.write(data);
  } else if (ptyProcess) {
    ptyProcess.write(data);
  }
});

/** 调整 PTY 尺寸（仅 WSL 模式有效） */
ipcMain.on('pty-resize', (_event, cols, rows) => {
  if (ptyProcess) {
    try { ptyProcess.resize(cols, rows); } catch (_) {}
  }
});

/** 终止 PTY/VM 进程 */
ipcMain.on('pty-kill', () => {
  killQemu();
  if (ptyProcess) {
    try { ptyProcess.kill(); } catch (_) {}
    ptyProcess = null;
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
  killQemu();
  if (ptyProcess) {
    try { ptyProcess.kill(); } catch (_) {}
    ptyProcess = null;
  }
});
