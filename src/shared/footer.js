function getFooterCurrentTarget(target) {
  const explicitTarget = String(target?.dataset?.footerCurrent || "").trim();
  if (explicitTarget) {
    return explicitTarget;
  }

  const pageNameTarget = String(document.body?.dataset?.pageName || "").trim();
  if (pageNameTarget) {
    return pageNameTarget;
  }

  const path = String(window.location.pathname || "");
  if (path === "/privacy/" || path.endsWith("/privacy/index.html")) {
    return "privacy";
  }

  return "";
}

function buildFooterLinkMarkup({ href, label, key, currentTarget }) {
  const isCurrent = currentTarget === key;
  return `<a href="${href}" data-footer-link="${key}"${isCurrent ? ' aria-current="page"' : ""}>${label}</a>`;
}

export function buildSiteFooterMarkup(currentTarget = "") {
  const currentYear = new Date().getFullYear();

  return `
    <small class="footer-meta">
      <span>&copy; ${currentYear}.</span>
      ${buildFooterLinkMarkup({
        href: "https://themercenary.org",
        label: "The Mercenary",
        key: "mercenary",
        currentTarget,
      })}
      <span class="footer-divider" aria-hidden="true">&middot;</span>
      ${buildFooterLinkMarkup({
        href: "/privacy/",
        label: "개인정보처리방침",
        key: "privacy",
        currentTarget,
      })}
    </small>
  `.trim();
}

export function renderSiteFooter(root = document) {
  if (typeof document === "undefined") return;

  root.querySelectorAll("[data-site-footer]").forEach((target) => {
    target.innerHTML = buildSiteFooterMarkup(getFooterCurrentTarget(target));
  });
}
