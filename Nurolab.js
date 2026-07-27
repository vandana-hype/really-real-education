// ==========================================================================
// Nurolab.js
// Scroll-reveal animation + small interactive neuron diagram for the hero
// + the interactive EEG signal-pipeline simulation in the Architecture
// section + the demo-video modal. No external dependencies — plain
// DOM/SVG/canvas so it stays light on classroom devices.
// ==========================================================================

(function () {
  "use strict";

  let spikeCount = 0;

  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.innerText = msg;
    t.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- Scroll reveal ----------
  function initScrollReveal() {
    const targets = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || targets.length === 0) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach((el) => observer.observe(el));
  }

  // ---------- Smooth in-page navigation ----------
  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ---------- Interactive neuron diagram (hero) ----------
  const NS = "http://www.w3.org/2000/svg";

  const nodes = [
    { id: "in", x: 40, y: 150, r: 16, label: "input" },
    { id: "h1", x: 170, y: 80, r: 16, label: "hidden" },
    { id: "h2", x: 170, y: 220, r: 16, label: "hidden" },
    { id: "out", x: 300, y: 150, r: 18, label: "output" },
  ];

  const edges = [
    { from: "in", to: "h1" },
    { from: "in", to: "h2" },
    { from: "h1", to: "out" },
    { from: "h2", to: "out" },
  ];

  function nodeById(id) {
    return nodes.find((n) => n.id === id);
  }

  function buildNeuronSvg() {
    const svg = document.getElementById("neuronSvg");
    if (!svg) return;
    svg.setAttribute("aria-hidden", "true");

    edges.forEach((edge) => {
      const a = nodeById(edge.from);
      const b = nodeById(edge.to);
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
      line.setAttribute("class", "axon-line");
      line.dataset.from = edge.from;
      line.dataset.to = edge.to;
      svg.appendChild(line);
    });

    nodes.forEach((n) => {
      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("cx", n.x);
      circle.setAttribute("cy", n.y);
      circle.setAttribute("r", n.r);
      circle.setAttribute("class", "neuron-node");
      circle.setAttribute("fill", "rgba(102, 183, 160, 0.85)");
      circle.dataset.id = n.id;
      circle.addEventListener("click", () => fireFrom(n.id));
      svg.appendChild(circle);

      const label = document.createElementNS(NS, "text");
      label.setAttribute("x", n.x);
      label.setAttribute("y", n.y + n.r + 16);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "var(--muted)");
      label.textContent = n.label;
      svg.appendChild(label);
    });
  }

  function pulseNode(id) {
    const svg = document.getElementById("neuronSvg");
    if (!svg) return;
    const circle = svg.querySelector(`circle[data-id="${id}"]`);
    if (!circle) return;
    circle.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.25)", filter: "brightness(1.3)" },
        { transform: "scale(1)", filter: "brightness(1)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
    circle.style.transformOrigin = "center";
    circle.style.transformBox = "fill-box";
  }

  function travelSpike(fromId, toId, onArrive) {
    const svg = document.getElementById("neuronSvg");
    if (!svg) return;
    const a = nodeById(fromId);
    const b = nodeById(toId);
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("r", 4);
    dot.setAttribute("class", "spike-dot");
    dot.setAttribute("cx", a.x);
    dot.setAttribute("cy", a.y);
    svg.appendChild(dot);

    const duration = 500;
    const start = performance.now();

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      dot.setAttribute("cx", a.x + (b.x - a.x) * t);
      dot.setAttribute("cy", a.y + (b.y - a.y) * t);
      dot.style.opacity = t < 0.9 ? 1 : 1 - (t - 0.9) * 10;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        dot.remove();
        if (onArrive) onArrive();
      }
    }
    requestAnimationFrame(step);
  }

  function fireFrom(id) {
    pulseNode(id);
    spikeCount += 1;
    const counter = document.getElementById("spikeCounter");
    if (counter) counter.textContent = String(spikeCount);

    const outgoing = edges.filter((e) => e.from === id);
    if (outgoing.length === 0) {
      toast("Signal reached the end of the network");
      return;
    }
    outgoing.forEach((edge) => {
      travelSpike(edge.from, edge.to, () => {
        pulseNode(edge.to);
        const downstream = edges.filter((e) => e.from === edge.to);
        downstream.forEach((d) =>
          travelSpike(d.from, d.to, () => pulseNode(d.to))
        );
      });
    });
  }

  // ---------- EEG signal simulation (Architecture section) ----------
  function initEEGSimulation() {
    const canvas = document.getElementById("wave");
    if (!canvas) return;

    const stages = [
      {
        label: "1. Raw signal",
        caption: {
          h: "Signal straight from the headset",
          p: "This is the unprocessed EEG - a mix of real brain activity, occasional eye blinks (the big spikes), and electrical noise.",
        },
        wave: { noise: 0.9, hum: 0.35, drift: 0.5, blink: 1 },
      },
      {
        label: "2. Blink removal",
        caption: {
          h: "Detecting and removing eye blinks",
          p: "Blinks create large spikes in the front channels that aren't brain activity at all - they're muscle movement. Those spikes are detected and smoothly filled in.",
        },
        wave: { noise: 0.9, hum: 0.35, drift: 0.5, blink: 0 },
      },
      {
        label: "3. Bandpass filter",
        caption: {
          h: "Keeping only the useful range (0.1–70 Hz)",
          p: "The slow drift and very fast noise are cut away - only the frequency range where real brain activity lives is kept.",
        },
        wave: { noise: 0.35, hum: 0.35, drift: 0.05, blink: 0 },
      },
      {
        label: "4. Notch filter",
        caption: {
          h: "Removing 50 Hz electrical interference",
          p: "One specific frequency - the hum from AC power lines in the room - is surgically removed, leaving a clean signal.",
        },
        wave: { noise: 0.35, hum: 0.02, drift: 0.05, blink: 0 },
      },
      {
        label: "5. Feature extraction",
        caption: {
          h: "Measuring brainwave activity",
          p: "Each band is a different speed of oscillation, shown to scale below - delta is slow and rolling, gamma is fast and tight. Taller waves mean that band is stronger right now.",
        },
        bars: [
          { label: "Delta", desc: "deep sleep - slowest wave", freq: 1, power: 0.4 },
          { label: "Theta", desc: "drowsy, daydreaming", freq: 2.2, power: 0.55 },
          { label: "Alpha", desc: "calm, relaxed", freq: 4, power: 0.85 },
          { label: "Beta", desc: "alert, thinking", freq: 7, power: 0.6 },
          { label: "Gamma", desc: "intense focus - fastest wave", freq: 11, power: 0.45 },
        ],
      },
      {
        label: "6. Output",
        caption: {
          h: "Result shown to the person",
          p: "The measurements are compared to this person's own resting baseline. Right now, their state is close to normal.",
        },
        badge: true,
      },
    ];

    let current = 0;
    const stepsEl = document.getElementById("steps");
    const captionEl = document.getElementById("caption");
    const ctx = canvas.getContext("2d");
    const barsEl = document.getElementById("bars");
    const badgeRowEl = document.getElementById("badgeRow");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    function renderSteps() {
      stepsEl.innerHTML = stages
        .map(
          (s, i) =>
            `<div class="step ${i === current ? "active" : ""}" data-i="${i}">${s.label}</div>`
        )
        .join("");
      stepsEl.querySelectorAll(".step").forEach((el) => {
        el.addEventListener("click", () => {
          current = parseInt(el.dataset.i, 10);
          render();
        });
      });
    }

    function render() {
      renderSteps();
      const s = stages[current];
      captionEl.innerHTML = `<h3>${s.caption.h}</h3><p>${s.caption.p}</p>`;
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === stages.length - 1;

      const isWave = !!s.wave;
      const isBars = !!s.bars;
      const isBadge = !!s.badge;

      canvas.style.display = isWave ? "block" : "none";
      barsEl.style.display = isBars ? "flex" : "none";
      badgeRowEl.style.display = isBadge ? "flex" : "none";

      if (isBars) {
        barsEl.innerHTML = s.bars
          .map(
            (b) => `
          <div class="bar-row">
            <div class="bar-label"><span class="name">${b.label}</span><span class="desc">${b.desc}</span></div>
            <div class="bar-wave">${miniWaveSvg(b.freq, b.power)}</div>
          </div>
        `
          )
          .join("");
      }
    }

    function miniWaveSvg(freq, power) {
      const w = 400,
        h = 36,
        mid = h / 2,
        amp = mid * 0.75 * power;
      let d = "";
      for (let x = 0; x <= w; x += 4) {
        const y = mid + Math.sin((x / w) * Math.PI * 2 * freq) * amp;
        d += (x === 0 ? "M" : "L") + x + "," + y.toFixed(1) + " ";
      }
      return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#4fd1ae" stroke-width="1.6"/></svg>`;
    }

    prevBtn.addEventListener("click", () => {
      if (current > 0) {
        current--;
        render();
      }
    });
    nextBtn.addEventListener("click", () => {
      if (current < stages.length - 1) {
        current++;
        render();
      }
    });

    /* waveform simulation */
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = 300 * dpr;
      canvas.style.height = "300px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    if (document.getElementById("wave")) {
      resize();
    }
    window.addEventListener("resize", () => {
      if (document.getElementById("wave")) {
        resize();
      }
    });

    let t = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function drawWave() {
      const s = stages[current];
      if (!s.wave) {
        requestAnimationFrame(drawWave);
        return;
      }
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const { noise, hum, drift, blink } = s.wave;
      const mid = h / 2;

      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        let y = mid;
        y += Math.sin(x * 0.02 + t * 1.0) * 22;
        y += Math.sin(x * 0.05 + t * 1.6) * 12 * (1 - noise * 0.2);
        y += Math.sin(x * 0.9 + t * 8) * (hum * 22);
        y += (Math.random() - 0.5) * (noise * 14);
        y += Math.sin(x * 0.005 + t * 0.3) * (drift * 40);
        if (blink) {
          const spike1 = Math.exp(-Math.pow(x - w * 0.28, 2) / (2 * Math.pow(w * 0.012, 2)));
          const spike2 = Math.exp(-Math.pow(x - w * 0.68, 2) / (2 * Math.pow(w * 0.012, 2)));
          y -= (spike1 + spike2) * (h * 0.55);
        }
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(79,209,174,0.9)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (!reduceMotion) {
        t += 0.05;
      }
      requestAnimationFrame(drawWave);
    }

    render();
    if (document.getElementById("wave")) {
      drawWave();
    }
  }

  // ---------- Demo video modal ----------
  // Triggered by any button carrying class "js-watch-demo" (or the legacy
  // id "watchDemoBtn"). Opens a centered modal, autoplays the video, and
  // can be closed via the × button, clicking the dark backdrop, or Escape.
  function initVideoModal() {
    const openBtns = document.querySelectorAll(".js-watch-demo, #watchDemoBtn");
    const modal = document.getElementById("videoModal");
    const closeBtn = document.getElementById("closeVideoBtn");
    const video = document.getElementById("demoVideo");

    if (!openBtns.length || !modal) return; // widget isn't on this page

    function openModal() {
      modal.style.display = "flex";
      document.body.style.overflow = "hidden"; // prevent background scroll
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {
          /* autoplay can be blocked by the browser - user can hit play manually */
        });
      }
    }

    function closeModal() {
      modal.style.display = "none";
      document.body.style.overflow = "";
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    }

    openBtns.forEach((btn) => {
      btn.addEventListener("click", openModal);
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    // Click on the dark backdrop (outside the video card) closes it
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Escape key closes it, but only while it's actually open
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") {
        closeModal();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildNeuronSvg();
    initScrollReveal();
    initSmoothAnchors();
    toast("Nurolab loaded - click a node to fire a signal");
    initEEGSimulation();
    initVideoModal();
  });

  window.NurolabFire = fireFrom;
})();

/* ==========================================
   LIVE HERO EEG DASHBOARD
========================================== */

(function () {
  const heroWave = document.getElementById("hero-wave");
  if (!heroWave) return;

  const bars = {
    delta: document.querySelector(".fill.delta"),
    theta: document.querySelector(".fill.theta"),
    alpha: document.querySelector(".fill.alpha"),
    beta: document.querySelector(".fill.beta"),
    gamma: document.querySelector(".fill.gamma"),
  };

  const values = document.querySelectorAll(".metric strong");

  let t = 0;
  let spike = Math.random() * 250 + 120;

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function animate() {
    t += 0.045;
    const path = [];

    for (let x = 0; x <= 400; x += 4) {
      const p = x / 400;
      let y =
        45 +
        10 * Math.sin(2 * Math.PI * 8 * p + t) +
        5 * Math.sin(2 * Math.PI * 17 * p + t * 1.4) +
        3 * Math.sin(2 * Math.PI * 4 * p + t * 0.8);

      if (Math.abs(x - spike) < 4) {
        y -= 24;
      }

      path.push((x === 0 ? "M" : "L") + x + "," + y.toFixed(1));
    }

    heroWave.setAttribute("d", path.join(" "));

    spike -= 2;
    if (spike < -10) {
      spike = 420 + Math.random() * 100;
    }

    requestAnimationFrame(animate);
  }

  animate();

  /* ==========================
     Animated EEG Bands
  =========================== */

  setInterval(() => {
    bars.delta.style.width = (38 + random(-5, 5)) + "%";
    bars.theta.style.width = (28 + random(-4, 4)) + "%";
    bars.alpha.style.width = (70 + random(-6, 6)) + "%";
    bars.beta.style.width = (35 + random(-5, 5)) + "%";
    bars.gamma.style.width = (18 + random(-3, 3)) + "%";
  }, 700);

  /* ==========================
     Live Metrics
  =========================== */

  if (values.length >= 3) {
    setInterval(() => {
      values[0].innerHTML = (0.8 + Math.random() * 0.06).toFixed(2);
      values[1].innerHTML = (0.4 + Math.random() * 0.08).toFixed(2);

      const risk = values[2];
      const level = Math.random();

      if (level < 0.55) {
        risk.innerHTML = "Low";
        risk.style.color = "#2e8b57";
      } else if (level < 0.85) {
        risk.innerHTML = "Mild";
        risk.style.color = "#d97706";
      } else {
        risk.innerHTML = "High";
        risk.style.color = "#d33";
      }
    }, 2000);
  }
})();

/* ==========================================
   Prototype Section Animation
========================================== */

const prototype = document.getElementById("prototypeHeadset");

if (prototype) {
  prototype.addEventListener("mousemove", function (e) {
    const rect = prototype.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateY = (x / rect.width - 0.5) * 12;
    const rotateX = (y / rect.height - 0.5) * -12;

    prototype.style.transform = `perspective(1000px)
             rotateX(${rotateX}deg)
             rotateY(${rotateY}deg)
             scale(1.03)`;
  });

  prototype.addEventListener("mouseleave", function () {
    prototype.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale(1)";
  });
}