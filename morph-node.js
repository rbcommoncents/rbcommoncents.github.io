"use strict";
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const canvas=$('#morph-canvas'), ctx=canvas.getContext('2d');
let yaw=.55,pitch=-.25,drag=false,lastX=0,lastY=0,auto=true,currentMode='ground';

const modules={
  compute:{title:'EDGE COMPUTE',text:'The compute boundary holds firmware, policy, keys, local models, and decision logic. Compromise here can affect every downstream subsystem.',controls:['Signed firmware','Measured boot','Least privilege']},
  radio:{title:'RADIO / CONNECTIVITY',text:'Connectivity expands the trust boundary beyond the chassis. Remote management, mesh peers, cloud dependencies, and update channels all require authenticated and constrained paths.',controls:['Mutual authentication','Network segmentation','Egress policy']},
  sensors:{title:'SENSORS / PERCEPTION',text:'A system can be computationally intact and still make unsafe decisions if its perception is spoofed, stale, or untrustworthy. Sensor provenance becomes a security property.',controls:['Sensor attestation','Cross-sensor validation','Failure detection']},
  actuation:{title:'ACTUATION / PHYSICAL EFFECT',text:'When software controls movement or physical force, cybersecurity becomes safety engineering. Commands need authorization, bounds, and an independent path to stop.',controls:['Command authorization','Physical limits','Safe halt']},
  autonomy:{title:'AUTONOMY / DECISION LOOP',text:'Autonomy combines perception, policy, and actuation. Security must constrain what the system is allowed to decide—not only who is allowed to log in.',controls:['Policy envelope','Human override','Decision logging']}
};
const modes={
  ground:'Ground operation increases interaction with nearby people, local wireless networks, and physical obstacles.',
  climb:'Vertical operation raises sensor-integrity and fail-safe concerns because loss of control can immediately create physical consequences.',
  flight:'Airborne operation amplifies navigation, link-loss, spoofing, and safe-return requirements. Connectivity failure must not become uncontrolled behavior.',
  subsurface:'Confined operation reduces connectivity and increases dependence on local autonomy, stored policy, robust sensing, and deterministic safe states.'
};
const controlDefs=[
  ['signed','Signed firmware',true,14],['auth','Mutual authentication',true,12],['segment','Segmented network path',true,10],['attest','Sensor cross-checks',true,12],['halt','Independent safe halt',true,18],['logs','Decision logging',true,8],['public','Direct public control path',false,-18],['broad','Broad actuator privilege',false,-16]
];
const state=Object.fromEntries(controlDefs.map(x=>[x[0],x[2]]));

function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);}
window.addEventListener('resize',resize); resize();

function rot(p){let [x,y,z]=p; const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch); let x1=x*cy-z*sy,z1=x*sy+z*cy; let y1=y*cp-z1*sp,z2=y*sp+z1*cp; return [x1,y1,z2];}
function project(p,w,h){const [x,y,z]=rot(p),s=380/(6+z);return [w/2+x*s,h/2+y*s,s];}
function box(cx,cy,cz,sx,sy,sz){const v=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])v.push([cx+x*sx,cy+y*sy,cz+z*sz]);return v;}
const edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
function drawBox(v,w,h,color='rgba(109,225,203,.62)'){const pts=v.map(p=>project(p,w,h));ctx.strokeStyle=color;ctx.lineWidth=1;for(const [a,b] of edges){ctx.beginPath();ctx.moveTo(pts[a][0],pts[a][1]);ctx.lineTo(pts[b][0],pts[b][1]);ctx.stroke();}for(const p of pts){ctx.fillStyle='rgba(115,207,255,.72)';ctx.beginPath();ctx.arc(p[0],p[1],2,0,Math.PI*2);ctx.fill();}}
function frame(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);if(auto)yaw+=.0025;
  ctx.save();ctx.globalCompositeOperation='lighter';
  drawBox(box(0,0,0,1.55,.65,.85),w,h);
  const pods=[[2.35,0,0],[-2.35,0,0],[0,0,1.85],[0,0,-1.85]]; pods.forEach(p=>drawBox(box(...p,.45,.42,.55),w,h,'rgba(115,207,255,.5)'));
  // abstract limbs / trust paths
  ctx.strokeStyle='rgba(109,225,203,.45)';ctx.setLineDash([5,7]);
  const c=project([0,0,0],w,h); for(const p of pods){const q=project(p,w,h);ctx.beginPath();ctx.moveTo(c[0],c[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();}
  ctx.setLineDash([]);ctx.restore();
  ctx.fillStyle='rgba(238,248,246,.8)';ctx.font='12px SFMono-Regular, Consolas, monospace';ctx.fillText(currentMode.toUpperCase()+' MODE',18,h-22);
  requestAnimationFrame(frame);
} requestAnimationFrame(frame);
canvas.addEventListener('pointerdown',e=>{drag=true;auto=false;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.008;pitch+=(e.clientY-lastY)*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch));lastX=e.clientX;lastY=e.clientY;});
canvas.addEventListener('pointerup',()=>drag=false);

function renderModule(key){$$('.module-btn').forEach(b=>b.classList.toggle('active',b.dataset.module===key));const m=modules[key];$('#module-detail').innerHTML=`<strong>${m.title}</strong><p>${m.text}</p><div class="chip-row">${m.controls.map(x=>`<span>${x}</span>`).join('')}</div>`;}
$$('.module-btn').forEach(b=>b.addEventListener('click',()=>renderModule(b.dataset.module)));renderModule('compute');
$$('.mode-btn').forEach(b=>b.addEventListener('click',()=>{currentMode=b.dataset.mode;$$('.mode-btn').forEach(x=>x.classList.toggle('active',x===b));$('#module-detail').insertAdjacentHTML('beforeend',`<p><strong>${currentMode.toUpperCase()} CONTEXT:</strong> ${modes[currentMode]}</p>`);}));

function renderControls(){const root=$('#controls');root.innerHTML='';for(const [id,label,_,weight] of controlDefs){const row=document.createElement('div');row.className='control-row';row.innerHTML=`<span>${label}</span><button class="switch ${state[id]?'on':''}" aria-pressed="${state[id]}" data-id="${id}" title="Toggle ${label}"></button>`;root.appendChild(row);} $$('.switch',root).forEach(b=>b.addEventListener('click',()=>{state[b.dataset.id]=!state[b.dataset.id];renderControls();updateTrust();}));}
function updateTrust(){let score=42;for(const [id,,,weight] of controlDefs)if(state[id])score+=weight;score=Math.max(5,Math.min(100,score));$('#trust-bar').style.width=score+'%';let label=score>=78?'CONSTRAINED / RESILIENT':score>=55?'CONDITIONAL / REVIEW':'EXPOSED / HIGH DEPENDENCE';$('#trust-state').innerHTML=`<strong>${label}</strong><p>Control posture index: ${score}/100. This is an educational illustration, not a quantitative safety certification. The important question is which assumptions fail when connectivity, sensing, or autonomy changes.</p>`;}
renderControls();updateTrust();
