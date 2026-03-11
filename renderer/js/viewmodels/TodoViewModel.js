/**
 * TodoViewModel - 待办事项视图模型
 * 封装 TodoModel 操作，向视图层提供业务方法
 */
import { Observable } from '../utils/Observable.js';

export class TodoViewModel extends Observable {
  /**
   * @param {import('../models/TodoModel.js').TodoModel} todoModel
   */
  constructor(todoModel) {
    super();
    this.todoModel = todoModel;
    // 转发 items 变化
    this.todoModel.subscribe('items', (items) => {
      this.set('items', items);
    });
    this.set('items', this.todoModel.getAllTodos());
  }

  /** 添加待办 */
  addTodo(text) {
    if (!text || !text.trim()) return null;
    return this.todoModel.addTodo(text.trim());
  }

  /** 切换完成状态 */
  toggleTodo(id) {
    this.todoModel.toggleTodo(id);
  }

  /** 删除待办 */
  deleteTodo(id) {
    this.todoModel.removeTodo(id);
  }

  /** 获取所有待办 */
  getAllTodos() {
    return this.todoModel.getAllTodos();
  }

  /** 获取未完成待办 */
  getPendingTodos() {
    return this.todoModel.getPendingTodos();
  }

  /** 获取随机一条未完成待办（用于气泡显示） */
  getRandomPending() {
    return this.todoModel.getRandomPending();
  }

  toJSON() {
    return this.todoModel.toJSON();
  }
}
