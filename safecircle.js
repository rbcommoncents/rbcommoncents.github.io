"use strict";
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const patterns=['Slow the moment','Verify independently','Ask without shame','Protect the account','Escalate supportively','Share the lesson'];
const activated=new Set();
const scenarios=[
 {id:'bank',title:'The urgent bank call',text:'An older neighbor receives a call claiming fraud is underway. The caller says money must be moved immediately and warns them not to hang up.',choices:[
  ['Tell them they are obviously being scammed and take the phone away.','The goal is protection, but embarrassment can make someone less willing to ask for help next time. Reduce urgency without reducing dignity.',['Slow the moment']],
  ['Help them end the call, then contact the bank using the number on a trusted card or official app.','Strong response. You remove the attacker-controlled channel, verify independently, and stay beside the person while they regain control.',['Slow the moment','Verify independently','Ask without shame']],
  ['Call the number back to see whether the same person answers.','Calling an attacker-provided number keeps the verification process inside the attacker’s channel.',['Slow the moment']]
 ]},
 {id:'mfa',title:'The unexpected MFA prompt',text:'A coworker receives several login approval prompts even though they are not signing in. They are worried that reporting it will make them look careless.',choices:[
  ['Approve one prompt so the notifications stop.','Approval can grant the very access the attacker is seeking. Repeated prompts should increase caution, not normalize approval.',['Slow the moment']],
  ['Tell them to deny the prompts, change credentials through a trusted path, and report it without blame.','Strong response. It combines account protection with a culture where reporting is safe and useful.',['Protect the account','Escalate supportively','Ask without shame']],
  ['Ignore it unless the account actually stops working.','Waiting can give an active attack more time. A low-friction reporting path is part of the control.',['Escalate supportively']]
 ]},
 {id:'child',title:'The gaming message',text:'A child says someone in a game is offering in-game rewards in exchange for moving the conversation to another app and keeping it secret.',choices:[
  ['Ban the game immediately and demand every message.','Immediate safety may matter, but punishment can make future disclosure less likely. Preserve the child’s willingness to ask for help.',['Protect the account']],
  ['Thank them for telling you, preserve the messages, block/report the account, and review privacy settings together.','Strong response. It rewards disclosure, protects evidence, and turns the event into a shared safety habit.',['Ask without shame','Protect the account','Share the lesson']],
  ['Message the stranger directly and threaten them.','Direct confrontation can escalate the interaction and may destroy useful reporting context. Use platform and trusted adult channels instead.',['Escalate supportively']]
 ]},
 {id:'phone',title:'The lost phone',text:'A family member loses a phone containing email, authenticator apps, photos, and saved sessions.',choices:[
  ['Wait a day in case someone returns it.','Recovery may still happen, but account sessions and recovery channels can be time-sensitive.',['Slow the moment']],
  ['Use the device-account recovery process, mark it lost, review critical sessions, and coordinate account changes from another trusted device.','Strong response. A calm sequence protects identity and access without assuming the device is already compromised.',['Protect the account','Verify independently']],
  ['Post the phone number and identifying details publicly so someone can contact you.','Public recovery details can create new impersonation and privacy risks. Use controlled recovery channels.',['Protect the account']]
 ]},
 {id:'usb',title:'The parking-lot USB drive',text:'Someone finds an unlabeled USB drive outside the office and wants to plug it into a spare computer to identify the owner.',choices:[
  ['Use a normal workstation because antivirus will catch anything dangerous.','Removable media can create risks before conventional defenses provide enough context.',['Slow the moment']],
  ['Hand it to the designated security/IT process without connecting it to routine systems.','Strong response. A known handling process protects both the finder and the organization while preserving potential evidence.',['Escalate supportively','Share the lesson']],
  ['Throw it away without telling anyone.','Disposal may remove immediate risk, but the organization loses the chance to identify a pattern or improve awareness.',['Share the lesson']]
 ]},
 {id:'invoice',title:'The changed invoice',text:'A community group receives an email saying a familiar vendor has changed banks and future payments must use a new routing number.',choices:[
  ['Reply to the email and ask whether the change is real.','A compromised mailbox can answer its own verification request. Independent channels matter.',['Slow the moment']],
  ['Pause payment and verify the change using a previously known phone number or established vendor contact.','Strong response. Payment changes deserve an out-of-band verification habit that everyone understands in advance.',['Slow the moment','Verify independently','Share the lesson']],
  ['Pay a small test amount first.','A smaller loss is still a loss, and a successful test can create false confidence.',['Slow the moment']]
 ]}
];
let current=0;
function renderPatterns(){const root=$('#patterns');root.innerHTML='';for(const p of patterns){const s=document.createElement('span');s.className='pattern'+(activated.has(p)?' on':'');s.textContent=p;root.appendChild(s);}}
function renderScenarioList(){const root=$('#scenario-list');root.innerHTML='';scenarios.forEach((s,i)=>{const b=document.createElement('button');b.className='scenario-btn'+(i===current?' active':'');b.textContent=`${String(i+1).padStart(2,'0')} · ${s.title}`;b.addEventListener('click',()=>{current=i;renderAll();});root.appendChild(b);});}
function renderScenario(){const s=scenarios[current];$('#scenario-title').textContent=s.title;$('#scenario-text').textContent=s.text;const root=$('#choices');root.innerHTML='';$('#feedback').hidden=true;s.choices.forEach(([label,feedback,pats],i)=>{const b=document.createElement('button');b.className='choice';b.textContent=label;b.addEventListener('click',()=>{$$('.choice').forEach(x=>x.classList.toggle('selected',x===b));pats.forEach(p=>activated.add(p));renderPatterns();const f=$('#feedback');f.hidden=false;f.innerHTML=`<strong>Why this matters</strong><p>${feedback}</p><div class="chip-row">${pats.map(p=>`<span>${p}</span>`).join('')}</div>`;});root.appendChild(b);});}
function renderAll(){renderScenarioList();renderScenario();renderPatterns();}
const pactDefs={home:'HOME / FAMILY',work:'WORK / TEAM',community:'COMMUNITY / NEIGHBORS'};const selected=new Set(['home','work']);
function renderPactOptions(){const root=$('#pact-options');root.innerHTML='';for(const [id,label] of Object.entries(pactDefs)){const b=document.createElement('button');b.className='tab'+(selected.has(id)?' active':'');b.textContent=label;b.type='button';b.addEventListener('click',()=>{selected.has(id)?selected.delete(id):selected.add(id);renderPactOptions();});root.appendChild(b);}}
$('#build-pact').addEventListener('click',()=>{const names=[...selected].map(x=>pactDefs[x]).join(' + ')||'MY CIRCLE';const text=`SAFECIRCLE // FIVE-MINUTE SAFETY PACT\n${names}\n\n1. We make room to pause when a message creates urgency or fear.\n2. We verify money, identity, account, and access changes through a previously trusted channel.\n3. Asking for help is treated as a protective action, not an embarrassment.\n4. Unexpected MFA prompts, password resets, payment changes, and account-recovery requests are reported early.\n5. We do not punish people for reporting a close call; we use it to improve the shared process.\n6. We keep one simple escalation path everyone knows: who to call, where to report, and how to recover.\n7. We share useful lessons without sharing private details that could create a new risk.\n\nSecurity is stronger when people know they do not have to solve a suspicious moment alone.`;const p=$('#pact');p.textContent=text;p.hidden=false;});
renderPactOptions();renderAll();
