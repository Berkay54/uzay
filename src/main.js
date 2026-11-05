import "./style.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
// capture mode (?capture): deterministic, frame-by-frame recording for video export
const capture = new URLSearchParams(location.search).has("capture");
if (capture) document.documentElement.classList.add("capture");
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);

// ---------- smooth scroll ----------
let lenis = null;
if (!reduced && !capture) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const goTo = (target) => {
  if (lenis) lenis.scrollTo(target, { duration: 2.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else document.querySelector(target === 0 ? "#ust" : target)?.scrollIntoView();
};

// ---------- hero: the video, frame by frame ----------
const FRAMES = 239;
const src = (i) => `/${capture ? "frames-hd" : "frames"}/f${String(i + 1).padStart(3, "0")}.webp`;
const canvas = document.getElementById("hero-canvas");
const ctx = canvas.getContext("2d");
const frames = new Array(FRAMES);
let current = 0;
let wanted = 0;

function load(i) {
  if (frames[i]) return frames[i];
  const img = new Image();
  img.decoding = "async";
  img.src = src(i);
  img.onload = () => { if (Math.abs(i - wanted) < 3) draw(wanted); };
  frames[i] = img;
  return img;
}
// first frame now, then the rest in order, a few at a time
load(0);
(function queue(i = 1) {
  if (i >= FRAMES) return;
  const batch = [];
  for (let k = i; k < Math.min(FRAMES, i + 8); k++) batch.push(new Promise((r) => { const im = load(k); im.complete ? r() : (im.onload = () => r(), im.onerror = r); }));
  Promise.all(batch).then(() => queue(i + 8));
})();

function nearestLoaded(i) {
  for (let d = 0; d < FRAMES; d++) {
    const a = frames[i - d], b = frames[i + d];
    if (a && a.complete && a.naturalWidth) return a;
    if (b && b.complete && b.naturalWidth) return b;
  }
  return null;
}

function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, capture ? 3 : 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  draw(current, true);
}

function draw(i, force = false) {
  wanted = i;
  const img = nearestLoaded(i);
  if (!img || (!force && i === current && img === frames[current])) return;
  current = i;
  const cw = canvas.width, ch = canvas.height;
  const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
}
addEventListener("resize", sizeCanvas);
sizeCanvas();
frames[0].onload = () => draw(0, true);

const beats = [...document.querySelectorAll(".beat")].map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out }));
const bar = document.getElementById("hero-bar");
const FADE = 0.05;

ScrollTrigger.create({
  trigger: ".hero",
  start: "top top",
  end: "bottom bottom",
  scrub: true,
  onUpdate(self) {
    const p = self.progress;
    draw(Math.round(p * (FRAMES - 1)));
    bar.style.transform = `scaleX(${p})`;
    for (const { el, a, b } of beats) {
      const o = a === 0 ? clamp01((b - p) / FADE) : Math.min(clamp01((p - a) / FADE), clamp01((b - p) / FADE));
      el.style.opacity = o.toFixed(3);
      if (!reduced) {
        el.style.transform = `translateY(${((1 - o) * 18).toFixed(1)}px)`;
        el.style.filter = o > 0.98 ? "none" : `blur(${((1 - o) * 6).toFixed(1)}px)`;
      }
    }
  },
});

// ---------- the journey: each object through a dilating pupil ----------
const stops = [...document.querySelectorAll(".stop")];
stops.forEach((stop) => {
  const eye = stop.querySelector(".eye");
  const parts = stop.querySelectorAll(".stop-text > *");
  if (reduced) {
    eye.style.setProperty("--r", "1");
    return;
  }
  gsap.set(parts, { opacity: 0, y: 26 });
  ScrollTrigger.create({
    trigger: stop,
    start: "top bottom",
    end: "bottom top",
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      // opens as it arrives, holds wide while it is read
      const open = smooth(clamp01((p - 0.08) / 0.34));
      eye.style.setProperty("--r", (0.06 + open * 0.94).toFixed(4));
    },
  });
  gsap.to(parts, {
    opacity: 1,
    y: 0,
    duration: 1.1,
    ease: "expo.out",
    stagger: 0.08,
    scrollTrigger: { trigger: stop, start: "top 35%", toggleActions: "play none none reverse" },
  });
});

// ---------- the distance ruler (log scale) ----------
const ruler = document.querySelector(".ruler");
const list = document.getElementById("ruler-list");
const dot = document.getElementById("ruler-dot");
const names = { ay: "Ay", venus: "Venüs", saturn: "Satürn", sirius: "Sirius", ulker: "Ülker", orion: "Orion", andromeda: "Andromeda" };
const LOG_MIN = 8.4, LOG_MAX = 22.5;
const pos = (lg) => (lg - LOG_MIN) / (LOG_MAX - LOG_MIN);
const links = stops.map((stop) => {
  const key = stop.dataset.key;
  stop.id = key;
  const li = document.createElement("li");
  li.style.top = `${(pos(+stop.dataset.log) * 100).toFixed(2)}%`;
  const a = document.createElement("a");
  a.href = `#${key}`;
  a.textContent = names[key];
  a.addEventListener("click", (e) => { e.preventDefault(); goTo(`#${key}`); });
  li.append(a);
  list.append(li);
  return a;
});

const journeyST = ScrollTrigger.create({
  trigger: ".journey",
  start: "top 60%",
  end: "bottom bottom",
  onToggle: (self) => ruler.classList.toggle("is-on", self.isActive),
});
stops.forEach((stop, i) => {
  ScrollTrigger.create({
    trigger: stop,
    start: "top center",
    end: "bottom center",
    onUpdate(self) {
      const a = +stop.dataset.log;
      const b = stops[i + 1] ? +stops[i + 1].dataset.log : a;
      const lg = a + (b - a) * smooth(clamp01((self.progress - 0.55) / 0.45));
      dot.style.transform = `translateY(${(pos(lg) * ruler.clientHeight - 4).toFixed(1)}px)`;
    },
    onToggle(self) { if (self.isActive) links.forEach((l, k) => l.classList.toggle("is-here", k === i)); },
  });
});
void journeyST;

document.getElementById("again").addEventListener("click", () => {
  goTo(0);
  document.querySelector(".mark-link").focus({ preventScroll: true });
});
document.querySelector(".mark-link").addEventListener("click", (e) => { e.preventDefault(); goTo(0); });
document.querySelector(".skip").addEventListener("click", (e) => { e.preventDefault(); goTo("#yolculuk"); });

// preview: ?p=0.5 opens the page at that point
const qp = parseFloat(new URLSearchParams(location.search).get("p"));
if (!Number.isNaN(qp)) {
  history.scrollRestoration = "manual";
  addEventListener("load", () => {
    const y = qp * (document.documentElement.scrollHeight - innerHeight);
    if (lenis) lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y);
    ScrollTrigger.update();
  });
}

if (capture) {
  gsap.globalTimeline.pause();
  let clockT = 0;
  window.__ready = () => Promise.all(Array.from({ length: FRAMES }, (_, i) => {
    const im = load(i);
    return im.complete && im.naturalWidth ? im.decode().catch(() => {}) : new Promise((r) => im.addEventListener("load", () => im.decode().then(r, r), { once: true }));
  }));
  window.__step = (y, t) => {
    window.scrollTo(0, y);
    ScrollTrigger.update();
    clockT = t;
    gsap.globalTimeline.time(clockT);
  };
  window.__y = (sel, vh) => document.querySelector(sel).getBoundingClientRect().top + scrollY + vh * innerHeight;
  window.__heroEnd = () => document.querySelector(".hero").offsetHeight - innerHeight;
}
