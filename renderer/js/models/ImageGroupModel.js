/**
 * ImageGroupModel - 图片分组模型
 * 管理宠物的多组动画帧
 */
import { Observable } from '../utils/Observable.js';

/** 单个图片分组 */
export class ImageGroup {
  /**
   * @param {string} name - 分组名称
   * @param {string[]} frames - 帧图片 URL 数组（可以是本地路径或 Data URL）
   * @param {number} interval - 帧切换间隔（毫秒）
   */
  constructor(name, frames = [], interval = 200) {
    this.name = name;
    this.frames = frames;
    this.interval = interval;
  }

  toJSON() {
    return { name: this.name, frames: this.frames, interval: this.interval };
  }

  static fromJSON(data) {
    return new ImageGroup(data.name, data.frames || [], data.interval || 200);
  }
}

/** 图片分组注册表 */
export class ImageGroupModel extends Observable {
  constructor() {
    super();
    this._groups = new Map();
    this.set('groupNames', []);
  }

  /** 添加或更新一个分组 */
  addGroup(name, frames, interval = 200) {
    this._groups.set(name, new ImageGroup(name, frames, interval));
    this._updateGroupNames();
  }

  /** 移除分组 */
  removeGroup(name) {
    this._groups.delete(name);
    this._updateGroupNames();
  }

  /** 获取指定分组 */
  getGroup(name) {
    return this._groups.get(name) || null;
  }

  /** 获取所有分组名称 */
  getGroupNames() {
    return Array.from(this._groups.keys());
  }

  /** 获取随机分组 */
  getRandomGroup() {
    const names = this.getGroupNames();
    if (names.length === 0) return null;
    const name = names[Math.floor(Math.random() * names.length)];
    return this._groups.get(name);
  }

  /** 更新分组名称列表（触发通知） */
  _updateGroupNames() {
    this.set('groupNames', this.getGroupNames());
  }

  toJSON() {
    const result = {};
    for (const [name, group] of this._groups) {
      result[name] = group.toJSON();
    }
    return result;
  }

  /** 从 JSON 恢复 */
  static fromJSON(data) {
    const model = new ImageGroupModel();
    if (data && typeof data === 'object') {
      for (const [name, groupData] of Object.entries(data)) {
        const group = ImageGroup.fromJSON(groupData);
        model._groups.set(name, group);
      }
      model._updateGroupNames();
    }
    return model;
  }
}
