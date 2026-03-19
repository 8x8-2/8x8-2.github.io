import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAllDayPillarEntries } from "../data/daypillars.js";
import {
  PROFILE_OG_IMAGE_URL,
  PROFILE_OG_IMAGE_ALT,
  PROFILE_OG_IMAGE_HEIGHT,
  PROFILE_OG_IMAGE_TYPE,
  PROFILE_OG_IMAGE_WIDTH,
  PROFILE_SITE_NAME,
  buildProfileCanonicalPath,
  buildProfileSeoData,
  buildProfileStructuredData,
  getProfileSeoSections,
} from "../src/shared/profile-seo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PROFILE_DIR = path.join(ROOT_DIR, "profile");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SITE_URL = "https://stellar-id.com";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

function resolveEnv() {
  return {
    ...loadEnvFile(path.join(ROOT_DIR, ".env")),
    ...loadEnvFile(path.join(ROOT_DIR, ".env.local")),
    ...process.env,
  };
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

function buildHead(profile) {
  const seo = buildProfileSeoData(profile);
  const jsonLd = buildProfileStructuredData(profile);

  return `
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#111314" />
      <link rel="icon" href="/favicon-stellarid.png" sizes="any" />
      <link rel="apple-touch-icon" sizes="180x180" href="/favicon-stellarid.png" />
      <title>${escapeHtml(seo.title)}</title>
      <meta name="description" content="${escapeHtml(seo.metaDescription)}" />
      <meta name="robots" content="${escapeHtml(seo.robots)}" />
      <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />
      <meta property="og:type" content="profile" />
      <meta property="og:title" content="${escapeHtml(seo.title)}" />
      <meta property="og:description" content="${escapeHtml(seo.socialDescription)}" />
      <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />
      <meta property="og:site_name" content="${escapeHtml(PROFILE_SITE_NAME)}" />
      <meta property="og:locale" content="ko_KR" />
      <meta property="og:image" content="${escapeHtml(PROFILE_OG_IMAGE_URL)}" />
      <meta property="og:image:secure_url" content="${escapeHtml(PROFILE_OG_IMAGE_URL)}" />
      <meta property="og:image:type" content="${escapeHtml(PROFILE_OG_IMAGE_TYPE)}" />
      <meta property="og:image:width" content="${escapeHtml(PROFILE_OG_IMAGE_WIDTH)}" />
      <meta property="og:image:height" content="${escapeHtml(PROFILE_OG_IMAGE_HEIGHT)}" />
      <meta property="og:image:alt" content="${escapeHtml(PROFILE_OG_IMAGE_ALT)}" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
      <meta name="twitter:description" content="${escapeHtml(seo.twitterDescription)}" />
      <meta name="twitter:image" content="${escapeHtml(PROFILE_OG_IMAGE_URL)}" />
      <meta name="twitter:image:alt" content="${escapeHtml(PROFILE_OG_IMAGE_ALT)}" />
      <link rel="stylesheet" href="/styles.css" />
      ${buildAnalyticsSnippet({ title: seo.title, canonicalPath: seo.canonicalPath })}
      <script type="application/ld+json" id="profileStructuredData">${JSON.stringify(jsonLd)}</script>
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

function formatGenderLabel(gender) {
  return {
    male: "남성",
    female: "여성",
  }[gender] || "프로필";
}

function renderStaticAvatar(profile) {
  if (profile.profile_image_url) {
    return `<img src="${escapeHtml(profile.profile_image_url)}" alt="" />`;
  }

  return `<span>${escapeHtml(String(profile.full_name || "스").charAt(0))}</span>`;
}

function buildStaticProfileTagMarkup(profile) {
  const genderLabel = profile.gender ? formatGenderLabel(profile.gender) : "";
  const chips = [
    {
      label: profile.day_pillar_key ? `${profile.day_pillar_key} 일주` : "",
      tone: "good",
    },
    {
      label: genderLabel,
      tone: "neutral",
    },
    {
      label: profile.mbti || "",
      tone: "neutral",
    },
  ].filter((chip) => chip.label);

  if (!chips.length) {
    return "";
  }

  return `
    <div class="profile-tag-row">
      ${chips.map((chip) => `
        <span class="impact-chip impact-chip-${chip.tone}">${escapeHtml(chip.label)}</span>
      `).join("")}
    </div>
  `.trim();
}

function buildStaticProfileMetaMarkup(profile, seo) {
  const normalizedBio = profile.bio || seo.metaDescription || "";

  if (!normalizedBio) {
    return "";
  }

  return `
    <div class="profile-meta-stack">
      <p class="profile-bio">${escapeHtml(normalizedBio)}</p>
    </div>
  `.trim();
}

function buildFallbackSection(profile) {
  const seo = buildProfileSeoData(profile);
  const sections = getProfileSeoSections(profile);

  return `
    <section id="profileSeoFallback" class="card">
      <p class="eyebrow">스텔라 프로필</p>
      <div class="profile-fallback-hero">
        <div class="profile-hero-main">
          <div class="profile-avatar profile-avatar-large">
            ${renderStaticAvatar(profile)}
          </div>
          <div class="profile-fallback-copy">
            <div class="profile-id-caption">#${escapeHtml(String(profile.stellar_id || ""))}</div>
            <h1>${escapeHtml(profile.full_name || seo.pageTitle)}</h1>
          </div>
        </div>
        <p class="hero-subtitle">${escapeHtml(seo.metaDescription)}</p>
        ${buildStaticProfileTagMarkup(profile)}
        ${buildStaticProfileMetaMarkup(profile, seo)}
      </div>
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
        : `
          <article class="box profile-summary-card">
            <div class="title">스텔라 프로필</div>
            <div class="text">${escapeHtml(profile.preview_summary || seo.metaDescription)}</div>
          </article>
        `
      }
    </section>
  `.trim();
}

function buildProfilePage(profile) {
  return `
<!doctype html>
<html lang="ko">
  ${buildHead(profile)}
  <body
    data-page-name="public_profile"
    data-link-home="../../"
    data-link-signin="../../signin/"
    data-link-signup="../../signup/"
    data-link-search="../../search/"
    data-link-public-profile="../"
    data-link-saved="../../saved/"
    data-link-account="../../p/"
    data-link-profile-settings="../../profile-settings/"
  >
    ${buildTopbar()}
    <main class="container profile-page-shell">
      <section id="profilePageError" class="card hidden"></section>

      <section id="profileLoading" class="card hero-card">
        <p class="eyebrow">스텔라 프로필</p>
        <h1>스텔라 프로필을 불러오는 중입니다</h1>
        <p class="hero-subtitle">잠시만 기다려 주세요.</p>
      </section>

      ${buildFallbackSection(profile)}

      <section id="profileHero" class="card hidden" aria-labelledby="profileNameHeading">
        <div id="profileHeroInner"></div>
      </section>

      <section id="profileTabsSection" class="card hidden profile-tabs-card">
        <div id="profileTabs" class="profile-tab-strip" role="tablist" aria-label="스텔라 프로필 탭"></div>
      </section>

      <section id="profileContent" class="stack hidden"></section>

      ${buildFooter()}
    </main>

    <script type="module" src="/src/public-profile.js"></script>
  </body>
</html>
  `.trim();
}

async function fetchSeoProfiles() {
  const env = resolveEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[generate-profile-pages] Missing Supabase env vars; skipping profile page generation.");
    return null;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_profiles_for_seo`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    console.warn(`[generate-profile-pages] Failed to fetch SEO profiles: ${response.status} ${response.statusText} ${await response.text()}`);
    return null;
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function clearGeneratedProfilePages() {
  if (!fs.existsSync(PROFILE_DIR)) return;

  fs.readdirSync(PROFILE_DIR, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) return;
    if (!/^\d{1,16}$/.test(entry.name)) return;
    fs.rmSync(path.join(PROFILE_DIR, entry.name), { recursive: true, force: true });
  });
}

function writeProfilePages(profiles) {
  clearGeneratedProfilePages();

  profiles.forEach((profile) => {
    const targetDir = path.join(PROFILE_DIR, String(profile.stellar_id));
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "index.html"), buildProfilePage(profile));
  });
}

function buildSitemapEntries(profiles) {
  const today = new Date().toISOString();
  const coreEntries = [
    { path: "/", lastmod: today },
    { path: "/privacy/", lastmod: today },
    { path: "/soulday/", lastmod: today },
    ...getAllDayPillarEntries().map((entry) => ({
      path: `/soulday/${entry.slug}/`,
      lastmod: today,
    })),
  ];

  const profileEntries = profiles.map((profile) => ({
    path: buildProfileCanonicalPath(profile.stellar_id),
    lastmod: profile.updated_at ? new Date(profile.updated_at).toISOString() : today,
  }));

  return [...coreEntries, ...profileEntries];
}

function writeSeoFiles(profiles) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const sitemapEntries = buildSitemapEntries(profiles);
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((entry) => `  <url>\n    <loc>${SITE_URL}${entry.path}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n  </url>`).join("\n")}\n</urlset>\n`;
  const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /p/\nDisallow: /saved/\nDisallow: /my-saju/\nDisallow: /reading/\nDisallow: /share/\nSitemap: ${SITE_URL}/sitemap.xml\n`;

  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), sitemapXml);
  fs.writeFileSync(path.join(PUBLIC_DIR, "robots.txt"), robotsTxt);
}

const profiles = await fetchSeoProfiles();

if (profiles) {
  writeProfilePages(profiles);
}

writeSeoFiles(profiles || []);
