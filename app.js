const $ = (s) => document.querySelector(s);
const state = { data:null, map:'all', date:'all', match:'all', matchQuery:'', player:'all', layer:'traffic', playing:false, time:0, speed:1, timeScale:1, zoom:1, panX:0, panY:0, dragging:null, showHumans:true, showBots:true, showPaths:true, showMarkers:true, lastFrame:0, raf:null };
const COLORS = { Position:'#52d9d0', BotPosition:'#62a7ff', Loot:'#b49aff', Kill:'#ffad5c', BotKill:'#ffad5c', Killed:'#ff6d75', BotKilled:'#ff6d75', KilledByStorm:'#ff5b99' };
const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const duration = (ms) => { const s=Math.max(0,Math.round(ms/1000)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
const scopeMatches = () => state.data.matches.filter(m => (state.map==='all'||m.map===state.map) && (state.date==='all'||m.dates.includes(state.date)));
const visibleMatches = () => scopeMatches().filter(m => state.match==='all'||m.id===state.match);
function initUI() {
  const maps=Object.keys(state.data.maps), dates=[...new Set(state.data.matches.map(m=>m.date))].sort();
  setupSelect('map', [{value:'all',label:'All maps'}, ...maps.map(m=>({value:m,label:state.data.maps[m].label}))], value=>{state.map=value; state.match='all'; refresh();});
  setupSelect('date', [{value:'all',label:'All dates'}, ...dates.map(d=>({value:d,label:d}))], value=>{state.date=value; state.match='all'; refresh();});
  setupSelect('layer', [{value:'traffic',label:'Traffic density'}, {value:'kills',label:'Kills'}, {value:'deaths',label:'Deaths'}], value=>{state.layer=value; syncLayerButtons(); draw();});
  setupSelect('speed', [{value:'0.5',label:'0.5×'}, {value:'1',label:'1×'}, {value:'2',label:'2×'}, {value:'4',label:'4×'}], value=>{state.speed=Number(value);updatePlaybackHint();});
  $('#matchFilter').oninput=()=>{state.matchQuery=$('#matchFilter').value.trim().toLowerCase();state.match='all';renderMatchOptions();refresh();openMatchOptions();};
  $('#matchFilter').onfocus=()=>openMatchOptions();
  $('#matchOptions').onclick=(event)=>{const option=event.target.closest('[data-match]');if(!option)return;state.match=option.dataset.match;state.matchQuery='';state.time=0;closeMatchOptions();refresh();};
  $('#matchFilter').onkeydown=(event)=>{if(event.key==='Escape')closeMatchOptions();if(event.key==='Enter'){const first=$('#matchOptions [data-match]:not(.all)');if(first){event.preventDefault();first.click();}}};
  setupSelect('player', [{value:'all',label:'All players'}], value=>{state.player=value; draw();});
  for (const key of ['showHumans','showBots','showPaths','showMarkers']) $(`#${key}`).onchange=()=>{state[key]=$(`#${key}`).checked;draw();};
  const reset=()=>{state.map='all';state.date='all';state.match='all';state.matchQuery='';state.player='all';refresh();};
  $('#resetFilters').onclick=reset; $('#emptyReset').onclick=reset;
  $('#play').onclick=()=>{if(!state.selected)return;if(state.time>=state.selected.duration*state.timeScale)state.time=0;state.playing=!state.playing;state.lastFrame=0;if(state.playing)state.raf=requestAnimationFrame(tick);updatePlay();};
  $('#timeline').oninput=()=>{state.time=Number($('#timeline').value); draw(); updatePlayback();};
  $('#zoomIn').onclick=()=>setZoom(state.zoom+0.25);
  $('#zoomOut').onclick=()=>setZoom(state.zoom-0.25);
  $('#zoomReset').onclick=()=>setZoom(1);
  const viewport=$('#mapViewport');
  viewport.onpointerdown=(event)=>{if(state.zoom<=1)return;state.dragging={x:event.clientX,y:event.clientY,panX:state.panX,panY:state.panY};viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');};
  viewport.onpointermove=(event)=>{if(!state.dragging)return;const dx=event.clientX-state.dragging.x,dy=event.clientY-state.dragging.y;state.panX=state.dragging.panX+dx;state.panY=state.dragging.panY+dy;clampPan();applyViewport();};
  viewport.onpointerup=viewport.onpointercancel=(event)=>{if(!state.dragging)return;state.dragging=null;viewport.releasePointerCapture?.(event.pointerId);viewport.classList.remove('dragging');};
  viewport.onwheel=(event)=>{event.preventDefault();setZoom(state.zoom+(event.deltaY<0?.25:-.25));};
  $$('.tool-btn[data-layer]').forEach(b=>b.onclick=()=>{state.layer=b.dataset.layer;setSelectValue('layer',state.layer);syncLayerButtons();draw();});
  refresh();
}
function $$(s){return [...document.querySelectorAll(s)];}
function setupSelect(name, options, onChange){
  const root=$(`.select-combo[data-select="${name}"]`), trigger=root.querySelector('.select-trigger'), menu=root.querySelector('.combo-menu');
  root._options=options; root._onChange=onChange;
  trigger.onclick=(event)=>{event.stopPropagation();const open=!menu.hidden;closeSelectMenus();if(!open){menu.hidden=false;trigger.setAttribute('aria-expanded','true');}};
  menu.onclick=(event)=>{const option=event.target.closest('[data-value]');if(!option)return;root._value=option.dataset.value;setSelectValue(name,root._value);closeSelectMenus();onChange(root._value);};
  renderSelect(name);
}
function renderSelect(name){const root=$(`.select-combo[data-select="${name}"]`);if(!root)return;const options=root._options||[];const value=root._value||'all';const selected=options.find(o=>o.value===value)||options[0];root._value=selected.value;root.querySelector('.select-trigger span').textContent=selected.label;root.querySelector('.combo-menu').innerHTML=options.map(o=>`<button type="button" class="combo-option ${o.value===selected.value?'selected':''}" data-value="${o.value}" role="option" aria-selected="${o.value===selected.value}">${o.label}</button>`).join('');}
function setSelectValue(name,value){const root=$(`.select-combo[data-select="${name}"]`);if(!root)return;root._value=String(value);renderSelect(name);}
function closeSelectMenus(){ $$('.select-combo .combo-menu').forEach(menu=>{menu.hidden=true;menu.previousElementSibling?.setAttribute('aria-expanded','false');}); }
function clampPan(){const viewport=$('#mapViewport');const maxX=Math.max(0,(viewport.clientWidth*(state.zoom-1))/2+viewport.clientWidth*.35);const maxY=Math.max(0,(viewport.clientHeight*(state.zoom-1))/2+viewport.clientHeight*.35);state.panX=Math.min(maxX,Math.max(-maxX,state.panX));state.panY=Math.min(maxY,Math.max(-maxY,state.panY));}
function applyViewport(){const viewport=$('#mapViewport');viewport.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;viewport.classList.toggle('zoomed',state.zoom>1);$('#zoomReset').textContent=`${Math.round(state.zoom*100)}%`;}
function setZoom(value){state.zoom=Math.min(3,Math.max(.5,Math.round(value*4)/4));if(state.zoom<=1){state.panX=0;state.panY=0;}clampPan();applyViewport();draw();}
function shortMatch(match){return `${match.id.slice(0,8)} · ${match.date} · ${match.playerCount} players`;}
function openMatchOptions(){renderMatchOptions();$('#matchOptions').hidden=false;$('#matchFilter').setAttribute('aria-expanded','true');}
function closeMatchOptions(){$('#matchOptions').hidden=true;$('#matchFilter').setAttribute('aria-expanded','false');}
function renderMatchOptions(){if(!state.data)return;const available=scopeMatches().filter(m=>!state.matchQuery||m.id.toLowerCase().includes(state.matchQuery));const menu=$('#matchOptions');menu.innerHTML='<button type="button" class="combo-option all" data-match="all">All matches<small>'+fmt(scopeMatches().length)+' matches in scope</small></button>'+available.slice().reverse().map(m=>`<button type="button" class="combo-option" data-match="${m.id}">${shortMatch(m)}<small>${m.map}</small></button>`).join('');}
function syncLayerButtons(){$$('.tool-btn[data-layer]').forEach(b=>b.classList.toggle('active',b.dataset.layer===state.layer));}
function refresh() {
  state.playing=false;
  if(state.match!=='all'&&!scopeMatches().some(m=>m.id===state.match))state.match='all';
  const matches=visibleMatches();
  $('#emptyState').hidden=matches.length>0;
  setSelectValue('map',state.map); setSelectValue('date',state.date);
  $('#matchFilter').value=state.match==='all'?state.matchQuery:shortMatch(state.data.matches.find(m=>m.id===state.match)||{id:'',date:'',playerCount:0});
  $('#matchFilter').placeholder=state.match==='all'?`All matches · ${fmt(scopeMatches().length)} available`:'';
  renderMatchOptions();
  const selected=matches.length===1?matches[0]:(state.match!=='all'?state.data.matches.find(m=>m.id===state.match):null);
  state.selected=selected || null;
  const players=selected?selected.players:[];
  if (!players.some(p=>p.id===state.player)) state.player='all';
  const playerOptions=[{value:'all',label:'All players'}, ...players.map(p=>({value:p.id,label:`${p.human?'Human':'Bot'} · ${p.id}`}))];
  const playerRoot=$('.select-combo[data-select="player"]'); playerRoot._options=playerOptions; setSelectValue('player',state.player);
  const map=selected?.map || (state.map!=='all'?state.map:Object.keys(state.data.maps)[0]);
  $('#map').src=state.data.maps[map].image;
  $('#mapName').textContent=state.data.maps[map].label;
  $('#matchCount').textContent=`${fmt(matches.length)} match${matches.length===1?'':'es'}`;
  $('#selection').innerHTML=selected?`<strong>${selected.id.replace('.nakama-0','')}</strong><span>${selected.dates.join(' · ')} · ${selected.playerCount} players</span>`:`<strong>Overview</strong><span>${matches.length} matches in scope</span>`;
  const totals=matches.reduce((a,m)=>{a.players+=m.playerCount;a.events+=m.eventCount;return a;},{players:0,events:0});
  $('#statMatches').textContent=fmt(matches.length); $('#statPlayers').textContent=fmt(totals.players); $('#statEvents').textContent=fmt(totals.events);
  setSelectValue('layer',state.layer); setSelectValue('speed',String(state.speed)); setupTimeline(selected); draw();
  syncLayerButtons();
}
function updatePlaybackHint(){if($('#playbackHint'))$('#playbackHint').textContent=state.selected?`Playback is match-relative · ${state.speed}× = ${state.speed} real-time speed.`:'Select a match to enable playback.';}
function setupTimeline(match) { const enabled=!!match; $('#play').disabled=!enabled; $('#timeline').disabled=!enabled; $('#play').title=enabled?'Play selected match':'Select a match to enable playback'; updatePlaybackHint(); state.time=0; $('#timeline').max=match?(match.duration*state.timeScale):1; $('#timeline').value=state.time; $('#endTime').textContent=match?duration(match.duration*state.timeScale):'—'; updatePlayback(); updatePlay(); }
function updatePlay(){ $('#play').textContent=state.playing?'Ⅱ':'▶'; }
function updatePlayback(){ $('#currentTime').textContent=state.selected?duration(state.time):'—'; }
function pointToPixel(map,x,z,w,h){const c=state.data.maps[map],u=(x-c.origin[0])/c.scale,v=(z-c.origin[1])/c.scale; return [u*w,(1-v)*h];}
function draw() {
  const canvas=$('#overlay'), img=$('#map'); if(!img.naturalWidth)return; const w=img.clientWidth,h=img.clientHeight,dpr=devicePixelRatio||1; canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width='100%';canvas.style.height='100%';canvas.style.left='0';canvas.style.top='0'; const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0); const map=state.selected?.map || (state.map!=='all'?state.map:Object.keys(state.data.maps)[0]);
  drawHeat(ctx,map,w,h); if(state.selected) drawMatch(ctx,state.selected,w,h);
  $('#legend').innerHTML=state.selected?`<span><i class="dot" style="background:#00f5d4"></i>Human path</span><span><i class="dot" style="background:#00b7ff"></i>Bot path</span><span><i class="dot" style="background:${state.layer==='traffic'?'#9bd45b':state.layer==='kills'?'#ffad5c':'#ff6d75'}"></i>${state.layer==='traffic'?'Traffic heatmap':state.layer==='kills'?'Kills heatmap':'Deaths heatmap'}</span><span><i class="dot" style="background:#ffad5c"></i>Kill marker</span><span><i class="dot" style="background:#ff6d75"></i>Death marker</span><span><i class="dot" style="background:#b49aff"></i>Loot marker</span>`:'<span>Heatmap overview</span><span>Use filters to inspect a match</span>';
}
function drawHeat(ctx,map,w,h){const dateHeat=state.date==='all'?state.data.heatmaps:state.data.heatmapsByDate[state.date]||state.data.heatmaps;const grid=dateHeat?.[map]?.[state.layer]||state.data.heatmaps?.[map]?.[state.layer];if(!grid?.length)return;const flat=grid.flat(),max=Math.max(...flat,1),total=flat.reduce((a,b)=>a+b,0);$('#heatmapNote').textContent=`${state.date==='all'?'All dates':state.date} · ${fmt(total)} points · max cell ${fmt(max)}`;const cellW=w/grid[0].length,cellH=h/grid.length;const hue=state.layer==='traffic'?92:state.layer==='kills'?28:350;ctx.save();ctx.globalCompositeOperation='screen';for(let r=0;r<grid.length;r++)for(let c=0;c<grid[r].length;c++){const value=grid[r][c];if(!value)continue;const intensity=value/max;const a=.18+.72*intensity;ctx.fillStyle=`hsla(${hue},94%,${state.layer==='traffic'?58:62}%,${a})`;ctx.fillRect(c*cellW,r*cellH,Math.ceil(cellW)+1,Math.ceil(cellH)+1);ctx.strokeStyle=`hsla(${hue},100%,78%,${.12+.22*intensity})`;ctx.lineWidth=.6;ctx.strokeRect(c*cellW+.3,r*cellH+.3,Math.max(0,cellW-.6),Math.max(0,cellH-.6));}ctx.restore();}
function interpolatedPath(path,cutoff){if(!path.length)return[];const visible=[];for(let i=0;i<path.length;i++){const point=path[i];if(point[0]<=cutoff){visible.push(point);continue;}const previous=path[i-1];if(previous&&cutoff>previous[0]){const ratio=(cutoff-previous[0])/(point[0]-previous[0]);visible.push([cutoff,previous[1]+(point[1]-previous[1])*ratio,previous[2]+(point[2]-previous[2])*ratio]);}break;}return visible;}
function drawMatch(ctx,match,w,h){const cutoff=match.start+state.time/state.timeScale;for(const p of match.players){if(state.player!=='all'&&p.id!==state.player)continue;if((p.human&&!state.showHumans)||(!p.human&&!state.showBots))continue;const path=interpolatedPath(p.path,cutoff);if(state.showPaths&&path.length>1){ctx.beginPath();path.forEach((v,i)=>{const [x,y]=pointToPixel(match.map,v[1],v[2],w,h);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='rgba(3,13,20,.94)';ctx.lineWidth=p.human?6:5;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();ctx.strokeStyle=p.human?'#00f5d4':'#00b7ff';ctx.lineWidth=p.human?3.4:2.8;ctx.shadowColor=p.human?'rgba(0,245,212,.52)':'rgba(0,183,255,.48)';ctx.shadowBlur=3;ctx.stroke();ctx.shadowBlur=0;}if(!state.showMarkers)continue;for(const e of p.events){if(e[0]>cutoff)continue;const [x,y]=pointToPixel(match.map,e[1],e[2],w,h);const color=COLORS[e[3]]||'#fff';ctx.beginPath();ctx.arc(x,y,e[3]==='Loot'?3:5,0,Math.PI*2);ctx.fillStyle=color;ctx.globalAlpha=.9;ctx.fill();if(e[3]!=='Loot'){ctx.strokeStyle='rgba(8,13,20,.9)';ctx.lineWidth=1.5;ctx.stroke();}ctx.globalAlpha=1;}}}
function tick(timestamp){if(!state.playing||!state.selected)return;if(!state.lastFrame)state.lastFrame=timestamp;const delta=Math.max(0,timestamp-state.lastFrame);state.lastFrame=timestamp;state.time+=delta*state.speed;if(state.time>=state.selected.duration*state.timeScale){state.time=state.selected.duration*state.timeScale;state.playing=false;state.lastFrame=0;updatePlay();}$('#timeline').value=state.time;updatePlayback();draw();if(state.playing)state.raf=requestAnimationFrame(tick);}
window.addEventListener('resize',draw); document.addEventListener('keydown',(event)=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(event.key==='+'||event.key==='='){event.preventDefault();setZoom(state.zoom+.25);}if(event.key==='-'){event.preventDefault();setZoom(state.zoom-.25);}if(event.key==='0'){event.preventDefault();setZoom(1);}}); document.addEventListener('click',(event)=>{if(!event.target.closest('.combo'))closeMatchOptions();if(!event.target.closest('.select-combo'))closeSelectMenus();}); $('#map').addEventListener('load',draw); $('#map').addEventListener('error',()=>{$('#loadingMessage').textContent='The selected minimap could not be loaded.';});
async function loadData(){const loading=$('.loading');const message=$('#loadingMessage');const retry=$('#retry');loading.classList.remove('hidden');retry.hidden=true;message.textContent='Loading telemetry…';try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);const response=await fetch('data.json',{signal:controller.signal});clearTimeout(timeout);if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();if(!data.matches||!data.maps)throw new Error('Invalid data artifact');state.data=data;const maxDuration=Math.max(...data.matches.map(m=>m.duration||0));state.timeScale=maxDuration<10000?1000:1;loading.classList.add('hidden');initUI();}catch(e){message.textContent=`Could not load telemetry (${e.name==='AbortError'?'timed out':e.message}).`;retry.hidden=false;console.error(e);}}
$('#retry').onclick=loadData;loadData();
