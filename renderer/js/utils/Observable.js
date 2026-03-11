/**
 * Observable - MVVM数据绑定基类
 * 提供属性的响应式监听能力，当属性变化时自动通知订阅者
 */
export class Observable {
  constructor() {
    this._data = {};
    this._listeners = {};
  }

  /** 获取属性值 */
  get(prop) {
    return this._data[prop];
  }

  /** 设置属性值，值变化时通知订阅者 */
  set(prop, value) {
    const oldValue = this._data[prop];
    this._data[prop] = value;
    if (oldValue !== value) {
      this._notify(prop, value, oldValue);
    }
  }

  /** 批量设置多个属性 */
  setMany(obj) {
    for (const [prop, value] of Object.entries(obj)) {
      this.set(prop, value);
    }
  }

  /**
   * 订阅属性变化
   * @param {string} prop - 属性名，'*' 表示监听所有变化
   * @param {Function} callback - 回调函数 (newVal, oldVal) 或 (prop, newVal, oldVal) for '*'
   * @returns {Function} 取消订阅函数
   */
  subscribe(prop, callback) {
    if (!this._listeners[prop]) {
      this._listeners[prop] = [];
    }
    this._listeners[prop].push(callback);
    return () => {
      this._listeners[prop] = this._listeners[prop].filter(cb => cb !== callback);
    };
  }

  /** 通知订阅者 */
  _notify(prop, newVal, oldVal) {
    const propListeners = this._listeners[prop];
    if (propListeners) {
      propListeners.forEach(cb => cb(newVal, oldVal));
    }
    // 通知通配符监听者
    const wildcard = this._listeners['*'];
    if (wildcard) {
      wildcard.forEach(cb => cb(prop, newVal, oldVal));
    }
  }
}
