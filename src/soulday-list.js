import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import { setupAuthUi } from "./shared/auth-ui.js";

initCommonPageTracking();
setupAuthUi();
trackEvent("soulday_list_view", {
  page_name: "soulday_list",
});

const searchInput = document.getElementById("souldaySearch");
const countEl = document.getElementById("souldayCount");
const emptyEl = document.getElementById("souldayEmpty");
const cards = Array.from(document.querySelectorAll("[data-soulday-card]"));

function updateListView() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach((card) => {
    const haystack = card.dataset.search || "";
    const visible = !query || haystack.includes(query);
    card.classList.toggle("is-hidden", !visible);
    card.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) visibleCount += 1;
  });

  if (countEl) {
    countEl.textContent = `${visibleCount}개 일주`;
  }

  if (emptyEl) {
    emptyEl.classList.toggle("hidden", visibleCount > 0);
  }
}

function scheduleUpdateListView() {
  window.requestAnimationFrame(() => {
    updateListView();
  });
}

if (searchInput) {
  ["input", "change", "search", "keyup", "compositionend"].forEach((eventName) => {
    searchInput.addEventListener(eventName, scheduleUpdateListView);
  });
}

cards.forEach((card) => {
  card.addEventListener("click", () => {
    trackEvent("soulday_list_soulday_click", {
      day_pillar_name: card.dataset.souldayName || "",
      page_name: "soulday_list",
    });
  });
});

document.querySelectorAll("[data-soulday-home-link]").forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("soulday_list_homelink_click", {
      page_name: "soulday_list",
    });
  });
});

scheduleUpdateListView();
