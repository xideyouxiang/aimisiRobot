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

  /** 显示快捷启动菜单（自动避开右键菜单） */
  show(petX, petY, petSize) {
    this._visible = true;
    this._render();

    const menuW = 180;
    const menuH = this.launchEl.scrollHeight || 300;
    const spaceLeft = petX - petSize / 2;
    const spaceRight = window.innerWidth - (petX + petSize / 2);
    const ctxMenuW = 260;

    let mx, my;

    if (spaceLeft >= menuW + 16) {
      // 左侧空间足够
      mx = petX - petSize / 2 - menuW - 12;
    } else if (spaceRight >= menuW + ctxMenuW + 32) {
      // 左侧不够但右侧能放两个菜单 — 放到右键菜单更右侧
      mx = petX + petSize / 2 + ctxMenuW + 24;
    } else {
      // 都紧张，放在宠物上方或下方（左对齐）
      mx = Math.max(10, petX - menuW / 2);
      mx = Math.min(mx, window.innerWidth - menuW - 10);
    }

    my = petY - menuH / 2;
    my = Math.max(10, Math.min(window.innerHeight - menuH - 10, my));

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

  toggle(petX, petY, petSize) {
    if (this._visible) {
      this.hide();
    } else {
      this.show(petX, petY, petSize);
    }
  }

  _render() {
    const apps = this.petVM.get('quickLaunchApps') || [];
    const wechatPath = this.petVM.get('wechatPath') || '';

    this.launchEl.innerHTML = `
      <div class="ql-title">🚀 快捷启动</div>
      <div class="ql-list">
        ${apps.map((app, i) => `
          <div class="ql-item" data-index="${i}" title="${this._escapeHtml(app.path)}">
            <span class="ql-icon">📄</span>
            <span class="ql-name">${this._escapeHtml(app.name)}</span>
            <span class="ql-remove" data-index="${i}" title="移除">✕</span>
          </div>
        `).join('')}
        ${apps.length === 0 ? '<div class="ql-empty">暂无快捷方式</div>' : ''}
      </div>
      <div class="ql-divider"></div>
      <div class="ql-item ql-action" data-action="add">
        <span class="ql-icon">➕</span>
        <span class="ql-name">添加软件</span>
      </div>
      <div class="ql-divider"></div>
      <div class="ql-section-title">💬 微信多开</div>
      <div class="ql-wechat-path">
        <span class="ql-wechat-text">${wechatPath ? this._escapeHtml(this._getFileName(wechatPath)) : '未设置路径'}</span>
        <span class="ql-wechat-browse" title="选择微信路径">📂</span>
      </div>
      <div class="ql-item ql-action ql-wechat-btn" data-action="wechat" ${!wechatPath ? 'style="opacity: 0.5"' : ''}>
        <span class="ql-icon">💬</span>
        <span class="ql-name">启动新微信</span>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // 点击启动应用
    this.launchEl.querySelectorAll('.ql-item[data-index]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('ql-remove')) return;
        const apps = this.petVM.get('quickLaunchApps') || [];
        const index = parseInt(el.dataset.index);
        if (apps[index]) {
          window.electronAPI.launchApp(apps[index].path);
        }
      });
    });

    // 移除应用
    this.launchEl.querySelectorAll('.ql-remove').forEach(el => {
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
    this.launchEl.querySelector('[data-action="add"]').addEventListener('click', async () => {
      const exePath = await window.electronAPI.selectExe();
      if (!exePath) return;
      const name = this._getFileName(exePath);
      const apps = [...(this.petVM.get('quickLaunchApps') || []), { name, path: exePath }];
      this.petVM.set('quickLaunchApps', apps);
      this.onSave();
      this._render();
    });

    // 选择微信路径
    this.launchEl.querySelector('.ql-wechat-browse').addEventListener('click', async () => {
      const exePath = await window.electronAPI.selectExe();
      if (!exePath) return;
      this.petVM.set('wechatPath', exePath);
      this.onSave();
      this._render();
    });

    // 微信多开
    this.launchEl.querySelector('[data-action="wechat"]').addEventListener('click', () => {
      const wechatPath = this.petVM.get('wechatPath');
      if (wechatPath) {
        window.electronAPI.launchWechatMulti(wechatPath);
      }
    });
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
