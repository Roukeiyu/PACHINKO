// Original pastel icons for 对对碰. Each one differs in silhouette and color.
const svg = (body) => `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
const icon = (id, name, body) => ({ id, name, svg: svg(body) });

export const PAIR_ICON_LIST = Object.freeze([
  icon('strawberry', '草莓', '<path fill="#e24b4b" d="M16 6c6 2 10 8 8 16-2 6-14 6-16 0C6 14 10 8 16 6z"/><path fill="#3f8f4a" d="M12 7l4-4 4 4-2 2h-4z"/><circle cx="13" cy="16" r="1" fill="#fff3c4"/><circle cx="18" cy="14" r="1" fill="#fff3c4"/><circle cx="16" cy="20" r="1" fill="#fff3c4"/>'),
  icon('orange', '橙子', '<circle cx="16" cy="17" r="10" fill="#f39a2e"/><path fill="#3f8f4a" d="M16 6c2 2 2 4 0 5-2-1-2-3 0-5z"/><path fill="#ffe0a8" d="M16 9v16M9 17h14" stroke="#ffe0a8" stroke-width="1"/>'),
  icon('lemon', '柠檬', '<ellipse cx="16" cy="16" rx="12" ry="8" fill="#e6d325" transform="rotate(-25 16 16)"/><ellipse cx="16" cy="16" rx="6" ry="3.5" fill="#fff4a8" transform="rotate(-25 16 16)"/><path fill="#3f8f4a" d="M22 8c2-3 5-3 6-1-3 0-5 1-6 1z"/>'),
  icon('pear', '梨', '<ellipse cx="16" cy="20" rx="8" ry="8" fill="#8fbf4a"/><circle cx="16" cy="11" r="5" fill="#a8d46a"/><path fill="#6b4a2a" d="M16 6v4"/>'),
  icon('grapes', '葡萄', '<circle cx="12" cy="14" r="4" fill="#7b4bb8"/><circle cx="20" cy="14" r="4" fill="#8d5cc8"/><circle cx="16" cy="19" r="4" fill="#6a3aa8"/><circle cx="12" cy="23" r="3.5" fill="#7b4bb8"/><circle cx="20" cy="23" r="3.5" fill="#8d5cc8"/><path fill="#3f8f4a" d="M16 6c3 2 3 5 0 6"/>'),
  icon('watermelon', '西瓜', '<path fill="#ef6d8a" d="M6 12h20l-2 12a8 8 0 0 1-16 0z"/><path fill="#3f8f4a" d="M6 12h20v3H6z"/><circle cx="12" cy="20" r="1.2" fill="#2b2b2b"/><circle cx="17" cy="18" r="1.2" fill="#2b2b2b"/><circle cx="20" cy="22" r="1.2" fill="#2b2b2b"/>'),
  icon('blueberry', '蓝莓', '<circle cx="16" cy="17" r="9" fill="#4c6fd6"/><path fill="#2e4eaa" d="M10 12c2-3 10-3 12 0"/><circle cx="13" cy="16" r="1" fill="#d6e2ff"/><circle cx="18" cy="15" r="1" fill="#d6e2ff"/>'),
  icon('cherry', '樱桃', '<circle cx="11" cy="20" r="6" fill="#8e1d3a"/><circle cx="21" cy="18" r="6" fill="#a82848"/><path fill="none" stroke="#3f8f4a" stroke-width="1.6" d="M11 14c2-8 8-8 10 0"/>'),
  icon('peach', '桃子', '<circle cx="12" cy="18" r="7" fill="#f3a7b5"/><circle cx="20" cy="18" r="7" fill="#f7b7c4"/><path fill="#3f8f4a" d="M16 8c2 2 2 4 0 5"/>'),
  icon('kiwi', '猕猴桃', '<circle cx="16" cy="16" r="10" fill="#c8a15a"/><circle cx="16" cy="16" r="7" fill="#d8e89a"/><circle cx="16" cy="16" r="2" fill="#f4f6d8"/><circle cx="13" cy="14" r=".8" fill="#2b2b2b"/><circle cx="19" cy="14" r=".8" fill="#2b2b2b"/><circle cx="14" cy="19" r=".8" fill="#2b2b2b"/><circle cx="18" cy="19" r=".8" fill="#2b2b2b"/>'),
  icon('banana', '香蕉', '<path fill="#f2c94c" d="M10 8c8 0 12 6 10 16-4 2-8-2-8-8 0-4-2-6-2-8z"/><path fill="#e2b43a" d="M12 10c4 1 6 4 6 10"/>'),
  icon('apple', '苹果', '<path fill="#d63a3a" d="M16 8c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9z"/><path fill="#fff" d="M16 10c-2 3-2 8 0 12 2-4 2-9 0-12z" opacity=".35"/><path fill="#6b4a2a" d="M16 8V4"/><path fill="#3f8f4a" d="M16 5c3 0 5 2 5 2s-2 2-5 1z"/>'),
  icon('rabbit', '兔子', '<ellipse cx="16" cy="20" rx="8" ry="7" fill="#f4c7d4"/><ellipse cx="10" cy="10" rx="3" ry="7" fill="#f4c7d4"/><ellipse cx="22" cy="10" rx="3" ry="7" fill="#f7d5e0"/><circle cx="13" cy="19" r="1.2" fill="#5a3a42"/><circle cx="19" cy="19" r="1.2" fill="#5a3a42"/><ellipse cx="16" cy="22" rx="1.4" ry="1" fill="#e28aa0"/>'),
  icon('cat', '猫咪', '<circle cx="16" cy="18" r="8" fill="#8aa0b8"/><path fill="#8aa0b8" d="M8 12l4 4V10zM24 12l-4 4V10z"/><circle cx="13" cy="17" r="1.2" fill="#243040"/><circle cx="19" cy="17" r="1.2" fill="#243040"/><path fill="#243040" d="M16 19l-1 2h2z"/>'),
  icon('frog', '青蛙', '<ellipse cx="16" cy="20" rx="10" ry="7" fill="#5eae6a"/><circle cx="10" cy="13" r="4" fill="#7bc686"/><circle cx="22" cy="13" r="4" fill="#7bc686"/><circle cx="10" cy="13" r="1.6" fill="#1f3a24"/><circle cx="22" cy="13" r="1.6" fill="#1f3a24"/>'),
  icon('chick', '小鸡', '<circle cx="16" cy="17" r="9" fill="#f6d34d"/><circle cx="12" cy="9" r="3" fill="#f6d34d"/><path fill="#e07a3d" d="M20 17l6 2-6 2z"/><circle cx="13" cy="15" r="1.2" fill="#3a2a22"/>'),
  icon('bear', '小熊', '<circle cx="16" cy="18" r="8" fill="#8a5c3c"/><circle cx="8" cy="10" r="4" fill="#8a5c3c"/><circle cx="24" cy="10" r="4" fill="#8a5c3c"/><ellipse cx="16" cy="20" rx="3" ry="2" fill="#f0d2b4"/><circle cx="13" cy="16" r="1.1" fill="#2b1c14"/><circle cx="19" cy="16" r="1.1" fill="#2b1c14"/>'),
  icon('fox', '狐狸', '<path fill="#e07a3d" d="M6 8l6 8-4 10h16l-4-10 6-8-6 4h-8z"/><path fill="#f6e2c4" d="M12 18h8l-4 6z"/><circle cx="13" cy="16" r="1" fill="#2b1c14"/><circle cx="19" cy="16" r="1" fill="#2b1c14"/>'),
  icon('panda', '熊猫', '<circle cx="16" cy="17" r="9" fill="#f7f4ee" stroke="#3d3d3d" stroke-width="1.4"/><circle cx="8" cy="10" r="4" fill="#3d3d3d"/><circle cx="24" cy="10" r="4" fill="#3d3d3d"/><ellipse cx="12" cy="16" rx="3" ry="3.4" fill="#3d3d3d"/><ellipse cx="20" cy="16" rx="3" ry="3.4" fill="#3d3d3d"/><circle cx="12" cy="16" r="1.1" fill="#fff"/><circle cx="20" cy="16" r="1.1" fill="#fff"/>'),
  icon('duck', '小鸭', '<ellipse cx="15" cy="19" rx="9" ry="7" fill="#f09a3a"/><circle cx="22" cy="14" r="5" fill="#f6b24d"/><path fill="#e07a3d" d="M26 14h5l-3 2z"/><circle cx="23" cy="13" r="1" fill="#3a2a22"/>'),
  icon('candy', '糖果', '<rect x="8" y="12" width="16" height="10" rx="5" fill="#3cbfae"/><path fill="#f7f4ee" d="M8 14h16v3H8z"/><path fill="#2a9d8f" d="M8 15l-5 3 5 3zM24 15l5 3-5 3z"/>'),
  icon('donut', '甜甜圈', '<circle cx="16" cy="16" r="10" fill="#e7a0c4"/><circle cx="16" cy="16" r="4" fill="#fffdf8"/><circle cx="12" cy="12" r="1.2" fill="#f2d23a"/><circle cx="20" cy="13" r="1.2" fill="#7eb6e0"/><circle cx="18" cy="20" r="1.2" fill="#e24b4b"/>'),
  icon('cupcake', '纸杯蛋糕', '<path fill="#c9a0e0" d="M8 16h16l-2 10H10z"/><path fill="#f7c1d8" d="M8 16c0-6 16-6 16 0"/><circle cx="16" cy="12" r="2" fill="#e24b4b"/>'),
  icon('lollipop', '棒棒糖', '<circle cx="16" cy="12" r="8" fill="#d2529a"/><path fill="#fff" d="M16 5a7 7 0 0 1 0 14" opacity=".7"/><rect x="15" y="19" width="2" height="9" rx="1" fill="#f2d23a"/>'),
  icon('cookie', '饼干', '<circle cx="16" cy="16" r="10" fill="#c49255"/><circle cx="12" cy="13" r="1.4" fill="#6b4423"/><circle cx="19" cy="12" r="1.4" fill="#6b4423"/><circle cx="15" cy="19" r="1.4" fill="#6b4423"/><circle cx="21" cy="18" r="1.3" fill="#6b4423"/>'),
  icon('icecream', '冰淇淋', '<path fill="#c49255" d="M12 18l4 10 4-10z"/><circle cx="16" cy="14" r="7" fill="#9fd9c8"/><circle cx="16" cy="12" r="2" fill="#f7f4ee"/>'),
  icon('star', '星星', '<path fill="#e2b43a" d="M16 4l3 7h7l-5.5 4.5L23 24l-7-4-7 4 2.5-8.5L6 11h7z"/>'),
  icon('heart', '爱心', '<path fill="#e2557a" d="M16 27s-9-6-9-13a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13z"/>'),
  icon('bell', '铃铛', '<path fill="#6aa4d8" d="M8 22h16l-2-3V14a6 6 0 0 0-12 0v5z"/><circle cx="16" cy="24" r="2" fill="#3d7eb8"/><rect x="15" y="5" width="2" height="4" fill="#3d7eb8"/>'),
  icon('flower', '小花', '<circle cx="16" cy="10" r="4" fill="#e07ab0"/><circle cx="22" cy="14" r="4" fill="#f0a0c8"/><circle cx="20" cy="21" r="4" fill="#e07ab0"/><circle cx="12" cy="21" r="4" fill="#f0a0c8"/><circle cx="10" cy="14" r="4" fill="#e07ab0"/><circle cx="16" cy="16" r="3" fill="#f2d23a"/>'),
  icon('mushroom', '蘑菇', '<path fill="#d4534a" d="M6 16c0-6 4.5-10 10-10s10 4 10 10z"/><rect x="13" y="16" width="6" height="9" rx="2" fill="#f3e2c8"/><circle cx="12" cy="13" r="1.5" fill="#fff"/><circle cx="18" cy="12" r="1.3" fill="#fff"/>'),
  icon('fish', '小鱼', '<ellipse cx="14" cy="16" rx="9" ry="6" fill="#4aa3c7"/><path fill="#2e86ab" d="M22 16l7-6v12z"/><circle cx="10" cy="15" r="1.3" fill="#16323c"/>'),
]);

export const PAIR_SVG = Object.freeze(Object.fromEntries(PAIR_ICON_LIST.map(icon => [icon.id, icon.svg])));
