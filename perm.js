import { S, h, toast, errMsg, lsGet, lsSet, scheduleRender, keyed, sigOf } from "./core.js?v=15";
import { renderFiles, queueUploads, getFileURL, fileByPath } from "./files.js?v=15";

/* 자료실 > 퍼미션. 자료실 파일 경로: 퍼미션/Fig.N(x)_permission.pdf, 퍼미션/OA/Fig.N(x)_OA.pdf
   ref 번호는 InfoMat 타겟 원고(2026-10-19 저장본) 기준 */
const DIR = "퍼미션/";
const R = (p, ref, paper, pub, via, no, note) => ({ p, ref, paper, pub, via, no, note: note || "" });

const NEW = [
  R(["1(c)", "1(d)", "12(i)"], 2, "Hur 2024, Nanoscale Horiz", "RSC", "Marketplace", "1816588-1"),
  R(["1(e)", "1(f)"], 27, "Lespiaux 2022, Mater Sci Semicond Process", "Elsevier", "RightsLink", "6373091192985"),
  R(["2(b)", "12(e)", "12(f)"], 77, "Lee 2026, Adv Mater Technol", "Wiley", "Marketplace", "1816588-2", "원논문 CC BY-NC-ND 4.0. 캡션 저작권자 표기 확인 필요"),
  R(["2(d)", "2(e)"], 71, "Liao 2025, Nat Commun", "Springer Nature", "RightsLink", "6373111476027", "원논문 CC BY-NC-ND 4.0. 캡션의 CC BY 4.0 표기 수정 필요"),
  R(["2(f)", "2(g)", "13(c)"], 79, "Li 2025, Sci Adv", "AAAS", "Marketplace", "1816680-3", "원논문 CC BY-NC 4.0. 캡션 adapted를 reproduced로 바꾸기 권장"),
  R(["4(a)"], 10, "Nomura 2004, Nature", "Springer Nature", "RightsLink", "6373110000899"),
  R(["4(b)"], 9, "Lee 2011, Appl Phys Lett", "AIP", "Marketplace", "1816680-1"),
  R(["4(e)"], 76, "Ryu 2024, Nano Lett", "ACS", "Marketplace", "1816620-1"),
  R(["4(f)"], 113, "Zhang 2020, J Appl Phys", "AIP", "Marketplace", "1816680-2"),
  R(["4(g)"], 114, "Yoo 2024, Nano Lett", "ACS", "Marketplace", "1816620-2"),
  R(["5(a)", "5(b)", "5(c)", "5(d)", "5(e)"], 38, "Kim 2024, Appl Surf Sci", "Elsevier", "RightsLink", "6373100483807"),
  R(["7(d)", "7(e)", "7(f)"], 35, "Hong 2023, Chem Mater", "ACS", "Marketplace", "1816620-3"),
  R(["8(f)"], 128, "Yoo 2024, Appl Surf Sci", "Elsevier", "RightsLink", "6373100620350"),
  R(["9(c)", "9(d)"], 132, "Ryu 2024, Appl Surf Sci", "Elsevier", "RightsLink", "6373100735507"),
  R(["10(a)", "10(b)", "10(c)"], 129, "Kim 2023, ACS Appl Mater Interfaces", "ACS", "Marketplace", "1816620-4", "캡션 adapted를 reproduced로 바꾸기 권장"),
  R(["10(d)", "10(e)", "10(f)"], 131, "Hong 2021, ACS Appl Mater Interfaces", "ACS", "Marketplace", "1816620-5", "캡션 adapted를 reproduced로 바꾸기 권장"),
  R(["10(g)", "10(h)", "10(i)"], 148, "Sheng 2016, ACS Appl Mater Interfaces", "ACS", "Marketplace", "1816620-6", "캡션 adapted를 reproduced로 바꾸기 권장"),
  R(["11(c)"], 189, "Noh 2024, Nanoscale", "RSC", "Marketplace", "1816588-3", "원논문 CC BY-NC 3.0"),
  R(["12(c)"], 193, "Yoon 2024, Semicond Sci Technol", "IOP", "Marketplace", "1816588-4", "캡션에 서지, DOI, '© IOP Publishing…' 문구 필요. 저자 연락 조건 있음"),
  R(["13(a)"], 196, "Lee 2025, Phys Status Solidi RRL", "Wiley", "RightsLink", "6373110516131", "원논문 CC BY-NC-ND 4.0. 캡션 저작권자 표기 확인 필요"),
  R(["13(d)"], 197, "Yan 2025, Sci China Inf Sci", "Science China Press", "Marketplace", "1816588-5"),
  R(["14(a)"], 42, "Kim 2025, ACS Appl Mater Interfaces", "ACS", "Marketplace", "1816620-7", "캡션 adapted를 reproduced로 바꾸기 권장"),
  R(["14(b)"], 41, "Kruv 2025, ACS Appl Electron Mater", "ACS", "Marketplace", "1816620-8", "캡션 adapted를 reproduced로 바꾸기 권장")
];
const OLD = [
  R(["5(f)", "5(g)", "5(h)"], 124, "Jeong 2022, ACS Appl Electron Mater", "ACS", "RightsLink 2026-05-24", "확인 메일 참조", "APR 대상으로 발급. 원논문 CC BY-NC-ND 4.0"),
  R(["6(f)", "6(g)", "6(h)"], 90, "Kim 2025, ACS Appl Electron Mater", "ACS", "RightsLink 2026-05-24", "확인 메일 참조", "APR 대상으로 발급"),
  R(["7(a)", "7(b)", "7(c)", "7(g)", "7(h)", "7(i)"], 120, "Kim 2024, ACS Appl Mater Interfaces", "ACS", "RightsLink 2026-05-24", "확인 메일 참조", "APR 대상으로 발급. 신청서의 패널 표기는 7(a-c,e-g)"),
  R(["8(a)", "8(b)", "8(c)", "8(d)", "8(e)"], 119, "Choi 2024, Nano Lett", "ACS", "RightsLink 2026-05-24", "확인 메일 참조", "APR 대상으로 발급. 신청서의 패널 표기는 8(a,c,d,e,f)"),
  R(["2(c)"], 78, "Kim 2026, J Semicond", "J Semicond 편집부", "이메일 2026-05-29", "-", "APR 기준 요청. 조건: 원논문 인용"),
  R(["3(a)", "12(g)"], 5, "Hirose 2024, IEEE J Electron Devices Soc", "저자(SEL)", "이메일 2026-05-29", "-", "APR 기준 요청. 원논문 CC BY-NC-ND 4.0")
];
const OA = [
  R(["1(a)"], 25, "Mao 2024, Natl Sci Rev", "CC BY 4.0", "Notion 스크린샷"),
  R(["1(b)"], 26, "Yamazaki 2024, Commun Mater", "CC BY 4.0", "Notion 스크린샷"),
  R(["1(g)", "6(a)", "6(b)", "6(c)", "6(d)", "6(e)"], 28, "Ryu 2025, Adv Electron Mater", "CC BY 3.0 (CCC 표시) / 4.0 (Crossref)", "1(g) Notion, 6(a)–(e) 이전 APR 증빙", "논문 페이지에서 버전 확인 후 캡션 맞추기"),
  R(["4(c)"], 17, "Kim 2023, Int J Extrem Manuf", "CC BY 4.0", "이전 APR 증빙"),
  R(["4(d)"], 112, "Hong 2023, Adv Electron Mater", "CC BY 4.0", "이전 APR 증빙"),
  R(["4(h)"], 115, "Woo 2023, Adv Mater Interfaces", "CC BY 3.0 (CCC 표시) / 4.0 (Crossref)", "이전 APR 증빙", "논문 페이지에서 버전 확인 후 캡션 맞추기"),
  R(["9(a)"], 15, "Li 2023, Int J Extrem Manuf", "CC BY 4.0", "Notion 스크린샷"),
  R(["9(b)"], 130, "Becker 2019, Materials", "CC BY 4.0", "Notion 스크린샷"),
  R(["11(a)"], 188, "Hwang 2025, Nano Converg", "CC BY 4.0", "Notion 스크린샷"),
  R(["11(b)", "11(d)"], 91, "Kirtania 2025, IEEE Trans Electron Devices", "CC BY 4.0", "Notion 스크린샷"),
  R(["12(a)", "12(b)"], 31, "Lee 2026, Appl Phys Lett", "CC BY 4.0", "Notion 스크린샷"),
  R(["13(b)"], 75, "Kim 2025, Adv Electron Mater", "CC BY 3.0 (CCC 표시) / 4.0 (Crossref)", "Notion 스크린샷", "논문 페이지에서 버전 확인 후 캡션 맞추기"),
  R(["14(c)"], 109, "Pan 2025, Nano Lett", "CC BY 4.0", "Notion 스크린샷"),
  R(["14(d)"], 199, "Park 2025, IEEE Access", "CC BY 4.0", "Notion 스크린샷")
];
const EXCLUDED = [R(["2(a)"], 65, "Fujii 2024, IEEE IEDM", "IEEE", "RightsLink", "유료 204 USD, 받지 않음", "결제하거나 패널을 빼고 캡션·본문 수정")];

const pathOf = (panel, oa) => oa ? `${DIR}OA/Fig.${panel}_OA.pdf` : `${DIR}Fig.${panel}_permission.pdf`;
const ALL_PATHS = [...NEW, ...OLD].flatMap(r => r.p.map(x => pathOf(x, false))).concat(OA.flatMap(r => r.p.map(x => pathOf(x, true))));

async function openPath(path) {
  const w = window.open("", "_blank");
  if (w) w.document.write("<p style='font-family:sans-serif'>불러오는 중…</p>");
  try {
    const url = await getFileURL(path);
    if (!url) throw new Error("자료실에 파일이 없습니다");
    if (w) w.location.href = url; else window.open(url, "_blank");
  } catch (e) { if (w) w.close(); toast("열기 실패: " + errMsg(e)); }
}
function fileButtons(r, oa) {
  return r.p.map(x => {
    const path = pathOf(x, oa), has = !!fileByPath(path);
    return h("button", { class: "small", text: x, disabled: has ? null : true, title: has ? path : "아직 올리지 않음", onclick: () => openPath(path) });
  });
}
function table(key, title, rows, oa, cols) {
  const sig = sigOf([key, rows.map(r => r.p.map(x => !!fileByPath(pathOf(x, oa))))]);
  return keyed(h("div", { class: "folder" }, h("table", { class: "t files" },
    h("thead", null,
      h("tr", null, h("th", { colspan: cols.length + 1, text: title })),
      h("tr", null, cols.map(c => h("th", { text: c[0] })), h("th", { text: oa ? "증빙 파일" : "퍼미션 파일" }))),
    h("tbody", null, rows.map(r => h("tr", null,
      cols.map(c => h("td", { class: c[2] || "", text: String(c[1](r)) })),
      h("td", { class: "nowrap" }, fileButtons(r, oa))))))), "pm:" + key, sig);
}

function onPick(fileList) {
  const ok = /^Fig\.\d+\([a-z]\)_(permission|OA)\.pdf$/;
  const list = [];
  let skipped = 0;
  for (const f of fileList) {
    const parts = (f.webkitRelativePath || f.name).split("/");
    if (parts.includes("APR_이전") || !ok.test(f.name)) { skipped++; continue; }
    list.push({ file: f, path: f.name.endsWith("_OA.pdf") ? DIR + "OA/" + f.name : DIR + f.name });
  }
  if (list.length) queueUploads(list);
  toast(`퍼미션 파일 ${list.length}개를 올립니다. 해당 없는 파일 ${skipped}개는 건너뜁니다.`, 5000);
}

export function renderPerm() {
  const have = ALL_PATHS.filter(p => fileByPath(p)).length;
  const ups = S.uploads.filter(u => u.path.startsWith(DIR));
  const upDone = ups.filter(u => u.state === "완료" || u.state === "건너뜀").length;
  const upFail = ups.filter(u => u.state.startsWith("실패")).length;
  const head = h("div", { class: "card" },
    h("div", { class: "bar" }, h("strong", { text: "InfoMat 투고용 그림 퍼미션 (2026-10-20 기준)" })),
    h("div", { class: "meta", text: "그림 패널 86개: 새 라이선스 44 · 이전 퍼미션 재사용 20 · OA 증빙 21 · 유료라 제외 1. 저자가 그린 도식 3(b)–(f), 12(d), 12(h)는 퍼미션이 필요 없습니다." }),
    h("div", { class: "meta", text: "새 라이선스는 모두 0.00 USD입니다. ref 번호는 InfoMat 타겟 원고(2026-10-19 저장본) 기준입니다." }),
    h("div", { class: "bar" },
      h("span", { class: "count", text: `자료실에 올라간 퍼미션 파일 ${have}/${ALL_PATHS.length}개` }),
      ups.length ? h("span", { class: "muted", text: ` · 올리기 ${upDone}/${ups.length}${upFail ? ` · 실패 ${upFail}` : ""}` }) : null,
      h("span", { class: "grow" }),
      h("label", { class: "btn", title: "Permission 폴더를 고르면 Fig.N(x)_permission.pdf와 OA/Fig.N(x)_OA.pdf만 올리고 APR_이전 폴더는 건너뜁니다." },
        "Permission 폴더 올리기", h("input", { type: "file", multiple: true, webkitdirectory: true, hidden: true, onchange: e => { onPick(e.target.files); e.target.value = ""; } }))));
  const nodes = [keyed(head, "pm:head", sigOf([have, ups.map(u => [u.path, u.state])]))];
  const base = [["그림 패널", r => r.p.join(", ")], ["ref", r => r.ref], ["논문", r => r.paper], ["출판사", r => r.pub]];
  nodes.push(table("new", "1. 새로 받은 라이선스 (2026-10-20, InfoMat 대상)", NEW, false,
    [...base, ["방법", r => r.via], ["라이선스 번호", r => r.no, "nowrap"], ["비고", r => r.note, "meta"]]));
  nodes.push(table("old", "2. 이전 APR 퍼미션 재사용 (ACS 4편, 이메일 2건)", OLD, false,
    [...base, ["방법", r => r.via], ["라이선스 번호", r => r.no], ["비고", r => r.note, "meta"]]));
  nodes.push(table("oa", "3. OA 증빙 (퍼미션 불필요)", OA, true,
    [["그림 패널", r => r.p.join(", ")], ["ref", r => r.ref], ["논문", r => r.paper], ["라이선스", r => r.pub], ["증빙 출처", r => r.via], ["비고", r => r.note, "meta"]]));
  nodes.push(keyed(h("div", { class: "folder" }, h("table", { class: "t files" },
    h("thead", null, h("tr", null, h("th", { colspan: 6, text: "4. 유료라 받지 않은 것 (기록만)" })),
      h("tr", null, ["그림 패널", "ref", "논문", "출판사", "상태", "비고"].map(c => h("th", { text: c })))),
    h("tbody", null, EXCLUDED.map(r => h("tr", null, [r.p.join(", "), r.ref, r.paper, r.pub, r.no, r.note].map(v => h("td", { text: String(v) }))))))), "pm:ex", "static"));
  return nodes;
}

/* 자료실 탭: 파일 / 퍼미션 하위 탭 */
export function renderFilesTab() {
  const sub = S.filesSub || lsGet("filesSub") || "files";
  const bar = keyed(h("div", { class: "bar" }, h("div", { class: "seg" },
    [["files", "파일"], ["perm", "퍼미션"]].map(([k, label]) => h("button", { class: sub === k ? "on" : "", text: label,
      onclick: () => { S.filesSub = k; lsSet("filesSub", k); scheduleRender(); } })))), "fsub", sub);
  return [bar, ...(sub === "perm" ? renderPerm() : renderFiles(DIR))];
}
