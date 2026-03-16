import { initCommonPageTracking, trackEvent } from "./shared/analytics.js";
import {
  buildSessionProfileStub,
  checkStellarIdAvailability,
  fetchProfile,
  getSession,
  isSupabaseConfigured,
  removeProfileImage,
  updateProfile,
  uploadProfileImage,
} from "./shared/auth.js";
import { fillCountrySelect, fillRegionSelect } from "./shared/regions.js";
import { renderSocialNav } from "./shared/social-nav.js";
import { getVisibilityLabel, PROFILE_VISIBILITY_VALUES } from "./shared/profile-derived.js";
import { buildPublicProfileUrl, isValidStellarId, normalizeStellarIdInput } from "./shared/stellar-id.js";
import { normalizeProfileBio } from "./shared/profile-text.js";

function $(id) {
  return document.getElementById(id);
}

const MBTI_OPTIONS = [
  "", "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

let currentProfile = null;
let selectedAvatarFile = null;
let removeAvatar = false;
let stellarIdAvailability = {
  value: "",
  available: false,
};

function setStellarIdHint(message, tone = "muted") {
  const hintEl = $("settingsStellarIdHint");
  hintEl.textContent = message;
  hintEl.classList.remove("error");
  if (tone === "error") {
    hintEl.classList.add("error");
  }
}

function fillMbtiOptions() {
  $("settingsMbti").innerHTML = MBTI_OPTIONS.map((value) => `
    <option value="${value}">${value || "선택 안 함"}</option>
  `).join("");
}

function fillVisibilityOptions(selectEl, value) {
  selectEl.innerHTML = PROFILE_VISIBILITY_VALUES.map((item) => `
    <option value="${item}">${getVisibilityLabel(item)}</option>
  `).join("");
  selectEl.value = value || "public";
}

function updateBioCount() {
  $("settingsBioCount").textContent = `${$("settingsBio").value.length} / 150`;
}

function syncBioField({ normalize = false } = {}) {
  const bioField = $("settingsBio");

  if (normalize) {
    bioField.value = normalizeProfileBio(bioField.value);
  }

  updateBioCount();
  return bioField.value;
}

function buildProfileRedirectUrl(stellarId) {
  const url = new URL(buildPublicProfileUrl(stellarId), window.location.href);
  url.searchParams.set("saved", "1");
  return url.toString();
}

function renderAvatarPreview(profile = currentProfile) {
  const preview = $("settingsAvatarPreview");

  if (selectedAvatarFile) {
    const objectUrl = URL.createObjectURL(selectedAvatarFile);
    preview.innerHTML = `<img src="${objectUrl}" alt="" />`;
    return;
  }

  if (!removeAvatar && profile?.profile_image_url) {
    preview.innerHTML = `<img src="${profile.profile_image_url}" alt="" />`;
    return;
  }

  preview.innerHTML = `<span>${String(profile?.full_name || "스").charAt(0)}</span>`;
}

async function verifyStellarId() {
  const value = normalizeStellarIdInput($("settingsStellarId").value);
  $("settingsStellarId").value = value;

  if (!isValidStellarId(value)) {
    stellarIdAvailability = { value, available: false };
    setStellarIdHint("스텔라 등록번호는 1~16자리 숫자로 입력해 주세요.", "error");
    return false;
  }

  const available = await checkStellarIdAvailability(value, currentProfile.id);
  stellarIdAvailability = { value, available };
  setStellarIdHint(
    available ? `사용 가능한 등록번호입니다. /${value} 주소로 연결됩니다.` : "이미 사용 중인 스텔라 등록번호입니다.",
    available ? "muted" : "error"
  );
  return available;
}

function fillForm(profile) {
  $("settingsName").value = profile.full_name || "";
  $("settingsStellarId").value = String(profile.stellar_id || "");
  $("settingsMbti").value = profile.mbti || "";
  fillCountrySelect($("settingsCountry"), profile.region_country || "");
  fillRegionSelect($("settingsRegion"), profile.region_country || "", profile.region_name || "");
  $("settingsBio").value = normalizeProfileBio(profile.bio || "");
  syncBioField();
  fillVisibilityOptions($("settingsVisibilityPersonality"), profile.personality_visibility);
  fillVisibilityOptions($("settingsVisibilityHealth"), profile.health_visibility);
  fillVisibilityOptions($("settingsVisibilityLove"), profile.love_visibility);
  fillVisibilityOptions($("settingsVisibilityAbility"), profile.ability_visibility);
  fillVisibilityOptions($("settingsVisibilityMajorLuck"), profile.major_luck_visibility);
  renderAvatarPreview(profile);
}

async function init() {
  initCommonPageTracking();
  trackEvent("profile_settings_view", {
    page_name: "profile_settings",
  });

  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 연결이 아직 설정되지 않았습니다.");
  }

  const session = await getSession();
  if (!session) {
    window.location.href = new URL(document.body.dataset.linkSignin || "../signin/", window.location.href).toString();
    return;
  }

  const navContainer = document.querySelector("[data-social-nav]");
  const sessionProfileStub = buildSessionProfileStub(session);
  let navCleanup = renderSocialNav(navContainer, {
    session,
    viewerProfile: sessionProfileStub,
    currentStellarId: sessionProfileStub?.stellar_id,
    pageTitle: "프로필 설정",
  });

  currentProfile = await fetchProfile(session.user.id, {
    allowSessionFallback: true,
  }) || sessionProfileStub;

  if (!currentProfile) {
    throw new Error("내 프로필을 불러오지 못했습니다.");
  }

  navCleanup?.();
  navCleanup = renderSocialNav(navContainer, {
    session,
    viewerProfile: currentProfile,
    currentStellarId: currentProfile.stellar_id,
    pageTitle: "프로필 설정",
  });

  fillMbtiOptions();
  fillForm(currentProfile);

  $("profileSettingsSection").classList.remove("hidden");

  $("settingsCountry").addEventListener("change", () => {
    fillRegionSelect($("settingsRegion"), $("settingsCountry").value, "");
  });

  $("settingsBio").addEventListener("input", updateBioCount);
  $("settingsBio").addEventListener("blur", () => {
    syncBioField({ normalize: true });
  });
  $("settingsStellarId").addEventListener("input", (event) => {
    event.target.value = normalizeStellarIdInput(event.target.value);
    stellarIdAvailability = {
      value: event.target.value,
      available: false,
    };
  });
  $("settingsStellarId").addEventListener("blur", () => {
    if (!$("settingsStellarId").value) return;
    verifyStellarId().catch(() => {});
  });
  $("settingsStellarIdCheck").addEventListener("click", () => {
    verifyStellarId().catch((error) => {
      setStellarIdHint(error.message || "등록번호를 확인하지 못했습니다.", "error");
    });
  });

  $("settingsAvatarInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0] || null;
    selectedAvatarFile = file;
    removeAvatar = false;
    renderAvatarPreview();
  });

  $("settingsAvatarRemove").addEventListener("click", () => {
    selectedAvatarFile = null;
    removeAvatar = true;
    $("settingsAvatarInput").value = "";
    renderAvatarPreview();
  });

  $("profileSettingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorEl = $("profileSettingsFormError");
    const statusEl = $("profileSettingsStatus");
    errorEl.textContent = "";
    statusEl.textContent = "";

    const stellarId = normalizeStellarIdInput($("settingsStellarId").value);
    const fullName = $("settingsName").value.trim();
    const mbti = $("settingsMbti").value || null;
    const bio = syncBioField({ normalize: true });
    const regionCountry = $("settingsCountry").value || null;
    const regionName = $("settingsRegion").value || null;

    if (fullName.length < 2) {
      errorEl.textContent = "이름은 2글자 이상 입력해 주세요.";
      return;
    }

    if (!isValidStellarId(stellarId)) {
      errorEl.textContent = "스텔라 등록번호는 1~16자리 숫자로 입력해 주세요.";
      return;
    }

    if (!stellarIdAvailability.available || stellarIdAvailability.value !== stellarId) {
      try {
        const available = await verifyStellarId();
        if (!available) {
          errorEl.textContent = "이미 사용 중인 스텔라 등록번호입니다.";
          return;
        }
      } catch (error) {
        errorEl.textContent = error.message || "스텔라 등록번호를 확인하지 못했습니다.";
        return;
      }
    }

    if (selectedAvatarFile && selectedAvatarFile.size > 3 * 1024 * 1024) {
      errorEl.textContent = "프로필 이미지는 3MB 이하만 올릴 수 있습니다.";
      return;
    }

    statusEl.textContent = "저장 중...";

    let nextImagePath = currentProfile.profile_image_path || null;
    let nextImageUrl = currentProfile.profile_image_url || null;
    const previousImagePath = currentProfile.profile_image_path || null;

    try {
      if (selectedAvatarFile) {
        const uploaded = await uploadProfileImage(selectedAvatarFile);
        nextImagePath = uploaded.path;
        nextImageUrl = uploaded.publicUrl;
      } else if (removeAvatar) {
        nextImagePath = null;
        nextImageUrl = null;
      }

      currentProfile = await updateProfile({
        full_name: fullName,
        stellar_id: stellarId,
        profile_image_path: nextImagePath,
        profile_image_url: nextImageUrl,
        mbti,
        region_country: regionCountry,
        region_name: regionName,
        bio,
        personality_visibility: $("settingsVisibilityPersonality").value,
        health_visibility: $("settingsVisibilityHealth").value,
        love_visibility: $("settingsVisibilityLove").value,
        ability_visibility: $("settingsVisibilityAbility").value,
        major_luck_visibility: $("settingsVisibilityMajorLuck").value,
      });

      if (previousImagePath && previousImagePath !== nextImagePath) {
        await removeProfileImage(previousImagePath).catch(() => {});
      }

      selectedAvatarFile = null;
      removeAvatar = false;
      fillForm(currentProfile);
      statusEl.textContent = "저장되었습니다. 프로필로 이동합니다...";
      window.location.href = buildProfileRedirectUrl(currentProfile.stellar_id);
    } catch (error) {
      errorEl.textContent = error.message || "프로필을 저장하지 못했습니다.";
      statusEl.textContent = "";
    }
  });
}

init().catch((error) => {
  $("profileSettingsError").classList.remove("hidden");
  $("profileSettingsError").textContent = error.message || "프로필 설정 페이지를 불러오지 못했습니다.";
});
