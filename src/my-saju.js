import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  fetchProfile,
  getSession,
  isSupabaseConfigured,
  upsertSharedReading,
} from "./shared/auth.js";
import {
  formatBirthDisplay,
  formatGenderLabel,
} from "./shared/birth.js";
import { setupAuthUi } from "./shared/auth-ui.js";
import { escapeHtml } from "./shared/html.js";
import {
  buildReadingSharePayload,
  buildShareUrl,
  shareLink,
} from "./shared/share.js";
import {
  buildSharedReadingPayload,
  buildSnapshotFromProfile,
  getReadingPreviewSummary,
} from "./shared/reading.js";
import {
  getReadingRenderElements,
  renderReadingSnapshot,
} from "./shared/reading-renderer.js";
import { setupScrollTopButton } from "./shared/ui.js";

function $(id) {
  return document.getElementById(id);
}

function buildProfileUrl(userId) {
  const url = new URL(document.body.dataset.linkProfile || "../p/", window.location.href);
  url.searchParams.set("user_id", userId);
  return url.toString();
}

function setGuestLinks() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  $("mySajuGuestSignin").href = `${document.body.dataset.linkSignin || "../signin/"}?next=${encodeURIComponent(currentPath)}`;
  $("mySajuGuestSignup").href = `${document.body.dataset.linkSignup || "../signup/"}?next=${encodeURIComponent(currentPath)}`;
}

function fillSummary(profile, snapshot) {
  $("mySajuSummary").innerHTML = `
    <div class="reading-meta-grid">
      <div class="box profile-summary-box">
        <div class="title">이름</div>
        <div class="text">${escapeHtml(profile.full_name)}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">성별</div>
        <div class="text">${escapeHtml(formatGenderLabel(profile.gender))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">생년월일시</div>
        <div class="text">${escapeHtml(formatBirthDisplay(profile, { includeCalendar: true }))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">일주</div>
        <div class="text">${escapeHtml(snapshot.dayPillar.key)}(${escapeHtml(snapshot.dayPillar.hanja || "")}) · ${escapeHtml(snapshot.dayPillar.metaphor || "")}</div>
      </div>
    </div>
  `;
}

async function init() {
  initCommonPageTracking();
  setupAuthUi();
  setupScrollTopButton($("scrollTopButton"));
  setGuestLinks();

  trackEvent("my_saju_view", {
    page_name: "my_saju",
  });

  if (!isSupabaseConfigured()) {
    $("mySajuConfigError").classList.remove("hidden");
    return;
  }

  const session = await getSession();
  if (!session) {
    $("mySajuGuest").classList.remove("hidden");
    return;
  }

  const profile = await fetchProfile(session.user.id);
  if (!profile) {
    throw new Error("내 사주 기준 정보를 불러오지 못했습니다.");
  }

  const snapshot = buildSnapshotFromProfile(profile);
  fillSummary(profile, snapshot);
  renderReadingSnapshot(getReadingRenderElements(document), snapshot);

  $("mySajuSection").classList.remove("hidden");
  $("profileEditLink").href = buildProfileUrl(session.user.id);

  $("shareMySajuButton").addEventListener("click", async () => {
    const button = $("shareMySajuButton");
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "공유 링크 준비 중...";

    try {
      const sharedReading = await upsertSharedReading(
        buildSharedReadingPayload(snapshot, {
          sourceType: "profile",
          sourceRecordId: profile.id,
          entryName: profile.full_name,
          memo: "",
        })
      );

      const url = buildShareUrl(sharedReading.share_token);
      await shareLink(
        buildReadingSharePayload({
          entryName: profile.full_name,
          dayPillarKey: snapshot.dayPillar.key,
          summary: getReadingPreviewSummary(snapshot),
          url,
        })
      );

      trackEvent("reading_share_click", {
        page_name: "my_saju",
        source_type: "profile",
        day_pillar_name: snapshot.dayPillar.key,
      });
    } catch (error) {
      window.alert(error.message || "공유 링크를 준비하지 못했습니다.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

init().catch((error) => {
  $("mySajuError").textContent = error.message || "내 사주 페이지를 불러오지 못했습니다.";
});
