/**
 * CoachService - AI 桌面教练
 * 根据工作时长、待办进度、时间段等条件，周期性推送关怀/激励提示
 */
export class CoachService {
  /**
   * @param {import('../viewmodels/TodoViewModel.js').TodoViewModel} todoVM
   */
  constructor(todoVM) {
    this.todoVM = todoVM;
    this.sessionStartTime = Date.now();
    this.lastBreakReminder = Date.now();
    this.lastCoachTime = 0;
    this._shownKeys = new Set(); // 同类消息在间隔内不重复
  }

  /**
   * 周期性检查，返回一条教练消息或 null
   * 建议每 60 秒调用一次
   */
  check() {
    const now = Date.now();
    // 两条消息之间至少间隔 10 分钟
    if (now - this.lastCoachTime < 10 * 60 * 1000) return null;

    const msg = this._checkWorkDuration(now)
             || this._checkTodoProgress()
             || this._checkTimeOfDay();

    if (msg && !this._shownKeys.has(msg.key)) {
      this.lastCoachTime = now;
      this._shownKeys.add(msg.key);
      return msg.text;
    }
    return null;
  }

  /** 用户确认休息后重置计时 */
  acknowledgeBreak() {
    this.lastBreakReminder = Date.now();
    // 允许后续再次提醒
    this._shownKeys.delete('work_60');
    this._shownKeys.delete('work_120');
    this._shownKeys.delete('work_180');
  }

  // ==================== 内部检测 ====================

  _checkWorkDuration(now) {
    const mins = (now - this.lastBreakReminder) / 60000;
    if (mins >= 180) return { key: 'work_180', text: '已经连续工作 3 小时了，要不要休息一下？🍵' };
    if (mins >= 120) return { key: 'work_120', text: '连续工作 2 小时啦，站起来活动一下吧~ 🏃' };
    if (mins >= 60)  return { key: 'work_60',  text: '已经工作 1 小时了，记得喝口水哦~ 💧' };
    return null;
  }

  _checkTodoProgress() {
    const all = this.todoVM.getAllTodos();
    if (all.length === 0) return null;

    const done = all.filter(t => t.completed).length;
    const pct = Math.round(done / all.length * 100);

    if (pct === 100) return { key: 'todo_100', text: '所有待办都完成啦，今天超厉害！✨' };
    if (pct >= 80)   return { key: 'todo_80',  text: `已经完成 ${pct}% 的待办了，太棒了！🎉` };

    const hour = new Date().getHours();
    if (hour >= 14 && pct < 30 && all.length >= 2) {
      return { key: `todo_low_${pct}`, text: `今天待办只完成了 ${pct}%，要加油哦～ 💪` };
    }
    return null;
  }

  _checkTimeOfDay() {
    const hour = new Date().getHours();
    const sessionMins = (Date.now() - this.sessionStartTime) / 60000;

    // 启动时的问候（仅前 2 分钟内）
    if (sessionMins < 2) {
      if (hour >= 6  && hour < 10) return { key: 'greet_morning',    text: '早上好！新的一天，元气满满地开始吧~ ☀️' };
      if (hour >= 10 && hour < 12) return { key: 'greet_forenoon',   text: '上午好！今天也要元气满满哦~ ☀️' };
      if (hour >= 12 && hour < 14) return { key: 'greet_noon',       text: '中午好！吃过午饭了吗？😋' };
      if (hour >= 14 && hour < 18) return { key: 'greet_afternoon',  text: '下午好！继续加油~ ☕' };
      if (hour >= 18 && hour < 22) return { key: 'greet_evening',    text: '晚上好！辛苦了一天~ 🌆' };
      if (hour >= 22 || hour < 6)  return { key: 'greet_night',      text: '夜深了，注意休息哦~ 🌙' };
    }

    // 深夜持续提醒
    if (hour >= 23 || hour < 5) {
      return { key: 'late_night', text: '已经很晚了，别忘了早点休息哦~ 🌙' };
    }
    return null;
  }
}
