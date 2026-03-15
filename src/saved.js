import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  fetchFollowingProfiles,
  fetchProfile,
  getSession,
  isSupabaseConfigured,
} from "./shared/auth.js";
import { formatGenderLabel } from "./shared/birth.js";
import { escapeHtml } from "./shared/html.js";
import { renderSocialNav } from "./shared/social-nav.js";
import { buildPublicProfileUrl } from "./shared/stellar-id.js";

function $(id) {
  return document.getElementById(id);
}

function renderCard(record) {
  return `
    <a
      class="card search-result-row"
      href="${escapeHtml(buildPublicProfileUrl(record.stellar_id))}"
    >
      <div class="profile-avatar">
        ${record.profile_image_url
          ? `<img src="${escapeHtml(record.profile_image_url)}" alt="" />`
          : `<span>${escapeHtml(String(record.full_name || "스").charAt(0))}</span>`
        }
      </div>
      <div class="search-result-copy">
        <div class="search-result-id">${escapeHtml(String(record.stellar_id))}</div>
        <div class="search-result-meta">${escapeHtml(record.full_name)} · ${escapeHtml(formatGenderLabel(record.gender))} · ${escapeHtml(record.day_pillar_key || "-")}</div>
      </div>
    </a>
  `;
}

async function renderFollowingList() {
  const query = $("savedSearch").value.trim();
  const sort = $("followingSort").value;
  $("savedError").textContent = "";

  try {
    const profiles = await fetchFollowingProfiles({ sort, query });
    $("savedList").innerHTML = profiles.map(renderCard).join("");
    $("savedCount").textContent = `${profiles.length}개 프로필`;
    $("savedEmptyTitle").textContent = query ? "검색 결과가 없습니다" : "아직 팔로잉한 프로필이 없습니다";
    $("savedEmptyText").textContent = query
      ? "다른 이름, 일주, 스텔라 ID로 다시 찾아보세요."
      : "검색 페이지에서 마음에 드는 스텔라 프로필을 팔로우해 보세요.";
    $("savedEmpty").classList.toggle("hidden", profiles.length > 0);
  } catch (error) {
    $("savedError").textContent = error.message || "팔로잉 프로필을 불러오지 못했습니다.";
  }
}

async function init() {
  initCommonPageTracking();
  trackEvent("following_profiles_view", {
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

  const profile = await fetchProfile(session.user.id);
  renderSocialNav(document.querySelector("[data-social-nav]"), {
    session,
    viewerProfile: profile,
    currentStellarId: profile?.stellar_id,
    pageTitle: "팔로잉 프로필",
  });

  ["input", "change", "search", "keyup", "compositionend"].forEach((eventName) => {
    $("savedSearch")?.addEventListener(eventName, () => {
      renderFollowingList().catch(() => {});
    });
  });

  $("followingSort")?.addEventListener("change", () => {
    renderFollowingList().catch(() => {});
  });

  await renderFollowingList();
}

init().catch((error) => {
  $("savedError").textContent = error.message || "팔로잉 프로필 페이지를 불러오지 못했습니다.";
});
