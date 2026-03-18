import { getAllDayPillarEntries, getDayPillarElement } from "../data/daypillars.js";
import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  AUTH_STATE_STATUS,
  fetchOwnFollowCounts,
  fetchProfile,
  fetchPublicProfileByStellarId,
  followProfile,
  subscribeAuthSnapshot,
  isSupabaseConfigured,
  refreshPublicProfileByStellarId,
  unfollowProfile,
  waitForAuthBootstrap,
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
import { formatGenderLabel, hasKnownBirthTime } from "./shared/birth.js";
import { escapeHtml, escapeHtmlWithBreaks } from "./shared/html.js";
import { getKstDateParts, needsPublicProfileRefresh } from "./shared/profile-insights.js";
import { applyProfileSeoToDocument, buildProfileSeoData, getProfileSeoSections } from "./shared/profile-seo.js";
import { normalizeProfileBio } from "./shared/profile-text.js";
import { renderPillarsTableCard } from "./shared/reading-renderer.js";
import { renderSocialNav } from "./shared/social-nav.js";
import { showToast } from "./shared/ui.js";
import {
  applyPrettyProfilePath,
  buildProfileSettingsUrl,
  buildPublicProfileUrl,
  buildStaticPublicProfileUrl,
  getRequestedStellarId,
  resolveOwnStellarId,
} from "./shared/stellar-id.js";
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
  return renderSocialNav(document.querySelector("[data-social-nav]"), {
    authStatus: AUTH_STATE_STATUS.UNAUTHENTICATED,
    session: null,
    viewerProfile: null,
    pageTitle: "스텔라 프로필",
    currentStellarId: getRequestedStellarId(),
    showProfileIdentity: true,
  });
}

function buildViewerProfileStub(session) {
  if (!session?.user) return null;

  return {
    id: session.user.id,
    full_name: session.user.user_metadata?.full_name || session.user.email || "회원",
    profile_image_url: session.user.user_metadata?.profile_image_url || "",
    stellar_id: resolveOwnStellarId(session, null),
  };
}

function buildSelfProfileViewModel(profile, session) {
  const source = profile || buildViewerProfileStub(session);
  if (!source) return null;

  const fallbackSnapshot = source?.public_snapshot && !needsPublicProfileRefresh(source.public_snapshot)
    ? source.public_snapshot
    : buildLocalSnapshotFromProfile(source);
  const fallbackStellarId = resolveOwnStellarId(session, source);

  return {
    profile_id: source.id || session?.user?.id || null,
    stellar_id: String(source.stellar_id || fallbackStellarId || ""),
    full_name: source.full_name || session?.user?.user_metadata?.full_name || session?.user?.email || "회원",
    gender: source.gender || session?.user?.user_metadata?.gender || "male",
    profile_image_url: source.profile_image_url || session?.user?.user_metadata?.profile_image_url || "",
    mbti: source.mbti || "",
    region_country: source.region_country || "",
    region_name: source.region_name || "",
    bio: source.bio || "",
    day_pillar_key: source.day_pillar_key || fallbackSnapshot?.dayPillar?.key || "",
    day_pillar_hanja: source.day_pillar_hanja || fallbackSnapshot?.dayPillar?.hanja || "",
    day_pillar_metaphor: source.day_pillar_metaphor || fallbackSnapshot?.dayPillar?.metaphor || "",
    element_class: source.element_class || fallbackSnapshot?.dayPillar?.elementClass || "unknown",
    preview_summary: source.preview_summary || "",
    public_snapshot: fallbackSnapshot || null,
    personality_visibility: source.personality_visibility || "public",
    health_visibility: source.health_visibility || "public",
    love_visibility: source.love_visibility || "public",
    ability_visibility: source.ability_visibility || "public",
    major_luck_visibility: source.major_luck_visibility || "public",
    follower_count: Number(source.follower_count || 0),
    following_count: Number(source.following_count || 0),
    is_following: false,
    is_self: true,
  };
}

function applySelfFollowCounts(profile, counts) {
  if (!profile) return profile;

  return {
    ...profile,
    follower_count: Number(counts?.followerCount ?? profile.follower_count ?? 0),
    following_count: Number(counts?.followingCount ?? profile.following_count ?? 0),
  };
}

function renderProfileNav({
  authStatus = AUTH_STATE_STATUS.UNAUTHENTICATED,
  session = null,
  viewerProfile = null,
  currentStellarId = null,
} = {}) {
  if (!session && authStatus === AUTH_STATE_STATUS.UNAUTHENTICATED) {
    return renderGuestNav();
  }

  return renderSocialNav(document.querySelector("[data-social-nav]"), {
    authStatus,
    session,
    viewerProfile: viewerProfile || buildViewerProfileStub(session),
    currentStellarId: currentStellarId || getRequestedStellarId(),
    pageTitle: "스텔라 프로필",
    showProfileIdentity: true,
  });
}

async function sharePublicProfile(profile) {
  const { shareLink } = await import("./shared/share.js");
  return shareLink({
    title: `${profile.full_name} · ${profile.stellar_id}`,
    text: `${profile.full_name}님의 스텔라 프로필을 공유합니다.`,
    url: buildStaticPublicProfileUrl(profile.stellar_id, { absolute: true }),
  });
}

function renderSeoFallback(profile, meta) {
  const seo = buildProfileSeoData(profile);
  const sections = getProfileSeoSections(profile);
  const locationText = formatRegionDisplay(profile.region_country, profile.region_name);

  $("profileSeoFallback").innerHTML = `
    <p class="eyebrow">스텔라 프로필</p>
    <h1>${escapeHtml(seo.pageTitle)}</h1>
    <p class="hero-subtitle">${escapeHtml(seo.metaDescription)}</p>
    <div class="profile-tag-row">
      <span class="impact-chip impact-chip-neutral">${escapeHtml(formatGenderLabel(profile.gender))}</span>
      <span class="impact-chip impact-chip-good">${escapeHtml(meta.dayPillarKey)} 일주</span>
      ${profile.mbti ? `<span class="impact-chip impact-chip-neutral">${escapeHtml(profile.mbti)}</span>` : ""}
    </div>
    ${locationText ? `<p class="muted">${escapeHtml(locationText)}</p>` : ""}
    ${sections.length
      ? `
        <div class="profile-summary-stack">
          ${sections.map((section) => `
            <article class="box profile-summary-card">
              <div class="title">${escapeHtml(section.title)}</div>
              <div class="text">${escapeHtml(section.text)}</div>
            </article>
          `).join("")}
        </div>
      `
      : ""
    }
  `;
  $("profileSeoFallback").classList.remove("hidden");
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
  const min = 20;
  const max = 96;
  const points = series.map((point, index) => {
    const x = series.length <= 1 ? 50 : (index / (series.length - 1)) * 100;
    const normalized = (point.score - min) / (max - min);
    const y = 88 - (Math.max(0, Math.min(1, normalized)) * 72);

    return {
      ...point,
      x,
      y,
    };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const fillPoints = `0,92 ${linePoints} 100,92`;
  const currentPoint = points.find((point) => point.isCurrent) || points[Math.floor(points.length / 2)];
  const now = new Date();
  const currentLabel = `현재 (${now.getFullYear()}. ${now.getMonth() + 1}월)`;

  return `
    <div class="profile-graph" aria-label="${escapeHtml(label)}">
      <div class="profile-graph-canvas">
        <svg class="profile-graph-svg" viewBox="0 0 100 92" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="92" x2="100" y2="92" class="profile-graph-baseline" />
          <polygon points="${fillPoints}" class="profile-graph-area" />
          <polyline points="${linePoints}" class="profile-graph-line" />
        </svg>
        <span class="profile-graph-bubble" style="left:${currentPoint.x}%; bottom:calc(${((92 - currentPoint.y) / 92) * 100}% + 8px);">${currentPoint.score}점</span>
        <span class="profile-graph-point" style="left:${currentPoint.x}%; bottom:${((92 - currentPoint.y) / 92) * 100}%;" aria-hidden="true"></span>
      </div>
      <div class="profile-graph-labels">
        <span>1년 전</span>
        <span>${escapeHtml(currentLabel)}</span>
        <span>1년 후</span>
      </div>
    </div>
  `;
}

function buildSignalChips(items, tone = "good") {
  const chipClass = tone === "warn" ? "impact-chip impact-chip-warn" : "impact-chip impact-chip-good";

  return items.map((item) => `
    <span class="${chipClass}">${escapeHtml(item)}</span>
  `).join("");
}

function buildSignalBlock(title, items, tone = "good") {
  if (!items?.length) return "";

  return `
    <div class="profile-signal-block">
      <div class="profile-signal-title">${escapeHtml(title)}</div>
      <div class="impact-pills">
        ${buildSignalChips(items, tone)}
      </div>
    </div>
  `;
}

function getCurrentYearLuck(snapshot) {
  return snapshot?.advanced?.yearLuck?.items?.find((item) => item.isCurrent) || snapshot?.advanced?.yearLuck?.items?.[0] || null;
}

function joinLuckTerms(items, limit = 2) {
  const values = [...new Set((items || []).filter(Boolean))].slice(0, limit);
  return values.join(", ");
}

function buildCurrentLuckSummary(snapshot) {
  const currentMajor = snapshot?.advanced?.majorLuck?.current || snapshot?.advanced?.majorLuck?.items?.find((item) => item.isCurrent) || null;
  const currentYear = getCurrentYearLuck(snapshot);

  if (!currentMajor && !currentYear) {
    return snapshot?.advanced?.majorLuck?.summary || "현재 대세운 정보를 아직 불러오지 못했습니다.";
  }

  const labels = [currentMajor ? `${currentMajor.index}대운 ${currentMajor.pillarString}` : "", currentYear ? `${currentYear.year}년 ${currentYear.pillarString}` : ""].filter(Boolean);
  const boosts = joinLuckTerms([...(currentMajor?.boosts || []), ...(currentYear?.boosts || [])], 3);
  const cautions = joinLuckTerms([...(currentMajor?.cautions || []), ...(currentYear?.cautions || [])], 3);
  const alignment = joinLuckTerms([currentMajor?.alignmentText, currentYear?.alignmentText], 2);
  const focusSummary = [currentMajor?.focus ? `큰 배경은 ${currentMajor.focus}` : "", currentYear?.focus ? `올해 촉발점은 ${currentYear.focus}` : ""].filter(Boolean).join(", ");
  const resultText = currentYear?.result || currentMajor?.result || currentYear?.note || currentMajor?.note || "";
  const parts = [
    `현재는 ${labels.length > 1 ? `${labels[0]}과 ${labels[1]}` : labels[0]} 흐름이 중심이 되는 시기입니다.`,
  ];

  if (focusSummary) {
    parts.push(`${focusSummary} 쪽으로 읽힙니다.`);
  }

  if (alignment) {
    parts.push(`기운 밸런스는 ${alignment} 쪽으로 읽힙니다.`);
  }

  if (boosts || cautions) {
    const signalParts = [];

    if (boosts) {
      signalParts.push(`도움이 되는 기운은 ${boosts}`);
    }

    if (cautions) {
      signalParts.push(`주의할 기운은 ${cautions}`);
    }

    parts.push(`${signalParts.join(", ")}입니다.`);
  } else if (resultText) {
    parts.push(resultText);
  }

  return parts.join(" ");
}

function getCollaborationLabel(score) {
  if (score == null) return "아직 비교할 수 없어요";
  if (score >= 85) return "매우 잘 맞아요";
  if (score >= 72) return "잘 맞아요";
  if (score >= 56) return "그저 그래요";
  if (score >= 40) return "별로 안 맞아요";
  return "매우 안 맞아요";
}

function buildLockCard(label) {
  return `
    <section class="box profile-lock-card">
      <div class="title">${escapeHtml(label)} 탭은 아직 잠겨 있어요</div>
      <div class="text">이 정보는 전체 공개가 아니어서, 팔로우 후 공개되거나 비공개로 설정되어 있습니다.</div>
    </section>
  `;
}

function buildLocalSnapshotFromProfile(profile) {
  if (!profile?.birth_year || !profile?.birth_month || !profile?.birth_day || !profile?.gender) {
    return null;
  }

  const { referenceDate } = getKstDateParts(new Date());

  return buildProfileDerivedFieldsFromInput({
    birthYear: profile.birth_year,
    birthMonth: profile.birth_month,
    birthDay: profile.birth_day,
    birthHour: profile.birth_hour,
    birthMinute: profile.birth_minute,
    birthTimeKnown: hasKnownBirthTime(profile),
    calendarType: profile.calendar_type,
    isLeapMonth: profile.is_leap_month,
    gender: profile.gender,
  }, {
    currentDate: referenceDate,
  }).snapshot;
}

function shouldRefreshPublicProfile(profile) {
  return !profile?.day_pillar_key
    || !profile?.preview_summary
    || !profile?.element_class
    || needsPublicProfileRefresh(profile?.public_snapshot);
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
      text: buildCurrentLuckSummary(snapshot),
    });
  }

  return `
    ${renderPillarsTableCard(snapshot?.pillars, {
      title: "4주 8자",
      className: "profile-home-pillars-card",
    })}
    <section class="card">
      <div class="section-intro">
        <h2>빠른 홈</h2>
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
  const todayScore = getTodayScore(snapshot, "personality");
  const bestMatches = buildCompatibilityEntries(snapshot, "personality", false);
  const worstMatches = buildCompatibilityEntries(snapshot, "personality", true);
  const dailyInsight = snapshot?.insights?.personalityDaily || {};
  const dailyPointTitle = `${dailyInsight.dateLabel || "오늘"} 감정 포인트`;

  return `
    <section class="card">
      <div class="section-intro">
        <h2>성격</h2>
        <p class="muted">타고난 성향과 오늘의 흐름, 잘 맞는 결을 함께 봅니다.</p>
      </div>
      <div class="profile-stat-grid">
        <article class="box profile-stat-card">
          <div class="title">오늘 성격 점수</div>
          <div class="profile-score-value">${todayScore}</div>
        </article>
        <article class="box profile-stat-card">
          <div class="title">성격 요약</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 0) || profile.preview_summary)}</div>
        </article>
        <article class="box profile-stat-card">
          <div class="title">${escapeHtml(dailyPointTitle)}</div>
          <div class="text">${escapeHtml(dailyInsight.point || "오늘 감정 흐름을 다시 읽는 중입니다.")}</div>
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">오늘 좋은 감정</div>
          <div class="text">${escapeHtml(dailyInsight.goodEmotion || "내 마음을 편하게 표현할 수 있는 포인트를 정리하고 있습니다.")}</div>
        </article>
        <article class="box">
          <div class="title">보완하면 좋은 점</div>
          <div class="text">${escapeHtml(dailyInsight.improve || snapshot?.advanced?.diagnosis?.note || "감정과 속도를 혼자 다 떠안지 않도록, 관계 속 경계를 부드럽게 세우는 연습이 도움이 됩니다.")}</div>
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">오늘 좋은 기운</div>
          ${buildSignalBlock("감정이 잘 흐르는 포인트", dailyInsight.goodSignals, "good")}
        </article>
        <article class="box">
          <div class="title">오늘 주의할 점</div>
          ${buildSignalBlock("감정적으로 조율할 포인트", dailyInsight.warnSignals, "warn")}
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
  const monthlyInsight = snapshot?.insights?.healthMonthly || {};
  const monthPointTitle = `${monthlyInsight.monthLabel || "이번 달"} 건강 포인트`;

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
          <div class="title">${escapeHtml(monthPointTitle)}</div>
          <div class="text">${escapeHtml(monthlyInsight.point || "이번 달 건강 흐름을 다시 읽는 중입니다.")}</div>
        </article>
        <article class="box profile-stat-card">
          <div class="title">이번 달 좋은 점</div>
          <div class="text">${escapeHtml(monthlyInsight.goodPoint || "생활 리듬만 크게 흔들리지 않으면 회복력이 비교적 안정적으로 유지되는 편입니다.")}</div>
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">이번 달 좋은 기운</div>
          ${buildSignalBlock("몸을 받쳐주는 흐름", monthlyInsight.goodSignals, "good")}
        </article>
        <article class="box">
          <div class="title">이번 달 주의할 점</div>
          ${buildSignalBlock("미리 챙길 포인트", monthlyInsight.warnSignals, "warn")}
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">건강 요약</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 4) || "")}</div>
        </article>
        <article class="box">
          <div class="title">주의할 점</div>
          <div class="text">${escapeHtml((monthlyInsight.warnSignals || []).join(" · ") || "무리한 일정 누적과 수면 리듬 붕괴는 먼저 관리하는 편이 좋습니다.")}</div>
        </article>
      </div>
    </section>
  `;
}

function buildLoveTab(profile, snapshot, viewerSnapshot, isSelf) {
  const series = buildFlowSeries(snapshot, "love");
  const bestMatches = buildCompatibilityEntries(snapshot, "love", false);
  const worstMatches = buildCompatibilityEntries(snapshot, "love", true);
  const loveInsight = snapshot?.insights?.loveDetail || {};
  const monthlyInsight = snapshot?.insights?.loveMonthly || {};
  const monthPointTitle = `${monthlyInsight.monthLabel || "이번 달"} 연애 포인트`;

  return `
    <section class="card">
      <div class="section-intro">
        <h2>연애</h2>
        <p class="muted">연애 성향과 연애운 흐름을 함께 요약합니다.</p>
      </div>
      ${buildGraph(series, "연애운 흐름 그래프")}
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">연애 기본 성향</div>
          <div class="text">${escapeHtml(loveInsight.summary || getSnapshotSection(snapshot, 2) || "신뢰와 감정 표현의 균형이 관계의 핵심 키워드가 됩니다.")}</div>
        </article>
        <article class="box">
          <div class="title">끌리는 포인트</div>
          <div class="text">${escapeHtml(loveInsight.attraction || "어떤 사람에게 매력을 느끼는지 읽는 중입니다.")}</div>
        </article>
        <article class="box">
          <div class="title">불편한 포인트</div>
          <div class="text">${escapeHtml(loveInsight.dislike || "관계에서 피로를 느끼기 쉬운 포인트를 정리하고 있습니다.")}</div>
        </article>
        <article class="box">
          <div class="title">가까워지는 법</div>
          <div class="text">${escapeHtml(loveInsight.strategy || "천천히 신뢰를 쌓는 방식이 잘 맞는지 살피고 있습니다.")}</div>
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">${escapeHtml(monthPointTitle)}</div>
          <div class="text">${escapeHtml(monthlyInsight.point || "이번 달 연애 흐름을 다시 읽는 중입니다.")}</div>
        </article>
        <article class="box">
          <div class="title">이번 달 설레는 포인트</div>
          ${buildSignalBlock("좋은 흐름", monthlyInsight.goodSignals, "good")}
        </article>
        <article class="box">
          <div class="title">이번 달 조심할 점</div>
          ${buildSignalBlock("조율 포인트", monthlyInsight.warnSignals, "warn")}
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

function buildAbilityTab(profile, snapshot, viewerSnapshot, isSelf) {
  const series = buildFlowSeries(snapshot, "ability");
  const todayScore = getTodayScore(snapshot, "ability");
  const wealthCards = snapshot?.advanced?.wealth?.cards || [];
  const monthlyInsight = snapshot?.insights?.abilityMonthly || {};
  const monthPointTitle = `${monthlyInsight.monthLabel || "이번 달"} 능력 포인트`;

  return `
    <section class="card">
      <div class="section-intro">
        <h2>능력</h2>
        <p class="muted">커리어, 재물 흐름, 잘 맞는 환경을 함께 정리했습니다.</p>
      </div>
      ${buildGraph(series, "능력운 흐름 그래프")}
      <div class="profile-stat-grid">
        <article class="box profile-stat-card">
          <div class="title">현재 능력 점수</div>
          <div class="profile-score-value">${todayScore}</div>
        </article>
        <article class="box profile-stat-card">
          <div class="title">${escapeHtml(monthPointTitle)}</div>
          <div class="text">${escapeHtml(monthlyInsight.point || "이번 달 능력 흐름을 다시 읽는 중입니다.")}</div>
        </article>
      </div>
      <div class="profile-detail-grid">
        <article class="box">
          <div class="title">이번 달 잘 풀리는 포인트</div>
          ${buildSignalBlock("도움이 되는 기운", monthlyInsight.goodSignals, "good")}
        </article>
        <article class="box">
          <div class="title">이번 달 경계 포인트</div>
          ${buildSignalBlock("주의할 기운", monthlyInsight.warnSignals, "warn")}
        </article>
      </div>
      <div class="profile-detail-grid">
        ${wealthCards.map((card) => `
          <article class="box">
            <div class="title">${escapeHtml(card.title)}</div>
            <div class="text">${escapeHtml(card.text)}</div>
          </article>
        `).join("")}
        <article class="box">
          <div class="title">능력운 요약</div>
          <div class="text">${escapeHtml(getSnapshotSection(snapshot, 1) || snapshot?.advanced?.wealth?.summary || "")}</div>
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
          <div class="profile-luck-head luck-head">
            <div class="title">${escapeHtml(type === "major" ? `${item.index}대운 ${item.pillarString}` : `${item.year}년 ${item.pillarString}`)}</div>
            <div class="profile-luck-pills">
              ${item.isCurrent ? `<span class="luck-pill is-active">현재</span>` : ""}
              <span class="luck-pill">${escapeHtml(item.focus || "흐름")}</span>
              ${item.alignmentText ? `<span class="luck-pill">${escapeHtml(item.alignmentText)}</span>` : ""}
            </div>
          </div>
          <div class="profile-luck-period">${escapeHtml(type === "major" ? `${item.startYear} - ${item.endYear} · 약 ${item.ageStart}세 - ${item.ageEnd}세` : `${item.focus || "흐름"} 중심 해석`)}</div>
          <div class="text">${escapeHtml(item.background || item.note || "")}</div>
          <div class="mini-note">${escapeHtml(item.result || item.note || "")}</div>
          ${buildSignalBlock("좋은 기운", item.boosts || [], "good")}
          ${buildSignalBlock("주의 기운", item.cautions || [], "warn")}
          ${item.interactionNote ? `<div class="profile-luck-note">${escapeHtml(item.interactionNote)}</div>` : ""}
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
        ${renderLuckList(snapshot?.advanced?.yearLuck?.items || [], "year")}
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
  const normalizedBio = normalizeProfileBio(profile.bio || "");

  $("profileHeroInner").innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar profile-avatar-large">
        ${renderAvatar(profile)}
      </div>
      <div class="profile-hero-copy">
        <div class="profile-id-caption">#${escapeHtml(String(profile.stellar_id))}</div>
        <h1 id="profileNameHeading">${escapeHtml(profile.full_name)}</h1>
        <div class="profile-tag-row">
          <span class="impact-chip impact-chip-neutral">${escapeHtml(formatGenderLabel(profile.gender))}</span>
          <span class="impact-chip impact-chip-good">${escapeHtml(meta.dayPillarKey)} 일주</span>
          ${profile.mbti ? `<span class="impact-chip impact-chip-neutral">${escapeHtml(profile.mbti)}</span>` : ""}
        </div>
        <div class="profile-follow-stats">
          <span>팔로워 ${profile.follower_count}</span>
          <span>팔로잉 ${profile.following_count}</span>
        </div>
        ${locationText ? `<div class="profile-location">${escapeHtml(locationText)}</div>` : ""}
        ${normalizedBio ? `<p class="profile-bio">${escapeHtmlWithBreaks(normalizedBio)}</p>` : ""}
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
    ability: visibility.ability ? buildAbilityTab(profile, snapshot, viewerSnapshot, relationship.isSelf) : buildLockCard("능력"),
    majorLuck: visibility.majorLuck ? buildMajorLuckTab(snapshot) : buildLockCard("대세운"),
  };

  $("profileContent").innerHTML = sections[activeTab];
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchPublicProfileWithRetry(stellarId, {
  attempts = 4,
  delayMs = 350,
} = {}) {
  let profile = null;

  for (let index = 0; index < attempts; index += 1) {
    profile = await fetchPublicProfileByStellarId(stellarId);
    if (profile) {
      return profile;
    }

    if (index < attempts - 1) {
      await wait(delayMs);
    }
  }

  return profile;
}

function buildProfileRelationship(publicProfile, session, viewerProfile) {
  const ownStellarId = resolveOwnStellarId(session, viewerProfile);
  const ownProfileId = viewerProfile?.id || session?.user?.id || null;
  const isSelf = Boolean(
    publicProfile?.is_self
    || (ownProfileId && publicProfile?.profile_id === ownProfileId)
    || (ownStellarId && String(publicProfile?.stellar_id || "") === String(ownStellarId))
  );

  return {
    isSelf,
    isFollowing: !isSelf && Boolean(publicProfile?.is_following),
  };
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

  const initialAuthSnapshot = await waitForAuthBootstrap();
  let authStatus = initialAuthSnapshot.status || AUTH_STATE_STATUS.UNKNOWN;
  let session = initialAuthSnapshot.session || null;
  let viewerProfile = null;
  let currentPublicProfile = null;
  let isSelfProfileMode = false;
  let activeNavCleanup = null;
  let lastNavSignature = "";

  const buildNavSignature = () => ([
    String(authStatus || ""),
    String(session?.user?.id || ""),
    String(viewerProfile?.id || ""),
    String(viewerProfile?.stellar_id || ""),
    String(viewerProfile?.full_name || ""),
    String(viewerProfile?.profile_image_url || ""),
    String(currentPublicProfile?.stellar_id || stellarId || ""),
  ].join("|"));

  const syncNav = () => {
    const nextSignature = buildNavSignature();
    if (nextSignature === lastNavSignature) {
      return;
    }

    activeNavCleanup?.();
    activeNavCleanup = renderProfileNav({
      authStatus,
      session,
      viewerProfile,
      currentStellarId: currentPublicProfile?.stellar_id || stellarId,
    });
    lastNavSignature = nextSignature;
  };

  const unsubscribeAuth = subscribeAuthSnapshot((snapshot) => {
    authStatus = snapshot.status || AUTH_STATE_STATUS.UNKNOWN;
    session = snapshot.session || null;
    syncNav();
  });

  const cleanupProfileNav = () => {
    unsubscribeAuth();
    activeNavCleanup?.();
    activeNavCleanup = null;
    lastNavSignature = "";
  };

  window.addEventListener("beforeunload", cleanupProfileNav, { once: true });
  window.addEventListener("pagehide", cleanupProfileNav, { once: true });
  syncNav();

  const viewerProfilePromise = session
    ? fetchProfile(session.user.id, {
      allowRepair: false,
      allowSessionFallback: true,
    }).catch((error) => {
      console.warn("viewer profile hydration failed", error);
      return null;
    })
    : Promise.resolve(null);

  viewerProfile = await viewerProfilePromise;
  const requestedOwnStellarId = resolveOwnStellarId(session, viewerProfile);
  isSelfProfileMode = Boolean(session && requestedOwnStellarId && String(requestedOwnStellarId) === String(stellarId));

  let initialPublicProfile = null;
  if (isSelfProfileMode) {
    initialPublicProfile = buildSelfProfileViewModel(viewerProfile, session);
    const ownFollowCounts = await fetchOwnFollowCounts(session?.user?.id).catch(() => null);
    initialPublicProfile = applySelfFollowCounts(initialPublicProfile, ownFollowCounts);
  } else {
    initialPublicProfile = await fetchPublicProfileWithRetry(stellarId);
  }

  if (!initialPublicProfile) {
    throw new Error("해당 스텔라 프로필을 찾지 못했습니다.");
  }

  let publicProfile = initialPublicProfile;
  currentPublicProfile = publicProfile;
  syncNav();

  if (!isSelfProfileMode && shouldRefreshPublicProfile(publicProfile)) {
    try {
      await refreshPublicProfileByStellarId(stellarId);
      publicProfile = await fetchPublicProfileWithRetry(stellarId, {
        attempts: 2,
        delayMs: 250,
      }) || publicProfile;
    } catch (error) {
      console.warn("public profile refresh failed", error);
    }
  }

  currentPublicProfile = publicProfile;
  syncNav();

  const meta = getPublicProfileMeta(publicProfile);
  const relationship = buildProfileRelationship(publicProfile, session, viewerProfile);
  const fallbackOwnSnapshot = relationship.isSelf ? buildLocalSnapshotFromProfile(viewerProfile) : null;
  const snapshot = meta.snapshot || fallbackOwnSnapshot;

  applyPrettyProfilePath(publicProfile.stellar_id);
  applyProfileSeoToDocument(publicProfile);
  renderSeoFallback(publicProfile, meta);

  const profileSaved = new URLSearchParams(window.location.search).get("saved");
  if (profileSaved === "1") {
    showToast("프로필이 저장되었습니다.");
    const params = new URLSearchParams(window.location.search);
    params.delete("saved");
    const nextQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`);
  }

  $("profileLoading").classList.add("hidden");
  $("profileSeoFallback")?.classList.add("hidden");
  $("profileHero").classList.remove("hidden");
  $("profileTabsSection").classList.remove("hidden");
  $("profileContent").classList.remove("hidden");

  const currentViewerSnapshot = viewerProfile?.public_snapshot && !needsPublicProfileRefresh(viewerProfile.public_snapshot)
    ? viewerProfile.public_snapshot
    : buildLocalSnapshotFromProfile(viewerProfile);
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
      await sharePublicProfile(publicProfile);
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
  console.warn("public profile hydration failed", error);
  $("profileLoading").classList.add("hidden");

  const hasSeoFallback = Boolean($("profileSeoFallback")?.textContent?.trim());
  if (hasSeoFallback) {
    $("profileSeoFallback")?.classList.remove("hidden");
    $("profilePageError").classList.add("hidden");

    if (!document.querySelector("[data-social-nav]")?.textContent?.trim()) {
      try {
        renderGuestNav();
      } catch {
        // Keep the SEO fallback visible even if the nav cannot be re-rendered.
      }
    }

    return;
  }

  $("profilePageError").classList.remove("hidden");
  $("profilePageError").textContent = error.message || "스텔라 프로필을 불러오지 못했습니다.";
});
