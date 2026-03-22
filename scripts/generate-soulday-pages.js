import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAllDayPillarEntries } from "../data/daypillars.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "soulday");
const SITE_URL = "https://stellar-id.com";
const OG_IMAGE = `${SITE_URL}/og-stellarid-url.png`;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAnalyticsSnippet({ title, canonicalPath }) {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-RQ5VKHW9NE"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", "G-RQ5VKHW9NE", {
        page_title: ${JSON.stringify(title)},
        page_path: ${JSON.stringify(canonicalPath)},
        page_location: ${JSON.stringify(canonicalUrl)}
      });
    </script>
  `.trim();
}

function buildHead({ title, description, canonicalPath, jsonLd }) {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  return `
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <meta name="theme-color" content="#111314" />
      <link rel="icon" href="/src/img/bi/favicon-stellarid.png" sizes="any">
      <link rel="apple-touch-icon" sizes="180x180" href="/src/img/bi/favicon-stellarid.png">
      <link rel="manifest" href="/src/img/bi/favicon-stellarid.png">
      <title>${escapeHtml(title)}</title>
      <link rel="stylesheet" href="/styles.css" />
      <meta name="description" content="${escapeHtml(description)}">
      <meta name="robots" content="index,follow,max-image-preview:large">
      <link rel="canonical" href="${canonicalUrl}">
      <meta name="author" content="C.B. Lee">
      <meta name="publisher" content="The Mercenary">
      <meta property="og:title" content="${escapeHtml(title)}">
      <meta property="og:description" content="${escapeHtml(description)}">
      <meta property="og:image" content="${OG_IMAGE}">
      <meta property="og:image:secure_url" content="${OG_IMAGE}">
      <meta property="og:image:type" content="image/png">
      <meta property="og:image:width" content="1920">
      <meta property="og:image:height" content="1080">
      <meta property="og:image:alt" content="스텔라 ID 일주별 페이지">
      <meta property="og:url" content="${canonicalUrl}">
      <meta property="og:type" content="website">
      <meta property="og:site_name" content="스텔라 ID">
      <meta property="og:locale" content="ko_KR">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${escapeHtml(title)}">
      <meta name="twitter:description" content="${escapeHtml(description)}">
      <meta name="twitter:image" content="${OG_IMAGE}">
      <meta name="twitter:image:alt" content="스텔라 ID 일주별 페이지">
      ${buildAnalyticsSnippet({ title, canonicalPath })}
      <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    </head>
  `.trim();
}

function buildTopbar() {
  return `
    <header class="social-header-shell">
      <div class="container">
        <div data-social-nav></div>
      </div>
    </header>
  `.trim();
}

function buildFooter() {
  return '<footer class="muted footer" data-site-footer></footer>';
}

function buildKeywordChips(items = []) {
  return items
    .map((item) => `<span class="impact-chip impact-chip-neutral">${escapeHtml(item)}</span>`)
    .join("");
}

function buildMbtiChips(items = []) {
  return items
    .map((item) => `<span class="impact-chip impact-chip-good">${escapeHtml(item)}</span>`)
    .join("");
}

function buildListCard(entry) {
  const searchText = [
    entry.key,
    entry.hanja,
    entry.metaphor,
    entry.overview,
    ...(entry.keywords || []),
    ...(entry.mbti || []),
  ]
    .join(" ")
    .toLowerCase();

  return `
    <a
      class="soulday-link-card"
      href="./${entry.slug}/"
      data-soulday-card
      data-soulday-name="${escapeHtml(entry.title)}"
      data-search="${escapeHtml(searchText)}"
      data-element="${entry.elementClass}"
    >
      <span class="soulday-link-watermark" aria-hidden="true">${escapeHtml(entry.hanja)}</span>
      <span class="soulday-link-title">${escapeHtml(entry.title)}</span>
      <span class="soulday-link-subtext">${escapeHtml(entry.metaphor)}</span>
    </a>
  `.trim();
}

function buildListJsonLd(entries) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "60일주별 특징 모음",
    url: `${SITE_URL}/soulday/`,
    description: "갑자일부터 계해일까지 60일주 물상과 특징을 정리하고 무료 사주와 스텔라 프로필 해석에 참고할 수 있는 스텔라 ID 일주 아카이브 페이지",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: entries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: entry.title,
        url: `${SITE_URL}/soulday/${entry.slug}/`,
      })),
    },
  };
}

function buildDetailJsonLd(entry) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "스텔라 ID",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "일주별 보기",
            item: `${SITE_URL}/soulday/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: entry.title,
            item: `${SITE_URL}/soulday/${entry.slug}/`,
          },
        ],
      },
      {
        "@type": "WebPage",
        name: `${entry.title} 특징`,
        url: `${SITE_URL}/soulday/${entry.slug}/`,
        description: `${entry.title} 물상과 타고난 성격, 자주 떠올리는 MBTI를 정리하고 무료 사주와 스텔라 프로필 해석에 참고할 수 있는 페이지`,
      },
    ],
  };
}

function buildListPage(entries) {
  const title = "일주별 보기 | 60일주 물상과 특징 모음 - 스텔라 ID";
  const description = "갑자일부터 계해일까지 60일주 물상, 키워드, 성격 개요를 한눈에 찾고 무료 사주와 스텔라 프로필 해석에 참고할 수 있는 스텔라 ID 일주 아카이브 페이지";

  return `
<!doctype html>
<html lang="ko">
  ${buildHead({
    title,
    description,
    canonicalPath: "/soulday/",
    jsonLd: buildListJsonLd(entries),
  })}
  <body
    data-page-name="soulday_list"
    data-link-home="../"
    data-link-soulday="./"
    data-link-signin="../signin/"
    data-link-signup="../signup/"
    data-link-saved="../saved/"
  >
    ${buildTopbar()}
    <main class="container">
      <section class="card hero-card" aria-labelledby="soulday-list-heading">
        <p class="eyebrow">일주별 보기 · 60일주 아카이브 · 물상 해석</p>
        <h1 id="soulday-list-heading">60일주별 특징 모음</h1>
        <p class="hero-subtitle">갑자일부터 계해일까지, 각 일주의 물상과 기본 성향을 스텔라 프로필 관점에서 빠르게 찾아볼 수 있게 정리했습니다.</p>
        <p class="hero-lead">목록에서 일주명이나 물상 키워드를 검색하면 바로 걸러지고, 각 카드로 들어가면 해당 일주가 내 성향과 어떤 결을 가지는지 더 자세히 볼 수 있습니다.</p>
      </section>

      <section class="card" aria-labelledby="soulday-search-heading">
        <div class="section-intro">
          <h2 id="soulday-search-heading">일주 목록 검색</h2>
          <p class="muted">일주명, 한자, 물상, 키워드로 바로 찾을 수 있습니다.</p>
        </div>
        <div class="soulday-search-row">
          <input id="souldaySearch" class="soulday-search-input" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="예: 갑자, 술잔, 장미, 임신" aria-label="일주 목록 검색" />
          <span id="souldayCount" class="muted soulday-count">${entries.length}개 일주</span>
        </div>
        <div class="soulday-grid">
          ${entries.map(buildListCard).join("\n")}
        </div>
        <div id="souldayEmpty" class="box hidden soulday-empty">
          <div class="title">검색 결과가 없습니다</div>
          <div class="text">검색어를 조금 바꾸거나, 한글 일주명으로 다시 찾아보세요.</div>
        </div>
      </section>

      <section class="card soulday-cta-card">
        <div class="section-intro">
          <h2>내 스텔라 프로필 보기</h2>
          <p class="muted">일주 목록을 본 뒤 실제 내 생년월일시 기준 스텔라 프로필이 궁금하다면 홈에서 바로 계산해 볼 수 있습니다.</p>
        </div>
        <div class="actions">
          <a class="cta-link-button" href="../" data-soulday-home-link>내 스텔라 프로필 보기</a>
        </div>
      </section>

      ${buildFooter()}
    </main>

    <script type="module" src="/src/soulday-list.js"></script>
  </body>
</html>
  `.trim();
}

function buildDetailPage(entry) {
  const title = `${entry.title} 특징 | 물상, 성격, MBTI - 스텔라 ID`;
  const description = `${entry.title} 물상은 '${entry.metaphor}'로 비유합니다. 타고난 성격과 자주 떠올리는 MBTI를 정리하고 무료 사주와 스텔라 프로필 해석에 참고할 수 있는 스텔라 ID 일주 상세 페이지`;

  return `
<!doctype html>
<html lang="ko">
  ${buildHead({
    title,
    description,
    canonicalPath: `/soulday/${entry.slug}/`,
    jsonLd: buildDetailJsonLd(entry),
  })}
  <body
    data-page-name="soulday_detail"
    data-soulday-name="${escapeHtml(entry.title)}"
    data-link-home="../../"
    data-link-soulday="../"
    data-link-signin="../../signin/"
    data-link-signup="../../signup/"
    data-link-saved="../../saved/"
  >
    ${buildTopbar()}
    <main class="container">
      <section class="card hero-card soulday-hero-card" data-element="${entry.elementClass}" aria-labelledby="soulday-detail-heading">
        <p class="eyebrow">일주별 특징 · 물상 해석</p>
        <h1 id="soulday-detail-heading">${escapeHtml(entry.title)} 특징</h1>
        <p class="hero-subtitle">${escapeHtml(entry.hanja)} · ${escapeHtml(entry.metaphor)}</p>
        <div class="impact-pills day-pillar-keywords">${buildKeywordChips(entry.keywords)}</div>
        <p class="hero-lead">${escapeHtml(entry.overview)}</p>
      </section>

      <section class="card">
        <div class="section-intro">
          <h2>타고난 본성</h2>
          <p class="muted">물상 비유를 쉬운 말로 풀어 쓴 이해용 성격 개요입니다.</p>
        </div>
        <div class="box soulday-detail-box">
          <div class="text">${escapeHtml(entry.overview)}</div>
          <div class="text">${escapeHtml(entry.essence)}</div>
        </div>
      </section>

      <section class="card">
        <div class="section-intro">
          <h2>자주 떠올리는 MBTI</h2>
          <p class="muted">명리학의 공식 분류는 아니고, 성향 감각을 쉽게 잡기 위한 참고 비유입니다.</p>
        </div>
        <div class="impact-pills soulday-mbti-row">${buildMbtiChips(entry.mbti)}</div>
      </section>

      <section class="card soulday-cta-card">
        <div class="section-intro">
          <h2>내 스텔라 프로필 보기</h2>
          <p class="muted">${escapeHtml(entry.title)}가 실제 내 스텔라 프로필 결과와 어떻게 겹치는지 궁금하다면, 홈에서 생년월일시를 입력해 바로 확인해 보세요.</p>
        </div>
        <div class="actions">
          <a class="cta-link-button" href="../../" data-soulday-home-link>내 스텔라 프로필 보기</a>
          <a class="text-link-button" href="../">다른 일주 더 보기</a>
        </div>
      </section>

      ${buildFooter()}
    </main>

    <script type="module" src="/src/soulday-detail.js"></script>
  </body>
</html>
  `.trim();
}

function writeFile(relativePath, content) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function main() {
  const entries = getAllDayPillarEntries();

  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  writeFile("soulday/index.html", buildListPage(entries));

  entries.forEach((entry) => {
    writeFile(`soulday/${entry.slug}/index.html`, buildDetailPage(entry));
  });
}

main();
