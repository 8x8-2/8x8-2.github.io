import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  fetchSavedReadings,
  getSession,
  isSupabaseConfigured,
} from "./shared/auth.js";
import { setupAuthUi } from "./shared/auth-ui.js";

function $(id) {
  return document.getElementById(id);
}

function formatBirth(record) {
  const base = `${record.birth_year}.${String(record.birth_month).padStart(2, "0")}.${String(record.birth_day).padStart(2, "0")}`;

  if (!record.birth_time_known) {
    return `${base} · 시간 모름`;
  }

  return `${base} · ${String(record.birth_hour).padStart(2, "0")}:${String(record.birth_minute).padStart(2, "0")}`;
}

function formatSavedAt(value) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function renderCard(record) {
  const searchText = [
    record.entry_name,
    record.day_pillar_key,
    record.day_pillar_metaphor,
    record.memo,
    record.preview_summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return `
    <article class="box saved-reading-card" data-saved-card data-search="${searchText}" data-element="${record.element_class}">
      <div class="saved-reading-head">
        <div>
          <div class="title">${record.entry_name}</div>
          <div class="saved-reading-meta">${record.gender === "male" ? "남" : "여"} · ${formatBirth(record)}</div>
        </div>
        <span class="luck-pill">${record.day_pillar_key} 일주</span>
      </div>
      <div class="saved-reading-subtitle">${record.day_pillar_hanja || ""} · ${record.day_pillar_metaphor || ""}</div>
      <div class="text">${record.preview_summary}</div>
      ${record.memo ? `<div class="saved-reading-note">메모: ${record.memo}</div>` : ""}
      <div class="saved-reading-foot">${formatSavedAt(record.created_at)}</div>
    </article>
  `;
}

function applyFilter() {
  const query = ($("savedSearch")?.value || "").trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll("[data-saved-card]"));
  let visibleCount = 0;

  cards.forEach((card) => {
    const visible = !query || (card.dataset.search || "").includes(query);
    card.classList.toggle("is-hidden", !visible);
    if (visible) visibleCount += 1;
  });

  $("savedCount").textContent = `${visibleCount}개 기록`;
  $("savedEmpty").classList.toggle("hidden", visibleCount > 0);
}

function scheduleApplyFilter() {
  window.requestAnimationFrame(() => {
    applyFilter();
  });
}

async function init() {
  initCommonPageTracking();
  setupAuthUi();
  trackEvent("saved_readings_view", {
    page_name: "saved",
  });

  if (!isSupabaseConfigured()) {
    $("savedConfigError").classList.remove("hidden");
    return;
  }

  const session = await getSession();
  if (!session) {
    $("savedGuest").classList.remove("hidden");
    return;
  }

  try {
    const readings = await fetchSavedReadings();
    $("savedList").innerHTML = readings.map(renderCard).join("");
    $("savedCount").textContent = `${readings.length}개 기록`;
    $("savedEmpty").classList.toggle("hidden", readings.length > 0);
  } catch (error) {
    $("savedError").textContent = error.message || "저장한 사주를 불러오지 못했습니다.";
  }

  ["input", "change", "search", "keyup", "compositionend"].forEach((eventName) => {
    $("savedSearch")?.addEventListener(eventName, scheduleApplyFilter);
  });
  scheduleApplyFilter();
}

init().catch((error) => {
  $("savedError").textContent = error.message || "저장한 사주 페이지를 불러오지 못했습니다.";
});
