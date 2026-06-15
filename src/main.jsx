import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  ChevronDown, ChevronUp, FileAudio, Pause, Play, Sparkles, Upload,
  Settings, X, Activity, BarChart2, Radio, Circle, Tv2,
  Atom, Star, Triangle, Hexagon, Zap, Sliders
} from "lucide-react";
import * as THREE from "three";
import "./styles.css";

// ─── Themes ───────────────────────────────────────────────────────────────────

const themes = {
  io:     { label:"IO Pop",      colors:["#4285f4","#34a853","#fbbc05","#ea4335","#ffffff"], background:["#101828","#1d2338","#090b12"], accent:"#fbbc05", accentRgb:"251,188,5",   cartoon:["spark","ring","blob","pill"] },
  candy:  { label:"Candy Toon",  colors:["#ff4f9a","#45f0df","#ffde59","#7057ff","#ffffff"], background:["#241130","#3f1747","#111827"], accent:"#45f0df", accentRgb:"69,240,223",  cartoon:["bubble","star","blob","wink"] },
  cyber:  { label:"Cyber Bloom", colors:["#00f5ff","#b5ff00","#ff2bd6","#6c5ce7","#f8fafc"], background:["#06111f","#111827","#020617"], accent:"#00f5ff", accentRgb:"0,245,255",   cartoon:["bolt","ring","cube","comet"] },
  lava:   { label:"Lava Arcade", colors:["#ff3d00","#ffba08","#2ec4b6","#7b2cbf","#fff8e8"], background:["#1a0b13","#311018","#08070a"], accent:"#ffba08", accentRgb:"255,186,8",   cartoon:["flame","blob","spark","pill"] },
  ocean:  { label:"Ocean Glass", colors:["#00b4d8","#90e0ef","#48cae4","#ffd166","#f8fafc"], background:["#031926","#053b50","#071923"], accent:"#90e0ef", accentRgb:"144,224,239", cartoon:["bubble","ring","comet","blob"] },
  garden: { label:"Garden Pop",  colors:["#52b788","#d9ed92","#ffafcc","#4361ee","#ffffff"], background:["#071a12","#16351f","#0b1020"], accent:"#d9ed92", accentRgb:"217,237,146", cartoon:["star","blob","spark","pill"] },
  mono:   { label:"Mono Club",   colors:["#f8fafc","#94a3b8","#111827","#ef4444","#22d3ee"], background:["#030712","#18181b","#020617"], accent:"#ef4444", accentRgb:"239,68,68",   cartoon:["cube","ring","bolt","pill"] },
  sunset: { label:"Sunset Jam",  colors:["#ff006e","#fb5607","#ffbe0b","#3a86ff","#f8fafc"], background:["#22092c","#421b36","#10051d"], accent:"#ffbe0b", accentRgb:"255,190,11",  cartoon:["flame","star","comet","blob"] },
};

// ─── Colour helpers ───────────────────────────────────────────────────────────

const hexCache = {};
function hexRgb(hex) {
  if (!hexCache[hex]) hexCache[hex] = `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
  return hexCache[hex];
}
function rgba(hex, a) { return `rgba(${hexRgb(hex)},${a})`; }

// ─── Default custom params ────────────────────────────────────────────────────

const DEFAULT_CUSTOM = {
  ringSize:    0.28,   // 0.1–0.5
  dotCount:    120,    // 20–300
  barHeight:   0.18,   // 0.05–0.4
  symmetry:    1,      // 1–8  (mirror copies)
  glow:        0.6,    // 0–1
  rotSpeed:    0.5,    // 0–1
  colorMix:    0.5,    // 0=mono accent, 1=full palette
};

// ─── Canvas visualiser draw functions ────────────────────────────────────────

// 1. COSMIC
function drawCosmic(ctx, W, H, v, theme, state, _params) {
  const { beat, bass, highs, active, rawData, isBeat } = v;
  const cx=W/2, cy=H/2, minDim=Math.min(W,H);
  const ringR = minDim*0.28 + bass*minDim*0.04*active;
  const BAR_COUNT=Math.min(160,rawData.length), DOT_COUNT=120;

  if(isBeat&&!state.lastBeat){ state.rings.push({r:ringR,maxR:ringR+minDim*0.55,born:performance.now()}); if(state.rings.length>6)state.rings.shift(); }
  state.lastBeat=isBeat;
  for(let ri=state.rings.length-1;ri>=0;ri--){
    const rng=state.rings[ri], age=(performance.now()-rng.born)/900;
    if(age>=1){state.rings.splice(ri,1);continue;}
    ctx.beginPath(); ctx.arc(cx,cy,rng.r+(rng.maxR-rng.r)*age,0,Math.PI*2);
    ctx.strokeStyle=`rgba(${theme.accentRgb},${(0.65*(1-age)*(1-age)).toFixed(3)})`;
    ctx.lineWidth=2.5-age*2; ctx.stroke();
  }
  if(active>0.01){
    ctx.save(); ctx.translate(cx,cy);
    ctx.beginPath();
    for(let i=0;i<BAR_COUNT;i++){
      const val=rawData[i]/255, r=ringR+val*minDim*0.18*active;
      const a=i*(Math.PI*2/BAR_COUNT)-Math.PI/2;
      i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    ctx.closePath();
    const g=ctx.createRadialGradient(0,0,ringR*0.5,0,0,ringR+minDim*0.2);
    g.addColorStop(0,`rgba(${theme.accentRgb},0)`); g.addColorStop(0.5,`rgba(${theme.accentRgb},${(0.07*active).toFixed(3)})`); g.addColorStop(1,`rgba(${theme.accentRgb},0)`);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=`rgba(${theme.accentRgb},${(0.55+beat*0.35).toFixed(3)})`; ctx.lineWidth=1.5+beat*2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,ringR,0,Math.PI*2);
    ctx.strokeStyle=`rgba(${theme.accentRgb},${(0.1+active*0.08).toFixed(3)})`; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
    const bT=Math.floor(H*0.5/5), ep=14;
    for(let i=0;i<bT;i++){
      const di=Math.floor((i/bT)*Math.min(128,rawData.length)), val=(rawData[di]/255)*active;
      const bh=Math.max(3,val*H/bT), bw=bh*W*0.058;
      const yA=H/2-i*5-bh/2, yB=H/2+i*5-bh/2;
      ctx.fillStyle=rgba(theme.colors[i%theme.colors.length],(0.3+val*0.55).toFixed(3));
      ctx.fillRect(ep,yA,bw,3); ctx.fillRect(ep,yB,bw,3); ctx.fillRect(W-ep-bw,yA,bw,3); ctx.fillRect(W-ep-bw,yB,bw,3);
    }
    const orbitR=ringR*1.45+highs*minDim*0.08*active, t=performance.now()/6000;
    for(let i=0;i<DOT_COUNT;i++){
      const val=rawData[Math.floor((i/DOT_COUNT)*Math.min(rawData.length,256))]/255;
      const a=(i/DOT_COUNT)*Math.PI*2+t, r=orbitR+val*minDim*0.16*active+beat*minDim*0.04;
      ctx.beginPath(); ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,1.5+val*4*active+beat*2,0,Math.PI*2);
      ctx.fillStyle=rgba(theme.colors[i%theme.colors.length],(0.28+val*0.72*active).toFixed(3)); ctx.fill();
    }
  }
}

// 2. SPECTRUM BARS
function drawBars(ctx, W, H, v, theme, _s, _p) {
  const { rawData, active, beat } = v;
  const BARS=Math.min(120,rawData.length), gap=2, barW=(W-gap*(BARS-1))/BARS, maxH=H*0.9;
  for(let i=0;i<BARS;i++){
    const val=(rawData[i]/255)*(active>0.5?1:0.08), bh=Math.max(2,val*maxH), x=i*(barW+gap);
    const col=theme.colors[i%theme.colors.length];
    ctx.shadowColor=rgba(col,0.6); ctx.shadowBlur=8+beat*18;
    const g=ctx.createLinearGradient(0,H,0,H-bh);
    g.addColorStop(0,rgba(col,(0.55+val*0.45).toFixed(3))); g.addColorStop(1,rgba(theme.colors[(i+2)%theme.colors.length],"0.9"));
    ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(x,H-bh,barW,bh,[3,3,0,0]); ctx.fill();
    ctx.globalAlpha=0.28; ctx.beginPath(); ctx.roundRect(x,0,barW,bh*0.4,[0,0,2,2]); ctx.fill(); ctx.globalAlpha=1;
  }
  ctx.shadowBlur=0;
}

// 3. OSCILLOSCOPE
function drawOscilloscope(ctx, W, H, v, theme, state, _p) {
  const { active, beat, rawData } = v;
  const len=Math.min(rawData.length,256), cy=H/2, amp=H*0.38*(active>0.5?1:0.08);
  if(state.prevPath){ ctx.beginPath(); state.prevPath.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.strokeStyle=`rgba(${theme.accentRgb},0.06)`; ctx.lineWidth=3; ctx.stroke(); }
  const pts=[];
  ctx.beginPath();
  for(let i=0;i<len;i++){ const y=cy+((rawData[i]/255)*2-1)*amp; pts.push([(i/len)*W,y]); i===0?ctx.moveTo(pts[0][0],pts[0][1]):ctx.lineTo(pts[i][0],pts[i][1]); }
  ctx.shadowColor=rgba(theme.accent,0.8); ctx.shadowBlur=12+beat*24;
  ctx.strokeStyle=`rgba(${theme.accentRgb},${(0.7+beat*0.3).toFixed(3)})`; ctx.lineWidth=2+beat*2; ctx.lineJoin="round"; ctx.stroke();
  ctx.shadowBlur=0;
  ctx.beginPath();
  for(let i=0;i<len;i++){ const y=cy+((rawData[Math.floor(i*1.5)%len]/255)*2-1)*amp*0.5; i===0?ctx.moveTo((i/len)*W,y):ctx.lineTo((i/len)*W,y); }
  ctx.strokeStyle=rgba(theme.colors[2],(0.25+beat*0.2).toFixed(3)); ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(W,cy); ctx.strokeStyle=`rgba(${theme.accentRgb},0.1)`; ctx.lineWidth=1; ctx.stroke();
  state.prevPath=pts;
}

// 4. TUNNEL
function drawTunnel(ctx, W, H, v, theme, _s, _p) {
  const { active, beat, bass, rawData } = v;
  const cx=W/2, cy=H/2, maxR=Math.sqrt(cx*cx+cy*cy)*1.1, RINGS=18, t=performance.now()/1800;
  for(let i=0;i<RINGS;i++){
    const phase=((i/RINGS)+t*0.22)%1, r=phase*maxR;
    const di=Math.floor(phase*Math.min(rawData.length,255)), energy=(rawData[di]/255)*active;
    const col=theme.colors[i%theme.colors.length], alpha=(1-phase)*(0.3+energy*0.5+beat*0.2), thick=(1-phase)*(2+energy*4+beat*3);
    ctx.beginPath(); ctx.ellipse(cx,cy,r*(1+bass*0.15*active*(1-phase)),r*(1-bass*0.075*active*(1-phase)),t*0.3,0,Math.PI*2);
    ctx.strokeStyle=rgba(col,alpha.toFixed(3)); ctx.lineWidth=thick; ctx.stroke();
  }
  if(beat>0.3&&active>0.5){
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR*0.35*beat);
    g.addColorStop(0,`rgba(${theme.accentRgb},${(beat*0.45).toFixed(3)})`); g.addColorStop(1,`rgba(${theme.accentRgb},0)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,maxR*0.35*beat,0,Math.PI*2); ctx.fill();
  }
}

// 5. LISSAJOUS
function drawLissajous(ctx, W, H, v, theme, state, _p) {
  const { active, beat, rawData } = v;
  const cx=W/2, cy=H/2, span=Math.min(cx,cy)*0.82, len=Math.min(rawData.length,256), t=performance.now()/4000;
  if(state.prevPts&&state.prevPts.length>1){ ctx.beginPath(); state.prevPts.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.strokeStyle=`rgba(${theme.accentRgb},0.04)`; ctx.lineWidth=2; ctx.stroke(); }
  const pts=[];
  for(let i=0;i<len;i++){
    const xV=(rawData[i]/255)*2-1, yV=(rawData[(i+Math.floor(len/4))%len]/255)*2-1;
    const dx=Math.sin(t*1.3+i*0.04)*0.15*(1-active), dy=Math.cos(t*0.9+i*0.05)*0.15*(1-active);
    pts.push([cx+(xV+dx)*span*active+dx*span, cy+(yV+dy)*span*active+dy*span]);
  }
  for(let i=1;i<pts.length;i++){
    const frac=i/pts.length, col=theme.colors[Math.floor(frac*theme.colors.length)];
    ctx.beginPath(); ctx.moveTo(pts[i-1][0],pts[i-1][1]); ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.strokeStyle=rgba(col,((0.4+frac*0.5)*(active>0.5?1:0.12)).toFixed(3)); ctx.lineWidth=1+beat*2; ctx.stroke();
  }
  const last=pts[pts.length-1];
  ctx.shadowColor=rgba(theme.accent,0.9); ctx.shadowBlur=16+beat*20;
  ctx.beginPath(); ctx.arc(last[0],last[1],3+beat*5,0,Math.PI*2);
  ctx.fillStyle=`rgba(${theme.accentRgb},${(0.7+beat*0.3).toFixed(3)})`; ctx.fill(); ctx.shadowBlur=0;
  state.prevPts=pts;
}

// 6. DNA HELIX
function drawDNA(ctx, W, H, v, theme, _s, _p) {
  const { rawData, active, beat, bass } = v;
  const len=Math.min(rawData.length,128), cy=H/2, t=performance.now()/1200;
  const step=W/len, amp=H*0.25*(active>0.5?1:0.1);
  // cross-links
  for(let i=0;i<len;i+=4){
    const x=i*step+step/2, phase=(i/len)*Math.PI*6+t;
    const y1=cy+Math.sin(phase)*amp*(0.8+(rawData[i]/255)*0.5*active);
    const y2=cy+Math.sin(phase+Math.PI)*amp*(0.8+(rawData[i]/255)*0.5*active);
    ctx.beginPath(); ctx.moveTo(x,y1); ctx.lineTo(x,y2);
    ctx.strokeStyle=rgba(theme.colors[2],(0.15+beat*0.2).toFixed(3)); ctx.lineWidth=1.5; ctx.stroke();
  }
  // strand A
  ctx.beginPath();
  for(let i=0;i<len;i++){
    const x=i*step, val=rawData[i]/255, phase=(i/len)*Math.PI*6+t;
    const y=cy+Math.sin(phase)*amp*(0.8+val*0.5*active);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.shadowColor=rgba(theme.accent,0.7); ctx.shadowBlur=8+beat*14;
  ctx.strokeStyle=`rgba(${theme.accentRgb},${(0.8+beat*0.2).toFixed(3)})`; ctx.lineWidth=2.5+bass*4*active; ctx.stroke();
  // strand B
  ctx.beginPath();
  for(let i=0;i<len;i++){
    const x=i*step, val=rawData[i]/255, phase=(i/len)*Math.PI*6+t+Math.PI;
    const y=cy+Math.sin(phase)*amp*(0.8+val*0.5*active);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.strokeStyle=rgba(theme.colors[1],(0.8+beat*0.2).toFixed(3)); ctx.lineWidth=2.5; ctx.stroke();
  ctx.shadowBlur=0;
  // dots on strands
  for(let i=0;i<len;i+=3){
    const x=i*step, val=rawData[i]/255, phase=(i/len)*Math.PI*6+t;
    const y=cy+Math.sin(phase)*amp*(0.8+val*0.5*active);
    ctx.beginPath(); ctx.arc(x,y,2+val*4*active,0,Math.PI*2);
    ctx.fillStyle=rgba(theme.colors[i%theme.colors.length],(0.7+val*0.3).toFixed(3)); ctx.fill();
  }
}

// 7. STARFIELD
function drawStarfield(ctx, W, H, v, theme, state, _p) {
  const { active, beat, bass, rawData } = v;
  const cx=W/2, cy=H/2;
  if(!state.stars){
    state.stars=Array.from({length:250},()=>({
      x:(Math.random()-0.5)*2, y:(Math.random()-0.5)*2,
      z:Math.random(), speed:0.0006+Math.random()*0.001,
      col:theme.colors[Math.floor(Math.random()*theme.colors.length)]
    }));
  }
  state.stars.forEach(s=>{
    s.z-=s.speed*(1+bass*8*active+beat*6);
    if(s.z<=0) s.z=1;
    const sx=cx+s.x/s.z*(W*0.5), sy=cy+s.y/s.z*(H*0.5);
    const size=(1-s.z)*4*(1+bass*2*active);
    const alpha=Math.min(1,(1-s.z)*(0.5+active*0.5));
    const di=Math.floor(s.z*Math.min(rawData.length-1,255));
    ctx.beginPath(); ctx.arc(sx,sy,size*(0.5+(rawData[di]/255)*0.5*active),0,Math.PI*2);
    ctx.fillStyle=rgba(s.col,alpha.toFixed(3)); ctx.fill();
    if(size>2&&active>0.5){
      ctx.beginPath(); ctx.moveTo(cx+(sx-cx)*0.96,cy+(sy-cy)*0.96); ctx.lineTo(sx,sy);
      ctx.strokeStyle=rgba(s.col,(alpha*0.5).toFixed(3)); ctx.lineWidth=size*0.4; ctx.stroke();
    }
  });
}

// 8. KALEIDOSCOPE
function drawKaleidoscope(ctx, W, H, v, theme, _s, _p) {
  const { rawData, active, beat, bass } = v;
  const cx=W/2, cy=H/2, minDim=Math.min(W,H), slices=8, t=performance.now()/3000;
  ctx.save(); ctx.translate(cx,cy);
  for(let s=0;s<slices;s++){
    ctx.save(); ctx.rotate((s/slices)*Math.PI*2+t*0.1);
    ctx.beginPath(); ctx.moveTo(0,0);
    const pts=Math.min(rawData.length,64);
    for(let i=0;i<pts;i++){
      const val=rawData[i]/255*(active>0.5?1:0.06), r=val*minDim*0.45, angle=(i/pts)*Math.PI/slices;
      ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
    }
    ctx.closePath();
    const col=theme.colors[s%theme.colors.length];
    const g=ctx.createRadialGradient(0,0,0,0,0,minDim*0.45);
    g.addColorStop(0,rgba(col,(0.4+beat*0.4).toFixed(3))); g.addColorStop(1,rgba(col,"0"));
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=rgba(col,(0.3+bass*0.5*active).toFixed(3)); ctx.lineWidth=1+beat*2; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// 9. CUSTOM (parametric cosmic)
function drawCustom(ctx, W, H, v, theme, state, params) {
  const { beat, bass, highs, active, rawData, isBeat } = v;
  const p = params;
  const cx=W/2, cy=H/2, minDim=Math.min(W,H);
  const ringR=minDim*p.ringSize + bass*minDim*0.04*active;
  const BAR_COUNT=Math.min(200,rawData.length);
  const DOT_COUNT=Math.round(p.dotCount);
  const glowStr=p.glow*20;
  const sym=Math.round(p.symmetry);
  const t=performance.now()/(6000*(1.01-p.rotSpeed));

  // Beat rings
  if(isBeat&&!state.lastBeat){ state.rings.push({r:ringR,maxR:ringR+minDim*0.55,born:performance.now()}); if(state.rings.length>8)state.rings.shift(); }
  state.lastBeat=isBeat;
  for(let ri=state.rings.length-1;ri>=0;ri--){
    const rng=state.rings[ri], age=(performance.now()-rng.born)/900;
    if(age>=1){state.rings.splice(ri,1);continue;}
    ctx.beginPath(); ctx.arc(cx,cy,rng.r+(rng.maxR-rng.r)*age,0,Math.PI*2);
    ctx.shadowColor=`rgba(${theme.accentRgb},1)`; ctx.shadowBlur=glowStr;
    ctx.strokeStyle=`rgba(${theme.accentRgb},${(0.7*(1-age)*(1-age)).toFixed(3)})`; ctx.lineWidth=3-age*2.5; ctx.stroke(); ctx.shadowBlur=0;
  }
  // Symmetry rings
  if(active>0.01){
    for(let si=0;si<sym;si++){
      ctx.save(); ctx.translate(cx,cy); ctx.rotate((si/sym)*Math.PI*2);
      ctx.beginPath();
      for(let i=0;i<BAR_COUNT;i++){
        const val=rawData[i]/255;
        const colIdx=p.colorMix<0.5?0:i%theme.colors.length;
        const r=ringR+val*minDim*p.barHeight*active;
        const a=(i/BAR_COUNT)*Math.PI*2-Math.PI/2;
        i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      ctx.closePath();
      ctx.shadowColor=`rgba(${theme.accentRgb},1)`; ctx.shadowBlur=glowStr*0.5;
      ctx.strokeStyle=`rgba(${theme.accentRgb},${(0.5+beat*0.4).toFixed(3)})`; ctx.lineWidth=1.5+beat*2.5; ctx.stroke(); ctx.shadowBlur=0;
      ctx.restore();
    }
    // Dots
    const orbitR=ringR*1.5+highs*minDim*0.08*active;
    for(let i=0;i<DOT_COUNT;i++){
      const val=rawData[Math.floor((i/DOT_COUNT)*Math.min(rawData.length,256))]/255;
      const a=(i/DOT_COUNT)*Math.PI*2+t;
      const r=orbitR+val*minDim*p.barHeight*1.2*active+beat*minDim*0.05;
      const colHex=p.colorMix>0.5?theme.colors[i%theme.colors.length]:theme.accent;
      ctx.shadowColor=rgba(colHex,0.8); ctx.shadowBlur=glowStr*0.3;
      ctx.beginPath(); ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,1.5+val*5*active+beat*3,0,Math.PI*2);
      ctx.fillStyle=rgba(colHex,(0.3+val*0.7*active).toFixed(3)); ctx.fill(); ctx.shadowBlur=0;
    }
  }
}

// ─── VIS REGISTRY ─────────────────────────────────────────────────────────────

const VIS_TYPES = [
  { id:"cosmic",       label:"Cosmic",       icon:Circle,    draw:drawCosmic,       desc:"Polar ring with orbiting dots & beat rings",  solo:false },
  { id:"bars",         label:"Spectrum",     icon:BarChart2, draw:drawBars,         desc:"Classic frequency bars with glow",            solo:false },
  { id:"oscilloscope", label:"Oscilloscope", icon:Activity,  draw:drawOscilloscope, desc:"Time-domain waveform & harmonics",            solo:false },
  { id:"tunnel",       label:"Tunnel",       icon:Radio,     draw:drawTunnel,       desc:"Concentric rings rushing toward you",         solo:false },
  { id:"lissajous",    label:"Lissajous",    icon:Tv2,       draw:drawLissajous,    desc:"XY parametric Lissajous figure",              solo:false },
  { id:"dna",          label:"DNA Helix",    icon:Atom,      draw:drawDNA,          desc:"Twin frequency strands with cross-links",     solo:false },
  { id:"starfield",    label:"Starfield",    icon:Star,      draw:drawStarfield,    desc:"3D star rush that accelerates on beats",      solo:false },
  { id:"kaleidoscope", label:"Kaleidoscope", icon:Hexagon,   draw:drawKaleidoscope, desc:"Rotationally symmetric frequency mirror",     solo:false },
  { id:"solo3d",       label:"Solo 3D",      icon:Triangle,  draw:null,             desc:"One reactive 3D object — your whole stage",  solo:true  },
  { id:"custom",       label:"Custom",       icon:Sliders,   draw:drawCustom,       desc:"Build your own with sliders",                solo:false },
];

// ─── Solo 3D shapes menu ──────────────────────────────────────────────────────

const SOLO_SHAPES = [
  { id:"icosahedron", label:"Icosahedron" },
  { id:"torus",       label:"Torus"       },
  { id:"torusknot",   label:"Torus Knot"  },
  { id:"octahedron",  label:"Octahedron"  },
  { id:"sphere",      label:"Sphere"      },
];

// ─── Audio engine ─────────────────────────────────────────────────────────────

function useAudioEngine() {
  const metricsRef = useRef({ level:0,beat:0,bass:0,mids:0,highs:0,progress:0,active:0, rawData:new Uint8Array(512),frequencyData:new Uint8Array(64),isBeat:false });
  const [state,setState] = useState({ ready:false,playing:false,name:"",level:0,beat:0,bass:0,mids:0,highs:0,progress:0,frequencyData:new Uint8Array(64) });
  const refs = useRef({ audio:null,context:null,source:null,analyser:null,data:null,objectUrl:"",raf:0,prevSpectrum:null,fluxMean:0,fluxVar:0.002,lastBeatAt:0,lastFrameAt:0,lastUiAt:0 });

  const loadFile = async (file) => {
    if(!file)return;
    const audio=refs.current.audio??new Audio();
    if(refs.current.objectUrl)URL.revokeObjectURL(refs.current.objectUrl);
    refs.current.objectUrl=URL.createObjectURL(file);
    audio.pause(); audio.src=refs.current.objectUrl; audio.currentTime=0;
    audio.crossOrigin="anonymous"; audio.loop=false; audio.preload="auto";
    refs.current.audio=audio;
    if(!refs.current.context){
      const ctx=new AudioContext(), an=ctx.createAnalyser();
      an.fftSize=2048; an.smoothingTimeConstant=0.55;
      const src=ctx.createMediaElementSource(audio); src.connect(an); an.connect(ctx.destination);
      refs.current.context=ctx; refs.current.analyser=an; refs.current.source=src;
      refs.current.data=new Uint8Array(an.frequencyBinCount);
    }
    audio.onended=()=>setState(c=>({...c,playing:false,progress:0}));
    refs.current.prevSpectrum=null; refs.current.fluxMean=0; refs.current.fluxVar=0.002; refs.current.lastBeatAt=0;
    metricsRef.current={level:0,beat:0,bass:0,mids:0,highs:0,progress:0,active:0,rawData:new Uint8Array(512),frequencyData:new Uint8Array(64),isBeat:false};
    setState(c=>({...c,ready:true,playing:false,name:file.name,progress:0}));
  };

  const toggle = async () => {
    const {audio,context}=refs.current; if(!audio)return;
    if(context?.state==="suspended")await context.resume();
    if(audio.paused){ await audio.play(); metricsRef.current={...metricsRef.current,active:1}; setState(c=>({...c,playing:true})); }
    else { audio.pause(); metricsRef.current={...metricsRef.current,active:0,beat:0}; setState(c=>({...c,playing:false})); }
  };

  useEffect(()=>{
    const tick=()=>{
      const {analyser,data,audio,context}=refs.current;
      if(analyser&&data&&audio){
        analyser.getByteFrequencyData(data);
        const now=performance.now(), delta=Math.max(16,now-(refs.current.lastFrameAt||now));
        refs.current.lastFrameAt=now;
        const sr=context.sampleRate;
        const bass=ba(data,sr,35,160), mids=ba(data,sr,220,2100), highs=ba(data,sr,2400,9000), level=ba(data,sr,35,9000);
        const flux=sf(data,refs.current.prevSpectrum,sr);
        refs.current.prevSpectrum=new Uint8Array(data);
        const diff=flux-refs.current.fluxMean;
        refs.current.fluxMean+=diff*0.045; refs.current.fluxVar+=(diff*diff-refs.current.fluxVar)*0.045;
        const thr=refs.current.fluxMean+Math.max(0.012,Math.sqrt(refs.current.fluxVar)*1.25);
        const isBeat=flux>thr&&(bass>0.16||(bass+mids)*0.5>0.2)&&now-refs.current.lastBeatAt>210&&!audio.paused;
        if(isBeat)refs.current.lastBeatAt=now;
        const beat=isBeat?1:Math.max(0,metricsRef.current.beat*Math.pow(0.1,delta/400));
        const progress=audio.duration?audio.currentTime/audio.duration:0, active=audio.paused?0:1;
        const rawData=new Uint8Array(Math.min(512,data.length)); rawData.set(data.subarray(0,rawData.length));
        const freqData=new Uint8Array(64);
        for(let i=0;i<64;i++){const s=Math.floor((i/64)*(data.length*0.5)),e=Math.floor(((i+1)/64)*(data.length*0.5));let sum=0;for(let j=s;j<e;j++)sum+=data[j];freqData[i]=sum/Math.max(1,e-s);}
        metricsRef.current={level,bass,mids,highs,beat,progress,active,rawData,frequencyData:freqData,isBeat};
        if(now-refs.current.lastUiAt>90||isBeat){refs.current.lastUiAt=now;setState(c=>({...c,level,bass,mids,highs,beat,progress,frequencyData:freqData}));}
      }
      refs.current.raf=requestAnimationFrame(tick);
    };
    refs.current.raf=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(refs.current.raf);if(refs.current.objectUrl)URL.revokeObjectURL(refs.current.objectUrl);};
  },[]);

  return {audioState:state,metricsRef,loadFile,toggle};
}

function ba(data,sr,lo,hi){const ny=sr/2,s=Math.max(0,Math.floor((lo/ny)*data.length)),e=Math.min(data.length-1,Math.ceil((hi/ny)*data.length));let t=0,c=0;for(let i=s;i<=e;i++){t+=data[i];c++;}return c?t/c/255:0;}
function sf(data,prev,sr){if(!prev)return 0;const ny=sr/2,s=Math.max(0,Math.floor((35/ny)*data.length)),e=Math.min(data.length-1,Math.ceil((1850/ny)*data.length));let f=0,c=0;for(let i=s;i<=e;i++){const r=data[i]-prev[i];if(r>0)f+=r;c++;}return c?f/c/255:0;}

// ─── Canvas visualiser ────────────────────────────────────────────────────────

function CanvasVisualizer({ metricsRef, themeRef, visTypeRef, customParamsRef, optionsRef, hidden }) {
  const canvasRef = useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current, ctx=canvas.getContext("2d");
    const visStates={};
    VIS_TYPES.filter(vt=>!vt.solo).forEach(vt=>{ visStates[vt.id]={rings:[],prevPath:null,prevPts:null,prevPts2:null,lastBeat:false,stars:null}; });
    let W,H,dpr;
    const resize=()=>{dpr=Math.min(window.devicePixelRatio||1,1.5);W=window.innerWidth;H=window.innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.scale(dpr,dpr);};
    resize(); window.addEventListener("resize",resize);
    // Patch ctx.shadowBlur to be interceptable — we override the setter
    let _glowEnabled=true;
    const origShadowBlurDesc=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,"shadowBlur");
    Object.defineProperty(ctx,"shadowBlur",{
      get(){ return origShadowBlurDesc.get.call(this); },
      set(v){ origShadowBlurDesc.set.call(this, _glowEnabled ? v : 0); },
      configurable:true
    });
    let raf=0;
    const draw=()=>{
      _glowEnabled = optionsRef?.current?.glowEffects ?? true;
      const v=metricsRef.current, theme=themeRef.current, visId=visTypeRef.current;
      const vt=VIS_TYPES.find(x=>x.id===visId&&!x.solo)||VIS_TYPES[0];
      ctx.clearRect(0,0,W,H);
      if(!hidden) vt.draw(ctx,W,H,v,theme,visStates[vt.id]||visStates["cosmic"],customParamsRef.current);
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",resize);
      // Restore original shadowBlur descriptor
      Object.defineProperty(ctx,"shadowBlur",origShadowBlurDesc);
    };
  },[]);
  return <canvas ref={canvasRef} className="canvas-visualizer" style={{opacity: hidden?0:undefined}} aria-hidden="true"/>;
}

// ─── Solo 3D component ────────────────────────────────────────────────────────

function Solo3DVisualizer({ theme, metricsRef, soloShape, visible, showWire }) {
  const mountRef = useRef(null);
  const engineRef = useRef({});
  const shapeRef = useRef(soloShape);
  shapeRef.current = soloShape;

  useEffect(()=>{
    const mount=mountRef.current;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(50,mount.clientWidth/mount.clientHeight,0.1,100);
    camera.position.set(0,0,5);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    renderer.setSize(mount.clientWidth,mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Lights
    const key=new THREE.PointLight(0xffffff,200); key.position.set(4,6,8); scene.add(key);
    const fill=new THREE.PointLight(0x8888ff,80); fill.position.set(-6,-4,3); scene.add(fill);
    const rim=new THREE.PointLight(0xff6633,50); rim.position.set(0,-6,-4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff,0.8));

    // Build geometry based on shape
    const buildGeo=(shapeId)=>{
      switch(shapeId){
        case "torus":     return new THREE.TorusGeometry(1.2,0.42,32,80);
        case "torusknot": return new THREE.TorusKnotGeometry(1,0.32,120,16);
        case "octahedron":return new THREE.OctahedronGeometry(1.5,1);
        case "sphere":    return new THREE.SphereGeometry(1.4,48,48);
        default:          return new THREE.IcosahedronGeometry(1.5,1); // icosahedron
      }
    };

    const mat=new THREE.MeshStandardMaterial({
      color:new THREE.Color(theme.accent),
      roughness:0.25, metalness:0.55,
      emissive:new THREE.Color(theme.accent), emissiveIntensity:0.12,
      wireframe:false,
    });

    // Wireframe overlay
    const wireMat=new THREE.MeshBasicMaterial({color:new THREE.Color(theme.accent),wireframe:true,transparent:true,opacity:0.12});

    let mesh=new THREE.Mesh(buildGeo(shapeRef.current),mat);
    let wire=new THREE.Mesh(buildGeo(shapeRef.current),wireMat);
    scene.add(mesh); scene.add(wire);

    // Store original vertex positions for morphing
    const storePositions=(geo)=>{
      const pos=geo.attributes.position;
      const orig=new Float32Array(pos.count*3);
      orig.set(pos.array.subarray(0,pos.count*3));
      return orig;
    };
    let origPos=storePositions(mesh.geometry);

    const clock=new THREE.Clock();
    engineRef.current={renderer,scene,camera,mesh,wire,mat,wireMat,key,fill,rim,clock,origPos,buildGeo};

    const resize=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};
    window.addEventListener("resize",resize);
    return()=>{window.removeEventListener("resize",resize);mount.removeChild(renderer.domElement);renderer.dispose();};
  },[]);

  // Re-build on shape change
  useEffect(()=>{
    const e=engineRef.current; if(!e.mesh)return;
    const newGeo=e.buildGeo(soloShape);
    e.mesh.geometry.dispose(); e.mesh.geometry=newGeo;
    e.wire.geometry.dispose(); e.wire.geometry=newGeo.clone();
    e.origPos=(() => { const pos=newGeo.attributes.position; const orig=new Float32Array(pos.count*3); orig.set(pos.array.subarray(0,pos.count*3)); return orig; })();
  },[soloShape]);

  // Re-tint on theme change
  useEffect(()=>{
    const e=engineRef.current; if(!e.mat)return;
    e.mat.color.set(theme.accent); e.mat.emissive.set(theme.accent);
    e.wireMat.color.set(theme.accent);
  },[theme]);

  // Render loop
  useEffect(()=>{
    let raf=0;
    const render=()=>{
      const e=engineRef.current; if(!e.renderer){raf=requestAnimationFrame(render);return;}
      const t=e.clock.getElapsedTime(), v=metricsRef.current, active=v.active;
      const pulse=(v.beat*0.5+v.level*0.3)*active;

      // Vertex morphing driven by bass
      if(e.origPos&&e.mesh.geometry.attributes.position){
        const pos=e.mesh.geometry.attributes.position, orig=e.origPos;
        const bassStr=v.bass*active*0.45, beatStr=v.beat*active*0.3;
        for(let i=0;i<pos.count;i++){
          const ox=orig[i*3], oy=orig[i*3+1], oz=orig[i*3+2];
          const len=Math.sqrt(ox*ox+oy*oy+oz*oz)||1;
          const nx=ox/len, ny=oy/len, nz=oz/len;
          const noise=Math.sin(nx*8+t*2.5)*Math.cos(ny*7+t*1.8)*Math.sin(nz*9+t*2.1);
          const disp=1+bassStr*noise+beatStr*Math.abs(noise);
          pos.setXYZ(i,ox*disp,oy*disp,oz*disp);
        }
        pos.needsUpdate=true;
        e.mesh.geometry.computeVertexNormals();
      }

      // Scale pulse
      const sc=1+pulse*0.22;
      e.mesh.scale.setScalar(sc); e.wire.scale.setScalar(sc*1.004);

      // Rotation
      e.mesh.rotation.y=t*(0.22+v.mids*0.3*active);
      e.mesh.rotation.x=Math.sin(t*0.4)*0.3+v.highs*0.2*active;
      e.mesh.rotation.z=Math.sin(t*0.28)*0.15;
      e.wire.rotation.copy(e.mesh.rotation);

      // Emissive flash on beat
      e.mat.emissiveIntensity=0.1+v.beat*0.6*active;
      e.wireMat.opacity=showWire ? (0.08+v.beat*0.22*active+v.level*0.12*active) : 0;

      // Lights
      e.key.intensity=160+v.highs*120*active+v.beat*180*active;
      e.fill.intensity=70+v.bass*80*active;
      e.rim.intensity=40+v.mids*60*active;

      e.camera.position.x=Math.sin(t*0.18)*0.3*active;
      e.camera.position.y=Math.cos(t*0.14)*0.2*active;
      e.camera.lookAt(0,0,0);

      e.renderer.render(e.scene,e.camera);
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);
    return()=>cancelAnimationFrame(raf);
  },[]);

  return <div className={`stage-solo3d${visible?"":" stage-solo3d--hidden"}`} ref={mountRef} aria-hidden="true"/>;
}

// ─── Multi-object 3D stage (background layer) ─────────────────────────────────

function VisualStage({theme,metricsRef,showParticles}){
  const mountRef=useRef(null);
  const engineRef=useRef({});
  useEffect(()=>{
    const mount=mountRef.current;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(56,mount.clientWidth/mount.clientHeight,0.1,120);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    renderer.setSize(mount.clientWidth,mount.clientHeight);
    mount.appendChild(renderer.domElement);
    camera.position.set(0,0,10);
    const group=new THREE.Group(); scene.add(group);
    const kL=new THREE.PointLight(0xffffff,180); kL.position.set(3,5,8); scene.add(kL);
    const fL=new THREE.PointLight(0x8080ff,60); fL.position.set(-5,-3,4); scene.add(fL);
    const rL=new THREE.PointLight(0xff8040,40); rL.position.set(0,-6,-3); scene.add(rL);
    scene.add(new THREE.AmbientLight(0xffffff,1.2));
    const geos=[new THREE.IcosahedronGeometry(1,0),new THREE.TorusKnotGeometry(0.72,0.22,52,10),new THREE.BoxGeometry(1.3,1.3,1.3),new THREE.ConeGeometry(0.8,1.5,5),new THREE.TorusGeometry(0.78,0.18,10,32),new THREE.OctahedronGeometry(0.9,0),new THREE.TetrahedronGeometry(0.95,0)];
    const isMob=window.matchMedia("(max-width:700px)").matches;
    const objects=Array.from({length:isMob?16:24},(_,i)=>{
      const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(theme.colors[i%theme.colors.length]),roughness:0.3,metalness:0.28,emissive:new THREE.Color(theme.colors[(i+2)%theme.colors.length]),emissiveIntensity:0.08});
      const mesh=new THREE.Mesh(geos[i%geos.length],mat); const lane=i%5;
      mesh.position.set((Math.random()-0.5)*15,(Math.random()-0.5)*9,-lane*1.4);
      mesh.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      const size=0.3+Math.random()*0.95; mesh.scale.setScalar(size); group.add(mesh);
      return{mesh,base:size,speed:0.4+Math.random()*1.3,drift:Math.random()*6.28,driftY:Math.random()*6.28,lane,homeX:mesh.position.x,homeY:mesh.position.y,homeZ:mesh.position.z};
    });
    const pC=isMob?250:500, pGeo=new THREE.BufferGeometry(), pPos=new Float32Array(pC*3);
    for(let i=0;i<pC;i++){pPos[i*3]=(Math.random()-0.5)*28;pPos[i*3+1]=(Math.random()-0.5)*18;pPos[i*3+2]=(Math.random()-0.5)*20;}
    pGeo.setAttribute("position",new THREE.BufferAttribute(pPos,3));
    const pMat=new THREE.PointsMaterial({color:new THREE.Color(theme.colors[0]),size:0.04,transparent:true,opacity:0.5,sizeAttenuation:true});
    const particles=new THREE.Points(pGeo,pMat); scene.add(particles);
    engineRef.current={renderer,scene,camera,group,objects,kL,fL,rL,particles,clock:new THREE.Clock()};
    const resize=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};
    window.addEventListener("resize",resize);
    return()=>{window.removeEventListener("resize",resize);mount.removeChild(renderer.domElement);geos.forEach(g=>g.dispose());objects.forEach(({mesh})=>mesh.material.dispose());pGeo.dispose();pMat.dispose();renderer.dispose();};
  },[]);
  useEffect(()=>{const e=engineRef.current;if(!e.objects)return;e.objects.forEach(({mesh},i)=>{mesh.material.color.set(theme.colors[i%theme.colors.length]);mesh.material.emissive.set(theme.colors[(i+2)%theme.colors.length]);});if(e.particles)e.particles.material.color.set(theme.colors[0]);},[theme]);
  useEffect(()=>{
    let raf=0;
    const render=()=>{
      const e=engineRef.current; if(!e.renderer){raf=requestAnimationFrame(render);return;}
      const time=e.clock.getElapsedTime(),v=metricsRef.current,active=v.active,pulse=(v.beat*0.38+v.level*0.28)*active;
      e.camera.position.x=Math.sin(time*0.17)*(0.1+v.mids*0.22*active);
      e.camera.position.y=Math.cos(time*0.14)*(0.07+v.highs*0.14*active);
      e.camera.position.z=10.5-v.beat*0.14*active+Math.sin(time*0.09)*0.1;
      e.camera.lookAt(0,0,0);
      e.group.rotation.y=time*(0.025+v.bass*0.035*active)+v.mids*0.09*active;
      e.group.rotation.x=Math.sin(time*0.14)*0.06+v.highs*0.04*active;
      e.kL.intensity=110+v.highs*100*active+v.beat*140*active;
      e.fL.intensity=50+v.bass*60*active; e.rL.intensity=30+v.mids*50*active;
      e.objects.forEach(({mesh,base,speed,drift,driftY,lane,homeX,homeY,homeZ},i)=>{
        const idle=active?1:0.25;
        mesh.rotation.x+=(0.0016*speed+v.highs*0.005*active)*idle;
        mesh.rotation.y+=(0.002*speed+v.bass*0.006*active)*idle;
        mesh.rotation.z+=v.beat*0.005*active*(i%2?-1:1);
        mesh.position.x=homeX+Math.cos(time*(0.16+speed*0.07)+drift)*(0.06+v.mids*0.16*active);
        mesh.position.y=homeY+Math.sin(time*speed*0.36+driftY)*(0.08+v.highs*0.14*active)+v.beat*active*(lane-2)*0.028;
        mesh.position.z=homeZ+Math.sin(time*0.22+drift)*(0.12+v.bass*0.24*active);
        mesh.material.emissiveIntensity=0.06+v.beat*0.45*active*(i%3===0?1:0.5);
        mesh.scale.setScalar(base*(1+pulse*(i%3===0?0.45:0.22)));
      });
      if(e.particles){
        e.particles.visible = showParticles;
        e.particles.rotation.y=time*0.018;e.particles.rotation.x=Math.sin(time*0.011)*0.06;e.particles.material.opacity=0.28+v.level*0.5*active+v.beat*0.3*active;e.particles.material.size=0.04+v.beat*0.06*active;
      }
      e.renderer.render(e.scene,e.camera);
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);
    return()=>cancelAnimationFrame(raf);
  },[]);
  return <div className="stage-3d" ref={mountRef} aria-hidden="true"/>;
}

// ─── CSS background layers ────────────────────────────────────────────────────

function PlasmaLayer(){ return <div className="plasma-layer" aria-hidden="true"/>; }
function CartoonLayer({theme}){
  const shapes=useMemo(()=>Array.from({length:window.matchMedia("(max-width:700px)").matches?14:24},(_,i)=>({id:i,kind:theme.cartoon[i%theme.cartoon.length],color:theme.colors[i%theme.colors.length],left:`${(i*17)%101}%`,top:`${(i*29)%92}%`,size:14+((i*11)%52),delay:`${-(i*0.19).toFixed(2)}s`})),[theme]);
  return <div className="cartoon-layer">{shapes.map(s=><i className={`toon toon-${s.kind}`} key={`${theme.label}-${s.id}`} style={{"--shape-color":s.color,"--size":`${s.size}px`,"--left":s.left,"--top":s.top,"--delay":s.delay}}/>)}</div>;
}
function MotionLayer({theme}){
  const streaks=useMemo(()=>Array.from({length:14},(_,i)=>({id:i,color:theme.colors[i%theme.colors.length],top:`${4+((i*11)%90)}%`,width:`${80+((i*23)%180)}px`,delay:`${-(i*0.21).toFixed(2)}s`,speed:`${3.4+(i%5)*0.48}s`})),[theme]);
  return <div className="motion-layer" aria-hidden="true">{streaks.map(s=><i className="streak" key={`${theme.label}-${s.id}`} style={{"--streak-color":s.color,"--streak-top":s.top,"--streak-width":s.width,"--streak-delay":s.delay,"--streak-speed":s.speed}}/>)}</div>;
}
function RhythmLayer({theme}){
  const tiles=useMemo(()=>Array.from({length:18},(_,i)=>({id:i,color:theme.colors[(i+1)%theme.colors.length],left:`${3+((i*13)%94)}%`,top:`${8+((i*19)%84)}%`,delay:`${-(i*0.11).toFixed(2)}s`})),[theme]);
  return <div className="rhythm-layer" aria-hidden="true">{tiles.map(t=><i className="rhythm-tile" key={`${theme.label}-${t.id}`} style={{"--tile-color":t.color,"--tile-left":t.left,"--tile-top":t.top,"--tile-delay":t.delay}}/>)}</div>;
}

// ─── Waveform mini-canvas ─────────────────────────────────────────────────────

function WaveformCanvas({metricsRef,themeRef}){
  const canvasRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext("2d");let raf=0;
    const draw=()=>{
      const v=metricsRef.current,theme=themeRef.current;
      const W=canvas.offsetWidth,H=canvas.offsetHeight;
      if(canvas.width!==W*2||canvas.height!==H*2){canvas.width=W*2;canvas.height=H*2;ctx.scale(2,2);}
      ctx.clearRect(0,0,W,H);
      const data=v.frequencyData,bars=data.length,barW=W/bars-1;
      for(let i=0;i<bars;i++){const val=data[i]/255,bh=Math.max(3,val*H*(v.active>0.5?1:0.1));ctx.fillStyle=rgba(theme.colors[Math.floor((i/bars)*theme.colors.length)%theme.colors.length],(0.55+val*0.45).toFixed(3));ctx.beginPath();ctx.roundRect(i*(barW+1),(H-bh)/2,barW,bh,2);ctx.fill();}
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(raf);
  },[]);
  return <canvas ref={canvasRef} className="waveform-canvas" aria-hidden="true"/>;
}

// ─── Custom visualiser sliders ────────────────────────────────────────────────

const CUSTOM_SLIDERS = [
  { key:"ringSize",  label:"Ring size",     min:0.1, max:0.5, step:0.01, fmt: v=>`${Math.round(v*100)}%` },
  { key:"dotCount",  label:"Dot count",     min:10,  max:300, step:1,    fmt: v=>`${Math.round(v)}`       },
  { key:"barHeight", label:"Bar height",    min:0.04,max:0.45,step:0.01, fmt: v=>`${Math.round(v*100)}%` },
  { key:"symmetry",  label:"Symmetry",      min:1,   max:8,   step:1,    fmt: v=>`×${Math.round(v)}`     },
  { key:"glow",      label:"Glow",          min:0,   max:1,   step:0.01, fmt: v=>`${Math.round(v*100)}%` },
  { key:"rotSpeed",  label:"Rotation",      min:0,   max:1,   step:0.01, fmt: v=>`${Math.round(v*100)}%` },
  { key:"colorMix",  label:"Color palette", min:0,   max:1,   step:0.01, fmt: v=>v<0.5?"Accent":"Full"   },
];

function CustomControls({ customParams, onChangeParam }) {
  return (
    <div className="custom-controls">
      {CUSTOM_SLIDERS.map(sl => (
        <div className="custom-slider-row" key={sl.key}>
          <div className="custom-slider-head">
            <span className="custom-slider-label">{sl.label}</span>
            <span className="custom-slider-val">{sl.fmt(customParams[sl.key])}</span>
          </div>
          <input
            type="range" min={sl.min} max={sl.max} step={sl.step}
            value={customParams[sl.key]}
            onChange={e => onChangeParam(sl.key, parseFloat(e.target.value))}
            className="custom-range"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Options definitions ──────────────────────────────────────────────────────

const OPTION_GROUPS = [
  {
    label: "3D layers",
    options: [
      { key:"bg3d",        label:"Background 3D objects",  desc:"Floating geometric shapes in the background" },
      { key:"solo3dWire",  label:"Solo 3D wireframe",      desc:"Wireframe overlay on the Solo 3D shape" },
      { key:"bg3dParticles",label:"Background particles",  desc:"Point cloud behind the 3D objects" },
    ]
  },
  {
    label: "Overlay effects",
    options: [
      { key:"plasma",      label:"Plasma aurora",          desc:"Soft glowing aurora behind everything" },
      { key:"gradientField",label:"Gradient field",        desc:"Conic sweep that rotates with beats" },
      { key:"beatFlash",   label:"Beat flash",             desc:"Radial glow burst on each detected beat" },
      { key:"scanlines",   label:"Scanlines",              desc:"Subtle grid overlay" },
      { key:"vignette",    label:"Vignette",               desc:"Dark edge that pulses on beats" },
    ]
  },
  {
    label: "Floating elements",
    options: [
      { key:"shapes",      label:"Floating shapes",        desc:"Animated toon shapes across the screen" },
      { key:"streaks",     label:"Light streaks",          desc:"Horizontal light trails" },
      { key:"tiles",       label:"Rhythm tiles",           desc:"Rotating square tiles" },
    ]
  },
  {
    label: "Visual style",
    options: [
      { key:"chromaticAb", label:"Chromatic aberration",   desc:"RGB split on the title text on beats" },
      { key:"glowEffects", label:"Canvas glow / blur",     desc:"Shadow blur on canvas visualisers (GPU cost)" },
    ]
  },
];

const DEFAULT_OPTIONS = {
  bg3d: true,
  solo3dWire: true,
  bg3dParticles: true,
  plasma: true,
  gradientField: true,
  beatFlash: true,
  scanlines: true,
  vignette: true,
  shapes: true,
  streaks: true,
  tiles: true,
  chromaticAb: true,
  glowEffects: true,
};

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, id }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      className={`toggle${checked ? " toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="toggle-thumb" />
    </button>
  );
}

function OptionRow({ label, desc, checked, onChange, id }) {
  return (
    <div className="option-row">
      <label className="option-row-text" htmlFor={id}>
        <span className="option-row-label">{label}</span>
        <span className="option-row-desc">{desc}</span>
      </label>
      <Toggle checked={checked} onChange={onChange} id={id} />
    </div>
  );
}

// ─── Settings screen ──────────────────────────────────────────────────────────

function SettingsScreen({ visType, setVisType, themeKey, setThemeKey, soloShape, setSoloShape, customParams, onChangeParam, options, setOption, onClose }) {
  const [tab, setTab] = useState("visualiser");

  const allOn  = Object.values(options).every(Boolean);
  const allOff = Object.values(options).every(v => !v);

  const toggleAll = () => {
    const next = !allOn;
    Object.keys(options).forEach(k => setOption(k, next));
  };

  return (
    <div className="settings-overlay" role="dialog" aria-label="Settings">
      <div className="settings-panel">
        <div className="settings-header">
          <div className="settings-tabs">
            {["visualiser","theme","options"].map(t=>(
              <button key={t} className={`settings-tab${tab===t?" settings-tab--active":""}`} onClick={()=>setTab(t)}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          <button className="settings-close" onClick={onClose} aria-label="Close"><X size={16}/></button>
        </div>

        {/* ── Visualiser tab ── */}
        {tab==="visualiser" && (
          <>
            <div className="settings-section">
              <p className="settings-section-title">Choose a visualiser</p>
              <div className="vis-grid">
                {VIS_TYPES.map(vt=>{
                  const Icon=vt.icon;
                  const isActive=visType===vt.id;
                  return (
                    <button key={vt.id} className={`vis-card${isActive?" vis-card--active":""}`} onClick={()=>setVisType(vt.id)}>
                      <span className="vis-card-icon"><Icon size={20}/></span>
                      <span className="vis-card-label">{vt.label}</span>
                      <span className="vis-card-desc">{vt.desc}</span>
                      {isActive&&<span className="vis-card-badge">Active</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {visType==="solo3d" && (
              <div className="settings-section">
                <p className="settings-section-title">3D shape</p>
                <div className="shape-grid">
                  {SOLO_SHAPES.map(sh=>(
                    <button key={sh.id} className={`shape-chip${soloShape===sh.id?" shape-chip--active":""}`} onClick={()=>setSoloShape(sh.id)}>
                      {sh.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visType==="custom" && (
              <div className="settings-section">
                <p className="settings-section-title">Customise</p>
                <CustomControls customParams={customParams} onChangeParam={onChangeParam}/>
              </div>
            )}
          </>
        )}

        {/* ── Theme tab ── */}
        {tab==="theme" && (
          <div className="settings-section">
            <p className="settings-section-title">Pick a colour theme</p>
            <div className="theme-grid-settings">
              {Object.entries(themes).map(([key,item])=>{
                const isActive=key===themeKey;
                return (
                  <button key={key} className={`theme-card${isActive?" theme-card--active":""}`} onClick={()=>setThemeKey(key)} style={{"--t-accent":item.accent}}>
                    <span className="theme-card-swatches">{item.colors.slice(0,4).map((c,i)=><span key={i} className="theme-swatch" style={{background:c}}/>)}</span>
                    <span className="theme-card-label">{item.label}</span>
                    {isActive&&<span className="theme-card-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Options tab ── */}
        {tab==="options" && (
          <>
            <div className="settings-section options-master-row">
              <span className="options-master-label">
                {allOn ? "All effects on" : allOff ? "All effects off" : "Some effects on"}
              </span>
              <div className="options-master-actions">
                <button className="options-pill-btn" onClick={toggleAll}>
                  {allOn ? "Turn all off" : "Turn all on"}
                </button>
                <button className="options-pill-btn" onClick={() => Object.keys(DEFAULT_OPTIONS).forEach(k => setOption(k, DEFAULT_OPTIONS[k]))}>
                  Reset
                </button>
              </div>
            </div>

            {OPTION_GROUPS.map(group => (
              <div className="settings-section" key={group.label}>
                <p className="settings-section-title">{group.label}</p>
                <div className="options-list">
                  {group.options.map(opt => (
                    <OptionRow
                      key={opt.key}
                      id={`opt-${opt.key}`}
                      label={opt.label}
                      desc={opt.desc}
                      checked={options[opt.key]}
                      onChange={val => setOption(opt.key, val)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App(){
  const [themeKey,setThemeKey]=useState("io");
  const [panelMinimized,setPanelMinimized]=useState(false);
  const [visType,setVisType]=useState("cosmic");
  const [soloShape,setSoloShape]=useState("icosahedron");
  const [showSettings,setShowSettings]=useState(false);
  const [customParams,setCustomParams]=useState({...DEFAULT_CUSTOM});
  const [options,setOptions]=useState({...DEFAULT_OPTIONS});
  const appRef=useRef(null), titleRef=useRef(null);
  const theme=themes[themeKey];
  const themeRef=useRef(theme); themeRef.current=theme;
  const visTypeRef=useRef(visType); visTypeRef.current=visType;
  const customParamsRef=useRef(customParams); customParamsRef.current=customParams;
  const optionsRef=useRef(options); optionsRef.current=options;
  const {audioState,metricsRef,loadFile,toggle}=useAudioEngine();

  const isSolo=visType==="solo3d";

  const handleChangeParam=useCallback((key,val)=>{
    setCustomParams(p=>({...p,[key]:val}));
  },[]);

  const setOption=useCallback((key,val)=>{
    setOptions(p=>({...p,[key]:val}));
  },[]);

  useEffect(()=>{
    let raf=0;
    const sync=()=>{
      const root=appRef.current;
      if(root){
        const v=metricsRef.current;
        const o=optionsRef.current;
        root.style.setProperty("--pulse",v.beat.toFixed(3));
        root.style.setProperty("--beat",v.beat.toFixed(3));
        root.style.setProperty("--energy",v.level.toFixed(3));
        root.style.setProperty("--active",v.active.toFixed(3));
        root.style.setProperty("--bass",v.bass.toFixed(3));
        root.style.setProperty("--mids",v.mids.toFixed(3));
        root.style.setProperty("--highs",v.highs.toFixed(3));
        // Chromatic aberration — only if enabled
        if(titleRef.current){
          if(o.chromaticAb){
            const s=v.beat*6*v.active;
            titleRef.current.style.textShadow=s>0.5?`${s.toFixed(1)}px 0 rgba(255,0,128,0.7),-${s.toFixed(1)}px 0 rgba(0,240,255,0.7)`:"none";
          } else {
            titleRef.current.style.textShadow="none";
          }
        }
      }
      raf=requestAnimationFrame(sync);
    };
    raf=requestAnimationFrame(sync);
    return()=>cancelAnimationFrame(raf);
  },[metricsRef]);

  useEffect(()=>{
    const h=(e)=>{if(e.key==="Escape")setShowSettings(false);};
    window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);
  },[]);

  const currentVis=VIS_TYPES.find(v=>v.id===visType)||VIS_TYPES[0];

  // Build className for app shell — controls CSS-driven scanline/vignette
  const appClass = [
    audioState.playing ? "app is-playing" : "app is-idle",
    options.scanlines ? "" : "no-scanlines",
    options.vignette  ? "" : "no-vignette",
  ].join(" ").trim();

  return(
    <main ref={appRef} className={appClass}
      style={{"--bg-a":theme.background[0],"--bg-b":theme.background[1],"--bg-c":theme.background[2],"--accent":theme.accent,"--accent-rgb":theme.accentRgb,"--pulse":0,"--beat":0,"--energy":0,"--active":0,"--bass":0,"--mids":0,"--highs":0}}>

      {options.bg3d && <VisualStage theme={theme} metricsRef={metricsRef} showParticles={options.bg3dParticles}/>}
      <CanvasVisualizer metricsRef={metricsRef} themeRef={themeRef} visTypeRef={visTypeRef} customParamsRef={customParamsRef} optionsRef={optionsRef} hidden={isSolo}/>
      <Solo3DVisualizer theme={theme} metricsRef={metricsRef} soloShape={soloShape} visible={isSolo} showWire={options.solo3dWire}/>
      {options.plasma && <PlasmaLayer/>}
      {options.tiles && <RhythmLayer theme={theme}/>}
      {options.shapes && <CartoonLayer theme={theme}/>}
      {options.streaks && <MotionLayer theme={theme}/>}
      {options.gradientField && <div className="gradient-field" aria-hidden="true"/>}
      {options.beatFlash && <div className="beat-flash" aria-hidden="true"/>}

      {showSettings&&(
        <SettingsScreen
          visType={visType} setVisType={setVisType}
          themeKey={themeKey} setThemeKey={setThemeKey}
          soloShape={soloShape} setSoloShape={setSoloShape}
          customParams={customParams} onChangeParam={handleChangeParam}
          options={options} setOption={setOption}
          onClose={()=>setShowSettings(false)}
        />
      )}

      <section className={panelMinimized?"control-panel minimized":"control-panel"} aria-label="Controls">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={19}/></span>
          <div>
            <h1 ref={titleRef}>Visual Music</h1>
            <p>{audioState.name||"Drop in an MP3 and let the stage wake up."}</p>
          </div>
          <div className="brand-actions">
            <button className="icon-btn" onClick={()=>setShowSettings(v=>!v)} aria-label="Settings"><Settings size={17}/></button>
            <button className="panel-toggle" type="button" onClick={()=>setPanelMinimized(v=>!v)} aria-label={panelMinimized?"Restore":"Minimize"}>
              {panelMinimized?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
          </div>
        </div>

        {!panelMinimized&&(<>
          <div className="controls-row">
            <label className="upload-button"><Upload size={18}/><span>Upload MP3</span><input type="file" accept=".mp3,audio/mpeg" onChange={e=>loadFile(e.target.files?.[0])}/></label>
            <button className="play-button" onClick={toggle} disabled={!audioState.ready}>{audioState.playing?<Pause size={20}/>:<Play size={20}/>}</button>
          </div>
          <WaveformCanvas metricsRef={metricsRef} themeRef={themeRef}/>
          <div className="active-vis-bar">
            <span className="active-vis-label">Visualiser</span>
            <button className="active-vis-name" onClick={()=>setShowSettings(true)}>{currentVis.label} <Settings size={13}/></button>
          </div>
          <div className="meters" aria-label="Audio">
            <Meter label="Bass" value={audioState.bass}/>
            <Meter label="Mids" value={audioState.mids}/>
            <Meter label="Highs" value={audioState.highs}/>
          </div>
        </>)}

        <div className="trackline"><FileAudio size={16}/><span style={{width:`${Math.max(2,audioState.progress*100)}%`}}/></div>
      </section>
    </main>
  );
}

function Meter({label,value}){
  return(
    <div className="meter">
      <div className="meter-label"><span>{label}</span><b>{Math.round(value*100)}</b></div>
      <span className="meter-bar"><i style={{width:`${Math.max(3,value*100)}%`}}/></span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);