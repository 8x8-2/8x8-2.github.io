export const REGION_OPTIONS = [
  {
    country: "대한민국",
    regions: [
      "서울특별시",
      "부산광역시",
      "인천광역시",
      "대구광역시",
      "대전광역시",
      "광주광역시",
      "울산광역시",
      "세종특별자치시",
      "경기도",
      "강원특별자치도",
      "충청북도",
      "충청남도",
      "전북특별자치도",
      "전라남도",
      "경상북도",
      "경상남도",
      "제주특별자치도",
    ],
  },
  {
    country: "미국",
    regions: [
      "캘리포니아",
      "뉴욕",
      "텍사스",
      "워싱턴",
      "하와이",
      "일리노이",
    ],
  },
  {
    country: "일본",
    regions: ["도쿄", "오사카", "교토", "후쿠오카", "홋카이도"],
  },
  {
    country: "중국",
    regions: ["베이징", "상하이", "광둥", "저장", "쓰촨"],
  },
  {
    country: "대만",
    regions: ["타이베이", "타이중", "가오슝"],
  },
  {
    country: "홍콩",
    regions: ["홍콩"],
  },
  {
    country: "싱가포르",
    regions: ["싱가포르"],
  },
  {
    country: "캐나다",
    regions: ["온타리오", "브리티시컬럼비아", "퀘벡"],
  },
  {
    country: "영국",
    regions: ["런던", "잉글랜드", "스코틀랜드"],
  },
  {
    country: "호주",
    regions: ["시드니", "멜버른", "브리즈번", "퍼스"],
  },
];

export function fillCountrySelect(selectEl, selectedValue = "") {
  if (!selectEl) return;

  selectEl.innerHTML = `
    <option value="">선택 안 함</option>
    ${REGION_OPTIONS.map(({ country }) => `<option value="${country}">${country}</option>`).join("")}
  `;
  selectEl.value = selectedValue || "";
}

export function fillRegionSelect(selectEl, countryValue, selectedValue = "") {
  if (!selectEl) return;

  const regions = REGION_OPTIONS.find(({ country }) => country === countryValue)?.regions || [];
  selectEl.innerHTML = `
    <option value="">선택 안 함</option>
    ${regions.map((region) => `<option value="${region}">${region}</option>`).join("")}
  `;
  selectEl.disabled = !countryValue;
  selectEl.value = selectedValue || "";
}

export function formatRegionDisplay(country, region) {
  if (!country || !region) return "";
  return `지구 | ${country} | ${region}`;
}
