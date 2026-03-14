import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import { setupAuthUi } from "./shared/auth-ui.js";

initCommonPageTracking();
setupAuthUi();

const pageName = document.body.dataset.souldayName || "";

trackEvent("soulday_view", {
  page_name: "soulday_view",
  day_pillar_name: pageName,
});

document.querySelectorAll("[data-soulday-home-link]").forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("soulday_homelink_click", {
      page_name: "soulday_view",
      day_pillar_name: pageName,
    });
  });
});
