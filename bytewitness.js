"use strict";

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const MAX_FILE_SIZE = 64 * 1024 * 1024;
const MAX_STRINGS = 1200;
const BLOCK_SIZE = 4096;

const MAGIC = [
  {name:'PDF', sig:[0x25,0x50,0x44,0x46,0x2d], ext:['pdf']},
  {name:'PNG', sig:[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], ext:['png']},
  {name:'JPEG', sig:[0xff,0xd8,0xff], ext:['jpg','jpeg']},
  {name:'GIF', sig:[0x47,0x49,0x46,0x38], ext:['gif']},
  {name:'ZIP', sig:[0x50,0x4b,0x03,0x04], ext:['zip','docx','xlsx','pptx','jar','apk']},
  {name:'GZIP', sig:[0x1f,0x8b,0x08], ext:['gz','gzip']},
  {name:'7-Zip', sig:[0x37,0x7a,0xbc,0xaf,0x27,0x1c], ext:['7z']},
  {name:'RAR', sig:[0x52,0x61,0x72,0x21,0x1a,0x07], ext:['rar']},
  {name:'ELF', sig:[0x7f,0x45,0x4c,0x46], ext:['elf','so','bin']},
  {name:'SQLite', sig:[0x53,0x51,0x4c,0x69,0x74,0x65,0x20,0x66,0x6f,0x72,0x6d,0x61,0x74,0x20,0x33,0x00], ext:['sqlite','db']},
  {name:'FLAC', sig:[0x66,0x4c,0x61,0x43], ext:['flac']},
  {name:'Ogg', sig:[0x4f,0x67,0x67,0x53], ext:['ogg','oga','opus']},
  {name:'MP3/ID3', sig:[0x49,0x44,0x33], ext:['mp3']},
  {name:'RIFF', sig:[0x52,0x49,0x46,0x46], ext:['wav','avi','webp']},
  {name:'Windows MZ', sig:[0x4d,0x5a], ext:['exe','dll','sys','scr']}
];

let currentBytes = null;
let currentFile = null;
let currentImageData = null;

function fmtBytes(n){
  if (!Number.isFinite(n)) return '—';
  const u=['B','KB','MB','GB']; let i=0, v=n;
  while(v>=1024 && i<u.length-1){v/=1024;i++;}
  return `${v.toFixed(i?2:0)} ${u[i]}`;
}
function hex(n,w=8){ return '0x'+n.toString(16).toUpperCase().padStart(w,'0'); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function extOf(name){ const p=name.toLowerCase().split('.'); return p.length>1?p.pop():''; }

function startsWith(bytes, sig, off=0){
  if (off+sig.length>bytes.length) return false;
  for(let i=0;i<sig.length;i++) if(bytes[off+i]!==sig[i]) return false;
  return true;
}
function findAll(bytes, sig, limit=100){
  const out=[]; const first=sig[0];
  for(let i=0;i<=bytes.length-sig.length && out.length<limit;i++){
    if(bytes[i]!==first) continue;
    let ok=true; for(let j=1;j<sig.length;j++){ if(bytes[i+j]!==sig[j]){ok=false;break;} }
    if(ok) out.push(i);
  }
  return out;
}
function u32le(bytes, off){
  if(off+4>bytes.length) return null;
  return (bytes[off] | bytes[off+1]<<8 | bytes[off+2]<<16 | bytes[off+3]<<24) >>> 0;
}
function u32be(bytes, off){
  if(off+4>bytes.length) return null;
  return (((bytes[off]<<24)>>>0) | bytes[off+1]<<16 | bytes[off+2]<<8 | bytes[off+3]) >>> 0;
}
function ascii(bytes, off, len){
  return String.fromCharCode(...bytes.slice(off, Math.min(off+len, bytes.length)));
}
async function digest(name, buffer){
  const out = new Uint8Array(await crypto.subtle.digest(name, buffer));
  return [...out].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function entropy(bytes, start=0, end=bytes.length){
  const len=end-start; if(len<=0) return 0;
  const counts=new Uint32Array(256);
  for(let i=start;i<end;i++) counts[bytes[i]]++;
  let e=0;
  for(const c of counts){ if(!c) continue; const p=c/len; e-=p*Math.log2(p); }
  return e;
}
function getMagic(bytes){
  if(startsWith(bytes,[0x52,0x49,0x46,0x46]) && ascii(bytes,8,4)==='WAVE') return {name:'WAV', ext:['wav']};
  if(bytes.length>12 && ascii(bytes,4,4)==='ftyp') return {name:'MP4/M4A', ext:['mp4','m4a','mov']};
  for(const m of MAGIC) if(startsWith(bytes,m.sig)) return m;
  if(bytes.length>2 && bytes[0]===0xff && (bytes[1]&0xe0)===0xe0) return {name:'MP3 frame stream',ext:['mp3']};
  return {name:'Unknown / no recognized leading signature', ext:[]};
}

function extractAsciiStrings(bytes, min=5){
  const out=[]; let start=-1;
  for(let i=0;i<=bytes.length;i++){
    const b=i<bytes.length?bytes[i]:0;
    const printable=b>=0x20 && b<=0x7e;
    if(printable && start<0) start=i;
    if(!printable && start>=0){
      if(i-start>=min) out.push({offset:start,text:ascii(bytes,start,Math.min(i-start,500))});
      start=-1; if(out.length>=MAX_STRINGS) break;
    }
  }
  return out;
}
function extractUtf16Strings(bytes, minChars=5){
  const out=[];
  for(let i=0;i<bytes.length-1;i++){
    let j=i, chars='';
    while(j+1<bytes.length && bytes[j]>=0x20 && bytes[j]<=0x7e && bytes[j+1]===0){ chars+=String.fromCharCode(bytes[j]); j+=2; if(chars.length>=500) break; }
    if(chars.length>=minChars){ out.push({offset:i,text:chars,kind:'UTF-16LE'}); i=j-1; }
    if(out.length>=300) break;
  }
  return out;
}

function validatePE(bytes, mzOff){
  if(mzOff+0x40>bytes.length) return null;
  const rel=u32le(bytes,mzOff+0x3c);
  if(rel===null || rel<0x40 || rel>16*1024*1024) return null;
  const pe=mzOff+rel;
  if(pe+4<=bytes.length && startsWith(bytes,[0x50,0x45,0x00,0x00],pe)) return {mz:mzOff, pe};
  return null;
}

function scanSignatures(bytes){
  const hits=[];
  const sigs=[
    ['PDF',[0x25,0x50,0x44,0x46,0x2d]], ['ZIP',[0x50,0x4b,0x03,0x04]], ['PNG',[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]],
    ['JPEG',[0xff,0xd8,0xff]], ['ELF',[0x7f,0x45,0x4c,0x46]], ['SQLite',[0x53,0x51,0x4c,0x69,0x74,0x65,0x20,0x66,0x6f,0x72,0x6d,0x61,0x74,0x20,0x33,0x00]],
    ['FLAC',[0x66,0x4c,0x61,0x43]], ['Ogg',[0x4f,0x67,0x67,0x53]], ['RIFF',[0x52,0x49,0x46,0x46]]
  ];
  for(const [name,sig] of sigs){
    for(const off of findAll(bytes,sig,40)) hits.push({name,offset:off,validated:true});
  }
  for(const off of findAll(bytes,[0x4d,0x5a],80)){
    const pe=validatePE(bytes,off);
    hits.push({name:pe?'Windows PE-like structure':'MZ marker',offset:off,validated:!!pe,peOffset:pe?.pe});
  }
  return hits.sort((a,b)=>a.offset-b.offset);
}

function analyzePdf(bytes, findings, tree){
  const text=new TextDecoder('latin1').decode(bytes);
  const markers=['/JavaScript','/JS','/OpenAction','/Launch','/EmbeddedFile','/AcroForm','/URI'];
  const present=markers.filter(m=>text.includes(m));
  tree.push(`├── PDF markers: ${present.length?present.join(', '):'none of the monitored action markers found'}`);
  present.forEach(m=>findings.push({level:m==='/Launch'?'strong':'notice',title:`PDF marker ${m} present`,detail:'This is a structural observation. The referenced object should be inspected before drawing conclusions.'}));
  const eof=[...text.matchAll(/%%EOF/g)].map(m=>m.index);
  if(eof.length){
    const end=eof[eof.length-1]+5;
    let p=end; while(p<bytes.length && [0x00,0x09,0x0a,0x0d,0x20].includes(bytes[p])) p++;
    const trailing=bytes.length-p;
    tree.push(`├── Last %%EOF: ${hex(eof[eof.length-1])}`);
    tree.push(`└── Data after logical EOF: ${fmtBytes(trailing)}`);
    if(trailing>32) findings.push({level:'strong',title:'Data exists after the PDF logical EOF',detail:`Approximately ${fmtBytes(trailing)} remains after whitespace following the final %%EOF marker.`});
  }
}

function analyzePng(bytes, findings, tree){
  let off=8, chunks=[], iendEnd=null;
  while(off+12<=bytes.length && chunks.length<10000){
    const len=u32be(bytes,off); const type=ascii(bytes,off+4,4); const end=off+12+len;
    if(!/^[A-Za-z]{4}$/.test(type) || end>bytes.length) break;
    chunks.push({type,len,off});
    off=end;
    if(type==='IEND'){ iendEnd=end; break; }
  }
  tree.push(`├── PNG chunks: ${chunks.length}`);
  tree.push(`├── Chunk types: ${[...new Set(chunks.map(c=>c.type))].join(', ')}`);
  if(iendEnd!==null){
    const trailing=bytes.length-iendEnd; tree.push(`└── Data after IEND: ${fmtBytes(trailing)}`);
    if(trailing>0) findings.push({level:'strong',title:'Trailing data after PNG IEND',detail:`${fmtBytes(trailing)} occurs after the logical end of the PNG container.`});
  }
  const textChunks=chunks.filter(c=>['tEXt','zTXt','iTXt'].includes(c.type));
  if(textChunks.length) findings.push({level:'notice',title:'PNG text metadata chunks present',detail:`${textChunks.length} textual metadata chunk(s) can carry comments or application-defined data.`});
}

function analyzeJpeg(bytes, findings, tree){
  let eoi=-1;
  for(let i=2;i<bytes.length-1;i++){ if(bytes[i]===0xff && bytes[i+1]===0xd9){ eoi=i+2; break; } }
  if(eoi>0){
    const trailing=bytes.length-eoi; tree.push(`└── Data after first JPEG EOI: ${fmtBytes(trailing)}`);
    if(trailing>32) findings.push({level:'strong',title:'Trailing data after JPEG end marker',detail:`${fmtBytes(trailing)} exists after the first EOI marker. Some valid files may contain additional structures, so inspect the region.`});
  }
}

function analyzeWav(bytes, findings, tree){
  if(!(startsWith(bytes,[0x52,0x49,0x46,0x46]) && ascii(bytes,8,4)==='WAVE')) return;
  const declared=(u32le(bytes,4)||0)+8;
  tree.push(`├── RIFF declared size: ${fmtBytes(declared)}`);
  let off=12, chunks=[];
  while(off+8<=Math.min(declared,bytes.length) && chunks.length<1000){
    const type=ascii(bytes,off,4), len=u32le(bytes,off+4); if(len===null) break;
    if(!/^[\x20-\x7e]{4}$/.test(type)) break;
    chunks.push({type,len,off}); off+=8+len+(len%2);
  }
  tree.push(`├── WAV chunks: ${chunks.map(c=>c.type).join(', ')||'not parsed'}`);
  const trailing=Math.max(0,bytes.length-declared);
  tree.push(`└── Data beyond declared RIFF: ${fmtBytes(trailing)}`);
  if(trailing>0) findings.push({level:'strong',title:'Bytes exist beyond the declared RIFF container',detail:`${fmtBytes(trailing)} occurs after the RIFF size boundary.`});
  const unusual=chunks.filter(c=>!['fmt ','data','LIST','INFO','fact','JUNK','PAD '].includes(c.type));
  if(unusual.length) findings.push({level:'notice',title:'Nonstandard or less-common WAV chunks observed',detail:unusual.slice(0,12).map(c=>`${c.type} (${fmtBytes(c.len)})`).join(', ')});
}

function analyzeAudioMeta(bytes, magic, findings, tree){
  if(magic.name==='MP3/ID3' && bytes.length>=10){
    const sz=((bytes[6]&0x7f)<<21)|((bytes[7]&0x7f)<<14)|((bytes[8]&0x7f)<<7)|(bytes[9]&0x7f);
    tree.push(`└── ID3v2 declared tag body: ${fmtBytes(sz)}`);
    if(sz>1024*1024) findings.push({level:'notice',title:'Large ID3 metadata region',detail:`The ID3v2 tag declares about ${fmtBytes(sz)} of metadata. Large tags can legitimately contain artwork, but merit inspection.`});
  }
  if(magic.name==='FLAC') tree.push('└── FLAC stream marker observed; embedded-signature and string scans still apply.');
  if(magic.name==='Ogg') tree.push('└── Ogg page marker observed; embedded-signature and string scans still apply.');
  if(magic.name==='MP4/M4A') tree.push('└── ISO Base Media / MP4-style ftyp atom observed.');
}

function makeHex(bytes, max=768){
  const lines=[]; const n=Math.min(bytes.length,max);
  for(let off=0;off<n;off+=16){
    const chunk=bytes.slice(off,Math.min(off+16,n));
    const h=[...chunk].map(b=>b.toString(16).padStart(2,'0')).join(' ').padEnd(47,' ');
    const a=[...chunk].map(b=>b>=32&&b<=126?String.fromCharCode(b):'.').join('');
    lines.push(`${off.toString(16).padStart(8,'0')}  ${h}  |${a}|`);
  }
  if(bytes.length>max) lines.push(`\n… first ${fmtBytes(max)} shown of ${fmtBytes(bytes.length)} …`);
  return lines.join('\n');
}

function renderFindings(findings){
  const root=$('#findings'); root.innerHTML='';
  if(!findings.length) findings.push({level:'info',title:'No monitored structural anomaly was identified',detail:'This does not establish that the file is safe. Static inspection has limits.'});
  for(const f of findings){
    const div=document.createElement('div'); div.className='finding';
    div.innerHTML=`<div class="finding-head"><strong>${escapeHtml(f.title)}</strong><span class="finding-level ${f.level}">${f.level.toUpperCase()}</span></div><p>${escapeHtml(f.detail)}</p>`;
    root.appendChild(div);
  }
}

function renderStats(file, magic, hashes, e){
  const data=[['FILE',file.name],['SIZE',fmtBytes(file.size)],['OBSERVED TYPE',magic.name],['ENTROPY',`${e.toFixed(3)} / 8`]];
  const root=$('#summary-stats'); root.innerHTML='';
  data.forEach(([k,v])=>{ const d=document.createElement('div'); d.className='tool-stat'; d.innerHTML=`<span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong>`; root.appendChild(d); });
  for(const [k,v] of Object.entries(hashes)){
    const d=document.createElement('div'); d.className='tool-stat'; d.style.gridColumn='1 / -1'; d.innerHTML=`<span>${k}</span><strong class="hash-value">${v}</strong>`; root.appendChild(d);
  }
}

function renderEntropy(bytes){
  const root=$('#entropy-bars'); root.innerHTML='';
  const blocks=[];
  for(let off=0;off<bytes.length;off+=BLOCK_SIZE){ blocks.push({off,e:entropy(bytes,off,Math.min(off+BLOCK_SIZE,bytes.length))}); if(blocks.length>=350) break; }
  for(const b of blocks){
    const row=document.createElement('div'); row.className='entropy-row';
    row.innerHTML=`<span>${hex(b.off,6)}</span><div class="entropy-bar"><i style="width:${(b.e/8*100).toFixed(1)}%"></i></div><strong>${b.e.toFixed(2)}</strong>`;
    root.appendChild(row);
  }
  if(bytes.length>BLOCK_SIZE*350){ const p=document.createElement('p'); p.className='analysis-note'; p.textContent='Entropy visualization is capped at the first 350 blocks to keep the browser responsive.'; root.appendChild(p); }
}

function renderStrings(strings){
  const root=$('#string-list');
  if(!strings.length){ root.textContent='No printable strings meeting the minimum length were found.'; return; }
  root.innerHTML=strings.slice(0,MAX_STRINGS).map(s=>`${hex(s.offset,8)}  ${s.kind?`[${s.kind}] `:''}${escapeHtml(s.text)}`).join('<br>');
}

function setupTabs(){
  $$('.tab').forEach(btn=>btn.addEventListener('click',()=>{
    $$('.tab').forEach(x=>x.classList.toggle('active',x===btn));
    $$('.tab-pane').forEach(p=>p.classList.toggle('active',p.id===`pane-${btn.dataset.tab}`));
  }));
}

async function setupImageLab(file){
  if(!file.type.startsWith('image/')) return;
  try{
    const bmp=await createImageBitmap(file);
    const max=720, scale=Math.min(1,max/bmp.width,max/bmp.height);
    const w=Math.max(1,Math.round(bmp.width*scale)), h=Math.max(1,Math.round(bmp.height*scale));
    const c=$('#image-original'), b=$('#image-bitplane'); c.width=b.width=w; c.height=b.height=h;
    const cx=c.getContext('2d',{willReadFrequently:true}); cx.drawImage(bmp,0,0,w,h);
    currentImageData=cx.getImageData(0,0,w,h);
    $('#image-tab').hidden=false;
    const controls=$('#bit-controls'); controls.innerHTML='';
    ['R0','G0','B0','A0'].forEach((name,i)=>{
      const btn=document.createElement('button'); btn.textContent=name; btn.dataset.channel=i; if(i===2) btn.classList.add('active');
      btn.addEventListener('click',()=>{ $$('#bit-controls button').forEach(x=>x.classList.toggle('active',x===btn)); renderBitPlane(i); }); controls.appendChild(btn);
    });
    renderBitPlane(2);
  }catch(err){ $('#image-note').textContent=`Image pixel analysis unavailable: ${err.message}`; }
}

function renderBitPlane(channel){
  if(!currentImageData) return;
  const src=currentImageData.data, out=new ImageData(currentImageData.width,currentImageData.height); let ones=0, samples=0;
  for(let i=0;i<src.length;i+=4){
    const bit=src[i+channel]&1; ones+=bit; samples++;
    const v=bit?255:0; out.data[i]=v; out.data[i+1]=v; out.data[i+2]=v; out.data[i+3]=255;
  }
  const ctx=$('#image-bitplane').getContext('2d'); ctx.putImageData(out,0,0);
  const ratio=ones/Math.max(1,samples);
  $('#image-note').textContent=`${['Red','Green','Blue','Alpha'][channel]} least-significant bit: ${(ratio*100).toFixed(2)}% ones across the decoded pixels. Visible structure or strong statistical bias may warrant deeper steganographic analysis; neither alone proves hidden content.`;
}

async function analyze(file){
  if(file.size>MAX_FILE_SIZE){ alert('For browser stability, this public build analyzes files up to 64 MB.'); return; }
  const buffer=await file.arrayBuffer(); const bytes=new Uint8Array(buffer); currentBytes=bytes; currentFile=file; currentImageData=null;
  const magic=getMagic(bytes), extension=extOf(file.name), findings=[], tree=[];
  const hashes={
    'SHA-256': await digest('SHA-256',buffer),
    'SHA-1 (legacy forensic comparison)': await digest('SHA-1',buffer)
  };
  const e=entropy(bytes);

  tree.push(`${file.name}`);
  tree.push(`├── Declared extension: .${extension||'(none)'}`);
  tree.push(`├── Observed leading signature: ${magic.name}`);
  tree.push(`├── Size: ${fmtBytes(bytes.length)}`);
  tree.push(`├── Shannon entropy: ${e.toFixed(3)} / 8`);

  if(magic.ext.length && extension && !magic.ext.includes(extension)) findings.push({level:'strong',title:'Extension and observed file signature disagree',detail:`The filename ends in .${extension}, while the leading bytes resemble ${magic.name}.`});
  if(e>7.6) findings.push({level:'notice',title:'High overall byte entropy',detail:'High entropy can result from compression or encryption, but can also reduce the usefulness of simple string inspection.'});

  const hits=scanSignatures(bytes);
  const secondary=hits.filter(h=>h.offset>0 || (h.name==='Windows PE-like structure' && magic.name!=='Windows MZ'));
  tree.push(`├── Embedded / secondary signature candidates: ${secondary.length}`);
  secondary.slice(0,30).forEach((h,i)=>tree.push(`${i===Math.min(secondary.length,30)-1?'│   └':'│   ├'}── ${h.name} @ ${hex(h.offset)}${h.peOffset!==undefined?` → PE @ ${hex(h.peOffset)}`:''}`));
  for(const h of secondary.filter(h=>h.name==='Windows PE-like structure')) findings.push({level:'strong',title:'Validated PE-like structure found inside the file',detail:`An MZ header at ${hex(h.offset)} contains a DOS PE offset that resolves to PE\\0\\0 at ${hex(h.peOffset)}. This is stronger than a coincidental “MZ” byte sequence.`});
  const otherEmbedded=secondary.filter(h=>h.validated && h.name!=='Windows PE-like structure' && h.offset>64);
  if(otherEmbedded.length) findings.push({level:'notice',title:'Secondary file signatures were found',detail:otherEmbedded.slice(0,8).map(h=>`${h.name} @ ${hex(h.offset)}`).join(', ')});

  if(magic.name==='PDF') analyzePdf(bytes,findings,tree);
  if(magic.name==='PNG') analyzePng(bytes,findings,tree);
  if(magic.name==='JPEG') analyzeJpeg(bytes,findings,tree);
  if(magic.name==='WAV') analyzeWav(bytes,findings,tree);
  if(['MP3/ID3','MP3 frame stream','FLAC','Ogg','MP4/M4A'].includes(magic.name)) analyzeAudioMeta(bytes,magic,findings,tree);

  const strings=[...extractAsciiStrings(bytes),...extractUtf16Strings(bytes)].sort((a,b)=>a.offset-b.offset).slice(0,MAX_STRINGS);
  const stringBlob=strings.map(s=>s.text).join('\n');
  const urlCount=(stringBlob.match(/https?:\/\//gi)||[]).length;
  const commandTokens=['powershell','cmd.exe','wscript','cscript','rundll32','mshta','/bin/sh','/bin/bash'];
  const foundTokens=commandTokens.filter(t=>stringBlob.toLowerCase().includes(t));
  if(urlCount) findings.push({level:'info',title:'URL-like strings observed',detail:`At least ${urlCount} http/https string occurrence(s) appear in printable content.`});
  if(foundTokens.length) findings.push({level:'notice',title:'Command/interpreter-related strings observed',detail:`Printable content includes: ${foundTokens.join(', ')}. Presence alone does not establish execution.`});

  tree.push(`└── Printable strings retained for review: ${strings.length}`);
  renderStats(file,magic,hashes,e); renderFindings(findings); $('#artifact-tree').textContent=tree.join('\n');
  renderStrings(strings); renderEntropy(bytes); $('#hex-view').textContent=makeHex(bytes);
  $('#results').hidden=false;
  await setupImageLab(file);
  $('#results').scrollIntoView({behavior:'smooth',block:'start'});
}

function setupDrop(){
  const dz=$('#drop-zone'), input=$('#file-input');
  input.addEventListener('change',()=>input.files[0]&&analyze(input.files[0]));
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
  dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0]; if(f) analyze(f);});
}

setupTabs(); setupDrop();
