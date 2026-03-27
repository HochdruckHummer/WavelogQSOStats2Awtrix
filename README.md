# WavelogQSOStats2Awtrix – Display your Wavelog QSO Stats on Awtrix
WavelogQSOStats2Awtrix is a Node.js application that fetches your Wavelog QSO statistics and displays them on an Awtrix LED clock. Configure station IDs, API key, modes, icons, and display duration via a responsive web interface. Automatically updates stats, caches data, and cycles them on Awtrix for near-real-time log monitoring.

## ✨ Features
Fetch Wavelog QSO statistics using WordPress API endpoint
Display Total QSOs, QSOs this year, SSB, FM, CW, FT8, FT4, sum of FT8/FT4, PSK, JS8, and total digital modes
Configurable modes and icons per mode (e.g., handheld radio icon for FM)
Responsive web interface for configuration and mode management
Automatic caching of data and cyclic push to Awtrix
Test API connection and view all current QSO totals
Upload of suitable Icons to the Awtrix device directly from the web interface
Built with Node.js, Express, and simple web interface:

<img width="1313" height="736" alt="Screenshot WavelogQSOStats2Awtrix" src="https://github.com/user-attachments/assets/d497979a-0b0e-45a7-8499-b7c3b147b948" />


## 🖥️ Prerequisites
* Wavelog account with API access (Wavelog WP API)

* Ulanzi TC001 Pixel-Clock [Ulanzi TC001 Pixel-Clock (Amazon Affiliate Link)](https://geni.us/ulanzi-pixelclock) flashed with [Awtrix firmware](https://github.com/Blueforcer/awtrix3)

* Node.js v24+ installed on your computer or server
## 🚀 Installation and Setup
1. Clone the repository
```   
git clone https://github.com/HochdruckHummer/WavelogQSOStats2Awtrix.git
```
```
cd WavelogQSOStats2Awtrix
```
2. Install dependencies
```
npm install
```
3. Configure the application
   
Setting up everything in the web interface will automatically create a config.json in the project folder:
```
{
  "wavelogBaseUrl": "https://wavelog.demourl.com",
  "apiKey": "wleba8b12345678",
  "stationIds": [
    "01",
    "11"
  ],
  "awtrixUrl": "192.168.1.50",
  "fetchInterval": 300,
  "displayItems": [
    {
      "key": "totalQso",
      "text1": "Total",
      "text2": "QSOs",
      "icon": "wavelog",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "totalQsoYear",
      "text1": "Year",
      "text2": "QSOs",
      "icon": "year",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "FT8",
      "text1": "FT8",
      "text2": "QSOs",
      "icon": "ft8",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "FT4",
      "text1": "FT4",
      "text2": "QSOs",
      "icon": "ft4",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "ft8ft4",
      "text1": "FT8/FT4",
      "text2": "QSOs",
      "icon": "ft8ft4",
      "duration": 10,
      "enabled": false
    },
    {
      "key": "CW",
      "text1": "CW",
      "text2": "QSOs",
      "icon": "key",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "SSB",
      "text1": "SSB",
      "text2": "QSOs",
      "icon": "ssbwave",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "FM",
      "text1": "FM",
      "text2": "QSOs",
      "icon": "radioblue",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "PSK",
      "text1": "PSK",
      "text2": "QSOs",
      "icon": "psk31",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "JS8",
      "text1": "JS8",
      "text2": "QSOs",
      "icon": "js8",
      "duration": 10,
      "enabled": false
    },
    {
      "key": "RTTY",
      "text1": "RTTY",
      "text2": "QSOs",
      "icon": "rtty",
      "duration": 10,
      "enabled": true
    },
    {
      "key": "digi",
      "text1": "Digi",
      "text2": "QSOs",
      "icon": "digi",
      "duration": 10,
      "enabled": true
    }
  ]
}
```

* wavelogBaseUrl: Only the base URL of your Wavelog site (the app appends /index.php/api/get_wp_stats automatically)
* apiKey: Your read-only Wavelog API key
* stationIds: Array of station IDs to query
* awtrixUrl: IP of your Awtrix clock
* fetchInterval: How often Wavelog is queried (seconds)
* pushInterval: How often stats are sent to Awtrix (seconds)
* displayItems: Modes, labels, icons, active status, and duration in seconds

## 🖥️ Running the App
Start the Node.js server:
```
node WavelogQSOStats2Awtrix.js
```
Open in your browser:
http://localhost:3000

## Web Interface Features
Edit Configuration: Set Wavelog URL, API key, station IDs, Awtrix IP
Manage Modes: Enable/disable modes, assign icons, set display duration
Test API: Verify connection and fetch current QSO totals, displayed under the test button
Upload of suitable icons to the Awtrix device directly from the web interface to the Awtrix' /ICON/ folder

## 🔁 Automatic Updates
The app fetches data from Wavelog at the interval specified (fetchInterval)
Displays are pushed to Awtrix cyclically every pushInterval
Each enabled mode is displayed for its configured duration with its assigned icon

##  Support the development

Did this application help you?
If you like, you can send me a beer via PayPal:

<a href="https://paypal.me/DanielBeckemeier" target="_blank" rel="nofollow sponsored noopener">
  <img
    width="300"
    height="50"
    alt="Donate a beer"
    src="https://github.com/user-attachments/assets/7c223db3-f267-447e-9207-4fe1cc72f829"
  />
</a>

## 🛠️ Notes
Awtrix must be flashed with the firmware linked above
Icons must exist on the Awtrix device, see Folder "AmateurRadioIcons" in this repository. Make shure to send them to your Awtrix device with only one click from the web interface.
The app caches the latest QSO stats and cycles them without re-fetching them on every push.

## 📜 License
This project is licensed under the MIT License.

## 📡 Author
Created by DL8YDP – pull requests and contributions are welcome!
