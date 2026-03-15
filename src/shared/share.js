import { showToast } from "./ui.js";

export function buildShareUrl(token, sharePath = document.body.dataset.linkShare || "./share/") {
  const url = new URL(sharePath, window.location.href);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildReadingSharePayload({ entryName, dayPillarKey, summary, url }) {
  const cleanName = String(entryName || "사주 결과").trim() || "사주 결과";
  const cleanDayPillar = String(dayPillarKey || "").trim();
  const cleanSummary = String(summary || "").trim();

  return {
    title: cleanDayPillar ? `${cleanName} · ${cleanDayPillar} 일주` : cleanName,
    text: cleanSummary
      ? `${cleanName} 사주 결과를 공유했어요.\n${cleanSummary}`
      : `${cleanName} 사주 결과를 공유했어요.`,
    url,
  };
}

function buildShareBody(text, url) {
  const parts = [String(text || "").trim()];
  const cleanUrl = String(url || "").trim();

  if (cleanUrl && !parts.some((part) => part.includes(cleanUrl))) {
    parts.push(cleanUrl);
  }

  return parts.filter(Boolean).join("\n");
}

export async function shareLink({ title, text, url }) {
  const shareBody = buildShareBody(text, url);

  if (navigator.share) {
    try {
      await navigator.share({ title, text: shareBody, url });
      return { mode: "native", cancelled: false };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { mode: "native", cancelled: true };
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareBody || url);
    showToast("공유 링크가 복사되었습니다.");
    return { mode: "clipboard", cancelled: false };
  }

  window.prompt("이 링크를 복사해 공유해 주세요.", shareBody || url);
  return { mode: "prompt", cancelled: false };
}
