(function(){
  'use strict';

  /* ================= State ================= */
  const state = {
    type: 'linear',            // linear | radial | conic
    angle: 90,
    stops: [
      { id: 's1', color: '#5E9EFF', pos: 0 },
      { id: 's2', color: '#8B5EFF', pos: 50 },
      { id: 's3', color: '#FF6B6B', pos: 100 }
    ],
    selectedStop: 's1',
    radialShape: 'circle',     // circle | ellipse
    radialPos: { x: 50, y: 50 },
    conicPos: { x: 50, y: 50 },
    canvasRatio: 'free',       // free | 1:1 | 4:3 | 3:4 | 16:9 | 9:16
  };

  const history = [];
  let future = [];
  function pushHistory(){
    history.push(JSON.parse(JSON.stringify(state)));
    if(history.length > 40) history.shift();
    future = [];
  }
  function undo(){
    if(!history.length) return;
    future.push(JSON.parse(JSON.stringify(state)));
    const prev = history.pop();
    Object.assign(state, prev);
    renderAll();
    announce('Undid last change');
  }
  function redo(){
    if(!future.length) return;
    history.push(JSON.parse(JSON.stringify(state)));
    const next = future.pop();
    Object.assign(state, next);
    renderAll();
    announce('Redid last change');
  }

  let idCounter = 4;
  function newId(){ return 's' + (idCounter++); }

  /* ================= Presets ================= */
  const builtInPresets = [
    { name:'Aurora', type:'linear', angle:120, stops:[{color:'#5E9EFF',pos:0},{color:'#8B5EFF',pos:50},{color:'#FF6B6B',pos:100}] },
    { name:'Citrus', type:'linear', angle:45, stops:[{color:'#FFD166',pos:0},{color:'#FF8552',pos:100}] },
    { name:'Deep Sea', type:'radial', shape:'circle', stops:[{color:'#062E4F',pos:0},{color:'#0B0B0E',pos:100}] },
    { name:'Mint', type:'linear', angle:160, stops:[{color:'#66FCF1',pos:0},{color:'#0B7A75',pos:100}] },
    { name:'Sunset', type:'linear', angle:100, stops:[{color:'#FF6B6B',pos:0},{color:'#FF8FA3',pos:50},{color:'#FFD166',pos:100}] },
    { name:'Nebula', type:'conic', stops:[{color:'#8B5EFF',pos:0},{color:'#5E9EFF',pos:33},{color:'#FF6B6B',pos:66},{color:'#8B5EFF',pos:100}] },
    { name:'Steel', type:'linear', angle:90, stops:[{color:'#3A3F4B',pos:0},{color:'#151519',pos:100}] },
    { name:'Peach', type:'linear', angle:135, stops:[{color:'#FFE5D9',pos:0},{color:'#FF8552',pos:100}] },
    { name:'Ink', type:'radial', shape:'ellipse', stops:[{color:'#2E2E3A',pos:0},{color:'#0B0B0E',pos:100}] },
    { name:'Coral Reef', type:'linear', angle:70, stops:[{color:'#FF9A8B',pos:0},{color:'#FF6A88',pos:50},{color:'#FF99AC',pos:100}] },
    { name:'Midnight', type:'linear', angle:180, stops:[{color:'#0F2027',pos:0},{color:'#203A43',pos:50},{color:'#2C5364',pos:100}] },
    { name:'Lemonade', type:'radial', shape:'circle', stops:[{color:'#FFF1AC',pos:0},{color:'#F7B733',pos:100}] },
    { name:'Grape', type:'linear', angle:110, stops:[{color:'#6A11CB',pos:0},{color:'#2575FC',pos:100}] },
    { name:'Flamingo', type:'conic', stops:[{color:'#FC466B',pos:0},{color:'#3F5EFB',pos:50},{color:'#FC466B',pos:100}] },
    { name:'Forest', type:'linear', angle:135, stops:[{color:'#134E5E',pos:0},{color:'#71B280',pos:100}] },
    { name:'Rose Gold', type:'linear', angle:60, stops:[{color:'#B76E79',pos:0},{color:'#E8C9C4',pos:100}] },
    { name:'Solar', type:'radial', shape:'ellipse', stops:[{color:'#FFE259',pos:0},{color:'#FFA751',pos:100}] },
    { name:'Glacier', type:'linear', angle:160, stops:[{color:'#E0EAFC',pos:0},{color:'#CFDEF3',pos:100}] },
    { name:'Ember', type:'linear', angle:100, stops:[{color:'#F00000',pos:0},{color:'#DC281E',pos:50},{color:'#3D0000',pos:100}] },
    { name:'Lagoon', type:'radial', shape:'circle', stops:[{color:'#00C9FF',pos:0},{color:'#092756',pos:100}] },
    { name:'Candy', type:'linear', angle:45, stops:[{color:'#FBC2EB',pos:0},{color:'#A6C1EE',pos:100}] },
    { name:'Volt', type:'conic', stops:[{color:'#D4FC79',pos:0},{color:'#96E6A1',pos:50},{color:'#D4FC79',pos:100}] },
  ];
  const CUSTOM_KEY = 'gradientTool.customPresets';
  function loadCustomPresets(){
    try{ return JSON.parse(sessionStorage.getItem(CUSTOM_KEY) || '[]'); }
    catch(e){ return []; }
  }
  function saveCustomPresets(list){
    try{ sessionStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); }catch(e){}
  }
  let customPresets = loadCustomPresets();

  /* ================= Helpers ================= */
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function sortedStops(){ return [...state.stops].sort((a,b)=>a.pos-b.pos); }

  function colorAtStop(position){
    const stops = sortedStops();
    const next = stops.find(s=>s.pos >= position) || stops[stops.length-1];
    const prev = [...stops].reverse().find(s=>s.pos <= position) || stops[0];
    if(next === prev) return next.color;
    const t = (position - prev.pos) / (next.pos - prev.pos);
    const hex = color => {
      const value = color.replace('#','');
      const normalized = value.length === 3 ? value.split('').map(c=>c+c).join('') : value;
      return [0,2,4].map(i=>parseInt(normalized.slice(i,i+2),16));
    };
    const from = hex(prev.color), to = hex(next.color);
    return '#' + from.map((channel,i)=>Math.round(channel + (to[i]-channel)*t).toString(16).padStart(2,'0')).join('');
  }

  function buildCSSGradient(){
    const stops = sortedStops().map(s => `${s.color} ${Math.round(s.pos)}%`).join(', ');
    if(state.type === 'linear'){
      return `linear-gradient(${Math.round(state.angle)}deg, ${stops})`;
    }
    if(state.type === 'radial'){
      return `radial-gradient(${state.radialShape} at ${Math.round(state.radialPos.x)}% ${Math.round(state.radialPos.y)}%, ${stops})`;
    }
    return `conic-gradient(from ${Math.round(state.angle)}deg at ${Math.round(state.conicPos.x)}% ${Math.round(state.conicPos.y)}%, ${stops})`;
  }

  function announce(msg){
    const live = document.getElementById('sr-live');
    live.textContent = '';
    requestAnimationFrame(()=>{ live.textContent = msg; });
  }

  let toastTimer;
  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove('show'), 1800);
  }

  /* ================= Canvas ratio ================= */
  const RATIOS = [
    { id:'free', label:'Free' },
    { id:'1:1', label:'1:1' },
    { id:'4:3', label:'4:3' },
    { id:'3:4', label:'3:4' },
    { id:'16:9', label:'16:9' },
    { id:'9:16', label:'9:16' },
  ];
  const canvasWrap = document.querySelector('.canvas-wrap');

  function renderRatioSeg(container){
    container.innerHTML = '';
    RATIOS.forEach(r=>{
      const b = document.createElement('button');
      b.textContent = r.label;
      b.setAttribute('role','tab');
      b.setAttribute('aria-selected', state.canvasRatio === r.id ? 'true':'false');
      if(state.canvasRatio === r.id) b.classList.add('active');
      b.addEventListener('click', ()=>{
        state.canvasRatio = r.id;
        renderAll();
        applyCanvasRatio();
      });
      container.appendChild(b);
    });
  }

  function applyCanvasRatio(){
    if(state.canvasRatio === 'free'){
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      return;
    }
    const [w,h] = state.canvasRatio.split(':').map(Number);
    const availW = canvasWrap.clientWidth - 56;
    const availH = canvasWrap.clientHeight - 56;
    let targetW = availW, targetH = availW * (h/w);
    if(targetH > availH){
      targetH = availH;
      targetW = availH * (w/h);
    }
    canvas.style.width = Math.max(80, targetW) + 'px';
    canvas.style.height = Math.max(80, targetH) + 'px';
  }
  window.addEventListener('resize', applyCanvasRatio);

  /* ================= Rendering ================= */
  const canvas = document.getElementById('canvas');
  const angleDial = document.getElementById('angleDial');

  function renderCanvas(){
    canvas.style.background = buildCSSGradient();
    // remove old handles
    canvas.querySelectorAll('.stop-handle').forEach(h=>h.remove());

    if(state.type === 'linear'){
      angleDial.style.display = 'flex';
      const rad = (state.angle - 90) * Math.PI/180;
      const knobX = Math.cos(rad)*8, knobY = Math.sin(rad)*8;
      angleDial.style.transform = `rotate(${state.angle}deg)`;
      angleDial.setAttribute('aria-valuenow', Math.round(state.angle));
      // place handles along the gradient axis
      sortedStopsWithId().forEach(s=>{
        const h = makeHandle(s);
        const t = s.pos/100;
        const angleRad = (state.angle) * Math.PI/180;
        // project along line through center
        const cx = 50, cy = 50;
        const len = 45;
        const dx = Math.sin(angleRad)*len;
        const dy = -Math.cos(angleRad)*len;
        const px = cx + dx*(2*t-1);
        const py = cy + dy*(2*t-1);
        h.style.left = px+'%';
        h.style.top = py+'%';
        canvas.appendChild(h);
      });
    } else if(state.type === 'conic'){
      angleDial.style.display = 'flex';
      angleDial.style.transform = `rotate(${state.angle}deg)`;
      angleDial.setAttribute('aria-valuenow', Math.round(state.angle));
      sortedStopsWithId().forEach(s=>{
        const h = makeHandle(s);
        const t = s.pos/100;
        const angleRad = (state.angle + t*360) * Math.PI/180;
        const r = 38;
        const px = state.conicPos.x + Math.sin(angleRad)*r;
        const py = state.conicPos.y - Math.cos(angleRad)*r;
        h.style.left = clamp(px,4,96)+'%';
        h.style.top = clamp(py,4,96)+'%';
        canvas.appendChild(h);
      });
    } else {
      angleDial.style.display = 'none';
      sortedStopsWithId().forEach(s=>{
        const h = makeHandle(s);
        const t = s.pos/100;
        const px = state.radialPos.x;
        const py = state.radialPos.y;
        const r = t*45;
        h.style.left = clamp(px+r,3,97)+'%';
        h.style.top = clamp(py,3,97)+'%';
        canvas.appendChild(h);
      });
    }
  }

  function sortedStopsWithId(){ return [...state.stops].sort((a,b)=>a.pos-b.pos); }

  function makeHandle(stop){
    const h = document.createElement('div');
    h.className = 'stop-handle' + (stop.id === state.selectedStop ? ' active' : '');
    h.style.background = stop.color;
    h.setAttribute('role','slider');
    h.setAttribute('tabindex','0');
    h.setAttribute('aria-label', `Color stop at ${Math.round(stop.pos)} percent`);
    h.setAttribute('aria-valuemin','0');
    h.setAttribute('aria-valuemax','100');
    h.setAttribute('aria-valuenow', Math.round(stop.pos));
    h.dataset.id = stop.id;

    h.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      state.selectedStop = stop.id;
      pushHistory();
      const move = (ev)=>{
        const rect = canvas.getBoundingClientRect();
        let pos;
        if(state.type === 'linear'){
          const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
          const rad = state.angle * Math.PI/180;
          const dirX = Math.sin(rad), dirY = -Math.cos(rad);
          const px = ev.clientX - cx, py = ev.clientY - cy;
          const proj = (px*dirX + py*dirY);
          const len = Math.min(rect.width, rect.height)*0.45;
          pos = clamp((proj/len/2 + 0.5)*100, 0, 100);
        } else if(state.type === 'conic'){
          const cx = rect.left + rect.width*state.conicPos.x/100;
          const cy = rect.top + rect.height*state.conicPos.y/100;
          let ang = Math.atan2(ev.clientX-cx, -(ev.clientY-cy)) * 180/Math.PI - state.angle;
          ang = ((ang % 360)+360)%360;
          pos = clamp(ang/360*100, 0, 100);
        } else {
          const cx = rect.left + rect.width*state.radialPos.x/100;
          const dist = ev.clientX - cx;
          pos = clamp((dist / (rect.width*0.45))*100, 0, 100);
        }
        updateStop(stop.id, { pos });
      };
      const up = ()=>{
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      renderAll();
    });

    h.addEventListener('keydown', (e)=>{
      let delta = 0;
      if(e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1;
      if(e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1;
      if(delta !== 0){
        e.preventDefault();
        pushHistory();
        const s = state.stops.find(x=>x.id===stop.id);
        updateStop(stop.id, { pos: clamp(s.pos + delta, 0, 100) });
      }
    });

    h.addEventListener('click', ()=>{
      state.selectedStop = stop.id;
      renderAll();
    });

    return h;
  }

  function updateStop(id, patch){
    const s = state.stops.find(x=>x.id===id);
    if(!s) return;
    Object.assign(s, patch);
    renderAll();
  }

  // Angle dial drag
  angleDial.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    pushHistory();
    const move = (ev)=>{
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left+rect.width/2, cy = rect.top+rect.height/2;
      let ang = Math.atan2(ev.clientX-cx, -(ev.clientY-cy)) * 180/Math.PI;
      ang = ((ang % 360)+360)%360;
      state.angle = Math.round(ang);
      renderAll();
    };
    const up = ()=>{
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  angleDial.addEventListener('keydown', (e)=>{
    let delta = 0;
    if(e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 5;
    if(e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -5;
    if(delta !== 0){
      e.preventDefault();
      pushHistory();
      state.angle = ((state.angle + delta) % 360 + 360) % 360;
      renderAll();
    }
  });

  /* ================= Type segmented control ================= */
  const TYPES = [
    { id:'linear', label:'Linear' },
    { id:'radial', label:'Radial' },
    { id:'conic', label:'Conic' },
  ];
  function renderTypeSeg(container){
    container.innerHTML = '';
    TYPES.forEach(t=>{
      const b = document.createElement('button');
      b.textContent = t.label;
      b.setAttribute('role','tab');
      b.setAttribute('aria-selected', state.type === t.id ? 'true':'false');
      if(state.type === t.id) b.classList.add('active');
      b.addEventListener('click', ()=>{
        pushHistory();
        state.type = t.id;
        renderAll();
      });
      container.appendChild(b);
    });
  }

  /* ================= Stop list ================= */
  function renderStopList(container){
    container.innerHTML = '';
    sortedStopsWithId().forEach(stop=>{
      const row = document.createElement('div');
      row.className = 'stop-item' + (stop.id === state.selectedStop ? ' selected' : '');

      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.background = stop.color;
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = stop.color;
      colorInput.setAttribute('aria-label', 'Pick color');
      colorInput.addEventListener('input', ()=>{
        updateStop(stop.id, { color: colorInput.value });
        hexInput.value = colorInput.value;
      });
      colorInput.addEventListener('change', pushHistory);
      sw.appendChild(colorInput);

      const hexInput = document.createElement('input');
      hexInput.className = 'hex-input';
      hexInput.value = stop.color.toUpperCase();
      hexInput.maxLength = 7;
      hexInput.setAttribute('aria-label', 'Hex color value');
      hexInput.addEventListener('change', ()=>{
        let v = hexInput.value.trim();
        if(!v.startsWith('#')) v = '#'+v;
        if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)){
          pushHistory();
          updateStop(stop.id, { color: v });
        } else {
          hexInput.value = stop.color.toUpperCase();
        }
      });

      const posLabel = document.createElement('span');
      posLabel.className = 'stop-pos';
      posLabel.textContent = Math.round(stop.pos) + '%';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'stop-remove';
      removeBtn.setAttribute('aria-label', 'Remove color stop');
      removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      removeBtn.addEventListener('click', ()=>{
        if(state.stops.length <= 2){ toast("Keep at least 2 colors"); return; }
        pushHistory();
        state.stops = state.stops.filter(s=>s.id!==stop.id);
        if(state.selectedStop === stop.id) state.selectedStop = state.stops[0].id;
        renderAll();
      });

      row.addEventListener('click', (e)=>{
        if(e.target === colorInput || e.target === hexInput || e.target === removeBtn) return;
        state.selectedStop = stop.id;
        renderAll();
      });

      row.appendChild(sw);
      row.appendChild(hexInput);
      row.appendChild(posLabel);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
  }

  function addStop(){
    pushHistory();
    const sorted = sortedStopsWithId();
    const mid = sorted.length >= 2 ? (sorted[Math.floor(sorted.length/2)-1] ? (sorted[Math.floor(sorted.length/2)-1].pos + sorted[Math.floor(sorted.length/2)].pos)/2 : 50) : 50;
    const colors = ['#5E9EFF','#8B5EFF','#FF6B6B','#FFD166','#66FCF1','#FF8552'];
    const newColor = colors[state.stops.length % colors.length];
    const id = newId();
    state.stops.push({ id, color: newColor, pos: clamp(mid,0,100) });
    state.selectedStop = id;
    renderAll();
  }

  /* ================= Adjust section ================= */
  function renderAdjust(container){
    container.innerHTML = '';
    const heading = document.createElement('div');
    heading.className = 'rail-heading';
    heading.textContent = 'Adjust';
    container.appendChild(heading);

    if(state.type === 'linear'){
      container.appendChild(makeSliderRow('Angle', state.angle, 0, 360, (v)=>{ state.angle = v; renderAll(); }, '°'));
    } else if(state.type === 'conic'){
      container.appendChild(makeSliderRow('Start angle', state.angle, 0, 360, (v)=>{ state.angle = v; renderAll(); }, '°'));
      container.appendChild(makeSliderRow('Center X', state.conicPos.x, 0, 100, (v)=>{ state.conicPos.x = v; renderAll(); }, '%'));
      container.appendChild(makeSliderRow('Center Y', state.conicPos.y, 0, 100, (v)=>{ state.conicPos.y = v; renderAll(); }, '%'));
    } else {
      const shapeLabel = document.createElement('span');
      shapeLabel.className = 'field-label';
      shapeLabel.textContent = 'Shape';
      container.appendChild(shapeLabel);
      const seg = document.createElement('div');
      seg.className = 'segmented';
      ['circle','ellipse'].forEach(shape=>{
        const b = document.createElement('button');
        b.textContent = shape[0].toUpperCase()+shape.slice(1);
        if(state.radialShape === shape) b.classList.add('active');
        b.addEventListener('click', ()=>{ pushHistory(); state.radialShape = shape; renderAll(); });
        seg.appendChild(b);
      });
      container.appendChild(seg);
      container.appendChild(makeSliderRow('Center X', state.radialPos.x, 0, 100, (v)=>{ state.radialPos.x = v; renderAll(); }, '%'));
      container.appendChild(makeSliderRow('Center Y', state.radialPos.y, 0, 100, (v)=>{ state.radialPos.y = v; renderAll(); }, '%'));
    }
  }

  function makeSliderRow(label, value, min, max, onChange, suffix){
    const wrap = document.createElement('div');
    wrap.className = 'slider-row';
    const top = document.createElement('div');
    top.className = 'row between';
    const lab = document.createElement('span');
    lab.className = 'field-label';
    lab.style.margin = '0';
    lab.textContent = label;
    const badge = document.createElement('span');
    badge.className = 'val-badge';
    badge.textContent = Math.round(value) + (suffix||'');
    top.appendChild(lab); top.appendChild(badge);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = 1;
    input.value = value;
    input.setAttribute('aria-label', label);
    let started = false;
    input.addEventListener('pointerdown', ()=>{ if(!started){ pushHistory(); started = true; } });
    input.addEventListener('input', ()=>{
      badge.textContent = Math.round(+input.value) + (suffix||'');
      onChange(+input.value);
    });
    input.addEventListener('pointerup', ()=>{ started = false; });

    let wheelTimer = null;
    input.addEventListener('wheel', (e)=>{
      e.preventDefault();
      if(!wheelTimer) pushHistory();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(()=>{ wheelTimer = null; }, 400);
      const dir = e.deltaY < 0 || e.deltaX > 0 ? 1 : -1;
      const next = clamp(+input.value + dir, +input.min, +input.max);
      input.value = next;
      badge.textContent = Math.round(next) + (suffix||'');
      onChange(next);
    }, { passive:false });

    wrap.appendChild(top);
    wrap.appendChild(input);
    return wrap;
  }

  /* ================= Presets ================= */
  function allPresets(){
    return builtInPresets.map(p=>({...p, custom:false})).concat(customPresets.map(p=>({...p, custom:true})));
  }

  function presetMatchesState(p){
    if(p.type !== state.type) return false;
    const a = sortedStopsWithId().map(s=>s.color.toLowerCase()+'@'+Math.round(s.pos));
    const b = [...p.stops].sort((x,y)=>x.pos-y.pos).map(s=>s.color.toLowerCase()+'@'+Math.round(s.pos));
    return a.length === b.length && a.every((v,i)=>v===b[i]);
  }

  function renderPresets(container){
    container.innerHTML = '';
    allPresets().forEach((p, idx)=>{
      const tile = document.createElement('button');
      tile.className = 'preset-tile' + (presetMatchesState(p) ? ' selected' : '');
      tile.setAttribute('aria-label', 'Apply preset ' + p.name);
      tile.title = p.name;
      const grad = p.type === 'linear'
        ? `linear-gradient(${p.angle||90}deg, ${p.stops.map(s=>`${s.color} ${s.pos}%`).join(',')})`
        : p.type === 'radial'
          ? `radial-gradient(${p.shape||'circle'} at 50% 50%, ${p.stops.map(s=>`${s.color} ${s.pos}%`).join(',')})`
          : `conic-gradient(from 0deg, ${p.stops.map(s=>`${s.color} ${s.pos}%`).join(',')})`;
      tile.style.background = grad;
      tile.addEventListener('click', ()=>{
        pushHistory();
        applyPreset(p);
      });
      if(p.custom){
        const x = document.createElement('span');
        x.className = 'save-x';
        x.innerHTML = '×';
        x.setAttribute('role','button');
        x.setAttribute('aria-label', 'Delete preset ' + p.name);
        x.addEventListener('click', (e)=>{
          e.stopPropagation();
          customPresets = customPresets.filter(cp=>cp.name!==p.name);
          saveCustomPresets(customPresets);
          renderAll();
        });
        tile.appendChild(x);
      }
      container.appendChild(tile);
    });
  }

  function applyPreset(p){
    state.type = p.type;
    if(p.angle !== undefined) state.angle = p.angle;
    if(p.shape) state.radialShape = p.shape;
    state.stops = p.stops.map(s=>({ id:newId(), color:s.color, pos:s.pos }));
    state.selectedStop = state.stops[0].id;
    renderAll();
    announce('Applied preset ' + p.name);
  }

  function saveCurrentAsPreset(){
    const name = 'Custom ' + (customPresets.length + 1);
    const p = {
      name,
      type: state.type,
      angle: state.angle,
      shape: state.radialShape,
      stops: sortedStopsWithId().map(s=>({ color:s.color, pos:Math.round(s.pos) }))
    };
    customPresets.push(p);
    saveCustomPresets(customPresets);
    renderAll();
    toast('Preset saved');
  }

  /* ================= Export ================= */
  let exportFormat = 'css';
  const DEFAULT_EXPORT_SIZE = { width:1200, height:800 };

  function exportDimensions(){
    if(state.canvasRatio === 'free'){
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if(width > 0 && height > 0){
        const scale = Math.min(1200 / width, 1200 / height);
        return {
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
        };
      }

      return DEFAULT_EXPORT_SIZE;
    }

    const [ratioWidth, ratioHeight] = state.canvasRatio.split(':').map(Number);
    const scale = 1200 / Math.max(ratioWidth, ratioHeight);
    return {
      width: Math.round(ratioWidth * scale),
      height: Math.round(ratioHeight * scale),
    };
  }

  function exportCornerRadius(width, height){
    const canvasRadius = parseFloat(getComputedStyle(canvas).borderTopLeftRadius) || 0;
    const canvasSize = Math.min(canvas.clientWidth, canvas.clientHeight);
    return canvasSize > 0
      ? Math.round(canvasRadius * Math.min(width, height) / canvasSize)
      : canvasRadius;
  }

  function renderExport(container, includeDownload){
    if(includeDownload === undefined) includeDownload = true;
    container.innerHTML = '';

    const tabs = document.createElement('div');
    tabs.className = 'export-tabs';
    [['css','CSS'],['tailwind','Tailwind'],['swift','SwiftUI'],['svg','SVG']].forEach(([id,label])=>{
      const b = document.createElement('button');
      b.textContent = label;
      if(exportFormat===id) b.classList.add('active');
      b.addEventListener('click', ()=>{ exportFormat = id; renderExport(container, includeDownload); });
      tabs.appendChild(b);
    });

    const code = document.createElement('div');
    code.className = 'code-block';
    code.textContent = buildExportCode(exportFormat);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'primary-btn';
    copyBtn.style.marginTop = '12px';
    copyBtn.innerHTML = 'Copy code';
    copyBtn.addEventListener('click', ()=>{
      navigator.clipboard.writeText(code.textContent).then(()=>{
        toast('Copied to clipboard');
      }).catch(()=>{ toast('Could not copy'); });
    });

    container.appendChild(tabs);
    container.appendChild(code);
    container.appendChild(copyBtn);

    if(includeDownload){
      const downloadLabel = document.createElement('span');
      downloadLabel.className = 'field-label';
      downloadLabel.style.marginTop = '14px';
      downloadLabel.textContent = 'Download image';

      const formatRow = document.createElement('div');
      formatRow.className = 'format-row';
      [
        { id:'png', label:'PNG' },
        { id:'jpeg', label:'JPEG' },
        { id:'svg', label:'SVG' },
        { id:'webp', label:'WebP' },
      ].forEach(fmt=>{
        const b = document.createElement('button');
        b.className = 'format-btn';
        b.type = 'button';
        b.setAttribute('aria-label', 'Download as ' + fmt.label);
        b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg><span>${fmt.label}</span>`;
        b.addEventListener('click', ()=> downloadImage(fmt.id));
        formatRow.appendChild(b);
      });

      container.appendChild(downloadLabel);
      container.appendChild(formatRow);
    }
  }

  function buildExportCode(fmt){
    const css = buildCSSGradient();
    if(fmt === 'css') return `background: ${css};`;
    if(fmt === 'tailwind'){
      const stops = sortedStopsWithId();
      if(state.type !== 'linear') return `/* Tailwind arbitrary value */\nbg-[${css}]`;
      const dirMap = {0:'t',45:'tr',90:'r',135:'br',180:'b',225:'bl',270:'l',315:'tl'};
      const nearest = Object.keys(dirMap).reduce((a,b)=> Math.abs(b-state.angle)<Math.abs(a-state.angle)?b:a);
      const from = stops[0], to = stops[stops.length-1];
      const via = stops.length>2 ? ` via-[${stops[1].color}]` : '';
      return `bg-gradient-to-${dirMap[nearest]} from-[${from.color}]${via} to-[${to.color}]`;
    }
    if(fmt === 'swift'){
      const stops = sortedStopsWithId();
      const colorList = stops.map(s=>`Color(hex: "${s.color}")`).join(', ');
      if(state.type === 'linear'){
        return `LinearGradient(\n  colors: [${colorList}],\n  startPoint: .top,\n  endPoint: .bottom\n)`;
      }
      if(state.type === 'radial'){
        return `RadialGradient(\n  colors: [${colorList}],\n  center: .center,\n  startRadius: 0,\n  endRadius: 200\n)`;
      }
      return `AngularGradient(\n  colors: [${colorList}],\n  center: .center\n)`;
    }
    if(fmt === 'svg'){
      const { width, height } = exportDimensions();
      const radius = exportCornerRadius(width, height);
      const stops = sortedStopsWithId();
      const stopEls = stops.map(s=>`  <stop offset="${Math.round(s.pos)}%" stop-color="${s.color}"/>`).join('\n');
      if(state.type === 'radial'){
        const cx = width * state.radialPos.x / 100;
        const cy = height * state.radialPos.y / 100;
        const radiusX = Math.max(cx, width-cx);
        const radiusY = Math.max(cy, height-cy);
        const radiusValue = state.radialShape === 'ellipse' ? radiusX : Math.hypot(radiusX, radiusY);
        const transform = state.radialShape === 'ellipse' ? ` gradientTransform="translate(${cx} ${cy}) scale(1 ${radiusY/radiusX}) translate(${-cx} ${-cy})"` : '';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n <defs><clipPath id="clip"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${radiusValue}"${transform}>\n${stopEls}\n </radialGradient></defs>\n <rect width="${width}" height="${height}" fill="url(#g)" clip-path="url(#clip)"/>\n</svg>`;
      }
      if(state.type === 'conic'){
        const cx = width * state.conicPos.x / 100;
        const cy = height * state.conicPos.y / 100;
        const r = Math.hypot(width, height);
        const wedges = Array.from({length:360}, (_,i)=>{
          const start = (state.angle - 90 + i) * Math.PI / 180;
          const end = (state.angle - 90 + i + 1) * Math.PI / 180;
          const x1 = cx + Math.cos(start)*r, y1 = cy + Math.sin(start)*r;
          const x2 = cx + Math.cos(end)*r, y2 = cy + Math.sin(end)*r;
          return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${colorAtStop(i/360*100)}"/>`;
        }).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n <defs><clipPath id="clip"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath></defs>\n <g clip-path="url(#clip)">${wedges}</g>\n</svg>`;
      }
      const rad = state.angle * Math.PI / 180;
      const dx = Math.sin(rad), dy = -Math.cos(rad);
      const len = Math.abs(width*dx) + Math.abs(height*dy);
      const x1 = width/2 - dx*len/2, y1 = height/2 - dy*len/2;
      const x2 = width/2 + dx*len/2, y2 = height/2 + dy*len/2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n <defs><clipPath id="clip"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">\n${stopEls}\n </linearGradient></defs>\n <rect width="${width}" height="${height}" fill="url(#g)" clip-path="url(#clip)"/>\n</svg>`;
    }
    return css;
  }

  function downloadImage(format){
    if(format === 'svg'){
      const svgText = buildExportCode('svg');
      const blob = new Blob([svgText], { type:'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'gradient.svg';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast('SVG downloaded');
      return;
    }

    const { width: w, height: h } = exportDimensions();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const radius = exportCornerRadius(w, h);
    ctx.beginPath();
    if(typeof ctx.roundRect === 'function'){
      ctx.roundRect(0, 0, w, h, radius);
    } else {
      ctx.rect(0, 0, w, h);
    }
    ctx.clip();
    const stops = sortedStopsWithId();
    let grad;
    if(state.type === 'radial'){
      const cx = w*state.radialPos.x/100, cy = h*state.radialPos.y/100;
      const radiusX = Math.max(cx, w-cx);
      const radiusY = Math.max(cy, h-cy);
      if(state.radialShape === 'ellipse'){
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, radiusY / radiusX);
        ctx.translate(-cx, -cy);
        grad = ctx.createRadialGradient(cx,cy,0,cx,cy,radiusX);
      } else {
        grad = ctx.createRadialGradient(cx,cy,0,cx,cy, Math.hypot(radiusX, radiusY));
      }
    } else if(state.type === 'conic'){
      if(ctx.createConicGradient){
        // CSS conic gradients start at 12 o'clock; Canvas starts at 3 o'clock.
        const canvasAngle = (state.angle - 90) * Math.PI/180;
        grad = ctx.createConicGradient(canvasAngle, w*state.conicPos.x/100, h*state.conicPos.y/100);
      } else {
        toast('Conic export unsupported in this browser');
        grad = ctx.createLinearGradient(0,0,w,0);
      }
    } else {
      const rad = state.angle*Math.PI/180;
      const dx = Math.sin(rad), dy = -Math.cos(rad);
      const len = Math.abs(w*dx) + Math.abs(h*dy);
      grad = ctx.createLinearGradient(w/2-dx*len/2, h/2-dy*len/2, w/2+dx*len/2, h/2+dy*len/2);
    }
    stops.forEach(s=> grad.addColorStop(clamp(s.pos/100,0,1), s.color));
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);
    if(state.type === 'radial' && state.radialShape === 'ellipse') ctx.restore();

    const mimeMap = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' };
    const extMap = { png:'png', jpeg:'jpg', webp:'webp' };
    const mime = mimeMap[format] || 'image/png';
    const dataUrl = c.toDataURL(mime, 0.92);
    const link = document.createElement('a');
    link.download = 'gradient.' + (extMap[format] || 'png');
    link.href = dataUrl;
    link.click();
    toast((format.toUpperCase()) + ' downloaded');
  }

  /* ================= Sheets (mobile overlays) ================= */
  const backdrop = document.getElementById('backdrop');
  let activeSheet = null;
  let lastTrigger = null;

  function openSheet(name){
    closeSheet(false);
    const sheet = document.getElementById('sheet-'+name);
    if(!sheet) return;
    activeSheet = sheet;
    backdrop.classList.add('open');
    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.nav-btn').forEach(b=>{
      const on = b.dataset.openSheet === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true':'false');
    });
    const closeBtn = sheet.querySelector('.sheet-close');
    setTimeout(()=> closeBtn && closeBtn.focus(), 250);
    trapFocus(sheet);
  }

  function closeSheet(restoreFocus){
    if(!activeSheet){
      backdrop.classList.remove('open');
      return;
    }
    activeSheet.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', focusTrapHandler);
    const trigger = lastTrigger;
    activeSheet = null;
    if(restoreFocus !== false && trigger) trigger.focus();
  }

  let focusTrapHandler = null;
  function trapFocus(container){
    document.removeEventListener('keydown', focusTrapHandler);
    focusTrapHandler = function(e){
      if(e.key === 'Escape'){ closeSheet(); return; }
      if(e.key !== 'Tab') return;
      const focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if(!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', focusTrapHandler);
  }

  document.querySelectorAll('[data-open-sheet]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      lastTrigger = btn;
      openSheet(btn.dataset.openSheet);
    });
  });
  document.querySelectorAll('[data-close-sheet]').forEach(btn=>{
    btn.addEventListener('click', ()=> closeSheet());
  });
  backdrop.addEventListener('click', ()=> closeSheet());

  /* ================= Global actions ================= */
  document.querySelectorAll('[data-add-stop]').forEach(b=> b.addEventListener('click', addStop));
  document.querySelectorAll('[data-save-preset]').forEach(b=> b.addEventListener('click', saveCurrentAsPreset));

  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('randomBtn').addEventListener('click', ()=>{
    pushHistory();
    const p = builtInPresets[Math.floor(Math.random()*builtInPresets.length)];
    applyPreset(p);
  });

  const exportNavBtn = document.getElementById('exportNavBtn');
  const exportMenu = document.getElementById('exportMenu');
  exportNavBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const isOpen = exportMenu.classList.toggle('open');
    exportNavBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  exportMenu.querySelectorAll('button[data-fmt]').forEach(b=>{
    b.addEventListener('click', ()=>{
      downloadImage(b.getAttribute('data-fmt'));
      exportMenu.classList.remove('open');
      exportNavBtn.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', (e)=>{
    if(exportMenu.classList.contains('open') && !exportMenu.contains(e.target) && e.target !== exportNavBtn){
      exportMenu.classList.remove('open');
      exportNavBtn.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && exportMenu.classList.contains('open')){
      exportMenu.classList.remove('open');
      exportNavBtn.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('keydown', (e)=>{
    const meta = e.metaKey || e.ctrlKey;
    if(!meta) return;
    const key = e.key.toLowerCase();

    if(key === 'z' && !activeSheet){
      e.preventDefault();
      if(e.shiftKey) redo(); else undo();
      return;
    }
    if(key === 'r' && !activeSheet){
      e.preventDefault();
      pushHistory();
      const p = builtInPresets[Math.floor(Math.random()*builtInPresets.length)];
      applyPreset(p);
      return;
    }
    if(key === 'a' && e.shiftKey && !activeSheet){
      e.preventDefault();
      addStop();
      return;
    }
    if(key === 's' && !activeSheet){
      e.preventDefault();
      saveCurrentAsPreset();
      return;
    }
    if(key === '/'){
      e.preventDefault();
      if(activeSheet && activeSheet.id === 'sheet-about'){
        closeSheet();
      } else {
        lastTrigger = document.getElementById('aboutBtn');
        openSheet('about');
      }
      return;
    }
  });

  /* ================= Render orchestration ================= */
  function renderAll(){
    renderCanvas();
    applyCanvasRatio();
    renderRatioSeg(document.getElementById('ratioSegDesktop'));
    renderRatioSeg(document.getElementById('ratioSegMobile'));
    renderTypeSeg(document.getElementById('typeSegDesktop'));
    renderTypeSeg(document.getElementById('typeSegMobile'));
    renderStopList(document.getElementById('stopListDesktop'));
    renderStopList(document.getElementById('stopListMobile'));
    renderAdjust(document.getElementById('adjustSectionDesktop'));
    renderAdjust(document.getElementById('adjustSectionMobile'));
    renderPresets(document.getElementById('presetGridDesktop'));
    renderPresets(document.getElementById('presetGridMobile'));
    renderExport(document.getElementById('exportSectionDesktop'), false);
    renderExport(document.getElementById('exportSectionMobile'), true);
  }

  renderAll();
})();
