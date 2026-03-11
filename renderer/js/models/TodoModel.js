/**
 * TodoModel - 待办事项数据模型
 */
import { Observable } from '../utils/Observable.js';

/** 待办事项 */
export class TodoItem {
  constructor(id, text, completed = false, createdAt = null) {
    this.id = id;
    this.text = text;
    this.completed = completed;
    this.createdAt = createdAt || new Date().toISOString();
  }

  toJSON() {
    return { id: this.id, text: this.text, completed: this.completed, createdAt: this.createdAt };
  }

  static fromJSON(data) {
    return new TodoItem(data.id, data.text, data.completed, data.createdAt);
  }
}

/** 待办事项列表模型 */
export class TodoModel extends Observable {
  constructor() {
    super();
    this.set('items', []);
  }

  /** 添加待办事项 */
  addTodo(text) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const item = new TodoItem(id, text);
    const items = [...this.get('items'), item];
    this.set('items', items);
    return item;
  }

  /** 删除待办事项 */
  removeTodo(id) {
    const items = this.get('items').filter(t => t.id !== id);
    this.set('items', items);
  }

  /** 切换待办完成状态 */
  toggleTodo(id) {
    const items = this.get('items').map(t => {
      if (t.id === id) {
        return new TodoItem(t.id, t.text, !t.completed, t.createdAt);
      }
      return t;
    });
    this.set('items', items);
  }

  /** 获取所有待办 */
  getAllTodos() {
    return this.get('items') || [];
  }

  /** 获取未完成待办 */
  getPendingTodos() {
    return this.getAllTodos().filter(t => !t.completed);
  }

  /** 获取随机一个未完成待办 */
  getRandomPending() {
    const pending = this.getPendingTodos();
    if (pending.length === 0) return null;
    return pending[Math.floor(Math.random() * pending.length)];
  }

  toJSON() {
    return this.getAllTodos().map(t => t.toJSON());
  }

  /** 从 JSON 恢复 */
  static fromJSON(data) {
    const model = new TodoModel();
    if (Array.isArray(data)) {
      model.set('items', data.map(d => TodoItem.fromJSON(d)));
    }
    return model;
  }
}
