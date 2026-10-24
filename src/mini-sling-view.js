import { SLING_BOARD_W as W, SLING_BOARD_H as H, SLING_Y, SLING_AREA, SLING_RELOAD, SLING_BLOCK_W, SLING_BLOCK_H } from './mini-sling.js';

export function renderSling(field, state) {
  let canvas = field.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas'); canvas.className = 'mini-sling-canvas';
    canvas.setAttribute('aria-label', '弹弓拆拆乐：横向选点，松手从下往上击打，把方块打出边框；也可点按发射');
    field.append(canvas);
  }
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== W * ratio || canvas.height !== H * ratio) { canvas.width = W * ratio; canvas.height = H * ratio; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, W, H);
  const style = getComputedStyle(field), ink = style.color;
  ctx.lineWidth = 2; ctx.lineCap = 'round';
  const rect = (x,y,w,h,r,fill) => { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=ink;ctx.stroke(); };
  ctx.fillStyle=ink;ctx.textAlign='center';ctx.font='600 12px sans-serif';ctx.fillText('横向选点 · 松手向上打',W/2,27);
  ctx.font='10px sans-serif';ctx.fillText('俯视平台 · 整块推出边框 +180',W/2,47);
  const area=SLING_AREA;
  rect(area.left+3,area.top+6,area.right-area.left,area.bottom-area.top,0,'#bcb195');
  ctx.fillStyle=style.getPropertyValue('--flow-surface-fffdf5').trim()||'#fffdf5';ctx.fillRect(area.left,area.top,area.right-area.left,area.bottom-area.top);
  ctx.globalAlpha=.04;ctx.fillStyle=ink;ctx.fillRect(area.left,area.top,area.right-area.left,area.bottom-area.top);ctx.globalAlpha=1;
  ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(area.left,area.top,area.right-area.left,area.bottom-area.top);ctx.setLineDash([]);
  for (const b of state.blocks) {
    if(b.scale<=0)continue;
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);ctx.scale(b.scale,b.scale);ctx.globalAlpha=b.down?b.scale:1;
    rect(-SLING_BLOCK_W/2,-SLING_BLOCK_H/2,SLING_BLOCK_W,SLING_BLOCK_H,4,['#eda0a8','#e9be6a','#9abd8b','#b4a2cf'][b.color]);
    ctx.strokeStyle=ink;ctx.beginPath();ctx.moveTo(-5,-4);ctx.lineTo(5,4);ctx.moveTo(5,-4);ctx.lineTo(-5,4);ctx.stroke();
    ctx.restore();
  }
  for(const hit of state.impacts) {
    const t=(state.lastSim-hit.at)/320;ctx.strokeStyle='#bb7841';ctx.lineWidth=2;ctx.globalAlpha=1-t;
    for(let i=0;i<6;i++){const a=i*Math.PI/3,r=9+t*18;ctx.beginPath();ctx.moveTo(hit.x+Math.cos(a)*r,hit.y+Math.sin(a)*r);ctx.lineTo(hit.x+Math.cos(a)*(r+5),hit.y+Math.sin(a)*(r+5));ctx.stroke();}
  }
  ctx.textAlign='center';ctx.font='bold 12px sans-serif';ctx.fillStyle='#94602e';
  for(const e of state.escapes){const t=(state.lastSim-e.at)/600;ctx.globalAlpha=1-t;ctx.fillText('+180',Math.max(22,Math.min(W-22,e.x)),Math.max(57,Math.min(300,e.y))-t*16);}
  ctx.globalAlpha=1;
  const ready=state.lastSim+1e-6>=state.nextShotAt;
  if(state.pull) {
    ctx.strokeStyle=ink;ctx.globalAlpha=.35;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(state.originX,SLING_Y-20);ctx.lineTo(state.originX,area.bottom+8);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.beginPath();ctx.moveTo(state.originX-5,area.bottom+17);ctx.lineTo(state.originX,area.bottom+8);ctx.lineTo(state.originX+5,area.bottom+17);ctx.stroke();
  }
  for(const s of state.shots) {
    ctx.strokeStyle='#e9b354';ctx.lineWidth=5;ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x,s.y+Math.min(23,Math.max(-23,-s.vy*1.3)));ctx.stroke();ctx.globalAlpha=1;
    ctx.beginPath();ctx.arc(s.x,s.y,10,0,Math.PI*2);ctx.fillStyle='#e9b354';ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();
  }
  rect(12,SLING_Y+8,W-24,12,6,'#97b87b');
  const recoil=Math.max(0,1-(state.lastSim-state.launchAt)/140)*5;
  rect(state.originX-17,SLING_Y-3+recoil,34,24,7,'#bcb195');
  rect(state.originX-9,SLING_Y-21+recoil,18,25,4,'#e9b354');
  if(ready){ctx.beginPath();ctx.arc(state.originX,SLING_Y-12,6,0,Math.PI*2);ctx.fillStyle='#fff9df';ctx.fill();ctx.strokeStyle=ink;ctx.stroke();}
  ctx.textAlign='center';ctx.fillStyle=ink;ctx.font='600 11px sans-serif';ctx.fillText(state.pull?'松手向上发射 ↑':ready?'↔ 拖动选点，松手打 · 点按也能发射':'快速装填中…',W/2,410);
  if(!ready){const progress=1-Math.min(1,(state.nextShotAt-state.lastSim)/SLING_RELOAD);ctx.fillStyle='#bb7841';ctx.fillRect(20,391,(W-40)*progress,3);}
}
