import { getAllDayPillarEntries, getDayPillarElement } from "../data/daypillars.js";
import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  fetchProfile,
  fetchPublicProfileByStellarId,
  followProfile,
  getSession,
  isSupabaseConfigured,
  unfollowProfile,
} from "./shared/auth.js";
import {
  buildFlowSeries,
  buildProfileDerivedFieldsFromInput,
  canViewProfileSection,
  getPublicProfileMeta,
  getRelationshipLabel,
  getRelationshipScore,
  getSnapshotSection,
  getTodayScore,
} from "./shared/profile-derived.js";
import { formatGenderLabel } from "./shared/birth.js";
import { escapeHtml } from "./shared/html.js";
import { renderSocialNav } from "./shared/social-nav.js";
import { shareLink } from "./shared/share.js";
import { applyPrettyProfilePath, buildProfileSettingsUrl, buildPublicProfileUrl, getRequestedStellarId } from "./shared/stellar-id.js";
import { formatRegionDisplay } from "./shared/regions.js";

const TABS = [
  { key: "home", label: "홈", icon: "home" },
  { key: "personality", label: "성격", icon: "mind" },
  { key: "health", label: "건강", icon: "health" },
  { key: "love", label: "연애", icon: "love" },
  { key: "ability", label: "능력", icon: "ability" },
  { key: "majorLuck", label: "대세운", icon: "chart" },
];

function $(id) {
  return document.getElementById(id);
}

function getTabIcon(name) {
  const icons = {
    home: '<path d="M4.5 10.5 12 4l7.5 6.5v8A1.5 1.5 0 0 1 18 20h-3.5v-5h-5v5H6a1.5 1.5 0 0 1-1.5-1.5v-8Z" fill="currentColor"/>',
    mind: '<path d="M12 3.5a7 7 0 0 0-4.88 12.02c.54.52.88 1.22.88 1.97v.51h8v-.5c0-.76.34-1.46.88-1.98A7 7 0 0 0 12 3.5Zm-2.25 17a1.25 1.25 0 0 0 2.5 0h-2.5Z" fill="currentColor"/>',
    health: '<path d="M12.5 4.5h-1v5h-5v1h5v5h1v-5h5v-1h-5v-5Z" fill="currentColor"/><path d="M12 2.5c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" fill="currentColor"/>',
    love: '<path d="M12 19.35 3.78 11.8a4.77 4.77 0 0 1 6.75-6.73L12 6.54l1.47-1.47a4.77 4.77 0 1 1 6.75 6.73L12 19.35Z" fill="currentColor"/>',
    ability: '<path d="M9 5.5h6a2.5 2.5 0 0 1 2.5 2.5v.5H21v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-8h3.5V8A2.5 2.5 0 0 1 9 5.5Zm0 2a.5.5 0 0 0-.5.5v.5h7V8a.5.5 0 0 0-.5-.5H9Z" fill="currentColor"/>',
    chart: '<path d="M5 18.5h14a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1v-15a1 1 0 1 1 2 0v14Zm3.5-3.25a1 1 0 0 1-1-1v-3.5a1 1 0 1 1 2 0v3.5a1 1 0 0 1-1 1Zm4-5a1 1 0 0 1-1-1v-5a1 1 0 1 1 2 0v5a1 1 0 0 1-1 1Zm4 3a1 1 0 0 1-1-1V7.75a1 1 0 1 1 2 0v4.5a1 1 0 0 1-1 1Z" fill="currentColor"/>',
  };

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      ${icons[name] || icons.home}
    </svg>
  `;
}

function renderGuestNav() {
  const slot = document.querySelector("[data-social-nav]");
  const homeUrl = escapeHtml(new URL(document.body.dataset.linkHome || "../", window.location.href).toString());
  const signinUrl = escapeHtml(new URL(document.body.dataset.linkSignin || "../signin/", window.location.href).toString());

  slot.innerHTML = `
    <div class="social-topbar">
      <div class="social-topbar-left">
        <div class="social-brand">
          <a class="social-brand-logo-link" href="${homeUrl}" aria-label="스텔라 ID 홈">
            <span class="social-brand-logo"><img src="/src/img/bi/symbol-stellarid.png" alt="" /></span>
          </a>
          <span class="social-brand-copy">
            <a class="social-brand-name social-brand-home-link" href="${homeUrl}">스텔라 프로필</a>
            <span class="social-brand-meta">
              <span class="social-brand-id">/PROFILE</span>
              <span class="social-brand-label">STELLAR-ID</span>
            </span>
          </span>
        </div>
      </div>
      <div class="social-topbar-right">
        <a class="text-link-button" href="${signinUrl}">로그인</a>
      </div>
    </div>
  `;
}

function renderAvatar(profile) {
  if (profile.profile_image_url) {
    return `<img src="${escapeHtml(profile.profile_image_url)}" alt="" />`;
  }

  return `<span>${escapeHtml(String(profile.full_name || "스").charAt(0))}</span>`;
}

function buildCompatibilityEntries(targetSnapshot, mode = "personality", inverse = false) {
  const targetElement = getDayPillarElement(targetSnapshot?.dayPillar?.key || "");
  const entries = getAllDayPillarEntries()
    .map((entry) => {
      let score = 50;

      if (entry.element === targetElement) score += 18;
      if (!inverse && (targetElement === "목" && entry.element === "화" || targetElement === "화" && entry.element === "토" || targetElement === "토" && entry.element === "금" || targetElement === "금" && entry.element === "수" || targetElement === "수" && entry.element === "목")) score += 14;
      if (inverse && (targetElement === "목" && entry.element === "금" || targetElement === "화" && entry.element === "수" || targetElement === "토" && entry.element === "목" || targetElement === "금" && entry.element === "화" || targetElement === "수" && entry.element === "토")) score += 14;
      if (mode === "love" && entry.element === targetElement) score += 4;

      return {
        ...entry,
        score,
      };
    })
    .filter((entry) => entry.key !== targetSnapshot?.dayPillar?.key)
    .sort((a, b) => inverse ? a.score - b.score || a.key.localeCompare(b.key) : b.score - a.score || a.key.localeCompare(b.key));

  return entries.slice(0, 4);
}

function renderMiniList(items) {
  return `
    <div class="profile-mini-list">
      ${items.map((item) => `
        <article class="box profile-mini-card">
          <div class="title">${escapeHtml(item.key)}</div>
          <div class="text">${escapeHtml(item.metaphor || item.essence || "")}</div>
        </article>
      `).join("")}
    </div>
  `;
}

function buildGraph(series, label) {
  const max = 100;

  return `
    <div class="profile-graph" aria-label="${escapeHtml(label)}">
      <div class="profile-graph-bars">
        ${series.map((point) => `
          <div class="profile-graph-bar-wrap ${point.isCurrent ? "is-current" : ""}">
            <div class="profile-graph-bar" style="height:${Math.max(12, point.score / max * 100)}%"></div>
            ${point.isCurrent ? `<span class="profile-graph-bubble">${point.score}점</span>` : ""}
          </div>
        `).join("")}
      </div>
      <div class="profile-graph-labels">
        <span>1년 전</span>
        <span>현재</span>
        <span>1년 후</span>
      </div>
    </div>
  `;
}

function buildLockCard(label) {
  return `
    <section class="box profile-lock-card">
      <div class="title">${escapeHtml(label)} 탭은 아직 잠겨 있어요</div>
      <div class="text">이 정보는 전체 공개가 아니어서, 팔로우 후 공개되거나 비공개로 설정되어 있습니다.</div>
    </section>
  `;
}

function buildHomeTab(profile, snapshot, visibility) {
  const cards = [];

  if (visibility.personality) {
    cards.push({
      title: "성격 요약",
      text: getSnapshotSection(snapshot, 0) || profile.preview_summary,
    });
  }

  if (visibility.love) {
    cards.push({
      title: "연애 요약",
      text: getSnapshotSection(snapshot, 2),
    });
  }

  if (visibility.ability) {
    cards.push({
      title: "능력 요약",
      text: getSnapshotSection(snapshot, 1) || snapshot?.advanced?.wealth?.summary || "",
    });
  }

  if (visibility.health) {
    cards.push({
      title: "건강 요약",
      text: getSnapshotSection(snapshot, 4),
    });
  }

  if (visibility.majorLuck) {
    cards.push({
      title: "대세운 요약",
      text: snapshot?.advanced?.majorLuck?.summary || "",
    });
  }

  return `
    <section class="card">
      <div class="section-intro">
        <h2>빠른 홈</h2>
        <p class="muted">공개된 탭만 빠르게 훑을 수 있게 요약했습니다.</p>
      </div>
      <div class="profile-summary-stack">
        ${cards.map((card) => `
          <article class="box profile-summary-card">
            <div class="title">${escapeHtml(card.title)}</div>
            <div class="text">${escapeHtml(card.text || "아직 준비 중입니다.")}</div>
          </article>
        `).join("") || `<div class="box"><div class="text">공개된 요약 정보가 아직 없습니다.</div></div>`}
      </div>
    </section>
  `;
}

function buildPersonalityTab(profile, snapshot, viewerSnapshot, isSelf) {
  const score = getRelationshipScore(viewerSnapshot, snapshot, "personality");
  const todayScore = getTodayScore(snapshot, "personality");
  const bestMatches = buildCompatibilityEntries(snapshot, "personality", false);
  const worstMatches = buildCompatibilityEntries(snapshot, "personality", true);

  return `
    <section class="card">
      <div class="section-intro">
        <h2>성격</h2>
        <p class="muted">타고난 성향과 오늘의 흐름, 잘 맞는 결을 함께 봅니다.</p>
      </div>
      ${!isSelf && viewerSnapshot ? `
        <div class="box profile-highlight-box">
          <div class="title">${escapeHtml(profile.full_name)}님과 성격이 ${escapeHtml(getRelationshipLabel(score))}</div>
          <div class="text">두 사람의 일주 오행 결을 기준으로 너무 단정적이지 않게 5단계 톤으로 정리했습니다.</div>
        </div>
      ` : ""}
      <div class="profile-stat-grid">
        <article class="box profile-stat-card">
          <div class="title">오늘 성격 점수</div>
          <div class="profile-score-value">${todayScore}</div>
        </article>
        <article class="box profile-stat-card">
          <div class="title">성격 요약</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 0) || profile.preview_summary)}</div>
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">장점</div>
          <div class="text">${escapeHtml(snapshot?.advanced?.diagnosis?.summary || getSnapshotSection(snapshot, 3) || "")}</div>
        </article>
        <article class="box">
          <div class="title">보완하면 좋은 점</div>
          <div class="text">${escapeHtml(snapshot?.advanced?.diagnosis?.note || "감정과 속도를 혼자 다 떠안지 않도록, 관계 속 경계를 부드럽게 세우는 연습이 도움이 됩니다.")}</div>
        </article>
      </div>
      <section class="profile-rank-section">
        <div class="section-intro">
          <h3>잘 맞는 일주</h3>
          <p class="muted">성격 결이 편안하게 이어질 가능성이 큰 순으로 최대 4개를 보여줍니다.</p>
        </div>
        ${renderMiniList(bestMatches)}
      </section>
      <section class="profile-rank-section">
        <div class="section-intro">
          <h3>부딪히기 쉬운 일주</h3>
          <p class="muted">속도와 기준이 달라 오해가 생기기 쉬운 조합을 최대 4개로 정리했습니다.</p>
        </div>
        ${renderMiniList(worstMatches)}
      </section>
    </section>
  `;
}

function buildHealthTab(snapshot) {
  const series = buildFlowSeries(snapshot, "health");
  const todayScore = getTodayScore(snapshot, "health");

  return `
    <section class="card">
      <div class="section-intro">
        <h2>건강</h2>
        <p class="muted">지난 1년부터 다음 1년까지를 한 화면에서 가볍게 읽을 수 있는 흐름입니다.</p>
      </div>
      ${buildGraph(series, "건강운 흐름 그래프")}
      <div class="profile-stat-grid">
        <article class="box profile-stat-card">
          <div class="title">현재 건강 점수</div>
          <div class="profile-score-value">${todayScore}</div>
        </article>
        <article class="box profile-stat-card">
          <div class="title">올해 좋은 점</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 4) || "생활 리듬만 크게 흔들리지 않으면 회복력이 비교적 안정적으로 유지되는 편입니다.")}</div>
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">건강 요약</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 4) || "")}</div>
        </article>
        <article class="box">
          <div class="title">주의할 점</div>
          <div class="text">${escapeHtml(snapshot?.advanced?.yearLuck?.items?.[0]?.cautions?.join(" · ") || "무리한 일정 누적과 수면 리듬 붕괴는 먼저 관리하는 편이 좋습니다.")}</div>
        </article>
      </div>
    </section>
  `;
}

function buildLoveTab(profile, snapshot, viewerSnapshot, isSelf) {
  const score = getRelationshipScore(viewerSnapshot, snapshot, "love");
  const series = buildFlowSeries(snapshot, "love");
  const bestMatches = buildCompatibilityEntries(snapshot, "love", false);
  const worstMatches = buildCompatibilityEntries(snapshot, "love", true);

  return `
    <section class="card">
      <div class="section-intro">
        <h2>연애</h2>
        <p class="muted">연애 성향과 연애운 흐름을 함께 요약합니다.</p>
      </div>
      ${!isSelf && viewerSnapshot ? `
        <div class="box profile-highlight-box">
          <div class="title">${escapeHtml(profile.full_name)}님과 연애운이 ${escapeHtml(getRelationshipLabel(score))}</div>
          <div class="text">관계성 표현은 일주 결을 바탕으로 부드럽게 해석한 5단계 기준입니다.</div>
        </div>
      ` : ""}
      ${buildGraph(series, "연애운 흐름 그래프")}
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">연애 성격 요약</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 2) || "신뢰와 감정 표현의 균형이 관계의 핵심 키워드가 됩니다.")}</div>
        </article>
        <article class="box">
          <div class="title">연애 성격 상세</div>
          <div class="text">${escapeHtml(snapshot?.advanced?.diagnosis?.summary || getSnapshotSection(snapshot, 3) || "")}</div>
        </article>
      </div>
      <section class="profile-rank-section">
        <div class="section-intro">
          <h3>이성적으로 잘 맞는 일주</h3>
          <p class="muted">온도감과 호흡이 자연스럽게 이어지기 쉬운 순입니다.</p>
        </div>
        ${renderMiniList(bestMatches)}
      </section>
      <section class="profile-rank-section">
        <div class="section-intro">
          <h3>이성적으로 조율이 필요한 일주</h3>
          <p class="muted">서로의 속도 차이가 커서 설명이 더 필요한 조합입니다.</p>
        </div>
        ${renderMiniList(worstMatches)}
      </section>
    </section>
  `;
}

function buildAbilityTab(snapshot) {
  const series = buildFlowSeries(snapshot, "ability");

  return `
    <section class="card">
      <div class="section-intro">
        <h2>능력</h2>
        <p class="muted">커리어, 재물 흐름, 잘 맞는 환경을 함께 정리했습니다.</p>
      </div>
      ${buildGraph(series, "재물운 흐름 그래프")}
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">능력운 요약</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 1) || snapshot?.advanced?.wealth?.summary || "")}</div>
        </article>
        <article class="box">
          <div class="title">잘 맞는 환경과 직무</div>
          <div class="text">${escapeHtml(snapshot?.advanced?.wealth?.cards?.[1]?.text || "기획, 분석, 정리, 실행이 분명한 환경에서 장점이 드러납니다.")}</div>
        </article>
        <article class="box">
          <div class="title">스트레스 받을 환경과 직무</div>
          <div class="text">${escapeHtml(snapshot?.advanced?.yearLuck?.items?.[0]?.cautions?.join(" · ") || "속도는 빠른데 기준이 모호하고 역할이 계속 바뀌는 환경은 피로가 커질 수 있습니다.")}</div>
        </article>
      </div>
    </section>
  `;
}

function renderLuckList(items, type) {
  return `
    <div class="profile-luck-list">
      ${items.map((item) => `
        <article class="box profile-luck-card ${item.isCurrent ? "is-current" : ""}">
          <div class="profile-luck-head">
            <div class="title">${escapeHtml(type === "major" ? `${item.index}대운 ${item.pillarString}` : `${item.year}년 ${item.pillarString}`)}</div>
            <span class="luck-pill ${item.isCurrent ? "is-active" : ""}">${escapeHtml(item.focus || "흐름")}</span>
          </div>
          <div class="text">${escapeHtml(item.background || "")}</div>
          <div class="mini-note">${escapeHtml(item.result || item.note || "")}</div>
        </article>
      `).join("")}
    </div>
  `;
}

function buildMajorLuckTab(snapshot) {
  return `
    <section class="card">
      <div class="section-intro">
        <h2>대세운</h2>
        <p class="muted">대운과 세운을 지금 보기 쉽게 다시 정리했습니다.</p>
      </div>
      <section class="profile-rank-section">
        <div class="section-intro">
          <h3>대운</h3>
          <p class="muted">${escapeHtml(snapshot?.advanced?.majorLuck?.summary || "")}</p>
        </div>
        ${renderLuckList(snapshot?.advanced?.majorLuck?.items || [], "major")}
      </section>
      <section class="profile-rank-section">
        <div class="section-intro">
          <h3>세운</h3>
          <p class="muted">${escapeHtml(snapshot?.advanced?.yearLuck?.summary || "")}</p>
        </div>
        ${renderLuckList(snapshot?.advanced?.yearLuck?.items?.slice(0, 6) || [], "year")}
      </section>
    </section>
  `;
}

function renderTabs(activeTab) {
  $("profileTabs").innerHTML = TABS.map((tab) => `
    <button class="profile-tab-button ${tab.key === activeTab ? "is-active" : ""}" type="button" role="tab" aria-selected="${tab.key === activeTab}" data-tab-key="${tab.key}">
      ${getTabIcon(tab.icon)}
      <span>${escapeHtml(tab.label)}</span>
    </button>
  `).join("");
}

function getVisibilityMap(profile, relationship) {
  return {
    personality: canViewProfileSection(profile.personality_visibility, relationship),
    health: canViewProfileSection(profile.health_visibility, relationship),
    love: canViewProfileSection(profile.love_visibility, relationship),
    ability: canViewProfileSection(profile.ability_visibility, relationship),
    majorLuck: canViewProfileSection(profile.major_luck_visibility, relationship),
  };
}

function renderHero(profile, meta, relationship) {
  const locationText = formatRegionDisplay(profile.region_country, profile.region_name);
  const isSelf = relationship.isSelf;

  $("profileHeroInner").innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar profile-avatar-large">
        ${renderAvatar(profile)}
      </div>
      <div class="profile-hero-copy">
        <div class="profile-id-caption">STELLAR ID ${escapeHtml(String(profile.stellar_id))}</div>
        <h1 id="profileNameHeading">${escapeHtml(profile.full_name)}</h1>
        <div class="profile-tag-row">
          <span class="impact-chip impact-chip-neutral">${escapeHtml(formatGenderLabel(profile.gender))}</span>
          <span class="impact-chip impact-chip-good">${escapeHtml(meta.dayPillarKey)} 일주</span>
        </div>
        <div class="profile-follow-stats">
          <span>팔로워 ${profile.follower_count}</span>
          <span>팔로잉 ${profile.following_count}</span>
        </div>
        ${locationText ? `<div class="profile-location">${escapeHtml(locationText)}</div>` : ""}
        ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ""}
      </div>
      <div class="profile-cta-row ${isSelf ? "is-self" : ""}">
        <button id="profileShareButton" class="button-muted" type="button">프로필 공유</button>
        ${isSelf
          ? `<a id="profileSettingsButton" class="cta-link-button" href="${escapeHtml(buildProfileSettingsUrl())}">프로필 설정</a>`
          : `<button id="profileFollowButton" type="button">${relationship.isFollowing ? "팔로우 취소" : "데이터 팔로우"}</button>`
        }
      </div>
    </div>
  `;
}

function renderProfileContent(profile, snapshot, viewerSnapshot, relationship, activeTab) {
  const visibility = getVisibilityMap(profile, relationship);
  const sections = {
    home: buildHomeTab(profile, snapshot, visibility),
    personality: visibility.personality ? buildPersonalityTab(profile, snapshot, viewerSnapshot, relationship.isSelf) : buildLockCard("성격"),
    health: visibility.health ? buildHealthTab(snapshot) : buildLockCard("건강"),
    love: visibility.love ? buildLoveTab(profile, snapshot, viewerSnapshot, relationship.isSelf) : buildLockCard("연애"),
    ability: visibility.ability ? buildAbilityTab(snapshot) : buildLockCard("능력"),
    majorLuck: visibility.majorLuck ? buildMajorLuckTab(snapshot) : buildLockCard("대세운"),
  };

  $("profileContent").innerHTML = sections[activeTab];
}

async function init() {
  initCommonPageTracking();
  trackEvent("public_profile_view", {
    page_name: "public_profile",
  });

  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 연결이 아직 설정되지 않았습니다.");
  }

  const stellarId = getRequestedStellarId();
  if (!stellarId) {
    throw new Error("유효한 스텔라 등록번호가 없습니다.");
  }

  const [session, publicProfile] = await Promise.all([
    getSession(),
    fetchPublicProfileByStellarId(stellarId),
  ]);

  if (!publicProfile) {
    throw new Error("해당 스텔라 프로필을 찾지 못했습니다.");
  }

  let viewerProfile = null;
  if (session) {
    viewerProfile = await fetchProfile(session.user.id);
    renderSocialNav(document.querySelector("[data-social-nav]"), {
      session,
      viewerProfile,
      currentStellarId: publicProfile.stellar_id,
      pageTitle: "스텔라 프로필",
    });
  } else {
    renderGuestNav();
  }

  const meta = getPublicProfileMeta(publicProfile);
  const relationship = {
    isSelf: Boolean(publicProfile.is_self),
    isFollowing: Boolean(publicProfile.is_following),
  };
  const fallbackOwnSnapshot = relationship.isSelf && viewerProfile
    ? buildProfileDerivedFieldsFromInput({
      birthYear: viewerProfile.birth_year,
      birthMonth: viewerProfile.birth_month,
      birthDay: viewerProfile.birth_day,
      birthHour: viewerProfile.birth_hour,
      birthMinute: viewerProfile.birth_minute,
      birthTimeKnown: viewerProfile.birth_time_known,
      calendarType: viewerProfile.calendar_type,
      isLeapMonth: viewerProfile.is_leap_month,
      gender: viewerProfile.gender,
    }).snapshot
    : null;
  const snapshot = meta.snapshot || fallbackOwnSnapshot;

  document.title = `${publicProfile.full_name} / ${publicProfile.stellar_id} | 스텔라 ID`;
  applyPrettyProfilePath(publicProfile.stellar_id);

  $("profileLoading").classList.add("hidden");
  $("profileHero").classList.remove("hidden");
  $("profileTabsSection").classList.remove("hidden");
  $("profileContent").classList.remove("hidden");

  const currentViewerSnapshot = viewerProfile?.public_snapshot || null;
  renderHero(publicProfile, meta, relationship);

  let activeTab = "home";
  renderTabs(activeTab);
  renderProfileContent(publicProfile, snapshot, currentViewerSnapshot, relationship, activeTab);

  $("profileTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab-key]");
    if (!button) return;
    activeTab = button.dataset.tabKey;
    renderTabs(activeTab);
    renderProfileContent(publicProfile, snapshot, currentViewerSnapshot, relationship, activeTab);
  });

  $("profileShareButton")?.addEventListener("click", async () => {
    try {
      await shareLink({
        title: `${publicProfile.full_name} · ${publicProfile.stellar_id}`,
        text: `${publicProfile.full_name}님의 스텔라 프로필을 공유합니다.`,
        url: buildPublicProfileUrl(publicProfile.stellar_id, { absolute: true }),
      });
    } catch (error) {
      window.alert(error.message || "프로필 공유에 실패했습니다.");
    }
  });

  $("profileFollowButton")?.addEventListener("click", async () => {
    if (!session) {
      window.location.href = new URL(document.body.dataset.linkSignin || "../signin/", window.location.href).toString();
      return;
    }

    try {
      if (relationship.isFollowing) {
        await unfollowProfile(publicProfile.profile_id);
      } else {
        await followProfile(publicProfile.profile_id);
      }

      window.location.reload();
    } catch (error) {
      window.alert(error.message || "팔로우 상태를 바꾸지 못했습니다.");
    }
  });
}

init().catch((error) => {
  $("profileLoading").classList.add("hidden");
  $("profilePageError").classList.remove("hidden");
  $("profilePageError").textContent = error.message || "스텔라 프로필을 불러오지 못했습니다.";
});
