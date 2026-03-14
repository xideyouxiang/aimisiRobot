/**
 * QuickLaunchView - 快捷启动菜单视图
 * 在宠物左侧显示快捷启动栏，支持添加/删除软件快捷方式和微信多开
 */
export class QuickLaunchView {
  /**
   * @param {import('../viewmodels/PetViewModel.js').PetViewModel} petVM
   * @param {HTMLElement} launchEl - 快捷启动容器
   * @param {Function} onSave - 保存回调
   */
  constructor(petVM, launchEl, onSave) {
    this.petVM = petVM;
    this.launchEl = launchEl;
    this.onSave = onSave;
    this._visible = false;

    this.launchEl.addEventListener('mouseenter', () => {
      window.electronAPI.setIgnoreMouseEvents(false);
    });
    this.launchEl.addEventListener('mouseleave', () => {
      if (!this._visible) return;
      // 不要恢复穿透，遮罩层会统一处理
    });
  }

  /** 显示快捷启动菜单（智能定位：优先下方，空间不够则左侧） */
  async show(petX, petY, petSize) {
    this._visible = true;
    await this._render();

    const radialRadius = 210;
    // 渲染后获取实际尺寸
    const menuW = this.launchEl.scrollWidth || 400;
    const menuH = this.launchEl.scrollHeight || 80;

    let mx, my;
    const spaceBelow = window.innerHeight - (petY + radialRadius);

    if (spaceBelow >= menuH + 20) {
      // 下方空间足够：水平居中放在环形菜单下方
      mx = petX - menuW / 2;
      my = petY + radialRadius + 12;
    } else {
      // 下方不够：放到左侧
      mx = petX - radialRadius - menuW - 12;
      my = petY - menuH / 2;
      if (mx < 5) {
        // 左侧也不够，放右侧
        mx = petX + radialRadius + 12;
      }
    }

    mx = Math.max(5, Math.min(window.innerWidth - menuW - 5, mx));
    my = Math.max(5, Math.min(window.innerHeight - menuH - 5, my));

    this.launchEl.style.left = `${mx}px`;
    this.launchEl.style.top = `${my}px`;
    this.launchEl.classList.add('visible');
    window.electronAPI.setIgnoreMouseEvents(false);
  }

  hide() {
    this._visible = false;
    this.launchEl.classList.remove('visible');
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  }

  async toggle(petX, petY, petSize) {
    if (this._visible) {
      this.hide();
    } else {
      await this.show(petX, petY, petSize);
    }
  }

  async _render() {
    const apps = this.petVM.get('quickLaunchApps') || [];
    const wechatPath = this.petVM.get('wechatPath') || '';

    // 异步获取所有应用图标
    const icons = await Promise.all(
      apps.map(app => this._getIconDataUrl(app.path))
    );
    const wechatIcon = wechatPath ? await this._getIconDataUrl(wechatPath) : null;

    this.launchEl.innerHTML = `
      <div class="ql-dock">
        ${apps.map((app, i) => `
          <div class="ql-dock-item" data-index="${i}" title="${this._escapeHtml(app.name)}\n${this._escapeHtml(app.path)}">
            <img class="ql-dock-icon" src="${icons[i] || ''}" alt="" draggable="false" />
            <span class="ql-dock-label">${this._escapeHtml(app.name)}</span>
            <span class="ql-dock-remove" data-index="${i}">✕</span>
          </div>
        `).join('')}
        ${wechatPath ? `
          <div class="ql-dock-sep"></div>
          <div class="ql-dock-item" data-action="wechat" title="启动新微信">
            <img class="ql-dock-icon" src="${wechatIcon || ''}" alt="" draggable="false" />
            <span class="ql-dock-label">微信多开</span>
          </div>
        ` : ''}
        <div class="ql-dock-sep"></div>
        <div class="ql-dock-item ql-dock-add" data-action="add" title="添加软件">
          <span class="ql-dock-icon-emoji">➕</span>
          <span class="ql-dock-label">添加</span>
        </div>
        <div class="ql-dock-item ql-dock-add" data-action="wechat-path" title="${wechatPath ? '更换微信路径' : '设置微信路径'}">
          <span class="ql-dock-icon-emoji">💬</span>
          <span class="ql-dock-label">${wechatPath ? '换微信' : '设微信'}</span>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // 点击启动应用
    this.launchEl.querySelectorAll('.ql-dock-item[data-index]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('ql-dock-remove')) return;
        const apps = this.petVM.get('quickLaunchApps') || [];
        const index = parseInt(el.dataset.index);
        if (apps[index]) {
          window.electronAPI.launchApp(apps[index].path);
        }
      });
    });

    // 移除应用
    this.launchEl.querySelectorAll('.ql-dock-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const apps = [...(this.petVM.get('quickLaunchApps') || [])];
        apps.splice(parseInt(el.dataset.index), 1);
        this.petVM.set('quickLaunchApps', apps);
        this.onSave();
        this._render();
      });
    });

    // 添加软件
    const addBtn = this.launchEl.querySelector('[data-action="add"]');
    if (addBtn) addBtn.addEventListener('click', async () => {
      const exePath = await window.electronAPI.selectExe();
      if (!exePath) return;
      const name = this._getFileName(exePath);
      const apps = [...(this.petVM.get('quickLaunchApps') || []), { name, path: exePath }];
      this.petVM.set('quickLaunchApps', apps);
      this.onSave();
      this._render();
    });

    // 设置/更换微信路径
    const wpBtn = this.launchEl.querySelector('[data-action="wechat-path"]');
    if (wpBtn) wpBtn.addEventListener('click', async () => {
      const exePath = await window.electronAPI.selectExe();
      if (!exePath) return;
      this.petVM.set('wechatPath', exePath);
      this.onSave();
      this._render();
    });

    // 微信多开
    const wcBtn = this.launchEl.querySelector('[data-action="wechat"]');
    if (wcBtn) wcBtn.addEventListener('click', () => {
      const wechatPath = this.petVM.get('wechatPath');
      if (wechatPath) {
        window.electronAPI.launchWechatMulti(wechatPath);
      }
    });
  }

  /** 获取文件图标 DataURL（带缓存） */
  async _getIconDataUrl(filePath) {
    if (!filePath) return null;
    if (!this._iconCache) this._iconCache = {};
    if (this._iconCache[filePath]) return this._iconCache[filePath];
    try {
      const dataUrl = await window.electronAPI.getFileIcon(filePath);
      if (dataUrl) this._iconCache[filePath] = dataUrl;
      return dataUrl;
    } catch {
      return null;
    }
  }

  _getFileName(filePath) {
    return filePath.replace(/\\/g, '/').split('/').pop().replace(/\.\w+$/, '');
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
