import { getDayPillarArchetype } from "../../data/daypillars.js";
import { ELEMENT_DISPLAY, calculateReadingSnapshot, getReadingPreviewSummary } from "./reading.js";
import { buildEnrichedPublicProfileSnapshot } from "./profile-insights.js";

export const PROFILE_VISIBILITY_VALUES = ["public", "followers", "private"];

const GENERATES = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
};

const CONTROLS = {
  목: "토",
  화: "금",
  토: "수",
  금: "목",
  수: "화",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function buildPublicProfileSnapshot(snapshot, currentDate = new Date()) {
  return buildEnrichedPublicProfileSnapshot(snapshot, currentDate);
}

export function buildProfileDerivedFieldsFromInput({
  birthYear,
  birthMonth,
  birthDay,
  birthHour,
  birthMinute,
  birthTimeKnown,
  calendarType,
  isLeapMonth,
  gender,
}, { currentDate = new Date() } = {}) {
  const snapshot = calculateReadingSnapshot({
    year: Number(birthYear),
    month: Number(birthMonth),
    day: Number(birthDay),
    hour: birthTimeKnown ? Number(birthHour) : null,
    minute: birthTimeKnown ? Number(birthMinute) : null,
    isLunar: calendarType === "lunar",
    isLeapMonth: Boolean(isLeapMonth),
    gender,
    unknownTime: !birthTimeKnown,
    currentDate,
  });

  return {
    snapshot,
    fields: {
      day_pillar_key: snapshot.dayPillar.key,
      day_pillar_hanja: snapshot.dayPillar.hanja,
      day_pillar_metaphor: snapshot.dayPillar.metaphor,
      element_class: snapshot.dayPillar.elementClass,
      preview_summary: getReadingPreviewSummary(snapshot),
      public_snapshot: buildPublicProfileSnapshot(snapshot, currentDate),
    },
  };
}

export function getVisibilityLabel(value) {
  return {
    public: "전체 공개",
    followers: "팔로우 시 공개",
    private: "비공개",
  }[value] || "전체 공개";
}

export function canViewProfileSection(visibility, { isSelf = false, isFollowing = false } = {}) {
  if (isSelf) return true;
  if (visibility === "private") return false;
  if (visibility === "followers") return Boolean(isFollowing);
  return true;
}

export function getSnapshotSection(snapshot, index) {
  return snapshot?.sections?.[index]?.text || "";
}

export function getDayElement(snapshot) {
  return snapshot?.pillars?.day?.stem?.element || "";
}

export function getRelationshipScore(viewerSnapshot, targetSnapshot, mode = "personality") {
  if (!viewerSnapshot || !targetSnapshot) return null;

  const viewerElement = getDayElement(viewerSnapshot);
  const targetElement = getDayElement(targetSnapshot);

  if (!viewerElement || !targetElement) return null;

  let score = 60;

  if (viewerElement === targetElement) score += 18;
  if (GENERATES[viewerElement] === targetElement || GENERATES[targetElement] === viewerElement) score += 16;
  if (CONTROLS[viewerElement] === targetElement || CONTROLS[targetElement] === viewerElement) score -= 18;
  if (viewerSnapshot.dayPillar?.key === targetSnapshot.dayPillar?.key) score += 6;
  if (mode === "love" && viewerSnapshot.gender && targetSnapshot.gender && viewerSnapshot.gender !== targetSnapshot.gender) {
    score += 4;
  }

  return clamp(score, 18, 95);
}

export function getRelationshipLabel(score) {
  if (score == null) return "아직 비교할 수 없어요";
  if (score >= 85) return "매우 잘 맞아요";
  if (score >= 72) return "잘 맞아요";
  if (score >= 56) return "평범해요";
  if (score >= 40) return "안 맞을 수 있어요";
  return "매우 안 맞을 확률이 높아요";
}

function scoreFromLuckItem(item, variant = "personality") {
  if (!item) return 58;

  let score = 56;

  if (item.alignmentText === "용희신 도움") score += 18;
  if (item.alignmentText === "용희신·기구신 혼재") score += 8;
  if (item.alignmentText === "기구신 경계") score -= 14;

  if (item.wealthHitCount > 0 && variant === "ability") score += 10;
  if ((item.focus || "").includes("직장") && variant === "ability") score += 8;
  if ((item.focus || "").includes("학습") && variant === "personality") score += 6;
  if ((item.focus || "").includes("경쟁") && variant === "love") score -= 5;
  if ((item.cautions || []).length > 2) score -= 6;
  if ((item.boosts || []).length > 2) score += 6;

  return clamp(score, 22, 96);
}

export function buildFlowSeries(snapshot, variant = "ability") {
  const current = snapshot?.advanced?.yearLuck?.items?.[0] || null;
  const next = snapshot?.advanced?.yearLuck?.items?.[1] || null;
  const currentScore = scoreFromLuckItem(current, variant);
  const nextScore = scoreFromLuckItem(next || current, variant);
  const previousScore = clamp(currentScore - 6 + ((current?.boosts?.length || 0) - (current?.cautions?.length || 0)) * 2, 20, 95);

  return Array.from({ length: 25 }, (_, index) => {
    const offset = index - 12;
    let score;

    if (offset < 0) {
      const ratio = (offset + 12) / 12;
      score = previousScore + (currentScore - previousScore) * ratio;
    } else {
      const ratio = offset / 12;
      score = currentScore + (nextScore - currentScore) * ratio;
    }

    return {
      offset,
      label: offset === 0 ? "현재" : `${offset > 0 ? "+" : ""}${offset}개월`,
      score: Math.round(clamp(score, 20, 96)),
      isCurrent: offset === 0,
    };
  });
}

export function getTodayScore(snapshot, variant = "personality") {
  const series = buildFlowSeries(snapshot, variant);
  return series.find((item) => item.isCurrent)?.score || 58;
}

export function getPublicProfileMeta(profile) {
  const snapshot = profile?.public_snapshot || null;
  const archetype = getDayPillarArchetype(profile?.day_pillar_key || snapshot?.dayPillar?.key || "");

  return {
    snapshot,
    archetype,
    dayPillarKey: profile?.day_pillar_key || snapshot?.dayPillar?.key || "",
    dayPillarMetaphor: profile?.day_pillar_metaphor || snapshot?.dayPillar?.metaphor || archetype?.metaphor || "",
    dayPillarHanja: profile?.day_pillar_hanja || snapshot?.dayPillar?.hanja || archetype?.hanja || "",
    dayElementLabel: ELEMENT_DISPLAY[getDayElement(snapshot)] || "",
  };
}
