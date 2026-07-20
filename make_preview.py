import json

films = json.load(open("server/data/films.json", encoding="utf-8"))
DATA = json.dumps(films, ensure_ascii=False)

TEMPLATE = r"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My Film Archive — Preview</title>
    <style>
      :root {
        --bg: #0b0b10; --surface: #181821; --surface-2: #1f1f2b; --border: #2a2a38;
        --text: #ECECF2; --muted: #9a9aac; --accent: #e5b13a; --radius: 14px;
        --shadow: 0 10px 30px rgba(0,0,0,0.45);
        font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
      body { background: radial-gradient(1200px 600px at 80% -10%, rgba(229,177,58,0.08), transparent),
                    radial-gradient(900px 500px at -10% 10%, rgba(255,91,91,0.06), transparent), var(--bg);
             min-height: 100vh; }
      .container { width: min(1200px, 92vw); margin: 0 auto; }
      .header { position: sticky; top: 0; z-index: 20; background: rgba(11,11,16,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
      .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; }
      .brand { display: flex; align-items: center; gap: 12px; }
      .brand-icon { font-size: 34px; filter: drop-shadow(0 2px 6px rgba(229,177,58,0.4)); }
      .brand-title { margin: 0; font-size: 22px; }
      .brand-sub { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
      .actions { display: flex; gap: 10px; }
      .btn { border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 10px 16px; border-radius: 10px; font-size: 14px; cursor: pointer; text-decoration: none; transition: transform .1s, background .2s, border-color .2s; white-space: nowrap; }
      .btn:hover { transform: translateY(-1px); }
      .btn-primary { background: linear-gradient(135deg, var(--accent), #f0c25c); color: #1a1407; border-color: transparent; font-weight: 700; }
      .btn-ghost { background: transparent; }
      .theme-toggle { font-size: 16px; padding: 8px 12px; }
      body.light { --bg:#f3f3f7; --surface:#ffffff; --surface-2:#e9e9f1; --border:#d7d7e4; --text:#1a1a22; --muted:#6a6a78; --accent:#b9831a; }
      .controls { display: flex; flex-wrap: wrap; gap: 10px; padding-bottom: 16px; align-items: center; }
      .search-box { position: relative; flex: 1 1 260px; }
      .search-box .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
      .search-box input { width: 100%; padding: 11px 12px 11px 38px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; outline: none; }
      .search-box input:focus { border-color: var(--accent); }
      .select { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 11px 12px; border-radius: 10px; font-size: 14px; cursor: pointer; outline: none; }
      .select:focus { border-color: var(--accent); }
      .view-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
      .view-toggle button { border: none; background: transparent; color: var(--muted); padding: 10px 14px; font-size: 14px; cursor: pointer; }
      .view-toggle button.active { background: linear-gradient(135deg, var(--accent), #f0c25c); color: #1a1407; font-weight: 700; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px; padding: 28px 0 40px; }
      .card { text-align: right; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; padding: 0; color: inherit; transition: transform .15s, border-color .2s, box-shadow .2s; }
      .card:hover { transform: translateY(-5px); border-color: var(--accent); box-shadow: var(--shadow); }
      .poster { position: relative; aspect-ratio: 2 / 3; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .poster-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 14px; font-weight: 700; font-size: 15px; color: #fff; opacity: 0.92; }
      .rating-badge { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: var(--accent); padding: 3px 8px; border-radius: 8px; font-size: 12px; font-weight: 700; }
      .location-badge { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: #fff; padding: 3px 8px; border-radius: 8px; font-size: 11px; }
      .card-body { padding: 10px 12px 14px; }
      .card-title { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; }
      .card-meta { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
      .footer { border-top: 1px solid var(--border); padding: 22px 0; text-align: center; color: var(--muted); font-size: 13px; }
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 40; }
      .modal { position: relative; width: min(820px, 100%); max-height: 90vh; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; display: grid; grid-template-columns: 240px 1fr; gap: 22px; padding: 22px; box-shadow: var(--shadow); }
      .modal-close { position: absolute; top: 12px; left: 12px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer; font-size: 15px; }
      .modal-close:hover { border-color: var(--accent); }
      .modal-poster { align-self: start; border-radius: 12px; overflow: hidden; background: var(--surface-2); aspect-ratio: 2 / 3; }
      .modal-poster img { width: 100%; height: 100%; object-fit: cover; }
      .modal-title { margin: 0; font-size: 24px; }
      .modal-original { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
      .modal-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
      .tag { background: var(--surface-2); border: 1px solid var(--border); padding: 4px 10px; border-radius: 999px; font-size: 13px; color: var(--muted); }
      .tag-accent { color: var(--accent); border-color: rgba(229,177,58,0.4); }
      .modal-genres { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
      .chip { background: rgba(229,177,58,0.12); color: var(--accent); padding: 3px 10px; border-radius: 999px; font-size: 12px; }
      .location-box { display: flex; gap: 12px; align-items: center; background: linear-gradient(135deg, rgba(229,177,58,0.12), rgba(229,177,58,0.04)); border: 1px solid rgba(229,177,58,0.3); border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
      .location-icon { font-size: 22px; }
      .location-label { font-size: 12px; color: var(--muted); }
      .location-value { font-size: 15px; margin-top: 2px; }
      .modal-line { margin: 10px 0; font-size: 15px; line-height: 1.6; }
      .modal-line-label { color: var(--muted); font-size: 13px; margin-bottom: 6px; }
      .modal-cast .cast-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
      .cast-pill { background: var(--surface-2); border: 1px solid var(--border); padding: 5px 12px; border-radius: 999px; font-size: 13px; }
      .modal-synopsis { margin-top: 16px; line-height: 1.8; color: #d2d2de; font-size: 14px; }
      .preview-note { text-align: center; color: var(--muted); font-size: 12px; padding-bottom: 8px; }
      .alpha-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 18px 0 6px; }
      .alpha-btn { border: 1px solid var(--border); background: var(--surface); color: var(--muted); padding: 5px 0; border-radius: 8px; font-size: 13px; cursor: pointer; min-width: 34px; }
      .alpha-btn:hover { border-color: var(--accent); color: var(--text); }
      .alpha-btn.active { background: linear-gradient(135deg, var(--accent), #f0c25c); color: #1a1407; font-weight: 700; border-color: transparent; }
      .alpha-wrap { padding-bottom: 6px; }
      /* list view */
      .list { display: flex; flex-direction: column; gap: 8px; padding: 24px 0 40px; }
      .list-row { display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; transition: border-color .15s, transform .1s; }
      .list-row:hover { border-color: var(--accent); transform: translateY(-1px); }
      .list-main { flex: 1 1 auto; min-width: 0; }
      .list-title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .list-dir { font-size: 12px; color: #c9c9d6; margin-top: 4px; }
      .list-line1 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
      .list-year { font-size: 12px; color: var(--muted); }
      .list-genres { font-size: 12px; color: var(--muted); }
      .list-loc { font-size: 12px; color: var(--muted); }
      .icon-btn { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
      .list-left { flex: 1 1 auto; min-width: 0; text-align: left; }
      .list-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; text-align: right; flex: 0 0 auto; }
      .icon-btn:hover { border-color: var(--accent); }
      /* edit modal */
      .edit-modal { width: min(640px, 100%); grid-template-columns: 1fr; max-height: 90vh; overflow: auto; }
      .edit-title { margin: 0 0 14px; font-size: 20px; }
      .edit-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .edit-field { display: flex; flex-direction: column; gap: 5px; }
      .edit-field.full { grid-column: 1 / -1; }
      .edit-field span { font-size: 12px; color: var(--muted); }
      .edit-field input, .edit-field textarea { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 9px 10px; font-size: 14px; font-family: inherit; outline: none; resize: vertical; }
      .edit-field input:focus, .edit-field textarea:focus { border-color: var(--accent); }
      .edit-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
      @media (max-width: 560px) { .edit-form { grid-template-columns: 1fr; } .list-meta { display: none; } .header-inner { flex-direction: column; align-items: flex-start; } }
    </style>
  </head>
  <body>
    <div class="app">
      <header class="header">
        <div class="container header-inner">
          <div class="brand"><span class="brand-icon">🎬</span><div><h1 class="brand-title">My Film Archive</h1><p class="brand-sub" id="count">0 films</p></div></div>
          <div class="actions"><button class="btn btn-primary" title="Available in the real app">⬆️ Import Excel</button><button class="btn btn-ghost" title="Available in the real app">⬇️ Download Template</button><button class="btn btn-ghost theme-toggle" id="themeToggle" onclick="toggleTheme()" title="Toggle dark / light">☀️</button></div>
        </div>
        <div class="container"><div class="alpha-bar" id="alphabar"></div></div>
        <div class="container controls">
          <div class="search-box"><span class="search-icon">🔍</span><input id="search" type="search" placeholder="Search title, director or actor…" /></div>
          <select id="genre" class="select"><option value="">All genres</option></select>
          <select id="decade" class="select"><option value="">All decades</option></select>
          <select id="sort" class="select"><option value="shelf">By shelf</option><option value="year_desc">Newest</option><option value="year_asc">Oldest</option><option value="rating">Top rated</option></select>
          <div class="view-toggle" role="group"><button id="vt-grid" class="active" onclick="setView('grid')">🖼 Posters</button><button id="vt-list" onclick="setView('list')">📋 List</button></div>
        </div>
        <div class="container"><p class="preview-note">Static preview — switch between <b>Posters</b> and <b>List</b>; in List view click ✏️ to edit a film (changes apply here in this preview; the real app saves to the backend).</p></div>
      </header>
      <main class="container"><div id="view"></div></main>
      <footer class="footer">Physical film archive · Built with React and Node.js</footer>
      <div class="modal-overlay" id="modal" style="display:none"></div>
    </div>
    <script>
      const FILMS = __DATA__;
      FILMS.forEach((f, i) => { f.__i = i; });
      const PALETTE=[['#3a2f5b','#1f1830'],['#5b3a3a','#301f1f'],['#2f5b4f','#183026'],['#5b4f2f','#302618'],['#2f3f5b','#182330'],['#4f2f5b','#261830']];
      const hash = s => { let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return Math.abs(h); };
      const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const viewEl = document.getElementById('view');
      const genreSel = document.getElementById('genre');
      const decadeSel = document.getElementById('decade');
      const sortSel = document.getElementById('sort');
      const search = document.getElementById('search');
      const countEl = document.getElementById('count');
      let view = 'grid';
      let theme = localStorage.getItem('fa_theme') || 'dark';
      function toggleTheme(){ theme = theme==='dark'?'light':'dark'; document.body.classList.toggle('light', theme==='light'); localStorage.setItem('fa_theme', theme); const b=document.getElementById('themeToggle'); if(b) b.textContent = theme==='dark'?'☀️':'🌙'; }
      let alpha = '';
      function setAlpha(a){ alpha=a; renderAlphaBar(); render(); }
      function buildAlphaBar(){
        const chars=['0-9',...'abcdefghijklmnopqrstuvwxyz'.split('')];
        let b=`<button class="alpha-btn ${alpha===''?'active':''}" onclick="setAlpha('')">All</button>`;
        chars.forEach(c=>{ b+=`<button class="alpha-btn ${alpha===c?'active':''}" onclick="setAlpha('${c}')">${c.toUpperCase()}</button>`; });
        return `<div class="alpha-bar">${b}</div>`;
      }

      [...new Set(FILMS.flatMap(f=>f.genre||[]))].sort().forEach(g=> genreSel.add(new Option(g,g)));
      [...new Set(FILMS.map(f=>typeof f.year==='number'?Math.floor(f.year/10)*10:null).filter(x=>x!==null))].sort((a,b)=>a-b).forEach(d=> decadeSel.add(new Option(d+'s', d)));

      function getList(){
        const q=search.value.trim().toLowerCase();
        const g=genreSel.value, dv=decadeSel.value, so=sortSel.value;
        let list=FILMS.filter(f=>{
          if(q && !((f.title||'').toLowerCase().includes(q)||(f.director||'').toLowerCase().includes(q)||(f.cast||[]).join(' ').toLowerCase().includes(q))) return false;
          if(g && !(f.genre||[]).includes(g)) return false;
          if(dv){ const d=parseInt(dv,10); if(!(typeof f.year==='number' && Math.floor(f.year/10)*10===d)) return false; }
          return true;
        });
        if(alpha){ const a=alpha.toLowerCase(); list=list.filter(f=>{ const t=(f.title||'').toLowerCase(); return t && t[0]===a; }); }
        if(so==='year_desc') list.sort((a,b)=>(b.year||0)-(a.year||0));
        else if(so==='year_asc') list.sort((a,b)=>(a.year||0)-(b.year||0));
        else if(so==='rating') list.sort((a,b)=>(b.rating||0)-(a.rating||0));
        else list.sort((a,b)=>(a.shelf||'').localeCompare(b.shelf||''));
        return list;
      }
      function gridCard(f){
        const [c1,c2]=PALETTE[hash(String(f.id))%PALETTE.length];
        const loc=(f.shelf||f.row)?`<span class="location-badge">📍 ${esc(f.shelf||'–')} / ${esc(f.row||'–')}</span>`:'';
        const rate=typeof f.rating==='number'?`<span class="rating-badge">★ ${f.rating.toFixed(1)}</span>`:'';
        return `<button class="card" onclick="openModal(${f.__i})"><div class="poster" style="background:linear-gradient(160deg,${c1},${c2})"><img src="${esc(f.poster)}" alt="${esc(f.title)}" onerror="this.style.display='none'"><span class="poster-fallback">${esc(f.title)}</span>${rate}${loc}</div><div class="card-body"><h3 class="card-title">${esc(f.title)}</h3><p class="card-meta">${f.year||'—'} · ${(f.genre||[]).slice(0,2).join(', ')}</p></div></button>`;
      }
      function listRow(f){
        const rating = typeof f.rating==='number'?`<span class="tag tag-accent">★ ${f.rating.toFixed(1)}</span>`:'';
        const genres = (f.genre||[]).join(', ');
        return `<div class="list-row" onclick="openModal(${f.__i})"><div class="list-left"><div class="list-line1"><span class="list-title">${esc(f.title)}</span>${f.year?`<span class="list-year">${f.year}</span>`:''}</div>${f.director?`<div class="list-dir">🎬 ${esc(f.director)}</div>`:''}</div><div class="list-right">${genres?`<span class="list-genres">${esc(genres)}</span>`:''}<span class="list-loc">📍 ${esc(f.shelf||'–')} / ${esc(f.row||'–')}</span>${rating}</div><button class="icon-btn" title="Edit" onclick="event.stopPropagation();openEdit(${f.__i})">✏️</button></div>`;
      }
      function render(){
        const list=getList();
        countEl.textContent=list.length+' films';
        if(view==='list'){ viewEl.className='list'; viewEl.innerHTML = list.map(listRow).join(''); }
        else { viewEl.className='grid'; viewEl.innerHTML = list.map(gridCard).join(''); }
      }
      function renderAlphaBar(){
        const el=document.getElementById('alphabar');
        if(!el) return;
        const chars=['0-9',...'abcdefghijklmnopqrstuvwxyz'.split('')];
        let b=`<button class="alpha-btn ${alpha===''?'active':''}" onclick="setAlpha('')">All</button>`;
        chars.forEach(c=>{ b+=`<button class="alpha-btn ${alpha===c?'active':''}" onclick="setAlpha('${c}')">${c.toUpperCase()}</button>`; });
        el.innerHTML=b;
      }
      function setView(v){ view=v; document.getElementById('vt-grid').classList.toggle('active',v==='grid'); document.getElementById('vt-list').classList.toggle('active',v==='list'); render(); }

      function openModal(i){
        const f=FILMS[i];
        const hasLoc=f.shelf||f.row;
        const loc=hasLoc?`<div class="location-box"><span class="location-icon">📍</span><div><div class="location-label">Physical location</div><div class="location-value">Shelf <strong>${esc(f.shelf||'–')}</strong> · Row <strong>${esc(f.row||'–')}</strong></div></div></div>`:'';
        const cast=(f.cast||[]).length?`<div class="modal-cast"><div class="modal-line-label">Main cast:</div><div class="cast-list">${f.cast.map(n=>`<span class="cast-pill">${esc(n)}</span>`).join('')}</div></div>`:'';
        const tags=[f.year?`<span class="tag">${f.year}</span>`:'', typeof f.rating==='number'?`<span class="tag tag-accent">★ ${f.rating.toFixed(1)}</span>`:'', f.runtime?`<span class="tag">${f.runtime} min</span>`:'', f.country?`<span class="tag">${f.country}</span>`:''].join('');
        const genres=(f.genre||[]).map(g=>`<span class="chip">${esc(g)}</span>`).join('');
        document.getElementById('modal').innerHTML=`<div class="modal" onclick="event.stopPropagation()"><button class="modal-close" onclick="closeModal()">✕</button><div class="modal-poster"><img src="${esc(f.poster)}" alt="${esc(f.title)}" onerror="this.style.display='none'"></div><div class="modal-info"><h2 class="modal-title">${esc(f.title)}</h2>${f.originalTitle?`<p class="modal-original">${esc(f.originalTitle)}</p>`:''}<div class="modal-tags">${tags}</div>${genres?`<div class="modal-genres">${genres}</div>`:''}${loc}${f.director?`<p class="modal-line"><span class="modal-line-label">Director:</span> ${esc(f.director)}</p>`:''}${cast}${f.synopsis?`<p class="modal-synopsis">${esc(f.synopsis)}</p>`:''}</div></div>`;
        document.getElementById('modal').style.display='flex';
      }
      function openEdit(i){
        const f=FILMS[i];
        const val=x=>esc(x==null?'':x);
        document.getElementById('modal').innerHTML=`<div class="modal edit-modal" onclick="event.stopPropagation()"><button class="modal-close" onclick="closeModal()">✕</button><h2 class="edit-title">Edit film</h2><div class="edit-form">
<label class="edit-field full"><span>Title</span><input id="e_title" value="${val(f.title)}"></label>
<label class="edit-field"><span>Shelf</span><input id="e_shelf" value="${val(f.shelf)}"></label>
<label class="edit-field"><span>Row</span><input id="e_row" value="${val(f.row)}"></label>
<label class="edit-field"><span>Year</span><input id="e_year" type="number" value="${val(f.year)}"></label>
<label class="edit-field"><span>Rating</span><input id="e_rating" type="number" step="0.1" value="${val(f.rating)}"></label>
<label class="edit-field"><span>Runtime (min)</span><input id="e_runtime" type="number" value="${val(f.runtime)}"></label>
<label class="edit-field"><span>Country</span><input id="e_country" value="${val(f.country)}"></label>
<label class="edit-field full"><span>Director</span><input id="e_director" value="${val(f.director)}"></label>
<label class="edit-field full"><span>Cast (comma separated)</span><input id="e_cast" value="${val((f.cast||[]).join(', '))}"></label>
<label class="edit-field full"><span>Genre (comma separated)</span><input id="e_genre" value="${val((f.genre||[]).join(', '))}"></label>
<label class="edit-field full"><span>Poster URL</span><input id="e_poster" value="${val(f.poster)}"></label>
<label class="edit-field full"><span>Synopsis</span><textarea id="e_synopsis" rows="3">${val(f.synopsis)}</textarea></label>
</div><div class="edit-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveEdit(${i})">💾 Save</button></div></div>`;
        document.getElementById('modal').style.display='flex';
      }
      function saveEdit(i){
        const f=FILMS[i]; const gv=id=>document.getElementById(id).value;
        f.title=gv('e_title'); f.shelf=gv('e_shelf'); f.row=gv('e_row');
        f.year=gv('e_year')!==''?parseInt(gv('e_year'),10):undefined;
        f.rating=gv('e_rating')!==''?parseFloat(gv('e_rating')):undefined;
        f.runtime=gv('e_runtime')!==''?parseInt(gv('e_runtime'),10):undefined;
        f.country=gv('e_country')||undefined;
        f.director=gv('e_director')||undefined;
        f.cast=gv('e_cast').split(',').map(s=>s.trim()).filter(Boolean);
        f.genre=gv('e_genre').split(',').map(s=>s.trim()).filter(Boolean);
        f.poster=gv('e_poster')||undefined;
        f.synopsis=gv('e_synopsis')||undefined;
        render(); closeModal();
      }
      function closeModal(){ document.getElementById('modal').style.display='none'; }
      document.getElementById('modal').addEventListener('click', closeModal);
      document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
      search.addEventListener('input', render);
      genreSel.addEventListener('change', render);
      decadeSel.addEventListener('change', render);
      sortSel.addEventListener('change', render);
      renderAlphaBar();
      render();
      document.body.classList.toggle('light', theme==='light');
      const tb=document.getElementById('themeToggle'); if(tb) tb.textContent = theme==='dark'?'☀️':'🌙';
    </script>
  </body>
</html>
"""

html = TEMPLATE.replace("__DATA__", DATA)
with open("preview.html", "w", encoding="utf-8") as f:
    f.write(html)
print("preview.html written with", len(films), "films + list/edit features")
