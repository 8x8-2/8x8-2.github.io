/**
 * 만세력(萬歲曆) 계산 라이브러리
 * Korean Saju (Four Pillars) and Manseryeok calculation library
 *
 * @author Yoohyojun
 * @license MIT
 */
/** 천간 (Heavenly Stems) */
export declare const HEAVENLY_STEMS: readonly ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
/** 천간 한자 */
export declare const HEAVENLY_STEMS_HANJA: readonly ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
/** 지지 (Earthly Branches) */
export declare const EARTHLY_BRANCHES: readonly ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
/** 지지 한자 */
export declare const EARTHLY_BRANCHES_HANJA: readonly ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
/** 음양 (Yin/Yang) */
export declare const YIN_YANG: readonly ["양", "음"];
/** 오행 (Five Elements) */
export declare const FIVE_ELEMENTS: readonly ["목", "화", "토", "금", "수"];
export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];
export type YinYang = (typeof YIN_YANG)[number];
export type FiveElement = (typeof FIVE_ELEMENTS)[number];
/** 사주의 한 기둥을 나타내는 인터페이스 */
export interface Pillar {
    heavenlyStem: HeavenlyStem;
    earthlyBranch: EarthlyBranch;
}
/** 사주팔자 전체를 나타내는 인터페이스 */
export interface FourPillars {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
}
/** 생년월일시 정보 */
export interface BirthInfo {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    isLunar?: boolean;
    isLeapMonth?: boolean;
}
/** 음력 날짜 정보 */
export interface LunarDate {
    year: number;
    month: number;
    day: number;
    isLeapMonth: boolean;
}
/** 양력 날짜 정보 */
export interface SolarDate {
    year: number;
    month: number;
    day: number;
}
/**
 * 음력을 양력으로 변환
 */
export declare function lunarToSolar(year: number, month: number, day: number, isLeapMonth: boolean): SolarDate;
/**
 * 양력을 음력으로 변환
 */
export declare function solarToLunar(year: number, month: number, day: number): LunarDate;
/** 사주 계산 결과 상세 정보 */
export interface FourPillarsDetail extends FourPillars {
    yearElement: {
        stem: FiveElement;
        branch: FiveElement;
    };
    monthElement: {
        stem: FiveElement;
        branch: FiveElement;
    };
    dayElement: {
        stem: FiveElement;
        branch: FiveElement;
    };
    hourElement: {
        stem: FiveElement;
        branch: FiveElement;
    };
    yearYinYang: {
        stem: YinYang;
        branch: YinYang;
    };
    monthYinYang: {
        stem: YinYang;
        branch: YinYang;
    };
    dayYinYang: {
        stem: YinYang;
        branch: YinYang;
    };
    hourYinYang: {
        stem: YinYang;
        branch: YinYang;
    };
    toString: () => string;
    toObject: () => {
        year: string;
        month: string;
        day: string;
        hour: string;
    };
    yearString: string;
    monthString: string;
    dayString: string;
    hourString: string;
    yearHanja: string;
    monthHanja: string;
    dayHanja: string;
    hourHanja: string;
    toHanjaObject: () => {
        year: {
            korean: string;
            hanja: string;
        };
        month: {
            korean: string;
            hanja: string;
        };
        day: {
            korean: string;
            hanja: string;
        };
        hour: {
            korean: string;
            hanja: string;
        };
    };
    toHanjaString: () => string;
}
/**
 * 사주팔자를 계산합니다.
 *
 * @param birthInfo 생년월일시 정보
 * @returns 사주팔자 (연주, 월주, 일주, 시주)
 */
export declare function calculateFourPillars(birthInfo: BirthInfo): FourPillarsDetail;
/**
 * 사주를 한국어 문자열로 변환합니다.
 *
 * @param fourPillars 사주팔자
 * @returns "임신연주, 경술월주, 계유일주, 을묘시주" 형식의 문자열
 */
export declare function fourPillarsToString(fourPillars: FourPillars): string;
/**
 * 천간의 음양을 반환합니다.
 */
export declare function getHeavenlyStemYinYang(stem: HeavenlyStem): YinYang;
/**
 * 천간의 오행을 반환합니다.
 */
export declare function getHeavenlyStemElement(stem: HeavenlyStem): FiveElement;
/**
 * 지지의 오행을 반환합니다.
 */
export declare function getEarthlyBranchElement(branch: EarthlyBranch): FiveElement;
/**
 * 지지의 음양을 반환합니다.
 */
export declare function getEarthlyBranchYinYang(branch: EarthlyBranch): YinYang;
//# sourceMappingURL=index.d.ts.map