import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  deleteSavedReading,
  fetchSavedReadingById,
  getSession,
  isSupabaseConfigured,
  updateSavedReading,
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
  buildSnapshotFromSavedReading,
  getReadingPreviewSummary,
} from "./shared/reading.js";
import {
  getReadingRenderElements,
  renderReadingSnapshot,
} from "./shared/reading-renderer.js";
import {
  closeModal,
  openModal,
  setupScrollTopButton,
  showToast,
} from "./shared/ui.js";

function $(id) {
  return document.getElementById(id);
}

function buildSavedUrl() {
  return new URL(document.body.dataset.linkSaved || "../saved/", window.location.href).toString();
}

function setGuestLinks() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  $("readingGuestSignin").href = `${document.body.dataset.linkSignin || "../signin/"}?next=${encodeURIComponent(currentPath)}`;
  $("readingGuestSignup").href = `${document.body.dataset.linkSignup || "../signup/"}?next=${encodeURIComponent(currentPath)}`;
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

function fillSummary(record, snapshot) {
  $("readingMeta").innerHTML = `
    <div class="reading-meta-grid">
      <div class="box profile-summary-box">
        <div class="title">저장 이름</div>
        <div class="text">${escapeHtml(record.entry_name)}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">성별</div>
        <div class="text">${escapeHtml(formatGenderLabel(record.gender))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">생년월일시</div>
        <div class="text">${escapeHtml(formatBirthDisplay(record, { includeCalendar: true }))}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">일주</div>
        <div class="text">${escapeHtml(snapshot.dayPillar.key)}(${escapeHtml(snapshot.dayPillar.hanja || "")}) · ${escapeHtml(snapshot.dayPillar.metaphor || "")}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">저장 시각</div>
        <div class="text">${escapeHtml(formatSavedAt(record.created_at) || "-")}</div>
      </div>
      <div class="box profile-summary-box">
        <div class="title">메모</div>
        <div class="text">${escapeHtml(record.memo || "메모 없음")}</div>
      </div>
    </div>
  `;
}

function fillEditForm(record) {
  $("readingEditName").value = record.entry_name || "";
  $("readingEditMemo").value = record.memo || "";
}

function setEditMode(active) {
  $("readingEditCard").classList.toggle("hidden", !active);
  $("readingEditButton").classList.toggle("hidden", active);
}

async function init() {
  initCommonPageTracking();
  setupAuthUi();
  setupScrollTopButton($("scrollTopButton"));
  setGuestLinks();

  trackEvent("reading_detail_view", {
    page_name: "reading",
  });

  if (!isSupabaseConfigured()) {
    $("readingConfigError").classList.remove("hidden");
    return;
  }

  const session = await getSession();
  if (!session) {
    $("readingGuest").classList.remove("hidden");
    return;
  }

  const readingId = new URLSearchParams(window.location.search).get("id");
  if (!readingId) {
    throw new Error("저장된 사주 ID가 없습니다.");
  }

  let record = await fetchSavedReadingById(readingId);
  if (!record) {
    throw new Error("해당 저장 사주를 찾지 못했습니다.");
  }

  let snapshot = buildSnapshotFromSavedReading(record);

  fillSummary(record, snapshot);
  fillEditForm(record);
  renderReadingSnapshot(getReadingRenderElements(document), snapshot);
  $("readingSection").classList.remove("hidden");

  $("readingEditButton").addEventListener("click", () => {
    setEditMode(true);
  });

  $("readingEditCancel").addEventListener("click", () => {
    fillEditForm(record);
    $("readingError").textContent = "";
    $("readingStatus").textContent = "";
    setEditMode(false);
  });

  $("readingEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const entryName = $("readingEditName").value.trim();
    const memo = $("readingEditMemo").value.trim();

    $("readingError").textContent = "";
    $("readingStatus").textContent = "";

    if (!entryName) {
      $("readingError").textContent = "저장 이름을 입력해 주세요.";
      return;
    }

    if (memo.length > 500) {
      $("readingError").textContent = "메모는 500자 이하로 입력해 주세요.";
      return;
    }

    try {
      $("readingStatus").textContent = "저장 중...";
      record = await updateSavedReading(record.id, {
        entry_name: entryName,
        memo,
      });

      snapshot = buildSnapshotFromSavedReading(record);
      fillSummary(record, snapshot);
      fillEditForm(record);
      setEditMode(false);
      $("readingStatus").textContent = "";
      showToast("저장된 사주 정보가 수정되었습니다.");

      trackEvent("saved_reading_update_success", {
        page_name: "reading",
        day_pillar_name: snapshot.dayPillar.key,
      });
    } catch (error) {
      $("readingError").textContent = error.message || "저장 정보를 수정하지 못했습니다.";
      $("readingStatus").textContent = "";
    }
  });

  $("shareReadingButton").addEventListener("click", async () => {
    const button = $("shareReadingButton");
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "공유 링크 준비 중...";

    try {
      const sharedReading = await upsertSharedReading(
        buildSharedReadingPayload(snapshot, {
          sourceType: "saved_reading",
          sourceRecordId: record.id,
          entryName: record.entry_name,
          memo: record.memo,
        })
      );

      await shareLink(
        buildReadingSharePayload({
          entryName: record.entry_name,
          dayPillarKey: snapshot.dayPillar.key,
          summary: getReadingPreviewSummary(snapshot),
          url: buildShareUrl(sharedReading.share_token),
        })
      );

      trackEvent("reading_share_click", {
        page_name: "reading",
        source_type: "saved_reading",
        day_pillar_name: snapshot.dayPillar.key,
      });
    } catch (error) {
      window.alert(error.message || "공유 링크를 준비하지 못했습니다.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  document.querySelectorAll("[data-delete-close]").forEach((button) => {
    button.addEventListener("click", () => {
      closeModal($("readingDeleteModal"));
    });
  });

  $("deleteReadingButton").addEventListener("click", () => {
    openModal($("readingDeleteModal"));
  });

  $("confirmDeleteReading").addEventListener("click", async () => {
    const button = $("confirmDeleteReading");
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "삭제 중...";

    try {
      await deleteSavedReading(record.id);
      trackEvent("saved_reading_delete_success", {
        page_name: "reading",
      });
      window.location.replace(buildSavedUrl());
    } catch (error) {
      $("readingError").textContent = error.message || "저장한 사주를 삭제하지 못했습니다.";
      closeModal($("readingDeleteModal"));
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

init().catch((error) => {
  $("readingError").textContent = error.message || "저장된 사주 상세 페이지를 불러오지 못했습니다.";
});
