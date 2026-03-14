let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer) return toastContainer;

  toastContainer = document.createElement("div");
  toastContainer.className = "toast-stack";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.setAttribute("aria-atomic", "true");
  document.body.append(toastContainer);
  return toastContainer;
}

export function showToast(message, { duration = 2400 } = {}) {
  if (typeof document === "undefined") return;

  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.append(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.remove();
    }, 180);
  }, duration);
}

export function openModal(modal) {
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
}

export function closeModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal");
}

export function setupScrollTopButton(button, { threshold = 480 } = {}) {
  if (!button) return () => {};

  const syncVisibility = () => {
    button.classList.toggle("is-visible", window.scrollY > threshold);
  };

  const handleClick = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  button.addEventListener("click", handleClick);
  window.addEventListener("scroll", syncVisibility, { passive: true });
  syncVisibility();

  return () => {
    button.removeEventListener("click", handleClick);
    window.removeEventListener("scroll", syncVisibility);
  };
}
