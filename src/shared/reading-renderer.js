import { formatHiddenStemLine, getTenGodBrief } from "../engine/saju-advanced.js";
import { getDayPillarArchetype } from "../../data/daypillars.js";
import { escapeHtml } from "./html.js";
import { ELEMENT_CLASS, ELEMENT_DISPLAY } from "./reading.js";

const PILLAR_COLUMNS = [
  { key: "hour", label: "시" },
  { key: "day", label: "일" },
  { key: "month", label: "월" },
  { key: "year", label: "년" },
];

const PILLAR_ROWS = [
  { key: "stem", label: "천간" },
  { key: "branch", label: "지지" },
];

function renderGlyphCell(glyph) {
  const elementClass = glyph.empty ? "unknown" : (ELEMENT_CLASS[glyph.element] || "unknown");
  const elementText = glyph.empty ? "시간 모름" : (ELEMENT_DISPLAY[glyph.element] || "");

  return `
    <div class="pillar-card ${glyph.empty ? "is-empty" : ""}" data-element="${escapeHtml(elementClass)}">
      <span class="pillar-korean">${escapeHtml(glyph.char || "-")}</span>
      <span class="pillar-hanja">${escapeHtml(glyph.hanja || "?")}</span>
      <span class="pillar-element">${escapeHtml(elementText)}</span>
    </div>
  `;
}

function renderPillarsTable(pillars) {
  return PILLAR_ROWS
    .map(
      (row) => `
        <tr>
          <th scope="row"><span class="axis-label">${escapeHtml(row.label)}</span></th>
          ${PILLAR_COLUMNS.map((column) => `<td>${renderGlyphCell(pillars[column.key][row.key])}</td>`).join("")}
        </tr>
      `
    )
    .join("");
}

function renderSummaryBox(element, summary, note = "") {
  element.innerHTML = `
    <div class="text">${escapeHtml(summary)}</div>
    ${note ? `<p class="mini-note">${escapeHtml(note)}</p>` : ""}
  `;
}

function renderDayPillarKeywords(keywords = []) {
  if (!keywords.length) return "";

  return `
    <div class="impact-pills day-pillar-keywords">
      ${keywords.map((keyword) => `<span class="impact-chip impact-chip-neutral">${escapeHtml(keyword)}</span>`).join("")}
    </div>
  `;
}

function renderDayPillarProfile(element, pillars) {
  const dayPillarKey = `${pillars.day.stem.char}${pillars.day.branch.char}`;
  const info = getDayPillarArchetype(dayPillarKey);

  if (!info) {
    element.innerHTML = `
      <div class="title">${escapeHtml(dayPillarKey)} 일주</div>
      <div class="text">이 일주에 대한 물상 설명은 아직 준비 중입니다.</div>
    `;
    return;
  }

  element.innerHTML = `
    <div class="title">${escapeHtml(dayPillarKey)}(${escapeHtml(info.hanja)}) 일주</div>
    <div class="day-pillar-metaphor">${escapeHtml(info.metaphor)}</div>
    ${renderDayPillarKeywords(info.keywords)}
    <div class="text day-pillar-overview">${escapeHtml(info.overview || "전통 물상 해석에서는 이 일주를 위와 같은 이미지로 비유합니다.")}</div>
    <p class="mini-note">물상 개요는 공개 일주론 자료와 물상 비유를 바탕으로, 처음 보는 사람도 이해하기 쉽게 풀어쓴 요약입니다.</p>
  `;
}

function renderTenGodCards(tenGods) {
  return tenGods.items
    .map((item) => {
      const leadGod = item.stemTenGod === "일원" ? item.branchTenGod : item.stemTenGod;
      const brief = leadGod && leadGod !== "미상" ? getTenGodBrief(leadGod) : "";

      return `
        <article class="box insight-card">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="metric-row">
            <span class="metric-label">천간 십성</span>
            <span class="metric-value">${escapeHtml(item.stemTenGod || "미상")}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">지지 주기</span>
            <span class="metric-value">${escapeHtml(item.branchTenGod || "미상")}</span>
          </div>
          <div class="metric-row metric-row-wide">
            <span class="metric-label">지장간</span>
            <span class="metric-value">${escapeHtml(formatHiddenStemLine(item.hiddenStems))}</span>
          </div>
          ${brief ? `<p class="mini-note">${escapeHtml(brief)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderTextBoxes(items) {
  return items
    .map(
      (item) => `
        <div class="box">
          <div class="title">${escapeHtml(item.title)}</div>
          <div class="text">${escapeHtml(item.text)}</div>
        </div>
      `
    )
    .join("");
}

function renderImpactChips(items, variant, emptyText) {
  const source = items.length ? items : [emptyText];
  return source
    .map((item) => `<span class="impact-chip impact-chip-${escapeHtml(variant)}">${escapeHtml(item)}</span>`)
    .join("");
}

function renderToneChips(tags) {
  return tags
    .map((tag) => `<span class="impact-chip impact-chip-${escapeHtml(tag.tone || "neutral")}">${escapeHtml(tag.label)}</span>`)
    .join("");
}

function renderDiagnosisCards(diagnosis) {
  return diagnosis.cards
    .map((card) => `
      <article class="box insight-card diagnosis-card">
        <div class="luck-head">
          <div class="title">${escapeHtml(card.title)}</div>
          ${card.headline ? `<span class="luck-pill">${escapeHtml(card.headline)}</span>` : ""}
        </div>
        ${card.tags?.length ? `<div class="impact-pills diagnosis-pills">${renderToneChips(card.tags)}</div>` : ""}
        <div class="text">${escapeHtml(card.text)}</div>
        ${card.note ? `<p class="mini-note">${escapeHtml(card.note)}</p>` : ""}
      </article>
    `)
    .join("");
}

function renderLuckCards(items, type) {
  return items
    .map((item) => {
      const periodText = type === "major"
        ? `${item.startYear}~${item.endYear} · 약 ${item.ageStart}세~${item.ageEnd}세`
        : `${item.year}년`;
      const detailNote = item.interactionNote || item.note;

      return `
        <article class="box luck-card ${item.isCurrent ? "is-current" : ""}">
          <div class="luck-head">
            <div class="title">${escapeHtml(type === "major" ? `${item.index}대운 ${item.pillarString}` : `${item.year}년 ${item.pillarString}`)}</div>
            <span class="luck-pill ${item.isCurrent ? "is-active" : ""}">${escapeHtml(item.isCurrent ? "현재" : item.focus)}</span>
          </div>
          <div class="luck-period">${escapeHtml(periodText)}</div>
          <div class="luck-meta">천간 ${escapeHtml(item.stemGod)} · 지지 ${escapeHtml(item.branchGod)}</div>
          <div class="badge-row">
            <span class="luck-badge">${escapeHtml(item.focus)}</span>
            ${item.wealthHitCount > 0 ? `<span class="luck-badge">재성 신호 ${escapeHtml(item.wealthHitCount)}</span>` : ""}
            ${item.alignmentText ? `<span class="luck-badge luck-badge-emphasis">${escapeHtml(item.alignmentText)}</span>` : ""}
          </div>
          <div class="luck-track">
            <span class="metric-label">배경</span>
            <span class="metric-value">${escapeHtml(item.background)}</span>
          </div>
          <div class="luck-track">
            <span class="metric-label">체감</span>
            <span class="metric-value">${escapeHtml(item.result)}</span>
          </div>
          <div class="impact-block">
            <div class="impact-title">힘 받는 점</div>
            <div class="impact-pills">${renderImpactChips(item.boosts, "good", "기본기 정비")}</div>
          </div>
          <div class="impact-block">
            <div class="impact-title">주의할 점</div>
            <div class="impact-pills">${renderImpactChips(item.cautions, "warn", "무리한 확장")}</div>
          </div>
          ${item.interactionTags?.length ? `
            <div class="impact-block">
              <div class="impact-title">합·형·충·파·해</div>
              <div class="impact-pills">${renderToneChips(item.interactionTags)}</div>
            </div>
          ` : ""}
          ${detailNote ? `<p class="mini-note">${escapeHtml(detailNote)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

export function getReadingRenderElements(root = document) {
  return {
    pillarsEl: root.getElementById("pillars"),
    dayPillarProfileEl: root.getElementById("dayPillarProfile"),
    sectionsEl: root.getElementById("sections"),
    tenGodsSummaryEl: root.getElementById("tenGodsSummary"),
    tenGodsEl: root.getElementById("tenGods"),
    diagnosisSummaryEl: root.getElementById("diagnosisSummary"),
    diagnosisEl: root.getElementById("diagnosis"),
    wealthSummaryEl: root.getElementById("wealthSummary"),
    wealthCardsEl: root.getElementById("wealthCards"),
    majorLuckSummaryEl: root.getElementById("majorLuckSummary"),
    majorLuckEl: root.getElementById("majorLuck"),
    yearLuckSummaryEl: root.getElementById("yearLuckSummary"),
    yearLuckEl: root.getElementById("yearLuck"),
  };
}

export function renderReadingSnapshot(elements, snapshot) {
  const advanced = snapshot.advanced || {};

  elements.pillarsEl.innerHTML = renderPillarsTable(snapshot.pillars);
  renderDayPillarProfile(elements.dayPillarProfileEl, snapshot.pillars);

  elements.sectionsEl.innerHTML = (snapshot.sections || [])
    .map(
      (section) => `
        <div class="box">
          <div class="title">${escapeHtml(section.title)}</div>
          <div class="text">${escapeHtml(section.text)}</div>
        </div>
      `
    )
    .join("");

  renderSummaryBox(elements.tenGodsSummaryEl, advanced.tenGods?.summary || "", advanced.tenGods?.note || "");
  elements.tenGodsEl.innerHTML = renderTenGodCards(advanced.tenGods || { items: [] });

  renderSummaryBox(elements.diagnosisSummaryEl, advanced.diagnosis?.summary || "", advanced.diagnosis?.note || "");
  elements.diagnosisEl.innerHTML = renderDiagnosisCards(advanced.diagnosis || { cards: [] });

  renderSummaryBox(elements.wealthSummaryEl, advanced.wealth?.summary || "");
  elements.wealthCardsEl.innerHTML = renderTextBoxes(advanced.wealth?.cards || []);

  renderSummaryBox(elements.majorLuckSummaryEl, advanced.majorLuck?.summary || "", advanced.majorLuck?.note || "");
  elements.majorLuckEl.innerHTML = renderLuckCards(advanced.majorLuck?.items || [], "major");

  renderSummaryBox(elements.yearLuckSummaryEl, advanced.yearLuck?.summary || "", advanced.yearLuck?.note || "");
  elements.yearLuckEl.innerHTML = renderLuckCards(advanced.yearLuck?.items || [], "year");
}
