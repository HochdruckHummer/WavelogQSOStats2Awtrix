# WavelogQSOStats2Awtrix – Display your Wavelog QSO Stats on Awtrix Pixel Clocks

WavelogQSOStats2Awtrix is a Node.js application that fetches your Wavelog QSO statistics and displays them on an Awtrix LED clock. Configure station IDs, API key, modes, icons, and display duration via a responsive web interface. Automatically updates stats and cycles them on Awtrix for near-real-time log monitoring.

<img width="1313" height="736" alt="Screenshot WavelogQSOStats2Awtrix" src="https://github.com/user-attachments/assets/d497979a-0b0e-45a7-8499-b7c3b147b948" />

---

## ✨ Features

* Fetch Wavelog QSO statistics using the Wavelog WP API
* Display Total QSOs, QSOs this year, FT8, FT4, FT8/FT4 combined, CW, SSB, FM, PSK, JS8, RTTY, and a configurable Digi total
* Configurable modes and icons per mode
* Responsive web interface for configuration and mode management
* Test API connection and view all current QSO totals directly in the web interface
* Upload amateur radio icons to the Awtrix device with a single click
* Clear stale Awtrix apps with a single click
* Auto-restart on crash, config is re-read on every cycle – no restart needed after changes
* Built with Node.js and Express

---

## 🖥️ Prerequisites

* A running [Wavelog](https://github.com/wavelog/wavelog) instance with API access enabled
* A [Ulanzi TC001 Pixel Clock](https://geni.us/ulanzi-pixelclock) *(Amazon Affiliate Link)* flashed with [Awtrix3 firmware](https://github.com/Blueforcer/awtrix3)
* One of the following to run the app:
  * Node.js v18 or newer, **or**
  * Docker / Docker Compose, **or**
  * Portainer (e.g. on a Synology NAS)

---

## 🚀 Installation

### Option A – Node.js (classic)

1. Clone the repository
```bash
git clone https://github.com/HochdruckHummer/WavelogQSOStats2Awtrix.git
cd WavelogQSOStats2Awtrix
```

2. Install dependencies
```bash
npm install
```

3. Start the app
```bash
node WavelogQSOStats2Awtrix.js
```

4. Open the web interface in your browser and configure everything there:
```
http://localhost:3000
```

A `config.json` is created automatically on first start.

---

### Option B – Docker Compose

No Node.js installation required.

1. Clone the repository
```bash
git clone https://github.com/HochdruckHummer/WavelogQSOStats2Awtrix.git
cd WavelogQSOStats2Awtrix
```

2. Start the container
```bash
docker compose up -d
```

3. Open the web interface:
```
http://localhost:3000
```

The `config.json` is stored on your host machine and survives container updates.

To update to the latest version later:
```bash
docker compose pull && docker compose up -d
```

---

### Option C – Portainer / Synology NAS (no terminal needed)

1. Open Portainer → **Stacks** → **Add Stack**
2. Give it a name, e.g. `wavelog-awtrix`
3. Select **Web editor** and paste the following:

```yaml
services:
  wavelog-awtrix:
    image: ghcr.io/hochdruckhummer/wavelogqsostats2awtrix:latest
    container_name: wavelog-awtrix
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./config.json:/app/config.json
```

4. Click **Deploy the stack**
5. Open the web interface on port 3000 of your NAS:
```
http://<your-nas-ip>:3000
```

To update: Portainer → Stacks → `wavelog-awtrix` → **Pull and redeploy**

---

## ⚙️ Configuration

Everything is configurable through the web interface. The settings are saved to `config.json` automatically. Here is an overview of the available fields:

| Field | Description |
|---|---|
| `wavelogBaseUrl` | Base URL of your Wavelog instance, e.g. `https://wavelog.example.com` |
| `apiKey` | Your Wavelog API key (found under User Settings in Wavelog) |
| `stationIds` | Array of station IDs to query, e.g. `["01", "11"]` |
| `awtrixUrl` | Local IP address of your Awtrix clock, e.g. `192.168.1.50` |
| `fetchInterval` | How often Wavelog is queried and stats pushed to Awtrix (in seconds) |
| `displayItems` | List of modes: label, icon name, duration, and enabled/disabled |

Example `config.json`:

```json
{
  "wavelogBaseUrl": "https://wavelog.example.com",
  "apiKey": "your-api-key",
  "stationIds": ["01", "11"],
  "awtrixUrl": "192.168.1.50",
  "fetchInterval": 300,
  "displayItems": [
    { "key": "totalQso",     "text1": "Total",   "text2": "QSOs", "icon": "wavelog",  "duration": 10, "enabled": true  },
    { "key": "totalQsoYear", "text1": "Year",    "text2": "QSOs", "icon": "year",     "duration": 10, "enabled": true  },
    { "key": "FT8",          "text1": "FT8",     "text2": "QSOs", "icon": "ft8",      "duration": 10, "enabled": true  },
    { "key": "FT4",          "text1": "FT4",     "text2": "QSOs", "icon": "ft4",      "duration": 10, "enabled": true  },
    { "key": "ft8ft4",       "text1": "FT8/FT4", "text2": "QSOs", "icon": "ft8ft4",  "duration": 10, "enabled": false },
    { "key": "CW",           "text1": "CW",      "text2": "QSOs", "icon": "key",      "duration": 10, "enabled": true  },
    { "key": "SSB",          "text1": "SSB",     "text2": "QSOs", "icon": "ssbwave",  "duration": 10, "enabled": true  },
    { "key": "FM",           "text1": "FM",      "text2": "QSOs", "icon": "radioblue","duration": 10, "enabled": false },
    { "key": "PSK",          "text1": "PSK",     "text2": "QSOs", "icon": "psk31",    "duration": 10, "enabled": false },
    { "key": "JS8",          "text1": "JS8",     "text2": "QSOs", "icon": "js8",      "duration": 10, "enabled": false },
    { "key": "RTTY",         "text1": "RTTY",    "text2": "QSOs", "icon": "rtty",     "duration": 10, "enabled": false },
    { "key": "digi",         "text1": "Digi",    "text2": "QSOs", "icon": "digi",     "duration": 10, "enabled": false }
  ]
}
```

---

## 🖱️ Web Interface Features

| Button | Function |
|---|---|
| **Save Configuration** | Saves all settings to `config.json` |
| **Test Wavelog API** | Fetches current stats and displays them in the mode table |
| **Push to Awtrix Now** | Immediately pushes current stats to the clock |
| **Upload Icons to Awtrix** | Uploads all icons from `AmateurRadioIcons/` to the clock's `/ICONS/` folder |
| **Clear all Awtrix Apps** | Removes all `wavelog_*` apps from the clock, including stale ones from older versions |

The mode table shows all configured modes with their labels, icon name, display duration, on/off toggle, and the live QSO count after a test or push. Rows can be **dragged to reorder** the display sequence on the clock.

---

## 🔁 How Updates Work

The app runs a continuous background loop:

1. Reads the current config (picks up any changes saved in the UI without a restart)
2. Fetches QSO statistics from Wavelog
3. Pushes each enabled mode as a named custom app to Awtrix
4. Waits for `fetchInterval` seconds, then repeats

Each Awtrix app has a `lifetime` of `2 × fetchInterval` seconds. If the server stops, the displays disappear from the clock automatically after that time.

---

## 🎨 Icons

A set of amateur radio icons sized for Awtrix is included in the `AmateurRadioIcons/` folder. Use the **Upload Icons to Awtrix** button in the web interface to transfer them to your clock in one step.

Icon names used in the default configuration:

| Icon file | Used for |
|---|---|
| `wavelog` | Total QSOs |
| `year` | QSOs this year |
| `ft8`, `ft4`, `ft8ft4` | FT8, FT4, combined |
| `key` | CW |
| `ssbwave` | SSB |
| `radioblue` | FM |
| `psk31` | PSK |
| `js8` | JS8 |
| `rtty` | RTTY |
| `digi` | Digi total |

---

## 🛠️ Notes

* Awtrix must be running firmware v0.96 or newer – see [Awtrix3 on GitHub](https://github.com/Blueforcer/awtrix3)
* The Wavelog API key needs at least read access; a read-only key is sufficient
* Multiple station IDs are supported – stats are summed across all configured stations
* The `digi` total is calculated as FT8 + FT4 + PSK + JS8 + RTTY

---

## 💛 Support the Development

Did this application help you? If you like, you can send me a beer via PayPal:

<a href="https://paypal.me/DanielBeckemeier" target="_blank" rel="nofollow sponsored noopener">
  <img
    width="300"
    height="50"
    alt="Donate a beer"
    src="https://github.com/user-attachments/assets/7c223db3-f267-447e-9207-4fe1cc72f829"
  />
</a>

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

## 📡 Author

Created by **Daniel Beckemeier, DL8YDP** – pull requests and contributions are welcome!
