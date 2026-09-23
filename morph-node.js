"use strict";

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const svg = $("#morph-svg");
const NS = "http://www.w3.org/2000/svg";

let yaw = 0.58;
let pitch = -0.24;
let dragging = false;
let lastX = 0;
let lastY = 0;
let autoRotate = true;
let currentMode = "ground";
let currentModule = "compute";
let lastFrame = performance.now();
let lastRender = 0;
let resumeTimer = null;

const modules = {
  compute: {
    title: "EDGE COMPUTE",
    text: "The compute boundary holds firmware, policy, keys, local models, and decision logic. Compromise here can affect every downstream subsystem.",
    controls: ["Signed firmware", "Measured boot", "Least privilege"]
  },
  radio: {
    title: "RADIO / CONNECTIVITY",
    text: "Connectivity expands the trust boundary beyond the chassis. Remote management, mesh peers, cloud dependencies, and update channels all require authenticated and constrained paths.",
    controls: ["Mutual authentication", "Network segmentation", "Egress policy"]
  },
  sensors: {
    title: "SENSORS / PERCEPTION",
    text: "A system can be computationally intact and still make unsafe decisions if its perception is spoofed, stale, or untrustworthy. Sensor provenance becomes a security property.",
    controls: ["Sensor attestation", "Cross-sensor validation", "Failure detection"]
  },
  actuation: {
    title: "ACTUATION / PHYSICAL EFFECT",
    text: "When software controls movement or physical force, cybersecurity becomes safety engineering. Commands need authorization, bounds, and an independent path to stop.",
    controls: ["Command authorization", "Physical limits", "Safe halt"]
  },
  autonomy: {
    title: "AUTONOMY / DECISION LOOP",
    text: "Autonomy combines perception, policy, and actuation. Security must constrain what the system is allowed to decide—not only who is allowed to log in.",
    controls: ["Policy envelope", "Human override", "Decision logging"]
  }
};

const modes = {
  ground: "Ground operation increases interaction with nearby people, local wireless networks, and physical obstacles.",
  climb: "Vertical operation raises sensor-integrity and fail-safe concerns because loss of control can immediately create physical consequences.",
  flight: "Airborne operation amplifies navigation, link-loss, spoofing, and safe-return requirements. Connectivity failure must not become uncontrolled behavior.",
  subsurface: "Confined operation reduces connectivity and increases dependence on local autonomy, stored policy, robust sensing, and deterministic safe states."
};

const controlDefs = [
  ["signed", "Signed firmware", true, 14],
  ["auth", "Mutual authentication", true, 12],
  ["segment", "Segmented network path", true, 10],
  ["attest", "Sensor cross-checks", true, 12],
  ["halt", "Independent safe halt", true, 18],
  ["logs", "Decision logging", true, 8],
  ["public", "Direct public control path", false, -18],
  ["broad", "Broad actuator privilege", false, -16]
];

const state = Object.fromEntries(controlDefs.map(x => [x[0], x[2]]));

const cubeEdges = [
  [0,1],[0,2],[0,4],
  [1,3],[1,5],
  [2,3],[2,6],
  [3,7],
  [4,5],[4,6],
  [5,7],[6,7]
];

function svgEl(name, attrs={}) {
  const el = document.createElementNS(NS, name);
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function rotatePoint([x,y,z]) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);

  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;

  const y1 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;

  return [x1, y1, z2];
}

function project(point) {
  const [x,y,z] = rotatePoint(point);

  // Deliberately enlarged relative to v3.1 so the model owns the blueprint bay.
  const camera = 9.7;
  const focal = 970;
  const denom = Math.max(3.3, camera + z);
  const scale = focal / denom;

  return {
    x: 400 + x * scale,
    y: 305 + y * scale,
    z,
    scale
  };
}

function cube(cx,cy,cz,sx,sy,sz) {
  return [
    [cx-sx, cy-sy, cz-sz],
    [cx-sx, cy-sy, cz+sz],
    [cx-sx, cy+sy, cz-sz],
    [cx-sx, cy+sy, cz+sz],
    [cx+sx, cy-sy, cz-sz],
    [cx+sx, cy-sy, cz+sz],
    [cx+sx, cy+sy, cz-sz],
    [cx+sx, cy+sy, cz+sz]
  ];
}

function line(group, a, b, cls="wire") {
  group.appendChild(svgEl("line", {
    x1: a.x.toFixed(2),
    y1: a.y.toFixed(2),
    x2: b.x.toFixed(2),
    y2: b.y.toFixed(2),
    class: cls
  }));
}

function drawCube(group, vertices, cls="wire", addFace=false) {
  const pts = vertices.map(project);

  if (addFace) {
    const face = [pts[0],pts[1],pts[5],pts[4]]
      .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    group.appendChild(svgEl("polygon", {
      points: face,
      class: "hull-face"
    }));
  }

  const sortedEdges = cubeEdges
    .map(([a,b]) => ({a,b,z:(pts[a].z + pts[b].z)/2}))
    .sort((m,n) => n.z - m.z);

  for (const edge of sortedEdges) {
    line(group, pts[edge.a], pts[edge.b], cls);
  }

  for (const p of pts) {
    group.appendChild(svgEl("circle", {
      cx: p.x.toFixed(2),
      cy: p.y.toFixed(2),
      r: Math.max(2.0, Math.min(3.6, 2.4 * p.scale / 85)).toFixed(2),
      class: "node-dot"
    }));
  }
}

function polyline3D(group, points, cls="wire-secondary") {
  const pts = points.map(project);
  for (let i=0; i<pts.length-1; i++) {
    line(group, pts[i], pts[i+1], cls);
  }
}

function ring3D(group, center, radius, axis="y", cls="mode-accent") {
  const pts = [];
  const steps = 48;

  for (let i=0; i<=steps; i++) {
    const t = Math.PI * 2 * i / steps;
    let p;

    if (axis === "y") {
      p = [center[0] + Math.cos(t)*radius, center[1], center[2] + Math.sin(t)*radius];
    } else if (axis === "x") {
      p = [center[0], center[1] + Math.cos(t)*radius, center[2] + Math.sin(t)*radius];
    } else {
      p = [center[0] + Math.cos(t)*radius, center[1] + Math.sin(t)*radius, center[2]];
    }

    pts.push(p);
  }

  polyline3D(group, pts, cls);
}

function drawModeAccents(group) {
  if (currentMode === "flight") {
    [[2.45,0,0],[-2.45,0,0],[0,0,1.95],[0,0,-1.95]]
      .forEach(p => ring3D(group,p,.78,"y"));

    ring3D(group,[0,0,0],3.25,"z","depth-ring");

  } else if (currentMode === "ground") {
    ring3D(group,[-1.55,.78,0],.64,"z");
    ring3D(group,[1.55,.78,0],.64,"z");

    polyline3D(
      group,
      [[-2.15,1.03,-.9],[2.15,1.03,-.9],[2.15,1.03,.9],[-2.15,1.03,.9],[-2.15,1.03,-.9]],
      "mode-accent"
    );

  } else if (currentMode === "climb") {
    polyline3D(group,[[-2.85,-2.45,0],[-2.85,2.45,0]],"mode-accent");
    polyline3D(group,[[2.85,-2.45,0],[2.85,2.45,0]],"mode-accent");
    ring3D(group,[-2.5,0,0],.55,"x");
    ring3D(group,[2.5,0,0],.55,"x");

  } else if (currentMode === "subsurface") {
    ring3D(group,[0,0,0],2.85,"z");
    ring3D(group,[0,0,0],3.45,"z");
    polyline3D(group,[[-3.55,0,0],[3.55,0,0]],"mode-accent");
  }
}

const callouts = {
  sensors: {
    point:[0,-1.35,0],
    label:[72,112],
    title:"SENSORS"
  },
  compute: {
    point:[0,0,0],
    label:[625,112],
    title:"EDGE COMPUTE"
  },
  radio: {
    point:[0,0,1.95],
    label:[650,235],
    title:"RADIO / LINK"
  },
  actuation: {
    point:[2.45,0,0],
    label:[650,492],
    title:"ACTUATION"
  },
  autonomy: {
    point:[0,.45,-.5],
    label:[74,500],
    title:"AUTONOMY"
  }
};

function drawCallouts(group) {
  for (const [key,c] of Object.entries(callouts)) {
    const p = project(c.point);
    const active = key === currentModule;
    const leftSide = c.label[0] < 400;
    const elbowX = leftSide ? c.label[0] + 112 : c.label[0] - 38;

    group.appendChild(svgEl("path", {
      d: `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${elbowX} ${c.label[1]} L ${c.label[0]} ${c.label[1]}`,
      class: "callout" + (active ? " active" : "")
    }));

    const text = svgEl("text", {
      x: c.label[0],
      y: c.label[1] - 6,
      class: "callout-label" + (active ? " active" : "")
    });
    text.textContent = c.title;
    group.appendChild(text);

    if (active) {
      group.appendChild(svgEl("circle", {
        cx: p.x.toFixed(2),
        cy: p.y.toFixed(2),
        r: 6.5,
        class: "core-dot"
      }));
    }
  }
}

function drawAxes(group) {
  [
    [[-3.6,0,0],[3.6,0,0]],
    [[0,-2.65,0],[0,2.65,0]],
    [[0,0,-3.2],[0,0,3.2]]
  ].forEach(a => polyline3D(group,a,"axis"));
}

function buildScene() {
  const fragment = document.createDocumentFragment();

  const defs = svgEl("defs");

  const glow = svgEl("filter", {
    id:"glow",
    x:"-60%",
    y:"-60%",
    width:"220%",
    height:"220%"
  });

  glow.appendChild(svgEl("feGaussianBlur", {
    stdDeviation:"4",
    result:"blur"
  }));

  const merge = svgEl("feMerge");
  merge.appendChild(svgEl("feMergeNode", { in:"blur" }));
  merge.appendChild(svgEl("feMergeNode", { in:"SourceGraphic" }));
  glow.appendChild(merge);
  defs.appendChild(glow);
  fragment.appendChild(defs);

  const group = svgEl("g");

  drawAxes(group);

  // Larger abstract central compute chassis.
  drawCube(group, cube(0,0,0,1.7,.78,1.0), "wire", true);

  // Connected endpoint / actuator pods.
  const pods = [
    [2.45,0,0],
    [-2.45,0,0],
    [0,0,1.95],
    [0,0,-1.95]
  ];

  pods.forEach(p => {
    drawCube(group, cube(p[0],p[1],p[2],.52,.48,.62), "wire-secondary", true);
    line(group, project([0,0,0]), project(p), "trust-path");
  });

  // Sensor assembly + abstract autonomy region.
  drawCube(group, cube(0,-1.45,0,.52,.3,.52), "wire-secondary", true);
  polyline3D(group, [[0,-.78,0],[0,-1.15,0]], "trust-path");

  const center = project([0,0,0]);

  group.appendChild(svgEl("circle", {
    cx:center.x.toFixed(2),
    cy:center.y.toFixed(2),
    r:8.5,
    class:"core-dot",
    filter:"url(#glow)"
  }));

  // Blueprint depth references make rotation easier to read.
  ring3D(group,[0,0,0],2.25,"y","depth-ring");
  ring3D(group,[0,0,0],2.25,"x","depth-ring");

  drawModeAccents(group);
  drawCallouts(group);

  const status = svgEl("text", {
    x:"24",
    y:"588",
    class:"callout-label active"
  });

  status.textContent =
    `${currentMode.toUpperCase()} MODE // ${autoRotate ? "AUTO ROTATE" : "MANUAL VIEW"} // ABSTRACT SECURITY VISUALIZATION`;

  group.appendChild(status);

  const hint = svgEl("text", {
    x:"776",
    y:"588",
    "text-anchor":"end",
    class:"status-label"
  });

  hint.textContent = "NO BUILD DIMENSIONS // THREAT MODEL ONLY";
  group.appendChild(hint);

  fragment.appendChild(group);

  // One atomic DOM operation prevents blank frames.
  svg.replaceChildren(fragment);
}

function animate(now) {
  const dt = Math.min(50, now - lastFrame);
  lastFrame = now;

  if (autoRotate) {
    yaw += dt * 0.00018;
  }

  // 30 fps is visually smooth for this blueprint and easier on the browser.
  if (now - lastRender >= 33) {
    buildScene();
    lastRender = now;
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

svg.addEventListener("pointerdown", e => {
  dragging = true;
  autoRotate = false;

  if (resumeTimer) clearTimeout(resumeTimer);

  lastX = e.clientX;
  lastY = e.clientY;
  svg.setPointerCapture(e.pointerId);
});

svg.addEventListener("pointermove", e => {
  if (!dragging) return;

  yaw += (e.clientX - lastX) * 0.008;
  pitch += (e.clientY - lastY) * 0.008;

  pitch = Math.max(-1.12, Math.min(1.12, pitch));

  lastX = e.clientX;
  lastY = e.clientY;
});

function stopDrag() {
  if (!dragging) return;
  dragging = false;

  // Resume ambient rotation after the visitor has had time to inspect the view.
  resumeTimer = setTimeout(() => {
    autoRotate = true;
  }, 3500);
}

svg.addEventListener("pointerup", stopDrag);
svg.addEventListener("pointercancel", stopDrag);

svg.addEventListener("dblclick", () => {
  autoRotate = !autoRotate;
  if (resumeTimer) clearTimeout(resumeTimer);
});

function renderModule(key) {
  currentModule = key;

  $$(".module-btn").forEach(
    b => b.classList.toggle("active", b.dataset.module === key)
  );

  const m = modules[key];

  $("#module-detail").innerHTML = `
    <strong>${m.title}</strong>
    <p>${m.text}</p>
    <div class="chip-row">
      ${m.controls.map(x => `<span>${x}</span>`).join("")}
    </div>
    <p>
      <strong>${currentMode.toUpperCase()} CONTEXT:</strong>
      ${modes[currentMode]}
    </p>
  `;
}

$$(".module-btn").forEach(
  b => b.addEventListener("click", () => renderModule(b.dataset.module))
);

$$(".mode-btn").forEach(
  b => b.addEventListener("click", () => {
    currentMode = b.dataset.mode;

    $$(".mode-btn").forEach(
      x => x.classList.toggle("active", x === b)
    );

    renderModule(currentModule);
  })
);

renderModule("compute");

function renderControls() {
  const root = $("#controls");
  root.innerHTML = "";

  for (const [id,label] of controlDefs) {
    const row = document.createElement("div");
    row.className = "control-row";

    row.innerHTML = `
      <span>${label}</span>
      <button
        class="switch ${state[id] ? "on" : ""}"
        aria-pressed="${state[id]}"
        data-id="${id}"
        title="Toggle ${label}">
      </button>
    `;

    root.appendChild(row);
  }

  $$(".switch",root).forEach(
    b => b.addEventListener("click", () => {
      state[b.dataset.id] = !state[b.dataset.id];
      renderControls();
      updateTrust();
    })
  );
}

function updateTrust() {
  let score = 42;

  for (const [id,,,weight] of controlDefs) {
    if (state[id]) score += weight;
  }

  score = Math.max(5, Math.min(100, score));
  $("#trust-bar").style.width = score + "%";

  const label =
    score >= 78
      ? "CONSTRAINED / RESILIENT"
      : score >= 55
      ? "CONDITIONAL / REVIEW"
      : "EXPOSED / HIGH DEPENDENCE";

  $("#trust-state").innerHTML = `
    <strong>${label}</strong>
    <p>
      Control posture index: ${score}/100. This is an educational illustration,
      not a quantitative safety certification. The important question is which
      assumptions fail when connectivity, sensing, or autonomy changes.
    </p>
  `;
}

renderControls();
updateTrust();
buildScene();
