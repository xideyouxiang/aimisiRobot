/**
 * PetViewModel - 宠物状态与行为视图模型
 * 管理宠物的位置、动画、拖拽、移动等逻辑
 */
import { Observable } from '../utils/Observable.js';

export class PetViewModel extends Observable {
  /**
   * @param {import('../models/ImageGroupModel.js').ImageGroupModel} imageGroupModel
   */
  constructor(imageGroupModel) {
    super();
    this.imageGroupModel = imageGroupModel;

    // 宠物核心状态
    this.set('x', 300);
    this.set('y', 300);
    this.set('currentGroupName', 'idle');
    this.set('currentFrameIndex', 0);
    this.set('isDragging', false);
    this.set('isFixed', false);
    this.set('isMoving', false);
    this.set('facingLeft', false);
    this.set('movementSpeed', 3);
    this.set('targetX', 0);
    this.set('targetY', 0);
    this.set('petSize', 120);

    // 状态分组映射：不同行为对应的动画分组键
    this.set('idleGroupKey', 'idle');
    this.set('walkGroupKey', 'walk');
    this.set('dragGroupKey', 'drag');
    this.set('clickGroupKey', 'click');
    this.set('fixedGroupKey', 'sleep');

    // 键位绑定 { accelerator: groupKey }
    this.set('keyBindings', {});

    // 气泡设置
    this.set('bubbleEnabled', true);
    this.set('bubbleMinInterval', 20000);
    this.set('bubbleMaxInterval', 60000);
    this.set('bubbleGroupKey', '');

    // ==================== 自主移动 AI ====================
    this.set('autoMoveEnabled', true);     // 是否启用自主移动
    this.set('autoMoveMinIdle', 4000);      // 最小静止时间（ms）
    this.set('autoMoveMaxIdle', 12000);     // 最大静止时间（ms）
    this.set('autoMoveRange', 300);         // 随机移动最大距离（px）
    this._autoMoveTimer = null;
    this._screenWidth = 1920;
    this._screenHeight = 1080;
    this._screenOffsetX = 0;
    this._screenOffsetY = 0;

    // ==================== 心情系统 ====================
    this.set('mood', 'normal');             // normal | happy | sleepy | excited
    this.set('moodLevel', 50);              // 0-100 心情值
    this.set('interactionCount', 0);        // 交互计数

    // ==================== 特殊形态 ====================
    this.set('coolGroupKey', 'cool');        // 酷炫模式分组
    this.set('happyGroupKey', 'happy');      // 开心分组
    this.set('blinkGroupKey', 'blink');      // 眨眼分组

    // ==================== AI 配置 ====================
    this.set('aiApiUrl', '');          // API 地址（如 https://api.openai.com/v1）
    this.set('aiApiKey', '');          // API Key
    this.set('aiModel', 'gpt-3.5-turbo'); // 模型名称
    this.set('aiMaxTokens', 300);     // 最大 token
    this.set('aiSystemPrompt', '');    // 自定义人设（空则用默认）

    // ==================== 桌面教练 ====================
    this.set('coachEnabled', true);    // 是否启用桌面教练提醒

    // ==================== 快捷启动 ====================
    this.set('quickLaunchApps', []);   // [{ name, path }]
    this.set('wechatPath', '');        // 微信路径

    // ==================== 窗口层级 ====================
    this.set('alwaysOnTop', true);     // 是否置顶
    this.set('alwaysOnTopKey', 'Alt+T'); // 切换置顶快捷键

    // 动画时间追踪
    this._lastFrameTime = 0;
    this._moveAnimId = null;
  }

  /** 获取 AI 配置 */
  getAIConfig() {
    return {
      apiUrl: this.get('aiApiUrl'),
      apiKey: this.get('aiApiKey'),
      model: this.get('aiModel'),
      maxTokens: this.get('aiMaxTokens'),
      systemPrompt: this.get('aiSystemPrompt'),
    };
  }

  /** 获取当前图片分组 */
  getCurrentGroup() {
    return this.imageGroupModel.getGroup(this.get('currentGroupName'));
  }

  /** 获取当前帧的图片 URL */
  getCurrentFrameUrl() {
    const group = this.getCurrentGroup();
    if (!group || group.frames.length === 0) return '';
    const index = this.get('currentFrameIndex') % group.frames.length;
    return group.frames[index];
  }

  /** 切换到指定动画分组 */
  switchGroup(groupKey) {
    if (this.imageGroupModel.getGroup(groupKey)) {
      this.set('currentGroupName', groupKey);
      this.set('currentFrameIndex', 0);
      this._lastFrameTime = performance.now();
    }
  }

  /** 推进动画帧（由主循环调用） */
  advanceFrame(now) {
    const group = this.getCurrentGroup();
    if (!group || group.frames.length <= 1) return;

    if (now - this._lastFrameTime >= group.interval) {
      const nextIndex = (this.get('currentFrameIndex') + 1) % group.frames.length;
      this.set('currentFrameIndex', nextIndex);
      this._lastFrameTime = now;
    }
  }

  // ==================== 移动逻辑 ====================

  /** 让宠物移动到目标位置 */
  moveTo(targetX, targetY) {
    if (this.get('isFixed') || this.get('isDragging')) return;
    const size = this.get('petSize');
    const clampedX = Math.max(this._screenOffsetX + size / 2, Math.min(this._screenOffsetX + this._screenWidth - size / 2, targetX));
    const clampedY = Math.max(this._screenOffsetY + size / 2, Math.min(this._screenOffsetY + this._screenHeight - size / 2, targetY));
    this.set('targetX', clampedX);
    this.set('targetY', clampedY);
    this.set('isMoving', true);
    // 判断朝向
    this.set('facingLeft', clampedX < this.get('x'));
    this.switchGroup(this.get('walkGroupKey'));
  }

  /** 更新移动位置（由主循环调用） */
  updateMovement() {
    if (!this.get('isMoving')) return;

    const x = this.get('x');
    const y = this.get('y');
    const tx = this.get('targetX');
    const ty = this.get('targetY');
    const speed = this.get('movementSpeed');

    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const size = this.get('petSize');
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const minX = this._screenOffsetX + size / 2, maxX = this._screenOffsetX + this._screenWidth - size / 2;
    const minY = this._screenOffsetY + size / 2, maxY = this._screenOffsetY + this._screenHeight - size / 2;
    if (dist <= speed) {
      // 到达目标
      this.set('x', clamp(tx, minX, maxX));
      this.set('y', clamp(ty, minY, maxY));
      this.set('isMoving', false);
      this.switchGroup(this.get('idleGroupKey'));
    } else {
      // 按速度向目标移动
      this.set('x', clamp(x + (dx / dist) * speed, minX, maxX));
      this.set('y', clamp(y + (dy / dist) * speed, minY, maxY));
    }
  }

  // ==================== 拖拽逻辑 ====================

  /** 开始拖拽 */
  startDrag() {
    if (this.get('isFixed')) return;
    this.set('isDragging', true);
    this.set('isMoving', false);
    this.switchGroup(this.get('dragGroupKey'));
  }

  /** 拖拽中更新位置 */
  dragTo(x, y) {
    if (!this.get('isDragging')) return;
    const size = this.get('petSize');
    this.set('x', Math.max(this._screenOffsetX + size / 2, Math.min(this._screenOffsetX + this._screenWidth - size / 2, x)));
    this.set('y', Math.max(this._screenOffsetY + size / 2, Math.min(this._screenOffsetY + this._screenHeight - size / 2, y)));
  }

  /** 结束拖拽 */
  endDrag() {
    this.set('isDragging', false);
    this.switchGroup(this.get('idleGroupKey'));
  }

  // ==================== 固定模式 ====================

  /** 固定宠物在当前位置 */
  pin() {
    this.set('isFixed', true);
    this.set('isMoving', false);
    this.set('isDragging', false);
    this.switchGroup(this.get('fixedGroupKey'));
  }

  /** 取消固定 */
  unpin() {
    this.set('isFixed', false);
    this.switchGroup(this.get('idleGroupKey'));
  }

  /** 触发点击反应动画 */
  playClickReaction() {
    // 增加心情值
    this._addInteraction(5);
    this.switchGroup(this.get('clickGroupKey'));
    setTimeout(() => {
      if (!this.get('isDragging') && !this.get('isMoving')) {
        this.switchGroup(this.get('isFixed') ? this.get('fixedGroupKey') : this.get('idleGroupKey'));
      }
    }, 800);
  }

  /** 双击切换酷炫形态 */
  toggleCoolMode() {
    this._addInteraction(10);
    if (this.get('currentGroupName') === this.get('coolGroupKey')) {
      this.switchGroup(this.get('idleGroupKey'));
    } else if (this.imageGroupModel.getGroup(this.get('coolGroupKey'))) {
      this.switchGroup(this.get('coolGroupKey'));
    }
  }

  // ==================== 自主移动 AI ====================

  /** 设置屏幕尺寸（用于边界限制） */
  setScreenSize(w, h, offsetX = 0, offsetY = 0) {
    this._screenWidth = w;
    this._screenHeight = h;
    this._screenOffsetX = offsetX;
    this._screenOffsetY = offsetY;
  }

  /** 启动自主移动定时器 */
  startAutoMove() {
    this._scheduleAutoMove();
  }

  /** 停止自主移动 */
  stopAutoMove() {
    if (this._autoMoveTimer) {
      clearTimeout(this._autoMoveTimer);
      this._autoMoveTimer = null;
    }
  }

  /** 安排下一次自主移动 */
  _scheduleAutoMove() {
    if (this._autoMoveTimer) clearTimeout(this._autoMoveTimer);
    if (!this.get('autoMoveEnabled')) return;

    const min = this.get('autoMoveMinIdle');
    const max = this.get('autoMoveMaxIdle');
    const delay = min + Math.random() * (max - min);

    this._autoMoveTimer = setTimeout(() => {
      this._performAutoMove();
    }, delay);
  }

  /** 执行一次自主移动（随机选择行为） */
  _performAutoMove() {
    if (this.get('isFixed') || this.get('isDragging') || this.get('isMoving')) {
      this._scheduleAutoMove();
      return;
    }

    const action = Math.random();
    const size = this.get('petSize');
    const range = this.get('autoMoveRange');

    if (action < 0.5) {
      // 随机走到附近某个位置
      const cx = this.get('x');
      const cy = this.get('y');
      const nx = Math.max(this._screenOffsetX + size / 2, Math.min(this._screenOffsetX + this._screenWidth - size / 2, cx + (Math.random() - 0.5) * range * 2));
      const ny = Math.max(this._screenOffsetY + size / 2, Math.min(this._screenOffsetY + this._screenHeight - size / 2, cy + (Math.random() - 0.5) * range * 2));
      this.moveTo(nx, ny);

      // 到达后切回待机并安排下次
      const checkArrived = setInterval(() => {
        if (!this.get('isMoving')) {
          clearInterval(checkArrived);
          // 偶尔到达后播放一段特殊动画
          if (Math.random() < 0.3) {
            const specialGroups = ['happy', 'blink', 'cool'];
            const pick = specialGroups[Math.floor(Math.random() * specialGroups.length)];
            if (this.imageGroupModel.getGroup(pick)) {
              this.switchGroup(pick);
              setTimeout(() => {
                if (!this.get('isDragging') && !this.get('isMoving') && !this.get('isFixed')) {
                  this.switchGroup(this.get('idleGroupKey'));
                }
              }, 1500 + Math.random() * 2000);
            }
          }
          this._scheduleAutoMove();
        }
      }, 200);
    } else if (action < 0.75) {
      // 原地播放一段眨眼动画
      const blinkKey = this.get('blinkGroupKey');
      if (this.imageGroupModel.getGroup(blinkKey)) {
        this.switchGroup(blinkKey);
        setTimeout(() => {
          if (!this.get('isDragging') && !this.get('isMoving') && !this.get('isFixed')) {
            this.switchGroup(this.get('idleGroupKey'));
          }
          this._scheduleAutoMove();
        }, 1200);
      } else {
        this._scheduleAutoMove();
      }
    } else {
      // 原地待命，仅重新调度
      this._scheduleAutoMove();
    }
  }

  // ==================== 心情系统 ====================

  /** 增加交互值，更新心情状态 */
  _addInteraction(amount) {
    const count = this.get('interactionCount') + 1;
    this.set('interactionCount', count);

    let mood = Math.min(100, this.get('moodLevel') + amount);
    this.set('moodLevel', mood);

    // 根据心情值确定状态
    if (mood >= 80) {
      this.set('mood', 'excited');
    } else if (mood >= 50) {
      this.set('mood', 'happy');
    } else if (mood <= 20) {
      this.set('mood', 'sleepy');
    } else {
      this.set('mood', 'normal');
    }
  }

  /** 心情自然衰减（在主循环中周期调用） */
  decayMood() {
    const mood = this.get('moodLevel');
    if (mood > 30) {
      this.set('moodLevel', mood - 0.02);
    }
  }

  /** 获取心情表情符号 */
  getMoodEmoji() {
    switch (this.get('mood')) {
      case 'excited': return '🤩';
      case 'happy': return '😊';
      case 'sleepy': return '😴';
      default: return '😐';
    }
  }

  // ==================== 序列化 ====================

  toJSON() {
    return {
      x: this.get('x'),
      y: this.get('y'),
      isFixed: this.get('isFixed'),
      movementSpeed: this.get('movementSpeed'),
      petSize: this.get('petSize'),
      idleGroupKey: this.get('idleGroupKey'),
      walkGroupKey: this.get('walkGroupKey'),
      dragGroupKey: this.get('dragGroupKey'),
      clickGroupKey: this.get('clickGroupKey'),
      fixedGroupKey: this.get('fixedGroupKey'),
      coolGroupKey: this.get('coolGroupKey'),
      happyGroupKey: this.get('happyGroupKey'),
      blinkGroupKey: this.get('blinkGroupKey'),
      keyBindings: this.get('keyBindings'),
      bubbleEnabled: this.get('bubbleEnabled'),
      bubbleMinInterval: this.get('bubbleMinInterval'),
      bubbleMaxInterval: this.get('bubbleMaxInterval'),
      bubbleGroupKey: this.get('bubbleGroupKey'),
      autoMoveEnabled: this.get('autoMoveEnabled'),
      autoMoveMinIdle: this.get('autoMoveMinIdle'),
      autoMoveMaxIdle: this.get('autoMoveMaxIdle'),
      autoMoveRange: this.get('autoMoveRange'),
      moodLevel: this.get('moodLevel'),
      aiApiUrl: this.get('aiApiUrl'),
      aiApiKey: this.get('aiApiKey'),
      aiModel: this.get('aiModel'),
      aiMaxTokens: this.get('aiMaxTokens'),
      aiSystemPrompt: this.get('aiSystemPrompt'),
      coachEnabled: this.get('coachEnabled'),
      quickLaunchApps: this.get('quickLaunchApps'),
      wechatPath: this.get('wechatPath'),
      alwaysOnTop: this.get('alwaysOnTop'),
      alwaysOnTopKey: this.get('alwaysOnTopKey'),
    };
  }

  /** 从存档恢复设置（不覆盖模型引用） */
  loadFromJSON(data) {
    if (!data) return;
    const keys = [
      'x', 'y', 'isFixed', 'movementSpeed', 'petSize',
      'idleGroupKey', 'walkGroupKey', 'dragGroupKey', 'clickGroupKey', 'fixedGroupKey',
      'coolGroupKey', 'happyGroupKey', 'blinkGroupKey',
      'keyBindings', 'bubbleEnabled', 'bubbleMinInterval', 'bubbleMaxInterval', 'bubbleGroupKey',
      'autoMoveEnabled', 'autoMoveMinIdle', 'autoMoveMaxIdle', 'autoMoveRange', 'moodLevel', 'coachEnabled',
      'aiApiUrl', 'aiApiKey', 'aiModel', 'aiMaxTokens', 'aiSystemPrompt',
      'quickLaunchApps', 'wechatPath',
      'alwaysOnTop', 'alwaysOnTopKey'
    ];
    for (const key of keys) {
      if (data[key] !== undefined) {
        this.set(key, data[key]);
      }
    }
    // 初始化分组
    const initGroup = this.get('isFixed') ? this.get('fixedGroupKey') : this.get('idleGroupKey');
    this.switchGroup(initGroup);
  }
}
