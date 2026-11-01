# ⚡ CYBERPULSE - Gaming Lounge & Cyber Cafe Management System

**CyberPulse** is an enterprise-grade, real-time gaming arena & esports cyber cafe management software designed for Windows. It provides centralized cashier control, automated station locking, live screen surveillance, power management (Wake-on-LAN), cafeteria POS, and game distribution.

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
  * **Shutdown Idle:** One-click power-saving action to automatically shut down all machines that have been idle past the threshold.
* **View Modes System (8 Explorer Views):**
  * Extra Large Icons, Large Icons, Medium Icons, Small Icons, List View, Details, Tiles, Content.
* **Live Surveillance Wall:** Real-time 10-15 FPS screen feeds from all active client stations to monitor gameplay, prevent cheating, and detect unauthorized apps.
* **Cafeteria POS & Stock Control:** Live snack ordering system linked directly to client machines with instantaneous billing.
* **Games Hub & Cloud Sync:** Add, edit, or launch titles (Valorant, CS2, League of Legends, GTA V, etc.) across all client machines simultaneously.
* **Shifts, Invoices & Audit Trail:** Full drawer tracking, revenue breakdowns (gaming vs. cafe), shift closing reports, and security logs.
* **Master Lock & Settings:** PIN/password protected master dashboard lock with full visual customization (Icon styles, themes, and sound effects).

---

### 🕹️ 2. Client Station (Desktop Kiosk & Launcher)
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
| **Server Backend** | Node.js, Express.js, Socket.IO, `wol` (Wake-on-LAN UDP) |
| **Cashier Dashboard** | HTML5, Vanilla JavaScript, CSS3 (Modern Cyberpunk Theme), Inter & Orbitron Fonts |
| **Client Application** | Electron.js Desktop Kiosk, HTML5 Canvas Capture, WebSockets |
| **Audio Engine** | Web Audio API Synthetic Synthesizer (Zero external audio file dependencies) |
| **Data Storage** | Local JSON File Database (`data/database.json`) with auto-persistence |

---

## 📂 Project Directory Structure

```text
d:\7oda\
├── server.js                   # Central Node.js HTTP & Socket.IO Server
├── package.json                # Project dependencies and startup scripts
├── start-server.bat            # One-click cashier server startup launcher
├── README.md                   # System documentation & manual
├── data\
│   └── database.json           # Central database (PCs, sessions, cafeteria menu, games, audit)
├── public\
│   ├── index.html              # Central Cashier Dashboard UI
│   ├── admin.js                # Dashboard reactive controller & socket client
│   ├── admin.css               # Cyberpunk dark/light design system
│   ├── client.html             # Client lock screen & gaming launcher UI
│   ├── client.js               # Client launcher controller
│   ├── client.css              # Launcher styling
│   └── audio.js                # Web Audio API sound effects generator
└── client\
    ├── main.js                 # Electron kiosk main process with anti-tampering
    ├── config.json             # Station config (Server URL, PC ID, master password)
    ├── install-client.bat      # Station setup wizard & Windows startup installer
    ├── run-client.bat          # Desktop client launcher
    ├── lockdown-windows.bat    # Windows policy security lockdown script
    └── unlock-windows.bat      # Windows policy restoration script
```

---

## 🚦 Quick Start Guide

### Step 1: Starting the Central Server (Cashier PC)
1. Run `start-server.bat` or open terminal and execute:
   ```bash
   npm start
   ```
2. Access the Cashier Dashboard in any web browser:
   ```
   http://localhost:4000
   ```

### Step 2: Configuring Client Machines (Player Stations)
1. On each client PC, run the setup wizard:
   ```cmd
   client\install-client.bat
   ```
2. Enter the **PC Name / ID** (e.g. `PC-01`, `PC-02`, `VIP-01`).
3. Enter the **Cashier Server IP** (e.g. `192.168.1.100`).
4. The installer will automatically:
   * Write `client/config.json`.
   * Disable Task Manager to prevent tampering.
   * Register auto-start on Windows boot.
   * Launch the full-screen kiosk lock screen.

---

## 🔐 Credentials & Default Ports

* **Default Server Port:** `4000`
* **Dashboard URL:** `http://localhost:4000`
* **Client Simulation URL:** `http://localhost:4000/client.html?pc=PC-01`
* **Default Admin Master Password:** `admin`
* **Emergency Exit Shortcut (Client):** `Ctrl + Alt + Shift + F12`
