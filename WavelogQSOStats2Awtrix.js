// WavelogQSOStats2Awtrix.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;
const configFile = path.join(__dirname, 'config.json');

// ─── Default Configuration ────────────────────────────────────────────────────

const defaultConfig = {
  wavelogBaseUrl: "",
  apiKey: "",
  stationIds: [],
  awtrixUrl: "",
  fetchInterval: 600,
  displayItems: [
    { key: "totalQso",     text1: "Total",    text2: "QSOs", icon: "wavelog",  duration: 10, enabled: true,  effect: "" },
    { key: "totalQsoYear", text1: "Year",     text2: "QSOs", icon: "year",     duration: 10, enabled: true,  effect: "" },
    { key: "FT8",          text1: "FT8",      text2: "QSOs", icon: "ft8",      duration: 10, enabled: false, effect: "" },
    { key: "FT4",          text1: "FT4",      text2: "QSOs", icon: "ft4",      duration: 10, enabled: false, effect: "" },
    { key: "ft8ft4",       text1: "FT8/FT4",  text2: "QSOs", icon: "ft8ft4",   duration: 10, enabled: true,  effect: "" },
    { key: "CW",           text1: "CW",       text2: "QSOs", icon: "key",      duration: 10, enabled: true,  effect: "" },
    { key: "SSB",          text1: "SSB",      text2: "QSOs", icon: "ssbwave",  duration: 10, enabled: true,  effect: "" },
    { key: "FM",           text1: "FM",       text2: "QSOs", icon: "radioblue",duration: 10, enabled: false, effect: "" },
    { key: "PSK",          text1: "PSK",      text2: "QSOs", icon: "psk31",    duration: 10, enabled: false, effect: "" },
    { key: "JS8",          text1: "JS8",      text2: "QSOs", icon: "js8",      duration: 10, enabled: false, effect: "" },
    { key: "RTTY",         text1: "RTTY",     text2: "QSOs", icon: "rtty",     duration: 10, enabled: false, effect: "" },
    { key: "digi",         text1: "Digi",     text2: "QSOs", icon: "digi",     duration: 10, enabled: false, effect: "" }
  ]
};

// ─── Config Helpers ───────────────────────────────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
    return JSON.parse(JSON.stringify(defaultConfig));
  }
  try {
    const loaded = JSON.parse(fs.readFileSync(configFile, 'utf8'));

    // Scalar fields: take from file if present, else use default
    const merged = Object.assign({}, defaultConfig, loaded);

    // Valid keys are exactly what defaultConfig defines — nothing else
    const validKeys   = new Set(defaultConfig.displayItems.map(d => d.key));
    const defaultsByKey = Object.fromEntries(defaultConfig.displayItems.map(d => [d.key, d]));

    // 1. Keep saved items in SAVED ORDER, strip unknown keys
    const kept = (loaded.displayItems || []).filter(i => validKeys.has(i.key));

    // 2. Merge each saved item with its defaults (saved values win)
    const merged_items = kept.map(saved => ({ ...defaultsByKey[saved.key], ...saved }));

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
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── REST API ─────────────────────────────────────────────────────────────────

// GET /api/config
app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

// POST /api/save
app.post('/api/save', (req, res) => {
  const config = loadConfig();
  const body = req.body;

  config.wavelogBaseUrl = (body.wavelogBaseUrl || "").trim();
  config.apiKey         = (body.apiKey || "").trim();
  config.stationIds     = Array.isArray(body.stationIds) ? body.stationIds.map(s => String(s).trim()).filter(Boolean) : [];
  config.awtrixUrl      = (body.awtrixUrl || "").trim();
  config.fetchInterval  = Math.max(10, Number(body.fetchInterval) || 600);

  if (Array.isArray(body.displayItems)) {
    // Replace displayItems entirely (preserves re-ordering from UI)
    config.displayItems = body.displayItems.map(item => ({
      key:      item.key,
      text1:    (item.text1 ?? "").trim(),
      text2:    (item.text2 ?? "").trim(),
      icon:     (item.icon || "").trim(),
      duration: Math.max(1, Number(item.duration) || 10),
      enabled:  item.enabled !== false,
      effect:   (item.effect || "").trim()
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
    res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, message: "API Test failed: " + err.message });
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
    res.status(500).json({ success: false, message: "Push failed: " + err.message });
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
      await axios.post(
        `http://${config.awtrixUrl}/api/custom?name=wavelog_${key}`,
        {},
        { timeout: 5000 }
      );
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

  const files = fs.readdirSync(iconsDir).filter(f => /\.(jpg|jpeg|gif|png)$/i.test(f));
  if (!files.length) {
    return res.status(404).json({ success: false, message: "No icon files found in AmateurRadioIcons/" });
  }

  const UPLOAD_TIMEOUT_MS = 30000;  // 30s per file – generous for slow ESP32 WLAN
  const PAUSE_BETWEEN_MS  = 300;    // 300ms pause so ESP32 can breathe

  const results = [];
  for (const filename of files) {
    const filePath = path.join(iconsDir, filename);
    const fileData = fs.readFileSync(filePath);
    const fileSizeKb = (fileData.length / 1024).toFixed(1);
    const mime     = filename.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg';

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
        `http://${config.awtrixUrl}/edit`,
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

async function fetchStats(config) {
  const baseUrl  = config.wavelogBaseUrl.replace(/\/$/, "");
  const apiUrl   = `${baseUrl}/index.php/api/get_wp_stats`;
  const apiKey   = config.apiKey;

  const stats = {
    totalQso: 0, totalQsoYear: 0,
    SSB: 0, FM: 0, RTTY: 0,
    FT8: 0, FT4: 0, ft8ft4: 0, PSK: 0, CW: 0, JS8: 0, digi: 0
  };

  for (const stationId of config.stationIds) {
    try {
      const response = await axios.post(
        apiUrl,
        { key: apiKey, station_id: stationId },
        { timeout: 15000 }
      );
      const body = response.data;
      if (!body || body.status !== "successful") {
        console.warn(`Station ${stationId}: unexpected response status`, body?.status);
        continue;
      }

      stats.totalQso     += Number(body.statistics?.totalalltime?.[0]?.count  || 0);
      stats.totalQsoYear += Number(body.statistics?.totalthisyear?.[0]?.count || 0);

      for (const mode of (body.statistics?.totalgroupedmodes || [])) {
        if (!mode) continue;
        const m   = (mode.col_mode    || '').toUpperCase();
        const sub = (mode.col_submode || '').toUpperCase();
        const cnt = Number(mode.count || 0);

        if      (m === 'SSB')                           stats.SSB  += cnt;
        else if (m === 'FM')                            stats.FM   += cnt;
        else if (m === 'RTTY')                          stats.RTTY += cnt;
        else if (m === 'CW')                            stats.CW   += cnt;
        else if (m === 'PSK' || sub.startsWith('PSK'))  stats.PSK  += cnt;
        else if (m === 'JS8')                           stats.JS8  += cnt;
        else if (m === 'FT8')                           { stats.FT8 += cnt; stats.ft8ft4 += cnt; }
        else if (m === 'FT4' || sub === 'FT4')          { stats.FT4 += cnt; stats.ft8ft4 += cnt; }
      }
    } catch (err) {
      console.error(`Failed to fetch stats for station ${stationId}:`, err.message);
    }
  }

  // digi = FT8 + FT4 + PSK + JS8  (exactly these four, nothing else)
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
        `http://${config.awtrixUrl}/api/custom?name=${appName}`,
        {
          text,
          icon:     item.icon || '',
          color:    "#FFFFFF",
          duration: item.duration || 10,
          lifetime: (config.fetchInterval || 600) * 2,
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
    const response = await axios.get(`http://${config.awtrixUrl}/api/effects`, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    console.error("[Effects] Failed to fetch effects:", err.message);
    res.status(500).json({ success: false, message: "Could not reach Awtrix: " + err.message });
  }
});

// ─── Startup Clear Helper ────────────────────────────────────────────────────

async function clearAllWavelogApps(config) {
  const keys = [
    'totalQso', 'totalQsoYear', 'FT8', 'FT4', 'ft8ft4',
    'CW', 'SSB', 'FM', 'PSK', 'JS8', 'RTTY', 'digi',
  ];
  for (const key of keys) {
    try {
      await axios.post(
        `http://${config.awtrixUrl}/api/custom?name=wavelog_${key}`,
        {},
        { timeout: 3000 }
      );
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
      console.error("[Loop] Cycle error:", err.message);
    }

    await sleep((config.fetchInterval || 600) * 1000);
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

app.listen(PORT, () => {
  console.log(`WavelogQSOStats2Awtrix running at http://localhost:${PORT}`);
});
