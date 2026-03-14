import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  fetchProfile,
  fetchSavedReadings,
  getSession,
  isSupabaseConfigured,
} from "./shared/auth.js";
import {
  formatBirthDisplay,
  formatGenderLabel,
} from "./shared/birth.js";
import { setupAuthUi } from "./shared/auth-ui.js";
import { escapeHtml } from "./shared/html.js";
import { buildSnapshotFromProfile } from "./shared/reading.js";

function $(id) {
  return document.getElementById(id);
}

function buildReadingUrl(id) {
  const url = new URL(document.body.dataset.linkReading || "../reading/", window.location.href);
  url.searchParams.set("id", id);
  return url.toString();
}

function buildMySajuUrl() {
  return new URL(document.body.dataset.linkMySaju || "../my-saju/", window.location.href).toString();
}

function buildProfileUrl(userId) {
  const url = new URL(document.body.dataset.linkProfile || "../p/", window.location.href);
  url.searchParams.set("user_id", userId);
  return url.toString();
}

function renderMySajuCard(profile, snapshot) {
  const searchText = [
    profile.full_name,
    snapshot.dayPillar.key,
    snapshot.dayPillar.metaphor,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return `
    <article class="box saved-reading-card saved-reading-card-static" data-element="${escapeHtml(snapshot.dayPillar.elementClass)}" data-search="${escapeHtml(searchText)}">
      <div class="saved-reading-label">항상 고정된 내 사주</div>
      <div class="saved-reading-head">
        <div>
          <div class="title">${escapeHtml(profile.full_name)}</div>
          <div class="saved-reading-meta">${escapeHtml(formatGenderLabel(profile.gender))} · ${escapeHtml(formatBirthDisplay(profile, { includeCalendar: true }))}</div>
        </div>
        <span class="luck-pill">${escapeHtml(snapshot.dayPillar.key)} 일주</span>
      </div>
      <div class="saved-reading-subtitle">${escapeHtml(snapshot.dayPillar.hanja || "")} · ${escapeHtml(snapshot.dayPillar.metaphor || "")}</div>
      <div class="saved-reading-actions">
        <a class="text-link-button" href="${buildMySajuUrl()}">내 사주 보기</a>
        <a class="text-link-button" href="${buildProfileUrl(profile.id)}">내 정보 수정</a>
      </div>
    </article>
  `;
}

function renderCard(record) {
  const searchText = [
    record.entry_name,
    record.day_pillar_key,
    record.day_pillar_metaphor,
    record.memo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return `
    <a
      class="box saved-reading-card saved-reading-card-link"
      href="${buildReadingUrl(record.id)}"
      data-saved-card
      data-search="${escapeHtml(searchText)}"
      data-element="${escapeHtml(record.element_class)}"
    >
      <div class="saved-reading-head">
        <div>
          <div class="title">${escapeHtml(record.entry_name)}</div>
          <div class="saved-reading-meta">${escapeHtml(formatGenderLabel(record.gender))} · ${escapeHtml(formatBirthDisplay(record, { includeCalendar: true }))}</div>
        </div>
        <span class="luck-pill">${escapeHtml(record.day_pillar_key)} 일주</span>
      </div>
      ${record.memo ? `<div class="saved-reading-note saved-reading-note-compact">${escapeHtml(record.memo)}</div>` : ""}
    </a>
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
  $("savedEmptyTitle").textContent = query ? "검색 결과가 없습니다" : "아직 저장한 사주가 없습니다";
  $("savedEmptyText").textContent = query
    ? "다른 이름이나 메모 키워드로 다시 찾아보세요."
    : "홈에서 사주 결과를 저장하면 이 보관함에 차곡차곡 모입니다.";
  $("savedEmpty").classList.toggle("hidden", visibleCount > 0);
}

function scheduleApplyFilter() {
  window.requestAnimationFrame(applyFilter);
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
    const [profile, readings] = await Promise.all([
      fetchProfile(session.user.id),
      fetchSavedReadings(),
    ]);

    if (profile) {
      const snapshot = buildSnapshotFromProfile(profile);
      $("mySajuCard").innerHTML = renderMySajuCard(profile, snapshot);
      $("mySajuSection").classList.remove("hidden");
    }

    $("savedList").innerHTML = readings.map(renderCard).join("");
    $("savedCount").textContent = `${readings.length}개 기록`;
    $("savedEmpty").classList.toggle("hidden", readings.length > 0);
  } catch (error) {
    $("savedError").textContent = error.message || "사주 보관함을 불러오지 못했습니다.";
  }

  ["input", "change", "search", "keyup", "compositionend"].forEach((eventName) => {
    $("savedSearch")?.addEventListener(eventName, scheduleApplyFilter);
  });

  scheduleApplyFilter();
}

init().catch((error) => {
  $("savedError").textContent = error.message || "사주 보관함 페이지를 불러오지 못했습니다.";
});
