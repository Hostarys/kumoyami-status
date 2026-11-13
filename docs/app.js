/* status.kumoyami.com. Reads what Upptime commits to Hostarys/kumoyami-status (history/summary.json and
   history/<slug>.yml, from raw.githubusercontent.com) and the incidents (issues labelled «status» or «maintenance»,
   from the public GitHub API), and draws them in the KumoYami look. No build step, no tracking, no cookies: the only
   thing kept in the browser is the chosen language (localStorage). */
(() => {
  'use strict';

  const OWNER = 'Hostarys';
  const REPO = 'kumoyami-status';
  const BRANCH = 'master';
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/`;
  const DAYS = 90;
  const DAY_MS = 864e5;
  // Minutes down in a day from which the day is red (below it, amber)
  const MAJOR_MINUTES = 30;
  const STATUS_EVERY = 5 * 60e3;
  const API_EVERY = 10 * 60e3;
  const CLOSED_SHOWN = 10;
  const LANG_KEY = 'ky-status-lang';

  const params = new URLSearchParams(location.search);
  // ?demo=incident or ?demo=outage feeds made-up data, to look at the page with problems. Only on a local preview:
  // on status.kumoyami.com the parameter is ignored.
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const DEMO = LOCAL ? params.get('demo') : null;

  /* ---------------------------------------------------------------------------------------------------------------
     Components: the Upptime sites (by slug) in the groups people think in
     ------------------------------------------------------------------------------------------------------------- */
  const GROUPS = [
    {
      id: 'web',
      slugs: ['web'],
      match: /^web\b/i,
      es: { name: 'Web', desc: 'kumoyami.com' },
      en: { name: 'Website', desc: 'kumoyami.com' },
    },
    {
      id: 'accounts',
      slugs: ['cuentas-e-inicio-de-sesion', 'entrar-con-kumo-yami'],
      match: /cuenta|entrar|sesi[oó]n/i,
      es: { name: 'Cuentas', desc: 'Mi cuenta y Entrar con KumoYami' },
      en: { name: 'Accounts', desc: 'My account and Sign in with KumoYami' },
    },
    {
      id: 'licenses',
      slugs: [
        'activacion-de-licencias',
        'renovacion-de-licencias',
        'codigo-de-servidor',
        'codigo-de-servidor-api',
      ],
      match: /licenc|c[oó]digo/i,
      es: { name: 'Licencias', desc: 'Activar y renovar licencias, y el código de servidor' },
      en: { name: 'Licenses', desc: 'Activating and renewing licenses, and server codes' },
    },
    {
      id: 'payments',
      slugs: ['pagos'],
      match: /pago|compra/i,
      es: { name: 'Pagos', desc: 'Comprar o renovar un plan' },
      en: { name: 'Payments', desc: 'Buying or renewing a plan' },
    },
    {
      id: 'downloads',
      slugs: ['descargas-imagen-docker', 'descargas-paquetes-nas'],
      match: /descarga/i,
      es: { name: 'Descargas', desc: 'La imagen Docker y los paquetes para NAS' },
      en: { name: 'Downloads', desc: 'The Docker image and the NAS packages' },
    },
  ];
  const OTHER = { id: 'other', slugs: [], es: { name: 'Otros servicios', desc: '' }, en: { name: 'Other services', desc: '' } };

  const NAMES = {
    web: { es: 'Sitio web', en: 'Website' },
    'cuentas-e-inicio-de-sesion': { es: 'Mi cuenta e inicio de sesión', en: 'My account and sign-in' },
    'entrar-con-kumo-yami': { es: 'Entrar con KumoYami', en: 'Sign in with KumoYami' },
    'activacion-de-licencias': { es: 'Activación de licencias', en: 'License activation' },
    'renovacion-de-licencias': { es: 'Renovación de licencias', en: 'License renewal' },
    'codigo-de-servidor': { es: 'Código de servidor (página)', en: 'Server code (page)' },
    'codigo-de-servidor-api': { es: 'Código de servidor (búsqueda)', en: 'Server code (lookup)' },
    pagos: { es: 'Compra de planes', en: 'Plan checkout' },
    'descargas-imagen-docker': { es: 'Imagen Docker', en: 'Docker image' },
    'descargas-paquetes-nas': { es: 'Paquetes para NAS', en: 'NAS packages' },
  };

  /* ---------------------------------------------------------------------------------------------------------------
     Texts
     ------------------------------------------------------------------------------------------------------------- */
  const T = {
    es: {
      title: 'Estado de KumoYami',
      description:
        'Si la web, las cuentas, las licencias, los pagos y las descargas de KumoYami funcionan ahora mismo, y las incidencias recientes.',
      skip: 'Saltar al contenido',
      brandLabel: 'KumoYami: estado del servicio',
      navStatus: 'Estado',
      navLabel: 'Enlaces',
      langToggle: 'EN',
      langToggleLabel: 'Read in English',
      homeHref: 'https://kumoyami.com/',
      docsHref: 'https://kumoyami.com/docs',
      accountHref: 'https://kumoyami.com/account',
      eyebrow: 'Estado del servicio',
      loading: 'Comprobando…',
      checkedEvery: 'Comprobado cada 5 minutos desde fuera de nuestros servidores',
      servicesTitle: 'Servicios',
      legendLabel: 'Leyenda de las barras',
      legendOk: 'Sin incidencias',
      legendMinor: 'Breve',
      legendMajor: 'Caída',
      legendNone: 'Sin datos',
      legendPct: 'Disponibilidad en 90 días',
      axisStart90: 'Hace 90 días',
      axisStart60: 'Hace 60 días',
      axisStart30: 'Hace 30 días',
      axisToday: 'Hoy',
      note:
        'Tu servidor sigue funcionando hasta 30 días aunque kumoyami.com no responda: solo necesita conectarse para renovar su licencia. Tu propio servidor no aparece aquí.',
      incidentsTitle: 'Incidencias recientes',
      incidentsLoading: 'Cargando las incidencias…',
      tagline: 'Nube y oscuridad. Tus archivos, en tu servidor.',
      footDocs: 'Documentación',
      footAccount: 'Mi cuenta',
      footNavLabel: 'KumoYami',
      langLabel: 'Idioma',

      allOk: 'Todo funciona.',
      someIssues: 'Algunos servicios tienen problemas.',
      maintenanceNow: (t) => `Mantenimiento en curso: ${t}`,
      affects: (list) => `Afecta a ${list}`,
      working: 'Lo estamos arreglando.',
      loadFail: 'No se pudo cargar el estado.',
      loadFailOffline: 'Sin conexión. Lo intentaremos de nuevo cuando vuelvas a estar en línea.',
      loadFailLater: 'Vuelve a intentarlo en unos minutos.',
      retry: 'Reintentar',
      lastCheck: (rel) => `Última comprobación ${rel}`,
      state: { up: 'Funciona', degraded: 'Lento', down: 'Sin servicio', unknown: 'Sin datos' },
      uptimeTitle: '90 días',
      uptimeSince: (d) => `desde el ${d}`,
      uptimeAria: (pct, since) => `Disponibilidad: ${pct}${since ? `, ${since}` : ' en 90 días'}`,
      parts: (n) => `${n} servicios`,
      daysOk: (n) => `Últimos ${n} días: sin incidencias`,
      daysBad: (n, bad, total) => `Últimos ${n} días: ${bad} ${bad === 1 ? 'día' : 'días'} con problemas, ${total} en total`,
      daysNoData: (d) => `; sin datos antes del ${d}`,
      dayOk: 'Sin incidencias',
      dayDown: (d) => `${d} con problemas`,
      dayNone: 'Sin datos',
      today: 'hoy',
      open: 'En curso',
      closed: 'Resuelto',
      noIncidents: 'Sin incidencias registradas.',
      incidentsFail: 'No se pudieron cargar las incidencias.',
      lasted: (d) => `duró ${d}`,
      ongoingFor: (d) => `desde hace ${d}`,
      autoTitleDown: (n) => `${n}: sin servicio`,
      autoTitleSlow: (n) => `${n}: responde lento`,
      autoBodyDown: (n, open) =>
        open ? `${n} no responde a nuestras comprobaciones.` : `${n} no respondía a nuestras comprobaciones.`,
      autoBodySlow: (n, open) => (open ? `${n} responde más lento de lo normal.` : `${n} respondía más lento de lo normal.`),
      showUpdates: 'Ver actualizaciones',
      updatesFail: 'No se pudieron cargar las actualizaciones.',
      noUpdates: 'Sin actualizaciones.',
      maintenance: 'Mantenimiento programado',
      maintenanceOngoing: 'Mantenimiento en curso',
      list: (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`),
    },
    en: {
      title: 'KumoYami status',
      description:
        'Whether the KumoYami website, accounts, licenses, payments and downloads are working right now, and recent incidents.',
      skip: 'Skip to content',
      brandLabel: 'KumoYami: service status',
      navStatus: 'Status',
      navLabel: 'Links',
      langToggle: 'ES',
      langToggleLabel: 'Leer en español',
      homeHref: 'https://kumoyami.com/en',
      docsHref: 'https://kumoyami.com/en/docs',
      accountHref: 'https://kumoyami.com/en/account',
      eyebrow: 'Service status',
      loading: 'Checking…',
      checkedEvery: 'Checked every 5 minutes from outside our servers',
      servicesTitle: 'Services',
      legendLabel: 'Bar legend',
      legendOk: 'No incidents',
      legendMinor: 'Brief',
      legendMajor: 'Outage',
      legendNone: 'No data',
      legendPct: 'Uptime over 90 days',
      axisStart90: '90 days ago',
      axisStart60: '60 days ago',
      axisStart30: '30 days ago',
      axisToday: 'Today',
      note:
        "Your server keeps working for up to 30 days even if kumoyami.com doesn't answer: it only needs to connect to renew its license. Your own server isn't shown here.",
      incidentsTitle: 'Recent incidents',
      incidentsLoading: 'Loading incidents…',
      tagline: 'Cloud and darkness. Your files, on your server.',
      footDocs: 'Documentation',
      footAccount: 'My account',
      footNavLabel: 'KumoYami',
      langLabel: 'Language',

      allOk: 'All systems operational.',
      someIssues: 'Some services are having problems.',
      maintenanceNow: (t) => `Maintenance in progress: ${t}`,
      affects: (list) => `Affects ${list}`,
      working: "We're fixing it.",
      loadFail: "Couldn't load the status.",
      loadFailOffline: "You're offline. We'll try again when you're back online.",
      loadFailLater: 'Try again in a few minutes.',
      retry: 'Try again',
      lastCheck: (rel) => `Last check ${rel}`,
      state: { up: 'Operational', degraded: 'Slow', down: 'Down', unknown: 'No data' },
      uptimeTitle: '90 days',
      uptimeSince: (d) => `since ${d}`,
      uptimeAria: (pct, since) => `Uptime: ${pct}${since ? `, ${since}` : ' over 90 days'}`,
      parts: (n) => `${n} services`,
      daysOk: (n) => `Last ${n} days: no incidents`,
      daysBad: (n, bad, total) => `Last ${n} days: ${bad} ${bad === 1 ? 'day' : 'days'} with problems, ${total} in total`,
      daysNoData: (d) => `; no data before ${d}`,
      dayOk: 'No incidents',
      dayDown: (d) => `${d} with problems`,
      dayNone: 'No data',
      today: 'today',
      open: 'Ongoing',
      closed: 'Resolved',
      noIncidents: 'No incidents recorded.',
      incidentsFail: "Couldn't load the incidents.",
      lasted: (d) => `lasted ${d}`,
      ongoingFor: (d) => `for ${d}`,
      autoTitleDown: (n) => `${n} is down`,
      autoTitleSlow: (n) => `${n} is slow`,
      autoBodyDown: (n, open) => (open ? `${n} is not answering our checks.` : `${n} was not answering our checks.`),
      autoBodySlow: (n, open) => (open ? `${n} is answering slower than usual.` : `${n} was answering slower than usual.`),
      showUpdates: 'Show updates',
      updatesFail: "Couldn't load the updates.",
      noUpdates: 'No updates.',
      maintenance: 'Scheduled maintenance',
      maintenanceOngoing: 'Maintenance in progress',
      list: (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`),
    },
  };

  /* ---------------------------------------------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------------------------------------------- */
  const S = {
    lang: 'es',
    summary: null, // array from history/summary.json
    starts: {}, // slug -> Date (startTime of history/<slug>.yml)
    statusError: false,
    statusAt: 0,
    issues: null, // normalised incidents and maintenance
    issuesError: false,
    apiAt: 0,
    lastRun: null, // Date of the last finished check
    comments: {}, // issue number -> 'loading' | 'error' | array
    expanded: new Set(), // group ids open
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const t = () => T[S.lang];
  const locale = () => (S.lang === 'es' ? 'es-ES' : 'en-GB');

  function readLang() {
    const q = params.get('lang');
    if (q === 'es' || q === 'en') return q;
    try {
      const s = localStorage.getItem(LANG_KEY);
      if (s === 'es' || s === 'en') return s;
    } catch (e) {
      /* storage off: Spanish */
    }
    return 'es';
  }

  /* ---------------------------------------------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------------------------------------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs)
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // only ever with md() output, which escapes everything
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
  const dayKeyToDate = (k) => new Date(`${k}T00:00:00Z`);

  function fmtDay(k) {
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      dayKeyToDate(k),
    );
  }
  function fmtDayShort(d) {
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(d);
  }
  function fmtWhen(d) {
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat(locale(), {
      day: 'numeric',
      month: 'short',
      year: sameYear ? undefined : 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  function fmtTime(d) {
    return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(d);
  }
  function rel(d) {
    const s = Math.round((d.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'long' });
    const a = Math.abs(s);
    if (a < 60) return S.lang === 'es' ? 'hace un momento' : 'just now';
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    return rtf.format(Math.round(s / 86400), 'day');
  }
  function dur(minutes) {
    const m = Math.max(0, Math.round(minutes));
    if (m < 1) return '<1 min';
    if (m < 60) return `${m} min`;
    if (m < 1440) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      return mm ? `${hh} h ${mm} min` : `${hh} h`;
    }
    const dd = Math.floor(m / 1440);
    const hh = Math.floor((m % 1440) / 60);
    return hh ? `${dd} d ${hh} h` : `${dd} d`;
  }
  function fmtPct(p) {
    if (p == null) return '—';
    const v = Math.floor(p * 100) / 100;
    return new Intl.NumberFormat(locale(), {
      style: 'percent',
      minimumFractionDigits: v >= 100 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(v / 100);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  // Minimal, safe Markdown: everything is escaped first; then paragraphs, «- » lists, **bold**, `code`, [links](https://…)
  // and bare https:// addresses. HTML in the text shows as text; HTML comments (Upptime's metadata) are dropped.
  function inline(s) {
    return escapeHtml(s).replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)»”'"])|`([^`\n]+)`|\*\*([^*\n]+)\*\*/g,
      (all, label, href, bare, code, bold) => {
        if (href) return `<a href="${href}" rel="noopener noreferrer nofollow">${label}</a>`;
        if (bare) return `<a href="${bare}" rel="noopener noreferrer nofollow">${bare}</a>`;
        if (code) return `<code>${code}</code>`;
        return `<strong>${bold}</strong>`;
      },
    );
  }
  function md(text) {
    const clean = String(text || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\r\n?/g, '\n')
      .trim();
    if (!clean) return '';
    return clean
      .split(/\n{2,}/)
      .map((block) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (!lines.length) return '';
        if (lines.every((l) => /^\s*[-*+]\s+/.test(l)))
          return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*+]\s+/, ''))}</li>`).join('')}</ul>`;
        return `<p>${lines.map((l) => inline(l.replace(/^#{1,6}\s+/, ''))).join('<br>')}</p>`;
      })
      .join('');
  }

  async function getJSON(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { cache: opts.fresh ? 'no-store' : 'default', signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return opts.text ? await res.text() : await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
  const bust = () => `?t=${Math.floor(Date.now() / 60000)}`;

  /* ---------------------------------------------------------------------------------------------------------------
     Data
     ------------------------------------------------------------------------------------------------------------- */
  async function loadStatus() {
    try {
      const summary = await getJSON(`${RAW}history/summary.json${bust()}`, { fresh: true });
      if (!Array.isArray(summary)) throw new Error('summary');
      const ymls = await Promise.allSettled(
        summary.map((s) => getJSON(`${RAW}history/${s.slug}.yml${bust()}`, { fresh: true, text: true })),
      );
      const starts = {};
      ymls.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const m = /^startTime:\s*(\S+)/m.exec(r.value);
        const d = m && new Date(m[1]);
        if (d && !isNaN(d)) starts[summary[i].slug] = d;
      });
      S.summary = summary;
      S.starts = starts;
      S.statusError = false;
      if (DEMO) demoStatus();
    } catch (e) {
      S.statusError = true;
      if (DEMO && !S.summary) {
        S.summary = Object.keys(NAMES).map((slug) => ({ slug, name: NAMES[slug].es, status: 'up', dailyMinutesDown: {} }));
        S.statusError = false;
        demoStatus();
      }
    }
    S.statusAt = Date.now();
    render();
  }

  function normIssue(i) {
    const names = (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
    const body = i.body || '';
    const meta = (k) => {
      const m = new RegExp(`<!--\\s*${k}:\\s*([^>]*?)\\s*-->`, 'i').exec(body);
      return m ? m[1] : null;
    };
    const start = meta('start');
    const end = meta('end');
    return {
      num: i.number,
      kind: names.includes('maintenance') ? 'maintenance' : 'incident',
      labels: names,
      rawTitle: i.title || '',
      open: i.state === 'open',
      created: new Date(i.created_at),
      closed: i.closed_at ? new Date(i.closed_at) : null,
      body,
      comments: i.comments || 0,
      commentsUrl: i.comments_url,
      auto: /^In \[`[0-9a-f]{7}`\]\(/.test(body.trim()),
      start: start ? new Date(start) : null,
      end: end ? new Date(end) : null,
    };
  }

  async function loadIncidents() {
    try {
      let list;
      if (DEMO) list = demoIssues();
      else list = await getJSON(`${API}issues?state=all&per_page=60`);
      if (!Array.isArray(list)) throw new Error('issues');
      S.issues = list
        .filter((i) => !i.pull_request)
        .filter((i) => (i.labels || []).some((l) => ['status', 'maintenance'].includes(typeof l === 'string' ? l : l.name)))
        .map(normIssue);
      S.issuesError = false;
      // Updates written on an ongoing incident show without a click
      S.issues
        .filter((i) => i.kind === 'incident' && i.open && i.comments > 0)
        .slice(0, 3)
        .forEach((i) => loadComments(i));
    } catch (e) {
      S.issuesError = true;
    }
    try {
      if (DEMO) S.lastRun = new Date(Date.now() - 4 * 60e3);
      else {
        const runs = await getJSON(`${API}actions/workflows/uptime.yml/runs?per_page=1&status=completed`);
        const r = runs && runs.workflow_runs && runs.workflow_runs[0];
        S.lastRun = r ? new Date(r.updated_at) : null;
      }
    } catch (e) {
      /* without the time of the last check the line just says how often we check */
    }
    S.apiAt = Date.now();
    render();
  }

  async function loadComments(inc, focus) {
    if (Array.isArray(S.comments[inc.num]) || S.comments[inc.num] === 'loading') return;
    S.comments[inc.num] = 'loading';
    render();
    try {
      const list = DEMO ? demoComments(inc.num) : await getJSON(`${inc.commentsUrl}?per_page=50`);
      S.comments[inc.num] = list
        .filter((c) => !/^\s*\*\*Resolved:\*\*/.test(c.body || ''))
        .map((c) => ({ at: new Date(c.created_at), body: c.body || '' }));
    } catch (e) {
      S.comments[inc.num] = 'error';
    }
    render();
    // The button that asked for them is gone: keyboard focus goes to what replaced it
    if (focus) {
      const el = document.getElementById(`upd-${inc.num}`);
      if (el) el.focus();
    }
  }

  /* ---------------------------------------------------------------------------------------------------------------
     Models
     ------------------------------------------------------------------------------------------------------------- */
  function dayKeys() {
    const now = new Date();
    const keys = [];
    for (let i = DAYS - 1; i >= 0; i--)
      keys.push(isoDay(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)));
    return keys;
  }
  const level = (m) => (m <= 0 ? 'ok' : m < MAJOR_MINUTES ? 'minor' : 'major');
  const RANK = { up: 0, unknown: 0, degraded: 1, down: 2 };
  const LRANK = { none: -1, ok: 0, minor: 1, major: 2 };

  function siteName(slug, fallback) {
    return (NAMES[slug] && NAMES[slug][S.lang]) || fallback || slug;
  }

  function siteModel(site, keys) {
    const now = Date.now();
    const start = S.starts[site.slug] || null;
    const startKey = start ? isoDay(start) : null;
    const todayKey = keys[keys.length - 1];
    const dmd = site.dailyMinutesDown || {};
    const status = ['up', 'down', 'degraded'].includes(site.status) ? site.status : 'unknown';
    const days = keys.map((k) => {
      if (startKey && k < startKey) return { k, m: 0, l: 'none' };
      let m = Number(dmd[k]) || 0;
      let l = level(m);
      // The minutes of today are counted only when the summary is rebuilt: while a component is down, today is red;
      // while it is slow, at least amber
      if (k === todayKey && status === 'down') l = 'major';
      if (k === todayKey && status === 'degraded' && l === 'ok') l = 'minor';
      return { k, m, l };
    });
    const windowStart = now - DAYS * DAY_MS;
    const from = start ? Math.max(windowStart, start.getTime()) : windowStart;
    const tracked = (now - from) / 60000;
    const fromKey = isoDay(from);
    const down = days.filter((d) => d.k >= fromKey).reduce((a, d) => a + d.m, 0);
    const pct = tracked > 0 ? Math.max(0, Math.min(100, 100 - (down / tracked) * 100)) : 100;
    return {
      slug: site.slug,
      name: siteName(site.slug, site.name),
      status,
      days,
      pct,
      since: start && start.getTime() > windowStart ? start : null,
    };
  }

  function groupsModel() {
    const keys = dayKeys();
    const sites = S.summary.map((s) => siteModel(s, keys));
    const taken = new Set();
    const groups = [];
    const place = (g, members) => {
      if (!members.length) return;
      members.forEach((m) => taken.add(m.slug));
      groups.push({ g, members });
    };
    for (const g of GROUPS) {
      const bySlug = g.slugs.map((s) => sites.find((x) => x.slug === s)).filter(Boolean);
      place(g, bySlug);
    }
    // Sites added later to .upptimerc.yml land in the group their name suggests, or in «Other services»
    const rest = sites.filter((s) => !taken.has(s.slug));
    const other = [];
    for (const s of rest) {
      const g = GROUPS.find((x) => x.match && x.match.test(s.name));
      const entry = g && groups.find((e) => e.g === g);
      if (entry) entry.members.push(s);
      else other.push(s);
    }
    if (other.length) groups.push({ g: OTHER, members: other });

    return groups.map(({ g, members }) => {
      const status = members.reduce((a, m) => (RANK[m.status] > RANK[a] ? m.status : a), members.every((m) => m.status === 'unknown') ? 'unknown' : 'up');
      const days = keys.map((k, i) => {
        let best = { k, m: 0, l: 'none' };
        for (const mem of members) {
          const d = mem.days[i];
          if (LRANK[d.l] > LRANK[best.l]) best = { k, m: Math.max(best.m, d.m), l: d.l };
          else best.m = Math.max(best.m, d.m);
        }
        return best;
      });
      const pcts = members.map((m) => m.pct).filter((p) => p != null);
      const sinces = members.map((m) => m.since).filter(Boolean);
      return {
        id: g.id,
        name: g[S.lang].name,
        desc: g[S.lang].desc,
        status,
        days,
        pct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
        since: sinces.length ? new Date(Math.min(...sinces.map(Number))) : null,
        members,
      };
    });
  }

  function groupOfSlug(slug) {
    const g = GROUPS.find((x) => x.slugs.includes(slug));
    return g ? g[S.lang].name : null;
  }

  // The title people read: Upptime's English automatic titles («🛑 Pagos is down») become ours; a title written by
  // hand keeps its words, without the leading emoji
  function incidentTitle(inc) {
    const auto = /^\W*\s*(.+?) (is down|has degraded performance)\s*$/u.exec(inc.rawTitle);
    if (auto) {
      const slug = inc.labels.find((l) => NAMES[l]);
      const name = slug ? siteName(slug) : auto[1];
      return auto[2] === 'is down' ? t().autoTitleDown(name) : t().autoTitleSlow(name);
    }
    return inc.rawTitle.replace(/^[^\p{L}\p{N}«"¿¡(]+/u, '').trim() || inc.rawTitle;
  }
  // Red when Upptime's title says «is down» or a component it is about is down right now; amber otherwise
  function incidentIsDown(inc) {
    if (/is down\s*$/.test(inc.rawTitle)) return true;
    return inc.open && !!S.summary && S.summary.some((s) => s.status === 'down' && inc.labels.includes(s.slug));
  }
  function incidentBody(inc) {
    if (inc.auto) {
      const slug = inc.labels.find((l) => NAMES[l]);
      const name = slug ? siteName(slug) : incidentTitle(inc);
      return md(incidentIsDown(inc) ? t().autoBodyDown(name, inc.open) : t().autoBodySlow(name, inc.open));
    }
    return md(inc.body);
  }
  function incidentAffects(inc) {
    const names = [];
    for (const l of inc.labels) {
      const n = groupOfSlug(l);
      if (n && !names.includes(n)) names.push(n);
    }
    return names;
  }

  /* ---------------------------------------------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------------------------------------------- */
  function applyStatic() {
    const tx = t();
    document.documentElement.lang = S.lang;
    document.title = tx.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', tx.description);
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = tx[el.dataset.i18n];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const v = tx[el.dataset.i18nAria];
      if (typeof v === 'string') el.setAttribute('aria-label', v);
    });
    document.querySelectorAll('[data-i18n-href]').forEach((el) => {
      const v = tx[el.dataset.i18nHref];
      if (typeof v === 'string') el.setAttribute('href', v);
    });
    document.querySelectorAll('.lang-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
    $('#year').textContent = String(new Date().getFullYear());
  }

  function setLang(lang, remember) {
    if (lang !== 'es' && lang !== 'en') return;
    S.lang = lang;
    if (remember) {
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch (e) {
        /* nothing to keep it in */
      }
      if (params.has('lang')) {
        params.set('lang', lang);
        history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`);
      }
    }
    applyStatic();
    render();
  }

  function render() {
    renderOverall();
    renderGroups();
    renderMaintenance();
    renderIncidents();
    renderLastCheck();
    updateAxis();
  }

  function renderOverall() {
    const tx = t();
    const box = $('#overall');
    const title = $('#overall-title');
    const sub = $('#overall-sub');
    if (!S.summary) {
      if (S.statusError) {
        box.dataset.state = 'unknown';
        title.textContent = tx.loadFail;
        sub.textContent = navigator.onLine === false ? tx.loadFailOffline : tx.loadFailLater;
      } else {
        box.dataset.state = 'loading';
        title.textContent = tx.loading;
        sub.textContent = '';
      }
      return;
    }
    const sites = S.summary;
    const down = sites.filter((s) => s.status === 'down');
    const slow = sites.filter((s) => s.status === 'degraded');
    const open = (S.issues || []).filter((i) => i.kind === 'incident' && i.open);
    const now = Date.now();
    const maintNow = (S.issues || []).find(
      (i) => i.kind === 'maintenance' && i.open && i.start && i.end && i.start <= now && now <= i.end,
    );

    if (down.length || slow.length || open.length) {
      box.dataset.state = down.length || open.some(incidentIsDown) ? 'major' : 'minor';
      title.textContent = open.length === 1 ? incidentTitle(open[0]) : tx.someIssues;
      const affected = [];
      const add = (n) => n && !affected.includes(n) && affected.push(n);
      [...down, ...slow].forEach((s) => add(groupOfSlug(s.slug) || siteName(s.slug, s.name)));
      open.forEach((i) => incidentAffects(i).forEach(add));
      const parts = [];
      if (affected.length) parts.push(tx.affects(tx.list(affected)));
      if (open.length) {
        const first = Math.min(...open.map((i) => i.created.getTime()));
        parts.push(tx.ongoingFor(dur((now - first) / 60000)));
      }
      sub.textContent = parts.length ? `${parts.join(' · ')}. ${tx.working}` : tx.working;
    } else if (maintNow) {
      box.dataset.state = 'minor';
      title.textContent = tx.maintenanceNow(incidentTitle(maintNow));
      sub.textContent = '';
    } else {
      box.dataset.state = 'ok';
      title.textContent = tx.allOk;
      sub.textContent = '';
    }
  }

  function stateEl(status) {
    return h('span', { class: 'state', 'data-s': status, text: t().state[status] });
  }

  function uptimeEl(m) {
    const tx = t();
    const since = m.since ? tx.uptimeSince(fmtDayShort(m.since)) : null;
    const pct = fmtPct(m.pct);
    return h('span', { class: 'uptime', title: since || tx.uptimeTitle, 'aria-label': tx.uptimeAria(pct, since) }, pct);
  }

  function daysEl(model) {
    const tx = t();
    const bad = model.days.filter((d) => d.l === 'minor' || d.l === 'major');
    const total = bad.reduce((a, d) => a + d.m, 0);
    const firstData = model.days.find((d) => d.l !== 'none');
    let label = bad.length ? tx.daysBad(DAYS, bad.length, dur(total)) : tx.daysOk(DAYS);
    if (model.days[0].l === 'none' && firstData) label += tx.daysNoData(fmtDay(firstData.k));
    const wrap = h('div', {
      class: 'days',
      role: 'img',
      tabindex: '0',
      'aria-label': `${model.name}. ${label}`,
      'data-focus': `days-${model.id || model.slug}`,
    });
    for (const d of model.days) wrap.append(h('span', { class: 'day', 'data-l': d.l, 'data-k': d.k, 'data-m': String(d.m) }));
    return h('div', { class: 'days-wrap' }, wrap);
  }

  function rowEl(model, sub) {
    return h(
      'div',
      { class: 'row' },
      h(
        'div',
        { class: 'row-name' },
        h(sub ? 'h4' : 'h3', { text: model.name }),
        !sub && model.desc ? h('span', { class: 'row-desc', text: model.desc }) : null,
      ),
      h('div', { class: 'row-state' }, stateEl(model.status), uptimeEl(model)),
      daysEl(model),
    );
  }

  function renderGroups() {
    const box = $('#groups');
    const tx = t();
    if (!S.summary) {
      if (S.statusError) {
        box.setAttribute('aria-busy', 'false');
        box.replaceChildren(
          h(
            'div',
            { class: 'load-error' },
            h('p', { text: navigator.onLine === false ? tx.loadFailOffline : tx.loadFailLater }),
            h('button', { type: 'button', class: 'retry', onclick: () => loadStatus() }, tx.retry),
          ),
        );
      }
      return;
    }
    const focusedKey = document.activeElement && box.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const groups = groupsModel();
    box.setAttribute('aria-busy', 'false');
    box.replaceChildren(
      ...groups.map((g) => {
        const el = h('section', { class: 'group', 'aria-label': g.name, 'data-g': g.id }, rowEl(g, false));
        if (g.members.length > 1) {
          const open = S.expanded.has(g.id);
          const subsId = `subs-${g.id}`;
          el.append(
            h(
              'button',
              {
                type: 'button',
                class: 'more',
                'aria-expanded': String(open),
                'aria-controls': subsId,
                'data-focus': `more-${g.id}`,
                onclick: () => {
                  if (S.expanded.has(g.id)) S.expanded.delete(g.id);
                  else S.expanded.add(g.id);
                  renderGroups();
                },
              },
              chevron(),
              tx.parts(g.members.length),
            ),
            h(
              'div',
              { class: 'subs', id: subsId, hidden: !open },
              g.members.map((m) => {
                const s = h('div', { class: 'sub' }, rowEl(m, true));
                return s;
              }),
            ),
          );
        }
        return el;
      }),
    );
    // Keep keyboard focus where it was across re-renders
    if (focusedKey) {
      const again = box.querySelector(`[data-focus="${focusedKey}"]`);
      if (again) again.focus();
    }
  }

  function focusKey(el) {
    return el.getAttribute('data-focus');
  }

  function chevron() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M6 3.5 10.5 8 6 12.5');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
    return svg;
  }

  function renderMaintenance() {
    const box = $('#maintenance');
    const tx = t();
    const now = Date.now();
    const list = (S.issues || [])
      .filter((i) => i.kind === 'maintenance' && i.open && i.start && i.end && now <= i.end)
      .sort((a, b) => a.start - b.start);
    box.replaceChildren(
      ...list.map((i) => {
        const ongoing = i.start <= now;
        const body = md(i.body);
        return h(
          'div',
          { class: 'notice', role: 'note' },
          h('strong', { text: `${ongoing ? tx.maintenanceOngoing : tx.maintenance}: ${incidentTitle(i)}` }),
          h('span', { class: 'meta', text: `${fmtWhen(i.start)} – ${sameDay(i.start, i.end) ? fmtTime(i.end) : fmtWhen(i.end)}` }),
          body ? h('div', { class: 'body inc-body', html: body }) : null,
        );
      }),
    );
  }
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  function renderIncidents() {
    const box = $('#incidents');
    const tx = t();
    if (S.issuesError && !S.issues) {
      box.replaceChildren(h('p', { class: 'quiet', text: tx.incidentsFail }));
      return;
    }
    if (!S.issues) return;
    const incidents = S.issues.filter((i) => i.kind === 'incident');
    const open = incidents.filter((i) => i.open).sort((a, b) => b.created - a.created);
    const closed = incidents
      .filter((i) => !i.open)
      .sort((a, b) => (b.closed || b.created) - (a.closed || a.created))
      .slice(0, CLOSED_SHOWN);
    const all = [...open, ...closed];
    if (!all.length) {
      box.replaceChildren(h('p', { class: 'quiet', text: tx.noIncidents }));
      return;
    }
    box.replaceChildren(h('ol', { class: 'incidents' }, all.map(incidentEl)));
  }

  function incidentEl(inc) {
    const tx = t();
    const affects = incidentAffects(inc);
    const end = inc.closed || new Date();
    const minutes = (end - inc.created) / 60000;
    const span = inc.open
      ? `${fmtTime(inc.created)} · ${tx.ongoingFor(dur(minutes))}`
      : `${fmtTime(inc.created)} – ${sameDay(inc.created, end) ? fmtTime(end) : fmtWhen(end)} · ${tx.lasted(dur(minutes))}`;
    const meta = [affects.length ? tx.affects(tx.list(affects)) : null, span].filter(Boolean).join(' · ');
    const c = S.comments[inc.num];
    // Upptime's own «Resolved» comment is not counted: only updates written by hand
    const handComments = inc.comments - (inc.auto && !inc.open ? 1 : 0);
    let updates = null;
    if (Array.isArray(c)) {
      updates = c.length
        ? h(
            'ol',
            { class: 'updates', id: `upd-${inc.num}`, tabindex: '-1' },
            c.map((u) =>
              h('li', null, h('time', { datetime: u.at.toISOString(), text: fmtWhen(u.at) }), h('div', { class: 'inc-body', html: md(u.body) })),
            ),
          )
        : inc.open
          ? null
          : h('p', { class: 'quiet', id: `upd-${inc.num}`, tabindex: '-1', text: tx.noUpdates });
    } else if (c === 'error') {
      updates = h('p', { class: 'quiet', id: `upd-${inc.num}`, tabindex: '-1', text: tx.updatesFail });
    } else if (c !== 'loading' && handComments > 0) {
      updates = h('button', { type: 'button', class: 'link-btn', onclick: () => loadComments(inc, true) }, tx.showUpdates);
    }
    return h(
      'li',
      { class: 'incident' },
      h(
        'div',
        { class: 'inc-when' },
        h('time', { datetime: inc.created.toISOString(), text: fmtDay(isoDay(inc.created)) }),
        h('span', { class: `pill ${inc.open ? 'pill-open' : 'pill-closed'}${inc.open && incidentIsDown(inc) ? ' is-down' : ''}`, text: inc.open ? tx.open : tx.closed }),
      ),
      h(
        'div',
        { class: 'inc-main' },
        h('h3', { text: incidentTitle(inc) }),
        h('p', { class: 'inc-meta', text: meta }),
        h('div', { class: 'inc-body', html: incidentBody(inc) }),
        updates,
      ),
    );
  }

  function renderLastCheck() {
    const el = $('#last-check');
    el.textContent = S.lastRun ? t().lastCheck(rel(S.lastRun)) : '';
  }

  function updateAxis() {
    const w = window.innerWidth;
    const n = w < 480 ? 30 : w < 720 ? 60 : 90;
    const el = $('#axis-start');
    el.textContent = t()[`axisStart${n}`];
  }

  /* ---------------------------------------------------------------------------------------------------------------
     The tooltip of a day: pointer (mouse and touch) and keyboard (arrows on a focused bar)
     ------------------------------------------------------------------------------------------------------------- */
  const tip = $('#tip');
  let active = null; // { bar, idx }

  function visibleDays(bar) {
    return [...bar.children].filter((d) => d.offsetWidth > 0);
  }
  function showDay(bar, idx) {
    const days = visibleDays(bar);
    if (!days.length) return;
    idx = Math.max(0, Math.min(days.length - 1, idx));
    if (active && active.el) active.el.classList.remove('is-on');
    const day = days[idx];
    day.classList.add('is-on');
    bar.classList.add('is-active');
    active = { bar, idx, el: day };
    const tx = t();
    const k = day.dataset.k;
    const m = Number(day.dataset.m) || 0;
    const l = day.dataset.l;
    const isToday = idx === days.length - 1;
    const text = l === 'none' ? tx.dayNone : l === 'ok' ? tx.dayOk : tx.dayDown(m ? dur(m) : '');
    tip.replaceChildren(h('strong', { text: `${fmtDay(k)}${isToday ? ` · ${tx.today}` : ''}` }), h('span', { text: text.trim() }));
    tip.hidden = false;
    const r = day.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    let y = r.top - th - 10;
    if (y < 72) y = r.bottom + 10;
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
  }
  function hideDay() {
    if (active) {
      if (active.el) active.el.classList.remove('is-on');
      active.bar.classList.remove('is-active');
    }
    active = null;
    tip.hidden = true;
  }
  function idxAt(bar, x) {
    const n = visibleDays(bar).length;
    const r = bar.getBoundingClientRect();
    return Math.floor(((x - r.left) / r.width) * n);
  }

  function wireTooltip() {
    const box = $('#groups');
    box.addEventListener('pointermove', (e) => {
      const bar = e.target.closest && e.target.closest('.days');
      if (!bar) return;
      showDay(bar, idxAt(bar, e.clientX));
    });
    box.addEventListener('pointerdown', (e) => {
      const bar = e.target.closest && e.target.closest('.days');
      if (bar) showDay(bar, idxAt(bar, e.clientX));
    });
    box.addEventListener('pointerout', (e) => {
      const bar = e.target.closest && e.target.closest('.days');
      if (bar && e.pointerType === 'mouse' && !bar.contains(e.relatedTarget) && document.activeElement !== bar) hideDay();
    });
    box.addEventListener('focusin', (e) => {
      if (e.target.classList.contains('days')) showDay(e.target, visibleDays(e.target).length - 1);
    });
    box.addEventListener('focusout', (e) => {
      if (e.target.classList.contains('days')) hideDay();
    });
    box.addEventListener('keydown', (e) => {
      const bar = e.target;
      if (!bar.classList || !bar.classList.contains('days')) return;
      const n = visibleDays(bar).length;
      const cur = active && active.bar === bar ? active.idx : n - 1;
      const moves = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 };
      if (e.key in moves) {
        e.preventDefault();
        showDay(bar, moves[e.key]);
      } else if (e.key === 'Escape') hideDay();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!(e.target.closest && e.target.closest('.days'))) hideDay();
    });
    window.addEventListener('scroll', () => active && document.activeElement !== active.bar && hideDay(), { passive: true });
    window.addEventListener('resize', () => {
      hideDay();
      updateAxis();
    });
  }

  /* ---------------------------------------------------------------------------------------------------------------
     Demo data (local preview only, ?demo=incident or ?demo=outage)
     ------------------------------------------------------------------------------------------------------------- */
  const ago = (min) => new Date(Date.now() - min * 60e3);
  const daysAgoKey = (n) => isoDay(Date.now() - n * DAY_MS);

  function demoStatus() {
    const start = new Date(Date.now() - 140 * DAY_MS);
    S.summary.forEach((s) => {
      S.starts[s.slug] = start;
      s.status = 'up';
      s.dailyMinutesDown = {};
    });
    const set = (slug, k, m) => {
      const s = S.summary.find((x) => x.slug === slug);
      if (s) s.dailyMinutesDown[k] = m;
    };
    const status = (slug, st) => {
      const s = S.summary.find((x) => x.slug === slug);
      if (s) s.status = st;
    };
    set('web', daysAgoKey(3), 12);
    set('activacion-de-licencias', daysAgoKey(20), 95);
    set('renovacion-de-licencias', daysAgoKey(20), 95);
    set('descargas-paquetes-nas', daysAgoKey(41), 7);
    set('pagos', daysAgoKey(0), 23);
    status('pagos', 'down');
    if (DEMO === 'outage') {
      status('descargas-paquetes-nas', 'degraded');
      set('descargas-paquetes-nas', daysAgoKey(0), 9);
    }
  }

  function demoIssues() {
    const L = (...n) => n.map((name) => ({ name }));
    const auto = (name, url, down) =>
      `In [\`1a2b3c4\`](https://github.com/${OWNER}/${REPO}/commit/1a2b3c4d), ${name} (${url}) ${down ? 'was **down**' : 'experienced **degraded performance**'}:\n- HTTP code: 0\n- Response time: 0 ms\n`;
    const iso = (d) => d.toISOString();
    const tomorrow2 = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 2, 2));
    const list = [
      {
        number: 14,
        title: 'Actualización del servidor de licencias',
        state: 'open',
        labels: L('maintenance'),
        created_at: iso(ago(60 * 5)),
        closed_at: null,
        comments: 0,
        body: `<!-- start: ${iso(tomorrow2)} -->\n<!-- end: ${iso(new Date(tomorrow2.getTime() + 3600e3))} -->\n<!-- expectedDown: activacion-de-licencias, renovacion-de-licencias -->\nLa activación y la renovación pueden no responder durante unos minutos. Tu servidor sigue funcionando.`,
      },
      DEMO === 'outage'
        ? {
            number: 13,
            title: '⚠️ Descargas (paquetes NAS) has degraded performance',
            state: 'open',
            labels: L('status', 'descargas-paquetes-nas'),
            created_at: iso(ago(9)),
            closed_at: null,
            comments: 0,
            body: auto('Descargas (paquetes NAS)', 'https://licenses.kumoyami.com/v1/packages', false),
          }
        : null,
      {
        number: 12,
        title: DEMO === 'outage' ? '🛑 Pagos is down' : 'Los pagos no se completan',
        state: 'open',
        labels: L('status', 'pagos'),
        created_at: iso(ago(23)),
        closed_at: null,
        comments: DEMO === 'outage' ? 0 : 1,
        body:
          DEMO === 'outage'
            ? auto('Pagos', 'https://kumoyami.com/buy/pro', true)
            : 'La página de compra no carga los planes, así que no se puede pagar. Lo estamos mirando.\n\nTu servidor y tus licencias **no se ven afectados**.',
      },
      {
        number: 11,
        title: '🛑 Activación de licencias is down',
        state: 'closed',
        labels: L('status', 'activacion-de-licencias'),
        created_at: iso(new Date(dayKeyToDate(daysAgoKey(20)).getTime() + 3 * 3600e3 + 10 * 60e3)),
        closed_at: iso(new Date(dayKeyToDate(daysAgoKey(20)).getTime() + 4 * 3600e3 + 45 * 60e3)),
        comments: 2,
        body: auto('Activación de licencias', 'https://licenses.kumoyami.com/v1/activate', true),
      },
      {
        number: 10,
        title: '⚠️ Web has degraded performance',
        state: 'closed',
        labels: L('status', 'web'),
        created_at: iso(new Date(dayKeyToDate(daysAgoKey(3)).getTime() + 15 * 3600e3)),
        closed_at: iso(new Date(dayKeyToDate(daysAgoKey(3)).getTime() + 15 * 3600e3 + 12 * 60e3)),
        comments: 1,
        body: auto('Web', 'https://kumoyami.com/', false),
      },
      {
        number: 9,
        title: '🔧 Las descargas de paquetes NAS fallaban',
        state: 'closed',
        labels: L('status', 'descargas-paquetes-nas'),
        created_at: iso(new Date(dayKeyToDate(daysAgoKey(41)).getTime() + 9 * 3600e3)),
        closed_at: iso(new Date(dayKeyToDate(daysAgoKey(41)).getTime() + 9 * 3600e3 + 7 * 60e3)),
        comments: 0,
        body: 'El índice de paquetes devolvía un error durante 7 minutos tras publicar la 0.1.6.\n\n- Las instalaciones ya hechas no se vieron afectadas.\n- Si una actualización falló, vuelve a intentarlo.\n\nMás información en [las notas de la versión](https://kumoyami.com/changelog).',
      },
    ];
    return list.filter(Boolean);
  }

  function demoComments(num) {
    if (num === 12)
      return [
        {
          created_at: ago(8).toISOString(),
          body: 'Hemos encontrado la causa: el servidor de licencias se reinició a mitad de una actualización. Volviendo a desplegar.',
        },
      ];
    if (num === 11)
      return [
        { created_at: ago(20 * 1440 - 30).toISOString(), body: 'El proveedor del servidor tuvo un corte de red. Ya está resuelto.' },
        { created_at: ago(20 * 1440 - 40).toISOString(), body: '**Resolved:** Activación de licencias is back up in [`abc1234`](https://github.com) after 1 hour.' },
      ];
    return [{ created_at: ago(3 * 1440).toISOString(), body: '**Resolved:** Web performance has improved.' }];
  }

  /* ---------------------------------------------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------------------------------------------- */
  function tick() {
    if (document.hidden) return;
    const now = Date.now();
    if (now - S.statusAt > STATUS_EVERY) loadStatus();
    if (now - S.apiAt > API_EVERY) loadIncidents();
    renderLastCheck();
    if (S.summary && !document.querySelector('#groups :focus')) renderOverall();
  }

  function start() {
    S.lang = readLang();
    applyStatic();
    wireTooltip();
    $('#lang-toggle').addEventListener('click', () => setLang(S.lang === 'es' ? 'en' : 'es', true));
    document.querySelectorAll('.lang-switch button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, true)));
    render();
    loadStatus();
    loadIncidents();
    setInterval(tick, 60e3);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', () => {
      loadStatus();
      loadIncidents();
    });
  }

  start();
})();
