const { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const io = require('socket.io-client');

// Read Configuration
const configPath = path.join(__dirname, 'config.json');
let config = {
  serverUrl: 'http://localhost:4000',
  pcId: 'PC-01',
  adminUnlockPassword: 'admin',
  autoStartOnBoot: true,
  kioskMode: true,
  preventClosing: true
};

if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Failed to parse config.json, using defaults', e);
  }
}

let mainWindow = null;
let isAuthorizedExit = false;
let socket = null;
let currentActiveProcess = null;
let isLocked = true;

// Auto-start on Windows Boot
if (config.autoStartOnBoot) {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: ['--kiosk']
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: config.kioskMode,
    alwaysOnTop: isLocked, // Always on top when locked
    frame: false,
    skipTaskbar: isLocked,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Load Client UI directly from Server or Local Fallback
  const clientUrl = `${config.serverUrl}/client.html?pc=${config.pcId}`;
  mainWindow.loadURL(clientUrl).catch(() => {
    // If server isn't reached yet, retry
    setTimeout(() => mainWindow.loadURL(clientUrl), 3000);
  });

  // -----------------------------------------------------------
  // 1. PREVENT CLOSING & TAMPERING (tamper-proof lock)
  // -----------------------------------------------------------
  mainWindow.on('close', (e) => {
    if (config.preventClosing && !isAuthorizedExit) {
      e.preventDefault();
      console.log('Unauthorized close attempt blocked!');
    }
  });

  // Register Global Shortcuts to Block Alt+F4, Ctrl+W, Ctrl+R
  app.on('browser-window-focus', () => {
    globalShortcut.register('Alt+F4', () => {
      console.log('Blocked Alt+F4');
    });
    globalShortcut.register('CommandOrControl+W', () => {
      console.log('Blocked Ctrl+W');
    });
    globalShortcut.register('CommandOrControl+R', () => {
      console.log('Blocked reload');
    });
    globalShortcut.register('F11', () => {
      console.log('Blocked F11');
    });

    // Secret Emergency Admin Exit Shortcut: Ctrl+Alt+Shift+F12
    globalShortcut.register('CommandOrControl+Alt+Shift+F12', () => {
      mainWindow.webContents.executeJavaScript(`
        const pass = prompt('Enter Admin master password to exit:');
        if (pass) {
          require('electron').ipcRenderer.send('admin-emergency-exit', pass);
        }
      `);
    });
  });

  // -----------------------------------------------------------
  // 2. CONNECT TO CYBER SERVER & STREAM REAL WINDOWS DESKTOP
  // -----------------------------------------------------------
  initSocketConnection();

  // -----------------------------------------------------------
  // 3. BACKGROUND DESKTOP SCREEN CAPTURE (Real screen monitoring)
  // -----------------------------------------------------------
  setInterval(async () => {
    try {
      if (!socket || !socket.connected) return;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 960, height: 540 }
      });

      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail.toJPEG(60);
        const base64Image = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;

        socket.emit('screen_frame', {
          pcId: config.pcId,
          image: base64Image,
          activeWindow: isLocked ? 'Locked Screen' : (currentActiveProcess ? currentActiveProcess.name : 'Desktop')
        });
      }
    } catch (err) {
      // Ignore background capture errors
    }
  }, 400); // 2.5 frames per second live background monitor
}

function initSocketConnection() {
  socket = io(config.serverUrl);

  socket.on('connect', () => {
    console.log(`[CyberClient] Connected to Server at ${config.serverUrl} as ${config.pcId}`);
    socket.emit('register_role', { role: 'client', pcId: config.pcId });
  });

  // When session starts from cashier
  socket.on('session_started', () => {
    isLocked = false;
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setKiosk(false);
    }
  });

  // When session ends or expired
  socket.on('session_closed', () => lockPc());
  socket.on('session_expired', () => lockPc());
  socket.on('remote_command', (data) => {
    if (data.action === 'lock') lockPc();
    if (data.action === 'unlock') {
      isLocked = false;
      if (mainWindow) mainWindow.setAlwaysOnTop(false);
    }
  });

  // Kill game on command
  socket.on('force_kill_game', () => {
    killActiveGames();
  });
}

function lockPc() {
  isLocked = true;
  killActiveGames();
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setKiosk(true);
    mainWindow.focus();
  }
}

function killActiveGames() {
  // Kill common game executables
  const gameExes = ['VALORANT.exe', 'cs2.exe', 'LeagueClient.exe', 'GTA5.exe', 'FiveM.exe', 'FortniteClient-Win64-Shipping.exe'];
  gameExes.forEach(exe => {
    exec(`taskkill /F /IM ${exe} /T`, () => {});
  });
  currentActiveProcess = null;
}

// -----------------------------------------------------------
// 4. IPC HANDLERS FOR NATIVE GAME LAUNCHING & ADMIN EXIT
// -----------------------------------------------------------
ipcMain.on('admin-emergency-exit', (event, enteredPassword) => {
  if (enteredPassword === config.adminUnlockPassword) {
    isAuthorizedExit = true;
    app.quit();
  } else {
    mainWindow.webContents.executeJavaScript("alert('Incorrect Admin password!');");
  }
});

// Launch Real Native Game from path
ipcMain.handle('launch-native-game', (event, gameId) => {
  const game = (config.installedGames || []).find(g => g.id === gameId);
  if (!game) return { error: 'Game not configured' };

  if (fs.existsSync(game.executable)) {
    try {
      const child = spawn(game.executable, game.args || [], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      currentActiveProcess = { id: game.id, name: game.name, pid: child.pid };
      if (socket) {
        socket.emit('game_launched', { pcId: config.pcId, gameTitle: game.name });
      }
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  } else {
    return { error: 'Game executable not found at specified path: ' + game.executable };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (!isAuthorizedExit) {
    createWindow(); // Relaunch if somehow closed
  } else {
    app.quit();
  }
});
