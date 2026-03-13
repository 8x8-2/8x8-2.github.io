import { DAY_PILLAR_ARCHETYPES, DAY_PILLAR_DB } from "../../data/daypillars.js";

const CATEGORY_CONFIG = [
  { key: "innate", title: "1) 타고난 운" },
  { key: "career", title: "2) 직업·경력" },
  { key: "love", title: "3) 연애" },
  { key: "relationships", title: "4) 인간관계" },
  { key: "health", title: "5) 건강운" },
];

const CATEGORY_KEYS = CATEGORY_CONFIG.map((category) => category.key);
const ELEMENTS = ["목", "화", "토", "금", "수"];
const YANG_STEMS = new Set(["갑", "병", "무", "경", "임"]);
const YANG_BRANCHES = new Set(["자", "인", "진", "오", "신", "술"]);

const MONTH_BRANCH_TO_SEASON = {
  인: "spring",
  묘: "spring",
  진: "spring",
  사: "summer",
  오: "summer",
  미: "summer",
  신: "autumn",
  유: "autumn",
  술: "autumn",
  해: "winter",
  자: "winter",
  축: "winter",
};

const DAY_ELEMENT_BASE = {
  목: {
    innate: [
      "일간이 목이면 스스로를 키우고 넓혀 가려는 힘이 강해, 배울 거리와 성장 여지가 있는 환경에서 기세가 살아나는 편입니다.",
      "옳다고 느끼는 방향이 생기면 꾸준히 밀어붙이는 힘이 있지만, 답답한 규칙이나 정체된 분위기에서는 예민함이 올라올 수 있습니다.",
    ],
    career: [
      "직업적으로는 새로운 판을 만들거나 사람과 아이디어를 연결하는 역할에서 강점이 드러납니다.",
      "기획, 교육, 브랜드, 콘텐츠, 서비스 설계처럼 성장과 확장을 다루는 일이 비교적 잘 맞는 흐름입니다.",
    ],
    love: [
      "연애에서는 함께 미래를 그릴 수 있는 사람에게 마음이 움직이는 편입니다.",
      "단순한 설렘보다 서로가 발전한다고 느낄 때 관계에 더 깊이 들어가는 경향이 있습니다.",
    ],
    relationships: [
      "인간관계에서는 상대의 장점과 가능성을 먼저 보는 편이라 초반에는 호의적으로 다가가는 경우가 많습니다.",
      "다만 기본 예의와 신뢰가 무너지면 실망이 커서, 한 번 선을 긋고 나면 생각보다 단호하게 거리를 두기도 합니다.",
    ],
    health: [
      "사주 해석상 목 기운은 간, 눈, 근육 피로와 연결해서 보는 편이라 오래 누적되는 피로를 가볍게 넘기지 않는 것이 좋습니다.",
      "몸을 부드럽게 풀어 주는 스트레칭과 규칙적인 수면, 답답함을 오래 쌓아두지 않는 생활 습관이 컨디션 유지에 도움 됩니다.",
    ],
  },
  화: {
    innate: [
      "일간이 화이면 존재감과 표현력이 살아 있어, 가만히 있어도 분위기를 환하게 만들거나 주목을 받는 경우가 적지 않습니다.",
      "열정이 붙으면 몰입 속도가 빠르지만 기분과 에너지의 고저가 커질 수 있어, 스스로 페이스를 조절하는 힘이 중요합니다.",
    ],
    career: [
      "직업적으로는 사람을 움직이고 분위기를 만드는 역할에서 빛이 나는 편입니다.",
      "세일즈, 마케팅, 브랜딩, 콘텐츠, 발표, 교육처럼 메시지와 영향력을 다루는 일이 잘 맞을 수 있습니다.",
    ],
    love: [
      "연애에서는 감정이 움직이면 비교적 빠르게 신호를 보내는 편이라, 끌림과 설렘을 숨기기보다 드러내는 쪽에 가깝습니다.",
      "관계의 온도감이 중요해서 무심하거나 반응이 느린 상대에게는 마음이 쉽게 식을 수 있습니다.",
    ],
    relationships: [
      "사람들과 있을 때 존재감이 또렷하고 리액션이 좋아, 가까워지는 속도 자체는 비교적 빠른 편입니다.",
      "다만 분위기를 너무 오래 책임지려 하면 정작 본인이 지칠 수 있어, 적절히 물러나는 감각도 필요합니다.",
    ],
    health: [
      "사주 해석상 화 기운은 심장, 혈압, 수면, 체온 조절과 연결해서 보는 경우가 많습니다.",
      "과열과 과로가 쌓이지 않도록 늦은 시간의 과한 각성과 카페인, 불규칙한 취침 패턴을 줄이는 것이 도움이 됩니다.",
    ],
  },
  토: {
    innate: [
      "일간이 토이면 중심을 잡고 버티는 힘이 좋아, 상황이 흔들려도 현실적으로 정리해 내는 능력이 있는 편입니다.",
      "책임감이 강하고 주변을 챙기려는 성향이 있지만, 한꺼번에 많은 짐을 떠안으면 묵직한 피로로 돌아오기 쉽습니다.",
    ],
    career: [
      "직업적으로는 운영, 관리, 조율, 지원 체계를 세우는 일에서 실력이 안정적으로 드러납니다.",
      "행정, 총무, 재무, PM, 인사, 운영관리처럼 흐트러진 것을 정리해 구조화하는 일이 잘 맞는 편입니다.",
    ],
    love: [
      "연애에서는 자극보다 안정감, 생활력, 신뢰를 더 중요하게 보는 경향이 있습니다.",
      "마음을 열기까지는 시간이 필요하지만, 관계가 자리 잡으면 오래 책임지려는 쪽에 가깝습니다.",
    ],
    relationships: [
      "사람들과의 관계에서도 실질적으로 도움을 주며 신뢰를 쌓는 스타일이라, 말보다 행동으로 평가받는 경우가 많습니다.",
      "다만 부탁을 끊지 못하고 계속 들어주다 보면 관계 피로가 누적될 수 있어 경계 설정이 중요합니다.",
    ],
    health: [
      "사주 해석상 토 기운은 위장, 소화, 체중 변화, 몸의 무거움과 연결해서 살펴보는 편입니다.",
      "식사 시간과 수면 시간을 크게 흔들지 않는 것만으로도 몸 상태가 훨씬 안정되기 쉬운 구조입니다.",
    ],
  },
  금: {
    innate: [
      "일간이 금이면 기준이 분명하고 옳고 그름을 선명하게 보려는 성향이 있어, 판단의 정확도와 디테일 감각이 돋보이는 편입니다.",
      "좋고 싫음이 분명한 대신 스스로에게도 기준이 엄격해 완벽주의적 피로를 겪을 수 있습니다.",
    ],
    career: [
      "직업적으로는 정확성, 판단, 기준 설정이 필요한 일에서 강점이 크게 드러납니다.",
      "분석, 품질관리, 법무, 재무, 엔지니어링, 데이터, 설계 검토처럼 오류를 줄이고 완성도를 높이는 일이 잘 맞습니다.",
    ],
    love: [
      "연애에서는 감정만으로 움직이기보다 상대의 태도와 신뢰도를 오래 관찰하는 편입니다.",
      "좋은 관계가 되면 깊고 오래 가지만, 실망 포인트가 생기면 마음을 접는 속도도 빠를 수 있습니다.",
    ],
    relationships: [
      "사람들과의 소통에서는 군더더기 없이 핵심을 짚는 편이라, 일할 때는 믿음직하다는 평가를 듣기 쉽습니다.",
      "다만 말이 짧거나 단호하게 들릴 수 있어, 가까운 사이일수록 표현의 온도를 조금 보태면 관계가 훨씬 부드러워집니다.",
    ],
    health: [
      "사주 해석상 금 기운은 폐, 호흡기, 피부, 건조함과 연결해서 보는 경우가 많습니다.",
      "환절기 관리와 수분, 호흡기 보호, 과도한 긴장 완화가 컨디션 유지에 중요하게 작용할 수 있습니다.",
    ],
  },
  수: {
    innate: [
      "일간이 수이면 관찰력과 적응력이 좋아, 한 번에 밀어붙이기보다 흐름을 읽고 맞춰 가는 힘이 큰 편입니다.",
      "겉으로는 유연해 보여도 속으로는 생각이 깊고 계산이 빨라, 남들이 보기보다 훨씬 많은 경우의 수를 살피는 타입일 수 있습니다.",
    ],
    career: [
      "직업적으로는 조사, 전략, 상담, 기획, 연구처럼 정보를 모으고 해석해 방향을 잡는 역할과 잘 맞습니다.",
      "문제의 본질을 읽고 우회로를 찾는 감각이 있어 복합적인 프로젝트나 변화가 많은 환경에서 강점을 발휘할 수 있습니다.",
    ],
    love: [
      "연애에서는 겉으로 급해 보이지 않아도 내적으로는 상대를 깊게 읽고 판단하는 편입니다.",
      "감정의 흐름과 대화의 밀도를 모두 중요하게 봐서, 통하는 사람에게는 천천히 그러나 깊게 빠질 가능성이 큽니다.",
    ],
    relationships: [
      "사람들과의 관계에서는 유연하게 맞춰 주는 힘이 있어 겉으로 충돌이 적어 보일 수 있습니다.",
      "대신 속마음을 오래 혼자 정리하는 편이라, 피로가 누적되면 갑자기 거리를 두는 형태로 드러날 수도 있습니다.",
    ],
    health: [
      "사주 해석상 수 기운은 신장, 방광, 냉증, 수면 리듬과 연결해서 보는 편입니다.",
      "몸을 차게 두지 않는 것과 수면 시간, 순환 관리에 신경 쓰면 컨디션 기복을 줄이는 데 도움이 됩니다.",
    ],
  },
};

const YIN_YANG_SENTENCES = {
  yang: {
    innate: "팔자 전반에 양 기운이 비교적 강하면 판단이 빠르고 바깥으로 밀어붙이는 힘이 살아 있어, 결단이 필요한 순간에 주도권을 잡기 쉽습니다.",
    career: "일에서도 속도감 있게 결론을 내리고 움직이는 편이라, 현장을 돌리거나 의사결정을 빨리 해야 하는 역할에서 장점이 큽니다.",
    love: "연애에서는 마음이 생기면 비교적 분명하게 표현하는 편이고, 답답하게 끌기보다 관계의 방향을 확인하려는 성향이 있습니다.",
    relationships: "대인관계에서도 솔직하고 직선적인 편이라 말이 빠르고 시원하게 느껴질 수 있지만, 때로는 상대에게 압박으로 전달될 수 있습니다.",
    health: "몸으로는 과열과 과로가 누적되기 쉬우니, 쉬는 타이밍을 놓치지 않는 것이 중요합니다.",
  },
  yin: {
    innate: "팔자 전반에 음 기운이 비교적 강하면 겉보다 속이 섬세하고, 한 번 본 것을 오래 기억하며 분위기와 결을 읽는 힘이 좋은 편입니다.",
    career: "일에서는 깊게 파고들고 정교하게 다듬는 강점이 있어, 전문성이나 완성도가 중요한 영역에서 경쟁력이 살아납니다.",
    love: "연애에서는 마음이 생겨도 쉽게 다 드러내지 않고, 충분히 믿을 수 있는지 확인한 뒤 천천히 깊어지는 경향이 있습니다.",
    relationships: "인간관계에서도 상대의 말보다 태도와 분위기를 많이 읽는 편이라, 표면적으로는 부드러워도 내면에서는 분명한 선을 가지고 있습니다.",
    health: "감정을 안으로 쌓아두면 긴장, 수면, 소화 같은 리듬성 문제로 먼저 나타날 수 있어, 중간중간 풀어내는 습관이 중요합니다.",
  },
  balanced: {
    innate: "음양이 한쪽으로 크게 치우치지 않으면 생각과 행동의 간격이 비교적 안정적이어서, 상황에 따라 유연하게 태도를 조절하는 편입니다.",
    career: "일할 때도 밀어붙일 때와 살필 때의 균형을 잡는 감각이 있어, 단기 성과와 장기 운영을 함께 보는 데 강점이 있습니다.",
    love: "연애에서도 감정과 현실을 한쪽만 보지 않고 함께 보려는 균형감이 살아 있는 편입니다.",
    relationships: "대인관계에서는 지나치게 세지도 약하지도 않은 톤으로 신뢰를 쌓아 가는 스타일에 가깝습니다.",
    health: "생활 리듬만 크게 흔들리지 않으면 컨디션 회복력은 비교적 안정적으로 유지되기 쉬운 편입니다.",
  },
};

const SEASON_SENTENCES = {
  spring: {
    innate: "월지가 봄 기운에 걸려 있으면 기본 바탕에 시작 에너지와 성장 욕구가 실려 있어, 새로운 환경에서 비교적 빨리 적응하는 흐름이 있습니다.",
    career: "커리어에서도 새 프로젝트를 여는 역할, 판을 키우는 역할, 배워 가며 확장하는 역할에서 성과가 잘 붙는 편입니다.",
    love: "연애에서는 설렘과 가능성을 중요하게 보고, 관계가 앞으로 어떻게 자랄지를 유심히 보는 경향이 있습니다.",
    relationships: "사람들과도 처음에는 비교적 열린 태도로 다가가며, 함께 커질 수 있는 관계인지 보는 편입니다.",
    health: "다만 시작과 확장의 기운이 강한 만큼 무리하게 일정을 늘리면 피로가 한 번에 몰릴 수 있어 속도 조절이 필요합니다.",
  },
  summer: {
    innate: "월지가 여름 기운이면 에너지가 밖으로 드러나는 힘이 강해, 표현력과 추진력이 살아나는 대신 감정의 고저도 커질 수 있습니다.",
    career: "일에서는 속도, 실행, 존재감이 필요한 장면에서 장점이 살아나며, 성과가 눈에 보이는 환경에서 동기부여가 잘 되는 편입니다.",
    love: "연애에서는 온도감과 반응 속도를 중요하게 보기 때문에, 서로의 표현 방식이 잘 맞을수록 관계가 빠르게 깊어질 수 있습니다.",
    relationships: "대인관계에서도 먼저 분위기를 풀거나 주도권을 잡는 경우가 많지만, 에너지를 많이 쓰는 만큼 관계 피로를 늦게 알아차릴 수 있습니다.",
    health: "체온, 수면, 과로 관리가 특히 중요하며, 흥분 상태를 오래 끌지 않는 것이 컨디션 유지에 도움이 됩니다.",
  },
  autumn: {
    innate: "월지가 가을 기운이면 결과와 완성도에 대한 감각이 살아 있어, 감정보다 기준과 효율을 먼저 보는 장면이 많을 수 있습니다.",
    career: "커리어에서는 마감, 품질, 평가, 정리, 검토처럼 결과물을 다듬는 역할에서 실력이 또렷하게 드러나는 편입니다.",
    love: "연애에서도 사람을 천천히 선별하는 편이라 시작은 느릴 수 있지만, 한 번 관계가 잡히면 밀도는 높은 편입니다.",
    relationships: "사람들과의 관계에서도 가볍게 섞이기보다 믿을 만한 사람을 오래 두는 쪽에 가까울 수 있습니다.",
    health: "긴장과 건조함이 쌓이면 몸이 먼저 굳거나 예민해질 수 있어, 호흡과 회복 루틴을 챙기는 편이 좋습니다.",
  },
  winter: {
    innate: "월지가 겨울 기운이면 겉보다 안에서 생각을 오래 굴리는 힘이 강해, 판단 전 탐색과 관찰의 시간이 충분히 필요한 편입니다.",
    career: "일에서는 기획, 준비, 조사, 분석, 구조 파악처럼 보이지 않는 밑작업에서 실력이 강하게 드러납니다.",
    love: "연애에서는 빠른 전개보다 정서적 안정과 신뢰를 먼저 확인하려는 흐름이 강해, 관계가 천천히 깊어지는 편입니다.",
    relationships: "인간관계에서도 처음부터 활짝 열기보다 상대를 충분히 본 뒤 자리를 정하는 편이라, 가까워지면 오래 가는 경우가 많습니다.",
    health: "몸을 차게 두지 않는 것과 수면, 순환, 회복 시간을 안정적으로 확보하는 것이 특히 중요합니다.",
  },
};

const DAY_BRANCH_FLAVOR = {
  자: {
    innate: "일지가 자면 감각이 빠르고 주변 기류를 읽는 힘이 좋아, 조용해 보여도 상황 파악은 상당히 빠른 편입니다.",
    love: "연애에서는 미묘한 말투와 반응에도 민감하게 움직일 수 있어, 정서적으로 통하는 상대에게 강하게 끌릴 수 있습니다.",
    relationships: "사람들과의 소통에서는 분위기 감각이 좋지만 감정 소모가 쌓이면 갑자기 거리를 둘 수 있습니다.",
    health: "수면 리듬과 몸의 냉한 느낌을 오래 방치하지 않는 것이 좋습니다.",
  },
  축: {
    innate: "일지가 축이면 쉽게 흔들리기보다 시간을 두고 판단하는 성향이 강해, 한 번 정하면 오래 가는 안정감이 있습니다.",
    love: "연애에서는 신뢰가 쌓이기 전까지 속도를 늦추는 편이지만, 관계가 자리 잡으면 책임감 있게 지키려는 편입니다.",
    relationships: "인간관계에서도 천천히 가까워지는 대신 오래 가는 편이며, 말보다 행동으로 신뢰를 보여 주는 경우가 많습니다.",
    health: "몸이 무거워지는 신호를 무시하지 말고 소화와 순환을 꾸준히 관리하는 편이 좋습니다.",
  },
  인: {
    innate: "일지가 인이면 안쪽에 도전성과 개척성이 깔려 있어, 가만히 반복되는 흐름보다 움직이며 배우는 환경에서 강점이 살아납니다.",
    love: "연애에서도 생기가 있고 같이 움직일 수 있는 상대에게 끌리기 쉬우며, 답답한 관계에는 쉽게 지칠 수 있습니다.",
    relationships: "사람들과는 시원시원하게 가까워지지만, 지나친 간섭이나 느린 의사결정에는 답답함을 느낄 수 있습니다.",
    health: "활동량이 많은 편이라 무리한 일정과 근육 피로가 누적되지 않게 조절하는 것이 중요합니다.",
  },
  묘: {
    innate: "일지가 묘면 섬세한 감각과 취향 의식이 살아 있어, 말하지 않아도 분위기와 정서의 결을 잘 읽는 편입니다.",
    love: "연애에서는 감정선과 교감의 자연스러움이 중요해, 억지로 맞추는 관계에는 오래 머물기 어렵습니다.",
    relationships: "대인관계에서도 부드럽고 예의 있게 다가가지만, 정서적으로 거친 사람과는 금방 피로해질 수 있습니다.",
    health: "예민함이 쌓이면 눈 피로와 긴장성 피로로 연결되기 쉬워 휴식의 질을 챙기는 편이 좋습니다.",
  },
  진: {
    innate: "일지가 진이면 안쪽에 책임감과 중재 본능이 있어, 혼란한 상황에서도 정리점을 찾으려는 성향이 강한 편입니다.",
    love: "연애에서는 감정만 앞세우기보다 현실과 책임을 함께 보려는 편이라, 믿음직한 상대에게 마음이 갑니다.",
    relationships: "관계에서는 중심을 잡는 역할을 자주 맡게 되지만, 늘 중간에서 조율하다 보면 피로가 쌓일 수 있습니다.",
    health: "스트레스가 쌓이면 소화와 몸의 무거움으로 나타날 수 있어, 과한 책임을 혼자 떠안지 않는 것이 중요합니다.",
  },
  사: {
    innate: "일지가 사면 집중력과 감정의 온도가 한 번 올라갔을 때 매우 강해, 몰입과 승부근성이 두드러질 수 있습니다.",
    love: "연애에서는 끌림이 생기면 깊게 들어가지만, 애매한 태도나 반복되는 거리두기에는 예민하게 반응할 수 있습니다.",
    relationships: "사람들과의 소통에서는 빠른 이해와 판단이 장점이지만, 성급한 결론으로 보이지 않게 속도 조절이 필요합니다.",
    health: "과열, 수면 부족, 피로 누적 신호를 빨리 알아차리는 것이 좋습니다.",
  },
  오: {
    innate: "일지가 오면 자존감과 표현 욕구가 강해, 자신이 확신한 방향에서는 힘 있게 밀고 나가는 편입니다.",
    love: "연애에서는 관심과 애정을 분명히 주고받는 관계를 선호하며, 무반응이나 무심함에는 마음이 쉽게 식을 수 있습니다.",
    relationships: "대인관계에서도 존재감이 큰 편이라 사람을 모으는 힘이 있지만, 감정이 뜨거워질 때는 표현의 강도를 조절하는 편이 좋습니다.",
    health: "열이 위로 뜨거나 잠이 얕아지는 패턴을 방치하지 않는 것이 중요합니다.",
  },
  미: {
    innate: "일지가 미면 배려와 돌봄 감각이 섬세해, 주변 사람의 표정과 분위기를 꽤 세밀하게 읽는 편입니다.",
    love: "연애에서는 따뜻하고 현실적인 돌봄이 중요한 방식으로 나타나며, 상대를 챙기다 스스로 지치지 않게 균형을 잡는 것이 필요합니다.",
    relationships: "인간관계에서도 친절하고 유연하지만 부탁을 끊지 못하면 관계 피로가 누적되기 쉽습니다.",
    health: "소화와 붓기, 피로 누적 관리를 꾸준히 챙기는 편이 좋습니다.",
  },
  신: {
    innate: "일지가 신이면 머리 회전이 빠르고 상황 대응이 재치 있게 나와, 순간 판단과 실전 감각이 좋은 편입니다.",
    love: "연애에서는 대화의 센스와 지적 자극이 중요해, 말이 잘 통하는 사람에게 마음이 쉽게 가는 경향이 있습니다.",
    relationships: "사람들과는 유연하고 영리하게 소통하지만, 피상적인 관계가 길어지면 금방 흥미를 잃을 수 있습니다.",
    health: "신경성 피로와 수면 부족이 누적되지 않게 리듬을 관리하는 것이 중요합니다.",
  },
  유: {
    innate: "일지가 유면 안목과 기준이 살아 있어, 작아 보여도 어긋난 부분을 금방 알아차리는 편입니다.",
    love: "연애에서는 감정의 크기만큼 상대의 태도와 품격, 일관성도 중요하게 보는 경향이 있습니다.",
    relationships: "인간관계에서는 선별적이지만 한 번 신뢰가 생긴 사람과는 관계를 오래 정리해 가는 편입니다.",
    health: "호흡기, 피부, 긴장성 피로를 가볍게 넘기지 않는 편이 좋습니다.",
  },
  술: {
    innate: "일지가 술이면 기본적으로 의리와 원칙 의식이 강해, 쉽게 정을 주지 않아도 한 번 정하면 오래 가는 성향이 있습니다.",
    love: "연애에서는 진정성과 책임감을 중요하게 보기 때문에, 말보다 행동으로 믿음을 주는 사람에게 끌릴 수 있습니다.",
    relationships: "사람들과의 관계에서도 신뢰가 쌓인 뒤에는 오래 가지만, 원칙이 무너지는 장면에는 실망이 크게 남을 수 있습니다.",
    health: "몸의 긴장과 소화 부담, 누적 피로를 오래 끌지 않게 중간중간 풀어 주는 것이 좋습니다.",
  },
  해: {
    innate: "일지가 해면 감수성과 상상력이 깊어, 겉으로는 담담해 보여도 내면에서는 정서의 폭이 넓게 움직이는 편입니다.",
    love: "연애에서는 정서적 공감과 편안함이 매우 중요해, 마음이 쉬어 갈 수 있는 사람에게 깊게 빠지는 경향이 있습니다.",
    relationships: "인간관계에서도 공감 능력이 좋아 사람들을 잘 이해하지만, 그만큼 타인의 감정에 쉽게 소모될 수 있습니다.",
    health: "회복 시간과 혼자 쉬는 시간이 부족하면 컨디션 저하가 빠르게 올 수 있어 휴식 루틴이 중요합니다.",
  },
};

const DOMINANT_ELEMENT_SENTENCES = {
  목: {
    innate: "전체 팔자에서 목 기운이 도드라지면 성장 욕구와 이상 지향이 강해져, 현실에 안주하기보다 더 나은 방향을 계속 찾는 편입니다.",
    career: "이 흐름은 커리어에서 확장, 기획, 연결, 교육 같은 키워드를 더 강하게 밀어 주는 역할을 합니다.",
    love: "연애에서도 함께 자라고 배울 수 있는 관계를 선호하는 경향이 더 뚜렷해질 수 있습니다.",
    relationships: "사람들과의 관계에서는 서로를 북돋우는 관계에 힘이 실리고, 답답한 관계는 오래 끌기 어렵습니다.",
    health: "몸으로는 과도한 긴장과 근육 피로, 눈의 피로를 제때 풀어 주는 것이 중요합니다.",
  },
  화: {
    innate: "전체 팔자에서 화 기운이 강하면 존재감과 표현 에너지가 커져, 생각보다 행동과 반응이 먼저 나가는 장면이 많을 수 있습니다.",
    career: "커리어에서는 발표, 홍보, 영업, 리더십, 대외 커뮤니케이션 같은 전면 역할에 힘이 실릴 가능성이 큽니다.",
    love: "연애에서는 감정 표현이 분명해지고 관계의 온도 차이에 더 민감해질 수 있습니다.",
    relationships: "대인관계에서도 사람을 모으는 힘은 좋지만, 스스로 너무 오래 분위기를 책임지지 않게 조절하는 편이 좋습니다.",
    health: "체온, 수면, 심장 두근거림, 과열성 피로 관리가 핵심 포인트가 됩니다.",
  },
  토: {
    innate: "전체 팔자에서 토 기운이 강하면 현실 감각과 책임감이 두드러져, 주변에서 중심축 역할을 맡길 가능성이 큽니다.",
    career: "직업적으로는 운영, 관리, 재정리, 지원 체계를 세우는 일에서 더 안정적인 성과가 나기 쉽습니다.",
    love: "연애에서는 화려한 자극보다 생활의 안정감과 믿음직함을 훨씬 더 중요하게 보게 됩니다.",
    relationships: "사람들과의 관계에서도 기대를 많이 받는 대신, 부탁과 책임이 과하게 몰리지 않도록 선을 긋는 것이 중요합니다.",
    health: "몸으로는 위장, 체중, 붓기, 만성 피로 누적을 꾸준히 살피는 편이 좋습니다.",
  },
  금: {
    innate: "전체 팔자에서 금 기운이 두드러지면 판단력과 분별력이 강해져, 사람과 일의 기준을 명확히 세우는 힘이 커집니다.",
    career: "이 흐름은 품질, 검토, 분석, 법무, 재무, 기술 판단처럼 정확도가 중요한 분야와 잘 맞닿아 있습니다.",
    love: "연애에서는 감정보다 태도, 예의, 일관성을 보는 눈이 더 예리해질 수 있습니다.",
    relationships: "인간관계에서도 깔끔하고 선명한 소통을 선호해, 모호한 관계를 오래 견디지 않는 편일 수 있습니다.",
    health: "호흡기, 피부, 건조함, 긴장성 뭉침을 오래 끌지 않도록 관리하는 것이 좋습니다.",
  },
  수: {
    innate: "전체 팔자에서 수 기운이 강하면 직감과 관찰력이 깊어져, 겉으로 드러난 정보보다 흐름과 맥락을 읽는 힘이 커집니다.",
    career: "커리어에서는 조사, 전략, 상담, 데이터 해석, 기획처럼 보이지 않는 패턴을 읽는 일이 특히 잘 맞을 수 있습니다.",
    love: "연애에서는 감정의 깊이와 대화의 밀도를 중요하게 봐서, 겉만 화려한 관계에는 쉽게 정이 붙지 않을 수 있습니다.",
    relationships: "사람들과의 관계에서도 겉으로는 유연하지만, 실제로는 깊이 통하는 사람만 오래 두는 성향이 더 선명해질 수 있습니다.",
    health: "수면 리듬, 냉증, 순환, 체력 저하를 제때 관리하는 것이 중요합니다.",
  },
};

const WEAK_ELEMENT_SENTENCES = {
  목: {
    innate: "반대로 목 기운이 약한 편이면 시작할 때 머리로만 오래 굴리다가 타이밍을 놓칠 수 있어, 작은 실행으로 흐름을 여는 습관이 도움이 됩니다.",
    career: "직업적으로도 새로운 시도 앞에서 지나치게 안전만 보지 않도록, 배움과 실험의 비중을 의식적으로 늘리는 편이 좋습니다.",
    love: "연애에서는 관계의 가능성을 보기 전에 걱정부터 커질 수 있어, 지나친 경계심을 완화하는 연습이 필요할 수 있습니다.",
    relationships: "사람들과도 먼저 다가가는 힘이 약해 보일 수 있으니, 가벼운 표현과 반응을 조금 더 늘리면 관계가 부드러워집니다.",
    health: "몸으로는 뻣뻣함과 피로 누적을 풀어 줄 가벼운 움직임이 중요합니다.",
  },
  화: {
    innate: "화 기운이 약한 편이면 속생각에 비해 표현이 적어, 실제보다 조용하거나 의욕이 약해 보일 수 있습니다.",
    career: "일에서도 실력이 있어도 드러내는 힘이 약해질 수 있으니, 발표와 공유, 피드백 요청을 의식적으로 챙기면 유리합니다.",
    love: "연애에서는 마음이 있어도 신호가 약하게 전달될 수 있어, 감정 표현을 한 단계만 더 명확히 하는 것이 도움이 됩니다.",
    relationships: "대인관계에서도 먼저 온기를 보여 주는 표현을 조금 더 쓰면 오해가 줄어들 수 있습니다.",
    health: "체온 저하와 무기력, 리듬 저하를 오래 끌지 않도록 생활의 활력을 관리하는 편이 좋습니다.",
  },
  토: {
    innate: "토 기운이 약한 편이면 생각과 감정은 풍부해도 중심을 잡는 데 시간이 걸릴 수 있어, 스스로의 기준과 루틴을 만드는 것이 중요합니다.",
    career: "커리어에서도 구조화와 마무리 단계가 약해질 수 있으니, 일정 관리와 우선순위 정리를 도구로 보완하면 좋습니다.",
    love: "연애에서는 감정은 빠르게 움직여도 현실 감각이 뒤늦게 따라와 흔들릴 수 있어, 관계의 생활 리듬을 함께 보는 시선이 필요합니다.",
    relationships: "사람들과의 관계에서도 다 맞춰 주다 중심을 잃지 않게, 본인의 경계를 분명히 하는 연습이 도움이 됩니다.",
    health: "소화와 체력 저하, 생활 리듬 붕괴를 방치하지 않는 것이 중요합니다.",
  },
  금: {
    innate: "금 기운이 약한 편이면 기준을 세우는 데 시간이 걸리거나 우유부단하게 보일 수 있어, 선택의 기준을 미리 정해 두는 편이 도움이 됩니다.",
    career: "직업적으로도 정리와 검토가 뒤로 밀릴 수 있으니, 마감 기준과 체크리스트를 분명히 잡아 두는 것이 유리합니다.",
    love: "연애에서는 좋은 사람이어도 경계가 약해 상처를 쉽게 받을 수 있어, 신뢰를 확인하는 기준을 세워 두는 편이 좋습니다.",
    relationships: "인간관계에서도 거절과 선 긋기를 너무 늦게 하면 피로가 커질 수 있어, 불편한 지점을 말로 정리하는 힘이 필요합니다.",
    health: "호흡기, 피부, 피로 누적을 예민하게 살피고 회복 시간을 확보하는 편이 좋습니다.",
  },
  수: {
    innate: "수 기운이 약한 편이면 깊게 보기 전에 조급하게 결론을 내릴 수 있어, 관찰과 휴지부를 조금 더 늘리는 것이 도움이 됩니다.",
    career: "일에서도 리서치와 점검 없이 속도로만 밀어붙이면 실수가 생길 수 있어, 한 번 더 검토하는 습관이 중요합니다.",
    love: "연애에서는 마음의 깊이를 충분히 확인하기 전에 관계가 빨리 진행될 수 있으니, 정서적 호흡을 살피는 여유가 필요합니다.",
    relationships: "대인관계에서도 내면 정리가 부족하면 갑작스럽게 피곤해질 수 있어, 혼자 쉬는 시간을 의식적으로 확보하는 편이 좋습니다.",
    health: "수면과 순환, 체력 저하를 방치하지 않는 것이 컨디션 유지의 핵심이 됩니다.",
  },
};

const BALANCED_FLOW_SENTENCES = {
  innate: "오행 분포가 한쪽으로 심하게 기울지 않은 편이라 기질이 비교적 유연하게 발현되고, 상황에 따라 장점을 바꿔 쓰는 힘이 있습니다.",
  career: "일에서도 한 가지 방식만 고집하기보다 상황에 맞춰 속도와 깊이를 조절하는 능력이 강점이 될 수 있습니다.",
  love: "연애에서는 감정과 현실을 한쪽만 보지 않고 함께 보려는 균형감이 비교적 살아 있는 편입니다.",
  relationships: "사람을 대할 때도 밀고 당기는 폭이 과하지 않아 신뢰를 안정적으로 쌓기 좋은 구조입니다.",
  health: "특정 한 부분만 심하게 치우친 사주는 아니라, 기본 생활 리듬만 잘 맞춰도 회복력이 안정적으로 유지되기 쉬운 편입니다.",
};

const UNKNOWN_HOUR_SENTENCES = {
  innate: "다만 시주가 빠져 있어 후반부 성향과 잠재력에 관한 세부 해석은 보수적으로 반영했습니다.",
  career: "전문성의 방향이나 후반 커리어 변곡점은 태어난 시간이 확인되면 조금 더 세밀하게 보정할 수 있습니다.",
  love: "친밀한 관계에서만 드러나는 습관과 애정 표현 방식은 시주가 들어오면 해석이 더 구체해집니다.",
  relationships: "가까운 사람에게만 보이는 말투와 거리감은 실제와 약간 다를 수 있다는 점을 함께 참고하면 좋습니다.",
  health: "생활 리듬과 회복 패턴도 태어난 시간이 있으면 조금 더 촘촘하게 볼 수 있습니다.",
};

function createBuckets() {
  return Object.fromEntries(CATEGORY_KEYS.map((key) => [key, []]));
}

function normalizeSentence(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function pushSentenceMap(target, sentenceMap, { prepend = false } = {}) {
  if (!sentenceMap) return;

  for (const key of CATEGORY_KEYS) {
    const raw = sentenceMap[key];
    if (!raw) continue;

    const sentences = (Array.isArray(raw) ? raw : [raw]).map(normalizeSentence).filter(Boolean);
    if (!sentences.length) continue;

    target[key] = prepend ? [...sentences, ...target[key]] : [...target[key], ...sentences];
  }
}

function uniqueSentences(sentences) {
  const seen = new Set();
  const result = [];

  sentences.forEach((sentence) => {
    const normalized = normalizeSentence(sentence);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function getKnownGlyphs(pillars) {
  return ["year", "month", "day", "hour"].flatMap((pillarKey) => {
    const pillar = pillars[pillarKey];
    if (!pillar) return [];

    const glyphs = [];

    if (pillar.stem?.char && !pillar.stem.empty) {
      glyphs.push({
        type: "stem",
        char: pillar.stem.char,
        element: pillar.stem.element,
      });
    }

    if (pillar.branch?.char && !pillar.branch.empty) {
      glyphs.push({
        type: "branch",
        char: pillar.branch.char,
        element: pillar.branch.element,
      });
    }

    return glyphs;
  });
}

function countElements(glyphs) {
  const counts = Object.fromEntries(ELEMENTS.map((element) => [element, 0]));

  glyphs.forEach((glyph) => {
    if (glyph.element && counts[glyph.element] !== undefined) {
      counts[glyph.element] += 1;
    }
  });

  return counts;
}

function countYinYang(glyphs) {
  let yin = 0;
  let yang = 0;

  glyphs.forEach((glyph) => {
    const isYang = glyph.type === "stem" ? YANG_STEMS.has(glyph.char) : YANG_BRANCHES.has(glyph.char);
    if (isYang) {
      yang += 1;
    } else {
      yin += 1;
    }
  });

  return { yin, yang };
}

function getYinYangBias({ yin, yang }) {
  if (yang - yin >= 2) return "yang";
  if (yin - yang >= 2) return "yin";
  return "balanced";
}

function sortElementsByCount(counts, dayElement) {
  const priority = (element) => (element === dayElement ? -1 : ELEMENTS.indexOf(element));
  return [...ELEMENTS].sort((a, b) => counts[b] - counts[a] || priority(a) - priority(b));
}

function buildProfile(pillars, options = {}) {
  const glyphs = getKnownGlyphs(pillars);
  const elementCounts = countElements(glyphs);
  const yinYangCounts = countYinYang(glyphs);
  const dayElement = pillars.day.stem.element;
  const sortedElements = sortElementsByCount(elementCounts, dayElement);
  const maxCount = Math.max(...ELEMENTS.map((element) => elementCounts[element]));
  const minCount = Math.min(...ELEMENTS.map((element) => elementCounts[element]));
  const dominantElements = sortedElements.filter((element) => elementCounts[element] === maxCount && maxCount > 0);
  const missingElements = ELEMENTS.filter((element) => elementCounts[element] === 0);
  const weakestPool = missingElements.length
    ? missingElements
    : sortedElements.filter((element) => elementCounts[element] === minCount);

  const hourKnown = !options.unknownTime && !pillars.hour.stem.empty && !pillars.hour.branch.empty;

  return {
    gender: options.gender || "male",
    dayStem: pillars.day.stem.char,
    dayBranch: pillars.day.branch.char,
    dayElement,
    monthBranch: pillars.month.branch.char,
    season: MONTH_BRANCH_TO_SEASON[pillars.month.branch.char] || "spring",
    elementCounts,
    dominantElement: dominantElements[0] || dayElement,
    dominantElements,
    weakestElement: weakestPool[0] || dayElement,
    missingElements,
    yinYangBias: getYinYangBias(yinYangCounts),
    yinCount: yinYangCounts.yin,
    yangCount: yinYangCounts.yang,
    isElementBalanced: missingElements.length === 0 && maxCount - minCount <= 1,
    dayPillarKey: `${pillars.day.stem.char}${pillars.day.branch.char}`,
    hourKnown,
  };
}

function getManualSentences(profile) {
  const pillarDb = DAY_PILLAR_DB[profile.dayPillarKey];
  if (!pillarDb) return null;
  return pillarDb[profile.gender] || pillarDb.unisex || null;
}

function buildDayPillarArchetypeSentences(profile) {
  const info = DAY_PILLAR_ARCHETYPES[profile.dayPillarKey];
  if (!info) return null;

  return {
    innate: [
      `${profile.dayPillarKey}(${info.hanja}) 일주는 흔히 '${info.metaphor}'의 물상으로 비유합니다.`,
      "이 물상 한 줄은 일주의 기본 분위기와 성정의 결을 직관적으로 읽을 때 먼저 참고하는 표현입니다.",
    ],
  };
}

function buildBalanceSentences(profile) {
  if (profile.isElementBalanced) {
    return BALANCED_FLOW_SENTENCES;
  }

  const sentences = createBuckets();
  pushSentenceMap(sentences, DOMINANT_ELEMENT_SENTENCES[profile.dominantElement]);

  const weakKey = profile.missingElements[0] || profile.weakestElement;
  if (weakKey && weakKey !== profile.dominantElement) {
    pushSentenceMap(sentences, WEAK_ELEMENT_SENTENCES[weakKey]);
  }

  return sentences;
}

export function buildSajuReading(pillars, options = {}) {
  const profile = buildProfile(pillars, options);
  const sections = createBuckets();

  pushSentenceMap(sections, buildDayPillarArchetypeSentences(profile), { prepend: true });
  pushSentenceMap(sections, DAY_ELEMENT_BASE[profile.dayElement]);
  pushSentenceMap(sections, YIN_YANG_SENTENCES[profile.yinYangBias]);
  pushSentenceMap(sections, SEASON_SENTENCES[profile.season]);
  pushSentenceMap(sections, DAY_BRANCH_FLAVOR[profile.dayBranch]);
  pushSentenceMap(sections, buildBalanceSentences(profile));

  const manual = getManualSentences(profile);
  if (manual) {
    pushSentenceMap(sections, manual, { prepend: true });
  }

  if (!profile.hourKnown) {
    pushSentenceMap(sections, UNKNOWN_HOUR_SENTENCES);
  }

  return CATEGORY_CONFIG.map((category) => ({
    title: category.title,
    text: uniqueSentences(sections[category.key]).join(" "),
  }));
}
