/**
 * app.js - 应用入口引导
 * 初始化所有 Model / ViewModel / View，启动主循环
 */
import { TodoModel } from './models/TodoModel.js';
import { ImageGroupModel } from './models/ImageGroupModel.js';
import { PetViewModel } from './viewmodels/PetViewModel.js';
import { TodoViewModel } from './viewmodels/TodoViewModel.js';
import { PetView } from './views/PetView.js';
import { BubbleView } from './views/BubbleView.js';
import { ContextMenuView } from './views/ContextMenuView.js';
import { ChatView } from './views/ChatView.js';
import { QuickLaunchView } from './views/QuickLaunchView.js';
import { loadDefaultImageGroups } from './defaults/DefaultPetImages.js';
import { CoachService } from './utils/CoachService.js';

class App {
  /**
   * @param {{ isSecondary?: boolean, displayOffsetX?: number, displayOffsetY?: number }} options
   */
  constructor({ isSecondary = false, displayOffsetX = 0, displayOffsetY = 0 } = {}) {
    this.isSecondary = isSecondary;
    this.displayOffsetX = displayOffsetX;
    this.displayOffsetY = displayOffsetY;
    this.imageGroupModel = null;
    this.todoModel = null;
    this.petVM = null;
    this.todoVM = null;
    this.petView = null;
    this.bubbleView = null;
    this.contextMenuView = null;
    this.chatView = null;
    this.quickLaunchView = null;
    this.coachService = null;
  }

  async init() {
    // 1) 加载持久化数据
    const savedData = await window.electronAPI.loadData();

    // 2) 始终从 img 目录加载内置图片（确保使用最新图片资源）
    this.imageGroupModel = new ImageGroupModel();
    const defaults = await loadDefaultImageGroups();
    for (const [key, groupData] of Object.entries(defaults)) {
      this.imageGroupModel.addGroup(key, groupData.frames, groupData.interval);
    }

    if (savedData && savedData.todos) {
      this.todoModel = TodoModel.fromJSON(savedData.todos);
    } else {
      this.todoModel = new TodoModel();
    }

    // 3) 初始化 ViewModel
    this.petVM = new PetViewModel(this.imageGroupModel);
    this.todoVM = new TodoViewModel(this.todoModel);

    // 恢复宠物设置
    if (savedData && savedData.pet) {
      this.petVM.loadFromJSON(savedData.pet);
    } else {
      // 默认在主显示器居中靠下
      const screenSize = await window.electronAPI.getScreenSize();
      const pX = screenSize.primaryX || 0;
      const pY = screenSize.primaryY || 0;
      this.petVM.set('x', pX + (screenSize.primaryWidth || screenSize.width) / 2);
      this.petVM.set('y', pY + (screenSize.primaryHeight || screenSize.height) - 150);
      this.petVM.switchGroup('idle');
    }

    // 设置虚拟屏幕尺寸（包含多显示器空间）供自主移动使用
    const screenSize = await window.electronAPI.getScreenSize();
    const offX = screenSize.offsetX || 0;
    const offY = screenSize.offsetY || 0;
    this.petVM.setScreenSize(screenSize.width, screenSize.height, offX, offY);

    // 保存主屏边界，用于副屏中继事件坐标转换
    this._primaryOffsetX = screenSize.primaryX || 0;
    this._primaryOffsetY = screenSize.primaryY || 0;
    this._primaryWidth = screenSize.primaryWidth || screenSize.width;
    this._primaryHeight = screenSize.primaryHeight || screenSize.height;

    // 确保宠物位置在虚拟屏幕范围内
    const halfSize = this.petVM.get('petSize') / 2;
    const cx = Math.max(offX + halfSize, Math.min(offX + screenSize.width - halfSize, this.petVM.get('x')));
    const cy = Math.max(offY + halfSize, Math.min(offY + screenSize.height - halfSize, this.petVM.get('y')));
    this.petVM.set('x', cx);
    this.petVM.set('y', cy);

    // 4) 初始化 View
    const petContainer = document.getElementById('pet-container');
    const bubbleEl = document.getElementById('bubble');
    const menuEl = document.getElementById('context-menu');

    this.petView = new PetView(this.petVM, petContainer, this.displayOffsetX, this.displayOffsetY);
    this.bubbleView = new BubbleView(this.petVM, this.todoVM, bubbleEl, this.displayOffsetX, this.displayOffsetY);
    this.contextMenuView = new ContextMenuView(
      this.petVM, this.todoVM, this.imageGroupModel, menuEl, () => this.save(),
      this.displayOffsetX, this.displayOffsetY
    );

    // 聊天视图
    const chatEl = document.getElementById('chat-panel');
    this.chatView = new ChatView(this.petVM, chatEl, this.displayOffsetX, this.displayOffsetY);
    this.contextMenuView.setOnOpenChat(() => this.chatView.toggle());

    // 快捷启动视图
    const quickLaunchEl = document.getElementById('quick-launch');
    this.quickLaunchView = new QuickLaunchView(this.petVM, quickLaunchEl, () => this.save());

    // 5) 全局右键菜单
    petContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.contextMenuView.show(e.clientX, e.clientY);
      // 同时显示快捷启动菜单在宠物左侧（使用本地坐标）
      const localPetX = this.petVM.get('x') - this.displayOffsetX;
      const localPetY = this.petVM.get('y') - this.displayOffsetY;
      const petSize = this.petVM.get('petSize');
      this.quickLaunchView.show(localPetX, localPetY, petSize);
    });

    // 5.5) 文件拖拽到宠物
    // 全局 dragover 需要阻止默认行为才能接收 drop
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
    });

    petContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.electronAPI.setIgnoreMouseEvents(false);
      petContainer.classList.add('pet-dragover');
    });
    petContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      petContainer.classList.remove('pet-dragover');
    });
    petContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      petContainer.classList.remove('pet-dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const filePath = files[0].path;
        if (filePath) {
          this.contextMenuView.showFileActions(filePath);
        }
      }
    });

    // 6) 全局左键点击 - 宠物向点击位置移动
    document.addEventListener('click', (e) => {
      // 排除菜单、气泡、宠物区域内的点击
      const menuEl = document.getElementById('context-menu');
      if (menuEl.contains(e.target) || menuEl.classList.contains('visible')) return;
      if (document.getElementById('pet-container').contains(e.target)) return;
      if (document.getElementById('bubble').contains(e.target)) return;

      // 确保鼠标穿透已关闭时才触发（即宠物附近点击时）
      if (!this.petVM.get('isDragging') && !this.petVM.get('isFixed')) {
        const halfSize = this.petVM.get('petSize') / 2;
        // 宠物不在当前显示器上时不触发移动（避免副屏宠物跳到主屏）
        const petLocalX = this.petVM.get('x') - this.displayOffsetX;
        const petLocalY = this.petVM.get('y') - this.displayOffsetY;
        if (petLocalX < -halfSize || petLocalX > window.innerWidth + halfSize ||
            petLocalY < -halfSize || petLocalY > window.innerHeight + halfSize) {
          return;
        }
        // 本地坐标 + 显示器偏移 = 全局坐标
        this.petVM.moveTo(
          e.clientX + this.displayOffsetX,
          e.clientY + this.displayOffsetY - halfSize
        );
      }
    });

    // 7) 注册键位绑定（仅主屏）
    if (!this.isSecondary) {
      this._registerKeyBindings();
    }

    // 处理来自副屏的用户输入（拖拽、右键菜单、点击）
    this._relayDragOffX = 0;
    this._relayDragOffY = 0;
    this._primaryOffsetX = this.displayOffsetX;
    this._primaryOffsetY = this.displayOffsetY;
    if (!this.isSecondary) {
      window.electronAPI.onRelayedInput((type, x, y) => {
        if (type === 'sync_pos') {
          // 副屏拖拽结束后同步最终位置
          this.petVM.set('x', x);
          this.petVM.set('y', y);
          this.petVM.endDrag && this.petVM.endDrag();
          return;
        }
      });
    }

    // 8) 副屏模式初始化（接收主屏广播、同步位置）
    if (this.isSecondary) {
      this._initSecondaryMode();
    }

    // 初始化置顶状态（确保与存档一致），默认置顶
    window.electronAPI.setAlwaysOnTop(this.petVM.get('alwaysOnTop') !== false);

    // 监听快捷键触发
    window.electronAPI.onShortcutTriggered((groupKey) => {
      if (groupKey === '__toggle_layer__') {
        const newVal = !this.petVM.get('alwaysOnTop');
        this.petVM.set('alwaysOnTop', newVal);
        window.electronAPI.setAlwaysOnTop(newVal);
        this.save();
        return;
      }
      if (this.imageGroupModel.getGroup(groupKey)) {
        this.petVM.switchGroup(groupKey);
      }
    });

    // 8b) 启动主循环
    this._startMainLoop();

    // 9) 启动自主移动 AI（仅主屏）
    if (!this.isSecondary && this.petVM.get('autoMoveEnabled')) {
      this.petVM.startAutoMove();
    }

    // 10) 心情自然衰减定时器
    setInterval(() => this.petVM.decayMood(), 500);

    // 11) 桌面教练（仅主屏）
    if (!this.isSecondary) {
      this.coachService = new CoachService(this.todoVM);
      this._startCoachTimer();
    }

    console.log(`桌面宠物已启动 🐾 [${this.isSecondary ? '副屏' : '主屏'} offset=${this.displayOffsetX},${this.displayOffsetY}]`);
  }

  /** 副屏模式：接收主屏广播同步状态，拖拽结束后回传最终位置 */
  _initSecondaryMode() {
    // 禁用自主移动
    this.petVM.set('autoMoveEnabled', false);
    this.petVM.stopAutoMove();

    // 接收主屏广播，同步宠物位置/朝向/动画分组
    window.electronAPI.onPetState((state) => {
      // 拖拽中或自己正在移动时，不被主屏广播覆盖位置
      if (!this.petVM.get('isDragging') && !this.petVM.get('isMoving')) {
        this.petVM.set('x', state.x);
        this.petVM.set('y', state.y);
      }
      this.petVM.set('petSize', state.size);
      this.petVM.set('facingLeft', state.facingLeft);
      // 同步动画分组（行走/待机等）
      if (state.groupName && !this.petVM.get('isDragging') && !this.petVM.get('isMoving') &&
          state.groupName !== this.petVM.get('currentGroupName')) {
        this.petVM.switchGroup(state.groupName);
      }
    });

    // 副屏移动到移动结束时，将最终位置同步回主屏
    this.petVM.subscribe('isMoving', (isMoving) => {
      if (!isMoving) {
        window.electronAPI.relayInput('sync_pos',
          this.petVM.get('x'),
          this.petVM.get('y')
        );
      }
    });

    // 拖拽结束后将最终位置同步回主屏
    const origEndDrag = this.petVM.endDrag.bind(this.petVM);
    this.petVM.endDrag = () => {
      origEndDrag();
      window.electronAPI.relayInput('sync_pos',
        this.petVM.get('x'),
        this.petVM.get('y')
      );
    };
  }

  /** 注册所有快捷键绑定 */
  _registerKeyBindings() {
    window.electronAPI.unregisterAllShortcuts();
    const bindings = this.petVM.get('keyBindings') || {};
    for (const [accel, groupKey] of Object.entries(bindings)) {
      window.electronAPI.registerShortcut(accel, groupKey);
    }
    // 注册置顶切换快捷键
    const layerKey = this.petVM.get('alwaysOnTopKey');
    if (layerKey) {
      window.electronAPI.registerShortcut(layerKey, '__toggle_layer__');
    }
  }

  /** 主动画循环 */
  _startMainLoop() {
    const loop = (now) => {
      // 推进帧
      this.petVM.advanceFrame(now);
      // 更新移动
      this.petVM.updateMovement();
      // 更新气泡位置
      this.bubbleView.update();
      // 仅主屏向副屏广播宠物状态（避免广播风暴）
      if (!this.isSecondary) {
        window.electronAPI.broadcastPetState({
          x: this.petVM.get('x'),
          y: this.petVM.get('y'),
          size: this.petVM.get('petSize'),
          frameUrl: this.petVM.getCurrentFrameUrl(),
          facingLeft: this.petVM.get('facingLeft'),
          groupName: this.petVM.get('currentGroupName')
        });
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** 桌面教练定时检测 */
  _startCoachTimer() {
    // 首次 5 秒后检测（用于启动时问候）
    setTimeout(() => this._coachTick(), 5000);
    // 之后每 60 秒检测一次
    setInterval(() => this._coachTick(), 60000);
  }

  _coachTick() {
    if (!this.coachService) return;
    if (!this.petVM.get('coachEnabled')) return;
    const msg = this.coachService.check();
    if (msg) {
      this.bubbleView.showMessage(msg, 8000);
    }
  }

  /** 保存所有数据到本地 */
  async save() {
    const data = {
      pet: this.petVM.toJSON(),
      todos: this.todoVM.toJSON()
    };
    await window.electronAPI.saveData(data);
  }
}

// ===================== 启动 =====================
const urlParams = new URLSearchParams(window.location.search);
const appRole = urlParams.get('role') || 'primary';

if (appRole === 'secondary') {
  const dx = parseInt(urlParams.get('dx') || '0');
  const dy = parseInt(urlParams.get('dy') || '0');
  // 副屏也运行完整 App，传入显示器偏移量
  const app = new App({ isSecondary: true, displayOffsetX: dx, displayOffsetY: dy });
  app.init().catch(err => console.error('副屏启动失败:', err));
  setInterval(() => app.save(), 30000);
} else {
  const app = new App();
  app.init().catch(err => console.error('启动失败:', err));
  // 定期自动保存
  setInterval(() => app.save(), 30000);
}

