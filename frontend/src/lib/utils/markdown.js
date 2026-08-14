// Minimal markdown -> HTML for rendering the assistant's answers (bold,
// bullet lists, paragraphs). Deliberately small rather than pulling in a
// full markdown library for one modal. Escapes HTML first since this is
// LLM output going into innerHTML - never trust it verbatim.
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function renderMarkdown(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  const lines = escaped.split("\n");

  const blocks = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length) {
      blocks.push(`<ul>${listBuffer.map((li) => `<li>${li}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) {
      listBuffer.push(inline(bullet[1]));
      continue;
    }
    flushList();
    if (line === "") continue;
    blocks.push(`<p>${inline(line)}</p>`);
  }
  flushList();

  return blocks.join("");
}

function inline(str) {
  return str
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>");
}
