// WavelogQSOStats2Awtrix.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || undefined;   // undefined = all interfaces

// Optional HTTP Basic Auth for the web UI and API (strongly recommended)
const WEB_USER     = process.env.WEB_USER || 'admin';
const WEB_PASSWORD = process.env.WEB_PASSWORD || '';

const MIN_FETCH_INTERVAL = 10;
const MAX_FETCH_INTERVAL = 86400;   // 1 day – also keeps setTimeout below its 2^31 ms limit
const MAX_DURATION       = 3600;
const MAX_TEXT_LENGTH    = 50;

const configFile = process.env.CONFIG_FILE || path.join(__dirname, 'config.json');

// ─── Default Configuration ────────────────────────────────────────────────────

const defaultConfig = {
  wavelogBaseUrl: "",
  apiKey: "",
  stationIds: [],
  awtrixUrl: "",
  fetchInterval: 300,
  displayItems: [
    { key: "totalQso",     text1: "Total",    text2: "QSOs", icon: "wavelog",  duration: 10, enabled: true,  effect: "" },
    { key: "totalQsoYear", text1: "Year",     text2: "QSOs", icon: "year",     duration: 10, enabled: true,  effect: "" },
    { key: "FT8",          text1: "FT8",      text2: "QSOs", icon: "ft8",      duration: 10, enabled: true,  effect: "" },
    { key: "FT4",          text1: "FT4",      text2: "QSOs", icon: "ft4",      duration: 10, enabled: true,  effect: "" },
    { key: "ft8ft4",       text1: "FT8/FT4",  text2: "QSOs", icon: "ft8ft4",   duration: 10, enabled: false, effect: "" },
    { key: "CW",           text1: "CW",       text2: "QSOs", icon: "key",      duration: 10, enabled: true,  effect: "" },
    { key: "SSB",          text1: "SSB",      text2: "QSOs", icon: "ssbwave",  duration: 10, enabled: true,  effect: "" },
    { key: "FM",           text1: "FM",       text2: "QSOs", icon: "radioblue",duration: 10, enabled: false, effect: "" },
    { key: "PSK",          text1: "PSK",      text2: "QSOs", icon: "psk31",    duration: 10, enabled: false, effect: "" },
    { key: "JS8",          text1: "JS8",      text2: "QSOs", icon: "js8",      duration: 10, enabled: false, effect: "" },
    { key: "RTTY",         text1: "RTTY",     text2: "QSOs", icon: "rtty",     duration: 10, enabled: false, effect: "" },
    { key: "digi",         text1: "Digi",     text2: "QSOs", icon: "digi",     duration: 10, enabled: false, effect: "" }
  ]
};

const VALID_KEYS      = new Set(defaultConfig.displayItems.map(d => d.key));
const DEFAULTS_BY_KEY = Object.fromEntries(defaultConfig.displayItems.map(d => [d.key, d]));

// ─── Config Helpers ───────────────────────────────────────────────────────────

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function loadConfig() {
  if (fs.existsSync(configFile) && !isFile(configFile)) {
    console.error(`[Config] ${configFile} is a directory, not a file. ` +
      `Docker creates a directory when a mounted file does not exist – remove it and mount a folder instead (see README).`);
    return JSON.parse(JSON.stringify(defaultConfig));
  }
  if (!fs.existsSync(configFile)) {
    try {
      saveConfig(defaultConfig);
    } catch (err) {
      console.error("Failed to create config:", err.message);
    }
    return JSON.parse(JSON.stringify(defaultConfig));
  }
  try {
    const loaded = JSON.parse(fs.readFileSync(configFile, 'utf8'));

    // Scalar fields: take from file if present, else use default
    const merged = Object.assign({}, defaultConfig, loaded);
    merged.stationIds    = Array.isArray(merged.stationIds) ? merged.stationIds.map(String) : [];
    merged.fetchInterval = clamp(merged.fetchInterval, MIN_FETCH_INTERVAL, MAX_FETCH_INTERVAL, defaultConfig.fetchInterval);

    // 1. Keep saved items in SAVED ORDER, strip unknown keys
    const kept = (Array.isArray(loaded.displayItems) ? loaded.displayItems : [])
      .filter(i => i && VALID_KEYS.has(i.key));

    // 2. Merge each saved item with its defaults (saved values win)
    const merged_items = kept.map(saved => ({ ...DEFAULTS_BY_KEY[saved.key], ...saved }));

    // 3. Append any default items that are missing from the saved list (new features)
    const keptKeys = new Set(kept.map(i => i.key));
    defaultConfig.displayItems.forEach(def => {
      if (!keptKeys.has(def.key)) merged_items.push({ ...def });
    });

    merged.displayItems = merged_items;

    return merged;
  } catch (err) {
    console.error("Failed to read config:", err.message);
    return JSON.parse(JSON.stringify(defaultConfig));
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

// ─── Input Validation ─────────────────────────────────────────────────────────

class ValidationError extends Error {}

// Wavelog: full http(s) URL, stored without trailing slash
function normalizeWavelogUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let url;
  try { url = new URL(s); } catch { throw new ValidationError("Wavelog URL is not a valid URL"); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError("Wavelog URL must start with http:// or https://");
  }
  return s.replace(/\/+$/, "");
}

// Awtrix: host name or IP with optional port only – no path, query or credentials
function normalizeAwtrixHost(raw) {
  const s = String(raw ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!s) return "";
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(s)) {
    throw new ValidationError("Awtrix address must be an IP or host name, optionally with :port");
  }
  return s;
}

function awtrixBase(config) {
  return `http://${normalizeAwtrixHost(config.awtrixUrl)}`;
}

function awtrixAppUrl(config, appName) {
  return `${awtrixBase(config)}/api/custom?name=${encodeURIComponent(appName)}`;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function basicAuth(req, res, next) {
  if (!WEB_PASSWORD) return next();
  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep >= 0 && safeEqual(decoded.slice(0, sep), WEB_USER) && safeEqual(decoded.slice(sep + 1), WEB_PASSWORD)) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="WavelogQSOStats2Awtrix", charset="UTF-8"');
  res.status(401).send("Authentication required");
}

// Blocks cross-site requests: state-changing calls must be JSON (forces a CORS
// preflight, which is never granted) and, if the browser sends an Origin, it
// must match the host the UI was loaded from.
function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (!(req.headers['content-type'] || "").toLowerCase().startsWith('application/json')) {
    return res.status(415).json({ success: false, message: "Content-Type must be application/json" });
  }
  const origin = req.headers.origin;
  if (origin) {
    let originHost = null;
    try { originHost = new URL(origin).host; } catch { /* invalid origin */ }
    if (originHost !== req.headers.host) {
      return res.status(403).json({ success: false, message: "Cross-origin request blocked" });
    }
  }
  next();
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options':        'DENY',
    'Referrer-Policy':        'no-referrer',
  });
  next();
});
app.use(basicAuth);
app.use('/api', sameOriginOnly);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/vendor/Sortable.min.js', (req, res) => {
  res.sendFile(require.resolve('sortablejs/Sortable.min.js'));
});

// ─── REST API ─────────────────────────────────────────────────────────────────

// GET /api/config  – the API key itself never leaves the server
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  res.json({ ...config, apiKey: "", apiKeySet: Boolean(config.apiKey) });
});

// POST /api/save
app.post('/api/save', (req, res) => {
  const config = loadConfig();
  const body = req.body || {};

  let wavelogBaseUrl, awtrixUrl;
  try {
    wavelogBaseUrl = normalizeWavelogUrl(body.wavelogBaseUrl);
    awtrixUrl      = normalizeAwtrixHost(body.awtrixUrl);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // An empty API key field keeps the stored key – but only for the same Wavelog
  // server, so the stored key can never be redirected to a different host.
  const newApiKey = cleanText(body.apiKey, 200);
  let storedUrl = "";
  try { storedUrl = normalizeWavelogUrl(config.wavelogBaseUrl); } catch { /* invalid legacy value */ }
  if (!newApiKey && config.apiKey && wavelogBaseUrl && wavelogBaseUrl !== storedUrl) {
    return res.status(400).json({ success: false, message: "Please re-enter the API key when changing the Wavelog URL" });
  }

  config.wavelogBaseUrl = wavelogBaseUrl;
  config.apiKey         = newApiKey || config.apiKey;
  config.stationIds     = Array.isArray(body.stationIds) ? body.stationIds.map(s => cleanText(s, 20)).filter(Boolean) : [];
  config.awtrixUrl      = awtrixUrl;
  config.fetchInterval  = clamp(body.fetchInterval, MIN_FETCH_INTERVAL, MAX_FETCH_INTERVAL, defaultConfig.fetchInterval);

  if (Array.isArray(body.displayItems)) {
    // Replace displayItems entirely (preserves re-ordering from UI)
    const seen = new Set();
    config.displayItems = body.displayItems
      .filter(item => item && VALID_KEYS.has(item.key) && !seen.has(item.key) && seen.add(item.key))
      .map(item => ({
        key:      item.key,
        text1:    cleanText(item.text1),
        text2:    cleanText(item.text2),
        icon:     cleanText(item.icon, 64),
        duration: clamp(item.duration, 1, MAX_DURATION, 10),
        enabled:  item.enabled !== false,
        effect:   cleanText(item.effect, 64)
      }));
  }

  // Write only the known fields – strips any legacy keys from old versions
  const clean = {
    wavelogBaseUrl: config.wavelogBaseUrl,
    apiKey:         config.apiKey,
    stationIds:     config.stationIds,
    awtrixUrl:      config.awtrixUrl,
    fetchInterval:  config.fetchInterval,
    displayItems:   config.displayItems,
  };

  try {
    saveConfig(clean);
    res.json({ success: true });
  } catch (err) {
    console.error("Save config failed:", err.message);
    res.status(500).json({ success: false, message: "Could not write configuration file (see server log)" });
  }
});

// POST /api/test  – fetch stats and return them
app.post('/api/test', async (req, res) => {
  const config = loadConfig();

  if (!config.apiKey || !config.stationIds.length || !config.wavelogBaseUrl) {
    return res.status(400).json({ success: false, message: "Missing Wavelog URL, API Key or Station IDs" });
  }

  try {
    const stats = await fetchStats(config);
    res.json({ success: true, message: "API Test successful ✅", stats });
  } catch (err) {
    console.error("API test failed:", err.message);
    res.status(502).json({ success: false, message: "API Test failed: " + err.message });
  }
});

// POST /api/push  – manually trigger one Awtrix push cycle
app.post('/api/push', async (req, res) => {
  const config = loadConfig();
  if (!config.awtrixUrl) {
    return res.status(400).json({ success: false, message: "Awtrix URL not configured" });
  }
  try {
    const stats = await fetchStats(config);
    await clearAllWavelogApps(config);
    const pushed = await pushToAwtrix(config, stats);
    res.json({ success: true, message: `Pushed ${pushed} item(s) to Awtrix ✅`, stats });
  } catch (err) {
    res.status(502).json({ success: false, message: "Push failed: " + err.message });
  }
});

// POST /api/clear-apps  – delete ALL known wavelog_* apps from Awtrix (including old/renamed ones)
app.post('/api/clear-apps', async (req, res) => {
  const config = loadConfig();
  if (!config.awtrixUrl) {
    return res.status(400).json({ success: false, message: "Awtrix URL not configured" });
  }

  // Build full list of app names to delete:
  // 1. Legacy flat names (wavelog_CW, wavelog_FM, …)
  // 2. New numbered names (wavelog_01_totalQso … wavelog_20_*)
  const baseKeys = [
    'totalQso', 'totalQsoYear', 'FT8', 'FT4', 'ft8ft4',
    'CW', 'SSB', 'FM', 'PSK', 'JS8', 'RTTY', 'digi',
    'morse', 'cw', 'ssb', 'fm', 'psk', 'js8', 'rtty',
    'ft8', 'ft4', 'total', 'year', 'totalqso', 'totalqsoyear',
  ];

  // numbered slots: wavelog_01_<key> … wavelog_20_<key> for all base keys
  const numberedNames = [];
  for (let pos = 1; pos <= 20; pos++) {
    const p = String(pos).padStart(2, '0');
    baseKeys.forEach(k => numberedNames.push(`${p}_${k}`));
  }

  const allKnownKeys = [...baseKeys, ...numberedNames];

  const results = [];
  for (const key of allKnownKeys) {
    try {
      await axios.post(awtrixAppUrl(config, `wavelog_${key}`), {}, { timeout: 5000 });
      results.push({ key, ok: true });
    } catch (err) {
      if (err.response?.status === 404) {
        results.push({ key, ok: true, note: 'not present' });
      } else {
        results.push({ key, ok: false, error: err.message });
      }
    }
  }

  const failed = results.filter(r => !r.ok);
  res.json({
    success: failed.length === 0,
    message: `Cleared ${results.length} app slots on Awtrix ✅`,
    results
  });
});

// POST /api/upload-icons  – upload all icons from AmateurRadioIcons/ to Awtrix
app.post('/api/upload-icons', async (req, res) => {
  const config = loadConfig();
  if (!config.awtrixUrl) {
    return res.status(400).json({ success: false, message: "Awtrix URL not configured" });
  }

  const iconsDir = path.join(__dirname, 'AmateurRadioIcons');
  if (!fs.existsSync(iconsDir)) {
    return res.status(404).json({ success: false, message: "Folder AmateurRadioIcons/ not found next to the script" });
  }

  const MIME_TYPES = { '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
  const files = fs.readdirSync(iconsDir).filter(f => MIME_TYPES[path.extname(f).toLowerCase()]);
  if (!files.length) {
    return res.status(404).json({ success: false, message: "No icon files found in AmateurRadioIcons/" });
  }

  const UPLOAD_TIMEOUT_MS = 30000;  // 30s per file – generous for slow ESP32 WLAN
  const PAUSE_BETWEEN_MS  = 300;    // 300ms pause so ESP32 can breathe

  let uploadUrl;
  try {
    uploadUrl = `${awtrixBase(config)}/edit`;
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const results = [];
  for (const filename of files) {
    const filePath = path.join(iconsDir, filename);
    const fileData = fs.readFileSync(filePath);
    const fileSizeKb = (fileData.length / 1024).toFixed(1);
    const mime     = MIME_TYPES[path.extname(filename).toLowerCase()];

    // Awtrix3: POST /edit?path=/ICONS/<filename>  multipart/form-data
    const boundary = '----WavelogIconBoundary';
    const header   = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="/ICONS/${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body   = Buffer.concat([header, fileData, footer]);

    try {
      await axios.post(
        uploadUrl,
        body,
        {
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
          },
          timeout: UPLOAD_TIMEOUT_MS,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      console.log(`[Icons] Uploaded: ${filename} (${fileSizeKb} KB)`);
      results.push({ file: filename, ok: true, sizeKb: fileSizeKb });
    } catch (err) {
      console.error(`[Icons] Failed: ${filename} –`, err.message);
      results.push({ file: filename, ok: false, error: err.message, sizeKb: fileSizeKb });
    }

    // Short pause between uploads – ESP32 needs time to write to flash
    await sleep(PAUSE_BETWEEN_MS);
  }

  const ok  = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  res.json({
    success: fail === 0,
    message: `Uploaded ${ok}/${files.length} icons to Awtrix ✅${fail ? `  (${fail} failed ❌)` : ''}`,
    results
  });
});

// ─── Wavelog Stats Fetcher ────────────────────────────────────────────────────

// Throws if any station fails – partial or zeroed stats must never reach the clock.
async function fetchStats(config) {
  const baseUrl  = normalizeWavelogUrl(config.wavelogBaseUrl);
  const apiUrl   = `${baseUrl}/index.php/api/get_wp_stats`;
  const apiKey   = config.apiKey;

  const stats = {
    totalQso: 0, totalQsoYear: 0,
    SSB: 0, FM: 0, RTTY: 0,
    FT8: 0, FT4: 0, ft8ft4: 0, PSK: 0, CW: 0, JS8: 0, digi: 0
  };

  for (const stationId of config.stationIds) {
    let body;
    try {
      const response = await axios.post(
        apiUrl,
        { key: apiKey, station_id: stationId },
        { timeout: 15000, maxContentLength: 5 * 1024 * 1024 }
      );
      body = response.data;
    } catch (err) {
      throw new Error(`Station ${stationId}: ${err.message}`);
    }
    if (!body || body.status !== "successful") {
      const reason = body?.reason || body?.message || body?.status || 'no valid response';
      throw new Error(`Station ${stationId}: ${reason}`);
    }

    stats.totalQso     += Number(body.statistics?.totalalltime?.[0]?.count  || 0);
    stats.totalQsoYear += Number(body.statistics?.totalthisyear?.[0]?.count || 0);

    for (const mode of (body.statistics?.totalgroupedmodes || [])) {
      if (!mode) continue;
      const m   = String(mode.col_mode    || '').toUpperCase();
      const sub = String(mode.col_submode || '').toUpperCase();
      const cnt = Number(mode.count || 0);

      // ADIF: FT4 and JS8 are submodes of MFSK, PSK31/63/… are submodes of PSK
      if      (m === 'SSB')                           stats.SSB  += cnt;
      else if (m === 'FM')                            stats.FM   += cnt;
      else if (m === 'RTTY')                          stats.RTTY += cnt;
      else if (m === 'CW')                            stats.CW   += cnt;
      else if (m === 'PSK' || sub.startsWith('PSK'))  stats.PSK  += cnt;
      else if (m === 'JS8' || sub === 'JS8')          stats.JS8  += cnt;
      else if (m === 'FT8')                           { stats.FT8 += cnt; stats.ft8ft4 += cnt; }
      else if (m === 'FT4' || sub === 'FT4')          { stats.FT4 += cnt; stats.ft8ft4 += cnt; }
    }
  }

  // digi = FT8 + FT4 + PSK + JS8 + RTTY
  stats.digi = stats.FT8 + stats.FT4 + stats.PSK + stats.JS8 + stats.RTTY;

  return stats;
}

// ─── Awtrix Push ──────────────────────────────────────────────────────────────

async function pushToAwtrix(config, stats) {
  const activeItems = config.displayItems.filter(item => item.enabled);
  let pushedCount = 0;

  for (const item of activeItems) {
    const appName = `wavelog_${item.key}`;
    const value   = stats[item.key] ?? 0;
    const text    = [item.text1, value, item.text2].filter(p => p !== '').join(' ');

    try {
      await axios.post(
        awtrixAppUrl(config, appName),
        {
          text,
          icon:     item.icon || '',
          color:    "#FFFFFF",
          duration: item.duration || 10,
          lifetime: (config.fetchInterval || defaultConfig.fetchInterval) * 2,
          ...(item.effect ? { effect: item.effect } : {}),
        },
        { timeout: 5000 }
      );
      console.log(`[Awtrix] Pushed: ${appName} → ${text}`);
      pushedCount++;
    } catch (err) {
      console.error(`[Awtrix] Failed to push "${appName}":`, err.message);
    }
  }
  return pushedCount;
}

// GET /api/effects  – fetch available effect names from Awtrix
app.get('/api/effects', async (req, res) => {
  const config = loadConfig();
  if (!config.awtrixUrl) {
    return res.status(400).json({ success: false, message: "Awtrix URL not configured" });
  }
  try {
    const response = await axios.get(`${awtrixBase(config)}/api/effects`, {
      timeout: 5000, maxRedirects: 0, maxContentLength: 64 * 1024,
    });
    // Only pass through effect names – never relay arbitrary upstream content
    const effects = Array.isArray(response.data)
      ? response.data.filter(e => typeof e === 'string' && e.length <= 64)
      : [];
    res.json(effects);
  } catch (err) {
    console.error("[Effects] Failed to fetch effects:", err.message);
    res.status(502).json({ success: false, message: "Could not reach Awtrix: " + err.message });
  }
});

// ─── Startup Clear Helper ────────────────────────────────────────────────────

async function clearAllWavelogApps(config) {
  for (const key of VALID_KEYS) {
    try {
      await axios.post(awtrixAppUrl(config, `wavelog_${key}`), {}, { timeout: 3000 });
    } catch (err) {
      // ignore – app may not exist yet
    }
  }
  console.log("[Loop] Stale apps cleared.");
}

// ─── Background Push Loop ─────────────────────────────────────────────────────

async function awtrixPushLoop() {
  console.log("[Loop] Awtrix push loop started");
  let firstRun = true;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const config = loadConfig();   // re-read every cycle so web UI changes take effect

    if (!config.awtrixUrl || !config.wavelogBaseUrl || !config.apiKey || !config.stationIds.length) {
      console.warn("[Loop] Configuration incomplete, waiting 30s …");
      await sleep(30_000);
      continue;
    }

    try {
      // If Wavelog is unreachable this throws and nothing is pushed – the clock
      // keeps showing the last values until their lifetime expires.
      const stats = await fetchStats(config);

      // On first run after (re)start: clear all wavelog apps first so stale
      // apps from a previous run are removed and order is correct from the start.
      if (firstRun) {
        console.log("[Loop] First run – clearing stale Awtrix apps…");
        await clearAllWavelogApps(config);
        firstRun = false;
      }

      await pushToAwtrix(config, stats);
    } catch (err) {
      console.error("[Loop] Cycle error, nothing pushed:", err.message);
    }

    await sleep(config.fetchInterval * 1000);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Auto-restart on unhandled crash
(async function startLoop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await awtrixPushLoop();
    } catch (err) {
      console.error("[Loop] Crashed, restarting in 10s:", err.message);
      await sleep(10_000);
    }
  }
})();

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`WavelogQSOStats2Awtrix running at http://${HOST || 'localhost'}:${PORT}`);
  console.log(`[Config] Using ${configFile}`);
  if (!WEB_PASSWORD) {
    console.warn("[Security] No WEB_PASSWORD set – the web UI is open to everyone who can reach this port. " +
      "Set WEB_PASSWORD (and optionally WEB_USER) to enable login.");
  } else if (WEB_PASSWORD === 'change-me') {
    console.warn("[Security] WEB_PASSWORD is still the example value \"change-me\" – please set your own password.");
  }
});
