import { normalizeProfileBio } from "./profile-text.js";

const SITE_URL = "https://stellar-id.com";

export const PROFILE_OG_IMAGE_URL = `${SITE_URL}/og-stellarid.png`;
export const PROFILE_OG_IMAGE_TYPE = "image/png";
export const PROFILE_OG_IMAGE_WIDTH = "1920";
export const PROFILE_OG_IMAGE_HEIGHT = "1080";
export const PROFILE_OG_IMAGE_ALT = "스텔라 프로필 공유 미리보기";
export const PROFILE_SITE_NAME = "스텔라 ID";
export const PROFILE_ROBOTS_CONTENT = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

function pickSnapshot(profile) {
  return profile?.public_snapshot || profile?.snapshot || null;
}

function textOrEmpty(value) {
  return String(value || "").trim();
}

function getSectionText(snapshot, index) {
  return textOrEmpty(snapshot?.sections?.[index]?.text);
}

function buildCurrentLuckSeoSummary(snapshot) {
  const currentMajor = snapshot?.advanced?.majorLuck?.current || snapshot?.advanced?.majorLuck?.items?.find((item) => item.isCurrent) || null;
  const currentYear = snapshot?.advanced?.yearLuck?.items?.find((item) => item.isCurrent) || snapshot?.advanced?.yearLuck?.items?.[0] || null;

  if (!currentMajor && !currentYear) return "";

  const labels = [
    currentMajor ? `${currentMajor.index}대운 ${currentMajor.pillarString}` : "",
    currentYear ? `${currentYear.year}년 ${currentYear.pillarString}` : "",
  ].filter(Boolean);
  const boosts = [...new Set([...(currentMajor?.boosts || []), ...(currentYear?.boosts || [])].filter(Boolean))].slice(0, 2);
  const cautions = [...new Set([...(currentMajor?.cautions || []), ...(currentYear?.cautions || [])].filter(Boolean))].slice(0, 2);
  const parts = [
    `현재는 ${labels.length > 1 ? `${labels[0]}과 ${labels[1]}` : labels[0]} 흐름이 중심이 되는 시기입니다.`,
  ];

  if (boosts.length) {
    parts.push(`도움이 되는 기운은 ${boosts.join(", ")}입니다.`);
  }

  if (cautions.length) {
    parts.push(`주의할 기운은 ${cautions.join(", ")}입니다.`);
  }

  return parts.join(" ");
}

function resolvePublicSummary(profile, key) {
  const snapshot = pickSnapshot(profile);

  switch (key) {
    case "personality":
      return textOrEmpty(profile?.personality_summary) || getSectionText(snapshot, 0) || textOrEmpty(profile?.preview_summary);
    case "ability":
      return textOrEmpty(profile?.ability_summary) || getSectionText(snapshot, 1) || textOrEmpty(snapshot?.advanced?.wealth?.summary);
    case "love":
      return textOrEmpty(profile?.love_summary) || getSectionText(snapshot, 2);
    case "health":
      return textOrEmpty(profile?.health_summary) || getSectionText(snapshot, 4);
    case "majorLuck":
      return textOrEmpty(profile?.major_luck_summary) || buildCurrentLuckSeoSummary(snapshot);
    default:
      return "";
  }
}

export function buildProfileCanonicalPath(stellarId) {
  return `/profile/${encodeURIComponent(String(stellarId || ""))}`;
}

export function buildProfileCanonicalUrl(stellarId) {
  return `${SITE_URL}${buildProfileCanonicalPath(stellarId)}`;
}

export function buildProfileSeoData(profile) {
  const name = textOrEmpty(profile?.full_name) || "스텔라 사용자";
  const stellarId = textOrEmpty(profile?.stellar_id);
  const canonicalUrl = buildProfileCanonicalUrl(stellarId);

  return {
    name,
    stellarId,
    title: `${name}님의 스텔라 프로필 | 스텔라 ID ${stellarId}`,
    pageTitle: `${name}님의 스텔라 프로필 | 스텔라 ID ${stellarId} · 사주 성향·궁합 프로필`,
    metaDescription: `${name}님의 사주 기반 스텔라 프로필을 확인하세요. 태양과 달의 흐름을 바탕으로 성향, 운의 흐름, 고유 ID를 담은 프로필을 무료로 만들고 협업·애정 궁합도 살펴볼 수 있습니다.`,
    socialDescription: `${name}님의 사주 기반 성향 프로필과 고유 ID를 확인해보세요. 협업·애정 궁합도 함께 살펴볼 수 있습니다.`,
    twitterDescription: `${name}님의 사주 기반 성향 프로필과 고유 ID를 확인해보세요.`,
    canonicalPath: buildProfileCanonicalPath(stellarId),
    canonicalUrl,
    robots: PROFILE_ROBOTS_CONTENT,
    imageUrl: PROFILE_OG_IMAGE_URL,
    imageAlt: PROFILE_OG_IMAGE_ALT,
  };
}

export function getProfileSeoSections(profile) {
  const sections = [];
  const bio = textOrEmpty(normalizeProfileBio(profile?.bio));

  if (bio) {
    sections.push({
      title: "프로필 소개",
      text: bio,
    });
  }

  [
    ["personality_visibility", "personality", "성격"],
    ["ability_visibility", "ability", "능력"],
    ["love_visibility", "love", "연애"],
    ["health_visibility", "health", "건강"],
    ["major_luck_visibility", "majorLuck", "대세운"],
  ].forEach(([visibilityKey, summaryKey, title]) => {
    if (profile?.[visibilityKey] !== "public") return;
    const text = resolvePublicSummary(profile, summaryKey);
    if (!text) return;

    sections.push({
      title,
      text,
    });
  });

  return sections;
}

export function buildProfileStructuredData(profile) {
  const seo = buildProfileSeoData(profile);
  const sections = getProfileSeoSections(profile);
  const description = sections.map((item) => `${item.title}: ${item.text}`).join(" ").trim() || seo.metaDescription;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: PROFILE_SITE_NAME,
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `${seo.name}님의 스텔라 프로필`,
            item: seo.canonicalUrl,
          },
        ],
      },
      {
        "@type": "ProfilePage",
        name: seo.title,
        url: seo.canonicalUrl,
        description: seo.metaDescription,
        inLanguage: "ko-KR",
        about: {
          "@type": "Person",
          name: seo.name,
          identifier: `Stellar ID ${seo.stellarId}`,
          description,
          image: seo.imageUrl,
          url: seo.canonicalUrl,
        },
      },
    ],
  };
}

function setMetaTag(attributeName, key, content) {
  let node = document.head.querySelector(`meta[${attributeName}="${key}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attributeName, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function setCanonicalLink(href) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

export function applyProfileSeoToDocument(profile) {
  if (typeof document === "undefined") {
    return buildProfileSeoData(profile);
  }

  const seo = buildProfileSeoData(profile);

  document.title = seo.title;
  setMetaTag("name", "description", seo.metaDescription);
  setMetaTag("name", "robots", seo.robots);
  setCanonicalLink(seo.canonicalUrl);
  setMetaTag("property", "og:type", "profile");
  setMetaTag("property", "og:title", seo.title);
  setMetaTag("property", "og:description", seo.socialDescription);
  setMetaTag("property", "og:url", seo.canonicalUrl);
  setMetaTag("property", "og:site_name", PROFILE_SITE_NAME);
  setMetaTag("property", "og:locale", "ko_KR");
  setMetaTag("property", "og:image", seo.imageUrl);
  setMetaTag("property", "og:image:secure_url", seo.imageUrl);
  setMetaTag("property", "og:image:type", PROFILE_OG_IMAGE_TYPE);
  setMetaTag("property", "og:image:width", PROFILE_OG_IMAGE_WIDTH);
  setMetaTag("property", "og:image:height", PROFILE_OG_IMAGE_HEIGHT);
  setMetaTag("property", "og:image:alt", seo.imageAlt);
  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", seo.title);
  setMetaTag("name", "twitter:description", seo.twitterDescription);
  setMetaTag("name", "twitter:image", seo.imageUrl);
  setMetaTag("name", "twitter:image:alt", seo.imageAlt);

  let structuredDataNode = document.getElementById("profileStructuredData");
  if (!structuredDataNode) {
    structuredDataNode = document.createElement("script");
    structuredDataNode.type = "application/ld+json";
    structuredDataNode.id = "profileStructuredData";
    document.head.appendChild(structuredDataNode);
  }
  structuredDataNode.textContent = JSON.stringify(buildProfileStructuredData(profile));

  return seo;
}
