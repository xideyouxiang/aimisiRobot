/**
 * DefaultPetImages - 从内置 img 目录加载宠物图片并自动分组
 *
 * 图片列表（按文件名排序）：
 *   下载 (1).png - 戴墨镜酷炫造型（特殊形态）
 *   下载 (2).png - 表情1: 微笑
 *   下载 (3).png - 表情2: 眯眼笑
 *   下载 (4).png - 表情3: 开心
 *   下载 (5).png - 表情4: 闭眼
 *   下载 (6).png - 表情5: 睁眼
 *   下载.png     - 表情6: 侧头
 */

/**
 * 加载内置图片并生成默认分组
 * @returns {Promise<Object>} 分组字典 { key: { name, frames[], interval } }
 */
export async function loadDefaultImageGroups() {
  const images = await window.electronAPI.loadBuiltinImages();

  if (!images || images.length === 0) {
    return _fallbackGroups();
  }

  // 按文件名排序后的 Data URL 列表
  const urls = images.map(img => img.dataUrl);

  // 索引映射:
  // 0: 下载 (1).png -> 墨镜特殊
  // 1: 下载 (2).png -> 微笑
  // 2: 下载 (3).png -> 眯眼笑
  // 3: 下载 (4).png -> 开心
  // 4: 下载 (5).png -> 闭眼
  // 5: 下载 (6).png -> 睁眼
  // 6: 下载.png     -> 侧头

  const groups = {};

  // 待机组：日常表情循环
  groups.idle = {
    name: '待机',
    frames: _pick(urls, [1, 5, 3, 2, 1, 6]),
    interval: 1200
  };

  // 行走组：交替表情模拟走路
  groups.walk = {
    name: '行走',
    frames: _pick(urls, [5, 3, 6, 3, 5, 1]),
    interval: 600
  };

  // 拖拽组：墨镜/惊讶
  groups.drag = {
    name: '拖拽',
    frames: _pick(urls, [0, 3, 0]),
    interval: 800
  };

  // 点击反应组
  groups.click = {
    name: '点击',
    frames: _pick(urls, [3, 0, 3]),
    interval: 600
  };

  // 睡觉/固定组
  groups.sleep = {
    name: '睡觉',
    frames: _pick(urls, [4, 2, 4]),
    interval: 1800
  };

  // 酷炫组
  groups.cool = {
    name: '酷炫',
    frames: _pick(urls, [0]),
    interval: 1500
  };

  // 开心组
  groups.happy = {
    name: '开心',
    frames: _pick(urls, [3, 5, 1, 3]),
    interval: 800
  };

  // 眨眼组
  groups.blink = {
    name: '眨眼',
    frames: _pick(urls, [5, 4, 5, 1]),
    interval: 700
  };

  return groups;
}

/** 从 URL 数组安全地选取指定索引 */
function _pick(urls, indices) {
  return indices.map(i => urls[Math.min(i, urls.length - 1)]).filter(Boolean);
}

/** 回退分组（无图片时使用占位符） */
function _fallbackGroups() {
  const placeholder = (color) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="16" fill="${color}" opacity="0.6"/>
      <text x="60" y="66" text-anchor="middle" font-size="40" fill="white">🐾</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };

  return {
    idle:  { name: '待机', frames: [placeholder('#FFB6C1'), placeholder('#FFD1DC')], interval: 500 },
    walk:  { name: '行走', frames: [placeholder('#B0E0E6'), placeholder('#87CEEB')], interval: 200 },
    drag:  { name: '拖拽', frames: [placeholder('#DDA0DD')], interval: 300 },
    click: { name: '点击', frames: [placeholder('#FFD700')], interval: 200 },
    sleep: { name: '睡觉', frames: [placeholder('#E6E6FA')], interval: 800 },
  };
}
