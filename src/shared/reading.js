import {
  calculateFourPillars,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
} from "../engine/soulscan-engine.js";
import { buildAdvancedSajuData } from "../engine/saju-advanced.js";
import { buildSajuReading } from "../engine/saju-interpretation.js";
import { getDayPillarArchetype } from "../../data/daypillars.js";

export const STEM_TO_ELEMENT = {
  "갑": "목",
  "을": "목",
  "병": "화",
  "정": "화",
  "무": "토",
  "기": "토",
  "경": "금",
  "신": "금",
  "임": "수",
  "계": "수",
};

export const BRANCH_TO_ELEMENT = {
  "자": "수",
  "축": "토",
  "인": "목",
  "묘": "목",
  "진": "토",
  "사": "화",
  "오": "화",
  "미": "토",
  "신": "금",
  "유": "금",
  "술": "토",
  "해": "수",
};

export const ELEMENT_DISPLAY = {
  "목": "나무",
  "화": "불",
  "토": "땅",
  "금": "금",
  "수": "물",
};

export const ELEMENT_CLASS = {
  "목": "wood",
  "화": "fire",
  "토": "earth",
  "금": "metal",
  "수": "water",
};

const STEM_TO_HANJA = Object.fromEntries(
  HEAVENLY_STEMS.map((stem, index) => [stem, HEAVENLY_STEMS_HANJA[index]])
);

const BRANCH_TO_HANJA = Object.fromEntries(
  EARTHLY_BRANCHES.map((branch, index) => [branch, EARTHLY_BRANCHES_HANJA[index]])
);

function splitGanji(value) {
  if (!value || typeof value !== "string" || value.length < 2) {
    return { stem: "", branch: "" };
  }

  return {
    stem: value[0],
    branch: value[1],
  };
}

function buildGlyph(char, hanja, element, empty = false) {
  return {
    char,
    hanja,
    element,
    empty,
  };
}

function buildStemGlyph(stem, element) {
  return buildGlyph(stem, STEM_TO_HANJA[stem] || "", element || STEM_TO_ELEMENT[stem] || "");
}

function buildBranchGlyph(branch, element) {
  return buildGlyph(branch, BRANCH_TO_HANJA[branch] || "", element || BRANCH_TO_ELEMENT[branch] || "");
}

function normalizePillar(stem, branch, stemElement, branchElement) {
  return {
    stem: buildStemGlyph(stem, stemElement),
    branch: buildBranchGlyph(branch, branchElement),
  };
}

export function normalizeFourPillarsResult(result) {
  if (result?.year?.heavenlyStem && result?.year?.earthlyBranch) {
    return {
      year: normalizePillar(result.year.heavenlyStem, result.year.earthlyBranch, result.yearElement?.stem, result.yearElement?.branch),
      month: normalizePillar(result.month.heavenlyStem, result.month.earthlyBranch, result.monthElement?.stem, result.monthElement?.branch),
      day: normalizePillar(result.day.heavenlyStem, result.day.earthlyBranch, result.dayElement?.stem, result.dayElement?.branch),
      hour: normalizePillar(result.hour.heavenlyStem, result.hour.earthlyBranch, result.hourElement?.stem, result.hourElement?.branch),
    };
  }

  if (result && typeof result.toObject === "function") {
    const source = result.toObject();
    const year = splitGanji(source.year);
    const month = splitGanji(source.month);
    const day = splitGanji(source.day);
    const hour = splitGanji(source.hour);

    return {
      year: normalizePillar(year.stem, year.branch),
      month: normalizePillar(month.stem, month.branch),
      day: normalizePillar(day.stem, day.branch),
      hour: normalizePillar(hour.stem, hour.branch),
    };
  }

  return null;
}

export function buildUnknownHourPillar() {
  return {
    stem: buildGlyph("미상", "?", "", true),
    branch: buildGlyph("미상", "?", "", true),
  };
}

function assertNormalizedPillars(pillars, unknownTime) {
  const allOk =
    pillars?.year?.stem?.char &&
    pillars?.year?.branch?.char &&
    pillars?.month?.stem?.char &&
    pillars?.month?.branch?.char &&
    pillars?.day?.stem?.char &&
    pillars?.day?.branch?.char &&
    (unknownTime || (pillars?.hour?.stem?.char && pillars?.hour?.branch?.char));

  if (!allOk) {
    throw new Error("간지 문자열 분해에 실패했습니다. 콘솔 출력 캡처를 보내주세요.");
  }
}

export function buildReadingSnapshot({ pillars, sections, advanced, gender, unknownTime, birthInfo }) {
  const dayPillarKey = `${pillars.day.stem.char}${pillars.day.branch.char}`;
  const dayPillarInfo = getDayPillarArchetype(dayPillarKey) || {};

  return {
    gender,
    unknownTime,
    birthInfo,
    pillars,
    sections,
    advanced,
    dayPillar: {
      key: dayPillarKey,
      hanja: dayPillarInfo.hanja || "",
      metaphor: dayPillarInfo.metaphor || "",
      elementClass: ELEMENT_CLASS[pillars.day.stem.element] || "unknown",
    },
  };
}

export function getReadingPreviewSummary(snapshot) {
  return snapshot.sections?.[0]?.text || snapshot.advanced?.diagnosis?.summary || "";
}

export function calculateReadingSnapshot({
  year,
  month,
  day,
  hour,
  minute,
  isLunar,
  isLeapMonth,
  gender,
  unknownTime,
  currentDate = new Date(),
}) {
  let pillars;

  if (unknownTime) {
    const result = calculateFourPillars({
      year,
      month,
      day,
      hour: 12,
      minute: 0,
      isLunar: Boolean(isLunar),
      isLeapMonth: isLunar ? Boolean(isLeapMonth) : undefined,
    });

    pillars = normalizeFourPillarsResult(result);
    if (!pillars) {
      console.log("8x8 사주 계산 결과:", result);
      throw new Error("사주 계산 결과를 해석할 수 없습니다. 콘솔 출력 캡처를 보내주세요.");
    }

    pillars.hour = buildUnknownHourPillar();
  } else {
    const result = calculateFourPillars({
      year,
      month,
      day,
      hour,
      minute,
      isLunar: Boolean(isLunar),
      isLeapMonth: isLunar ? Boolean(isLeapMonth) : undefined,
    });

    pillars = normalizeFourPillarsResult(result);
    if (!pillars) {
      console.log("8x8 사주 계산 결과:", result);
      throw new Error("사주 계산 결과를 해석할 수 없습니다. 콘솔 출력 캡처를 보내주세요.");
    }
  }

  assertNormalizedPillars(pillars, unknownTime);

  const birthInfo = {
    year,
    month,
    day,
    hour: unknownTime ? null : hour,
    minute: unknownTime ? null : minute,
    isLunar: Boolean(isLunar),
    isLeapMonth: isLunar ? Boolean(isLeapMonth) : false,
  };

  const sections = buildSajuReading(pillars, { gender, unknownTime });
  const advanced = buildAdvancedSajuData({
    birthInfo,
    pillars,
    gender,
    unknownTime,
    currentDate,
  });

  return buildReadingSnapshot({
    pillars,
    sections,
    advanced,
    gender,
    unknownTime,
    birthInfo,
  });
}

export function buildStoredReadingPayload(snapshot, { entryName, memo = "" }) {
  return {
    entry_name: entryName,
    memo,
    gender: snapshot.gender,
    calendar_type: snapshot.birthInfo.isLunar ? "lunar" : "solar",
    is_leap_month: Boolean(snapshot.birthInfo.isLeapMonth),
    birth_year: snapshot.birthInfo.year,
    birth_month: snapshot.birthInfo.month,
    birth_day: snapshot.birthInfo.day,
    birth_hour: snapshot.unknownTime ? null : snapshot.birthInfo.hour,
    birth_minute: snapshot.unknownTime ? null : snapshot.birthInfo.minute,
    birth_time_known: !snapshot.unknownTime,
    day_pillar_key: snapshot.dayPillar.key,
    day_pillar_hanja: snapshot.dayPillar.hanja,
    day_pillar_metaphor: snapshot.dayPillar.metaphor,
    element_class: snapshot.dayPillar.elementClass,
    preview_summary: getReadingPreviewSummary(snapshot),
    pillars_json: snapshot.pillars,
    reading_json: {
      birthInfo: snapshot.birthInfo,
      sections: snapshot.sections,
      advanced: snapshot.advanced,
      dayPillar: snapshot.dayPillar,
    },
  };
}

export function buildSharedReadingPayload(snapshot, { sourceType, sourceRecordId = null, entryName, memo = "" }) {
  return {
    owner_id: null,
    source_type: sourceType,
    source_record_id: sourceRecordId,
    entry_name: entryName,
    memo,
    day_pillar_key: snapshot.dayPillar.key,
    day_pillar_hanja: snapshot.dayPillar.hanja,
    day_pillar_metaphor: snapshot.dayPillar.metaphor,
    element_class: snapshot.dayPillar.elementClass,
    preview_summary: getReadingPreviewSummary(snapshot),
    snapshot_json: snapshot,
  };
}

function buildBirthInfoFromRecord(record) {
  return {
    year: record.birth_year,
    month: record.birth_month,
    day: record.birth_day,
    hour: record.birth_time_known ? record.birth_hour : null,
    minute: record.birth_time_known ? record.birth_minute : null,
    isLunar: record.calendar_type === "lunar",
    isLeapMonth: Boolean(record.is_leap_month),
  };
}

function hydrateSnapshotFromRecord(record, snapshotSource) {
  const birthInfo = snapshotSource?.birthInfo || buildBirthInfoFromRecord(record);
  const unknownTime = typeof snapshotSource?.unknownTime === "boolean" ? snapshotSource.unknownTime : !record.birth_time_known;
  const pillars = record.pillars_json || snapshotSource?.pillars;
  const sections = snapshotSource?.sections;
  const advanced = snapshotSource?.advanced;
  const resolvedGender = snapshotSource?.gender || record.gender;

  if (pillars && Array.isArray(sections) && advanced) {
    return {
      gender: resolvedGender,
      unknownTime,
      birthInfo,
      pillars,
      sections,
      advanced,
      dayPillar: snapshotSource?.dayPillar || {
        key: record.day_pillar_key,
        hanja: record.day_pillar_hanja || "",
        metaphor: record.day_pillar_metaphor || "",
        elementClass: record.element_class || "unknown",
      },
    };
  }

  return calculateReadingSnapshot({
    year: birthInfo.year,
    month: birthInfo.month,
    day: birthInfo.day,
    hour: birthInfo.hour,
    minute: birthInfo.minute,
    isLunar: birthInfo.isLunar,
    isLeapMonth: birthInfo.isLeapMonth,
    gender: resolvedGender,
    unknownTime,
  });
}

export function buildSnapshotFromSavedReading(record) {
  return hydrateSnapshotFromRecord(record, record.reading_json || null);
}

export function buildSnapshotFromSharedReading(record) {
  return hydrateSnapshotFromRecord(record, record.snapshot_json || null);
}

export function buildSnapshotFromProfile(profile) {
  return calculateReadingSnapshot({
    year: profile.birth_year,
    month: profile.birth_month,
    day: profile.birth_day,
    hour: profile.birth_time_known ? profile.birth_hour : null,
    minute: profile.birth_time_known ? profile.birth_minute : null,
    isLunar: profile.calendar_type === "lunar",
    isLeapMonth: Boolean(profile.is_leap_month),
    gender: profile.gender,
    unknownTime: !profile.birth_time_known,
  });
}
