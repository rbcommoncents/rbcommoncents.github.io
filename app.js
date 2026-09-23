
const PROFILE = {
  linkedin: "https://www.linkedin.com/in/cyberforensync/",
  github: "https://github.com/rbcommoncents"
};

const capabilities = {
  core: {
    code: "SE-00",
    title: "Security Engineering",
    summary:
      "I work across controls, systems, code, telemetry, and operations rather than treating security as a single product.",
    proof: [
      "Connect security questions to measurable system behavior.",
      "Prefer reproducible controls, testable assumptions, and attributable evidence.",
      "Bridge operations, infrastructure, analytics, and software engineering."
    ],
    tools: ["Python", "Linux", "Telemetry", "Automation", "Architecture"]
  },

  detection: {
    code: "DE-17",
    title: "Detection Engineering",
    summary:
      "My detection work starts with measurement validity and behavioral context before escalating an observation into a security claim.",
    proof: [
      "Behavioral NetFlow baselining and anomaly triage.",
      "Feature engineering around rarity, volume, concentration, and diversity.",
      "Model sensitivity testing instead of hiding tuning assumptions.",
      "Analyst-facing explanations and investigation queues."
    ],
    tools: ["NetFlow", "Pandas", "scikit-learn", "SIEM", "Behavioral Analytics"]
  },

  cloud: {
    code: "CS-21",
    title: "Cloud Security",
    summary:
      "Professional cloud-security experience spanning telemetry, endpoint visibility, SIEM operations, and organizational security controls.",
    proof: [
      "AWS GuardDuty organizational security monitoring.",
      "CloudTrail / CloudWatch security telemetry familiarity.",
      "SIEM administration and operational follow-through.",
      "Endpoint, vulnerability, and Zero Trust tooling exposure."
    ],
    tools: ["AWS", "GuardDuty", "CloudTrail", "Sumo Logic", "Rapid7", "CrowdStrike"]
  },

  python: {
    code: "PY-34",
    title: "Python & Security Automation",
    summary:
      "Python is the connective tissue between research, telemetry, operational workflows, evidence, and repeatable security controls.",
    proof: [
      "Parsing, normalization, and feature-engineering pipelines.",
      "ETL-style security data processing across cloud and log sources.",
      "Testing, reporting, automation, and analyst-oriented outputs.",
      "Current focus: turning research notebooks into reusable security tooling."
    ],
    tools: ["Python", "ETL", "Testing", "Automation", "APIs", "Data Engineering"]
  },

  infrastructure: {
    code: "INF-40",
    title: "Secure Infrastructure",
    summary:
      "I use infrastructure as a security laboratory: segmentation, policy boundaries, telemetry, access control, and validation.",
    proof: [
      "Segmented VLAN architecture and firewall policy design.",
      "Virtualized Linux services and controlled management paths.",
      "Observability and benchmark-driven policy validation.",
      "Public diagrams are sanitized to avoid exposing live control details."
    ],
    tools: ["OPNsense", "Proxmox", "Linux", "VLANs", "Observability", "Ansible"]
  },

  soc: {
    code: "SOC-12",
    title: "Security Operations",
    summary:
      "Security engineering has to survive contact with operations. My background includes monitoring, incident handling, coordination, and team supervision.",
    proof: [
      "SOC coordination and supervision responsibilities.",
      "Multi-site monitoring and incident escalation.",
      "Operational reporting and response workflows.",
      "Security decisions shaped by practical consequences, not only theory."
    ],
    tools: ["Incident Response", "Monitoring", "Escalation", "Operations", "Leadership"]
  },

  ai: {
    code: "AIG-42",
    title: "AI Governance & Controlled Automation",
    summary:
      "I am exploring AI as governed infrastructure: identity, permissions, network boundaries, evidence retention, and benchmarked behavior.",
    proof: [
      "Local worker models placed behind segmented network controls.",
      "No direct public Internet access for worker systems.",
      "Manager/worker role separation and governed tool access.",
      "Reusable compliance benchmarks and evidence-oriented training workflows."
    ],
    tools: ["Local LLMs", "RBAC", "Network Policy", "Benchmarks", "PostgreSQL", "Governance"]
  }
};

const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];

function setupBoot() {
  const boot = $("#boot");
  const enter = $("#enter-btn");
  const skip = $("#skip-btn");
  const bar = $("#boot-progress-bar");
  const status = $("#boot-status");

  const steps = [
    [18, "loading capability graph…"],
    [39, "sanitizing public telemetry…"],
    [61, "validating evidence nodes…"],
    [82, "applying disclosure boundary…"],
    [100, "public environment ready."]
  ];

  let index = 0;
  const timer = setInterval(() => {
    if (index >= steps.length) {
      clearInterval(timer);
      return;
    }

    const [pct, text] = steps[index++];
    bar.style.width = `${pct}%`;
    status.textContent = text;
  }, 360);

  function closeBoot() {
    boot.classList.add("hidden");
    sessionStorage.setItem("mindscape-entered", "true");

    setTimeout(() => {
      boot.remove();

      // If the visitor arrived via #mind, #evidence, etc.,
      // settle the page at the intended section after the overlay is gone.
      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
          target.scrollIntoView({ block: "start" });
        }
      }
    }, 650);
  }

  enter.addEventListener("click", closeBoot);
  skip.addEventListener("click", closeBoot);

  if (
    sessionStorage.getItem("mindscape-entered") === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    closeBoot();
  }
}

function setupCapabilityMap() {
  const nodes = $$(".mind-node");
  const code = $("#panel-code");
  const title = $("#panel-title");
  const summary = $("#panel-summary");
  const proof = $("#panel-proof");
  const tools = $("#panel-tools");

  function render(key) {
    const item = capabilities[key];
    if (!item) return;

    nodes.forEach(node => {
      node.classList.toggle("active", node.dataset.capability === key);
    });

    code.textContent = item.code;
    title.textContent = item.title;
    summary.textContent = item.summary;

    proof.innerHTML = "";
    item.proof.forEach(text => {
      const el = document.createElement("div");
      el.className = "proof";
      el.textContent = text;
      proof.appendChild(el);
    });

    tools.innerHTML = "";
    item.tools.forEach(text => {
      const el = document.createElement("span");
      el.textContent = text;
      tools.appendChild(el);
    });
  }

  nodes.forEach(node => {
    node.addEventListener("click", () => render(node.dataset.capability));
  });

  render("core");
}

function setupCases() {
  $$(".case-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const details = button.nextElementSibling;
      const open = button.getAttribute("aria-expanded") === "true";

      button.setAttribute("aria-expanded", String(!open));
      button.textContent = open ? "Open case file" : "Close case file";
      details.classList.toggle("open", !open);
    });
  });
}

function setupReveal() {
  const items = $$(".reveal");

  // Critical map content is visible regardless of animation state.
  const critical = [$("#mindmap"), $("#capability-panel")].filter(Boolean);
  critical.forEach(el => el.classList.add("visible"));

  if (!("IntersectionObserver" in window)) {
    items.forEach(el => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.04,
      rootMargin: "0px 0px 120px 0px"
    }
  );

  items.forEach(el => observer.observe(el));

  // Reliability fallback: animation must never hide content permanently.
  window.setTimeout(() => {
    items.forEach(el => {
      if (!el.classList.contains("visible")) {
        el.classList.add("reveal-fallback");
      }
    });
  }, 1400);
}

function setupContact() {
  const linkedin = $("#linkedin-link");
  const resumeButton = $("#resume-request");
  const note = $("#resume-note");

  if (PROFILE.linkedin) {
    linkedin.href = PROFILE.linkedin;
    linkedin.hidden = false;
  }

  resumeButton.addEventListener("click", () => {
    note.hidden = !note.hidden;
  });
}

function setupNetwork() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = $("#network-bg");
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let nodes = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(24, Math.min(55, Math.floor(width / 28)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.4 + 0.6
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, width, height);

    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < -20 || node.x > width + 20) node.vx *= -1;
      if (node.y < -20 || node.y > height + 20) node.vy *= -1;
    }

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 135) {
          const alpha = (1 - dist / 135) * 0.12;
          ctx.strokeStyle = `rgba(109,225,203,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const node of nodes) {
      ctx.fillStyle = "rgba(109,225,203,.35)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
}

function init() {
  $("#year").textContent = new Date().getFullYear();
  setupBoot();
  setupCapabilityMap();
  setupCases();
  setupReveal();
  setupContact();
  setupNetwork();
}

document.addEventListener("DOMContentLoaded", init);
