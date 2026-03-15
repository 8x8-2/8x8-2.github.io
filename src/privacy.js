import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import { setupAuthUi } from "./shared/auth-ui.js";

initCommonPageTracking();
setupAuthUi();

trackEvent("privacy_view", {
  page_name: "privacy",
});
