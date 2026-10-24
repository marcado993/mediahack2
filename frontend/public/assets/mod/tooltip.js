// Module: tooltip. Part of the app.js split into native ES modules (no build step).

const tip = document.getElementById("tip");

export function tipShow(x, y, html) {
  tip.innerHTML = html;
  tip.style.opacity = 1;
  tipMove(x, y);
}

export function tipMove(x, y) {
  const w = tip.offsetWidth,
    h = tip.offsetHeight;
  tip.style.left = Math.min(x + 15, innerWidth - w - 10) + "px";
  tip.style.top = Math.max(8, Math.min(y - h - 12, innerHeight - h - 8)) + "px";
}

export function tipHide() {
  tip.style.opacity = 0;
}
