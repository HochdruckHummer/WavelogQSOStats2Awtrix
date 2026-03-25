# WavelogQSOStats2Awtrix – Display your Wavelog QSO Stats on Awtrix
WavelogQSOStats2Awtrix is a Node.js application that fetches your Wavelog QSO statistics and displays them on an Awtrix LED clock. Configure station IDs, API key, modes, icons, and display duration via a responsive web interface. Automatically updates stats, caches data, and cycles them on Awtrix for real-time ham radio monitoring.

## ✨ Features
Fetch Wavelog QSO statistics using WordPress API endpoint
Display Total QSOs, QSOs this year, SSB, FM, CW, FT8/FT4, PSK, JS8, and total digital modes
Configurable modes and icons per mode (e.g., handheld radio icon for FM)
Responsive web interface for configuration and mode management
Automatic caching of data and cyclic push to Awtrix
Test API connection and view all current QSO totals
Built with Node.js, Express, and simple web interface
## 🖥️ Prerequisites
* Wavelog account with API access (Wavelog WP API)

* Ulanzi TC001 Pixel-Clock [Ulanzi TC001 Pixel-Clock](https://geni.us/ulanzi-pixelclock) flashed with [Awtrix firmware](https://github.com/Blueforcer/awtrix3)
* [AmateurRadioIcons from this repository](https://github.com/HochdruckHummer/WavelogQSOStats2Awtrix/tree/main/AmateurRadioIcons) uploaded to the Awtrix' /ICON/ folder

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
   
Create a config.json in the project folder:
```
{
  "wavelogBaseUrl": "https://wavelogurl.com",
  "apiKey": "YOUR_API_KEY_HERE",
  "stationIds": ["01", "11"],
  "awtrixUrl": "AWTRIX_IP",
  "fetchInterval": 300000,
  "pushInterval": 30000,
  "displayItems": [
    { "key": "totalQso", "label": "QSOs", "icon": "radio", "enabled": true, "duration": 10 },
    { "key": "FT8", "label": "FT8/4", "icon": "wifi", "enabled": true, "duration": 10 }
  ]
}
```

* wavelogBaseUrl: Only the base URL of your Wavelog site (the app appends /index.php/api/get_wp_stats automatically)
* apiKey: Your read-only Wavelog API key
* stationIds: Array of station IDs to query
* awtrixUrl: IP of your Awtrix clock
* fetchInterval: How often Wavelog is queried (ms)
* pushInterval: How often stats are sent to Awtrix (ms)
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
Icons must exist on the Awtrix device, see Folder "AmateurRadioIcons" in this repository
The app caches the latest QSO stats and cycles them without re-fetching on every push

## 📜 License
This project is licensed under the MIT License.

## 📡 Author
Created by DL8YDP – pull requests and contributions are welcome!
