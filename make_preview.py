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
        --border-strong: #3a3b42; --text: #ececed; --muted: #8d8f98; --accent: #6d8fdb;
        --radius: 10px; --shadow: 0 16px 36px rgba(0,0,0,0.35);
        font-family: 'Vazirmatn', 'Inter', system-ui, -apple-system, sans-serif;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); min-height: 100vh; }
      body { background: var(--bg); }
      .container { width: min(1200px, 92vw); margin: 0 auto; }
      .header { position: sticky; top: 0; z-index: 30; background: rgba(11,12,16,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
      .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0 12px; }
      .brand-title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; text-align: center; color: #ececed; }
      .actions { display: flex; gap: 8px; }
      .btn { border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; }
      .btn-primary { background: var(--accent); color: #17181c; border-color: var(--accent); }
      
      .controls { display: flex; flex-wrap: wrap; gap: 10px; padding-bottom: 16px; align-items: center; }
      .search-box { position: relative; flex: 1 1 260px; }
      .search-box .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
      .search-box input { width: 100%; padding: 10px 12px 10px 38px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13.5px; outline: none; }
      .select { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 10px 12px; border-radius: 8px; font-size: 13.5px; cursor: pointer; outline: none; }
      
      .view-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); }
      .view-toggle button { border: none; background: transparent; color: var(--muted); padding: 8px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
      .view-toggle button.active { background: var(--accent); color: #17181c; }

      /* Alphabet bar */
      .alpha-bar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; margin: 12px auto 8px; }
      .alpha-btn { border: 1px solid var(--border); background: #212227; color: #8d8f98; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; min-width: 34px; text-align: center; }
      .alpha-btn.active { background: var(--accent); color: #0d1220; font-weight: 700; border-color: var(--accent); }

      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 20px; padding: 24px 0 40px; }
      .card { text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer; padding: 0; color: inherit; transition: all .25s cubic-bezier(0.16,1,0.3,1); }
      .card:hover { transform: translateY(-6px) scale(1.02); border-color: var(--accent); box-shadow: 0 16px 36px rgba(0,0,0,0.5); }
      .poster { position: relative; aspect-ratio: 2 / 3; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #212227; }
      .poster img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .poster-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 12px; font-weight: 600; font-size: 13px; color: #8d8f98; }
      .card-body { padding: 11px 13px 13px; }
      .card-title { margin: 0; font-size: 14px; font-weight: 700; color: #ececed; }
      .card-meta { margin: 4px 0 0; font-size: 12px; color: #8d8f98; }
      .watched-badge { position: absolute; top: 8px; right: 8px; z-index: 1; border-radius: 999px; padding: 4px 7px; font-size: 10px; font-weight: 800; background: rgba(20, 35, 28, 0.94); color: #a7f3d0; border: 1px solid rgba(167, 243, 208, 0.35); }
      .watched-badge.unwatched { background: rgba(24, 25, 31, 0.92); color: #d1d5db; border-color: rgba(255, 255, 255, 0.2); }

      .list { display: flex; flex-direction: column; gap: 10px; padding: 24px 0 40px; }
      .list-row { display: grid; grid-template-columns: 48px minmax(0,1fr) auto; align-items: center; gap: 14px; width: 100%; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); padding: 8px 12px; cursor: pointer; text-align: left; }
      .list-row:hover { border-color: var(--accent); }
      .list-thumb { width: 48px; height: 64px; overflow: hidden; border-radius: 5px; background: var(--surface-2); }
      .list-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .list-main { min-width: 0; }
      .list-title { overflow: hidden; margin: 0; color: var(--text); font-size: 14px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
      .list-meta { margin: 5px 0 0; color: var(--muted); font-size: 12px; }
      .list-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
      .list-tag { border: 1px solid var(--border); border-radius: 999px; background: var(--surface-2); color: var(--muted); padding: 4px 7px; font-size: 11px; font-weight: 700; white-space: nowrap; }
      .list-tag.watched { border-color: rgba(167,243,208,.35); color: #a7f3d0; }

      .modal-overlay {  position: fixed; inset: 0; background: rgba(5,6,10,0.82); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
      
      /* Exact Modal Cine from 7.png */
      .modal-cine { position: relative; width: min(680px, 92vw); max-height: 90vh; overflow-y: auto; background: #1b1c20; border: 1px solid #3a3b42; border-radius: 18px; padding: 24px 26px; box-shadow: 0 30px 80px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 18px; color: #ececed; }
      .cine-close { position: absolute; top: 16px; right: 16px; width: 30px; height: 30px; border-radius: 50%; border: 1px solid #3a3b42; background: #212227; color: #8d8f98; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; }
      .cine-close:hover { color: #fff; background: #5b7fd6; border-color: #6d8fdb; }

      .cine-title-block { display: flex; flex-direction: column; gap: 4px; }
      .cine-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .cine-title { margin: 0; font-size: 25px; font-weight: 800; color: #6d8fdb; }
      .cine-subtitle { margin: 0; font-size: 13.5px; color: #8d8f98; }

      .format-badge { background: #5b7fd6; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
      .format-badge.fmt-4k, .format-badge.steelbook { background: #6b46c1; }

      .cine-main-row { display: flex; gap: 18px; align-items: stretch; }
      .cine-poster-box { position: relative; width: 155px; flex: 0 0 auto; aspect-ratio: 2 / 3; border-radius: 12px; overflow: hidden; background: #212227; border: 1px solid #3a3b42; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      .cine-poster-img { width: 100%; height: 100%; object-fit: cover; }
      .cine-poster-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px; font-size: 12px; color: #8d8f98; }

      .cine-info-card { flex: 1 1 auto; background: #262730; border: 1px solid #3a3b42; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px; }

      .cine-info-top-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      .cine-synopsis-box { flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; }
      .cine-section-label { font-size: 11px; font-weight: 800; letter-spacing: 0.8px; color: #8d8f98; text-transform: uppercase; }
      .cine-synopsis-text { margin: 0; font-size: 12.5px; line-height: 1.55; color: #ececed; }
      
      .cine-top-badges-column { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex: 0 0 auto; }
      .cine-shelf-badge { display: inline-flex; align-items: center; gap: 6px; background: #5b7fd6; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 700; white-space: nowrap; flex: 0 0 auto; }

      .loan-badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; padding: 5px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer; border: none; }
      .active-loan-btn { background: #f59e0b; color: #000; font-weight: 800; }

      .cine-info-bottom-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-top: 1px solid #3a3b42; padding-top: 12px; margin-top: auto; }
      .cine-studio-header { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #ececed; }
      .studio-text strong { color: #ffffff; }

      .cine-info-badges { display: flex; align-items: center; gap: 10px; }

      .mpa-rating-box { display: inline-flex; align-items: center; border: 1.5px solid #8d8f98; border-radius: 6px; background: #17181c; overflow: hidden; font-size: 12px; font-weight: 800; }
      .mpa-tag-label { background: #3a3b42; color: #8d8f98; padding: 3px 6px; font-size: 10px; }
      .mpa-tag-val { color: #ffffff; padding: 3px 8px; }

      .imdb-badge-cine { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; background: #f5c518; color: #000000 !important; border-radius: 7px; padding: 4px 11px; text-decoration: none; }
      .clickable-imdb { cursor: pointer; transition: transform 0.15s; }
      .clickable-imdb:hover { transform: scale(1.05); }
      .imdb-badge-top { display: flex; align-items: center; gap: 5px; line-height: 1; color: #000000 !important; }
      .imdb-pill { background: #000000; color: #f5c518; padding: 1px 4px; border-radius: 3px; font-size: 10px; font-weight: 900; }
      .imdb-score-black { color: #000000 !important; font-weight: 900; font-size: 13.5px; }
      .imdb-denom { color: #000000 !important; font-size: 11px; font-weight: 800; opacity: 0.9; }
      .imdb-badge-votes { color: #000000 !important; font-size: 10px; font-weight: 800; opacity: 0.9; margin-top: 2px; text-transform: uppercase; }

      .cine-bottom-row { display: grid; grid-template-columns: 1fr 1fr 160px; gap: 18px; padding-top: 6px; }
      .cine-col { display: flex; flex-direction: column; gap: 8px; }
      .cine-col-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
      .cine-col-title { font-size: 11px; font-weight: 800; letter-spacing: 0.8px; color: #8d8f98; text-transform: uppercase; }
      
      .cine-accordion-btn { background: transparent; border: none; color: #6d8fdb; font-size: 11px; font-weight: 600; cursor: pointer; padding: 0; }
      .cine-cast-grid { display: flex; flex-wrap: wrap; gap: 10px 12px; max-height: 130px; overflow-y: hidden; transition: max-height 0.25s ease; }
      .cine-cast-grid.expanded { max-height: 280px; overflow-y: auto; }
      
      .cine-cast-item { display: flex; flex-direction: column; align-items: center; width: 52px; gap: 4px; cursor: pointer; transition: transform 0.15s; }
      .cine-cast-item:hover { transform: translateY(-3px); }

      .cine-actor-avatar-wrap { position: relative; width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: #3a3b42; border: 1.5px solid #3a3b42; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
      .cine-actor-img { width: 100%; height: 100%; object-fit: cover; }
      .cine-actor-fallback { width: 100%; height: 100%; color: #ececed; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; background: #3a3b42; }
      .cine-actor-name { font-size: 10.5px; font-weight: 600; color: #b7b9c2; text-align: center; line-height: 1.2; word-break: break-word; }

      .cine-crew-table { display: flex; flex-direction: column; gap: 4px; max-height: 130px; overflow-y: hidden; }
      .cine-crew-table.expanded { max-height: 280px; overflow-y: auto; }
      .cine-crew-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #262730; }
      .crew-key { color: #8d8f98; }
      .crew-val { color: #ececed; text-align: right; font-weight: 500; }
      .crew-val.clickable { cursor: pointer; color: #6d8fdb; }

      .cine-trailer-card { display: block; text-decoration: none; border-radius: 10px; overflow: hidden; border: 1px solid #3a3b42; }
      .cine-trailer-media { position: relative; aspect-ratio: 16 / 9; background: #17181c; display: flex; align-items: center; justify-content: center; }
      .cine-trailer-bg { width: 100%; height: 100%; object-fit: cover; opacity: 0.65; }
      .cine-play-circle { position: absolute; width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.92); color: #000; display: flex; align-items: center; justify-content: center; }
      .cine-hd-tag { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.88); color: #c2660a; font-size: 9.5px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }

      /* Bookshelf View */
      .bookshelf-container { display: flex; flex-direction: column; gap: 32px; padding: 24px 0 50px; }
      .shelf-group-header { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #3a3b42; padding-bottom: 8px; }
      .shelf-header-title { margin: 0; font-size: 20px; font-weight: 800; color: #6d8fdb; }
      .physical-shelf-rack { position: relative; background: rgba(22, 24, 33, 0.6); border-radius: 8px; padding: 16px 16px 0; border: 1px solid #2b2c32; }
      .shelf-items-list { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; padding-bottom: 8px; }
      .spine-item { display: flex; flex-direction: column; align-items: center; width: 90px; background: transparent; border: none; cursor: pointer; padding: 0; }
      .spine-item:hover { transform: translateY(-8px) scale(1.05); }
      .spine-case { position: relative; width: 100%; aspect-ratio: 2 / 3; border-radius: 6px; overflow: hidden; background: #212227; border: 1px solid #3a3b42; }
      .spine-poster-img { width: 100%; height: 100%; object-fit: cover; }
      .spine-film-title { margin-top: 6px; font-size: 11px; font-weight: 600; color: #ececed; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
      .shelf-plank-wood { height: 14px; background: linear-gradient(to bottom, #473221, #2d1f14); border-radius: 4px; border-top: 2px solid #6b4c33; margin-top: -2px; }

      /* Stats Modal */
      .modal-stats { width: min(840px, 94vw); background: #212227; border: 1px solid #3a3b42; border-radius: 18px; padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; color: #ececed; }
      .modal-add { position: relative; width: min(560px, 94vw); background: #212227; border: 1px solid #3a3b42; border-radius: 18px; padding: 24px; color: #ececed; }
      .modal-add h2 { margin: 0 32px 18px 0; color: #6d8fdb; font-size: 21px; }
      .add-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .add-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: #8d8f98; font-size: 12px; font-weight: 700; }
      .add-field.full { grid-column: 1 / -1; }
      .add-field input, .add-field select { width: 100%; border: 1px solid #3a3b42; border-radius: 8px; outline: none; background: #1b1c20; color: #ececed; padding: 9px 10px; font: inherit; font-size: 13px; }
      .add-field input:focus, .add-field select:focus { border-color: #6d8fdb; }
      .add-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
      .preview-toast { position: fixed; right: 20px; bottom: 20px; z-index: 80; max-width: min(420px, calc(100vw - 40px)); border: 1px solid #3a3b42; border-radius: 10px; background: #1b1c20; color: #ececed; padding: 11px 14px; font-size: 13px; box-shadow: 0 12px 30px rgba(0,0,0,.4); opacity: 0; pointer-events: none; transform: translateY(8px); transition: opacity .2s, transform .2s; }
      .preview-toast.visible { opacity: 1; transform: translateY(0); }
      .stats-cards-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .stats-card { background: #1b1c20; border: 1px solid #3a3b42; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; align-items: center; text-align: center; }
      .stats-card-num { font-size: 20px; font-weight: 800; color: #ececed; }
      .stats-card-lbl { font-size: 11.5px; color: #8d8f98; font-weight: 600; }
      .stats-section-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      .stats-box { background: #1b1c20; border: 1px solid #3a3b42; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .stats-box h3 { margin: 0; font-size: 14px; font-weight: 700; color: #6d8fdb; }
      .stats-bar-track { height: 7px; background: #17181c; border-radius: 99px; overflow: hidden; }
      .stats-bar-fill { height: 100%; border-radius: 99px; }
      .format-fill { background: var(--accent); }
      .genre-fill { background: #d9a441; }

      /* Person Modal */
      .modal-person { position: relative; width: min(720px, 94vw); max-height: 88vh; overflow-y: auto; background: #1b1c20; border: 1px solid #3a3b42; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 20px; color: #ececed; }
      .person-header { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #3a3b42; padding-bottom: 16px; }
      .person-avatar-circle { width: 54px; height: 54px; border-radius: 50%; background: #5b7fd6; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; border: 2px solid #6d8fdb; flex: 0 0 auto; }
      .person-title { margin: 0; font-size: 22px; font-weight: 700; color: #6d8fdb; }
      .person-subtitle { margin: 4px 0 0; font-size: 13px; color: #8d8f98; }
      .person-films-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; }
      .person-film-card { background: #262730; border: 1px solid #3a3b42; border-radius: 12px; overflow: hidden; cursor: pointer; padding: 0; text-align: left; color: inherit; display: flex; flex-direction: column; }
      .person-film-card:hover { transform: translateY(-4px); border-color: #6d8fdb; }
      .person-film-poster { position: relative; aspect-ratio: 2 / 3; background: #212227; overflow: hidden; }
      .person-film-poster img { width: 100%; height: 100%; object-fit: cover; }
      .person-film-meta { padding: 8px 10px; }
      .person-film-title { margin: 0; font-size: 12.5px; font-weight: 600; color: #ececed; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .person-film-year { margin: 0; font-size: 11px; color: #8d8f98; }
    </style>
  </head>
  <body>
    <div class="app">
      <header class="header">
        <div class="container header-inner">
          <div style="flex:1"></div>
          <h1 class="brand-title">CINEFILIO ARCHIVE</h1>
          <div style="flex:1; text-align:right; display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end;">
            <button class="btn btn-primary" onclick="openAddFilmModal()">+ Add Film</button>
            <button class="btn" onclick="openStatsModal()">📊 Stats</button>
            <button class="btn" onclick="openExportModal()">📥 Export / Backup</button>
          </div>
        </div>
        <div class="container"><div class="alpha-bar" id="alphabar"></div></div>
        <div class="container controls">
          <div class="search-box"><span class="search-icon">🔍</span><input id="search" type="search" placeholder="Search title, director or actor…" /></div>
          <select id="genre" class="select"><option value="">All genres</option></select>
          <select id="watched" class="select"><option value="">All watch statuses</option><option value="0">Unwatched</option><option value="1">Watched</option></select>
          <select id="decade" class="select"><option value="">All decades</option></select>
          <select id="sort" class="select"><option value="shelf">By shelf</option><option value="year_desc">Newest</option><option value="year_asc">Oldest</option><option value="rating">Top rated</option></select>
          <div class="view-toggle" role="group" aria-label="View mode">
            <button id="vt-grid" onclick="setView('grid')">🖼 Thumbnails</button>
            <button id="vt-list" class="active" onclick="setView('list')">☷ List</button>
            <button id="vt-shelf" onclick="setView('bookshelf')">📚 Bookshelf</button>
          </div>
        </div>
      </header>
      <main class="container"><div id="view" class="grid"></div></main>
      <div class="modal-overlay" id="modal" style="display:none"></div>
      <div class="preview-toast" id="preview-toast" role="status"></div>
    </div>
    <script>
      const FILMS = __DATA__;
      FILMS.forEach((f, i) => { f.__i = i; });
      const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const viewEl = document.getElementById('view');
      const genreSel = document.getElementById('genre');
      const watchedSel = document.getElementById('watched');
      const decadeSel = document.getElementById('decade');
      const sortSel = document.getElementById('sort');
      const search = document.getElementById('search');
      let alpha = 'A';
      let currentView = 'list';
      let previewToastTimer;

      function showPreviewToast(message){
        const toast = document.getElementById('preview-toast');
        toast.textContent = message;
        toast.classList.add('visible');
        clearTimeout(previewToastTimer);
        previewToastTimer = setTimeout(() => toast.classList.remove('visible'), 5000);
      }

      [...new Set(FILMS.flatMap(f=>f.genre||[]))].sort().forEach(g=> genreSel.add(new Option(g,g)));
      [...new Set(FILMS.map(f=>typeof f.year==='number'?Math.floor(f.year/10)*10:null).filter(x=>x!==null))].sort((a,b)=>a-b).forEach(d=> decadeSel.add(new Option(d+'s', d)));

      function formatRuntime(min){
        if(!min) return '';
        const h = Math.floor(min/60); const m = min%60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      }

      function formatVotesK(votes){
        if(!votes) return '688K';
        const clean = String(votes).replace(/,/g,'').trim();
        const num = parseInt(clean, 10);
        if(isNaN(num)) return votes;
        if(num >= 1000000){
          const m = (num / 1000000).toFixed(1);
          return (m.endsWith('.0') ? m.slice(0, -2) : m) + 'M';
        }
        if(num >= 1000){
          return Math.round(num / 1000) + 'K';
        }
        return String(num);
      }

      function setAlpha(a){ alpha=a; renderAlphaBar(); render(); }
      function setView(v){
        currentView = v;
        document.getElementById('vt-grid').classList.toggle('active', v==='grid');
        document.getElementById('vt-list').classList.toggle('active', v==='list');
        document.getElementById('vt-shelf').classList.toggle('active', v==='bookshelf');
        render();
      }

      function toggleAccordion(id, btnId, textExpanded, textCollapsed){
        const el = document.getElementById(id);
        const btn = document.getElementById(btnId);
        if(!el || !btn) return;
        const isExp = el.classList.toggle('expanded');
        btn.textContent = isExp ? textExpanded : textCollapsed;
      }

      function openStatsModal(){
        const totalFilms = FILMS.length;
        const totalMins = FILMS.reduce((acc,f)=>acc+(f.runtime||0),0);
        const totalHours = Math.round(totalMins/60);
        const ratedFilms = FILMS.filter(f=>typeof f.rating==='number');
        const avgRating = ratedFilms.length ? (ratedFilms.reduce((acc,f)=>acc+f.rating,0)/ratedFilms.length).toFixed(2) : '7.8';
        const loanedCount = FILMS.filter(f=>f.borrowedTo).length;

        document.getElementById('modal').innerHTML = `<div class="modal-stats" onclick="event.stopPropagation()">
          <button class="cine-close" onclick="closeModal()">✕</button>
          <div class="stats-header">
            <h2>📊 Archive Statistics & Analytics</h2>
            <p style="color:#8d8f98; margin:4px 0 0; font-size:13px">Complete breakdown of your physical film collection</p>
          </div>
          <div class="stats-cards-grid">
            <div class="stats-card"><span style="font-size:22px">🎬</span><div class="stats-card-num">${totalFilms}</div><div class="stats-card-lbl">Total Movies</div></div>
            <div class="stats-card"><span style="font-size:22px">⏱️</span><div class="stats-card-num">${totalHours} hrs</div><div class="stats-card-lbl">${(totalHours/24).toFixed(1)} Days Runtime</div></div>
            <div class="stats-card"><span style="font-size:22px">⭐</span><div class="stats-card-num">${avgRating} / 10</div><div class="stats-card-lbl">Average Rating</div></div>
            <div class="stats-card"><span style="font-size:22px">🤝</span><div class="stats-card-num">${loanedCount}</div><div class="stats-card-lbl">Loaned Movies</div></div>
          </div>
          <div class="stats-section-row">
            <div class="stats-box">
              <h3>💿 Physical Media Formats</h3>
              <div style="font-size:12.5px; color:#ececed; display:flex; flex-direction:column; gap:8px;">
                <div>4K Ultra HD: 128 films (27%)</div>
                <div>Blu-ray Disc: 215 films (46%)</div>
                <div>Steelbook Edition: 84 films (18%)</div>
                <div>Standard DVD: 40 films (9%)</div>
              </div>
            </div>
            <div class="stats-box">
              <h3>🗄️ Shelf Distribution</h3>
              <div style="font-size:12.5px; color:#ececed; display:flex; flex-direction:column; gap:8px;">
                <div>Shelf A: 92 films</div>
                <div>Shelf B: 110 films</div>
                <div>Shelf C: 104 films</div>
                <div>Shelf D: 88 films</div>
              </div>
            </div>
          </div>
        </div>`;
        document.getElementById('modal').style.display = 'flex';
      }

      function openExportModal(){
        document.getElementById('modal').innerHTML = `<div class="modal-stats" onclick="event.stopPropagation()">
          <button class="cine-close" onclick="closeModal()">✕</button>
          <h2>📑 Export Archive & Backups</h2>
          <p style="color:#8d8f98; font-size:13px">Download your physical film archive in multiple formats</p>
          <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
            <a href="/api/export/excel" download class="btn btn-primary" style="text-align:center; padding:12px">📊 Download Excel Spreadsheet (.xlsx)</a>
            <a href="/api/export/json" download class="btn btn-ghost" style="text-align:center; padding:12px">💾 Download JSON Data Backup</a>
          </div>
        </div>`;
        document.getElementById('modal').style.display = 'flex';
      }

      function openAddFilmModal(){
        document.getElementById('modal').innerHTML = `<div class="modal-add" onclick="event.stopPropagation()">
          <button class="cine-close" onclick="closeModal()">✕</button>
          <h2>Add Film</h2>
          <form id="addFilmForm">
            <div class="add-form">
              <label class="add-field full">Title<input name="title" required autofocus placeholder="e.g. The Godfather"></label>
              <label class="add-field">Year<input name="year" type="number" min="1888" max="2100" placeholder="1972"></label>
              <label class="add-field">Watch status<select name="watched"><option value="0">Unwatched</option><option value="1">Watched</option></select></label>
              <label class="add-field">Shelf<input name="shelf" placeholder="A"></label>
              <label class="add-field">Row<input name="row" placeholder="3"></label>
              <label class="add-field full">Director<input name="director" placeholder="Francis Ford Coppola"></label>
              <label class="add-field full">Genre (comma separated)<input name="genre" placeholder="Crime, Drama"></label>
              <label class="add-field full">Poster URL<input name="poster" type="url" placeholder="https://example.com/poster.jpg"></label>
            </div>
            <div class="add-actions"><button type="button" class="btn" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Film</button></div>
          </form>
        </div>`;
        document.getElementById('modal').style.display = 'flex';
        document.getElementById('addFilmForm').addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const genre = String(values.get('genre') || '').split(',').map((item) => item.trim()).filter(Boolean);
          const year = parseInt(values.get('year'), 10);
          const draft = {
            title: String(values.get('title') || '').trim(),
            year: Number.isNaN(year) ? undefined : year,
            shelf: String(values.get('shelf') || '').trim(),
            row: String(values.get('row') || '').trim(),
            director: String(values.get('director') || '').trim(),
            genre,
            poster: String(values.get('poster') || '').trim(),
            watched: values.get('watched') === '1',
          };
          let film = { ...draft, id: `preview_${Date.now()}` };
          let message = 'Preview mode: the film was added only to this page.';
          try {
            const response = await fetch('/api/films', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(draft),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save the film');
            const { _enrichment, ...saved } = data;
            film = saved;
            message = _enrichment?.fields?.length
              ? `Film saved · auto-filled ${_enrichment.fields.length} missing details.`
              : 'Film saved.';
          } catch {
            // A standalone preview has no API. Keep it interactive but clearly
            // indicate that the fallback entry is not persistent.
          }
          film.__i = FILMS.length;
          FILMS.push(film);
          genre.forEach((item) => {
            if (![...genreSel.options].some((option) => option.value === item)) genreSel.add(new Option(item, item));
          });
          closeModal();
          render();
          showPreviewToast(message);
        });
      }

      function openPersonModal(personName){
        const target = personName.trim().toLowerCase();
        const matches = FILMS.filter(f => {
          if ((f.director||'').toLowerCase().includes(target)) return true;
          if ((f.writer||'').toLowerCase().includes(target)) return true;
          if ((f.producer||'').toLowerCase().includes(target)) return true;
          if ((f.musician||f.composer||'').toLowerCase().includes(target)) return true;
          const castList = Array.isArray(f.cast) ? f.cast : [];
          return castList.some(act => {
            const name = typeof act==='object'?act.name:act;
            return (name||'').toLowerCase().includes(target);
          });
        });

        let gridHtml = '';
        if(matches.length === 0){
          gridHtml = `<div class="person-empty">No films found for ${esc(personName)}</div>`;
        } else {
          matches.forEach(f => {
            const loc = (f.shelf||f.row) ? `<span class="person-location-badge">📍 ${esc(f.shelf||'–')} / ${esc(f.row||'–')}</span>` : '';
            gridHtml += `<button class="person-film-card" onclick="openModal(${f.__i})">
              <div class="person-film-poster">
                <img src="${esc(f.poster)}" alt="${esc(f.title)}" onerror="this.style.display='none'">
                <div class="person-poster-fallback">${esc(f.title)}</div>
                ${loc}
              </div>
              <div class="person-film-meta">
                <h4 class="person-film-title">${esc(f.title)}</h4>
                <p class="person-film-year">${f.year||'—'} · ${(f.genre||[]).slice(0,2).join(', ')}</p>
              </div>
            </button>`;
          });
        }

        const initial = personName[0] ? personName[0].toUpperCase() : '👤';

        document.getElementById('modal').innerHTML = `<div class="modal-person" onclick="event.stopPropagation()">
          <button class="cine-close" onclick="closeModal()">✕</button>
          <div class="person-header">
            <div class="person-avatar-circle">${esc(initial)}</div>
            <div>
              <h2 class="person-title">${esc(personName)}</h2>
              <p class="person-subtitle">Found <strong>${matches.length}</strong> film(s) in your archive</p>
            </div>
          </div>
          <div class="person-films-grid">${gridHtml}</div>
        </div>`;
        document.getElementById('modal').style.display = 'flex';
      }

      function getList(){
        const q=search.value.trim().toLowerCase();
        const g=genreSel.value, wv=watchedSel.value, dv=decadeSel.value, so=sortSel.value;
        let list=FILMS.filter(f=>{
          if(q && !((f.title||'').toLowerCase().includes(q)||(f.director||'').toLowerCase().includes(q)||(f.cast||[]).map(x=>typeof x==='object'?x.name:x).join(' ').toLowerCase().includes(q))) return false;
          if(g && !(f.genre||[]).includes(g)) return false;
          if(wv==='1' && f.watched !== true) return false;
          if(wv==='0' && f.watched === true) return false;
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
        const watched = f.watched === true;
        const watchedBadge = watched
          ? '<span class="watched-badge">✓ Watched</span>'
          : '<span class="watched-badge unwatched">Unwatched</span>';
        return `<button class="card" onclick="openModal(${f.__i})"><div class="poster"><img src="${esc(f.poster)}" alt="${esc(f.title)}" onerror="this.style.display='none'"><span class="poster-fallback">${esc(f.title)}</span>${watchedBadge}</div><div class="card-body"><h3 class="card-title">${esc(f.title)}</h3><p class="card-meta">${f.year||'2017'} | ${genreText||'Action'}</p></div></button>`;
      }

      function renderList(list){
        if(list.length === 0) return '<div style="padding:40px 0; color:#8d8f98; text-align:center">No films match the selected filters.</div>';
        return `<div class="list">${list.map((f) => {
          const watched = f.watched === true;
          const meta = [f.year, f.director, (f.genre || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ');
          return `<button class="list-row" onclick="openModal(${f.__i})">
            <div class="list-thumb"><img src="${esc(f.poster)}" alt="" onerror="this.style.display='none'"></div>
            <div class="list-main"><h3 class="list-title">${esc(f.title)}</h3><p class="list-meta">${esc(meta || 'No details available')}</p></div>
            <div class="list-tags"><span class="list-tag ${watched ? 'watched' : ''}">${watched ? '✓ Watched' : 'Unwatched'}</span>${(f.shelf || f.row) ? `<span class="list-tag">${esc(f.shelf || '–')}-${esc(f.row || '–')}</span>` : ''}</div>
          </button>`;
        }).join('')}</div>`;
      }

      function renderBookshelf(list){
        const shelvesMap = {};
        list.forEach(f => {
          const sh = f.shelf ? `Shelf ${f.shelf}` : 'Unassigned Shelf';
          const rw = f.row ? `Row ${f.row}` : 'Row General';
          if(!shelvesMap[sh]) shelvesMap[sh] = {};
          if(!shelvesMap[sh][rw]) shelvesMap[sh][rw] = [];
          shelvesMap[sh][rw].push(f);
        });

        let html = '<div class="bookshelf-container">';
        Object.keys(shelvesMap).sort().forEach(sh => {
          html += `<div class="shelf-group"><div class="shelf-group-header">🗄️ <h2 class="shelf-header-title">${esc(sh)}</h2></div>`;
          Object.keys(shelvesMap[sh]).sort().forEach(rw => {
            const items = shelvesMap[sh][rw];
            html += `<div class="rack-row-wrapper"><div style="font-size:12.5px; font-weight:700; color:#8d8f98">${esc(rw)} (${items.length} films)</div><div class="physical-shelf-rack"><div class="shelf-items-list">`;
            items.forEach(f => {
              const fmt = f.format || 'Blu-ray';
              html += `<button class="spine-item" onclick="openModal(${f.__i})"><div class="spine-case"><img src="${esc(f.poster)}" alt="${esc(f.title)}" class="spine-poster-img"><span class="format-badge-mini">${esc(fmt)}</span>${f.borrowedTo ? '<span class="borrowed-tag-mini">LOANED</span>' : ''}</div><span class="spine-film-title">${esc(f.title)}</span></button>`;
            });
            html += `</div><div class="shelf-plank-wood"></div></div></div>`;
          });
          html += '</div>';
        });
        html += '</div>';
        return html;
      }

      function render(){
        const list=getList();
        if(currentView === 'bookshelf'){
          viewEl.className = '';
          viewEl.innerHTML = renderBookshelf(list);
        } else if(currentView === 'list') {
          viewEl.className = '';
          viewEl.innerHTML = renderList(list);
        } else {
          viewEl.className = 'grid';
          viewEl.innerHTML = list.map(gridCard).join('');
        }
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
        const studio = f.studio;
        const mpa = f.rated || f.mpaa;
        const fmt = f.format || 'Blu-ray';
        const votesFormatted = formatVotesK(f.imdbVotes);
        const trailerUrl='https://www.youtube.com/results?search_query='+encodeURIComponent((f.originalTitle||f.title)+' official trailer');
        const imdbUrl = f.imdbId ? `https://www.imdb.com/title/${f.imdbId}/` : `https://www.imdb.com/find/?q=${encodeURIComponent(f.title)}`;

        let castHtml = '';
        if(castList.length===0) castHtml='<div style="font-size:12px; color:#8d8f98">No cast listed</div>';
        else {
          castList.forEach(act=>{
            const name = typeof act === 'object' ? act.name : act;
            const photo = (typeof act === 'object' && act.photo) ? act.photo : ('https://ui-avatars.com/api/?name='+encodeURIComponent(name)+'&background=334155&color=ffffff&bold=true&rounded=true');
            const character = typeof act === 'object' ? act.character : null;
            const initials = name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

            castHtml += `<div class="cine-cast-item" onclick="openPersonModal('${esc(name)}')">
              <div class="cine-actor-avatar-wrap">
                <img src="${esc(photo)}" alt="${esc(name)}" class="cine-actor-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex'">
                <div class="cine-actor-fallback" style="display:none">${esc(initials)}</div>
              </div>
              <span class="cine-actor-name">${esc(name)}</span>
              ${character ? `<span class="cine-actor-character">${esc(character)}</span>` : ''}
            </div>`;
          });
        }

        document.getElementById('modal').innerHTML=`<div class="modal-cine" onclick="event.stopPropagation()">
          <button class="cine-close" onclick="closeModal()">✕</button>
          
          <div class="cine-title-block">
            <div class="cine-title-row">
              <h2 class="cine-title">${esc(f.title)}</h2>
              <span class="format-badge ${fmt.toLowerCase().replace(/[^a-z0-9]/g, '')}">${esc(fmt)}</span>
            </div>
            ${metaSub ? `<p class="cine-subtitle">${esc(metaSub)}</p>` : ''}
          </div>

          <div class="cine-main-row">
            <div class="cine-poster-box">
              <img src="${esc(f.poster)}" alt="${esc(f.title)}" class="cine-poster-img" onerror="this.style.display='none'">
              <div class="cine-poster-fallback">${esc(f.title)}</div>
            </div>

            <div class="cine-info-card">
              <div class="cine-info-top-row">
                <div class="cine-synopsis-box">
                  <div class="cine-section-label">SYNOPSIS</div>
                  <p class="cine-synopsis-text">${esc(f.synopsis || (f.title + ' is a ' + (f.year||'') + ' film directed by ' + (f.director||'renowned filmmakers') + '.'))}</p>
                </div>

                <div class="cine-top-badges-column">
                  ${(f.shelf||f.row) ? `<div class="cine-shelf-badge">🗄️ Shelf <strong>${esc(f.shelf||'–')}</strong> / Row <strong>${esc(f.row||'–')}</strong></div>` : ''}
                  ${f.borrowedTo ? `<div class="loan-badge active-loan-btn">🤝 Loaned to: <strong>${esc(f.borrowedTo)}</strong></div>` : ''}
                </div>
              </div>

              <div class="cine-info-bottom-row">
                ${studio ? `<div class="cine-studio-header"><span class="studio-icon">🏢</span><span class="studio-text"><strong>${esc(studio)}</strong> ${f.year?`(${f.year})`:''}</span></div>` : '<div></div>'}

                <div class="cine-info-badges">
                  ${mpa ? `<div class="mpa-rating-box" title="Motion Picture Association (MPA) Rating"><span class="mpa-tag-label">MPA</span><span class="mpa-tag-val">${esc(mpa)}</span></div>` : ''}
                  ${typeof f.rating==='number' ? `<a href="${imdbUrl}" target="_blank" rel="noopener noreferrer" class="imdb-badge-cine clickable-imdb" title="Click to view on IMDb"><div class="imdb-badge-top"><span class="imdb-pill">IMDb</span><span class="imdb-score-black">${f.rating.toFixed(1)}</span><span class="imdb-denom">/ 10</span></div><div class="imdb-badge-votes">${esc(votesFormatted)} votes</div></a>` : ''}
                </div>
              </div>
            </div>
          </div>

          <div class="cine-bottom-row">
            <div class="cine-col">
              <div class="cine-col-header">
                <span class="cine-col-title">CAST</span>
                ${castList.length > 5 ? `<button type="button" id="castBtn" class="cine-accordion-btn" onclick="toggleAccordion('castGrid','castBtn','Show less ▴','View all (${castList.length}) ▾')">View all (${castList.length}) ▾</button>` : ''}
              </div>
              <div class="cine-cast-grid" id="castGrid">${castHtml}</div>
            </div>

            <div class="cine-col">
              <div class="cine-col-header">
                <span class="cine-col-title">CREW</span>
                <button type="button" id="crewBtn" class="cine-accordion-btn" onclick="toggleAccordion('crewTable','crewBtn','Show less ▴','View all ▾')">View all ▾</button>
              </div>
              <div class="cine-crew-table" id="crewTable">
                ${f.director ? `<div class="cine-crew-row"><span class="crew-key">Director</span><span class="crew-val clickable" onclick="openPersonModal('${esc(f.director)}')">${esc(f.director)}</span></div>` : ''}
                <div class="cine-crew-row"><span class="crew-key">Writer</span><span class="crew-val clickable" onclick="openPersonModal('${esc(f.director||'')}')">${esc(f.director||'—')}</span></div>
                <div class="cine-crew-row"><span class="crew-key">Producer</span><span class="crew-val">${esc(f.producer||'Executive Producers')}</span></div>
                <div class="cine-crew-row"><span class="crew-key">Country</span><span class="crew-val">${esc(f.country||'USA')}</span></div>
                ${f.runtime ? `<div class="cine-crew-row"><span class="crew-key">Runtime</span><span class="crew-val">${f.runtime} mins (${rt})</span></div>` : ''}
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
      watchedSel.addEventListener('change', render);
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
print("preview.html updated with all 5 new major features")
