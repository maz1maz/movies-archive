import json

films = json.load(open("server/data/films.json", encoding="utf-8"))
DATA = json.dumps(films, ensure_ascii=False)

TEMPLATE = r"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cinefilio Archive — Preview</title>
    <style>
      :root {
        --bg: #121316; --surface: #1b1c20; --surface-2: #212227; --border: #2b2c32;
        --border-strong: #3a3b42; --text: #ececed; --muted: #8d8f98; --accent: #38bdf8;
        --radius: 10px; --shadow: 0 16px 36px rgba(0,0,0,0.35);
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); min-height: 100vh; }
      .container { width: min(1200px, 92vw); margin: 0 auto; }
      .header { position: sticky; top: 0; z-index: 20; background: var(--bg); border-bottom: 1px solid var(--border); }
      .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0 12px; }
      .brand-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; text-align: center; color: #f8fafc; }
      .actions { display: flex; gap: 10px; }
      .btn { border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; text-decoration: none; }
      
      .controls { display: flex; flex-wrap: wrap; gap: 10px; padding-bottom: 16px; align-items: center; }
      .search-box { position: relative; flex: 1 1 260px; }
      .search-box .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
      .search-box input { width: 100%; padding: 10px 12px 10px 38px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13.5px; outline: none; }
      .search-box input:focus { border-color: var(--accent); }
      .select { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 10px 12px; border-radius: 8px; font-size: 13.5px; cursor: pointer; outline: none; }
      
      /* Alphabet bar matching 7.png */
      .alpha-bar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; margin: 14px auto 8px; }
      .alpha-btn { border: 1px solid var(--border); background: #232631; color: #94a3b8; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; min-width: 34px; text-align: center; }
      .alpha-btn:hover { border-color: #475569; color: #f1f5f9; }
      .alpha-btn.active { background: #eab308; color: #000000; font-weight: 800; border-color: #f5c518; box-shadow: 0 2px 8px rgba(234,179,8,0.35); }

      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px; padding: 24px 0 40px; }
      .card { text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer; padding: 0; color: inherit; transition: transform .15s, border-color .15s; }
      .card:hover { transform: translateY(-4px); border-color: var(--accent); }
      .poster { position: relative; aspect-ratio: 2 / 3; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #1e293b; }
      .poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .poster-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 12px; font-weight: 600; font-size: 13px; color: #94a3b8; }
      .card-body { padding: 10px 12px 12px; }
      .card-title { margin: 0; font-size: 14px; font-weight: 600; color: #f8fafc; }
      .card-meta { margin: 4px 0 0; font-size: 12px; color: #94a3b8; }

      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
      
      /* Exact Modal Cine from 7.png */
      .modal-cine { position: relative; width: min(680px, 92vw); max-height: 90vh; overflow-y: auto; background: #232631; border: 1px solid #334155; border-radius: 16px; padding: 22px 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 16px; color: #f8fafc; }
      .cine-close { position: absolute; top: 16px; right: 16px; width: 28px; height: 28px; border-radius: 50%; border: none; background: transparent; color: #94a3b8; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
      .cine-close:hover { color: #f1f5f9; }

      .cine-title-block { display: flex; flex-direction: column; gap: 4px; }
      .cine-title { margin: 0; font-size: 24px; font-weight: 700; color: #38bdf8; }
      .cine-subtitle { margin: 0; font-size: 13.5px; color: #94a3b8; }

      .cine-main-row { display: flex; gap: 16px; align-items: stretch; }
      .cine-poster-box { position: relative; width: 155px; flex: 0 0 auto; aspect-ratio: 2 / 3; border-radius: 10px; overflow: hidden; background: #1e293b; border: 1px solid #334155; box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
      .cine-poster-img { width: 100%; height: 100%; object-fit: cover; }
      .cine-poster-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px; font-size: 12px; color: #94a3b8; }

      .cine-info-card { flex: 1 1 auto; background: #2b2e3b; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
      .cine-badges-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

      .imdb-badge-cine { display: inline-flex; align-items: center; background: #f5c518; color: #000; border-radius: 5px; padding: 3px 7px; font-weight: 800; font-size: 12.5px; gap: 5px; }
      .imdb-pill { background: #000; color: #f5c518; padding: 1px 3px; border-radius: 3px; font-size: 10px; font-weight: 900; }
      .cine-shelf-badge { display: inline-flex; align-items: center; gap: 6px; background: #2563eb; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 600; }

      .cine-synopsis-box { display: flex; flex-direction: column; gap: 4px; }
      .cine-section-label { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #94a3b8; text-transform: uppercase; }
      .cine-synopsis-text { margin: 0; font-size: 12.5px; line-height: 1.5; color: #e2e8f0; }

      .cine-bottom-row { display: grid; grid-template-columns: 1fr 1fr 160px; gap: 16px; padding-top: 6px; }
      .cine-col { display: flex; flex-direction: column; gap: 8px; }
      .cine-col-title { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #94a3b8; text-transform: uppercase; }

      .cine-cast-grid { display: flex; flex-wrap: wrap; gap: 10px 12px; }
      .cine-cast-item { display: flex; flex-direction: column; align-items: center; width: 48px; gap: 4px; }
      .cine-actor-avatar { width: 38px; height: 38px; border-radius: 50%; background: #334155; color: #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; border: 1px solid #475569; }
      .cine-actor-name { font-size: 11px; color: #cbd5e1; text-align: center; line-height: 1.2; word-break: break-word; }

      .cine-crew-table { display: flex; flex-direction: column; gap: 4px; }
      .cine-crew-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; border-bottom: 1px solid #2d3241; }
      .crew-key { color: #94a3b8; }
      .crew-val { color: #f1f5f9; text-align: right; font-weight: 500; }

      .cine-trailer-card { display: block; text-decoration: none; border-radius: 10px; overflow: hidden; border: 1px solid #334155; transition: transform 0.15s; }
      .cine-trailer-card:hover { transform: scale(1.02); }
      .cine-trailer-media { position: relative; aspect-ratio: 16 / 9; background: #0f172a; display: flex; align-items: center; justify-content: center; }
      .cine-trailer-bg { width: 100%; height: 100%; object-fit: cover; opacity: 0.65; }
      .cine-play-circle { position: absolute; width: 38px; height: 38px; border-radius: 50%; background: rgba(255, 255, 255, 0.9); color: #000; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
      .play-triangle { font-size: 13px; margin-left: 2px; }
      .cine-hd-tag { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.85); color: #ea580c; font-size: 9.5px; font-weight: 800; padding: 1px 5px; border-radius: 3px; }
    </style>
  </head>
  <body>
    <div class="app">
      <header class="header">
        <div class="container header-inner">
          <div style="flex:1"></div>
          <h1 class="brand-title">CINEFILIO ARCHIVE</h1>
          <div style="flex:1; text-align:right"><span style="font-size:13px; color:#94a3b8">👤 Menu ▾</span></div>
        </div>
        <div class="container"><div class="alpha-bar" id="alphabar"></div></div>
        <div class="container controls">
          <div class="search-box"><span class="search-icon">🔍</span><input id="search" type="search" placeholder="Search title, director or actor…" /></div>
          <select id="genre" class="select"><option value="">All genres</option></select>
          <select id="decade" class="select"><option value="">All decades</option></select>
          <select id="sort" class="select"><option value="shelf">By shelf</option><option value="year_desc">Newest</option><option value="year_asc">Oldest</option><option value="rating">Top rated</option></select>
        </div>
      </header>
      <main class="container"><div id="view" class="grid"></div></main>
      <div class="modal-overlay" id="modal" style="display:none"></div>
    </div>
    <script>
      const FILMS = __DATA__;
      FILMS.forEach((f, i) => { f.__i = i; });
      const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const viewEl = document.getElementById('view');
      const genreSel = document.getElementById('genre');
      const decadeSel = document.getElementById('decade');
      const sortSel = document.getElementById('sort');
      const search = document.getElementById('search');
      let alpha = 'A';

      [...new Set(FILMS.flatMap(f=>f.genre||[]))].sort().forEach(g=> genreSel.add(new Option(g,g)));
      [...new Set(FILMS.map(f=>typeof f.year==='number'?Math.floor(f.year/10)*10:null).filter(x=>x!==null))].sort((a,b)=>a-b).forEach(d=> decadeSel.add(new Option(d+'s', d)));

      function formatRuntime(min){
        if(!min) return '';
        const h = Math.floor(min/60); const m = min%60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      }

      function setAlpha(a){ alpha=a; renderAlphaBar(); render(); }

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
        const genreText = (f.genre||[]).slice(0,2).join(', ');
        return `<button class="card" onclick="openModal(${f.__i})"><div class="poster"><img src="${esc(f.poster)}" alt="${esc(f.title)}" onerror="this.style.display='none'"><span class="poster-fallback">${esc(f.title)}</span></div><div class="card-body"><h3 class="card-title">${esc(f.title)}</h3><p class="card-meta">${f.year||'2017'} | ${genreText||'Action'}</p></div></button>`;
      }

      function render(){
        const list=getList();
        viewEl.innerHTML = list.map(gridCard).join('');
      }

      function renderAlphaBar(){
        const el=document.getElementById('alphabar');
        if(!el) return;
        const chars=['ALL','0-9',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
        let b='';
        chars.forEach(c=>{
          const key = c==='ALL'?'':c;
          b+=`<button class="alpha-btn ${alpha===key?'active':''}" onclick="setAlpha('${key}')">${c}</button>`;
        });
        el.innerHTML=b;
      }

      function openModal(i){
        const f=FILMS[i];
        const castList=Array.isArray(f.cast)?f.cast:[];
        const genreText=Array.isArray(f.genre)?f.genre.slice(0,3).join(', '):(f.genre||'');
        const rt = formatRuntime(f.runtime);
        const metaSub = [f.year, genreText, rt].filter(Boolean).join(' | ');
        const trailerUrl='https://www.youtube.com/results?search_query='+encodeURIComponent((f.originalTitle||f.title)+' official trailer');

        let castHtml = '';
        if(castList.length===0) castHtml='<div style="font-size:12px; color:#94a3b8">No cast listed</div>';
        else {
          castList.slice(0,5).forEach(act=>{
            const initials = act.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
            castHtml += `<div class="cine-cast-item"><div class="cine-actor-avatar">${esc(initials)}</div><span class="cine-actor-name">${esc(act)}</span></div>`;
          });
        }

        document.getElementById('modal').innerHTML=`<div class="modal-cine" onclick="event.stopPropagation()">
          <button class="cine-close" onclick="closeModal()">✕</button>
          
          <div class="cine-title-block">
            <h2 class="cine-title">${esc(f.title)}</h2>
            ${metaSub ? `<p class="cine-subtitle">${esc(metaSub)}</p>` : ''}
          </div>

          <div class="cine-main-row">
            <div class="cine-poster-box">
              <img src="${esc(f.poster)}" alt="${esc(f.title)}" class="cine-poster-img" onerror="this.style.display='none'">
              <div class="cine-poster-fallback">${esc(f.title)}</div>
            </div>

            <div class="cine-info-card">
              <div class="cine-badges-top">
                ${typeof f.rating==='number' ? `<div class="imdb-badge-cine"><span class="imdb-pill">IMDb</span><span>${f.rating.toFixed(1)}</span><span style="font-size:11px">★</span></div>` : ''}
                ${(f.shelf||f.row) ? `<div class="cine-shelf-badge">🗄️ Shelf <strong>${esc(f.shelf||'–')}</strong> / Row <strong>${esc(f.row||'–')}</strong></div>` : ''}
              </div>

              <div class="cine-synopsis-box">
                <div class="cine-section-label">SYNOPSIS</div>
                <p class="cine-synopsis-text">${esc(f.synopsis || (f.title + ' is a ' + (f.year||'') + ' film directed by ' + (f.director||'renowned filmmakers') + '.'))}</p>
              </div>
            </div>
          </div>

          <div class="cine-bottom-row">
            <div class="cine-col">
              <div class="cine-col-title">CAST</div>
              <div class="cine-cast-grid">${castHtml}</div>
            </div>

            <div class="cine-col">
              <div class="cine-col-title">CREW</div>
              <div class="cine-crew-table">
                ${f.director ? `<div class="cine-crew-row"><span class="crew-key">Director</span><span class="crew-val">${esc(f.director)}</span></div>` : ''}
                <div class="cine-crew-row"><span class="crew-key">Writer</span><span class="crew-val">${esc(f.director||'—')}</span></div>
                <div class="cine-crew-row"><span class="crew-key">Country</span><span class="crew-val">${esc(f.country||'USA')}</span></div>
                ${f.runtime ? `<div class="cine-crew-row"><span class="crew-key">Runtime</span><span class="crew-val">${f.runtime} mins</span></div>` : ''}
              </div>
            </div>

            <div class="cine-col">
              <div class="cine-col-title">TRAILER</div>
              <a href="${trailerUrl}" target="_blank" rel="noopener noreferrer" class="cine-trailer-card">
                <div class="cine-trailer-media">
                  <img src="${esc(f.poster)}" alt="Trailer" class="cine-trailer-bg">
                  <div class="cine-play-circle"><span class="play-triangle">▶</span></div>
                  <div class="cine-hd-tag">F HD</div>
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
    </script>
  </body>
</html>
"""

html = TEMPLATE.replace("__DATA__", DATA)
with open("preview.html", "w", encoding="utf-8") as f:
    f.write(html)
print("preview.html written matching exact 7.png layout")
