/* McAleese Strength — single-file app logic. No build step, no dependencies. */
(() => {
  'use strict';

  const $app = document.getElementById('app');
  const $overlay = document.getElementById('timer-overlay');
  const $timerCount = document.getElementById('timer-count');
  const $timerSkip = document.getElementById('timer-skip');

  const LS = {
    last: 'ms_lastProfile',
    history: id => `ms_history_${id}`,
    pointer: id => `ms_pointer_${id}`,
    hotel: id => `ms_hotel_${id}`,
    active: id => `ms_active_${id}`
  };

  const state = {
    profiles: [],
    entry: null,      // profiles.json entry
    program: null,    // loaded program JSON
    hotel: false,
    session: null     // in-progress session
  };

  // ---------- storage helpers ----------
  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };
  const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  const getHistory = () => load(LS.history(state.entry.id), []);
  const getPointer = () => load(LS.pointer(state.entry.id), { w: 0, d: 0 });

  // ---------- misc helpers ----------
  const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const applyHotel = (ex) => {
    if (!state.hotel || !ex.hotel) return ex;
    const merged = { ...ex, ...ex.hotel };
    delete merged.hotel;
    return merged;
  };

  const applyTheme = () => {
    const p = state.program?.profile || {};
    document.body.className =
      `theme-${p.theme || 'dark'}` + (p.largeText ? ' large-text' : '');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = p.theme === 'dark' ? '#0f1115' : '#ffffff';
  };

  const sessionAt = (w, d) => state.program?.weeks?.[w]?.days?.[d] || null;

  const nextPointer = (w, d) => {
    const weeks = state.program.weeks;
    if (d + 1 < weeks[w].days.length) return { w, d: d + 1 };
    if (w + 1 < weeks.length) return { w: w + 1, d: 0 };
    return null; // program complete
  };

  const doneSet = () => {
    const set = new Set();
    for (const h of getHistory()) set.add(`${h.weekIndex}:${h.dayIndex}`);
    return set;
  };

  // ---------- boot ----------
  async function boot() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    try {
      const res = await fetch('programs/profiles.json');
      state.profiles = (await res.json()).profiles || [];
    } catch (e) {
      $app.innerHTML = `<div class="card">Couldn't load <b>programs/profiles.json</b>. Check the file exists and is valid JSON.</div>`;
      return;
    }
    const lastId = load(LS.last, null);
    const entry = state.profiles.find(p => p.id === lastId);
    if (entry) {
      await selectProfile(entry);
    } else {
      viewPicker();
    }
  }

  async function selectProfile(entry) {
    state.entry = entry;
    try {
      const res = await fetch(entry.file);
      state.program = await res.json();
    } catch (e) {
      $app.innerHTML = `<div class="card">Couldn't load <b>${esc(entry.file)}</b>. Check it exists and is valid JSON.</div>
        <button class="btn btn-secondary" onclick="MS.picker()">Back</button>`;
      return;
    }
    save(LS.last, entry.id);
    state.hotel = !!load(LS.hotel(entry.id), false) && !!state.program.settings?.showHotelVariant;
    applyTheme();
    viewHome();
  }

  // ---------- views ----------
  function viewPicker() {
    document.body.className = 'theme-dark';
    state.entry = null;
    state.program = null;
    $app.innerHTML = `
      <h1 class="picker-title">McAleese Strength</h1>
      <p class="picker-sub">Who's training?</p>
      ${state.profiles.map((p, i) => `
        <button class="profile-btn" data-i="${i}">
          <span class="emoji">${esc(p.emoji || '🏋️')}</span>
          <span>${esc(p.name)}</span>
        </button>`).join('')}
    `;
    $app.querySelectorAll('.profile-btn').forEach(btn => {
      btn.addEventListener('click', () => selectProfile(state.profiles[+btn.dataset.i]));
    });
  }

  function viewHome() {
    const prog = state.program;
    const ptr = getPointer();
    const today = sessionAt(ptr.w, ptr.d);
    const week = prog.weeks[ptr.w];
    const active = load(LS.active(state.entry.id), null);
    const showHotel = !!prog.settings?.showHotelVariant;
    const done = doneSet().size;
    const total = prog.weeks.reduce((n, w) => n + w.days.length, 0);

    $app.innerHTML = `
      <div class="topbar">
        <h1>${esc(prog.profile.displayName)}</h1>
        <button id="switch-profile">Switch person</button>
      </div>

      ${active ? `
        <div class="card today-card">
          <div class="today-label">Session in progress</div>
          <div class="today-name">${esc(active.sessionName)}</div>
          <button class="btn btn-primary" id="resume-btn">Continue session</button>
          <button class="btn btn-secondary" id="discard-btn">Discard it</button>
        </div>` : today ? `
        <div class="card today-card">
          <div class="today-label">Today's session</div>
          <div class="today-name">${esc(today.name)}</div>
          <div class="today-meta">${esc(week.label)} · about ${today.estimatedMinutes || '?'} minutes · ${today.exercises.length} exercises</div>
          <button class="btn btn-primary" id="start-btn">Start session</button>
        </div>` : `
        <div class="card today-card">
          <div class="today-label">Program complete</div>
          <div class="today-name">All ${total} sessions done — brilliant work!</div>
          <button class="btn btn-primary" id="restart-btn">Start the program again</button>
        </div>`}

      ${showHotel && !active ? `
        <div class="toggle-row">
          <div><b>Hotel gym mode</b><div class="dim small">Dumbbells, treadmill &amp; bodyweight only</div></div>
          <label class="switch">
            <input type="checkbox" id="hotel-toggle" ${state.hotel ? 'checked' : ''}>
            <span class="track"></span>
          </label>
        </div>` : ''}

      <div class="btn-row">
        <button class="btn btn-secondary" id="program-btn">Program</button>
        <button class="btn btn-secondary" id="history-btn">History</button>
      </div>

      <p class="dim small" style="margin:6px 2px 14px">${done} of ${total} sessions completed</p>

      ${(prog.profile.goals || []).length ? `
        <div class="card"><b>Goals</b>
          <ul class="plain">${prog.profile.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
        </div>` : ''}

      ${(prog.profile.constraints || []).length ? `
        <div class="card"><b>Remember</b>
          <ul class="plain">${prog.profile.constraints.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>` : ''}
    `;

    document.getElementById('switch-profile').addEventListener('click', viewPicker);
    document.getElementById('program-btn').addEventListener('click', viewProgram);
    document.getElementById('history-btn').addEventListener('click', viewHistory);
    document.getElementById('start-btn')?.addEventListener('click', () => startSession(ptr.w, ptr.d));
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      save(LS.pointer(state.entry.id), { w: 0, d: 0 });
      viewHome();
    });
    document.getElementById('resume-btn')?.addEventListener('click', () => {
      state.session = active;
      viewSession();
    });
    document.getElementById('discard-btn')?.addEventListener('click', () => {
      localStorage.removeItem(LS.active(state.entry.id));
      viewHome();
    });
    document.getElementById('hotel-toggle')?.addEventListener('change', (e) => {
      state.hotel = e.target.checked;
      save(LS.hotel(state.entry.id), state.hotel);
    });
  }

  function viewProgram() {
    const prog = state.program;
    const done = doneSet();
    const ptr = getPointer();
    $app.innerHTML = `
      <div class="topbar">
        <button id="back-btn">‹ Back</button>
        <h1>Program</h1>
        <span></span>
      </div>
      ${prog.weeks.map((week, w) => `
        <div class="week-block">
          <div class="week-label">${esc(week.label)}</div>
          ${week.note ? `<p class="dim small" style="margin-bottom:8px">${esc(week.note)}</p>` : ''}
          ${week.days.map((day, d) => `
            <button class="day-row" data-w="${w}" data-d="${d}">
              <span>
                <span>${esc(day.name)}</span><br>
                <span class="meta">~${day.estimatedMinutes || '?'} min · ${day.exercises.length} exercises</span>
              </span>
              <span>${done.has(`${w}:${d}`) ? '<span class="done">✓</span>' : (ptr.w === w && ptr.d === d ? '<span class="dim">next</span>' : '')}</span>
            </button>`).join('')}
        </div>`).join('')}
    `;
    document.getElementById('back-btn').addEventListener('click', viewHome);
    $app.querySelectorAll('.day-row').forEach(btn => {
      btn.addEventListener('click', () => startSession(+btn.dataset.w, +btn.dataset.d));
    });
  }

  // ---------- session flow ----------
  function startSession(w, d) {
    const day = sessionAt(w, d);
    if (!day) return;
    state.session = {
      weekIndex: w,
      dayIndex: d,
      weekLabel: state.program.weeks[w].label,
      sessionName: day.name,
      hotelMode: state.hotel,
      startedAt: new Date().toISOString(),
      exIndex: -1, // -1 = warm-up screen
      sets: day.exercises.map(ex => Array(Math.max(1, ex.sets || 1)).fill(false)),
      loads: day.exercises.map(ex => applyHotel(ex).load || ''),
      finished: false
    };
    persistActive();
    requestWakeLock();
    viewSession();
  }

  function persistActive() {
    if (state.session && !state.session.finished) {
      save(LS.active(state.entry.id), state.session);
    }
  }

  function currentDay() {
    return sessionAt(state.session.weekIndex, state.session.dayIndex);
  }

  function viewSession() {
    const s = state.session;
    const day = currentDay();
    if (!day) { viewHome(); return; }

    if (s.exIndex < 0) return viewWarmup(day);
    if (s.exIndex >= day.exercises.length) return viewCooldown(day);

    const raw = day.exercises[s.exIndex];
    const ex = applyHotel(raw);
    const total = day.exercises.length;
    const nextRaw = day.exercises[s.exIndex + 1];
    const next = nextRaw ? applyHotel(nextRaw) : null;
    const pct = ((s.exIndex + 1) / total) * 100;
    const sets = s.sets[s.exIndex];

    $app.innerHTML = `
      <div class="topbar">
        <button id="quit-btn">‹ Exit</button>
        <span class="dim small">${esc(day.name)}${s.hotelMode ? ' · 🏨 hotel' : ''}</span>
        <span></span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>

      <div class="ex-count">Exercise ${s.exIndex + 1} of ${total}</div>
      <div class="ex-name">${esc(ex.name)}</div>
      <div class="ex-rx">${sets.length} × ${esc(ex.reps || '—')} <span class="load">@ ${esc(ex.load || 'bodyweight')}</span></div>
      ${ex.cue ? `<div class="ex-cue">“${esc(ex.cue)}”</div>` : ''}

      ${ex.stopIf ? `<div class="stop-box"><div class="stop-title">Stop if</div>${esc(ex.stopIf)}</div>` : ''}

      <div class="card">
        <b>Tap each set as you finish it</b>
        <div class="sets-row" style="margin-top:12px">
          ${sets.map((done, i) => `<button class="set-dot ${done ? 'done' : ''}" data-set="${i}">${done ? '✓' : i + 1}</button>`).join('')}
        </div>
        <div class="load-row">
          <label for="load-used">Weight / load used</label>
          <input id="load-used" type="text" value="${esc(s.loads[s.exIndex])}" autocomplete="off">
        </div>
      </div>

      ${ex.alternative ? `
        <details class="alt">
          <summary>Too hard today? Swap it</summary>
          <p>${esc(ex.alternative)}</p>
        </details>` : ''}

      <div class="btn-row">
        ${s.exIndex > 0 ? `<button class="btn btn-secondary" id="prev-btn">‹ Previous</button>` : ''}
        <button class="btn btn-primary" id="next-btn">${s.exIndex + 1 < total ? 'Next exercise ›' : 'Finish exercises ›'}</button>
      </div>

      ${next ? `<div class="next-preview">Up next: <b>${esc(next.name)}</b> — ${nextRaw.sets} × ${esc(next.reps || '')}</div>` : ''}
    `;

    document.getElementById('quit-btn').addEventListener('click', () => {
      persistActive();
      viewHome();
    });
    document.getElementById('prev-btn')?.addEventListener('click', () => { s.exIndex--; persistActive(); viewSession(); });
    document.getElementById('next-btn').addEventListener('click', () => {
      s.loads[s.exIndex] = document.getElementById('load-used').value;
      s.exIndex++;
      persistActive();
      viewSession();
    });
    $app.querySelectorAll('.set-dot').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.set;
        sets[i] = !sets[i];
        s.loads[s.exIndex] = document.getElementById('load-used').value;
        persistActive();
        const rest = ex.restSeconds ?? state.program.settings?.defaultRestSeconds ?? 0;
        const allDone = sets.every(Boolean);
        viewSession();
        if (sets[i] && rest > 0 && !allDone) startTimer(rest);
      });
    });
  }

  function viewWarmup(day) {
    const s = state.session;
    $app.innerHTML = `
      <div class="topbar">
        <button id="quit-btn">‹ Exit</button>
        <span class="dim small">${esc(day.name)}${s.hotelMode ? ' · 🏨 hotel' : ''}</span>
        <span></span>
      </div>
      <h1>Warm-up</h1>
      ${state.program.weeks[s.weekIndex].note ? `<p class="dim" style="margin:8px 0 4px">${esc(state.program.weeks[s.weekIndex].note)}</p>` : ''}
      <div class="card">
        <ul class="plain">${(day.warmup || []).map(w => `<li>${esc(w)}</li>`).join('') || '<li>Ease in for 5 minutes</li>'}</ul>
      </div>
      <button class="btn btn-primary" id="go-btn">Warm-up done — start ›</button>
    `;
    document.getElementById('quit-btn').addEventListener('click', () => { persistActive(); viewHome(); });
    document.getElementById('go-btn').addEventListener('click', () => { s.exIndex = 0; persistActive(); viewSession(); });
  }

  function viewCooldown(day) {
    $app.innerHTML = `
      <div class="topbar"><span></span><span class="dim small">${esc(day.name)}</span><span></span></div>
      <h1>Cool-down</h1>
      <div class="card">
        <ul class="plain">${(day.cooldown || []).map(c => `<li>${esc(c)}</li>`).join('') || '<li>Easy movement for a few minutes</li>'}</ul>
      </div>
      <button class="btn btn-primary" id="rate-btn">Done — rate the session ›</button>
    `;
    document.getElementById('rate-btn').addEventListener('click', viewRating);
  }

  function viewRating() {
    const captions = ['', 'Really tough', 'Hard work', 'About right', 'Good session', 'Felt great'];
    let rating = 0;
    $app.innerHTML = `
      <h1 style="margin-top:24px">How did that feel?</h1>
      <div class="rating-row">
        ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn" data-n="${n}">${n}</button>`).join('')}
      </div>
      <div class="rating-caption" id="cap">Tap a number — 1 is really tough, 5 is felt great</div>
      <textarea class="note" id="note" placeholder="Any notes? (optional — e.g. how the knee felt, weights to change)"></textarea>
      <button class="btn btn-primary" id="save-btn">Save session</button>
    `;
    const cap = document.getElementById('cap');
    $app.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        rating = +btn.dataset.n;
        $app.querySelectorAll('.rating-btn').forEach(b => b.classList.toggle('selected', +b.dataset.n === rating));
        cap.textContent = captions[rating];
      });
    });
    document.getElementById('save-btn').addEventListener('click', () => {
      finishSession(rating, document.getElementById('note').value.trim());
    });
  }

  function finishSession(rating, note) {
    const s = state.session;
    const day = currentDay();
    const hist = getHistory();
    hist.push({
      date: new Date().toISOString(),
      startedAt: s.startedAt,
      weekIndex: s.weekIndex,
      dayIndex: s.dayIndex,
      weekLabel: s.weekLabel,
      sessionName: s.sessionName,
      hotelMode: s.hotelMode,
      rating: rating || null,
      note: note || '',
      exercises: day.exercises.map((ex, i) => ({
        name: applyHotel(ex).name,
        setsCompleted: s.sets[i].filter(Boolean).length,
        setsPlanned: s.sets[i].length,
        loadUsed: s.loads[i]
      }))
    });
    save(LS.history(state.entry.id), hist);

    // Advance "today" if this was the pointed session.
    const ptr = getPointer();
    if (ptr.w === s.weekIndex && ptr.d === s.dayIndex) {
      const np = nextPointer(ptr.w, ptr.d);
      save(LS.pointer(state.entry.id), np || { w: state.program.weeks.length, d: 0 });
    }

    s.finished = true;
    localStorage.removeItem(LS.active(state.entry.id));
    releaseWakeLock();

    $app.innerHTML = `
      <div class="celebrate">
        <div class="big">🎉</div>
        <h1>Session saved</h1>
        <p class="dim" style="margin:8px 0 24px">${esc(s.sessionName)} — nice work.</p>
      </div>
      <button class="btn btn-primary" id="home-btn">Back to home</button>
    `;
    document.getElementById('home-btn').addEventListener('click', viewHome);
  }

  // ---------- history ----------
  function viewHistory() {
    const hist = getHistory().slice().reverse();
    $app.innerHTML = `
      <div class="topbar">
        <button id="back-btn">‹ Back</button>
        <h1>History</h1>
        <span></span>
      </div>
      ${hist.length ? `<button class="btn btn-secondary" id="export-btn">Export history (JSON)</button>` : ''}
      ${hist.length ? hist.map(h => `
        <div class="card hist-item">
          <div class="hist-date">${new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${h.hotelMode ? ' · 🏨 hotel' : ''}</div>
          <div class="hist-name">${esc(h.sessionName)}</div>
          <div class="dim small">${esc(h.weekLabel)}</div>
          ${h.rating ? `<div class="hist-stars">${'★'.repeat(h.rating)}${'☆'.repeat(5 - h.rating)}</div>` : ''}
          ${h.note ? `<p class="small" style="margin-top:6px">${esc(h.note)}</p>` : ''}
        </div>`).join('')
      : `<div class="card dim">No sessions completed yet. The first one is the hardest to start.</div>`}
    `;
    document.getElementById('back-btn').addEventListener('click', viewHome);
    document.getElementById('export-btn')?.addEventListener('click', exportHistory);
  }

  function exportHistory() {
    const payload = {
      profileId: state.entry.id,
      exportedAt: new Date().toISOString(),
      sessions: getHistory()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.entry.id}-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- rest timer ----------
  let timerHandle = null;
  function startTimer(seconds) {
    clearInterval(timerHandle);
    let remaining = seconds;
    $timerCount.textContent = remaining;
    $overlay.classList.remove('hidden');
    const end = Date.now() + seconds * 1000;
    timerHandle = setInterval(() => {
      remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      $timerCount.textContent = remaining;
      if (remaining <= 0) stopTimer(true);
    }, 250);
  }
  function stopTimer(buzz) {
    clearInterval(timerHandle);
    timerHandle = null;
    $overlay.classList.add('hidden');
    if (buzz && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
  $timerSkip.addEventListener('click', () => stopTimer(false));

  // ---------- wake lock (keep screen on mid-session) ----------
  let wakeLock = null;
  async function requestWakeLock() {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) { /* not critical */ }
  }
  function releaseWakeLock() {
    try { wakeLock?.release(); } catch (e) {}
    wakeLock = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.session && !state.session.finished) requestWakeLock();
  });

  // expose a couple of entry points for inline fallbacks
  window.MS = { picker: viewPicker };

  boot();
})();
