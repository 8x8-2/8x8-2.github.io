import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  fetchPublicSharedReading,
  isSupabaseConfigured,
} from "./shared/auth.js";
import {
  formatBirthDisplay,
  formatGenderLabel,
} from "./shared/birth.js";
import { escapeHtml } from "./shared/html.js";
import { buildSnapshotFromSharedReading } from "./shared/reading.js";
import {
  getReadingRenderElements,
  renderReadingSnapshot,
} from "./shared/reading-renderer.js";
import { setupScrollTopButton } from "./shared/ui.js";

function $(id) {
  return document.getElementById(id);
}

function fillSharedMeta(record, snapshot) {
  const source = {
    ...record,
    gender: snapshot.gender,
    birth_year: snapshot.birthInfo.year,
    birth_month: snapshot.birthInfo.month,
    birth_day: snapshot.birthInfo.day,
    birth_hour: snapshot.birthInfo.hour,
    birth_minute: snapshot.birthInfo.minute,
    birth_time_known: !snapshot.unknownTime,
    calendar_type: snapshot.birthInfo.isLunar ? "lunar" : "solar",
    is_leap_month: snapshot.birthInfo.isLeapMonth,
  };

  $("sharedMeta").innerHTML = `
    <div class="reading-meta-grid">
      <div class="box profile-summary-box">
        <div class="title">공유된 이름</div>
        <div class="text">${escapeHtml(record.entry_name)}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">성별</div>
        <div class="text">${escapeHtml(formatGenderLabel(snapshot.gender))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">생년월일시</div>
        <div class="text">${escapeHtml(formatBirthDisplay(source, { includeCalendar: true }))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">일주</div>
        <div class="text">${escapeHtml(snapshot.dayPillar.key)}(${escapeHtml(snapshot.dayPillar.hanja || "")}) · ${escapeHtml(snapshot.dayPillar.metaphor || "")}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">메모</div>
        <div class="text">${escapeHtml(record.memo || "메모 없음")}</div>
      </div>
    </div>
  `;
}

async function init() {
  initCommonPageTracking();
  setupScrollTopButton($("scrollTopButton"));

  trackEvent("shared_reading_view", {
    page_name: "share",
  });

  if (!isSupabaseConfigured()) {
    $("shareConfigError").classList.remove("hidden");
    return;
  }

  const shareToken = new URLSearchParams(window.location.search).get("token");
  if (!shareToken) {
    throw new Error("공유 토큰이 없습니다.");
  }

  const sharedRecord = await fetchPublicSharedReading(shareToken);
  if (!sharedRecord) {
    throw new Error("공유된 스텔라 프로필 정보를 찾지 못했습니다.");
  }

  const snapshot = buildSnapshotFromSharedReading(sharedRecord);
  fillSharedMeta(sharedRecord, snapshot);
  renderReadingSnapshot(getReadingRenderElements(document), snapshot);

  document.title = `${sharedRecord.entry_name} 스텔라 프로필 공유 | 스텔라 ID`;
  $("shareHeading").textContent = `${sharedRecord.entry_name}님의 스텔라 프로필`;
  $("shareSubtitle").textContent = "공유 링크로 열람 중인 스텔라 프로필 페이지입니다. 로그인하지 않아도 결과를 그대로 볼 수 있습니다.";
  $("shareSection").classList.remove("hidden");
}

init().catch((error) => {
  $("shareError").textContent = error.message || "공유된 스텔라 프로필 페이지를 불러오지 못했습니다.";
});
