# ⚡ CYBERPULSE - Gaming Lounge & Cyber Cafe Management System

**CyberPulse** is an enterprise-grade, real-time gaming arena & esports cyber cafe management software designed for Windows and Diskless (CCBoot) networks. It provides centralized cashier control, automated station locking, live screen surveillance, power management (Wake-on-LAN), cafeteria POS, game distribution, and direct MikroTik router integration with selective gaming VPN tunneling.

---

## 🚀 Key Highlights & Features

### 🖥️ 1. Central Admin & Cashier Dashboard
* **Dynamic Curved RGB Monitors:** High-end SVG curved monitor display units reflecting real-time PC state (Available, In Session, Warning, Locked, Offline) with tailored solid underglow lighting.
* **Smart Device Multi-Select (Windows Explorer Style):**
  * **Single Click:** Selects an individual PC and deselects others.
  * **Ctrl + Click:** Toggles individual PCs into or out of the selection.
  * **Shift + Click:** Range-selects all consecutive PCs between two points.
  * **Background Deselect:** Clicking on any empty space or between two machines cancels selection instantly.
* **Power Hub Quick Actions:**
  * **WOL Select:** Broadcasts standard Wake-on-LAN Magic Packets (UDP port 9) to wake sleeping stations remotely.
  * **Restart:** Gracefully restarts selected machines over WebSocket.
  * **Shutdown Select:** Instantly shuts down selected machines over WebSocket.
  * **Shutdown Idle:** One-click power-saving action to automatically shut down all machines that have been idle past threshold.
* **View Modes System (8 Explorer Views):**
  * Extra Large Icons, Large Icons, Medium Icons, Small Icons, List View, Details, Tiles, Content.
* **Live Surveillance Wall:** Real-time screen feeds from all active client stations to monitor gameplay, prevent cheating, and detect unauthorized apps.
* **Cafeteria POS & Stock Control:** Live snack ordering system linked directly to client machines with instantaneous billing.
* **Games Hub & Cloud Sync:** Add, edit, or launch titles (Valorant, CS2, League of Legends, GTA V, Roblox, etc.) across all client machines simultaneously.
* **Shifts, Invoices & Audit Trail:** Full drawer tracking, revenue breakdowns (gaming vs. cafe), shift closing reports, and security logs.
* **Master Lock & Settings:** PIN/password protected master dashboard lock with full visual customization.

---

### 🌐 2. Advanced MikroTik RouterOS & Selective Gaming VPN Engine
Specially tailored for **CCBoot Diskless** environments and Egyptian ISP blockades (Telecom Egypt / WE / Vodafone):

* **Zero-Client Installation (Diskless Safe):** No virtual network adapters (TAP/TUN) or DNS/Gateway modifications on client PCs. Completely prevents BSOD (0x7B) and iSCSI CCBoot network disconnects.
* **Low-Latency European SSTP Tunnel:**
  * Active Server: `150.40.105.17:443` (Southern Europe / Croatia, ~37ms – 86ms ping, 0% packet loss).
  * Encapsulated over TCP 443 (HTTPS) to easily bypass Egyptian deep packet inspection (DPI).
* **Unblocked Blocked Games & Voice Protocols:**
  * **Roblox:** Unblocks all dynamic CDN download servers (`setup.rbxcdn.com`, Akamai Anycast, AWS S3), authentication, matchmaking, and in-game Agora.io voice chat.
  * **Valorant Vivox Voice Chat:** Unblocks voice clusters (`20.0.0.0/8`, `188.42.95.0/24`, `185.180.12.0/22`) while keeping matchmaking and game servers on direct Egyptian fiber (35ms ping to Bahrain/Frankfurt).
* **Smart `DIRECT-WAN-BYPASS` (Dual-Path Traffic):**
  * **Google, Gemini, YouTube, Facebook, and Speedtest** bypass the VPN completely and exit through the local high-speed fiber line.
  * Result: **Zero Google captchas, zero Gemini blocks, 4K YouTube playback, and full ISP bandwidth.**
* **Local LAN Bypass (`10.10.10.0/24`):** Guarantees that local CCBoot iSCSI storage traffic and router DNS lookups remain 100% direct on LAN with 0.1ms latency.
* **MTU / MSS Clamping (`1360`):** Eliminates packet fragmentation and SSL/TLS black holes on large game updates and web launchers.
* **Desktop Controller (`MikroTik-VPN-Manager.exe`):**
  * Compiled standalone C# .NET WinForms executable located on Cashier Desktop.
  * 1-click station toggle into/out of `GAMING-VPN`.
  * Auto-reads router configuration from `mikrotik_vpn_settings.ini`.

---

### 🕹️ 3. Client Station (Desktop Kiosk & Launcher)
* **Smart Lock Screen:** Prevents customer access until unlocked from the cashier desk or via membership PIN code.
* **Tamper-Proof Kiosk Mode:**
  * Blocks `Alt + F4`, `Ctrl + W`, `Ctrl + R`, `F11`, and Windows keys.
  * Disables Windows Task Manager and registry editing tools during session lock.
  * Runs automatically on Windows boot via registry startup entry.
* **Emergency Admin Bypass:**
  * Shortcut: `Ctrl + Alt + Shift + F12`
  * Default Master Password: `admin`
* **In-Session Gaming HUD:**
  * Live remaining countdown timer and accumulated cost tracker.
  * Food and beverage ordering modal delivered directly to the station desk.
  * Staff call buzzer button with instant cashier audio chime.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Server Backend** | Node.js (v26), Express.js, Socket.IO, `net` Socket API |
| **Cashier Dashboard** | HTML5, Vanilla JavaScript, CSS3 (Cyberpunk Theme), Inter & Orbitron Fonts |
| **Client Application** | Electron.js Desktop Kiosk, HTML5 Canvas Capture, WebSockets |
| **Network Engine** | MikroTik RouterOS v6.49.10 API (Port 8728), SSTP Tunneling, Mangle Routing |
| **Desktop Tool** | C# .NET WinForms standalone GUI (`MikroTik-VPN-Manager.exe`) |
| **Audio Engine** | Web Audio API Synthetic Synthesizer (Zero external audio file dependencies) |
| **Data Storage** | Local JSON File Database (`data/database.json`, `cyber_data.json`) with auto-persistence |

---

## 📂 Project Directory Structure

```text
d:\Projects\Cyber Management\
├── server.js                      # Central Node.js HTTP & Socket.IO & MikroTik API Server
├── package.json                   # Project dependencies and startup scripts
├── start-server.bat               # One-click cashier server startup launcher
├── ALLOW-FIREWALL.bat             # Automatically opens ports 4000, 8728, 9 in Windows Firewall
├── DEPLOY-ALL-CLIENTS.bat         # Automated remote deployment for 20 client stations
├── README.md                      # System documentation & manual
├── CHECKPOINT.md                  # State snapshot & quick restoration guide
├── data\
│   └── database.json              # Central database (PCs, sessions, cafeteria menu, games, audit)
├── public\
│   ├── index.html                 # Central Cashier Dashboard UI
│   ├── admin.js                   # Dashboard reactive controller & socket client
│   ├── admin.css                  # Cyberpunk dark/light design system
│   ├── vpn-tool.html              # Web-based MikroTik Gaming VPN Manager
│   ├── client.html                # Client lock screen & gaming launcher UI
│   ├── client.js                  # Client launcher controller
│   ├── client.css                 # Launcher styling
│   └── audio.js                   # Web Audio API sound effects generator
├── tools\
│   ├── MikroTikVpnManager.cs      # Standalone C# .NET VPN Controller source code
│   └── mikrotik_vpn_settings.ini  # Connection settings (Host, Port, User, Password, List)
└── client\
    ├── main.js                    # Electron kiosk main process with anti-tampering
    ├── config.json                # Station config (Server URL, PC ID, master password)
    ├── install-client.bat         # Station setup wizard & Windows startup installer
    ├── START-CLIENT.bat           # Desktop client launcher
    ├── lockdown-windows.bat       # Windows policy security lockdown script
    └── unlock-windows.bat         # Windows policy restoration script
```

---

## 🚦 Quick Start Guide

### Step 1: Starting the Central Server (Cashier PC)
1. Double-click `start-server.bat` or run in terminal:
   ```powershell
   & "C:\Program Files\nodejs\node.exe" server.js
   ```
2. Open the Cashier Dashboard in any browser:
   ```
   http://localhost:4000
   ```

### Step 2: Managing Gaming VPN for Any Station
1. Open `MikroTik-VPN-Manager.exe` directly from your Desktop (`C:\Users\Jumanji\Desktop\MikroTik-VPN-Manager.exe`).
2. Type or select the station IP (e.g. `10.10.10.115`).
3. Click **"تفعيل وضع الجيمنج (Gaming VPN)"** to instantly route gaming traffic through the low-latency European tunnel.
4. Click **"إلغاء التفعيل (Direct WAN)"** to restore 100% normal fiber routing.

---

## 🔐 Credentials & Default Ports

* **Cashier Server Port:** `4000` (`http://10.10.10.100:4000`)
* **MikroTik Router IP:** `10.10.10.1` (API Port: `8728`, Web/Winbox: `admin` / `0184255`)
* **Default Admin Master Password:** `admin`
* **Emergency Exit Shortcut (Client):** `Ctrl + Alt + Shift + F12`
