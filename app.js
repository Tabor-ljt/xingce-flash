/* ============ 上岸闪记 · 行测题眼速记 ============ */
'use strict';

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function todayStr() { return fmtDate(new Date()); }
function addDays(ds, n) { const [y, m, d] = ds.split('-').map(Number); return fmtDate(new Date(y, m - 1, d + n)); }
function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }
function cleanFront(s) { return String(s).replace(/^(题眼场景|考向\/题眼|考向)：/, ''); }
function cleanBack(s) { return String(s).replace(/^(解法|答案要点)：/, ''); }

/* ---------- 数据索引 ---------- */
const DB = window.XINGCE_DB || { modules: [] };
const CARDS = [];
const CARD_BY_ID = {};
DB.modules.forEach(m => m.topics.forEach(t => t.cards.forEach(c => {
  c.moduleId = m.moduleId; c.moduleName = m.moduleName; c.moduleIcon = m.icon;
  c.topicId = t.id; c.topicName = t.name; c.section = t.section || '';
  CARDS.push(c); CARD_BY_ID[c.id] = c;
})));
const TOTAL = CARDS.length;

/* ---------- 进度存储 ---------- */
const STORE_KEY = 'xingce_flash_v1';
let progress = null;
function defaultProgress() {
  return { v: 1, cards: {}, stats: { streak: 0, lastDay: '', totalReviews: 0, days: {}, since: todayStr() }, best: {}, settings: { theme: 'auto' } };
}
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const p = JSON.parse(raw); if (p && p.v === 1) return p; }
  } catch (e) { }
  return defaultProgress();
}
function saveProgress() { try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { } }
progress = loadProgress();

/* ---------- 间隔重复（Leitner 简化） ---------- */
const INTERVALS = [0, 1, 2, 4, 7, 15]; // box 1~5 对应间隔天数
function cardState(id) { return progress.cards[id] || { box: 0, next: '', reps: 0, lapses: 0, last: '' }; }
function isDue(id, t) { const st = progress.cards[id]; return !!(st && st.next && st.next <= t); }
function isMastered(id) { return cardState(id).box >= 3; }
function cardStatus(id, t) {
  const st = progress.cards[id];
  if (!st || st.reps === 0) return 'new';
  if (st.box >= 3) return 'mastered';
  if (st.next && st.next <= t) return 'due';
  return 'learning';
}
function gradeCard(id, grade) {
  const st = cardState(id); const t = todayStr();
  st.reps += 1;
  if (grade === 'again') { st.box = 0; st.next = t; st.lapses += 1; }
  else if (grade === 'hard') { st.box = Math.max(1, st.box); st.next = addDays(t, 1); }
  else if (grade === 'good') { st.box = Math.min(5, st.box + 1); st.next = addDays(t, INTERVALS[st.box]); }
  else if (grade === 'easy') { st.box = Math.min(5, st.box + 2); st.next = addDays(t, INTERVALS[st.box] + 1); }
  st.last = t;
  progress.cards[id] = st;
  progress.stats.totalReviews += 1;
  saveProgress();
  markStudy();
}
function markStudy() {
  const t = todayStr(); const s = progress.stats;
  if (s.lastDay !== t) {
    s.streak = (s.lastDay === addDays(t, -1)) ? s.streak + 1 : 1;
    s.lastDay = t;
  }
  s.days[t] = (s.days[t] || 0) + 1;
  saveProgress();
}
function dueCards() { const t = todayStr(); return CARDS.filter(c => isDue(c.id, t)); }
function newCards() { return CARDS.filter(c => !progress.cards[c.id] || progress.cards[c.id].reps === 0); }
function masteredCount() { return CARDS.filter(c => isMastered(c.id)).length; }

/* ---------- 范围（Scope） ---------- */
function scopeKey(sc) { return sc.type === 'all' ? 'all' : sc.type === 'module' ? sc.moduleId : sc.moduleId + '/' + sc.topicId; }
function scopeName(sc) {
  if (sc.type === 'all') return '全部题库';
  const m = DB.modules.find(x => x.moduleId === sc.moduleId);
  if (sc.type === 'module') return m ? m.moduleName : '';
  const t = m && m.topics.find(x => x.id === sc.topicId);
  return t ? m.moduleName + ' · ' + t.name : '';
}
function scopeCards(sc) {
  if (sc.type === 'all') return CARDS.slice();
  if (sc.type === 'module') return CARDS.filter(c => c.moduleId === sc.moduleId);
  return CARDS.filter(c => c.moduleId === sc.moduleId && c.topicId === sc.topicId);
}
function expandScope(sc) { // 卡片太少时扩大到模块/全部
  let cs = scopeCards(sc);
  if (cs.length >= 4 || sc.type === 'all') return { scope: sc, cards: cs };
  const ms = { type: 'module', moduleId: sc.moduleId };
  cs = scopeCards(ms);
  if (cs.length >= 4) return { scope: ms, cards: cs };
  return { scope: { type: 'all' }, cards: CARDS.slice() };
}
const ALL_SCOPE = { type: 'all' };

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast'); el.innerHTML = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- 路由 ---------- */
let route = { name: 'home' };
const stack = [];
function go(name, params) { stack.push(route); route = Object.assign({ name }, params || {}); render(); window.scrollTo(0, 0); }
function goBack() { if (stack.length) { route = stack.pop(); render(); } }
function switchTab(tab) { stack.length = 0; route = { name: tab }; render(); window.scrollTo(0, 0); }

const TITLES = { home: '上岸闪记', browse: '题库', review: '今日复习', profile: '我的' };

function render() {
  const r = route;
  $('#topbar-title').textContent = r.name === 'module' ? scopeName({ type: 'module', moduleId: r.moduleId })
    : r.name === 'topic' ? scopeName({ type: 'topic', moduleId: r.moduleId, topicId: r.topicId })
      : (TITLES[r.name] || '上岸闪记');
  $('#btn-back').classList.toggle('hidden', stack.length === 0);
  document.querySelectorAll('#tabbar .tab').forEach(b => {
    const t = b.dataset.tab;
    const active = t === r.name || (t === 'browse' && (r.name === 'module' || r.name === 'topic'));
    b.classList.toggle('active', active);
  });
  const view = $('#view');
  if (r.name === 'home') view.innerHTML = vHome();
  else if (r.name === 'browse') view.innerHTML = vBrowse();
  else if (r.name === 'module') view.innerHTML = vModule(r.moduleId);
  else if (r.name === 'topic') view.innerHTML = vTopic(r.moduleId, r.topicId);
  else if (r.name === 'review') view.innerHTML = vReview();
  else if (r.name === 'profile') view.innerHTML = vProfile();
  updateBadge();
}

function updateBadge() {
  const n = dueCards().length;
  const b = $('#review-badge');
  b.classList.toggle('hidden', n === 0);
  b.textContent = n > 99 ? '99+' : n;
}

/* ---------- 组件片段 ---------- */
function progressBar(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0;
  return '<div class="progress-bar"><i style="width:' + pct + '%"></i></div>';
}
function moduleRow(m) {
  const ids = []; m.topics.forEach(t => t.cards.forEach(c => ids.push(c.id)));
  const master = ids.filter(isMastered).length;
  return '<div class="module-row" data-action="open-module" data-id="' + m.moduleId + '">' +
    '<div class="module-icon">' + m.icon + '</div>' +
    '<div class="module-info"><div class="module-name">' + esc(m.moduleName) + '</div>' +
    '<div class="module-sub">' + m.topics.length + ' 个题型 · ' + ids.length + ' 张卡 · 已掌握 ' + master + '</div>' +
    progressBar(master, ids.length) + '</div>' +
    '<svg class="chevron" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9.3 6.7 8 8l5.3 4L8 16l1.3 1.3L16 12z"/></svg></div>';
}
function modeGrid(sc) {
  const scJson = esc(JSON.stringify(sc));
  return '<div class="mode-grid">' +
    '<button class="mode-btn" data-action="start-flash" data-scope="' + scJson + '"><div class="m-icon">🃏</div><div class="m-name">闪卡记忆</div><div class="m-desc">翻面回忆·间隔重复</div></button>' +
    '<button class="mode-btn" data-action="start-match" data-scope="' + scJson + '"><div class="m-icon">🔗</div><div class="m-name">连连看</div><div class="m-desc">题眼配对关键词</div></button>' +
    '<button class="mode-btn" data-action="start-fill" data-scope="' + scJson + '"><div class="m-icon">✍️</div><div class="m-name">关键词填空</div><div class="m-desc">看题眼选解法词</div></button>' +
    '<button class="mode-btn" data-action="start-challenge" data-scope="' + scJson + '"><div class="m-icon">⚡</div><div class="m-name">限时闯关</div><div class="m-desc">3分钟·连击得分</div></button>' +
    '</div>';
}
function statusDot(st) { return '<span class="status-dot ' + (st === 'new' ? '' : st) + '"></span>'; }

/* ---------- 视图：首页 ---------- */
function vHome() {
  const due = dueCards().length, news = newCards().length, master = masteredCount();
  const s = progress.stats;
  const best = progress.best.challenge && progress.best.challenge.all;
  let h = '<div class="hero"><div class="hi">在职备考 · 碎片时间题眼速记</div>' +
    '<div class="target">江苏省考 · 行测B类 · 冲刺南京 🎯</div>' +
    '<div class="hero-stats">' +
    '<div class="hero-stat"><b>' + s.streak + '</b><span>连续学习/天</span></div>' +
    '<div class="hero-stat"><b>' + due + '</b><span>今日待复习</span></div>' +
    '<div class="hero-stat"><b>' + master + '<small style="font-size:12px">/' + TOTAL + '</small></b><span>已掌握卡片</span></div>' +
    '</div></div>';
  h += '<div style="height:14px"></div>';
  if (due > 0) {
    h += '<button class="big-btn" data-action="review-now">📌 开始今日复习（' + due + ' 张到期）</button>';
  } else if (news > 0) {
    h += '<button class="big-btn" data-action="learn-new">🌱 学习新卡片（还有 ' + news + ' 张未学）</button>';
  } else {
    h += '<button class="big-btn green">✅ 全部卡片已学过，保持复习节奏</button>';
  }
  h += '<div style="height:10px"></div>' +
    '<button class="big-btn ghost" data-action="start-challenge" data-scope="' + esc(JSON.stringify(ALL_SCOPE)) + '">⚡ 随机闯关 · 3分钟限时挑战' + (best ? '（最佳 ' + best + ' 分）' : '') + '</button>';
  h += '<div class="section-title">选择模块 · 针对性刷题</div>';
  DB.modules.forEach(m => h += moduleRow(m));
  h += '<div class="note-text">题库 ' + TOTAL + ' 张卡片 · 数据更新 ' + esc(DB.buildDate || '') + '<br>方法论：主动回忆 + 间隔重复（记忆曲线）</div>';
  return h;
}

/* ---------- 视图：题库（搜索） ---------- */
function vBrowse() {
  let h = '<div class="search-box"><svg viewBox="0 0 24 24" width="19" height="19"><path fill="currentColor" d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>' +
    '<input id="search-input" type="search" placeholder="搜索题眼 / 关键词 / 题型，如：转折、截位直除" autocomplete="off"></div>';
  h += '<div id="search-results"></div>';
  h += '<div id="browse-modules">' + DB.modules.map(moduleRow).join('') + '</div>';
  return h;
}
function doSearch(q) {
  q = q.trim().toLowerCase();
  const box = $('#search-results'), mods = $('#browse-modules');
  if (!q) { box.innerHTML = ''; mods.classList.remove('hidden'); return; }
  mods.classList.add('hidden');
  const res = CARDS.filter(c =>
    (c.front + c.back + c.keywords.join('') + c.topicName + c.mnemonic).toLowerCase().includes(q)
  ).slice(0, 30);
  if (!res.length) { box.innerHTML = '<div class="empty-state"><div class="e-icon">🔍</div><div class="e-title">没有找到相关卡片</div><div class="e-sub">换个关键词试试，如“比重”“一笔画”</div></div>'; return; }
  const t = todayStr();
  box.innerHTML = '<div class="section-title">找到 ' + res.length + ' 张卡片</div>' + res.map(c =>
    '<div class="card-item" data-action="card-detail" data-id="' + c.id + '">' + statusDot(cardStatus(c.id, t)) +
    '<div class="c-front">' + esc(cut(cleanFront(c.front), 46)) +
    '<div class="c-tags">' + esc(c.moduleName) + ' · ' + esc(c.topicName) + '</div></div></div>'
  ).join('');
}

/* ---------- 视图：模块 ---------- */
function vModule(mid) {
  const m = DB.modules.find(x => x.moduleId === mid);
  if (!m) return '';
  const sc = { type: 'module', moduleId: mid };
  const t = todayStr();
  const cs = scopeCards(sc);
  const master = cs.filter(c => isMastered(c.id)).length;
  const due = cs.filter(c => isDue(c.id, t)).length;
  let h = '<div class="card-box" style="display:flex;align-items:center;gap:12px">' +
    '<div class="module-icon">' + m.icon + '</div>' +
    '<div style="flex:1"><div class="module-name">' + esc(m.moduleName) + '</div>' +
    '<div class="module-sub">' + cs.length + ' 张卡 · 已掌握 ' + master + (due ? ' · <b style="color:var(--amber)">' + due + ' 张待复习</b>' : '') + '</div>' +
    progressBar(master, cs.length) + '</div></div>';
  h += '<div class="section-title">选择练习模式</div>' + modeGrid(sc);
  h += '<div class="section-title">题型列表</div>';
  m.topics.forEach(tp => {
    const tMaster = tp.cards.filter(c => isMastered(c.id)).length;
    h += '<div class="topic-row" data-action="open-topic" data-id="' + mid + '" data-topic="' + tp.id + '">' +
      '<div class="t-name">' + esc(tp.name) + (tp.section && tp.section !== m.moduleName ? '<span style="font-size:11px;color:var(--text-3);margin-left:6px">' + esc(tp.section) + '</span>' : '') + '</div>' +
      '<div class="t-count">' + tMaster + '/' + tp.cards.length + '</div>' +
      '<div class="mini-progress">' + progressBar(tMaster, tp.cards.length) + '</div>' +
      '<svg class="chevron" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9.3 6.7 8 8l5.3 4L8 16l1.3 1.3L16 12z"/></svg></div>';
  });
  return h;
}

/* ---------- 视图：题型 ---------- */
function vTopic(mid, tid) {
  const m = DB.modules.find(x => x.moduleId === mid);
  const tp = m && m.topics.find(x => x.id === tid);
  if (!tp) return '';
  const sc = { type: 'topic', moduleId: mid, topicId: tid };
  const t = todayStr();
  const master = tp.cards.filter(c => isMastered(c.id)).length;
  let h = '<div class="card-box"><div class="module-name">' + esc(tp.name) + '</div>' +
    '<div class="module-sub">' + tp.cards.length + ' 张卡 · 已掌握 ' + master + '</div>' + progressBar(master, tp.cards.length) + '</div>';
  h += modeGrid(sc);
  h += '<div class="section-title">卡片列表 <span style="font-weight:400;font-size:12px">（<span style="color:var(--green)">●</span> 已掌握 <span style="color:var(--amber)">●</span> 待复习 <span style="color:var(--blue)">●</span> 学习中 <span style="color:var(--text-3)">●</span> 未学）</span></div>';
  tp.cards.forEach(c => {
    h += '<div class="card-item" data-action="card-detail" data-id="' + c.id + '">' + statusDot(cardStatus(c.id, t)) +
      '<div class="c-front">' + esc(cut(cleanFront(c.front), 52)) +
      '<div class="c-tags">' + c.keywords.map(k => '#' + esc(k)).join(' ') + '</div></div></div>';
  });
  return h;
}

/* ---------- 视图：复习 ---------- */
function vReview() {
  const t = todayStr();
  const due = dueCards();
  if (!due.length) {
    const news = newCards().length;
    return '<div class="empty-state"><div class="e-icon">🎉</div><div class="e-title">今日没有到期卡片</div>' +
      '<div class="e-sub">记忆曲线已被你拿捏～<br>' + (news ? '还有 ' + news + ' 张新卡片可以学，或者来一局闯关保持手感。' : '来一局闯关保持手感吧。') + '</div>' +
      (news ? '<button class="big-btn" data-action="learn-new">🌱 学习新卡片</button>' : '') +
      '<div style="height:10px"></div><button class="big-btn ghost" data-action="start-challenge" data-scope="' + esc(JSON.stringify(ALL_SCOPE)) + '">⚡ 随机闯关</button></div>';
  }
  const byModule = {};
  due.forEach(c => { byModule[c.moduleName] = (byModule[c.moduleName] || 0) + 1; });
  let h = '<div class="card-box"><div class="module-name">今日待复习 ' + due.length + ' 张</div><div class="module-sub">按记忆曲线，这些卡片今天到期</div></div>';
  Object.keys(byModule).forEach(k => {
    h += '<div class="set-row"><span class="s-label">' + esc(k) + '</span><span class="s-val">' + byModule[k] + ' 张</span></div>';
  });
  h += '<div style="height:12px"></div><button class="big-btn" data-action="review-now">📌 开始复习</button>';
  return h;
}

/* ---------- 视图：我的 ---------- */
function themeLabel(v) { return v === 'auto' ? '跟随系统' : v === 'light' ? '浅色' : '深色'; }
function vProfile() {
  const s = progress.stats;
  const days = Object.keys(s.days).length;
  const best = progress.best.challenge || {};
  let h = '<div class="profile-stats">' +
    '<div class="p-stat"><b>' + s.streak + '</b><span>连续天数</span></div>' +
    '<div class="p-stat"><b>' + s.totalReviews + '</b><span>累计复习</span></div>' +
    '<div class="p-stat"><b>' + days + '</b><span>学习天数</span></div></div>';
  h += '<div class="card-box"><div class="module-name" style="margin-bottom:6px">⚡ 闯关最佳成绩</div>' +
    '<div class="module-sub">' + (best.all ? '全题库模式 ' + best.all + ' 分' : '还没有成绩，去闯一关吧') + '</div></div>';
  h += '<div class="section-title">设置</div>';
  h += '<div class="set-row" data-action="toggle-theme"><span class="s-label">🎨 外观主题</span><span class="s-val">' + themeLabel(progress.settings.theme) + '</span><svg class="chevron" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9.3 6.7 8 8l5.3 4L8 16l1.3 1.3L16 12z"/></svg></div>';
  h += '<div class="set-row" data-action="export-data"><span class="s-label">💾 导出学习进度</span><span class="s-val">备份到文件</span></div>';
  h += '<label class="set-row"><span class="s-label">📂 导入学习进度</span><span class="s-val">从备份恢复</span><input type="file" accept=".json,application/json" class="file-input" id="import-input"></label>';
  h += '<div class="set-row danger" data-action="reset-confirm"><span class="s-label">🗑️ 清空学习进度</span></div>';
  h += '<div class="section-title">关于</div>' +
    '<div class="note-text">「上岸闪记」面向在职考公人的碎片化记忆工具，当前覆盖江苏省考行测四大模块 ' + TOTAL + ' 张题眼卡片。<br><br>' +
    '📚 内容来源：以粉笔公考公开技巧体系为主干，辅以华图/中公等公开资料及网络考公经验帖整理，仅供个人学习记忆使用。<br><br>' +
    '🧠 记忆原理：主动回忆（翻面前先想答案）+ 间隔重复（按记忆曲线安排复习），配合配对/填空/闯关多种提取练习，巩固题眼→解法的条件反射。<br><br>' +
    '📅 间隔规则：记住→间隔 1/2/4/7/15 天递进复习；模糊→次日重现；忘了→回到今天重新学。掌握标准：连续答对进入 3 级以上记忆盒。<br><br>' +
    '题库数据随 GitHub 仓库更新，祝早日上岸！🌊</div>';
  return h;
}

/* ---------- 卡片详情弹层 ---------- */
function openCardDetail(id) {
  const c = CARD_BY_ID[id]; if (!c) return;
  const t = todayStr(); const st = cardStatus(id, t);
  const stLabel = { new: '未学习', due: '待复习', learning: '学习中', mastered: '已掌握' }[st];
  $('#modal').innerHTML = '<div class="modal-sheet">' +
    '<div class="m-head"><div class="m-title">' + esc(c.topicName) + ' <span style="font-size:11px;color:var(--text-3);font-weight:400">' + esc(c.moduleName) + '</span></div>' +
    '<button class="m-close" data-action="modal-close">✕</button></div>' +
    '<div class="m-block"><div class="m-label">👁 题眼（' + stLabel + '）</div><div class="m-text">' + esc(cleanFront(c.front)) + '</div></div>' +
    '<div class="m-block"><div class="m-label">🔑 解法</div><div class="m-text">' + esc(cleanBack(c.back)) + '</div></div>' +
    '<div class="m-block"><div class="m-label">🏷 关键词</div><div class="kw-chips" style="justify-content:flex-start;margin:0">' + c.keywords.map(k => '<span class="kw-chip">' + esc(k) + '</span>').join('') + '</div></div>' +
    (c.mnemonic ? '<div class="m-block"><div class="m-label">💡 口诀</div><div class="mnemonic-box" style="margin-top:0">' + esc(c.mnemonic) + '</div></div>' : '') +
    '<div class="m-block"><div class="m-label">来源</div><div class="m-text" style="font-size:12px;color:var(--text-3)">' + esc(c.source) + '</div></div>' +
    '<button class="big-btn" data-action="flash-single" data-id="' + c.id + '">🃏 用闪卡练这张</button>' +
    '</div>';
  $('#modal').classList.remove('hidden');
}
function openConfirm(title, text, actionName) {
  $('#modal').innerHTML = '<div class="modal-sheet" style="text-align:center">' +
    '<div style="font-size:36px;margin-bottom:8px">⚠️</div>' +
    '<div class="m-title" style="font-size:17px;font-weight:800;margin-bottom:8px">' + title + '</div>' +
    '<div style="font-size:13.5px;color:var(--text-2);margin-bottom:18px">' + text + '</div>' +
    '<button class="big-btn" style="background:var(--red)" data-action="' + actionName + '">确认</button>' +
    '<div style="height:10px"></div><button class="big-btn ghost" data-action="modal-close">取消</button></div>';
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }

/* ================================================================
   练习会话
================================================================ */
let S = null; // 当前会话状态
let SESSION_SEQ = 0; // 会话代际号：异步回调校验用，防止旧定时器污染新会话
const sessionEl = () => $('#session');

function openSession() { sessionEl().classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeSession() {
  if (S && S.timer) clearInterval(S.timer);
  S = null;
  sessionEl().classList.add('hidden');
  document.body.style.overflow = '';
  render();
}
function sTop(title, count) {
  return '<div class="session-top"><button class="icon-btn" data-action="exit-session" aria-label="退出">✕</button>' +
    '<div class="s-title">' + esc(title) + '</div><div class="s-count">' + count + '</div></div>';
}
function resultPage(emoji, title, stats, canRestart) {
  return '<div class="result-page"><div class="result-emoji">' + emoji + '</div>' +
    '<div class="result-title">' + title + '</div>' +
    '<div class="result-grid">' + stats.map(x => '<div class="result-stat"><b>' + x.b + '</b><span>' + x.span + '</span></div>').join('') + '</div>' +
    '<div class="result-actions">' +
    (canRestart ? '<button class="big-btn" data-action="restart-session">🔁 再来一局</button>' : '') +
    '<button class="big-btn ghost" data-action="exit-session">返回</button></div></div>';
}
function accEmoji(p) { return p >= 0.85 ? '🎉' : p >= 0.6 ? '💪' : '📚'; }

/* ---------- 模式一：闪卡 ---------- */
function startFlash(scope, opts) {
  opts = opts || {};
  let cards = scopeCards(scope);
  const t = todayStr();
  if (opts.cardId) cards = CARD_BY_ID[opts.cardId] ? [CARD_BY_ID[opts.cardId]] : [];
  else if (opts.dueOnly) cards = cards.filter(c => isDue(c.id, t));
  else if (opts.newOnly) cards = cards.filter(c => !progress.cards[c.id] || progress.cards[c.id].reps === 0).slice(0, 15);
  else {
    // 到期优先 → 未学 → 其余
    const due = cards.filter(c => isDue(c.id, t));
    const unseen = cards.filter(c => !progress.cards[c.id] || progress.cards[c.id].reps === 0);
    const rest = cards.filter(c => !isDue(c.id, t) && progress.cards[c.id] && progress.cards[c.id].reps > 0);
    cards = due.concat(unseen, shuffle(rest)).slice(0, Math.max(20, due.length + 5));
  }
  if (!cards.length) { toast('这个范围暂时没有可学的卡片'); return; }
  S = { type: 'flash', seq: ++SESSION_SEQ, scope, title: opts.cardId ? '单卡练习' : (opts.dueOnly ? '今日复习 · ' : '') + scopeName(scope), queue: cards.map(c => c.id), i: 0, flipped: false, againSet: {}, res: { again: 0, hard: 0, good: 0, easy: 0 } };
  openSession(); renderSession();
}
function renderFlash() {
  const total = S.queue.length, idx = S.i, id = S.queue[idx], c = CARD_BY_ID[id];
  let h = sTop('🃏 ' + S.title, (idx + 1) + ' / ' + total);
  h += '<div class="session-body"><div class="flip-wrap"><div class="flip-card' + (S.flipped ? ' flipped' : '') + '" data-action="flip-card">' +
    '<div class="flip-face flip-front"><div class="face-label">👁 题眼信号</div>' +
    '<div class="face-text">' + esc(cleanFront(c.front)) + '</div>' +
    '<div class="flip-hint">先在心里想出解法，再点卡片翻面</div></div>' +
    '<div class="flip-face flip-back"><div class="face-label">🔑 解法</div>' +
    '<div class="back-section"><div class="bs-text">' + esc(cleanBack(c.back)) + '</div></div>' +
    '<div class="kw-chips">' + c.keywords.map(k => '<span class="kw-chip">' + esc(k) + '</span>').join('') + '</div>' +
    (c.mnemonic ? '<div class="mnemonic-box">💡 ' + esc(c.mnemonic) + '</div>' : '') +
    '<div class="src-note">' + esc(c.topicName) + ' · ' + esc(c.source) + '</div></div>' +
    '</div></div></div>';
  if (!S.flipped) {
    h += '<div class="session-foot"><button class="show-answer-btn" data-action="flip-card">🤔 想好了，翻面对答案</button></div>';
  } else {
    h += '<div class="session-foot"><div class="grade-grid">' +
      '<button class="grade-btn g-again" data-action="grade" data-grade="again">忘了<small>重新学</small></button>' +
      '<button class="grade-btn g-hard" data-action="grade" data-grade="hard">模糊<small>1天后再见</small></button>' +
      '<button class="grade-btn g-good" data-action="grade" data-grade="good">记住<small>按曲线复习</small></button>' +
      '<button class="grade-btn g-easy" data-action="grade" data-grade="easy">秒答<small>拉长间隔</small></button>' +
      '</div></div>';
  }
  return h;
}
function onGrade(g) {
  const id = S.queue[S.i];
  gradeCard(id, g);
  S.res[g]++;
  if (g === 'again' && !S.againSet[id]) { S.againSet[id] = 1; S.queue.push(id); }
  S.i++; S.flipped = false;
  if (S.i >= S.queue.length) { renderFlashResult(); return; }
  renderSession();
}
function renderFlashResult() {
  const r = S.res, n = r.again + r.hard + r.good + r.easy;
  const okRate = n ? Math.round((r.good + r.easy) / n * 100) : 0;
  sessionEl().innerHTML = '<div class="session-top"><div class="s-title"></div></div>' +
    resultPage(accEmoji(okRate / 100), okRate >= 85 ? '记忆效果很棒！' : okRate >= 60 ? '稳步推进中' : '万事开头难，坚持住', [
      { b: n, span: '复习卡片' }, { b: okRate + '%', span: '记住率' },
      { b: r.again, span: '忘了重学' }, { b: progress.stats.streak, span: '连续天数' }
    ], false);
}

/* ---------- 模式二：连连看 ---------- */
function startMatch(scope) {
  const ex = expandScope(scope);
  let cards = shuffle(ex.cards);
  const pairs = Math.min(6, cards.length);
  const picked = [], used = new Set();
  for (const c of cards) {
    if (picked.length >= pairs) break;
    let label = c.keywords.slice(0, 2).join(' · ');
    if (used.has(label)) label = c.keywords.join(' · ');
    if (used.has(label)) continue;
    used.add(label);
    picked.push({ card: c, label });
  }
  if (picked.length < 3) { toast('卡片太少，换个范围试试'); return; }
  S = {
    type: 'match', seq: ++SESSION_SEQ, scope: ex.scope, title: '连连看 · ' + scopeName(ex.scope),
    pairs: picked.map(p => p.card.id),
    labels: Object.fromEntries(picked.map(p => [p.card.id, p.label])),
    lefts: shuffle(picked.map(p => p.card.id)),
    rights: shuffle(picked.map(p => p.card.id)),
    selL: null, selR: null, matched: {}, matchedN: 0, wrong: 0, t0: Date.now(), done: false
  };
  openSession(); renderSession();
}
function renderMatch() {
  if (S.done) {
    const secs = Math.round((S.t1 - S.t0) / 1000);
    const n = S.pairs.length, acc = n / (n + S.wrong);
    return '<div class="session-top"><div class="s-title"></div></div>' +
      resultPage(accEmoji(acc), acc >= 0.85 ? '火眼金睛！' : '配对完成', [
        { b: secs + 's', span: '用时' }, { b: Math.round(acc * 100) + '%', span: '准确率' },
        { b: n, span: '配对成功' }, { b: S.wrong, span: '失误次数' }
      ], true);
  }
  let h = sTop('🔗 ' + S.title, S.matchedN + ' / ' + S.pairs.length);
  h += '<div class="session-body"><div class="match-stats"><span>👁 左边选题眼</span><span>🔑 右边配关键词</span></div><div class="match-cols"><div class="match-col">';
  S.lefts.forEach(id => {
    const c = CARD_BY_ID[id];
    h += '<div class="match-item' + (S.matched[id] ? ' ok' : '') + (S.selL === id ? ' sel' : '') + '" data-action="match-item" data-side="L" data-id="' + id + '">' + esc(cut(cleanFront(c.front), 34)) + '</div>';
  });
  h += '</div><div class="match-col">';
  S.rights.forEach(id => {
    h += '<div class="match-item' + (S.matched[id] ? ' ok' : '') + (S.selR === id ? ' sel' : '') + '" data-action="match-item" data-side="R" data-id="' + id + '" style="font-weight:600">' + esc(S.labels[id]) + '</div>';
  });
  h += '</div></div></div>';
  return h;
}
function onMatchItem(side, id) {
  if (S.matched[id]) return;
  if (side === 'L') S.selL = (S.selL === id ? null : id);
  else S.selR = (S.selR === id ? null : id);
  if (S.selL && S.selR) {
    if (S.selL === S.selR) {
      S.matched[S.selL] = 1; S.matchedN++;
      S.selL = S.selR = null;
      if (S.matchedN === S.pairs.length) { S.done = true; S.t1 = Date.now(); markStudy(); }
      renderSession();
    } else {
      S.wrong++;
      const l = S.selL, r = S.selR, seq = S.seq;
      renderSession();
      setTimeout(() => {
        if (!S || S.seq !== seq) return;
        document.querySelectorAll('.match-item.sel').forEach(el => el.classList.add('err'));
        setTimeout(() => {
          if (!S || S.seq !== seq || S.done) return;
          if (S.selL === l && S.selR === r) { S.selL = S.selR = null; renderSession(); }
        }, 420);
      }, 20);
    }
  } else renderSession();
}

/* ---------- 模式三：关键词填空 ---------- */
function buildFillQ(card, pool) {
  const correct = card.keywords[0];
  const opts = new Set([correct]);
  let guard = 0;
  while (opts.size < 4 && guard++ < 60) {
    const o = pool[Math.floor(Math.random() * pool.length)];
    if (o.id !== card.id && o.keywords[0] && o.keywords[0] !== correct) opts.add(o.keywords[0]);
  }
  const arr = shuffle([...opts]);
  return { card, opts: arr, ans: arr.indexOf(correct) };
}
function startFill(scope) {
  const ex = expandScope(scope);
  const cards = shuffle(ex.cards).slice(0, 10);
  if (cards.length < 4) { toast('卡片太少，换个范围试试'); return; }
  S = { type: 'fill', seq: ++SESSION_SEQ, scope: ex.scope, title: '关键词填空 · ' + scopeName(ex.scope), qs: cards.map(c => buildFillQ(c, scopeCards(ex.scope))), i: 0, score: 0, locked: false };
  openSession(); renderSession();
}
function renderFill() {
  if (S.i >= S.qs.length) {
    const n = S.qs.length, acc = n ? S.score / n : 0;
    return '<div class="session-top"><div class="s-title"></div></div>' +
      resultPage(accEmoji(acc), acc >= 0.85 ? '题眼敏感度拉满！' : '填空完成', [
        { b: S.score + '/' + n, span: '答对题数' }, { b: Math.round(acc * 100) + '%', span: '准确率' }
      ], true);
  }
  const q = S.qs[S.i], c = q.card;
  let h = sTop('✍️ ' + S.title, (S.i + 1) + ' / ' + S.qs.length);
  h += '<div class="session-body"><div class="quiz-q"><div class="q-label">👁 题眼信号</div><div class="q-text">' + esc(cleanFront(c.front)) + '</div></div>' +
    '<div class="q-label" style="font-size:12.5px;color:var(--text-3);font-weight:700;margin:2px 2px 8px">这个题眼提示的解题关键词是？</div><div class="quiz-opts">';
  q.opts.forEach((o, i) => { h += '<button class="quiz-opt" data-action="quiz-opt" data-idx="' + i + '">' + esc(o) + '</button>'; });
  h += '</div><div id="fill-explain"></div></div>';
  return h;
}
function onQuizOpt(idx) {
  if (!S || S.locked) return;
  S.locked = true;
  const q = S.qs[S.i];
  const opts = document.querySelectorAll('#session .quiz-opt');
  opts.forEach((el, i) => {
    if (i === q.ans) el.classList.add('right');
    else if (i === idx) el.classList.add('wrong');
    else el.classList.add('dim');
  });
  const isRight = idx === q.ans;
  if (isRight) S.score++;
  markStudy();
  const c = q.card;
  const ex = document.getElementById('fill-explain');
  if (ex) ex.innerHTML = '<div class="quiz-explain">' + (isRight ? '✅ 答对了！' : '❌ 正确答案：' + esc(q.opts[q.ans]) + '。') +
    (c.mnemonic ? '<br>💡 口诀：' + esc(c.mnemonic) : '') + '<br>🔑 ' + esc(cleanBack(c.back)) + '</div>';
  const seq = S.seq;
  setTimeout(() => { if (S && S.seq === seq && S.type === 'fill') { S.i++; S.locked = false; renderSession(); } }, isRight ? 1500 : 2400);
}

/* ---------- 模式四：限时闯关 ---------- */
const CHALLENGE_SEC = 180;
function buildChallengeQ() {
  const pool = S.pool;
  const card = pool[Math.floor(Math.random() * pool.length)];
  const typeA = Math.random() < 0.5;
  const used = new Set();
  const opts = [];
  if (typeA) {
    opts.push(cleanBack(card.back)); used.add(opts[0]);
    let guard = 0;
    while (opts.length < 4 && guard++ < 60) {
      const o = pool[Math.floor(Math.random() * pool.length)];
      const t = cleanBack(o.back);
      if (!used.has(t)) { used.add(t); opts.push(t); }
    }
    const arr = shuffle(opts);
    return { label: '👁 看到这个题眼，该用什么解法？', q: cleanFront(card.front), opts: arr, ans: arr.indexOf(opts[0]), card };
  } else {
    opts.push(cut(cleanFront(card.front), 30)); used.add(opts[0]);
    let guard = 0;
    while (opts.length < 4 && guard++ < 60) {
      const o = pool[Math.floor(Math.random() * pool.length)];
      const t = cut(cleanFront(o.front), 30);
      if (!used.has(t)) { used.add(t); opts.push(t); }
    }
    const arr = shuffle(opts);
    return { label: '🔑 这个解法，对应哪个题眼？', q: cleanBack(card.back), opts: arr, ans: arr.indexOf(opts[0]), card };
  }
}
function startChallenge(scope) {
  const ex = expandScope(scope);
  S = {
    type: 'challenge', seq: ++SESSION_SEQ, scope: ex.scope, pool: ex.cards,
    endsAt: Date.now() + CHALLENGE_SEC * 1000,
    score: 0, combo: 0, maxCombo: 0, answered: 0, correct: 0,
    cur: null, locked: false, timer: null, done: false
  };
  S.cur = buildChallengeQ();
  S.timer = setInterval(tickChallenge, 250);
  openSession(); renderSession();
}
function tickChallenge() {
  if (!S || S.type !== 'challenge') return;
  const left = Math.max(0, S.endsAt - Date.now());
  const bar = document.getElementById('ch-timer-bar');
  const hud = document.getElementById('ch-time');
  if (bar) bar.style.width = (left / (CHALLENGE_SEC * 1000) * 100) + '%';
  if (hud) hud.textContent = Math.ceil(left / 1000) + 's';
  if (left <= 0) { S.done = true; clearInterval(S.timer); S.timer = null; markStudy(); renderChallengeResult(); }
}
function renderChallenge() {
  const left = Math.max(0, Math.ceil((S.endsAt - Date.now()) / 1000));
  let h = sTop('⚡ 限时闯关 · ' + scopeName(S.scope), '');
  h += '<div class="session-body"><div class="timer-bar"><i id="ch-timer-bar" style="width:100%"></i></div>' +
    '<div class="challenge-hud">' +
    '<div class="hud-item"><b id="ch-time">' + left + 's</b><span>剩余时间</span></div>' +
    '<div class="hud-item"><b>' + S.score + '</b><span>得分</span></div>' +
    '<div class="hud-item combo"><b>x' + S.combo + '</b><span>连击</span></div></div>' +
    '<div class="quiz-q"><div class="q-label">' + S.cur.label + '</div><div class="q-text">' + esc(S.cur.q) + '</div></div>' +
    '<div class="quiz-opts">';
  S.cur.opts.forEach((o, i) => { h += '<button class="quiz-opt" data-action="quiz-opt" data-idx="' + i + '">' + esc(o) + '</button>'; });
  h += '</div></div>';
  return h;
}
function onChallengeOpt(idx) {
  if (!S || S.locked || S.done) return;
  S.locked = true; S.answered++;
  const cur = S.cur;
  const opts = document.querySelectorAll('#session .quiz-opt');
  const isRight = idx === cur.ans;
  opts.forEach((el, i) => {
    if (i === cur.ans) el.classList.add('right');
    else if (i === idx) el.classList.add('wrong');
    else el.classList.add('dim');
  });
  if (isRight) {
    S.correct++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.score += 10 + (S.combo - 1) * 2;
  } else S.combo = 0;
  const seq = S.seq;
  setTimeout(() => {
    if (!S || S.seq !== seq || S.done) return;
    S.locked = false; S.cur = buildChallengeQ(); renderSession();
  }, isRight ? 420 : 900);
}
function renderChallengeResult() {
  const acc = S.answered ? S.correct / S.answered : 0;
  progress.best.challenge = progress.best.challenge || {};
  const key = scopeKey(S.scope);
  const isNewBest = S.score > (progress.best.challenge[key] || 0);
  if (isNewBest) { progress.best.challenge[key] = S.score; saveProgress(); }
  sessionEl().innerHTML = '<div class="session-top"><div class="s-title"></div></div>' +
    resultPage(isNewBest ? '🏆' : accEmoji(acc), isNewBest ? '新纪录！' : '时间到！', [
      { b: S.score, span: '总得分' }, { b: S.correct + '/' + S.answered, span: '答对/作答' },
      { b: Math.round(acc * 100) + '%', span: '准确率' }, { b: 'x' + S.maxCombo, span: '最高连击' }
    ], true);
}

/* ---------- 会话渲染分发 ---------- */
function renderSession() {
  if (!S) return;
  if (S.type === 'flash') sessionEl().innerHTML = renderFlash();
  else if (S.type === 'match') sessionEl().innerHTML = renderMatch();
  else if (S.type === 'fill') sessionEl().innerHTML = renderFill();
  else if (S.type === 'challenge') sessionEl().innerHTML = renderChallenge();
}
function restartSession() {
  if (!S) return;
  const t = S.type, sc = S.scope;
  if (S.timer) clearInterval(S.timer);
  S = null;
  if (t === 'flash') startFlash(sc);
  else if (t === 'match') startMatch(sc);
  else if (t === 'fill') startFill(sc);
  else startChallenge(sc);
}

/* ================================================================
   主题 / 数据导入导出 / SW
================================================================ */
const darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const v = progress.settings.theme;
  const dark = v === 'dark' || (v === 'auto' && darkMQ && darkMQ.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function toggleTheme() {
  const order = ['auto', 'light', 'dark'];
  const cur = progress.settings.theme || 'auto';
  progress.settings.theme = order[(order.indexOf(cur) + 1) % 3];
  saveProgress(); applyTheme();
  toast('主题：' + themeLabel(progress.settings.theme));
  if (route.name === 'profile') render();
}
if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', () => { if (progress.settings.theme === 'auto') applyTheme(); });

function exportData() {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '上岸闪记-学习进度-' + todayStr() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('进度已导出，请妥善保存');
}
function importData(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const p = JSON.parse(fr.result);
      if (!p || p.v !== 1 || !p.cards) throw 0;
      progress = p; saveProgress(); applyTheme(); render();
      toast('进度导入成功 ✅');
    } catch (e) { toast('文件格式不对，导入失败'); }
  };
  fr.readAsText(file, 'utf-8');
}
function resetProgress() {
  progress = defaultProgress(); saveProgress(); applyTheme(); closeModal(); render();
  toast('学习进度已清空');
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}

/* ================================================================
   事件分发
================================================================ */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target.id === 'modal') closeModal();
    return;
  }
  const act = el.dataset.action;
  switch (act) {
    case 'back': goBack(); break;
    case 'tab': switchTab(el.dataset.tab); break;
    case 'toggle-theme': toggleTheme(); break;
    case 'open-module': go('module', { moduleId: el.dataset.id }); break;
    case 'open-topic': go('topic', { moduleId: el.dataset.id, topicId: el.dataset.topic }); break;
    case 'card-detail': openCardDetail(el.dataset.id); break;
    case 'modal-close': closeModal(); break;
    case 'reset-confirm': openConfirm('清空全部学习进度？', '卡片记忆盒、连续天数、闯关成绩都会被清空，且无法恢复。建议先导出备份。', 'reset-do'); break;
    case 'reset-do': resetProgress(); break;
    case 'export-data': exportData(); break;
    case 'review-now': startFlash(ALL_SCOPE, { dueOnly: true }); break;
    case 'learn-new': startFlash(ALL_SCOPE, { newOnly: true }); break;
    case 'flash-single': closeModal(); startFlash({ type: 'topic', moduleId: CARD_BY_ID[el.dataset.id].moduleId, topicId: CARD_BY_ID[el.dataset.id].topicId }, { cardId: el.dataset.id }); break;
    case 'start-flash': startFlash(JSON.parse(el.dataset.scope)); break;
    case 'start-match': startMatch(JSON.parse(el.dataset.scope)); break;
    case 'start-fill': startFill(JSON.parse(el.dataset.scope)); break;
    case 'start-challenge': startChallenge(JSON.parse(el.dataset.scope)); break;
    case 'exit-session': closeSession(); break;
    case 'restart-session': restartSession(); break;
    case 'flip-card': if (S && S.type === 'flash' && !S.flipped) { S.flipped = true; renderSession(); } break;
    case 'grade': onGrade(el.dataset.grade); break;
    case 'match-item': onMatchItem(el.dataset.side, el.dataset.id); break;
    case 'quiz-opt':
      if (S && S.type === 'fill') onQuizOpt(+el.dataset.idx);
      else if (S && S.type === 'challenge') onChallengeOpt(+el.dataset.idx);
      break;
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'import-input' && e.target.files[0]) importData(e.target.files[0]);
});
document.addEventListener('input', e => {
  if (e.target.id === 'search-input') doSearch(e.target.value);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').classList.contains('hidden')) closeModal(); else if (S) closeSession(); }
});

/* ---------- 启动 ---------- */
applyTheme();
render();
