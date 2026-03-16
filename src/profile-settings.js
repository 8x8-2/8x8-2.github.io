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
import { showToast } from "./shared/ui.js";

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
let stellarIdEditMode = false;

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

function getCurrentSavedStellarId() {
  return normalizeStellarIdInput(String(currentProfile?.stellar_id || ""));
}

function syncStellarIdActionButtons() {
  const editButton = $("settingsStellarIdEdit");
  const checkButton = $("settingsStellarIdCheck");
  const saveButton = $("settingsStellarIdSave");
  const currentValue = normalizeStellarIdInput($("settingsStellarId").value);
  const savedValue = getCurrentSavedStellarId();
  const hasVerifiedNewValue = stellarIdAvailability.available && stellarIdAvailability.value === currentValue;

  editButton.classList.toggle("hidden", stellarIdEditMode);
  checkButton.classList.toggle("hidden", !stellarIdEditMode);
  saveButton.classList.toggle("hidden", !stellarIdEditMode);
  saveButton.disabled = !currentValue || (currentValue !== savedValue && !hasVerifiedNewValue);
}

function setStellarIdEditMode(nextMode) {
  stellarIdEditMode = Boolean(nextMode);

  const input = $("settingsStellarId");
  const savedValue = getCurrentSavedStellarId();
  input.disabled = !stellarIdEditMode;

  if (!stellarIdEditMode) {
    input.value = savedValue;
    stellarIdAvailability = {
      value: savedValue,
      available: true,
    };
    setStellarIdHint(
      savedValue
        ? "현재 스텔라 ID입니다. 변경할 때만 \"변경\" 버튼을 눌러 주세요."
        : "스텔라 ID를 입력한 뒤 중복 확인 후 저장해 주세요."
    );
  } else {
    input.value = savedValue;
    stellarIdAvailability = {
      value: "",
      available: false,
    };
    setStellarIdHint("변경할 스텔라 ID를 입력한 뒤 중복 확인 후 저장해 주세요.");
    queueMicrotask(() => {
      input.focus();
      input.select();
    });
  }

  syncStellarIdActionButtons();
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
    setStellarIdHint("스텔라 ID는 1~16자리 숫자로 입력해 주세요.", "error");
    syncStellarIdActionButtons();
    return false;
  }

  if (value === getCurrentSavedStellarId()) {
    stellarIdAvailability = { value, available: true };
    setStellarIdHint(`현재 사용 중인 스텔라 ID입니다. /${value} 주소로 연결됩니다.`);
    syncStellarIdActionButtons();
    return true;
  }

  const available = await checkStellarIdAvailability(value, currentProfile.id);
  stellarIdAvailability = { value, available };
  setStellarIdHint(
    available ? `사용 가능한 스텔라 ID입니다. /${value} 주소로 연결됩니다.` : "이미 사용 중인 스텔라 ID입니다.",
    available ? "muted" : "error"
  );
  syncStellarIdActionButtons();
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
  setStellarIdEditMode(!profile.stellar_id);
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
  let navCleanup = null;
  const renderNav = (viewerProfile) => {
    navCleanup?.();
    navCleanup = renderSocialNav(navContainer, {
      session,
      viewerProfile,
      currentStellarId: viewerProfile?.stellar_id || sessionProfileStub?.stellar_id,
      pageTitle: "프로필 설정",
    });
  };

  renderNav(sessionProfileStub);

  currentProfile = await fetchProfile(session.user.id, {
    allowSessionFallback: true,
  }) || sessionProfileStub;

  if (!currentProfile) {
    throw new Error("내 프로필을 불러오지 못했습니다.");
  }

  renderNav(currentProfile);

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
    if (!stellarIdEditMode) return;
    event.target.value = normalizeStellarIdInput(event.target.value);
    stellarIdAvailability = {
      value: event.target.value,
      available: false,
    };
    setStellarIdHint("변경할 스텔라 ID를 입력한 뒤 중복 확인 후 저장해 주세요.");
    syncStellarIdActionButtons();
  });

  $("settingsStellarIdEdit").addEventListener("click", () => {
    setStellarIdEditMode(true);
  });

  $("settingsStellarIdCheck").addEventListener("click", () => {
    verifyStellarId().catch((error) => {
      setStellarIdHint(error.message || "스텔라 ID를 확인하지 못했습니다.", "error");
      syncStellarIdActionButtons();
    });
  });

  $("settingsStellarIdSave").addEventListener("click", async () => {
    const errorEl = $("profileSettingsFormError");
    const statusEl = $("profileSettingsStatus");
    const stellarId = normalizeStellarIdInput($("settingsStellarId").value);
    const savedStellarId = getCurrentSavedStellarId();

    errorEl.textContent = "";
    statusEl.textContent = "";

    if (!stellarId) {
      setStellarIdHint("스텔라 ID를 입력해 주세요.", "error");
      return;
    }

    if (!isValidStellarId(stellarId)) {
      setStellarIdHint("스텔라 ID는 1~16자리 숫자로 입력해 주세요.", "error");
      return;
    }

    if (stellarId === savedStellarId) {
      setStellarIdEditMode(false);
      return;
    }

    if (!stellarIdAvailability.available || stellarIdAvailability.value !== stellarId) {
      setStellarIdHint("중복 확인을 완료한 뒤 저장해 주세요.", "error");
      syncStellarIdActionButtons();
      return;
    }

    try {
      statusEl.textContent = "스텔라 ID 저장 중...";
      const updatedProfile = await updateProfile({
        stellar_id: stellarId,
      });

      currentProfile = {
        ...currentProfile,
        stellar_id: updatedProfile.stellar_id,
      };
      $("settingsStellarId").value = String(updatedProfile.stellar_id || "");
      setStellarIdEditMode(false);
      renderNav(currentProfile);
      statusEl.textContent = "";
      showToast("스텔라 ID가 변경되었습니다.");
    } catch (error) {
      statusEl.textContent = "";
      setStellarIdHint(error.message || "스텔라 ID를 저장하지 못했습니다.", "error");
      syncStellarIdActionButtons();
    }
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

    const savedStellarId = getCurrentSavedStellarId();
    const stellarId = normalizeStellarIdInput($("settingsStellarId").value) || savedStellarId;
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
      errorEl.textContent = "스텔라 ID는 1~16자리 숫자로 입력해 주세요.";
      return;
    }

    if (stellarIdEditMode && stellarId !== savedStellarId) {
      errorEl.textContent = "스텔라 ID는 옆의 저장 버튼으로 먼저 저장해 주세요.";
      return;
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
      renderNav(currentProfile);
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
