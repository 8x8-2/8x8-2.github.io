import { calculateFourPillars } from "./vendor/manseryeok/dist/index.js";

const $ = (id) => document.getElementById(id);

const calendarEl = $("calendar");
const leapEl = $("leapMonth");
const genderEl = $("gender");
const btn = $("btnCalc");
const statusEl = $("status");
const errEl = $("error");
const resultEl = $("result");
const pillarsEl = $("pillars");
const eightEl = $("eight");
const sectionsEl = $("sections");

calendarEl.addEventListener("change", () => {
  const isLunar = calendarEl.value === "lunar";
  leapEl.disabled = !isLunar;
  if (!isLunar) leapEl.checked = false;
});

const STEM_TO_ELEMENT = {
  "갑": "목", "을": "목",
  "병": "화", "정": "화",
  "무": "토", "기": "토",
  "경": "금", "신": "금",
  "임": "수", "계": "수",
};

// (선택) 특정 일주만 수동 고퀄 문구를 넣고 싶을 때
const DAY_PILLAR_DB = {
  // 예시 1개만
  "계유": {
    male: {
      love: "표현은 절제되어 보이지만 한 번 마음 주면 깊게 갑니다. 신뢰가 핵심입니다.",
      career: "디테일/분석/품질 기준이 강합니다. 데이터·기획·QA에 강점이 납니다.",
      money: "큰 베팅보다 규칙형 관리(예산/한도/분산)가 안정적입니다.",
      health: "수면/신경 피로 누적에 민감. 회복 루틴을 고정하세요.",
    },
    female: {
      love: "기준이 분명해 관계가 안정적입니다. 감정 표현을 조금만 더 해주면 좋아요.",
      career: "정밀함과 완성도가 강점. 기획·분석·디자인/QA에 강합니다.",
      money: "계획소비에 강합니다. 자동이체/목표예산으로 안정성이 커집니다.",
      health: "컨디션 편차가 생기기 쉬워 수면/면역 루틴 관리가 중요합니다.",
    },
  },
};

// 자동 생성 템플릿 (DB 없는 일주는 여기로)
const STEM_BASE = {
  "갑": { love: "주도적·개척형", career: "리더·기획형", money: "축적 선호", health: "간/눈 피로" },
  "을": { love: "섬세·관계형", career: "조율·기획형", money: "분산 선호", health: "피로/면역" },
  "병": { love: "표현·열정형", career: "세일즈·리딩", money: "단기 성과", health: "수면/과열" },
  "정": { love: "깊고 은근", career: "정밀·콘텐츠", money: "계획형", health: "신경/스트레스" },
  "무": { love: "보호·책임형", career: "운영·관리", money: "자산형", health: "소화/체중" },
  "기": { love: "배려·조율형", career: "행정·정리", money: "저축형", health: "위장/피로" },
  "경": { love: "직설·원칙형", career: "기술·결단", money: "성과형", health: "폐/피부" },
  "신": { love: "정교·기준형", career: "품질·분석", money: "절약형", health: "호흡기" },
  "임": { love: "자유·전략형", career: "확장·전략", money: "변동성", health: "수면/리듬" },
  "계": { love: "감성·직관형", career: "연구·상담", money: "분산형", health: "신경/면역" },
};

const BRANCH_MOD = {
  "자": "관계가 빠르게 형성되지만 감정 기복 관리가 중요합니다.",
  "축": "안정/루틴을 만들면 성과가 커집니다.",
  "인": "도전성이 강해 변화가 잦을 수 있습니다.",
  "묘": "감성·취향이 중요해 ‘맞음’이 핵심입니다.",
  "진": "책임이 커지기 쉬워 역할 분담이 포인트입니다.",
  "사": "속도가 빠르니 과열/과로를 조심하세요.",
  "오": "표현력은 강하지만 감정 과잉에 주의하세요.",
  "미": "돌봄/관계 피로가 누적되지 않게 경계를 세우세요.",
  "신": "성과 압박을 받기 쉬워 기준 조정이 필요합니다.",
  "유": "완성도/디테일 강점, 완벽주의로 지치지 않게 조절하세요.",
  "술": "원칙을 세우면 흔들림이 줄어듭니다.",
  "해": "감수성이 깊어 휴식 루틴이 중요합니다.",
};

function buildEight(p) {
  const stems = [p.year.stem, p.month.stem, p.day.stem, p.hour.stem];
  const branches = [p.year.branch, p.month.branch, p.day.branch, p.hour.branch];
  return { stems, branches, text: `${stems.join(" ")} / ${branches.join(" ")}` };
}

function splitGanji(str) {
  if (!str || typeof str !== "string" || str.length < 2) return { stem: "", branch: "" };
  return { stem: str[0], branch: str[1] };
}

function normalizeManseryeok(r) {
  // 가장 안전: toObject()
  if (r && typeof r.toObject === "function") {
    const o = r.toObject(); // { year:'임신', month:'경술', day:'계유', hour:'을묘' }
    return {
      year: splitGanji(o.year),
      month: splitGanji(o.month),
      day: splitGanji(o.day),
      hour: splitGanji(o.hour),
    };
  }
  // 혹시 plain object인 경우
  if (r?.year?.heavenlyStem && r?.year?.earthlyBranch) {
    return {
      year: { stem: r.year.heavenlyStem, branch: r.year.earthlyBranch },
      month: { stem: r.month.heavenlyStem, branch: r.month.earthlyBranch },
      day: { stem: r.day.heavenlyStem, branch: r.day.earthlyBranch },
      hour: { stem: r.hour.heavenlyStem, branch: r.hour.earthlyBranch },
    };
  }
  return null;
}

function validateInput({ year, month, day, hour, minute, isLunar }) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return "년은 1900~2100 사이여야 합니다.";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "월은 1~12 사이여야 합니다.";

  // 음력은 보통 1~30, 양력은 1~31 (정밀한 월별 일수 체크는 추가 가능)
  const maxDay = isLunar ? 30 : 31;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return `일은 ${isLunar ? "음력 기준 1~30" : "1~31"} 사이여야 합니다.`;

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "시는 0~23 사이여야 합니다.";
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return "분은 0~59 사이여야 합니다.";

  return null;
}

function generateSectionsAuto(pillars, gender) {
  const stem = pillars.day.stem;
  const branch = pillars.day.branch;
  const base = STEM_BASE[stem] || { love: "기본 성향", career: "기본 성향", money: "기본 성향", health: "기본 성향" };
  const mod = BRANCH_MOD[branch] || "";
  const tone = gender === "female" ? "조금 더" : "더";

  return [
    { title: "1) 연애·인간관계", text: `${base.love}. ${mod} 표현은 ${tone} 부드럽게 하면 안정됩니다.` },
    { title: "2) 직업·경력", text: `${base.career}. ${mod}` },
    { title: "3) 재물·돈", text: `${base.money}. 규칙(예산/자동이체/분산)으로 관리하면 유리합니다.` },
    { title: "4) 건강", text: `${base.health}. 루틴(수면/식사/운동) 고정이 핵심입니다. ${mod}` },
  ];
}

function generateSections(pillars, gender) {
  const key = `${pillars.day.stem}${pillars.day.branch}`; // 일주
  const manual = DAY_PILLAR_DB[key]?.[gender];
  if (manual) {
    return [
      { title: "1) 연애·인간관계", text: manual.love },
      { title: "2) 직업·경력", text: manual.career },
      { title: "3) 재물·돈", text: manual.money },
      { title: "4) 건강", text: manual.health },
    ];
  }
  return generateSectionsAuto(pillars, gender);
}

function render(pillars, gender) {
  const eight = buildEight(pillars);

  pillarsEl.innerHTML = `
    <li>년주: ${pillars.year.stem}${pillars.year.branch}</li>
    <li>월주: ${pillars.month.stem}${pillars.month.branch}</li>
    <li>일주: ${pillars.day.stem}${pillars.day.branch}</li>
    <li>시주: ${pillars.hour.stem}${pillars.hour.branch}</li>
  `;

  eightEl.textContent = eight.text;

  const sections = generateSections(pillars, gender);
  sectionsEl.innerHTML = sections
    .map(
      (s) => `
        <div class="box">
          <div class="title">${s.title}</div>
          <div class="text">${s.text}</div>
        </div>
      `
    )
    .join("");

  resultEl.classList.remove("hidden");
}

btn.addEventListener("click", async () => {
  errEl.textContent = "";
  statusEl.textContent = "";
  btn.disabled = true;

  try {
    const isLunar = calendarEl.value === "lunar";
    const isLeapMonth = leapEl.checked;
    const gender = genderEl.value; // male | female

    const year = Number($("yyyy").value);
    const month = Number($("mm").value);
    const day = Number($("dd").value);
    const hour = Number($("hh").value);
    const minute = Number($("min").value);

    const validationError = validateInput({ year, month, day, hour, minute, isLunar });
    if (validationError) throw new Error(validationError);

    statusEl.textContent = "계산 중...";

    const r = calculateFourPillars({
      year,
      month,
      day,
      hour,
      minute,
      isLunar: isLunar ? true : false,
      isLeapMonth: isLunar ? isLeapMonth : undefined,
    });

    const pillars = normalizeManseryeok(r);
    if (!pillars) {
      console.log("manseryeok raw result:", r);
      throw new Error("만세력 결과를 해석할 수 없습니다. 콘솔 출력 캡처를 보내주세요.");
    }

    const allOk =
      pillars.year.stem && pillars.year.branch &&
      pillars.month.stem && pillars.month.branch &&
      pillars.day.stem && pillars.day.branch &&
      pillars.hour.stem && pillars.hour.branch;

    if (!allOk) {
      console.log("normalized pillars:", pillars);
      if (typeof r?.toObject === "function") console.log("toObject():", r.toObject());
      throw new Error("간지 문자열 분해에 실패했습니다. 콘솔 출력 캡처를 보내주세요.");
    }

    render(pillars, gender);
    statusEl.textContent = "완료";
  } catch (e) {
    errEl.textContent = e?.message || "오류가 발생했습니다.";
  } finally {
    btn.disabled = false;
  }
});