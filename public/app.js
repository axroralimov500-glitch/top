'use strict';

/* ============================================================
   Ombor Shop — dashboard SPA (sidebar qobig'i, vanilla JS).
   Barcha ma'lumot: /api/*
   ============================================================ */

const API = '/api';
const TOKEN_KEY = 'ombor_token';
const PALETTE = ['#1f6fd0', '#12a5a1', '#7c5cd6', '#e0912a', '#d64545', '#1f9d55', '#4a90d9', '#c0567f', '#2f9e44'];

/* ---------- Yordamchilar ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function priceNum(n) { return (Number(n) || 0).toLocaleString('en-US').replace(/,/g, ' '); }
function money(n) { return priceNum(n) + " so'm"; }
function shortNum(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' mlrd';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mln';
  if (n >= 1e3) return Math.round(n / 1e3) + ' ming';
  return String(n);
}
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }
const p2 = (n) => String(n).padStart(2, '0');
function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/* ---------- Kategoriya grafikasi (emoji o'rniga chizma ikonalar) ---------- */
const GLYPHS = {
  telefon: '<rect x="20" y="6" width="24" height="52" rx="5"/><path d="M27 12h10"/><circle cx="32" cy="50" r="2.4"/>',
  noutbuk: '<rect x="11" y="14" width="42" height="26" rx="3"/><path d="M5 47h54l-4-7H9z"/><path d="M26 27h12"/>',
  audio: '<path d="M13 42v-9a19 19 0 0 1 38 0v9"/><rect x="6" y="40" width="12" height="18" rx="5"/><rect x="46" y="40" width="12" height="18" rx="5"/>',
  shisha: '<path d="M27 6h10v8l4 6v34a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4V20l4-6z"/><path d="M23 34h18"/>',
  kutiqa: '<path d="M14 20h36l-4 34a5 5 0 0 1-5 4H23a5 5 0 0 1-5-4z"/><path d="M24 20a8 8 0 0 1 16 0"/>',
  box: '<path d="M32 8 54 20v24L32 56 10 44V20z"/><path d="M10 20l22 12 22-12"/><path d="M32 32v24"/>',
};
const CAT_GLYPH = { telefon: 'telefon', planshet: 'telefon', noutbuk: 'noutbuk', kompyuter: 'noutbuk', elektronika: 'noutbuk', audio: 'audio', naushnik: 'audio', ichimliklar: 'shisha', suv: 'shisha', oziq: 'kutiqa' };
const CAT_INK = { telefon: '#2f6bd8', noutbuk: '#5a49d6', audio: '#0f8f8a', shisha: '#2a86b8', kutiqa: '#b4740a', box: '#5b6b82' };
function glyphKey(slug) { return CAT_GLYPH[slug] || 'box'; }
function glyphSvg(slug) {
  const k = glyphKey(slug);
  return `<svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.1"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[k]}</svg>`;
}
// Mahsulot "rasm" plitasi — rangi kategoriya bo'yicha, fon neytral studiya.
function mediaTile(slug, cls = 'prod-media') {
  return `<div class="${cls}" style="--ink:${CAT_INK[glyphKey(slug)]}">${glyphSvg(slug)}</div>`;
}

const STATUS = {
  pending_payment: { label: "To'lov kutilmoqda", cls: 's-pending' },
  paid: { label: "To'langan", cls: 's-paid' },
  cancelled: { label: 'Bekor qilingan', cls: 's-cancelled' },
  expired: { label: "Muddati o'tgan", cls: 's-expired' },
};
function statusPill(s) {
  const st = STATUS[s] || { label: s, cls: 's-cancelled' };
  return `<span class="status ${st.cls}">${esc(st.label)}</span>`;
}
function stockTag(qty, lowAt = 3) {
  if (qty <= 0) return `<span class="stock-tag stock-out">Tugagan</span>`;
  if (qty <= lowAt) return `<span class="stock-tag stock-low">Oxirgi ${qty} dona</span>`;
  return `<span class="stock-tag stock-in">${qty} dona</span>`;
}

/* ---------- Ikonalar ---------- */
const I = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  warehouse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M3 21h18"/><rect x="8" y="12" width="8" height="9"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  login: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6h13v10H1z"/><path d="M14 9h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v14M6 12l6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V6M6 12l6-6 6 6"/></svg>',
};

/* ---------- Holat + API ---------- */
const state = { token: localStorage.getItem(TOKEN_KEY) || null, user: null, pending: 0 };
// Ikki bosqichli admin kirishining birinchi bosqich tokeni — faqat xotirada saqlanadi.
let adminChallenge = null;

function setAuth(token, user) {
  state.token = token; state.user = user; state.pending = 0;
  if (!token) adminChallenge = null;
  if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
  renderSidebar(); syncTopbar();
}

class ApiError extends Error {
  constructor(status, code, message, details) { super(message || 'Xato'); this.status = status; this.code = code; this.details = details; }
}

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    if (!state.token) throw new ApiError(401, 'UNAUTHORIZED', 'Iltimos, avval tizimga kiring.');
    headers['Authorization'] = 'Bearer ' + state.token;
  }
  const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null; const text = await res.text();
  if (text) { try { json = JSON.parse(text); } catch { /* not json */ } }
  if (!res.ok) {
    const e = json && json.error ? json.error : {};
    throw new ApiError(res.status, e.code || 'ERROR', e.message || `So'rov bajarilmadi (${res.status})`, e.details);
  }
  const out = json ? json.data : null;
  if (json && json.meta && out && typeof out === 'object') { try { out.meta = json.meta; } catch { /* ignore */ } }
  return out;
}

/* ---------- Toast + modal ---------- */
function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.innerHTML = `<span>${esc(msg)}</span>`;
  $('#toast-wrap').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3200);
}
function openModal(title, html) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; }
function handleErr(e) {
  if (e instanceof ApiError && e.code === 'ADMIN_2FA_REQUIRED') { logout('#/admin-login'); return; }
  else if (e instanceof ApiError && e.status === 401) { location.hash = '#/login'; }
  toast(e.message || 'Xato', 'err');
}

/* ---------- Sidebar + topbar ---------- */
function navFor() {
  if (state.user?.role === 'admin') return [
    { href: '#/dashboard', icon: I.grid, label: 'Boshqaruv paneli', key: 'dashboard' },
    { section: 'Savdo' },
    { href: '#/', icon: I.home, label: 'Katalog', key: '' },
    { href: '#/admin-orders', icon: I.receipt, label: 'Buyurtmalar', key: 'admin-orders', badge: 'pending' },
    { section: 'Ombor' },
    { href: '#/receipts', icon: I.inbox, label: 'Kirim va narx', key: 'receipts' },
    { href: '#/inventory', icon: I.box, label: 'Qoldiq', key: 'inventory' },
    { href: '#/price-history', icon: I.trend, label: 'Narx tarixi', key: 'price-history' },
    { href: '#/warehouses', icon: I.warehouse, label: 'Omborlar', key: 'warehouses' },
    { section: 'Katalog boshqaruvi' },
    { href: '#/products-new', icon: I.plus, label: 'Yangi mahsulot', key: 'products-new' },
  ];
  if (state.user) return [
    { href: '#/dashboard', icon: I.grid, label: 'Boshqaruv paneli', key: 'dashboard' },
    { section: 'Do‘kon' },
    { href: '#/', icon: I.home, label: 'Katalog', key: '' },
    { href: '#/cart', icon: I.cart, label: 'Savat', key: 'cart', badge: 'cart' },
    { href: '#/orders', icon: I.receipt, label: 'Buyurtmalarim', key: 'orders' },
  ];
  return [
    { href: '#/', icon: I.home, label: 'Katalog', key: '' },
    { section: 'Hisob' },
    { href: '#/login', icon: I.login, label: 'Kirish', key: 'login' },
    { href: '#/register', icon: I.user, label: 'Ro‘yxatdan o‘tish', key: 'register' },
  ];
}

function renderSidebar(activeName) {
  const name = activeName !== undefined ? activeName : parseHash().name;
  const items = navFor();
  $('#side-nav').innerHTML = items.map((it) => {
    if (it.section) return `<div class="nav-label">${esc(it.section)}</div>`;
    const key = it.href.replace('#/', '').split('?')[0];
    const active = key === '' ? (name === '' || name === 'product') : (name === key);
    let badge = '';
    if (it.badge === 'cart' && !$('#cart-count').hidden) badge = `<span class="nav-badge">${$('#cart-count').textContent}</span>`;
    if (it.badge === 'pending' && state.pending > 0) badge = `<span class="nav-badge">${state.pending}</span>`;
    return `<a class="nav-item ${active ? 'active' : ''}" href="${it.href}">${it.icon}<span>${esc(it.label)}</span>${badge}</a>`;
  }).join('');

  $('#side-login').hidden = !!state.user;
  $('#side-admin-login').hidden = !!state.user;
}

function todayLabel() {
  const d = new Date();
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function syncTopbar() {
  const admin = state.user?.role === 'admin';
  document.body.dataset.theme = admin ? 'admin' : 'shop';
  const box = $('#tb-user');
  if (state.user) {
    box.hidden = false;
    $('#tb-avatar').textContent = initials(state.user.name);
    $('#tb-name').textContent = state.user.name;
    $('#tb-sub').textContent = admin ? 'Administrator · ikki bosqichli kirish' : 'Mijoz · ' + (state.user.email || '');
  } else { box.hidden = true; }
  $('#tb-logout').hidden = !state.user;
  $('#tb-bell').hidden = !admin;
  $('#search-input').value = parseHash().params.get('q') || '';
  tickDate();
}

function tickDate() { $('#tb-date').textContent = todayLabel(); }
function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'hozir';
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
  return `${Math.floor(s / 86400)} kun oldin`;
}

async function refreshCartBadge() {
  const el = $('#cart-count');
  if (!state.token) { el.hidden = true; renderSidebar(); return; }
  try {
    const cart = await api('/cart', { auth: true });
    const count = cart.items.reduce((s, it) => s + it.qty, 0);
    el.hidden = count === 0; el.textContent = count;
  } catch { el.hidden = true; }
  renderSidebar();
}

function setCrumb(label) {
  const title = $('#page-title');
  if (title) title.textContent = label;
  const home = state.user?.role === 'admin' ? { href: '#/dashboard', label: 'Boshqaruv paneli' } : { href: '#/', label: 'Do‘kon' };
  $('#crumbs').innerHTML = `<a class="crumb" href="${home.href}">${esc(home.label)}</a><span class="sep">/</span><span class="crumb active">${esc(label)}</span>`;
}

/* ---------- Diagrammalar (CSS/SVG, bog'liqsiz) ---------- */
function emptyChart() { return `<div class="chart-empty">Ma'lumot yo‘q</div>`; }

function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = p(a0), [x2, y2] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}
function donut(data, { fmt = shortNum } = {}) {
  data = data.filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return emptyChart();
  const cx = 95, cy = 95, r = 88; let a = -Math.PI / 2, paths = '';
  data.forEach((d, i) => {
    const ang = a + (d.value / total) * 2 * Math.PI;
    paths += `<path d="${arcPath(cx, cy, r, a, ang)}" fill="${d.color || PALETTE[i % PALETTE.length]}" stroke="#fff" stroke-width="2"><title>${esc(d.label)}: ${fmt(d.value)}</title></path>`;
    a = ang;
  });
  const legend = data.map((d, i) => `<div class="dl"><span class="dot" style="background:${d.color || PALETTE[i % PALETTE.length]}"></span><span class="dl-name">${esc(d.label)}</span><span class="dl-val">${fmt(d.value)}</span></div>`).join('');
  return `<div class="donut-row"><svg viewBox="0 0 190 190" class="donut">${paths}<circle cx="${cx}" cy="${cy}" r="50" fill="#fff"/>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="12" fill="#6b7688">Jami</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="16" font-weight="800" fill="#232a36">${fmt(total)}</text></svg>
    <div class="donut-legend">${legend}</div></div>`;
}
function barsHorizontal(data, { fmt = shortNum } = {}) {
  if (!data.length) return emptyChart();
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return `<div class="hbars">${data.map((d, i) => `
    <div class="hbar-row">
      <span class="hbar-lbl" title="${esc(d.label)}">${esc(d.label)}</span>
      <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(3, (d.value / max) * 100)}%;background:${d.color || PALETTE[i % PALETTE.length]}"></div></div>
      <span class="hbar-val">${fmt(d.value)}</span>
    </div>`).join('')}</div>`;
}
function kpi(icon, color, val, lbl) {
  return `<div class="kpi"><div class="kpi-ico bg-${color}">${icon}</div><div class="kpi-meta"><div class="kpi-val">${val}</div><div class="kpi-lbl">${esc(lbl)}</div></div></div>`;
}

/* ---------- Pollux uslubidagi diagrammalar ---------- */
let gid = 0;
const uid = () => `g${++gid}`;

function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length < 2) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function sparkArea(values, color = '#7b3fd4') {
  const w = 92, h = 46, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [ (i / Math.max(1, values.length - 1)) * (w - 6) + 3, h - 6 - ((v - min) / span) * (h - 12) ]);
  const id = uid();
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${smoothPath(pts)} L ${pts[pts.length - 1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z" fill="url(#${id})"/>
    <path d="${smoothPath(pts)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function areaChart(series, labels, { fmt = shortNum, height = 250 } = {}) {
  const hasData = series.some((s) => s.values.some((v) => v > 0));
  if (!labels.length || !hasData) return emptyChart();
  const w = 700, h = height, padL = 52, padR = 14, padT = 14, padB = 30;
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const step = (w - padL - padR) / Math.max(1, labels.length - 1);
  const yOf = (v) => h - padB - (v / max) * (h - padT - padB);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = padT + (1 - f) * (h - padT - padB);
    return `<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}"/>
      <text class="axis-lbl" x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${fmt(max * f)}</text>`;
  }).join('');
  const body = series.map((s, si) => {
    const pts = s.values.map((v, i) => [padL + i * step, yOf(v)]);
    const id = uid();
    const line = smoothPath(pts);
    const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${h - padB} L ${pts[0][0].toFixed(1)} ${h - padB} Z`;
    const dots = si === 0 ? pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#fff" stroke="${s.color}" stroke-width="2"/>`).join('') : '';
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${s.color}" stop-opacity=".3"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#${id})"/>
      <path d="${line}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round"/>${dots}`;
  }).join('');
  const xlab = labels.map((l, i) => `<text class="axis-lbl" x="${(padL + i * step).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(l)}</text>`).join('');
  const legend = `<div class="legend">${series.map((s) => `<span class="li"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</span>`).join('')}</div>`;
  return `<div class="area-wrap"><svg viewBox="0 0 ${w} ${h}" role="img">${grid}${body}${xlab}</svg>${legend}</div>`;
}

function weekBars(data, { fmt = shortNum } = {}) {
  if (!data.length) return emptyChart();
  const max = Math.max(...data.map((d) => d.value), 1);
  return `<div class="week">${data.map((d) => `
    <div class="week-col ${d.today ? 'today' : ''}" title="${esc(d.label)}: ${fmt(d.value)}">
      <span class="week-val">${fmt(d.value)}</span>
      <div class="week-fill" style="height:${Math.max(6, (d.value / max) * 160)}px;--c1:${d.color};--c2:${d.color2 || d.color}"></div>
      <span class="week-lbl">${esc(d.label)}</span>
    </div>`).join('')}</div>`;
}

function deltaBadge(cur, prev, { fmt = shortNum } = {}) {
  if (!prev) return cur > 0 ? `<span class="delta up">▲ yangi</span>` : `<span class="delta flat">—</span>`;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return `<span class="delta flat">■ ${fmt(cur)}</span>`;
  return `<span class="delta ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span>`;
}

function statCard({ icon, color, label, value, unit, delta = '', spark = '' }) {
  return `<div class="stat"><div class="stat-ico" style="background:${color}">${icon}</div>
    <div class="stat-body"><div class="stat-lbl">${esc(label)}</div>
      <div class="stat-val">${value}${unit ? ` <small>${esc(unit)}</small>` : ''}</div>${delta}</div>${spark}</div>`;
}

const FEED_COLOR = { order: '#5a49d6', paid: '#1f9d55', payment_failed: '#d64545', cancelled: '#8f97a6', expired: '#e0912a', receipt: '#12a5a1', reprice: '#2f6bd8', customer: '#7c5cd6' };
function activityFeed(items) {
  if (!items.length) return emptyChart();
  return `<div class="feed">${items.map((e) => `
    <div class="feed-item"><span class="feed-dot" style="background:${FEED_COLOR[e.kind] || '#8f97a6'}"></span>
      <div><div class="feed-title">${esc(e.title)}</div><div class="feed-meta">${esc(FEED_KIND[e.kind] || e.kind)} · ${esc(e.ref)} · ${esc(timeAgo(e.at))}</div></div>
      <span class="feed-amt" style="color:${e.kind === 'payment_failed' || e.kind === 'expired' ? 'var(--red)' : 'var(--text)'}">${e.amount ? shortNum(e.amount) : ''}</span>
    </div>`).join('')}</div>`;
}
const FEED_KIND = { order: 'Buyurtma', paid: "To'lov", payment_failed: "To'lov rad etildi", cancelled: 'Bekor', expired: 'Muddat', receipt: 'Kirim', reprice: 'Narx', customer: 'Mijoz' };

function activityBlock(items) {
  return `<div class="spread" style="margin-bottom:10px"><div class="card-title" style="margin:0">Do‘konda nima bo‘layapti</div>
    <span class="feed-live">jonli · 15 soniyada yangilanadi</span></div>${activityFeed(items)}`;
}

/* ============================================================
   ROUTER
   ============================================================ */
const app = () => $('#app');
const routes = {
  '': renderCatalog, catalog: renderCatalog, product: renderProduct, cart: renderCart,
  login: renderLogin, register: renderRegister, orders: renderOrders, order: renderOrder,
  dashboard: renderDashboard, receipts: renderReceipts, inventory: renderInventory,
  'price-history': renderPriceHistory, warehouses: renderWarehouses, 'products-new': renderNewProduct,
  'admin-orders': renderAdminOrders, 'admin-login': renderAdminLogin,
};
const CRUMB = {
  '': 'Katalog', product: 'Mahsulot', cart: 'Savat', login: 'Mijoz kirishi', register: 'Ro‘yxatdan o‘tish',
  'admin-login': 'Admin kirishi',
  orders: 'Buyurtmalarim', order: 'Buyurtma', dashboard: 'Boshqaruv paneli', receipts: 'Kirim va narx',
  inventory: 'Qoldiq', 'price-history': 'Narx tarixi', warehouses: 'Omborlar', 'products-new': 'Yangi mahsulot',
  'admin-orders': 'Barcha buyurtmalar',
};

let tickers = [];
function clearTickers() { tickers.forEach(clearInterval); tickers = []; }
function mountCountdown(el, expiresAt) {
  const target = new Date(expiresAt).getTime();
  const tick = () => {
    const ms = target - Date.now();
    if (ms <= 0) { el.textContent = 'Muddat tugadi'; el.classList.add('dead'); clearInterval(id); return; }
    const t = Math.floor(ms / 1000);
    el.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')} ichida to‘lang`;
  };
  tick(); const id = setInterval(tick, 1000); tickers.push(id);
}

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  return { name: segs[0] || '', id: segs[1] || '', params: new URLSearchParams(queryPart || '') };
}

async function render() {
  clearTickers();
  const { name, id, params } = parseHash();
  const fn = routes[name] || renderCatalog;
  app().innerHTML = skeletonFor(name);
  setCrumb(CRUMB[name] || 'Katalog');
  renderSidebar(name);
  syncTopbar();
  document.body.classList.remove('nav-open');
  try { await fn({ id, params }); }
  catch (err) {
    const adminOnly = ADMIN_PAGES.includes(name) || err.code === 'ADMIN_2FA_REQUIRED' || err.code === 'ADMIN_LOGIN_SEPARATE';
    if (err instanceof ApiError && err.status === 401) { app().innerHTML = errorBlock('Bu sahifa uchun tizimga kirish kerak.', adminOnly ? '#/admin-login' : '#/login', adminOnly ? 'Admin kirishi' : 'Kirish'); toast(err.message, 'err'); }
    else if (err instanceof ApiError && err.status === 403) {
      app().innerHTML = adminOnly
        ? errorBlock(err.message, '#/admin-login', 'Admin kirishi (1-bosqich)')
        : errorBlock(err.message, '#/login', 'Boshqa foydalanuvchi bilan kirish');
    }
    else { app().innerHTML = errorBlock(err.message || 'Noto‘g‘ri xato', '#/', 'Bosh sahifa'); }
    console.error(err);
  }
}
const ADMIN_PAGES = ['receipts', 'inventory', 'price-history', 'warehouses', 'products-new', 'admin-orders'];
function skeletonFor(name) {
  return name === '' || name === 'catalog'
    ? `<div class="sk-bar"></div><div class="sk-grid">${'<div class="sk sk-card"></div>'.repeat(8)}</div>`
    : `<div class="sk-stack"><div class="sk sk-title"></div><div class="sk sk-box"></div><div class="sk sk-box short"></div></div>`;
}
function errorBlock(msg, href, label) {
  return `<div class="empty empty-lg"><span class="empty-ico">${I.alert}</span><p>${esc(msg)}</p><a class="btn btn-primary" href="${href}">${esc(label)}</a></div>`;
}
window.addEventListener('hashchange', render);

/* ---------- Query navigatsiya (katalog filtri/saralash/sahifa) ---------- */
window.go = function (patch) {
  const cur = parseHash();
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v === undefined || v === null) params.delete(k); else params.set(k, String(v));
  }
  const base = cur.name || '';
  location.hash = '#/' + (base ? base + (cur.id ? '/' + cur.id : '') : '') + (params.toString() ? '?' + params.toString() : '');
};

/* ============================================================
   VIEW: DASHBOARD
   ============================================================ */
async function renderDashboard() {
  if (!state.user) { renderCatalog(); return; }
  if (state.user.role === 'admin') return adminDashboard();
  return customerDashboard();
}

const DAY_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const dayLabel = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

async function adminDashboard() {
  const st = await api('/admin/stats', { auth: true });
  const k = st.kpi;
  state.pending = k.pending;
  const bell = $('#tb-badge');
  bell.textContent = k.pending; bell.hidden = !k.pending;
  renderSidebar('dashboard');

  const salesData = st.salesByCategory.map((c) => ({ label: c.name, value: c.total }));
  const topData = st.topProducts.map((p) => ({ label: p.name, value: p.revenue }));
  const statusData = st.ordersByStatus.map((o) => ({ label: STATUS[o.status]?.label || o.status, value: o.count }));
  const days = st.revenueByDay;
  const labels = days.map((d) => DAY_SHORT[new Date(d.day + 'T00:00:00').getDay()] + ' ' + dayLabel(d.day));
  const weekColors = days.map((d, i) => ({
    label: DAY_SHORT[new Date(d.day + 'T00:00:00').getDay()],
    value: d.orders,
    today: i === days.length - 1,
    color: i === days.length - 1 ? '#17c1ae' : '#7b3fd4',
    color2: i === days.length - 1 ? '#0e8f80' : '#2f6bd8',
  }));

  app().innerHTML = `
    <div class="stat-grid">
      ${statCard({
    icon: I.coins, color: 'linear-gradient(135deg,#7b3fd4,#5a49d6)', label: 'Bugungi tushum',
    value: shortNum(st.today.total), unit: "so'm",
    delta: deltaBadge(st.today.total, st.today.prev_total),
    spark: sparkArea(days.map((d) => d.total), '#7b3fd4'),
  })}
      ${statCard({
    icon: I.receipt, color: 'linear-gradient(135deg,#2f6bd8,#1f6fd0)', label: 'Buyurtmalar',
    value: k.orders, unit: 'ta',
    delta: `<span class="delta flat">${st.today.orders} ta bugun</span>`,
    spark: sparkArea(days.map((d) => d.orders), '#2f6bd8'),
  })}
      ${statCard({
    icon: I.clock, color: 'linear-gradient(135deg,#e0912a,#c47a12)', label: "To'lov kutilmoqda",
    value: k.pending, unit: 'ta',
    delta: `<span class="delta ${k.pending ? 'down' : 'flat'}">${k.pending ? 'e’lon berildi' : 'xato yo‘q'}</span>`,
  })}
      ${statCard({
    icon: I.box, color: 'linear-gradient(135deg,#12a5a1,#0e8f80)', label: 'Omborda dona',
    value: k.stockUnits, unit: 'dona',
    delta: `<span class="delta flat">${shortNum(k.stockValue)} so'm qiymatda</span>`,
  })}
      ${statCard({
    icon: I.users, color: 'linear-gradient(135deg,#1f9d55,#16803f)', label: 'Mijozlar',
    value: k.customers, unit: 'nafar',
    delta: `<span class="delta flat">${k.products} ta mahsulot</span>`,
  })}
    </div>

    <div class="cta-card">
      <div class="cta-ico">${I.warehouse}</div>
      <div><h3>Ombor: partiya qabul qilish yoki narxni o‘zgartirish</h3>
        <p>Yangi narx <b>butun qoldiqqa</b> qo‘llanadi — masalan 5 000 so‘mdan kelgan suvlar 6 000 bo‘ladi. Eski buyurtmalardagi narx nusxasi o‘zgarmaydi.</p></div>
      <div class="cta-actions">
        <a class="btn" href="#/receipts">Partiya qabul qilish</a>
        <a class="btn btn-soft" href="#/receipts?mode=reprice">Faqat narxni o‘zgartirish</a>
      </div>
    </div>

    <div class="dash-row r-2-1">
      <div class="card card-pad"><div class="card-title">Tushum dinamikasi <span class="sub">so‘nggi 7 kun ↔ undan oldingi 7 kun</span></div>
        ${areaChart([
          { name: 'So‘nggi 7 kun', color: '#7b3fd4', values: days.map((d) => d.total) },
          { name: 'Oldingi 7 kun', color: '#17c1ae', values: st.revenueByDayPrev.map((d) => d.total) },
        ], labels)}</div>
      <div class="card card-pad"><div class="card-title">Umumiy savdo <span class="sub">kategoriyalar</span></div>${donut(salesData, { fmt: shortNum })}</div>
    </div>

    <div class="dash-row r-2-1">
      <div class="card card-pad" id="feed-box">${activityBlock(st.activity)}</div>
      <div class="card card-pad"><div class="card-title">Buyurtmalar holati</div>${donut(statusData, { fmt: (v) => v + ' ta' })}</div>
    </div>

    <div class="dash-row r-1-1">
      <div class="card card-pad"><div class="card-title">Kunlik buyurtmalar soni <span class="sub">7 kun</span></div>${weekBars(weekColors, { fmt: (v) => v + ' ta' })}</div>
      <div class="card card-pad"><div class="card-title">Eng ko‘p sotilgan mahsulotlar</div>${barsHorizontal(topData)}</div>
    </div>

    <div class="dash-row r-1-1">
      <div class="card card-pad"><div class="card-title">Kam qolgan mahsulotlar <span class="sub">≤ 3 dona</span></div>
        ${st.lowStock.length ? `<div class="table-wrap"><table><thead><tr><th>Mahsulot</th><th>Variant</th><th class="num">Mavjud</th></tr></thead><tbody>
          ${st.lowStock.map((r) => `<tr><td>${esc(r.product_name)}</td><td class="muted">${esc(r.variant_name)} · ${esc(r.sku)}</td><td class="num">${stockTag(r.available, 3)}</td></tr>`).join('')}
        </tbody></table></div>` : emptyChart()}</div>
      <div class="card card-pad"><div class="card-title">So‘nggi narx o‘zgarishlari<span class="sub"><a href="#/price-history" class="link-strong">Barchasi →</a></span></div>
        ${st.priceChanges.length ? `<div class="table-wrap"><table><tbody>
          ${st.priceChanges.map((r) => `<tr><td>${esc(r.product_name)}<div class="line-sub">${esc(r.variant_name)} · ${r.kind === 'reprice' ? 'faqat narx' : '+' + r.qty + ' dona kirim'}</div></td>
            <td class="num muted">${priceNum(r.old_price)}</td><td class="num"><b class="price-move" data-dir="${r.unit_price > r.old_price ? 'up' : 'down'}">${priceNum(r.unit_price)}</b></td>
            <td class="muted small-cell">${fmtDate(r.created_at)}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="callout info" style="margin:0">Hali narx o‘zgarishi bo‘lmagan. <a href="#/receipts?mode=reprice" class="link-strong">Narxni yangilash →</a></div>`}</div>
    </div>

    ${st.lastLogin ? `<p class="muted" style="font-size:13px">Oxirgi admin kirishi: <b>${esc(fmtDate(st.lastLogin))}</b></p>` : ''}`;

  // Joni lentasi: 15 soniyada bir faoliyatni qayta tortadi (sahifadan chiqqanda to‘xtaydi).
  tickers.push(setInterval(async () => {
    const box = $('#feed-box');
    if (!box) return;
    try {
      const fresh = await api('/admin/stats', { auth: true });
      box.innerHTML = activityBlock(fresh.activity);
    } catch { /* server javob bermasa — keyingi tick kutadi */ }
  }, 15000));
}

async function customerDashboard() {
  const orders = await api('/orders?limit=50', { auth: true });
  const paid = orders.filter((o) => o.status === 'paid');
  const pending = orders.filter((o) => o.status === 'pending_payment');
  const spent = paid.reduce((s, o) => s + o.total, 0);
  const byStatus = ['pending_payment', 'paid', 'cancelled', 'expired']
    .map((s) => ({ label: STATUS[s].label, value: orders.filter((o) => o.status === s).length }))
    .filter((d) => d.value > 0);

  app().innerHTML = `
    <div class="page-head"><div><h1>Xush kelibsiz, ${esc(state.user.name.split(' ')[0])}!</h1><p>Buyurtmalaringiz va xarid tarixingiz.</p></div>
      <a class="btn btn-primary" href="#/">Katalogga o‘tish</a></div>

    <div class="kpi-grid">
      ${kpi(I.receipt, 'blue', orders.length, 'Buyurtmalarim')}
      ${kpi(I.coins, 'green', money(spent).replace(" so'm", ''), "Sarflangan (so'm)")}
      ${kpi(I.clock, 'amber', pending.length, "To'lov kutilmoqda")}
      ${kpi(I.box, 'teal', paid.length, 'Yetkazib berilgan')}
    </div>

    <div class="charts">
      <div class="card card-pad"><div class="card-title">Buyurtmalar holati</div>${byStatus.length ? donut(byStatus, { fmt: (v) => v + ' ta' }) : emptyChart()}</div>
      <div class="card card-pad"><div class="card-title">So‘nggi buyurtmalar</div>
        ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>№</th><th>Holat</th><th class="num">Summa</th><th></th></tr></thead><tbody>
          ${orders.slice(0, 6).map((o) => `<tr><td><a href="#/order/${o.id}" style="font-weight:700;color:var(--blue-600)">#${o.id}</a></td>
            <td>${statusPill(o.status)}</td><td class="num">${money(o.total)}</td>
            <td>${o.status === 'pending_payment' ? `<a class="btn btn-sm btn-primary" href="#/order/${o.id}">To‘lash</a>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : emptyChart()}</div>
    </div>`;
}

/* ============================================================
   VIEW: KATALOG
   ============================================================ */
async function renderCatalog({ params }) {
  const category = params.get('category') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'newest';
  const page = Math.max(1, Number(params.get('page') || 1));
  const cats = await api('/categories');
  const data = await api(`/products?limit=12&page=${page}&sort=${sort}${category ? '&category=' + encodeURIComponent(category) : ''}${q ? '&q=' + encodeURIComponent(q) : ''}`);
  const meta = data.meta || { page: 1, total_pages: 1 };

  const chips = [`<button class="chip ${!category ? 'active' : ''}" onclick="go({category:''})">Barchasi</button>`]
    .concat(cats.map((c) => `<button class="chip ${c.slug === category ? 'active' : ''}" onclick="go({category:'${c.slug}',page:1})">${esc(c.name)}</button>`)).join('');

  const cards = data.length ? data.map(productCard).join('') : `<div class="empty" style="grid-column:1/-1">${q ? `“${esc(q)}” bo‘yicha mahsulot topilmadi.` : 'Bu kategoriyada mahsulot topilmadi.'}</div>`;

  app().innerHTML = `
    ${q || category ? '' : `<div class="assure">
      <div class="assure-item">${I.truck}<div><b>1–2 kunda yetkazamiz</b><span>Toshkent va viloyat omborlaridan</span></div></div>
      <div class="assure-item">${I.shield}<div><b>Qoldiq real vaqtda</b><span>Har bir buyurtma omborda band qilinadi</span></div></div>
      <div class="assure-item">${I.refresh}<div><b>Rasmiy narx</b><span>Ombordagi kirim narxidan o‘zgarmaydi</span></div></div>
    </div>`}

    <div class="catalog-bar">
      <div>
        <h1 class="cb-title">${q ? `“${esc(q)}” — ${meta.total} ta natija` : category ? esc((cats.find((c) => c.slug === category) || {}).name || 'Katalog') : 'Butun katalog'}</h1>
        <p class="cb-sub">Narxlar so‘mda · qoldiq ombordagi mavjud miqdor</p>
      </div>
      <div class="cb-tools">
        ${q ? `<button class="chip chip-x" onclick="go({q:'',page:1})">Qidiruvni tozalash<span aria-hidden="true">×</span></button>` : ''}
        <select onchange="go({sort:this.value,page:1})" aria-label="Saralash">
          <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Avval yangi kelganlar</option>
          <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>Narx: arzondan</option>
          <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>Narx: qimmatdan</option>
        </select>
      </div>
    </div>

    <div class="filters"><div class="chips">${chips}</div></div>
    <div class="grid">${cards}</div>${pagination(meta)}`;
}

function productCard(p) {
  const stock = p.available_stock;
  return `<a class="prod" href="#/product/${esc(p.slug)}">
    <div class="prod-media" style="--ink:${CAT_INK[glyphKey(p.category_slug)]}">${glyphSvg(p.category_slug)}
      <span class="media-badge">${stockTag(stock, 3)}</span></div>
    <div class="prod-body"><span class="prod-cat">${esc(p.category_name)}</span>
      <span class="prod-title">${esc(p.name)}</span>
      <span class="prod-desc">${esc(p.description || '')}</span>
      <div class="prod-foot">
        <span class="price">${p.min_price != null ? `${priceNum(p.min_price)} <small>so'm</small>` : '—'}</span>
        <span class="prod-cta">Batafsil<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
      </div>
    </div></a>`;
}

function pagination(meta) {
  if (meta.total_pages <= 1) return '';
  let out = '<div class="pager">';
  out += `<button ${meta.page <= 1 ? 'disabled' : ''} onclick="go({page:${meta.page - 1}})">‹</button>`;
  const pages = [];
  for (let i = 1; i <= meta.total_pages; i++) {
    if (i === 1 || i === meta.total_pages || Math.abs(i - meta.page) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  for (const i of pages) out += i === '…' ? `<button disabled>…</button>` : `<button class="${i === meta.page ? 'active' : ''}" onclick="go({page:${i}})">${i}</button>`;
  return out + `<button ${meta.page >= meta.total_pages ? 'disabled' : ''} onclick="go({page:${meta.page + 1}})">›</button></div>`;
}

/* ============================================================
   VIEW: MAHSULOT DETALI
   ============================================================ */
let pdl = null;
async function renderProduct({ id }) {
  const p = await api('/products/' + encodeURIComponent(id));
  pdl = { product: p, variantId: p.variants[0]?.id ?? null, qty: 1 };
  const variants = p.variants.length ? p.variants.map((v, i) => `
    <div class="variant ${v.available_stock <= 0 ? 'out' : ''} ${i === 0 ? 'selected' : ''}" data-vid="${v.id}" onclick="pickVariant(${v.id})">
      <span class="v-radio" aria-hidden="true"></span>
      <div><div class="v-name">${esc(v.name)}</div><div class="v-sku">${esc(v.sku)} · omborda ${v.available_stock} dona</div></div>
      <div class="v-right"><span class="v-price">${priceNum(v.price)} <small>so‘m</small></span>${stockTag(v.available_stock, Math.min(5, p.max_purchase_qty))}</div>
    </div>`).join('') : `<div class="empty">Hozircha variantlar yo‘q.</div>`;

  app().innerHTML = `
    <div class="page-head"><a href="#/" class="back-link">← Katalogga qaytish</a></div>
    <div class="product-hero">
      ${mediaTile(p.category_slug, 'product-media')}
      <div class="product-info">
        <span class="prod-cat">${esc(p.category_name)}</span><h1>${esc(p.name)}</h1>
        <p class="muted lead">${esc(p.description || '')}</p>
        <div class="rule-list">
          <div class="rule">${I.truck}<span>1–2 kunda yetkazib berish</span></div>
          <div class="rule">${I.refresh}<span>Qoldiq omborda real vaqtda band qilinadi</span></div>
          <div class="rule">${I.tag}<span>Bir buyurtmada ko‘pi bilan <b>${p.max_purchase_qty}</b> dona</span></div>
        </div>

        <h3 class="mt">Variantni tanlang</h3><div class="variant-list" id="variants">${variants}</div>
        <div class="buy-bar">
          <div>
            <div class="field-label">Miqdor</div>
            <div class="qty-box"><button onclick="bumpQty(-1)" aria-label="Kamaytirish">−</button><input id="qty-input" type="number" value="1" min="1" onchange="setQty(this.value)"><button onclick="bumpQty(1)" aria-label="Ko‘paytirish">+</button></div>
          </div>
          <div class="buy-total"><div class="field-label">Jami</div><div class="price price-lg" id="pd-total">—</div></div>
          <div class="buy-actions">
            <button class="btn btn-ghost btn-lg" onclick="addToCart(false)">${I.cart}<span>Savatga</span></button>
            <button class="btn btn-primary btn-lg" onclick="buyNow()">Darhol xarid qilish</button>
          </div>
        </div>
      </div>
    </div>`;
  updatePdTotal();
}
function pickVariant(vid) { pdl.variantId = vid; $$('#variants .variant').forEach((el) => el.classList.toggle('selected', Number(el.dataset.vid) === vid)); updatePdTotal(); }
function currentVariant() { return pdl.product.variants.find((v) => v.id === pdl.variantId); }
function setQty(v) {
  const max = pdl.product.max_purchase_qty, avail = currentVariant()?.available_stock ?? 0;
  let n = Math.max(1, Math.floor(Number(v) || 1)); n = Math.min(n, max, Math.max(1, avail));
  pdl.qty = n; $('#qty-input').value = n; updatePdTotal();
}
function bumpQty(d) { setQty((pdl.qty || 1) + d); }
function updatePdTotal() { const v = currentVariant(); const el = $('#pd-total'); if (el) el.innerHTML = v ? `${priceNum(v.price * pdl.qty)} <small>so‘m</small>` : '—'; }
async function addToCart(openCart) {
  try { await api('/cart/items', { method: 'POST', auth: true, body: { variant_id: pdl.variantId, qty: pdl.qty } }); await refreshCartBadge(); toast('Savatga qo‘shildi', 'ok'); if (openCart) location.hash = '#/cart'; }
  catch (e) { handleErr(e); }
}
async function buyNow() {
  try { const order = await api('/orders', { method: 'POST', auth: true, body: { items: [{ variant_id: pdl.variantId, qty: pdl.qty }], address: '' } }); toast('Buyurtma yaratildi — endi to‘lang', 'ok'); location.hash = '#/order/' + order.id; }
  catch (e) { handleErr(e); }
}

/* ============================================================
   VIEW: SAVAT
   ============================================================ */
async function renderCart() {
  const cart = await api('/cart', { auth: true });
  const lines = cart.items.length ? cart.items.map((it) => `
    <div class="line">
      <div class="line-thumb" style="--ink:${CAT_INK[glyphKey(it.category_slug)]}">${glyphSvg(it.category_slug)}</div>
      <div><a class="line-name" href="#/product/${esc(it.product_slug)}">${esc(it.product_name)}</a>
        <div class="line-sub">${esc(it.variant_name)} · ${esc(it.sku)} · ${money(it.unit_price)}</div>
        <div class="line-sub">Omborda: ${it.available_stock} dona · limit ${it.max_purchase_qty}</div></div>
      <div class="qty-box"><button onclick="cartQty(${it.cart_item_id},${it.qty - 1})" aria-label="Kamaytirish">−</button><input type="number" value="${it.qty}" min="1" onchange="cartQty(${it.cart_item_id},this.value)"><button onclick="cartQty(${it.cart_item_id},${it.qty + 1})" aria-label="Ko‘paytirish">+</button></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px"><div class="line-price">${money(it.line_total)}</div><button class="btn btn-link-danger btn-sm" onclick="cartRemove(${it.cart_item_id})">O‘chirish</button></div>
    </div>`).join('') : `<div class="empty empty-lg"><span class="empty-ico">${I.cart}</span><h2>Savatingiz hozircha bo‘sh</h2>
      <p>Katalogdan mahsulot tanlang — qoldiq va narx ombordagi haqiqiy qiymatdan olinadi.</p>
      <a class="btn btn-primary btn-lg" href="#/">${I.grid}<span>Katalogga o‘tish</span></a></div>`;

  app().innerHTML = `
    <div class="page-head"><div><h1>Savat</h1><p>${cart.items.length} ta mahsulot · jami ${money(cart.total)}</p></div>
      <a class="btn btn-ghost" href="#/">${I.plus}<span>Mahsulot qo‘shish</span></a></div>
    ${cart.items.length ? `<div class="two-col"><div class="card card-pad"><div class="card-title">Savatdagi mahsulotlar<span class="sub">${cart.items.length} pozitsiya</span></div>${lines}</div>
      <div class="card card-pad"><div class="card-title">Buyurtmani rasmiylashtirish</div>
        <div class="field"><label>Yetkazib berish manzili</label><textarea id="address" rows="2" placeholder="Ko‘cha, uy, kvartira, shahar"></textarea></div>
        <div class="summary"><div class="spread"><span class="muted">Pozitsiyalar</span><span>${cart.items.length}</span></div>
          <div class="spread"><span class="muted">Yetkazib berish</span><span>Bepul</span></div>
          <div class="spread grand"><span>Jami</span><span>${money(cart.total)}</span></div></div>
        <button class="btn btn-primary btn-block btn-lg mt" onclick="checkout()">Buyurtma berish</button>
        <button class="btn btn-ghost btn-block mt" onclick="clearCart()">Savatni bo‘shatish</button>
        <p class="fineprint">Buyurtma berganda qoldiq bitta tranzaksiyada rezerv qilinadi, narx nusxasi muzlaydi va 15 daqiqa ichida to‘lov kerak bo‘ladi.</p>
      </div></div>` : lines}`;
}
async function cartQty(itemId, qty) { qty = Math.max(1, Math.floor(Number(qty) || 1)); try { await api('/cart/items/' + itemId, { method: 'PATCH', auth: true, body: { qty } }); await refreshCartBadge(); render(); } catch (e) { handleErr(e); render(); } }
async function cartRemove(id) { try { await api('/cart/items/' + id, { method: 'DELETE', auth: true }); await refreshCartBadge(); render(); } catch (e) { handleErr(e); } }
async function clearCart() { try { await api('/cart', { method: 'DELETE', auth: true }); await refreshCartBadge(); render(); } catch (e) { handleErr(e); } }
async function checkout() {
  try { const order = await api('/orders', { method: 'POST', auth: true, body: { address: $('#address')?.value || '' } }); await refreshCartBadge(); toast('Buyurtma qabul qilindi', 'ok'); location.hash = '#/order/' + order.id; }
  catch (e) { handleErr(e); }
}

/* ============================================================
   VIEW: BUYURTMALAR
   ============================================================ */
async function renderOrders({ params }) {
  const status = params.get('status') || '';
  const page = Math.max(1, Number(params.get('page') || 1));
  const data = await api(`/orders?limit=10&page=${page}${status ? '&status=' + status : ''}`, { auth: true });
  const meta = data.meta || { page: 1, total_pages: 1 };
  const tabs = ['pending_payment', 'paid', 'cancelled', 'expired'];
  const filter = `<div class="tabs"><button class="${!status ? 'active' : ''}" onclick="go({status:''})">Barchasi</button>
    ${tabs.map((t) => `<button class="${status === t ? 'active' : ''}" onclick="go({status:'${t}',page:1})">${STATUS[t].label}</button>`).join('')}</div>`;
  const rows = data.length ? data.map((o) => `<tr>
    <td><a href="#/order/${o.id}" style="font-weight:700;color:var(--blue-600)">#${o.id}</a></td>
    <td>${statusPill(o.status)}</td><td class="num">${o.item_count}</td><td class="num">${money(o.total)}</td>
    <td>${esc(fmtDate(o.created_at))}</td>
    <td>${o.status === 'pending_payment' ? `<a class="btn btn-sm btn-primary" href="#/order/${o.id}">To‘lash</a>` : ''}</td></tr>`).join('')
    : `<tr><td colspan="6" class="empty" style="border:0">Buyurtmalar yo‘q.</td></tr>`;
  app().innerHTML = `<div class="page-head"><div><h1>Buyurtmalarim</h1><p>Har bir buyurtma yaratilgan paytidagi narx bilan saqlanadi — keyingi narx o‘zgarishlari unga tegizmaydi.</p></div></div>
    ${filter}<div class="table-wrap"><table><thead><tr><th>№</th><th>Holat</th><th class="num">Tarkib</th><th class="num">Summa</th><th>Yaratilgan</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${pagination(meta)}`;
}

async function renderOrder({ id }) {
  const o = await api('/orders/' + id, { auth: true });
  const isPending = o.status === 'pending_payment';
  const payPanel = isPending ? `
    <div class="card card-pad"><div class="spread"><div class="card-title" style="margin:0">To‘lov</div><span class="countdown" id="cd"></span></div>
      <div class="callout warn" style="margin-top:12px"><strong>Rezerv faol</strong>${money(o.total)} uchun qoldiq band qilindi. Bu vaqt ichida to‘lanmasa, buyurtma “muddati o‘tgan” bo‘ladi va qoldiq omborga qaytadi.</div>
      <div class="row"><button class="btn btn-primary btn-block" onclick="pay(${o.id},'succeeded')">${I.check}<span>To‘lovni tasdiqlash</span></button>
        <button class="btn btn-ghost btn-block" onclick="pay(${o.id},'failed')">Muvaffaqiyatsiz to‘lovni sinab ko‘rish</button></div>
      <p class="fineprint">Tugma soxta provayder rolida serverda imzolangan callback yuboradi (HMAC-SHA256). Imzo kaliti brauzerga berilmaydi.</p>
      <div class="divider"></div>
      <button class="btn btn-danger btn-block" onclick="cancelOrder(${o.id})">Buyurtmani bekor qilish</button>
      <p class="fineprint">Bekor qilishda qoldiq faqat bir marta qaytariladi; yopilgan buyurtmani API orqali qayta ochib bo‘lmaydi.</p>
    </div>`
    : `<div class="card card-pad"><div class="card-title">Holat</div>${statusPill(o.status)}
      <p class="muted mt">${o.status === 'paid' ? "To‘lov qabul qilindi, qoldiq ombordan yechildi." : o.status === 'cancelled' ? 'Buyurtma bekor qilindi, qoldiq qaytarildi.' : 'Muddat tugadi, qoldiq avtomatik qaytarildi.'}</p>
      ${o.paid_at ? `<p class="muted">To‘langan: ${esc(fmtDate(o.paid_at))}</p>` : ''}</div>`;

  const lines = o.items.map((it) => `<div class="line">
    <div class="line-letter">${esc(it.product_name.slice(0, 2).toUpperCase())}</div>
    <div><div class="line-name">${esc(it.product_name)}</div><div class="line-sub">${esc(it.variant_name)} · ${esc(it.sku)}</div><div class="line-sub">Narx nusxasi: ${money(it.unit_price)} × ${it.qty}</div></div>
    <div class="line-qty">${it.qty} dona</div><div class="line-price">${money(it.line_total)}</div></div>`).join('');

  app().innerHTML = `
    <div class="page-head"><div><a href="#/orders" class="back-link">← Buyurtmalar</a>
      <h1>Buyurtma #${o.id}</h1><p>${statusPill(o.status)} · ${esc(fmtDate(o.created_at))}</p></div></div>
    <div class="two-col"><div><div class="card card-pad"><div class="card-title">Tarkibi</div>${lines}<div class="summary"><div class="spread grand"><span>Jami</span><span>${money(o.total)}</span></div></div></div>
      ${o.address ? `<div class="card card-pad mt"><div class="card-title">Yetkazib berish manzili</div><p class="muted" style="margin:0">${esc(o.address)}</p></div>` : ''}</div>
      <div>${payPanel}</div></div>`;
  if (isPending && o.expires_at) mountCountdown($('#cd'), o.expires_at);
}
async function pay(orderId, status) {
  try { const res = await api('/payments/simulate', { method: 'POST', auth: true, body: { order_id: orderId, status } }); const r = res.result;
    const map = { paid: "To‘lov qabul qilindi", already_processed: 'Bu to‘lov allaqachon qayta ishlangan (idempotent)', failed_recorded: 'Muvaffaqiyatsiz to‘lov qayd etildi' };
    toast(map[r] || 'Jarayon tugadi', r === 'failed_recorded' ? 'info' : 'ok'); render(); }
  catch (e) { handleErr(e); render(); }
}
async function cancelOrder(orderId) { try { await api(`/orders/${orderId}/cancel`, { method: 'POST', auth: true, body: {} }); toast('Buyurtma bekor qilindi, qoldiq qaytarildi', 'ok'); render(); } catch (e) { handleErr(e); render(); } }

/* ============================================================
   VIEW: LOGIN / REGISTER
   ============================================================ */
function renderLogin() {
  app().innerHTML = `<div class="auth-card card">
    <div class="auth-head"><span class="auth-badge">Mijoz uchun</span><h1>Tizimga kirish</h1>
      <p>Administrator hisoblari bu sahifadan kirmaydi — ular uchun alohida <b>ikki bosqichli</b> kirish ishlatiladi.</p></div>
    <div class="auth-body">
      <div class="demo-fill"><div class="demo-title">Demo akkaunt — bosing, maydonlar o‘zi to‘ladi</div>
        <button type="button" class="demo-btn" onclick="fillLogin('aziz@example.com','Aziz123!')"><b>Aziz</b><span>aziz@example.com</span></button>
        <button type="button" class="demo-btn" onclick="fillLogin('malika@example.com','Malika123!')"><b>Malika</b><span>malika@example.com</span></button></div>
      <form id="login-form" onsubmit="submitLogin(event)">
        <div class="field"><label>Email</label><input name="email" type="email" required placeholder="siz@demo.uz"></div>
        <div class="field"><label>Parol</label><input name="password" type="password" required placeholder="Parolingiz"></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Kirish</button></form>
      <div class="auth-foot">Hisobingiz yo‘qmi? <a href="#/register">Ro‘yxatdan o‘tish</a>
        <span class="dot">·</span><a href="#/admin-login">Admin kirishi</a></div>
    </div></div>`;
}
function fillLogin(email, password) { const f = $('#login-form'); f.email.value = email; f.password.value = password; }
async function submitLogin(e) {
  e.preventDefault(); const f = new FormData(e.target);
  try { const data = await api('/auth/login', { method: 'POST', body: { email: f.get('email'), password: f.get('password') } });
    setAuth(data.token, data.user); await refreshCartBadge(); toast(`Xush kelibsiz, ${data.user.name}!`, 'ok'); location.hash = '#/dashboard'; render(); }
  catch (err) {
    if (err.code === 'ADMIN_LOGIN_SEPARATE') { toast('Bu admin hisobi — ikki bosqichli kirish sahifasiga o‘tdik', 'info'); location.hash = '#/admin-login'; return; }
    toast(err.message, 'err');
  }
}

/* ---------- Alohida ikki bosqichli ADMIN kirishi ---------- */
function renderAdminLogin() {
  if (state.user?.role === 'admin') {
    app().innerHTML = `<div class="auth-card card"><div class="auth-head"><span class="auth-badge ok">Kirilgan</span>
      <h1>Siz allaqachon kirdingiz</h1><p>${esc(state.user.name)} — administrator, ikki bosqichdan o‘tgan.</p></div>
      <div class="auth-body"><a class="btn btn-primary btn-block btn-lg" href="#/dashboard">Boshqaruv paneliga o‘tish</a></div></div>`;
    return;
  }
  app().innerHTML = `<div class="auth-card card">
    <div class="auth-head admin"><span class="auth-badge">1 / 2 bosqich</span><h1>Admin kirishi</h1>
      <p>Bu sahifa faqat administratorlar uchun. Hisob paroli bilan admin API ga kira olmaysiz —
        server ikkinchi (alik) parolni ham majburiy tekshiradi.</p></div>
    ${stepsBar(1)}
    <div class="auth-body">
      <div class="demo-fill"><div class="demo-title">Demo admin — bosing, maydonlar o‘zi to‘ladi</div>
        <button type="button" class="demo-btn" onclick="fillAdminLogin()"><b>admin@shop.uz</b><span>hisob paroli kiritiladi</span></button></div>
      <form id="admin-form-1" onsubmit="submitAdminStep1(event)">
        <div class="field"><label>Email</label><input name="email" type="email" required placeholder="admin@shop.uz"></div>
        <div class="field"><label>Hisob paroli</label><input name="password" type="password" required placeholder="Hisob paroli"></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Davom etish</button></form>
      <div class="auth-foot">Mijozsizmi? <a href="#/login">Mijoz kirishi</a><span class="dot">·</span><a href="#/register">Ro‘yxatdan o‘tish</a></div>
    </div></div>`;
}
function stepsBar(active) {
  return `<div class="steps"><div class="step ${active >= 1 ? 'on' : ''}"><span>1</span>Hisob paroli</div>
    <div class="step-line"></div><div class="step ${active >= 2 ? 'on' : ''}"><span>2</span>Ikkinchi parol</div></div>`;
}
function fillAdminLogin() { const f = $('#admin-form-1'); f.email.value = 'admin@shop.uz'; f.password.value = 'devament11'; }

async function submitAdminStep1(e) {
  e.preventDefault(); const f = new FormData(e.target);
  try {
    const d = await api('/auth/admin/login', { method: 'POST', body: { email: f.get('email'), password: f.get('password') } });
    adminChallenge = { challenge: d.challenge, name: d.name, expiresAt: Date.now() + d.expires_in * 1000 };
    renderAdminStep2();
  } catch (err) { toast(err.message, 'err'); }
}

function renderAdminStep2() {
  const left = Math.max(0, Math.round(((adminChallenge?.expiresAt || 0) - Date.now()) / 1000));
  app().innerHTML = `<div class="auth-card card">
    <div class="auth-head admin"><span class="auth-badge ok">Hisob paroli qabul qilindi</span><h1>Ikkinchi parol</h1>
      <p><b>${esc(adminChallenge.name)}</b> — endi admin uchun belgilangan <b>alik (ikkinchi) parolni</b> kiriting.
        U brauzerda saqlanmaydi va faqat shu so‘rovda yuboriladi.</p></div>
    ${stepsBar(2)}
    <div class="auth-body">
      <div class="callout warn" style="margin-bottom:14px">Bu bosqich <b><span id="a2fa-left">${left}</span> soniyadan</b> keyin bekor bo‘ladi.</div>
      <form id="admin-form-2" onsubmit="submitAdminStep2(event)">
        <div class="field"><label>Ikkinchi parol</label><input name="second_password" type="password" required autofocus placeholder="Ikkinchi parol"></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Panelga kirish</button></form>
      <p class="center mt"><button class="btn btn-ghost btn-sm" onclick="adminChallenge=null;renderAdminLogin()">← Birinchi bosqichga qaytish</button></p>
    </div></div>`;

  const id = setInterval(() => {
    const el = $('#a2fa-left');
    if (!el) { clearInterval(id); return; }
    const s = Math.max(0, Math.round((adminChallenge.expiresAt - Date.now()) / 1000));
    el.textContent = s;
    if (s <= 0) { clearInterval(id); adminChallenge = null; toast('Birinchi bosqich muddati tugadi', 'err'); renderAdminLogin(); }
  }, 1000);
  tickers.push(id);
}

async function submitAdminStep2(e) {
  e.preventDefault();
  if (!adminChallenge) { renderAdminLogin(); return; }
  const f = new FormData(e.target);
  try {
    const d = await api('/auth/admin/verify', { method: 'POST', body: { challenge: adminChallenge.challenge, second_password: f.get('second_password') } });
    adminChallenge = null;
    setAuth(d.token, d.user); await refreshCartBadge();
    toast(`Xush kelibsiz, ${d.user.name}! Ikki bosqichli tekshiruvdan o‘tding`, 'ok');
    location.hash = '#/dashboard'; render();
  } catch (err) {
    if (err.code === 'ADMIN_CHALLENGE_INVALID') { adminChallenge = null; toast(err.message, 'err'); renderAdminLogin(); }
    else toast(err.message, 'err');
  }
}
function renderRegister() {
  app().innerHTML = `<div class="auth-card card">
    <div class="auth-head"><span class="auth-badge">Yangi hisob</span><h1>Ro‘yxatdan o‘tish</h1>
      <p>Yangi hisob avtomatik <b>mijoz</b> rolini oladi — admin huquqi berilmaydi.</p></div>
    <div class="auth-body">
      <form id="reg-form" onsubmit="submitRegister(event)">
        <div class="field"><label>Ism familiya</label><input name="name" required minlength="2" placeholder="Masalan: Aziz Karimov"></div>
        <div class="field"><label>Email</label><input name="email" type="email" required placeholder="siz@demo.uz"></div>
        <div class="field"><label>Parol</label><input name="password" type="password" required minlength="6" placeholder="Kamida 6 belgi"><div class="hint">Parol bazada hisob-kitob (hash) ko‘rinishida saqlanadi.</div></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Hisob yaratish</button></form>
      <div class="auth-foot">Hisobingiz bormi? <a href="#/login">Kirish</a></div>
    </div></div>`;
}
async function submitRegister(e) {
  e.preventDefault(); const f = new FormData(e.target);
  try { const data = await api('/auth/register', { method: 'POST', body: { name: f.get('name'), email: f.get('email'), password: f.get('password') } });
    setAuth(data.token, data.user); toast('Hisob yaratildi, xush kelibsiz', 'ok'); location.hash = '#/'; render(); }
  catch (err) { toast(err.message, 'err'); }
}

/* ============================================================
   ADMIN VIEW: KIRIM (qabul + qayta-narxlash)
   ============================================================ */
function requireAdmin() { if (state.user?.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Bu sahifa faqat administrator uchun (serverda tekshiriladi).'); }

async function renderReceipts({ params } = {}) {
  requireAdmin();
  const mode = params?.get('mode') === 'reprice' ? 'reprice' : 'receipt';
  const [variants, whs, receipts] = await Promise.all([
    api('/admin/variants', { auth: true }), api('/admin/warehouses', { auth: true }), api('/admin/receipts', { auth: true }),
  ]);
  window._varMap = Object.fromEntries(variants.map((v) => [v.id, v]));

  const optGroups = {};
  variants.forEach((v) => { (optGroups[v.product_name] ||= []).push(v); });
  const variantOpts = Object.entries(optGroups).map(([pn, vs]) =>
    `<optgroup label="${esc(pn)}">${vs.map((v) => `<option value="${v.id}">${esc(v.variant_name)} · ${esc(v.sku)}</option>`).join('')}</optgroup>`).join('');
  const whOpts = whs.map((w) => `<option value="${w.id}">${esc(w.name)} (${esc(w.code)})</option>`).join('');

  app().innerHTML = `
    <div class="page-head"><div><h1>Kirim va narx boshqaruvi</h1>
      <p>Partiya qabul qilish va narxni qayta belgilash — har ikkisi ham butun qoldiqqa ta’sir qiladi.</p></div></div>

    <div class="mode-tabs">
      <button type="button" class="mode-tab ${mode === 'receipt' ? 'active' : ''}" onclick="setReceiptMode('receipt')">
        <span class="mt-ico">${I.inbox}</span>
        <span class="mt-text"><b>1. Yangi partiya keldi</b><small>Qoldiq oshadi va narx yangilanadi</small></span></button>
      <button type="button" class="mode-tab ${mode === 'reprice' ? 'active' : ''}" onclick="setReceiptMode('reprice')">
        <span class="mt-ico">${I.tag}</span>
        <span class="mt-text"><b>2. Faqat narxni o‘zgartirish</b><small>Partiya kelmaydi — mavjud qoldiq yangi narxga o‘tadi</small></span></button>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-head"><div><div class="card-title" style="margin:0">${mode === 'receipt' ? 'Yangi partiyani qabul qilish' : 'Narxni qayta belgilash'}</div>
          <p class="card-sub">${mode === 'receipt'
    ? 'Masalan: birinchi kun 200 dona suv 5 000 so‘mdan keldi. Ertasi yana partiya keldi va narx 6 000 bo‘ldi — qoldiq shu yerda qo‘shiladi, narx ham ko‘tariladi.'
    : 'Masalan: omborda 5 000 so‘mdan kelgan 200 dona suv turibdi, lekin yangi partiya kelmadi. Shu formani ishlatib, butun qoldiq narxini 6 000 ga o‘zgartirasiz.'}</p></div></div>
        <div class="card-pad">
        ${mode === 'receipt' ? `
          <form onsubmit="submitReceipt(event)">
            <div class="field"><label>Mahsulot varianti</label><select name="variant_id" id="rc-var" required onchange="rcPreview()">${variantOpts}</select></div>
            <div class="form-grid">
              <div class="field"><label>Qabul qilingan miqdor (dona)</label><input name="qty" id="rc-qty" type="number" min="1" value="200" required oninput="rcPreview()"></div>
              <div class="field"><label>Yangi narx (so‘m)</label><input name="unit_price" id="rc-price" type="number" min="0" required placeholder="masalan 6000" oninput="rcPreview()"></div>
            </div>
            <div class="field"><label>Ombor</label><select name="warehouse_id" required>${whOpts}</select></div>
            <div class="field"><label>Izoh (ixtiyoriy)</label><input name="note" placeholder="masalan: narx ko‘tarildi"></div>
            <div class="effect" id="rc-effect"></div>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Qabul qilish va narxni yangilash</button>
          </form>` : `
          <form onsubmit="submitReprice(event)">
            <div class="field"><label>Mahsulot varianti</label><select name="variant_id" id="rp-var" required onchange="rcPreview()">${variantOpts}</select></div>
            <div class="field"><label>Yangi narx (so‘m)</label><input name="unit_price" id="rp-price" type="number" min="0" required placeholder="masalan 6000" oninput="rcPreview()"></div>
            <div class="field"><label>Izoh (ixtiyoriy)</label><input name="note" placeholder="masalan: yetkazib beruvchi narxni ko‘tardi"></div>
            <div class="effect" id="rp-effect"></div>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Narxni butun qoldiqqa qo‘llash</button>
            <p class="fineprint">Eski buyurtmalardagi narx nusxasi o‘zgarmaydi — faqat yangi buyurtmalar yangi narxda sotiladi.</p>
          </form>`}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title" style="margin:0">So‘nggi amallar<span class="sub"><a href="#/price-history" class="link-strong">To‘liq tarix →</a></span></div></div>
        <div class="table-wrap" style="border:0;border-radius:0 0 14px 14px">
          ${receipts.length ? `<table><thead><tr><th>Amal</th><th class="num">Narx</th></tr></thead><tbody>
            ${receipts.slice(0, 12).map((r) => `<tr><td>
              <div class="hist-kind">${r.kind === 'reprice' ? 'Faqat narx' : '+' + r.qty + ' dona'}
                <span class="hist-sub">${esc(r.product_name)} · ${esc(r.warehouse_code || 'barcha ombor')}</span></div>
              <div class="line-sub">${esc(fmtDate(r.created_at))}</div></td>
              <td class="num">${r.old_price !== r.unit_price
    ? `<span class="old-price">${priceNum(r.old_price)}</span> <span class="arrow-sep">→</span> <span class="new-price" style="color:${r.unit_price > r.old_price ? 'var(--green)' : 'var(--red)'}">${priceNum(r.unit_price)}</span>`
    : `<b>${priceNum(r.unit_price)}</b>`}</td></tr>`).join('')}
          </tbody></table>` : emptyChart()}</div>
      </div>
    </div>`;
  rcPreview();
}

function setReceiptMode(mode) { location.hash = '#/receipts' + (mode === 'reprice' ? '?mode=reprice' : ''); }

// Formani yozib bo'lgunicha: o'zgarish qaysi qoldiqqa qancha ta'sir qilishini ko'rsatamiz.
function rcPreview() {
  const map = window._varMap || {};
  const eff = (el, vid, newPrice, addQty) => {
    if (!el) return;
    const v = map[Number(vid)];
    if (!v) { el.innerHTML = ''; return; }
    const np = Number(newPrice);
    const hasPrice = String(newPrice ?? '').trim() !== '' && Number.isFinite(np) && np >= 0;
    const priceChanged = hasPrice && np !== v.price;
    const units = v.on_hand + (addQty || 0);
    const rows = [
      `<div class="eff-row"><span>Hozirgi narx</span><b>${money(v.price)}</b></div>`,
      hasPrice
        ? `<div class="eff-row strong"><span>Yangi narx</span><b style="color:${np > v.price ? 'var(--green)' : np < v.price ? 'var(--red)' : 'var(--muted)'}">${money(np)}${np === v.price ? ' <span class="same-tag">o‘zgarmaydi</span>' : ''}</b></div>`
        : `<div class="eff-row"><span>Yangi narx</span><b class="muted">hali kiritilmagan</b></div>`,
      addQty ? `<div class="eff-row"><span>Qoldiq</span><b>${v.on_hand} + ${addQty} = ${units} dona</b></div>`
        : `<div class="eff-row"><span>Qoldiq (o‘zgarmaydi)</span><b>${v.on_hand} dona</b></div>`,
    ];
    if (priceChanged) {
      rows.push(`<div class="eff-row total"><span>Yangi narxda sotiladi</span><b>${units} dona × ${priceNum(np)} so‘m</b></div>`);
      rows.push(`<div class="eff-row"><span>Ombor qiymati</span><b>${shortNum(units * np)} so‘m</b></div>`);
    }
    el.innerHTML = rows.filter(Boolean).join('');
  };
  const rcVar = $('#rc-var');
  if (rcVar) {
    eff($('#rc-effect'), rcVar.value, $('#rc-price')?.value, Number($('#rc-qty')?.value) || 0);
    const up = $('#rc-price');
    if (up && !up.value) { up.value = map[Number(rcVar.value)]?.price ?? ''; rcPreview(); }
    return;
  }
  const rpVar = $('#rp-var');
  if (rpVar) eff($('#rp-effect'), rpVar.value, $('#rp-price')?.value, 0);
}

async function submitReceipt(e) {
  e.preventDefault(); const f = new FormData(e.target);
  try {
    const r = await api('/admin/receipts', { method: 'POST', auth: true, body: { variant_id: Number(f.get('variant_id')), warehouse_id: Number(f.get('warehouse_id')), qty: Number(f.get('qty')), unit_price: Number(f.get('unit_price')), note: f.get('note') || '' } });
    const changed = r.receipt.old_price !== r.receipt.unit_price;
    toast(`Qabul qilindi: +${r.receipt.qty} dona · ${r.inventory.quantity} dona omborda${changed ? ` · narx ${money(r.receipt.old_price)} → ${money(r.receipt.unit_price)}` : ''}`, 'ok');
    renderReceipts({ params: new URLSearchParams('') });
  } catch (err) { toast(err.message, 'err'); }
}

async function submitReprice(e) {
  e.preventDefault(); const f = new FormData(e.target);
  try {
    const r = await api('/admin/reprice', { method: 'POST', auth: true, body: { variant_id: Number(f.get('variant_id')), unit_price: Number(f.get('unit_price')), note: f.get('note') || '' } });
    toast(`Narx yangilandi: ${money(r.receipt.old_price)} → ${money(r.receipt.unit_price)} · ${r.repriced_units} dona qoldiq endi shu narxda`, 'ok');
    renderReceipts({ params: new URLSearchParams('mode=reprice') });
  } catch (err) { toast(err.message, 'err'); }
}

/* ============================================================
   ADMIN VIEW: QOLDIQ
   ============================================================ */
async function renderInventory() {
  requireAdmin();
  const inv = await api('/admin/inventory', { auth: true });
  const rows = inv.length ? inv.map((r) => `<tr>
    <td>${esc(r.variant_name)}<div class="line-sub">${esc(r.sku)}</div></td>
    <td>${esc(r.warehouse_name)}</td>
    <td class="num">${r.quantity}</td><td class="num muted">${r.reserved}</td>
    <td class="num"><b class="avail-num">${r.available}</b></td>
    <td class="num">${money(r.price)}</td>
    <td><div class="mini-btns"><input type="number" id="delta-${r.id}" placeholder="± dona"><button class="btn btn-ghost btn-sm" onclick="adjustStock(${r.variant_id},${r.warehouse_id},${r.id})">Sozlash</button></div></td>
  </tr>`).join('') : `<tr><td colspan="7" class="empty" style="border:0">Qoldiq yozuvlari yo‘q.</td></tr>`;
  app().innerHTML = `<div class="page-head"><div><h1>Ombor qoldig‘i</h1><p>Qoldiq — ombordagi dona; mavjud qoldiq = qoldiq − rezervlangan.</p></div>
    <div class="row"><a class="btn btn-ghost" href="#/receipts?mode=reprice">${I.tag}<span>Narxni o‘zgartirish</span></a>
      <a class="btn btn-primary" href="#/receipts">${I.inbox}<span>Partiya qabul qilish</span></a></div></div>
    <div class="table-wrap"><table><thead><tr><th>Variant</th><th>Ombor</th><th class="num">Qoldiq</th><th class="num">Rezerv</th><th class="num">Mavjud</th><th class="num">Narx</th><th>Qoldiqni sozlash</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
async function adjustStock(variantId, warehouseId, rowId) {
  const val = Number($('#delta-' + rowId).value);
  if (!Number.isInteger(val) || val === 0) return toast('Delta kiriting (nol emas)', 'err');
  try { await api('/admin/inventory', { method: 'POST', auth: true, body: { variant_id: variantId, warehouse_id: warehouseId, delta: val } }); toast('Qoldiq yangilandi', 'ok'); renderInventory(); }
  catch (e) { handleErr(e); renderInventory(); }
}

/* ============================================================
   ADMIN VIEW: NARX TARIXI
   ============================================================ */
async function renderPriceHistory() {
  requireAdmin();
  const rows = await api('/admin/receipts?limit=200', { auth: true });
  const chips = (n) => `<span class="qty-chip">${n === 0 ? 'Faqat narx' : '+' + n + ' dona'}</span>`;
  app().innerHTML = `<div class="page-head"><div><h1>Narx va kirim tarixi</h1>
    <p>Har bir qator: qachon, nechta qabul qilingan va narx qanday o‘zgargani. “Faqat narx” — partiya kelmasdan qilingan qayta-narxlash.</p></div>
    <a class="btn btn-primary" href="#/receipts">${I.plus}<span>Yangi amal</span></a></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Sana</th><th>Mahsulot</th><th>Amal</th><th>Ombor</th><th class="num">Eski narx</th><th class="num">Yangi narx</th><th>Izoh</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="muted">${esc(fmtDate(r.created_at))}</td>
        <td>${esc(r.product_name)}<div class="line-sub">${esc(r.variant_name)} · ${esc(r.sku)}</div></td>
        <td>${chips(r.qty)}</td>
        <td>${r.warehouse_code ? esc(r.warehouse_code) : '<span class="muted">barcha ombor</span>'}</td>
        <td class="num muted">${money(r.old_price)}</td>
        <td class="num"><b class="price-move" data-dir="${r.unit_price > r.old_price ? 'up' : r.unit_price < r.old_price ? 'down' : 'flat'}">${money(r.unit_price)}</b></td>
        <td class="muted">${esc(r.note || '')}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty empty-lg"><span class="empty-ico">${I.inbox}</span><p>Hali kirim yoki narx o‘zgarishi qilinmagan.</p><a class="btn btn-primary" href="#/receipts">Kirimga o‘tish</a></div>`}`;
}

/* ============================================================
   ADMIN VIEW: OMBORLAR
   ============================================================ */
async function renderWarehouses() {
  requireAdmin();
  const whs = await api('/admin/warehouses', { auth: true });
  app().innerHTML = `<div class="page-head"><div><h1>Omborlar</h1><p>Kirim va qoldiq omborlar bo‘yicha saqlanadi.</p></div></div>
    <div class="row"><div class="card grow panel" style="min-width:280px"><div class="card-head"><div class="card-title" style="margin:0">Mavjud omborlar</div></div>
      <div class="table-wrap" style="border:0;border-radius:0 0 14px 14px"><table><thead><tr><th>Kod</th><th>Nomi</th></tr></thead><tbody>
      ${whs.map((w) => `<tr><td><b>${esc(w.code)}</b></td><td>${esc(w.name)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Yo‘q</td></tr>'}</tbody></table></div></div>
      <div class="card panel" style="min-width:300px"><div class="card-head"><div class="card-title" style="margin:0">Yangi ombor</div></div>
        <div class="card-pad"><form onsubmit="createWarehouse(event)"><div class="field"><label>Kod</label><input name="code" required placeholder="WH-X"></div>
        <div class="field"><label>Nomi</label><input name="name" required placeholder="Yangi filial"></div>
        <button class="btn btn-primary btn-block">Yaratish</button></form></div></div></div>`;
}
async function createWarehouse(e) { e.preventDefault(); const f = new FormData(e.target); try { await api('/admin/warehouses', { method: 'POST', auth: true, body: { code: f.get('code'), name: f.get('name') } }); toast('Ombor yaratildi', 'ok'); renderWarehouses(); } catch (err) { toast(err.message, 'err'); } }

/* ============================================================
   ADMIN VIEW: YANGI MAHSULOT
   ============================================================ */
async function renderNewProduct() {
  requireAdmin();
  const [cats, whs] = await Promise.all([api('/categories'), api('/admin/warehouses', { auth: true })]);
  window._whs = whs;
  app().innerHTML = `<div class="page-head"><div><h1>Yangi mahsulot</h1><p>Variantlar va boshlang‘ich qoldiq bitta tranzaksiyada yaratiladi.</p></div></div>
    <div class="card panel" style="max-width:760px">
      <div class="card-head"><div class="card-title" style="margin:0">Mahsulot ma’lumotlari</div></div>
      <div class="card-pad"><form onsubmit="createProduct(event)">
        <div class="form-grid">
          <div class="field"><label>Kategoriya</label><select name="category_id">${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Max xarid miqdori</label><input name="max_purchase_qty" type="number" min="1" value="5" required></div>
          <div class="field full"><label>Nom</label><input name="name" required placeholder="Masalan: Xiaomi TV Stick"></div>
          <div class="field full"><label>Tavsif</label><textarea name="description" rows="2"></textarea></div>
        </div>
        <h4>Variantlar</h4><div id="var-rows"></div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="addVarRow()">+ Variant qo‘shish</button>
        <div class="mt"><button class="btn btn-primary btn-lg" type="submit">Mahsulot yaratish</button></div>
      </form></div></div>`;
  addVarRow();
}
function addVarRow() {
  const whOpts = (window._whs || []).map((w) => `<option value="${w.id}">${esc(w.code)}</option>`).join('');
  const div = document.createElement('div');
  div.className = 'var-row';
  div.innerHTML = `<input class="v-sku" placeholder="SKU" required><input class="v-name" placeholder="Variant nomi (masalan 64GB Qora)" required>
    <input class="v-price" type="number" min="0" placeholder="Narx" required><input class="v-stock" type="number" min="0" placeholder="Qoldiq" value="0">
    <select class="v-wh">${whOpts}</select><button type="button" class="btn btn-ghost btn-sm v-del" onclick="this.parentElement.remove()" aria-label="O‘chirish">×</button>`;
  $('#var-rows').appendChild(div);
}
async function createProduct(e) {
  e.preventDefault(); const f = new FormData(e.target);
  const variants = $$('#var-rows .var-row').map((r) => ({ sku: r.querySelector('.v-sku').value.trim(), name: r.querySelector('.v-name').value.trim(), price: Number(r.querySelector('.v-price').value), stock: Number(r.querySelector('.v-stock').value || 0), warehouse_id: Number(r.querySelector('.v-wh').value) })).filter((v) => v.sku && v.name && !isNaN(v.price));
  if (!variants.length) return toast('Kamida bitta variant kiriting', 'err');
  try { const p = await api('/admin/products', { method: 'POST', auth: true, body: { category_id: Number(f.get('category_id')), name: f.get('name'), description: f.get('description'), max_purchase_qty: Number(f.get('max_purchase_qty')), variants } }); toast(`Mahsulot yaratildi: ${p.name}`, 'ok'); location.hash = '#/product/' + p.slug; }
  catch (err) { toast(err.message, 'err'); }
}

/* ============================================================
   ADMIN VIEW: BARCHA BUYURTMALAR
   ============================================================ */
async function renderAdminOrders() {
  requireAdmin();
  const data = await api('/admin/orders?limit=25', { auth: true });
  const meta = data.meta || { page: 1, total_pages: 1 };
  const rows = data.length ? data.map((o) => `<tr><td>#${o.id}</td><td>${esc(o.user_email || '')}</td><td>${statusPill(o.status)}</td>
    <td class="num">${money(o.total)}</td><td class="num">${o.item_count}</td><td>${esc(fmtDate(o.created_at))}</td></tr>`).join('')
    : `<tr><td colspan="6" class="empty" style="border:0">Buyurtmalar yo‘q.</td></tr>`;
  app().innerHTML = `<div class="page-head"><div><h1>Barcha buyurtmalar</h1><p>${data.length} ta yoziv · admin barcha mijozlar buyurtmalarini ko‘radi, lekin ularni API orqali qayta ochib bo‘lmaydi.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>№</th><th>Mijoz</th><th>Holat</th><th class="num">Summa</th><th class="num">Tarkib</th><th>Yaratilgan</th></tr></thead><tbody>${rows}</tbody></table></div>${pagination(meta)}`;
}

/* ---------- Wiring + boot ---------- */
function logout(to = '#/') {
  setAuth(null, null); adminChallenge = null; state.pending = 0;
  $('#tb-badge').hidden = true;
  refreshCartBadge(); toast('Siz chiqdingiz', 'info');
  location.hash = to; render();
}

function wire() {
  $('#burger').onclick = (e) => { e.stopPropagation(); document.body.classList.toggle('nav-open'); };
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  $('#tb-logout').onclick = logout;
  $('#tb-bell').onclick = () => { location.hash = '#/admin-orders'; };
  $('#search-form').onsubmit = (e) => {
    e.preventDefault();
    const q = $('#search-input').value.trim();
    if (!q) return;
    if (parseHash().name !== '') { location.hash = '#/?q=' + encodeURIComponent(q); }
    else go({ q, page: 1 });
  };
  $('#modal-close').onclick = closeModal;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
}

async function boot() {
  wire();
  setInterval(tickDate, 30000);
  if (state.token) { try { const d = await api('/auth/me', { auth: true }); state.user = d.user; } catch { setAuth(null, null); } }
  renderSidebar(); syncTopbar();
  await refreshCartBadge();
  render();
}
boot();
