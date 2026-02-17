import { calculateFourPillars } from "./vendor/manseryeok/dist/index.js";
/**
 * 입력은 한국시간(KST) 기준 "숫자"로 받습니다.
 * manseryeok README 기준:
 * calculateFourPillars({
 *   year, month, day, hour, minute,
 *   isLunar?, isLeapMonth?
 * })
 * 결과는 배포 버전에 따라 객체/클래스일 수 있어
 * 가장 안전하게 r.toObject()를 우선 사용합니다.
 */

const $ = (id) => document.getElementById(id);

const calendarEl = $("calendar");
const leapEl = $("leapMonth");
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

// 아주 간단한 MVP 해석 템플릿 (일간 오행 기반)
const STEM_TO_ELEMENT = {
  "갑": "목", "을": "목",
  "병": "화", "정": "화",
  "무": "토", "기": "토",
  "경": "금", "신": "금",
  "임": "수", "계": "수",
};

function buildEight(p) {
  const stems = [p.year.stem, p.month.stem, p.day.stem, p.hour.stem];
  const branches = [p.year.branch, p.month.branch, p.day.branch, p.hour.branch];
  return { stems, branches, text: `${stems.join(" ")} / ${branches.join(" ")}` };
}

function elementSummary(p) {
  const counts = { "목": 0, "화": 0, "토": 0, "금": 0, "수": 0 };
  const stems = [p.year.stem, p.month.stem, p.day.stem, p.hour.stem];

  for (const s of stems) {
    const el = STEM_TO_ELEMENT[s];
    if (el) counts[el] += 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    counts,
    top: sorted[0][0],
    low: sorted[sorted.length - 1][0],
    dayMaster: p.day.stem,
    dayMasterElement: STEM_TO_ELEMENT[p.day.stem],
  };
}

function generateSections(p) {
  const es = elementSummary(p);
  const dmEl = es.dayMasterElement;

  const common =
    dmEl === "목" ? "성장·개척·관계 확장 성향이 강합니다."
    : dmEl === "화" ? "표현·열정·대인 영향력이 강합니다."
    : dmEl === "토" ? "안정·책임·조율 성향이 강합니다."
    : dmEl === "금" ? "기준·결단·성과 지향이 강합니다."
    : "분석·유연·적응력이 강합니다.";

  const love =
    dmEl === "화" ? "감정 표현이 빠른 편이라 속도 조절과 신뢰 쌓기가 핵심입니다."
    : dmEl === "수" ? "관찰/분석 후 확신이 생기면 깊어집니다. 명확한 커뮤니케이션이 중요합니다."
    : dmEl === "목" ? "‘함께 성장’형 관계를 선호. 상대의 자율성을 존중하면 안정됩니다."
    : dmEl === "금" ? "기준이 분명해 안정적이지만 단정적으로 보일 수 있어 부드러운 표현이 도움 됩니다."
    : "돌봄/조율을 잘하지만 과부하가 오지 않도록 경계하세요.";

  const job =
    es.top === "금" ? "목표·성과 중심 환경에서 강합니다. 운영/품질/리스크 관리 적성."
    : es.top === "수" ? "정보/데이터/전략/커뮤니케이션 축에서 강점. 분석·PM·리서치 적합."
    : es.top === "목" ? "신규 기획/확장/BD/성장 영역과 궁합이 좋습니다."
    : es.top === "화" ? "브랜딩/세일즈/리더십/대외 커뮤니케이션 강점."
    : "운영 안정화/프로세스 설계/조정 역할에 강점.";

  const money =
    es.low === "금" ? "규칙(예산/한도) 기반 지출 관리가 재정 안정에 크게 도움 됩니다."
    : es.low === "수" ? "투자/지출 판단을 ‘검증 루틴’으로 표준화하면 손실 회피에 유리합니다."
    : "수입 다변화 + 고정비 통제가 핵심입니다.";

  const health =
    dmEl === "화" ? "과로/수면 부족에 민감할 수 있어 리듬 관리가 중요합니다."
    : dmEl === "수" ? "스트레스 누적 시 컨디션 편차가 커질 수 있어 회복 루틴이 중요합니다."
    : "무리한 패턴보다 꾸준한 습관이 효과적입니다. (의학적 판단은 전문의 권장)";

  return [
    { title: "0) 종합 성향", text: `${common} (일간: ${es.dayMaster} / 오행: ${JSON.stringify(es.counts)})` },
    { title: "1) 연애·인간관계", text: love },
    { title: "2) 직업·진로", text: job },
    { title: "3) 재물·금전", text: money },
    { title: "4) 건강", text: health },
    { title: "5) 가족·가정", text: "역할(책임/표현/조율)을 한쪽으로 몰지 않게 분담하는 것이 포인트입니다." },
    { title: "6) 타이밍", text: "MVP에서는 대운/세운/월운 계산을 제외했습니다. 다음 단계에서 추가 가능합니다." },
  ];
}

function render(pillars) {
  const eight = buildEight(pillars);

  pillarsEl.innerHTML = `
    <li>년주: ${pillars.year.stem}${pillars.year.branch}</li>
    <li>월주: ${pillars.month.stem}${pillars.month.branch}</li>
    <li>일주: ${pillars.day.stem}${pillars.day.branch}</li>
    <li>시주: ${pillars.hour.stem}${pillars.hour.branch}</li>
  `;

  eightEl.textContent = eight.text;

  const sections = generateSections(pillars);
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

// ✅ '임신' -> {stem:'임', branch:'신'}
function splitGanji(str) {
  if (!str || typeof str !== "string" || str.length < 2) return { stem: "", branch: "" };
  return { stem: str[0], branch: str[1] };
}

// ✅ manseryeok 결과를 어떤 형태로 받든 pillars로 정규화
function normalizeManseryeok(r) {
  // 1) README에 있는 toObject() 우선 사용 (배포 버전 차이에도 가장 안전)
  if (r && typeof r.toObject === "function") {
    const o = r.toObject(); // { year:'임신', month:'경술', day:'계유', hour:'을묘' }
    return {
      year: splitGanji(o.year),
      month: splitGanji(o.month),
      day: splitGanji(o.day),
      hour: splitGanji(o.hour),
    };
  }

  // 2) 혹시 정말로 FourPillars plain object면(일부 버전)
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

btn.addEventListener("click", async () => {
  errEl.textContent = "";
  statusEl.textContent = "";
  btn.disabled = true;

  try {
    const isLunar = calendarEl.value === "lunar";
    const isLeapMonth = leapEl.checked;

    const year = Number($("yyyy").value);
    const month = Number($("mm").value);
    const day = Number($("dd").value);
    const hour = Number($("hh").value);
    const minute = Number($("min").value);

    if (![year, month, day, hour, minute].every((n) => Number.isFinite(n))) {
      throw new Error("숫자 입력이 올바르지 않습니다.");
    }

    statusEl.textContent = "계산 중...";

    // ✅ README 방식 그대로 호출
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
      // 혹시 또 문제면 콘솔 로그로 형태 확인 가능
      console.log("manseryeok raw result:", r);
      throw new Error("만세력 결과를 해석할 수 없습니다. 콘솔(manseryeok raw result)을 캡처해 주세요.");
    }

    const allOk =
      pillars.year.stem && pillars.year.branch &&
      pillars.month.stem && pillars.month.branch &&
      pillars.day.stem && pillars.day.branch &&
      pillars.hour.stem && pillars.hour.branch;

    if (!allOk) {
      console.log("normalized pillars:", pillars);
      if (typeof r?.toObject === "function") console.log("toObject():", r.toObject());
      throw new Error("간지 문자열 분해에 실패했습니다. 콘솔 출력(normalized/toObject)을 캡처해 주세요.");
    }

    render(pillars);
    statusEl.textContent = "완료";
  } catch (e) {
    errEl.textContent = e?.message || "오류가 발생했습니다.";
  } finally {
    btn.disabled = false;
  }
});