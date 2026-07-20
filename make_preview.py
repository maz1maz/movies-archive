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
        --text: #ECECF2; --muted: #9a9aac; --accent: #38bdf8; --radius: 14px;
        --shadow: 0 10px 30px rgba(0,0,0,0.45);
        font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
      body { background: radial-gradient(1200px 600px at 80% -10%, rgba(56,189,248,0.08), transparent),
                    radial-gradient(900px 500px at -10% 10%, rgba(255,91,91,0.06), transparent), var(--bg);
             min-height: 100vh; }
      .container { width: min(1200px, 92vw); margin: 0 auto; }
      .header { position: sticky; top: 0; z-index: 20; background: rgba(11,11,16,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
      .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; }
      .brand { display: flex; align-items: center; gap: 12px; }
      .brand-icon { font-size: 34px; filter: drop-shadow(0 2px 6px rgba(56,189,248,0.4)); }
      .brand-title { margin: 0; font-size: 22px; }
      .brand-sub { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
      .actions { display: flex; gap: 10px; }
      .btn { border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 10px 16px; border-radius: 10px; font-size: 14px; cursor: pointer; text-decoration: none; transition: transform .1s, background .2s, border-color .2s; white-space: nowrap; }
      .btn:hover { transform: translateY(-1px); }
      .btn-primary { background: linear-gradient(135deg, var(--accent), #7dd3fc); color: #0f172a; border-color: transparent; font-weight: 700; }
      .btn-ghost { background: transparent; }
      .theme-toggle { font-size: 16px; padding: 8px 12px; }
      body.light { --bg:#f3f3f7; --surface:#ffffff; --surface-2:#e9e9f1; --border:#d7d7e4; --text:#1a1a22; --muted:#6a6a78; --accent:#0284c7; }
      .controls { display: flex; flex-wrap: wrap; gap: 10px; padding-bottom: 16px; align-items: center; }
      .search-box { position: relative; flex: 1 1 260px; }
      .search-box .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
      .search-box input { width: 100%; padding: 11px 12px 11px 38px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; outline: none; }
      .search-box input:focus { border-color: var(--accent); }
      .select { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 11px 12px; border-radius: 10px; font-size: 14px; cursor: pointer; outline: none; }
      .select:focus { border-color: var(--accent); }
      .view-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
      .view-toggle button { border: none; background: transparent; color: var(--muted); padding: 10px 14px; font-size: 14px; cursor: pointer; }
      .view-toggle button.active { background: linear-gradient(135deg, var(--accent), #7dd3fc); color: #0f172a; font-weight: 700; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px; padding: 28px 0 40px; }
      .card { text-align: right; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; padding: 0; color: inherit; transition: transform .15s, border-color .2s, box-shadow .2s; }
      .card:hover { transform: translateY(-5px); border-color: var(--accent); box-shadow: var(--shadow); }
      .poster { position: relative; aspect-ratio: 2 / 3; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .poster-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 14px; font-weight: 700; font-size: 15px; color: #fff; opacity: 0.92; }
      .rating-badge { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #f5c518; padding: 3px 8px; border-radius: 8px; font-size: 12px; font-weight: 700; }
      .location-badge { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: #fff; padding: 3px 8px; border-radius: 8px; font-size: 11px; }
      .card-body { padding: 10px 12px 14px; }
      .card-title { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; }
      .card-meta { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
      .footer { border-top: 1px solid var(--border); padding: 22px 0; text-align: center; color: var(--muted); font-size: 13px; }
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 40; }
      
      /* CLZ Modal Styles matching 6.pdf */
      .modal { position: relative; width: min(920px, 96vw); max-height: 90vh; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px 28px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 20px; }
      .modal-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; }
      .modal-close:hover { border-color: var(--accent); }
      
      .clz-header { display: flex; align-items: baseline; gap: 10px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
      .clz-title { margin: 0; font-size: 24px; font-weight: 700; color: #38bdf8; }
      .clz-subtitle { font-size: 14px; color: var(--muted); }
      .clz-top-section { display: flex; gap: 22px; align-items: flex-start; }
      .clz-poster-wrap { position: relative; width: 170px; flex: 0 0 auto; aspect-ratio: 2 / 3; border-radius: 10px; overflow: hidden; background: var(--surface-2); border: 1px solid var(--border); box-shadow: 0 8px 20px rgba(0,0,0,0.3); }
      .clz-poster-img { width: 100%; height: 100%; object-fit: cover; }
      .clz-info-body { flex: 1 1 auto; display: flex; flex-direction: column; gap: 10px; }
      .clz-meta-line { font-size: 13.5px; color: var(--text); font-weight: 600; }
      .clz-synopsis { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--text); opacity: 0.9; }
      .clz-badges-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
      .imdb-badge { display: inline-flex; align-items: center; background: #f5c518; color: #000; border-radius: 6px; padding: 3px 8px; font-weight: 800; font-size: 13px; gap: 6px; box-shadow: 0 2px 6px rgba(245, 197, 24, 0.3); }
      .imdb-logo { background: #000; color: #f5c518; padding: 1px 4px; border-radius: 3px; font-size: 11px; letter-spacing: 0.5px; }
      .clz-location-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 13px; }
      .clz-specs-box { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
      .clz-spec-item { font-size: 13px; }
      .clz-spec-item.font-semibold { font-weight: 600; color: var(--text); }
      .clz-spec-item.muted { color: var(--muted); }
      
      .clz-bottom-grid { display: grid; grid-template-columns: 1.2fr 1fr 180px; gap: 18px; border-top: 1px solid var(--border); padding-top: 18px; }
      .clz-col-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .clz-col-header h3 { margin: 0; font-size: 15px; font-weight: 700; color: #38bdf8; }
      .clz-view-all { font-size: 12px; color: var(--muted); cursor: pointer; }
      .clz-table { display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); }
      .clz-table-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
      .clz-table-row:last-child { border-bottom: none; }
      .clz-table-row:nth-child(even) { background: rgba(255, 255, 255, 0.03); }
      .clz-actor-info { display: flex; align-items: center; gap: 10px; }
      .clz-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--border); color: var(--text); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex: 0 0 auto; }
      .crew-row .crew-label { font-weight: 600; color: var(--text); min-width: 80px; }
      .crew-row .crew-value { color: var(--muted); text-align: right; }
      .clz-trailer-card { display: block; text-decoration: none; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); position: relative; transition: transform 0.15s, border-color 0.15s; }
      .clz-trailer-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
      .clz-trailer-thumb { position: relative; aspect-ratio: 16 / 9; background: #000; display: flex; align-items: center; justify-content: center; }
      .clz-trailer-thumb img { width: 100%; height: 100%; object-fit: cover; opacity: 0.7; }
      .clz-play-btn { position: absolute; width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.75); border: 2px solid #fff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; }
      .clz-trailer-label { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }

      .preview-note { text-align: center; color: var(--muted); font-size: 12px; padding-bottom: 8px; }
      .alpha-bar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; margin: 18px auto 6px; }
      .alpha-btn { border: 1px solid var(--border); background: var(--surface); color: var(--muted); padding: 5px 0; border-radius: 8px; font-size: 13px; cursor: pointer; min-width: 34px; }
      .alpha-btn:hover { border-color: var(--accent); color: var(--text); }
      .alpha-btn.active { background: linear-gradient(135deg, var(--accent), #7dd3fc); color: #0f172a; font-weight: 700; border-color: transparent; }
      
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
      
      @media (max-width: 768px) { .clz-top-section { flex-direction: column; align-items: center; text-align: center; } .clz-bottom-grid { grid-template-columns: 1fr; } }
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
      
      [...new Set(FILMS.flatMap(f=>f.genre||[]))].sort().forEach(g=> genreSel.add(new Option(g,g)));
      [...new Set(FILMS.map(f=>typeof f.year==='number'?Math.floor(f.year/10)*10:null).filter(x=>x!==null))].sort((a,b)=>a-b).forEach(d=> decadeSel.add(new Option(d+'s', d)));

      function formatRuntime(min){
        if(!min) return null;
        const h = Math.floor(min/60); const m = min%60;
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      }

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
        return `<div class="list-row" onclick="openModal(${f.__i})"><div class="list-left"><div class="list-line1"><span class="list-title">${esc(f.title)}</span>${f.year?`<span class="list-year">${f.year}</span>`:''}</div>${f.director?`<div class="list-dir">🎬 ${esc(f.director)}</div>`:''}</div><div class="list-right">${genres?`<span class="list-genres">${esc(genres)}</span>`:''}<span class="list-loc">📍 ${esc(f.shelf||'–')} / ${esc(f.row||'–')}</span>${rating}</div></div>`;
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
        const castList=Array.isArray(f.cast)?f.cast:[];
        const genreText=Array.isArray(f.genre)?f.genre.join(', '):(f.genre||'');
        const trailerUrl='https://www.youtube.com/results?search_query='+encodeURIComponent((f.originalTitle||f.title)+' official trailer');
        const rt = formatRuntime(f.runtime);

        let castHtml = '';
        if(castList.length===0) castHtml='<div class="clz-table-row">No cast info</div>';
        else {
          castList.slice(0,5).forEach(act=>{
            castHtml += `<div class="clz-table-row"><div class="clz-actor-info"><span class="clz-avatar">${esc(act[0])}</span><span class="clz-actor-name">${esc(act)}</span></div></div>`;
          });
        }

        document.getElementById('modal').innerHTML=`<div class="modal" onclick="event.stopPropagation()">
          <button class="modal-close" onclick="closeModal()">✕</button>
          
          <div class="clz-header">
            <h2 class="clz-title">${esc(f.title)}</h2>
            ${f.originalTitle && f.originalTitle!==f.title ? `<span class="clz-subtitle">(${esc(f.originalTitle)})</span>` : ''}
          </div>

          <div class="clz-top-section">
            <div class="clz-poster-wrap">
              <img src="${esc(f.poster)}" alt="${esc(f.title)}" class="clz-poster-img" onerror="this.style.display='none'">
            </div>
            <div class="clz-info-body">
              <div class="clz-meta-line">
                ${f.country?`<span class="clz-studio">${esc(f.country)}</span>`:''}
                ${f.year?`<span class="clz-year">(${f.year})</span>`:''}
              </div>
              ${f.synopsis ? `<p class="clz-synopsis">${esc(f.synopsis)}</p>` : ''}
              
              <div class="clz-badges-row">
                ${typeof f.rating==='number' ? `<div class="imdb-badge"><span class="imdb-logo">IMDb</span><span>${f.rating.toFixed(1)}</span></div>` : ''}
                ${(f.shelf||f.row) ? `<div class="clz-location-badge">📍 Shelf <strong>${esc(f.shelf||'–')}</strong> / Row <strong>${esc(f.row||'–')}</strong></div>` : ''}
              </div>

              <div class="clz-specs-box">
                ${genreText ? `<div class="clz-spec-item font-semibold">${esc(genreText)}</div>` : ''}
                <div class="clz-spec-item muted">${[f.country, 'English', 'Color', rt ? rt+` (${f.runtime}m)` : null].filter(Boolean).join(' | ')}</div>
              </div>
            </div>
          </div>

          <div class="clz-bottom-grid">
            <div class="clz-col">
              <div class="clz-col-header"><h3>Cast</h3>${castList.length>4?'<span class="clz-view-all">View all ▾</span>':''}</div>
              <div class="clz-table">${castHtml}</div>
            </div>

            <div class="clz-col">
              <div class="clz-col-header"><h3>Crew</h3><span class="clz-view-all">View all ▾</span></div>
              <div class="clz-table">
                ${f.director ? `<div class="clz-table-row crew-row"><span class="crew-label">Director</span><span class="crew-value">${esc(f.director)}</span></div>` : ''}
                <div class="clz-table-row crew-row"><span class="crew-label">Writer</span><span class="crew-value">${esc(f.director||'—')}</span></div>
                <div class="clz-table-row crew-row"><span class="crew-label">Country</span><span class="crew-value">${esc(f.country||'—')}</span></div>
                ${f.runtime ? `<div class="clz-table-row crew-row"><span class="crew-label">Runtime</span><span class="crew-value">${f.runtime} minutes</span></div>` : ''}
              </div>
            </div>

            <div class="clz-col">
              <div class="clz-col-header"><h3>Trailer</h3></div>
              <a href="${trailerUrl}" target="_blank" rel="noopener noreferrer" class="clz-trailer-card">
                <div class="clz-trailer-thumb">
                  <img src="${esc(f.poster)}" alt="Trailer">
                  <div class="clz-play-btn">▶</div>
                  <div class="clz-trailer-label">FEATURETTE HD</div>
                </div>
              </a>
            </div>
          </div>
        </div>`;
        document.getElementById('modal').style.display='flex';
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
print("preview.html written with CLZ modal design from 6.pdf")
