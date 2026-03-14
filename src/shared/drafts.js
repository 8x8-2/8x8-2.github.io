const BIRTH_DRAFT_KEY = "soulscan:birth-draft";
const HOME_AUTORUN_KEY = "soulscan:home-autorun";

function readStorage(storage, key) {
  if (typeof window === "undefined" || !storage) return null;

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  if (typeof window === "undefined" || !storage) return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
}

export function saveBirthDraft(draft) {
  const storage = typeof window === "undefined" ? null : window.localStorage;
  writeStorage(storage, BIRTH_DRAFT_KEY, draft);
}

export function loadBirthDraft() {
  const storage = typeof window === "undefined" ? null : window.localStorage;
  return readStorage(storage, BIRTH_DRAFT_KEY);
}

export function requestHomeAutoRun() {
  const storage = typeof window === "undefined" ? null : window.sessionStorage;
  writeStorage(storage, HOME_AUTORUN_KEY, { enabled: true });
}

export function consumeHomeAutoRun() {
  if (typeof window === "undefined") return false;

  const payload = readStorage(window.sessionStorage, HOME_AUTORUN_KEY);

  try {
    window.sessionStorage.removeItem(HOME_AUTORUN_KEY);
  } catch {
    // Ignore private mode failures.
  }

  return payload?.enabled === true;
}
