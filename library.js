import { S, h, db, doc, updateDoc, toast, errMsg, lsGet, lsSet, scheduleRender, keyed, sigOf, tsMs, writeLog } from "./core.js?v=15";
import { renderFiles, downloadBlob, sizeText } from "./files.js?v=15";
import { renderPerm } from "./perm.js?v=21";

/* 자료실: 분류 탭 + 교수님 제출용 통합 폴더(InfoMat 제출자료 YY.MM.DD) 내려받기
   분류는 파일 경로(폴더 이름)로 정한다. 각 탭에서 올리면 그 탭의 폴더 아래에 저장된다. */
const PERM = "퍼미션/";
const TABS = [
  { k: "ref", label: "Reference", dir: "Reference/" },
  { k: "fig", label: "Figure", dir: "Figure/" },
  { k: "perm", label: "Permission" },
  { k: "apr", label: "이전 APR 투고 자료", dir: "이전 APR 투고 자료/" },
  { k: "im", label: "InfoMat 투고 자료", dir: "InfoMat 투고 자료/" },
  { k: "etc", label: "기타" }
];
const FIG_N = 14; // 원고 그림 수
export function catOf(f) {
  const p = f.path, folder = f.folder || "";
  if (p.startsWith(PERM)) return "perm";
  if (p.startsWith("이전 APR 투고 자료/") || /\bAPR|AIP_|Applied Physics Reviews|기존자료/.test(folder)) return "apr";
  if (/^(Reference|레퍼런스)/i.test(folder)) return "ref";
  if (/그림|figure/i.test(folder)) return "fig";
  if (!folder || /InfoMat/i.test(folder)) return "im";
  return "etc";
}
const extOf = name => (name.split(".").pop() || "").toLowerCase();
const figSub = name => { const x = extOf(name); return x === "ppt" || x === "pptx" ? "PPT" : x === "pdf" ? "PDF" : x === "tif" || x === "tiff" ? "TIF" : ""; };
const pad = n => String(n).padStart(2, "0");
const pkgName = () => { const d = new Date(); return `InfoMat 제출자료 ${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };

/* 제출 폴더 구성: InfoMat 투고 자료와 Figure 탭은 "제출" 표시한 파일만, Permission은 전부 */
export function pkgPlan() {
  const items = [];
  for (const f of S.files) {
    if (!f.complete) continue;
    const c = catOf(f);
    if (c === "im" && f.submit) items.push({ out: f.name, f });
    else if (c === "fig" && f.submit) { const sub = figSub(f.name); items.push({ out: "Figure/" + (sub ? sub + "/" : "") + f.name, f }); }
    else if (c === "perm") {
      const rest = f.path.slice(PERM.length);
      if (!rest.includes("/")) items.push({ out: "Permission/제출용/" + rest, f });
      else if (rest.startsWith("OA/")) items.push({ out: "Permission/대비용/Open Access/" + rest.slice(3), f });
      else if (rest.startsWith("대비용/")) items.push({ out: "Permission/대비용/" + rest.slice(4), f });
    }
  }
  const byOut = new Map(), dup = [];
  for (const it of items.sort((a, b) => tsMs(b.f.uploadedAt) - tsMs(a.f.uploadedAt))) { if (byOut.has(it.out)) dup.push(it); else byOut.set(it.out, it); }
  const list = [...byOut.values()].sort((a, b) => a.out.localeCompare(b.out, "ko", { numeric: true }));
  return { list, dup };
}
function pkgCheck(list) {
  const root = list.filter(it => !it.out.includes("/")).map(it => it.out);
  const has = (re, x) => root.some(n => re.test(n) && extOf(n) === x);
  const docs = [["Manuscript", /manuscript|원고/i], ["TOC", /toc/i], ["Cover letter", /cover/i]].map(([n, re]) => ({ n, docx: has(re, "docx"), pdf: has(re, "pdf") }));
  const count = pre => list.filter(it => it.out.startsWith(pre)).length;
  return { docs, ppt: count("Figure/PPT/"), pdf: count("Figure/PDF/"), tif: count("Figure/TIF/"),
    sub: count("Permission/제출용/"), oa: count("Permission/대비용/Open Access/"), extra: list.filter(it => /^Permission\/대비용\/[^/]+$/.test(it.out)).length };
}

const pkg = { busy: false, done: 0, total: 0, open: false };
async function writePackage(root, name, list) {
  const top = await root.getDirectoryHandle(name, { create: true });
  for (const it of list) {
    const parts = it.out.split("/");
    let d = top;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await fh.createWritable();
    await w.write(await downloadBlob(it.f));
    await w.close();
    pkg.done++;
    scheduleRender();
  }
}
export const __writePackage = writePackage; // 시험용
function loadJSZip() {
  if (window.JSZip) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = new URL("jszip.min.js", import.meta.url).href;
    s.onload = () => window.JSZip ? res() : rej(new Error("JSZip을 불러오지 못했습니다."));
    s.onerror = () => rej(new Error("JSZip을 불러오지 못했습니다."));
    document.head.append(s);
  });
}
async function downloadPackage() {
  if (pkg.busy) return;
  const { list } = pkgPlan();
  if (!list.length) { toast("제출 폴더에 넣을 파일이 없습니다."); return; }
  const name = pkgName();
  let root = null;
  if (window.showDirectoryPicker) {
    try { root = await window.showDirectoryPicker({ id: "infomat-pkg", mode: "readwrite" }); }
    catch (e) { if (e.name === "AbortError") return; root = null; }
  }
  Object.assign(pkg, { busy: true, done: 0, total: list.length });
  scheduleRender();
  try {
    if (root) {
      await writePackage(root, name, list);
      toast(`고른 위치에 "${name}" 폴더를 만들었습니다. 파일 ${list.length}개`, 6000);
    } else {
      await loadJSZip();
      const zip = new window.JSZip();
      for (const it of list) { zip.file(name + "/" + it.out, await downloadBlob(it.f)); pkg.done++; scheduleRender(); }
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const a = h("a", { href: URL.createObjectURL(blob), download: name + ".zip" });
      document.body.append(a); a.click(); a.remove();
      toast(`이 브라우저는 폴더 저장을 지원하지 않아 ${name}.zip으로 내려받았습니다.`, 6000);
    }
  } catch (e) { toast("내려받기 실패: " + errMsg(e)); }
  finally { pkg.busy = false; scheduleRender(); }
}

async function setSubmit(files, on) {
  try {
    for (const f of files) if (!!f.submit !== on) await updateDoc(doc(db, "files", f.id), { submit: on });
    await writeLog(on ? "제출 폴더에 포함" : "제출 폴더에서 제외", files.length === 1 ? files[0].path : `${files[0].folder} (${files.length}개)`, "", "", "");
  } catch (e) { toast("저장 실패: " + errMsg(e)); }
}

function renderPkgCard() {
  const { list, dup } = pkgPlan(), c = pkgCheck(list), name = pkgName();
  const total = list.reduce((a, it) => a + (it.f.size || 0), 0);
  const mark = ok => ok ? "있음" : "없음";
  const lines = [
    ...c.docs.map(d => `${d.n}: Word ${mark(d.docx)} · PDF ${mark(d.pdf)}`),
    `Figure: PPT ${c.ppt}/${FIG_N} · PDF ${c.pdf}/${FIG_N} · TIF ${c.tif}/${FIG_N}`,
    `Permission: 제출용 ${c.sub}개 · 대비용 Open Access ${c.oa}개 · 대비용 기록 ${c.extra}개`
  ];
  const missing = c.docs.some(d => !d.docx || !d.pdf) || c.ppt < FIG_N || c.pdf < FIG_N || c.tif < FIG_N || !c.extra;
  const card = h("div", { class: "card" },
    h("div", { class: "bar" },
      h("strong", { text: `교수님 제출용 통합 폴더: ${name}` }),
      h("span", { class: "muted", text: ` 파일 ${list.length}개 · ${sizeText(total)}` }),
      h("span", { class: "grow" }),
      h("button", { class: "small", text: pkg.open ? "구성 접기" : "구성 보기", onclick: () => { pkg.open = !pkg.open; scheduleRender(); } }),
      h("button", { class: "primary", disabled: pkg.busy || !list.length ? true : null, onclick: downloadPackage,
        title: "저장할 위치를 고르면 그 안에 폴더를 만들어 그대로 저장합니다. 폴더 저장을 지원하지 않는 브라우저에서는 zip으로 내려받습니다.",
        text: pkg.busy ? `저장 중 ${pkg.done}/${pkg.total}` : "폴더로 내려받기" })),
    lines.map(t => h("div", { class: "meta", text: t })),
    missing ? h("div", { class: "meta", text: "없는 항목은 해당 탭에 올리고 '제출'에 표시하면 들어갑니다. InfoMat 투고 자료와 Figure 탭은 '제출' 표시한 파일만 들어갑니다." }) : null,
    dup.length ? h("div", { class: "meta", text: `이름이 겹쳐 최근 파일만 넣은 것: ${dup.map(it => it.f.path).join(", ")}` }) : null,
    pkg.open ? h("pre", { class: "meta", style: "white-space:pre-wrap;margin:6px 0 0", text: [name + "/", ...list.map(it => "  " + it.out)].join("\n") }) : null);
  return keyed(card, "pkg", sigOf([list.map(it => [it.out, it.f.id]), dup.length, pkg, name]));
}

function submitBox(f) {
  return h("label", { class: "tg", title: "교수님 제출용 통합 폴더에 넣습니다" },
    h("input", { type: "checkbox", checked: !!f.submit, disabled: f.complete ? null : true, onchange: e => setSubmit([f], e.target.checked) }), " 제출");
}
function folderToggle(label, list) {
  const all = list.every(f => f.submit);
  return h("button", { class: "small", text: all ? "전체 제출 해제" : "전체 제출", onclick: () => setSubmit(list.filter(f => f.complete), !all) });
}

export function renderFilesTab() {
  const counts = {};
  for (const f of S.files) { const c = catOf(f); counts[c] = (counts[c] || 0) + 1; }
  const tabs = TABS.filter(t => t.k !== "etc" || counts.etc);
  let sub = S.filesSub || lsGet("filesSub");
  if (!tabs.some(t => t.k === sub)) sub = tabs[0].k;
  const bar = keyed(h("div", { class: "bar" }, h("div", { class: "seg" },
    tabs.map(t => h("button", { class: sub === t.k ? "on" : "", text: `${t.label} ${counts[t.k] || 0}`,
      onclick: () => { S.filesSub = t.k; lsSet("filesSub", t.k); scheduleRender(); } })))), "fsub", sigOf([sub, counts]));
  const nodes = [renderPkgCard(), bar];
  if (sub === "perm") return nodes.concat(renderPerm());
  const T = tabs.find(t => t.k === sub);
  const withSubmit = sub === "im" || sub === "fig";
  const mapPath = T.dir ? (rel, f) => sub === "fig" ? T.dir + (figSub(f.name) ? figSub(f.name) + "/" : "") + f.name : sub === "im" ? T.dir + f.name : T.dir + rel : null;
  return nodes.concat(renderFiles({
    key: sub, filter: f => catOf(f) === sub, mapPath, noDrop: !T.dir,
    dropNote: sub === "fig" ? "Figure/PPT, Figure/PDF, Figure/TIF 중 확장자에 맞는 폴더에 저장됩니다. 같은 경로·같은 크기의 파일은 건너뜁니다."
      : sub === "im" ? "InfoMat 투고 자료 폴더에 저장됩니다. 같은 이름·같은 크기의 파일은 건너뜁니다."
      : T.dir ? `${T.dir.slice(0, -1)} 폴더 아래에 고른 폴더 구조 그대로 저장됩니다. 같은 경로·같은 크기의 파일은 건너뜁니다.` : "",
    groupOf: sub === "im" ? () => "" : f => T.dir && f.path.startsWith(T.dir) ? (f.folder || "").slice(T.dir.length) : (f.folder || ""),
    rowExtra: withSubmit ? submitBox : null, folderExtra: withSubmit ? folderToggle : null
  }));
}
