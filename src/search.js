import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import { fetchProfile, getSession, isSupabaseConfigured, searchPublicProfiles } from "./shared/auth.js";
import { formatGenderLabel } from "./shared/birth.js";
import { escapeHtml } from "./shared/html.js";
import { renderSocialNav } from "./shared/social-nav.js";
import { buildPublicProfileUrl } from "./shared/stellar-id.js";

function $(id) {
  return document.getElementById(id);
}

function renderAvatar(result) {
  if (result.profile_image_url) {
    return `<img src="${escapeHtml(result.profile_image_url)}" alt="" />`;
  }

  return `<span>${escapeHtml(String(result.full_name || "스").charAt(0))}</span>`;
}

function renderResultRow(result) {
  return `
    <a class="card search-result-row" href="${escapeHtml(buildPublicProfileUrl(result.stellar_id))}">
      <div class="profile-avatar">${renderAvatar(result)}</div>
      <div class="search-result-copy">
        <div class="search-result-id">${escapeHtml(String(result.stellar_id))}</div>
        <div class="search-result-meta">${escapeHtml(result.full_name)} · ${escapeHtml(formatGenderLabel(result.gender))} · ${escapeHtml(result.day_pillar_key || "-")}</div>
      </div>
    </a>
  `;
}

async function runSearch() {
  const query = $("searchInput").value.trim();
  $("searchError").textContent = "";
  $("searchStatus").textContent = query ? "검색 중..." : "추천 스텔라 프로필을 불러오는 중...";

  try {
    const results = await searchPublicProfiles(query, 20);
    $("searchResults").innerHTML = results.map(renderResultRow).join("");
    $("searchStatus").textContent = results.length
      ? `${results.length}개의 스텔라 프로필`
      : (query ? "검색 결과가 없습니다." : "추천할 프로필이 아직 없습니다.");
    $("searchEmpty").classList.toggle("hidden", results.length > 0);
  } catch (error) {
    $("searchError").textContent = error.message || "검색에 실패했습니다.";
    $("searchStatus").textContent = "";
  }
}

async function init() {
  initCommonPageTracking();
  trackEvent("search_view", {
    page_name: "search",
  });

  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 연결이 아직 설정되지 않았습니다.");
  }

  const session = await getSession();
  if (!session) {
    window.location.href = new URL(document.body.dataset.linkSignin || "../signin/", window.location.href).toString();
    return;
  }

  const viewerProfile = await fetchProfile(session.user.id);
  renderSocialNav(document.querySelector("[data-social-nav]"), {
    variant: "search",
    session,
    viewerProfile,
    searchTitle: "스텔라 프로필 검색",
  });

  $("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch().catch(() => {});
  });

  let timer = null;
  $("searchInput").addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      runSearch().catch(() => {});
    }, 150);
  });

  await runSearch();
}

init().catch((error) => {
  $("searchError").textContent = error.message || "검색 페이지를 불러오지 못했습니다.";
});
