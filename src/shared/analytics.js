export function trackEvent(name, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, {
    transport_type: "beacon",
    ...params,
  });
}

let commonTrackingBound = false;

export function initCommonPageTracking() {
  if (typeof document === "undefined" || commonTrackingBound) return;
  commonTrackingBound = true;

  document.addEventListener("click", (event) => {
    const navLink = event.target.closest("[data-nav-target]");
    if (navLink) {
      trackEvent("nav_menu_click", {
        nav_target: navLink.dataset.navTarget || "",
      });
    }

    const footerLink = event.target.closest("[data-footer-link]");
    if (footerLink) {
      trackEvent("footer_link_click", {
        footer_target: footerLink.dataset.footerLink || "",
      });
    }
  });
}
