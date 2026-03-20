/**
 * PetView - 宠物渲染视图
 * 负责将宠物图片渲染到 DOM，处理拖拽、点击、双击、悬停等 UI 事件
 * 包含点击粒子特效和心情状态栏
 */
export class PetView {
  /**
   * @param {import('../viewmodels/PetViewModel.js').PetViewModel} petVM
   * @param {HTMLElement} container - 宠物容器元素
   */
  constructor(petVM, container, displayOffsetX = 0, displayOffsetY = 0) {
    this.petVM = petVM;
    this.container = container;
    this.imgElement = container.querySelector('.pet-image');
    this.displayOffsetX = displayOffsetX;
    this.displayOffsetY = displayOffsetY;

    // 心情状态栏
    this.moodBar = document.createElement('div');
    this.moodBar.className = 'mood-bar';
    this.moodBar.innerHTML = `
      <span class="mood-emoji"></span>
      <div class="mood-track"><div class="mood-fill"></div></div>
    `;
    this.container.appendChild(this.moodBar);

    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._clickTime = 0;
    this._clickCount = 0;
    this._hoverBounce = false;
    this._petOnScreen = undefined; // 宠物是否在当前显示器上（初始未知）

    this._bindUIEvents();
    this._bindVMSubscriptions();
    this._render();
  }

  // ==================== 数据绑定 ====================

  /** 订阅 ViewModel 变化并更新 DOM */
  _bindVMSubscriptions() {
    // 位置变化
    this.petVM.subscribe('x', () => this._updatePosition());
    this.petVM.subscribe('y', () => this._updatePosition());

    // 帧变化 -> 切换图片
    this.petVM.subscribe('currentFrameIndex', () => this._updateImage());
    this.petVM.subscribe('currentGroupName', () => this._updateImage());

    // 朝向
    this.petVM.subscribe('facingLeft', (facingLeft) => {
      this.imgElement.style.transform = facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
    });

    // 尺寸
    this.petVM.subscribe('petSize', () => this._updateSize());

    // 心情
    this.petVM.subscribe('moodLevel', () => this._updateMoodBar());
    this.petVM.subscribe('mood', () => this._updateMoodBar());
  }

  // ==================== UI 事件绑定 ====================

  _bindUIEvents() {
    // 鼠标进入宠物区域 -> 停止穿透 + 悬停动画
    this.container.addEventListener('mouseenter', () => {
      window.electronAPI.setIgnoreMouseEvents(false);
      this.container.classList.add('pet-hover');
    });

    // 鼠标离开宠物区域 -> 恢复穿透
    this.container.addEventListener('mouseleave', () => {
      this.container.classList.remove('pet-hover');
      if (!this.petVM.get('isDragging')) {
        // 菜单/遮罩层打开时不恢复穿透，否则点击遮罩会穿透到桌面
        const overlay = document.getElementById('menu-overlay');
        if (overlay && overlay.classList.contains('active')) return;
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    });

    // 左键按下 -> 开始拖拽
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const size = this.petVM.get('petSize');
      // 用本地坐标计算偏移（petVM 存全局坐标，减去显示器偏移得本地坐标）
      this._dragOffsetX = e.clientX - (this.petVM.get('x') - this.displayOffsetX) + size / 2;
      this._dragOffsetY = e.clientY - (this.petVM.get('y') - this.displayOffsetY) + size / 2;
      this._dragStartTime = Date.now();
      this._dragMoved = false;
      this.petVM.startDrag();
      window.electronAPI.setIgnoreMouseEvents(false);
    });

    // 全局 mousemove 处理拖拽
    document.addEventListener('mousemove', (e) => {
      if (this.petVM.get('isDragging')) {
        this._dragMoved = true;
        // 本地鼠标坐标加上显示器偏移 = 全局坐标，petVM 存全局
        const newX = e.clientX - this._dragOffsetX + this.petVM.get('petSize') / 2 + this.displayOffsetX;
        const newY = e.clientY - this._dragOffsetY + this.petVM.get('petSize') / 2 + this.displayOffsetY;
        this.petVM.dragTo(newX, newY);
      }
    });

    // 全局 mouseup 结束拖拽
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.petVM.get('isDragging')) {
        const wasDrag = this._dragMoved && (Date.now() - this._dragStartTime > 180);
        this.petVM.endDrag();

        if (!wasDrag) {
          // 短按视为点击
          this._handleClick(e);
        }

        const rect = this.container.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
          window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    });

    // 双击切换酷炫模式
    this.container.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.petVM.toggleCoolMode();
      this._spawnParticles(e.clientX, e.clientY, '⭐');
    });
  }

  /** 处理点击（生成特效粒子） */
  _handleClick(e) {
    this.petVM.playClickReaction();
    const emojis = ['💖', '✨', '💕', '🌟', '💗'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    this._spawnParticles(e.clientX, e.clientY, emoji);
  }

  /** 在指定位置生成飘散粒子特效 */
  _spawnParticles(x, y, emoji) {
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'click-particle';
      particle.textContent = emoji;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      // 随机方向和距离
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 30 + Math.random() * 60;
      particle.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
      document.body.appendChild(particle);
      // 动画结束后移除
      setTimeout(() => particle.remove(), 900);
    }
  }

  // ==================== 渲染方法 ====================

  _render() {
    this._updatePosition();
    this._updateSize();
    this._updateImage();
    this._updateMoodBar();
  }

  _updatePosition() {
    const x = this.petVM.get('x') - this.displayOffsetX;
    const y = this.petVM.get('y') - this.displayOffsetY;
    const size = this.petVM.get('petSize');
    this.container.style.left = `${x - size / 2}px`;
    this.container.style.top = `${y - size / 2}px`;

    // 检测宠物是否在当前显示器范围内`
    const isOnScreen = x > -size && x < window.innerWidth + size &&
                       y > -size && y < window.innerHeight + size;
    if (isOnScreen !== this._petOnScreen) {
      this._petOnScreen = isOnScreen;
      this.container.style.display = isOnScreen ? '' : 'none';
      if (!isOnScreen) {
        // 宠物不在此屏 → 纯穿透（不转发鼠标移动），确保桌面可正常操作
        window.electronAPI.setIgnoreMouseEvents(true);
      } else {
        // 宠物到达此屏 → 恢复转发模式以支持悬浮检测
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }

  _updateSize() {
    const size = this.petVM.get('petSize');
    this.container.style.width = `${size}px`;
    this.container.style.height = `${size}px`;
    this.imgElement.style.width = `${size}px`;
    this.imgElement.style.height = `${size}px`;
  }

  _updateImage() {
    const url = this.petVM.getCurrentFrameUrl();
    if (url) {
      this.imgElement.src = url;
    }
  }

  /** 更新心情状态栏 */
  _updateMoodBar() {
    const level = this.petVM.get('moodLevel');
    const emoji = this.petVM.getMoodEmoji();
    this.moodBar.querySelector('.mood-emoji').textContent = emoji;
    const fill = this.moodBar.querySelector('.mood-fill');
    fill.style.width = `${level}%`;
    // 颜色根据心情变化
    if (level >= 70) fill.style.background = 'linear-gradient(90deg, #FFB6C1, #FF69B4)';
    else if (level >= 40) fill.style.background = 'linear-gradient(90deg, #87CEEB, #4FC3F7)';
    else fill.style.background = 'linear-gradient(90deg, #D3D3D3, #A9A9A9)';
  }
}
