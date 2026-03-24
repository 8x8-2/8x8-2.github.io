const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LUNAR_BASE_DATE = new Date(1900, 0, 31);
const DAY_PILLAR_BASE_DATE = new Date(1992, 9, 24);
const DAY_PILLAR_BASE_INDEX = 9;

export const HEAVENLY_STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
export const HEAVENLY_STEMS_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

export const EARTHLY_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
export const EARTHLY_BRANCHES_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

export const YIN_YANG = ["양", "음"];
export const FIVE_ELEMENTS = ["목", "화", "토", "금", "수"];

const STEM_ELEMENTS = {
  갑: "목",
  을: "목",
  병: "화",
  정: "화",
  무: "토",
  기: "토",
  경: "금",
  신: "금",
  임: "수",
  계: "수",
};

const BRANCH_ELEMENTS = {
  자: "수",
  축: "토",
  인: "목",
  묘: "목",
  진: "토",
  사: "화",
  오: "화",
  미: "토",
  신: "금",
  유: "금",
  술: "토",
  해: "수",
};

const SOLAR_TERM_MONTH_BRANCHES = {
  1: "인",
  2: "묘",
  3: "진",
  4: "사",
  5: "오",
  6: "미",
  7: "신",
  8: "유",
  9: "술",
  10: "해",
  11: "자",
  12: "축",
};

const LUNAR_DATA = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, 0x04ae0,
  0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0,
  0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0, 0x0ea50,
  0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, 0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0,
  0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0,
  0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260,
  0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558,
  0x0b540, 0x0b6a0, 0x195a6, 0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46,
  0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5,
  0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, 0x07954,
  0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, 0x05aa0, 0x076a3,
  0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2,
  0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370, 0x049f8, 0x04970,
  0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, 0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0,
  0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50,
  0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60,
  0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0,
  0x0d150, 0x0f252, 0x0d520,
];

const SOLAR_TERM_C20 = [
  6.11, 20.84, 4.6295, 19.4599, 6.3826, 21.4155, 5.59, 20.888, 6.318, 21.86, 6.5, 22.2, 7.928,
  23.65, 8.35, 23.95, 8.44, 23.822, 9.098, 24.218, 8.218, 23.08, 7.9, 22.6,
];

const SOLAR_TERM_C21 = [
  5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04, 5.678, 21.37, 7.108, 22.83,
  7.5, 23.13, 7.646, 23.042, 8.318, 23.438, 7.438, 22.36, 7.18, 21.94,
];

function getLunarYearData(year) {
  return LUNAR_DATA[year - 1900];
}

function getLeapMonth(year) {
  return getLunarYearData(year) & 0x0f;
}

function getLeapMonthDays(year) {
  if (!getLeapMonth(year)) return 0;
  return getLunarYearData(year) & 0x10000 ? 30 : 29;
}

function getLunarMonthDays(year, month) {
  return getLunarYearData(year) & (0x10000 >> month) ? 30 : 29;
}

function getLunarYearDays(year) {
  let total = 348;

  for (let bit = 0x8000; bit > 0x08; bit >>= 1) {
    if (getLunarYearData(year) & bit) {
      total += 1;
    }
  }

  return total + getLeapMonthDays(year);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function lunarToSolar(year, month, day, isLeapMonth = false) {
  let offset = 0;

  for (let currentYear = 1900; currentYear < year; currentYear += 1) {
    offset += getLunarYearDays(currentYear);
  }

  const leapMonth = getLeapMonth(year);
  let passedLeapMonth = false;

  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    if (leapMonth > 0 && currentMonth === leapMonth && !passedLeapMonth) {
      offset += getLeapMonthDays(year);
      passedLeapMonth = true;
      currentMonth -= 1;
      continue;
    }

    offset += getLunarMonthDays(year, currentMonth);
  }

  if (isLeapMonth && leapMonth === month) {
    offset += getLunarMonthDays(year, month);
  }

  const solarDate = addDays(LUNAR_BASE_DATE, offset + day - 1);

  return {
    year: solarDate.getFullYear(),
    month: solarDate.getMonth() + 1,
    day: solarDate.getDate(),
  };
}

export function getLeapMonthForYear(year) {
  return getLeapMonth(year);
}

export function getLunarMonthLength(year, month, isLeapMonth = false) {
  if (isLeapMonth) {
    return getLeapMonth(year) === month ? getLeapMonthDays(year) : getLunarMonthDays(year, month);
  }

  return getLunarMonthDays(year, month);
}

export function solarToLunar(year, month, day) {
  const targetDate = new Date(year, month - 1, day);
  let lunarYear = 1900;

  for (let currentYear = 1900; currentYear < 2100; currentYear += 1) {
    const yearStart = lunarToSolar(currentYear, 1, 1, false);
    const yearStartDate = new Date(yearStart.year, yearStart.month - 1, yearStart.day);
    const nextYearStart = lunarToSolar(currentYear + 1, 1, 1, false);
    const nextYearStartDate = new Date(nextYearStart.year, nextYearStart.month - 1, nextYearStart.day);

    if (targetDate >= yearStartDate && targetDate < nextYearStartDate) {
      lunarYear = currentYear;
      break;
    }
  }

  const yearStart = lunarToSolar(lunarYear, 1, 1, false);
  let remainingDays = Math.floor(
    (targetDate.getTime() - new Date(yearStart.year, yearStart.month - 1, yearStart.day).getTime()) / MS_PER_DAY
  );

  for (let currentMonth = 1; currentMonth <= 12; currentMonth += 1) {
    const regularMonthDays = getLunarMonthDays(lunarYear, currentMonth);
    if (remainingDays < regularMonthDays) {
      return {
        year: lunarYear,
        month: currentMonth,
        day: remainingDays + 1,
        isLeapMonth: false,
      };
    }
    remainingDays -= regularMonthDays;

    if (getLeapMonth(lunarYear) === currentMonth) {
      const leapMonthDays = getLeapMonthDays(lunarYear);
      if (remainingDays < leapMonthDays) {
        return {
          year: lunarYear,
          month: currentMonth,
          day: remainingDays + 1,
          isLeapMonth: true,
        };
      }
      remainingDays -= leapMonthDays;
    }
  }

  return {
    year: lunarYear,
    month: 12,
    day: remainingDays + 1,
    isLeapMonth: false,
  };
}

export function getSolarTermDate(year, termIndex) {
  const yearInCentury = year % 100;
  const coefficients = year >= 2000 ? SOLAR_TERM_C21 : SOLAR_TERM_C20;
  const leapYearAdjustment = Math.floor((yearInCentury - 1) / 4);
  const day = Math.floor(yearInCentury * 0.2422 + coefficients[termIndex]) - leapYearAdjustment;
  const month = Math.floor(termIndex / 2);

  return new Date(year, month, day);
}

export function getAdjustedSolarYear(year, month, day) {
  const date = new Date(year, month - 1, day);
  const lichun = getSolarTermDate(year, 2);

  return date < lichun ? year - 1 : year;
}

export function getYearPillar(year, month, day) {
  const adjustedYear = getAdjustedSolarYear(year, month, day);
  const cycleIndex = adjustedYear - 4;

  return {
    heavenlyStem: HEAVENLY_STEMS[((cycleIndex % 10) + 10) % 10],
    earthlyBranch: EARTHLY_BRANCHES[((cycleIndex % 12) + 12) % 12],
  };
}

function getSolarTermMonth(date, year) {
  const xiaohan = getSolarTermDate(year, 0);
  const lichun = getSolarTermDate(year, 2);
  const jingzhe = getSolarTermDate(year, 4);
  const qingming = getSolarTermDate(year, 6);
  const lixia = getSolarTermDate(year, 8);
  const mangzhong = getSolarTermDate(year, 10);
  const xiaoshu = getSolarTermDate(year, 12);
  const liqiu = getSolarTermDate(year, 14);
  const bailu = getSolarTermDate(year, 16);
  const hanlu = getSolarTermDate(year, 18);
  const lidong = getSolarTermDate(year, 20);
  const daxue = getSolarTermDate(year, 22);

  if (date < xiaohan) return 11;
  if (date < lichun) return 12;
  if (date < jingzhe) return 1;
  if (date < qingming) return 2;
  if (date < lixia) return 3;
  if (date < mangzhong) return 4;
  if (date < xiaoshu) return 5;
  if (date < liqiu) return 6;
  if (date < bailu) return 7;
  if (date < hanlu) return 8;
  if (date < lidong) return 9;
  if (date < daxue) return 10;
  return 11;
}

function getMonthPillar(year, month, day) {
  const date = new Date(year, month - 1, day);
  const solarTermMonth = getSolarTermMonth(date, year);
  const adjustedYear = getAdjustedSolarYear(year, month, day);
  const yearStemIndex = ((adjustedYear - 4) % 10 + 10) % 10;
  const monthStemStartIndex = ((yearStemIndex % 5) * 2 + 2) % 10;
  const monthStemIndex = (monthStemStartIndex + solarTermMonth - 1) % 10;

  return {
    heavenlyStem: HEAVENLY_STEMS[monthStemIndex],
    earthlyBranch: SOLAR_TERM_MONTH_BRANCHES[solarTermMonth],
  };
}

function getDayPillar(year, month, day) {
  const targetDate = new Date(year, month - 1, day);
  const daysDiff = Math.floor((targetDate.getTime() - DAY_PILLAR_BASE_DATE.getTime()) / MS_PER_DAY);
  const cycleIndex = (((DAY_PILLAR_BASE_INDEX + daysDiff) % 60) + 60) % 60;

  return {
    heavenlyStem: HEAVENLY_STEMS[cycleIndex % 10],
    earthlyBranch: EARTHLY_BRANCHES[cycleIndex % 12],
  };
}

function getShichenIndex(hour, minute) {
  const normalizedHour = hour === 23 ? 0 : hour;
  const totalMinutes = normalizedHour * 60 + minute;

  return Math.floor((totalMinutes + 60) / 120) % 12;
}

function getHourPillar(dayPillar, hour, minute) {
  const shichenIndex = getShichenIndex(hour, minute);
  const dayStemIndex = HEAVENLY_STEMS.indexOf(dayPillar.heavenlyStem);
  const stemStartIndex = (dayStemIndex % 5) * 2;

  return {
    heavenlyStem: HEAVENLY_STEMS[(stemStartIndex + shichenIndex) % 10],
    earthlyBranch: EARTHLY_BRANCHES[shichenIndex],
  };
}

function buildElementInfo(pillar) {
  return {
    stem: getHeavenlyStemElement(pillar.heavenlyStem),
    branch: getEarthlyBranchElement(pillar.earthlyBranch),
  };
}

function buildYinYangInfo(pillar) {
  return {
    stem: getHeavenlyStemYinYang(pillar.heavenlyStem),
    branch: getEarthlyBranchYinYang(pillar.earthlyBranch),
  };
}

function getHanjaForPillar(pillar) {
  const stemIndex = HEAVENLY_STEMS.indexOf(pillar.heavenlyStem);
  const branchIndex = EARTHLY_BRANCHES.indexOf(pillar.earthlyBranch);

  return `${HEAVENLY_STEMS_HANJA[stemIndex]}${EARTHLY_BRANCHES_HANJA[branchIndex]}`;
}

function getPillarString(pillar) {
  return `${pillar.heavenlyStem}${pillar.earthlyBranch}`;
}

export function normalizeBirthInfo(birthInfo) {
  let { year, month, day, hour, minute } = birthInfo;

  if (birthInfo.isLunar) {
    const solarDate = lunarToSolar(year, month, day, Boolean(birthInfo.isLeapMonth));
    year = solarDate.year;
    month = solarDate.month;
    day = solarDate.day;
  }

  if (hour === 24 && minute === 0) {
    const nextDay = new Date(year, month - 1, day);
    nextDay.setDate(nextDay.getDate() + 1);

    year = nextDay.getFullYear();
    month = nextDay.getMonth() + 1;
    day = nextDay.getDate();
    hour = 0;
    minute = 0;
  }

  return { year, month, day, hour, minute };
}

export function calculateFourPillars(birthInfo) {
  const normalized = normalizeBirthInfo(birthInfo);
  const yearPillar = getYearPillar(normalized.year, normalized.month, normalized.day);
  const monthPillar = getMonthPillar(normalized.year, normalized.month, normalized.day);
  const dayPillar = getDayPillar(normalized.year, normalized.month, normalized.day);
  const hourPillar = getHourPillar(dayPillar, normalized.hour, normalized.minute);

  const result = {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    yearElement: buildElementInfo(yearPillar),
    monthElement: buildElementInfo(monthPillar),
    dayElement: buildElementInfo(dayPillar),
    hourElement: buildElementInfo(hourPillar),
    yearYinYang: buildYinYangInfo(yearPillar),
    monthYinYang: buildYinYangInfo(monthPillar),
    dayYinYang: buildYinYangInfo(dayPillar),
    hourYinYang: buildYinYangInfo(hourPillar),
    yearString: getPillarString(yearPillar),
    monthString: getPillarString(monthPillar),
    dayString: getPillarString(dayPillar),
    hourString: getPillarString(hourPillar),
    yearHanja: getHanjaForPillar(yearPillar),
    monthHanja: getHanjaForPillar(monthPillar),
    dayHanja: getHanjaForPillar(dayPillar),
    hourHanja: getHanjaForPillar(hourPillar),
    toString() {
      return `${this.yearString}년주, ${this.monthString}월주, ${this.dayString}일주, ${this.hourString}시주`;
    },
    toObject() {
      return {
        year: this.yearString,
        month: this.monthString,
        day: this.dayString,
        hour: this.hourString,
      };
    },
    toHanjaObject() {
      return {
        year: { korean: this.yearString, hanja: this.yearHanja },
        month: { korean: this.monthString, hanja: this.monthHanja },
        day: { korean: this.dayString, hanja: this.dayHanja },
        hour: { korean: this.hourString, hanja: this.hourHanja },
      };
    },
    toHanjaString() {
      return `${this.yearHanja}年柱, ${this.monthHanja}月柱, ${this.dayHanja}日柱, ${this.hourHanja}時柱`;
    },
  };

  return result;
}

export function getPillarCycleIndex(pillar) {
  const stemIndex = HEAVENLY_STEMS.indexOf(pillar.heavenlyStem);
  const branchIndex = EARTHLY_BRANCHES.indexOf(pillar.earthlyBranch);

  if (stemIndex < 0 || branchIndex < 0) return -1;

  for (let cycleIndex = 0; cycleIndex < 60; cycleIndex += 1) {
    if (cycleIndex % 10 === stemIndex && cycleIndex % 12 === branchIndex) {
      return cycleIndex;
    }
  }

  return -1;
}

export function getPillarByCycleIndex(cycleIndex) {
  return {
    heavenlyStem: HEAVENLY_STEMS[((cycleIndex % 10) + 10) % 10],
    earthlyBranch: EARTHLY_BRANCHES[((cycleIndex % 12) + 12) % 12],
  };
}

export function fourPillarsToString(fourPillars) {
  const { year, month, day, hour } = fourPillars;

  return [
    `${year.heavenlyStem}${year.earthlyBranch}연주`,
    `${month.heavenlyStem}${month.earthlyBranch}월주`,
    `${day.heavenlyStem}${day.earthlyBranch}일주`,
    `${hour.heavenlyStem}${hour.earthlyBranch}시주`,
  ].join(", ");
}

export function getHeavenlyStemYinYang(stem) {
  return HEAVENLY_STEMS.indexOf(stem) % 2 === 0 ? "양" : "음";
}

export function getEarthlyBranchYinYang(branch) {
  return EARTHLY_BRANCHES.indexOf(branch) % 2 === 0 ? "양" : "음";
}

export function getHeavenlyStemElement(stem) {
  return STEM_ELEMENTS[stem];
}

export function getEarthlyBranchElement(branch) {
  return BRANCH_ELEMENTS[branch];
}
