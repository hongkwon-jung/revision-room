import { initializeApp } from "fb/app";
import { getAuth } from "fb/auth";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, collection, query, where,
  orderBy, limit, onSnapshot, serverTimestamp, writeBatch, Bytes, arrayUnion
} from "fb/firestore";

export {
  doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, collection, query, where,
  orderBy, limit, onSnapshot, serverTimestamp, writeBatch, Bytes, arrayUnion
};

const firebaseConfig = {
  apiKey: "AIzaSyCYm8PxEj-jV-T1bDmInFaxrV-F9Cum-oE",
  authDomain: "ald-review-revision.firebaseapp.com",
  projectId: "ald-review-revision",
  storageBucket: "ald-review-revision.firebasestorage.app",
  messagingSenderId: "50934672736",
  appId: "1:50934672736:web:605fb6dd34ceb0d8738205"
};
export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);

export const STATUS = ["미착수", "논의 중", "방향 확정", "작성 중", "검토 대기", "완료", "반영 안 함"];

export const S = {
  user: null, me: null, isAdmin: false, ready: false,
  members: [], items: [], comments: {}, tasks: [], journals: [], docs: [], log: [],
  anns: [], revs: [], locks: [], chat: [], files: [], uploads: [], fnotes: [],
  tab: lsGet("tab") || "items",
  f: { reviewer: "", status: "", owner: "", q: "" },
  open: new Set(safeJSON(lsGet("open"), [])),
  unsubs: [], commentUnsubs: {},
  dirty: {}, focusVal: {}, remoteChanged: new Set(), armed: {},
  rendering: false
};
function safeJSON(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
export function lsGet(k) { try { return localStorage.getItem("rv_" + k); } catch (e) { return null; } }
export function lsSet(k, v) { try { localStorage.setItem("rv_" + k, v); } catch (e) {} }
export function saveOpen() { lsSet("open", JSON.stringify([...S.open])); }

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function toast(msg, ms = 2800) {
  const t = h("div", { class: "toast", text: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
export function tsDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  return null;
}
export function tsMs(ts) { const d = tsDate(ts); return d ? d.getTime() : 0; }
export function fmt(ts) {
  const d = tsDate(ts);
  if (!d) return "";
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function myName() {
  return (S.me && S.me.name) || (S.user && (S.user.displayName || (S.user.email || "").split("@")[0])) || "?";
}
export function snapList(snap) {
  return snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
}
export function errMsg(e) {
  const c = (e && e.code) || "";
  if (c.includes("permission-denied")) return "권한이 없습니다. 관리자 승인이 필요할 수 있습니다.";
  if (c.includes("unavailable")) return "서버에 연결되지 않았습니다. 네트워크를 확인해 주세요.";
  if (c.includes("resource-exhausted")) return "무료 사용량 한도에 도달했습니다.";
  return (e && e.message) || String(e);
}
export function cut(s, n = 300) { s = s == null ? "" : String(s); return s.length > n ? s.slice(0, n) + "…" : s; }
export function hashStr(s) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619); }
  return (h1 >>> 0).toString(36) + ":" + s.length;
}
export function sigOf(obj) { return hashStr(JSON.stringify(obj, (k, v) => (v && typeof v.toDate === "function") ? v.toDate().getTime() : v)); }
const PALETTE = ["#c2410c", "#1d4ed8", "#047857", "#7e22ce", "#b91c1c", "#0e7490", "#a16207", "#be185d"];
export function colorFor(name) { return PALETTE[parseInt(hashStr(name || "?").split(":")[0], 36) % PALETTE.length]; }

export async function writeLog(action, target, field, before, after) {
  try {
    await addDoc(collection(db, "log"), {
      at: serverTimestamp(), uid: S.user.uid, name: myName(),
      action, target: target || "", field: field || "", before: cut(before), after: cut(after)
    });
  } catch (e) { console.warn("log failed", e); }
}

/* ---------- 심사평 항목 이름 ---------- */
export function reviewerName(r) {
  if (r === "R1") return "심사위원 1";
  if (r === "R2") return "심사위원 2";
  return "팀 추가";
}
export function codesOf(it) {
  if (!it) return [];
  if (Array.isArray(it.sources) && it.sources.length) return it.sources.map(s => s.code).filter(Boolean);
  return it.code && it.code !== "추가" ? [it.code] : [];
}
export function codeText(it) { return codesOf(it).join(" + "); }
export function itemLabel(it) {
  if (!it) return "(삭제된 항목)";
  if (Array.isArray(it.sources) && it.sources.length > 1) return it.sources.map(s => s.label).join(" + ");
  const who = reviewerName(it.reviewer);
  const code = String(it.code || "");
  let part = "";
  if (/총평/.test(code)) part = "총평";
  else { const m = code.match(/R\d-(\d+)/); if (m) part = m[1] + "번 요구"; }
  return part ? `${who} · ${part}` : who;
}
export function itemById(id) { return S.items.find(i => i.id === id); }
export function itemFull(id) { const it = itemById(id); return it ? `${itemLabel(it)} (${it.topic || ""})` : "(삭제된 항목)"; }

/* ---------- 저장 도우미 ---------- */
const timers = {};
function refFor(path) { return doc(db, ...path.split("/")); }
export async function saveNow(path, field, value) {
  const plain = path.startsWith("members/") || path.startsWith("anns/");
  const data = plain ? { [field]: value } : { [field]: value, updatedAt: serverTimestamp(), updatedBy: myName() };
  await updateDoc(refFor(path), data);
}
export function scheduleSave(key, path, field, value) {
  S.dirty[key] = value;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(async () => {
    try { await saveNow(path, field, value); } catch (e) { toast("저장 실패: " + errMsg(e)); }
  }, 900);
}
export async function flushSave(key, path, field, value, targetLabel, fieldLabel) {
  clearTimeout(timers[key]);
  const before = S.focusVal[key];
  try {
    if (before !== value) {
      await saveNow(path, field, value);
      await writeLog("수정", targetLabel, fieldLabel, before, value);
    }
  } catch (e) { toast("저장 실패: " + errMsg(e)); }
  delete S.dirty[key];
  delete S.focusVal[key];
  S.remoteChanged.delete(key);
  scheduleRender();
}
export function autosize(el) { el.style.height = "auto"; el.style.height = (el.scrollHeight + 2) + "px"; }

export function editArea(path, field, remoteVal, targetLabel, fieldLabel, opts = {}) {
  const key = path + "#" + field;
  const local = key in S.dirty ? S.dirty[key] : (remoteVal || "");
  const ta = h("textarea", {
    class: "auto " + (opts.cls || ""), value: local, placeholder: opts.placeholder || "", rows: 1, dataset: { key },
    onfocus: () => { if (!(key in S.focusVal)) S.focusVal[key] = remoteVal || ""; },
    oninput: e => { autosize(e.target); scheduleSave(key, path, field, e.target.value); },
    onblur: e => { if (S.rendering || !e.target.isConnected) return; flushSave(key, path, field, e.target.value, targetLabel, fieldLabel); }
  });
  if (key in S.dirty && (remoteVal || "") !== (S.focusVal[key] ?? "") && (remoteVal || "") !== S.dirty[key]) S.remoteChanged.add(key);
  return ta;
}
/* ---------- 긴 글 접어 읽기 (v11) ----------
   글이 길면 기본은 읽기 보기: 첫 단락은 보이고, "1. ", "① ", "[제목]" 같은 제목 줄 아래는 접힌다.
   [편집]을 누르면 기존 입력칸으로 바뀐다. 접힘 상태는 각자 브라우저에 기억된다. */
const FOLD_MIN = 500;
const FOLD_LINES = 12;
const TOP_RE = /^\s*(\d{1,2}\.\s+\S|\[[^\]]{1,60}\]\s*$|#{1,3}\s+\S)/;
const SUB_RE = /^\s*[\u2460-\u2473]/;
const trimLines = a => { a = a.slice(); while (a.length && !a[a.length - 1].trim()) a.pop(); while (a.length && !a[0].trim()) a.shift(); return a; };
const countLines = a => a.filter(x => x.trim()).length;
function splitBy(lines, isHead) {
  const pre = [], secs = [];
  for (const ln of lines) {
    if (isHead(ln)) secs.push({ head: ln.trim(), lines: [] });
    else if (secs.length) secs[secs.length - 1].lines.push(ln);
    else pre.push(ln);
  }
  return { pre: trimLines(pre), secs: secs.map(x => ({ head: x.head, lines: trimLines(x.lines) })) };
}
/* 제목 줄 규칙(v13): 40자 이하의 "1. 제목", "[제목]" 한 줄, "# 제목"이 큰 제목, "①"이 그 안의 작은 제목.
   번호가 붙은 긴 줄(목록 항목)은 제목으로 보지 않는다. 큰 제목이 없으면 빈 줄로 나뉜 덩어리의 첫 줄을 제목으로 쓴다. */
const HEAD_MAX = 40;
const isTop = l => TOP_RE.test(l) && l.trim().length <= HEAD_MAX;
function splitBlocks(lines) {
  const blocks = []; let cur = [];
  for (const ln of lines) { if (ln.trim()) cur.push(ln); else if (cur.length) { blocks.push(cur); cur = []; } }
  if (cur.length) blocks.push(cur);
  return blocks;
}
export function splitSections(text) {
  const lines = String(text || "").split("\n");
  if (lines.some(isTop)) {
    const top = splitBy(lines, isTop);
    return {
      intro: top.pre.join("\n"),
      secs: top.secs.map(x => {
        const sub = x.lines.some(l => SUB_RE.test(l)) ? splitBy(x.lines, l => SUB_RE.test(l)) : null;
        return { head: x.head, n: countLines(x.lines), pre: sub ? sub.pre.join("\n") : x.lines.join("\n"),
          subs: sub ? sub.secs.map(y => ({ head: y.head, n: countLines(y.lines), body: y.lines.join("\n") })) : [] };
      })
    };
  }
  if (lines.some(l => SUB_RE.test(l))) {
    const top = splitBy(lines, l => SUB_RE.test(l));
    return { intro: top.pre.join("\n"), secs: top.secs.map(x => ({ head: x.head, n: countLines(x.lines), pre: x.lines.join("\n"), subs: [] })) };
  }
  const blocks = splitBlocks(lines);
  if (blocks.length < 2) return { intro: lines.join("\n").trim(), secs: [] };
  const first = blocks[0].length === 1 ? blocks.shift() : null;
  return { intro: first ? first.join("\n") : "", secs: blocks.map(b => ({ head: b[0].trim(), n: b.length - 1, pre: b.slice(1).join("\n"), subs: [] })) };
}
export function foldText(path, field, remoteVal, targetLabel, fieldLabel, opts = {}) {
  const key = path + "#" + field;
  const editKey = key + ":edit";
  const val = key in S.dirty ? S.dirty[key] : (remoteVal || "");
  const long = val.length >= (opts.min || FOLD_MIN) || val.split("\n").length >= FOLD_LINES;
  const { intro, secs } = splitSections(val);
  const foldable = secs.filter(x => x.n);
  if (!long || !foldable.length || S.open.has(editKey) || key in S.dirty) {
    const ta = editArea(path, field, remoteVal, targetLabel, fieldLabel, opts);
    if (!long || !foldable.length) return ta;
    return h("div", { class: "fold edit" },
      h("div", { class: "fold-bar" }, h("span", { class: "muted", text: "편집 중 (칸 밖을 누르면 저장)" }), h("span", { class: "grow" }),
        h("button", { class: "small", text: "읽기 보기로", onclick: () => { S.open.delete(editKey); saveOpen(); scheduleRender(); } })),
      ta);
  }
  const keys = [];
  secs.forEach((x, i) => { if (x.n) keys.push(key + ":s" + i); x.subs.forEach((y, j) => { if (y.n) keys.push(key + ":s" + i + "." + j); }); });
  const allOpen = keys.every(k => S.open.has(k));
  const fold = (k, cls, head, n, body) => h("details", { class: cls, open: S.open.has(k) ? true : null,
      ontoggle: e => { if (e.target !== e.currentTarget) return; if (e.target.open) S.open.add(k); else S.open.delete(k); saveOpen(); } },
    h("summary", null, h("span", { class: "fold-h", text: head }), h("span", { class: "fold-n", text: ` ${n}줄` })), body);
  return h("div", { class: "fold" },
    h("div", { class: "fold-bar" },
      h("span", { class: "muted", text: "제목을 누르면 펼쳐집니다" }), h("span", { class: "grow" }),
      h("button", { class: "small", text: allOpen ? "모두 접기" : "모두 펼치기", onclick: () => { keys.forEach(k => allOpen ? S.open.delete(k) : S.open.add(k)); saveOpen(); scheduleRender(); } }),
      h("button", { class: "small", text: "편집", onclick: () => { S.open.add(editKey); saveOpen(); scheduleRender(); setTimeout(() => { const t = document.querySelector(`textarea[data-key="${CSS.escape(key)}"]`); if (t) { autosize(t); t.focus(); } }, 60); } })),
    intro ? h("div", { class: "fold-intro", text: intro }) : null,
    secs.map((x, i) => {
      if (!x.n) return h("div", { class: "fold-title", text: x.head });
      return fold(key + ":s" + i, "fold-sec", x.head, x.n, h("div", { class: "fold-body" },
        x.pre ? h("div", { class: "fold-pre", text: x.pre }) : null,
        x.subs.map((y, j) => y.n ? fold(key + ":s" + i + "." + j, "fold-sub", y.head, y.n, h("div", { class: "fold-subbody", text: y.body }))
          : h("div", { class: "fold-subtitle", text: y.head }))));
    }));
}
export function editInput(path, field, remoteVal, targetLabel, fieldLabel, opts = {}) {
  const key = path + "#" + field;
  const local = key in S.dirty ? S.dirty[key] : (remoteVal || "");
  return h("input", {
    type: opts.type || "text", class: opts.cls || "", value: local, placeholder: opts.placeholder || "", dataset: { key },
    style: opts.style || null,
    onfocus: () => { if (!(key in S.focusVal)) S.focusVal[key] = remoteVal || ""; },
    oninput: e => scheduleSave(key, path, field, e.target.value),
    onchange: e => { if (opts.type === "date") flushSave(key, path, field, e.target.value, targetLabel, fieldLabel); },
    onblur: e => { if (S.rendering || !e.target.isConnected) return; flushSave(key, path, field, e.target.value, targetLabel, fieldLabel); }
  });
}
export function selectBox(options, current, onpick, blankLabel) {
  const sel = h("select", { onchange: e => onpick(e.target.value) });
  const opts = options.map(o => Array.isArray(o) ? o : [o, o]);
  if (current && !opts.some(o => o[0] === current)) opts.push([current, current]);
  if (blankLabel) sel.append(h("option", { value: "", text: blankLabel }));
  for (const [v, l] of opts) sel.append(h("option", { value: v, text: l, selected: v === current ? true : null }));
  sel.value = current || "";
  return sel;
}
export async function setField(path, field, value, targetLabel, fieldLabel, before) {
  try { await saveNow(path, field, value); await writeLog("수정", targetLabel, fieldLabel, before, value); }
  catch (e) { toast("저장 실패: " + errMsg(e)); }
}
export function confirmButton(label, onconfirm, cls = "small danger", key = label) {
  const isArmed = () => (S.armed[key] || 0) > Date.now();
  const b = h("button", { class: cls, text: isArmed() ? "한 번 더 누르면 " + label : label, dataset: { armed: isArmed() ? "1" : "" }, onclick: async (e) => {
    e.stopPropagation();
    if (!isArmed()) {
      S.armed[key] = Date.now() + 5000;
      b.textContent = "한 번 더 누르면 " + label;
      setTimeout(() => { if (!isArmed()) { delete S.armed[key]; scheduleRender(); } }, 5100);
      return;
    }
    delete S.armed[key];
    b.disabled = true; b.textContent = "처리 중…";
    try { await onconfirm(); } finally { scheduleRender(); }
  } });
  return b;
}
export function ownerOptions() {
  const names = S.members.filter(m => m.approved).map(m => m.name).filter(Boolean);
  return [...new Set([...names, "공동"])];
}

/* ---------- 부분 갱신 ---------- */
// 각 노드는 dataset.k(고유 키)와 dataset.sig(내용 서명)를 가진다. 서명이 같으면 기존 노드를 그대로 둔다.
export function keyed(el, k, sig) { el.dataset.k = k; if (sig !== undefined) el.dataset.sig = sig; return el; }
export function patchChildren(root, nodes) {
  const old = new Map();
  for (const c of root.children) if (c.dataset.k) old.set(c.dataset.k, c);
  const final = nodes.map(n => {
    const o = n.dataset.k ? old.get(n.dataset.k) : null;
    if (o && n.dataset.sig && o.dataset.sig === n.dataset.sig) return o;
    return n;
  });
  const keep = new Set(final);
  S.rendering = true;
  try {
    for (const c of [...root.children]) if (!keep.has(c)) c.remove();
    final.forEach((n, i) => { if (root.children[i] !== n) root.insertBefore(n, root.children[i] || null); });
  } finally { S.rendering = false; }
  return final.filter(n => !old.has(n.dataset.k) || old.get(n.dataset.k) !== n);
}

let renderFn = () => {};
export function setRenderer(fn) { renderFn = fn; }
let rafPending = false, deferTimer = null, composing = false, lastInput = 0;
document.addEventListener("compositionstart", () => { composing = true; }, true);
document.addEventListener("compositionend", () => { composing = false; lastInput = Date.now(); }, true);
document.addEventListener("input", () => { lastInput = Date.now(); }, true);
document.addEventListener("focusout", () => { if (deferTimer) { clearTimeout(deferTimer); deferTimer = null; setTimeout(scheduleRender, 60); } }, true);
function userIsTyping() {
  const a = document.activeElement;
  if (!a) return false;
  const texty = a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "file", "range", "color"].includes((a.type || "").toLowerCase()));
  if (!texty) return false;
  return composing || (Date.now() - lastInput < 2500);
}
export function scheduleRender() {
  if (rafPending) return;
  if (userIsTyping()) {
    if (!deferTimer) deferTimer = setTimeout(() => { deferTimer = null; scheduleRender(); }, 1200);
    return;
  }
  rafPending = true;
  const run = () => { rafPending = false; if (S.ready) renderFn(); };
  if (document.visibilityState === "hidden") setTimeout(run, 50); else requestAnimationFrame(run);
}
export function restoreFocus(activeKey, selStart, selEnd) {
  if (!activeKey) return;
  const el = document.querySelector(`[data-key="${CSS.escape(activeKey)}"]`);
  if (el && el !== document.activeElement) {
    el.focus({ preventScroll: true });
    try { if (selStart !== null) el.setSelectionRange(selStart, selEnd); } catch (e) {}
  }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(`복사했습니다 (${text.length.toLocaleString()}자).`); }
  catch (e) { showText("자동 복사가 막혀 있습니다. 아래 내용을 선택해 복사하세요.", text); }
}
export function modal(title, body, onclose) {
  const bg = h("div", { class: "modal-bg", onclick: e => { if (e.target === bg) close(); } });
  const close = () => { bg.remove(); if (onclose) onclose(); };
  bg.append(h("div", { class: "modal" },
    h("div", { class: "bar" }, h("strong", { text: title }), h("span", { class: "grow" }), h("button", { text: "닫기", onclick: close })),
    h("div", { class: "modal-body" }, body)));
  document.body.append(bg);
  return close;
}
export function showText(title, text) {
  const ta = h("textarea", { class: "mono", value: text, readonly: true });
  modal(title, ta);
  ta.focus(); ta.select();
}
