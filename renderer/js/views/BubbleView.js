/**
 * BubbleView - 气泡提示视图
 * 在宠物头顶显示随机待办事项，可点击确认完成
 */
export class BubbleView {
  /**
   * @param {import('../viewmodels/PetViewModel.js').PetViewModel} petVM
   * @param {import('../viewmodels/TodoViewModel.js').TodoViewModel} todoVM
   * @param {HTMLElement} bubbleEl - 气泡 DOM 元素
   */
  constructor(petVM, todoVM, bubbleEl, displayOffsetX = 0, displayOffsetY = 0) {
    this.petVM = petVM;
    this.todoVM = todoVM;
    this.bubbleEl = bubbleEl;
    this.displayOffsetX = displayOffsetX;
    this.displayOffsetY = displayOffsetY;
    this.textEl = bubbleEl.querySelector('.bubble-text');
    this.checkBtn = bubbleEl.querySelector('.bubble-check');

    this._currentTodoId = null;
    this._timer = null;
    this._visible = false;

    this._bindEvents();
    this._scheduleNext();
  }

  /** 绑定气泡点击事件 */
  _bindEvents() {
    // 点击气泡勾选按钮完成待办
    this.checkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._currentTodoId) {
        this.todoVM.toggleTodo(this._currentTodoId);
        this.hide();
      }
    });

    // 点击气泡其他区域隐藏
    this.bubbleEl.addEventListener('click', (e) => {
      if (e.target !== this.checkBtn) {
        this.hide();
      }
    });

    // 鼠标进入气泡区域 -> 停止鼠标穿透
    this.bubbleEl.addEventListener('mouseenter', () => {
      window.electronAPI.setIgnoreMouseEvents(false);
    });
    this.bubbleEl.addEventListener('mouseleave', () => {
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    });
  }

  /** 显示气泡（待办事项） */
  show(todoItem) {
    if (!todoItem) return;
    this._currentTodoId = todoItem.id;
    this.textEl.textContent = todoItem.text;
    this.checkBtn.style.display = '';
    this._showBubble();
  }

  /** 显示纯文本气泡（教练消息等，无勾选按钮） */
  showMessage(text, duration = 8000) {
    if (!text) return;
    this._currentTodoId = null;
    this.textEl.textContent = text;
    this.checkBtn.style.display = 'none';
    this._showBubble(duration);
  }

  /** 内部：显示气泡通用逻辑 */
  _showBubble(duration = 5000) {
    this._updatePosition();
    this.bubbleEl.classList.add('visible');
    this._visible = true;

    // 切换气泡专用动画组（如果设置了）
    const bubbleGroupKey = this.petVM.get('bubbleGroupKey');
    if (bubbleGroupKey && this.petVM.imageGroupModel.getGroup(bubbleGroupKey)) {
      this._prevGroupKey = this.petVM.get('currentGroupName');
      this.petVM.switchGroup(bubbleGroupKey);
    }

    if (this._autoHideTimer) clearTimeout(this._autoHideTimer);
    this._autoHideTimer = setTimeout(() => this.hide(), duration);
  }

  /** 隐藏气泡 */
  hide() {
    this.bubbleEl.classList.remove('visible');
    this._visible = false;
    this._currentTodoId = null;

    // 恢复之前的动画组
    if (this._prevGroupKey) {
      this.petVM.switchGroup(this._prevGroupKey);
      this._prevGroupKey = null;
    }

    this._scheduleNext();
  }

  /** 更新气泡位置（跟随宠物） */
  _updatePosition() {
    const x = this.petVM.get('x') - this.displayOffsetX;
    const y = this.petVM.get('y') - this.displayOffsetY;
    const size = this.petVM.get('petSize');
    this.bubbleEl.style.left = `${x - 10}px`;
    this.bubbleEl.style.top = `${y - size / 2 - 60}px`;
  }

  /** 在主循环中调用以更新位置 */
  update() {
    if (this._visible) {
      this._updatePosition();
    }
  }

  /** 安排下一次气泡显示 */
  _scheduleNext() {
    if (this._timer) clearTimeout(this._timer);
    if (!this.petVM.get('bubbleEnabled')) return;

    const min = this.petVM.get('bubbleMinInterval');
    const max = this.petVM.get('bubbleMaxInterval');
    const delay = min + Math.random() * (max - min);

    this._timer = setTimeout(() => {
      const todo = this.todoVM.getRandomPending();
      if (todo) {
        this.show(todo);
      } else {
        this._scheduleNext();
      }
    }, delay);
  }

  /** 销毁定时器 */
  destroy() {
    if (this._timer) clearTimeout(this._timer);
  }
}
