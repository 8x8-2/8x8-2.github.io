import { trackEvent } from "./analytics.js";
import {
  fetchFollowNotifications,
  fetchUnreadFollowNotificationCount,
  markFollowNotificationsRead,
} from "./auth.js";
import { buildPublicProfileUrl } from "./stellar-id.js";

function buildCloseIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.97 5.2a1.25 1.25 0 0 1 1.77 0L12 8.47l3.26-3.26a1.25 1.25 0 1 1 1.77 1.77L13.77 10.24l3.26 3.26a1.25 1.25 0 1 1-1.77 1.77L12 12l-3.26 3.26a1.25 1.25 0 1 1-1.77-1.77l3.26-3.26-3.26-3.26a1.25 1.25 0 0 1 0-1.77Z" fill="currentColor"/>
    </svg>
  `;
}

export function getBellIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.25a5.75 5.75 0 0 0-5.75 5.75v2.08c0 .97-.33 1.9-.92 2.67L4.5 14.86a2.25 2.25 0 0 0 1.79 3.64h11.42a2.25 2.25 0 0 0 1.79-3.64l-.83-1.11a4.42 4.42 0 0 1-.92-2.67V9A5.75 5.75 0 0 0 12 3.25Zm0 17.5a2.77 2.77 0 0 1-2.53-1.64h5.06A2.77 2.77 0 0 1 12 20.75Z" fill="currentColor"/>
    </svg>
  `;
}

function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;

  if (diffMs < minuteMs) {
    return "방금 전";
  }

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))}분 전`;
  }

  if (diffMs < 24 * hourMs) {
    return `${Math.max(1, Math.floor(diffMs / hourMs))}시간 전`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function createNotificationRow(notification) {
  const row = document.createElement(notification.actor_stellar_id ? "a" : "div");
  row.className = "notification-row";
  row.dataset.notificationId = notification.id;

  if (!notification.read_at) {
    row.classList.add("is-unread");
  }

  if (notification.actor_stellar_id) {
    row.href = buildPublicProfileUrl(notification.actor_stellar_id);
  }

  const avatar = document.createElement("div");
  avatar.className = "notification-row-avatar";

  if (notification.actor_profile_image_url) {
    const image = document.createElement("img");
    image.src = notification.actor_profile_image_url;
    image.alt = "";
    avatar.append(image);
  } else {
    const initial = document.createElement("span");
    initial.textContent = String(notification.actor_full_name || "스").charAt(0);
    avatar.append(initial);
  }

  const copy = document.createElement("div");
  copy.className = "notification-row-copy";

  const title = document.createElement("div");
  title.className = "notification-row-title";
  title.textContent = `${notification.actor_full_name || "누군가"}님이 회원님을 팔로우했습니다.`;

  const meta = document.createElement("div");
  meta.className = "notification-row-meta";

  if (notification.actor_stellar_id) {
    const idMeta = document.createElement("span");
    idMeta.textContent = `STELLAR-ID / ${notification.actor_stellar_id}`;
    meta.append(idMeta);
  }

  const time = document.createElement("span");
  time.className = "notification-row-time";
  time.textContent = formatNotificationTime(notification.created_at);
  meta.append(time);

  copy.append(title, meta);
  row.append(avatar, copy);
  return row;
}

export function setupNotificationCenter(triggerButton) {
  if (!triggerButton || typeof document === "undefined") return () => {};

  const layer = document.createElement("div");
  layer.className = "notification-center-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <section class="notification-center-panel" role="dialog" aria-modal="true" aria-label="알림센터">
      <header class="notification-center-head">
        <div>
          <p class="notification-center-eyebrow">알림센터</p>
          <h2 class="notification-center-title">새 팔로우 알림</h2>
        </div>
        <button class="notification-center-close" type="button" data-notification-close aria-label="알림센터 닫기">
          ${buildCloseIcon()}
        </button>
      </header>
      <div class="notification-center-list" data-notification-list></div>
      <section class="notification-center-empty hidden" data-notification-empty>
        <div class="title">아직 알림이 없습니다</div>
        <div class="text">누군가 회원님을 팔로우하면 이곳에서 바로 확인할 수 있습니다.</div>
      </section>
      <div class="notification-center-status" data-notification-status></div>
    </section>
  `;
  document.body.append(layer);

  const listEl = layer.querySelector("[data-notification-list]");
  const emptyEl = layer.querySelector("[data-notification-empty]");
  const statusEl = layer.querySelector("[data-notification-status]");
  const closeButton = layer.querySelector("[data-notification-close]");
  const dotEl = triggerButton.querySelector("[data-notification-dot]");

  let destroyed = false;
  let opened = false;
  let initialized = false;
  let loading = false;
  let hasMore = true;
  let offset = 0;
  let unreadCount = 0;

  const syncUnreadIndicator = (count) => {
    unreadCount = Math.max(0, Number(count) || 0);
    triggerButton.classList.toggle("has-unread", unreadCount > 0);
    dotEl?.classList.toggle("is-visible", unreadCount > 0);
  };

  const syncUnreadIndicatorFromServer = async () => {
    try {
      const count = await fetchUnreadFollowNotificationCount();
      if (destroyed) return;
      syncUnreadIndicator(count);
    } catch {
      syncUnreadIndicator(0);
    }
  };

  const renderRows = (rows, { append = false } = {}) => {
    if (!append) {
      listEl.innerHTML = "";
    }

    rows.forEach((row) => {
      listEl.append(createNotificationRow(row));
    });
  };

  const setStatus = (message) => {
    statusEl.textContent = message;
  };

  const loadNotifications = async ({ limit = 40, reset = false } = {}) => {
    if (loading || destroyed) return;

    loading = true;

    if (reset) {
      offset = 0;
      hasMore = true;
      renderRows([], { append: false });
      emptyEl.classList.add("hidden");
    }

    setStatus(offset === 0 ? "알림을 불러오는 중..." : "알림을 더 불러오는 중...");

    try {
      const rows = await fetchFollowNotifications({
        offset,
        limit,
      });

      if (destroyed) return;

      renderRows(rows, { append: offset > 0 });
      offset += rows.length;
      hasMore = rows.length === limit;

      emptyEl.classList.toggle("hidden", offset > 0);
      setStatus(hasMore || offset === 0 ? "" : "마지막 알림까지 확인했습니다.");
    } catch (error) {
      if (destroyed) return;
      setStatus(error.message || "알림을 불러오지 못했습니다.");
      hasMore = false;
    } finally {
      loading = false;
    }
  };

  const markAllAsRead = async () => {
    if (!unreadCount && !listEl.querySelector(".notification-row.is-unread")) return;

    try {
      await markFollowNotificationsRead();
      if (destroyed) return;

      syncUnreadIndicator(0);
      listEl.querySelectorAll(".notification-row.is-unread").forEach((row) => {
        row.classList.remove("is-unread");
      });
    } catch {
      // 읽음 상태 갱신 실패는 알림 열람 자체를 막지 않습니다.
    }
  };

  const openCenter = async () => {
    if (opened || destroyed) return;

    opened = true;
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    triggerButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("has-notification-center");

    trackEvent("notification_center_open", {
      page_name: document.body.dataset.pageName || "",
    });

    if (!initialized) {
      initialized = true;
      await loadNotifications({ limit: 40, reset: true });
    }

    await markAllAsRead();
  };

  const closeCenter = () => {
    if (!opened) return;

    opened = false;
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    triggerButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("has-notification-center");
  };

  const handleToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (opened) {
      closeCenter();
      return;
    }

    openCenter().catch(() => {});
  };

  const handleLayerClick = (event) => {
    if (event.target === layer || event.target === closeButton) {
      closeCenter();
    }
  };

  const handleListClick = (event) => {
    const row = event.target.closest(".notification-row");
    if (!row) return;

    trackEvent("notification_row_click", {
      page_name: document.body.dataset.pageName || "",
    });
  };

  const handleScroll = () => {
    if (!opened || loading || !hasMore) return;

    const remaining = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
    if (remaining < 120) {
      loadNotifications({ limit: 10 }).catch(() => {});
    }
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape" && opened) {
      closeCenter();
    }
  };

  triggerButton.addEventListener("click", handleToggle);
  closeButton.addEventListener("click", closeCenter);
  layer.addEventListener("click", handleLayerClick);
  listEl.addEventListener("click", handleListClick);
  listEl.addEventListener("scroll", handleScroll, { passive: true });
  document.addEventListener("keydown", handleKeydown);

  syncUnreadIndicatorFromServer().catch(() => {});

  return () => {
    destroyed = true;
    triggerButton.removeEventListener("click", handleToggle);
    closeButton.removeEventListener("click", closeCenter);
    layer.removeEventListener("click", handleLayerClick);
    listEl.removeEventListener("click", handleListClick);
    listEl.removeEventListener("scroll", handleScroll);
    document.removeEventListener("keydown", handleKeydown);
    document.body.classList.remove("has-notification-center");
    layer.remove();
  };
}
