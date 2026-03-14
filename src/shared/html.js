const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

export function escapeHtmlWithBreaks(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}
