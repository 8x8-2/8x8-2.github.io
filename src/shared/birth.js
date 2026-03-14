function pad(value) {
  return String(value ?? "").padStart(2, "0");
}

export function normalizeDigitsOnlyInput(value, maxLength) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

export function normalizeBirthTimeInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function isValidBirthTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;

  const [hour, minute] = value.split(":").map(Number);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  if (hour < 0 || hour > 24) return false;
  if (minute < 0 || minute > 59) return false;
  if (hour === 24 && minute !== 0) return false;

  return true;
}

export function validateBirthInput({
  year,
  month,
  day,
  birthTime,
  calendarType,
  unknownTime,
}) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return "년은 1900~2100 사이여야 합니다.";
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "월은 1~12 사이여야 합니다.";
  }

  const maxDay = calendarType === "lunar" ? 30 : 31;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    return `일은 ${calendarType === "lunar" ? "음력 기준 1~30" : "1~31"} 사이여야 합니다.`;
  }

  if (!unknownTime && !isValidBirthTime(birthTime)) {
    return "태어난 시간을 올바르게 입력해 주세요.";
  }

  return null;
}

export function bindDigitsOnlyInput(input, maxLength) {
  if (!input) return;

  input.addEventListener("beforeinput", (event) => {
    if (event.isComposing) return;
    if (event.inputType?.startsWith("delete") || event.inputType === "historyUndo" || event.inputType === "historyRedo") return;
    if (event.data && !/^\d+$/.test(event.data)) {
      event.preventDefault();
      return;
    }

    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? input.value.length;
    const nextLength = input.value.length - (selectionEnd - selectionStart) + (event.data?.length || 0);

    if (nextLength > maxLength) {
      event.preventDefault();
    }
  });

  input.addEventListener("input", () => {
    const normalized = normalizeDigitsOnlyInput(input.value, maxLength);
    if (input.value !== normalized) {
      input.value = normalized;
    }
  });
}

export function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export function formatPhoneForInput(value) {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function formatGenderLabel(gender) {
  return gender === "female" ? "여" : "남";
}

export function formatCalendarLabel(calendarType, isLeapMonth = false) {
  if (calendarType === "lunar") {
    return isLeapMonth ? "음력(윤달)" : "음력";
  }
  return "양력";
}

export function formatBirthDisplay(record, { includeCalendar = false } = {}) {
  const base = `${record.birth_year}.${pad(record.birth_month)}.${pad(record.birth_day)}`;
  const parts = [base];

  if (includeCalendar) {
    parts.push(formatCalendarLabel(record.calendar_type, record.is_leap_month));
  }

  if (!record.birth_time_known) {
    parts.push("시간 모름");
    return parts.join(" · ");
  }

  parts.push(`${pad(record.birth_hour)}:${pad(record.birth_minute)}`);
  return parts.join(" · ");
}
