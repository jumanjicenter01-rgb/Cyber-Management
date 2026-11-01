// Client Gaming Launcher & Lock Screen Controller
document.addEventListener('DOMContentLoaded', () => {
  // Get PC ID from URL query (?pc=PC-01) or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let pcId = urlParams.get('pc') || localStorage.getItem('cyberpulse_pc_id') || '';

  // State
  let pcState = null;
  let allGames = [];
  let currentCategory = 'all';
  let cart = [];
  let isStreamingToAdmin = false;
  let activeGame = null;
  let gameAnimationId = null;

  // DOM Elements
  const lockScreen = document.getElementById('lockScreen');
  const launcherScreen = document.getElementById('launcherScreen');
  const gameWindow = document.getElementById('gameWindow');

  // Lock elements
  const lockPcName = document.getElementById('lockPcName');
  const lockPcSpecs = document.getElementById('lockPcSpecs');
  const lockPcRate = document.getElementById('lockPcRate');
  const lockTime = document.getElementById('lockTime');
  const lockDate = document.getElementById('lockDate');

  // HUD elements
  const hudPcName = document.getElementById('hudPcName');
  const hudPcZone = document.getElementById('hudPcZone');
  const hudCustomerName = document.getElementById('hudCustomerName');
  const hudTimer = document.getElementById('hudTimer');
  const hudTotalCost = document.getElementById('hudTotalCost');
  const hudOrderCount = document.getElementById('hudOrderCount');

  // Canvas
  const gameCanvas = document.getElementById('gameCanvas');
  const gameCtx = gameCanvas.getContext('2d');
  const screenCaptureCanvas = document.getElementById('screenCaptureCanvas');
  const screenCaptureCtx = screenCaptureCanvas.getContext('2d');
  const adminCursor = document.getElementById('adminCursor');

  // Connect Socket.io with auto-reconnection
  const socket = io({
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity
  });

  // Security & Offline Resilience State
  let localWordFilter = null;
  const offlineViolations = [];
  const localFilterCooldowns = new Map();
  let offlineTicker = null;


  socket.on('connect', () => {
    console.log('Connected to Cyber Server, registering as:', pcId || 'Auto-Detect LAN');
    socket.emit('register_role', {
      role: 'client',
      pcId,
      pcName: pcId,
      hostname: pcId,
      specs: `${navigator.hardwareConcurrency || 8} Cores • Gaming Client`
    });

    // Stop offline ticker when reconnected to server
    if (offlineTicker) {
      clearInterval(offlineTicker);
      offlineTicker = null;
    }

    // If station was in an active session during server maintenance, sync played duration back to server
    if (pcState && pcState.status === 'in_session' && pcState.session) {
      socket.emit('client_sync_session_time', {
        pcId,
        elapsedSeconds: pcState.session.elapsedSeconds,
        remainingSeconds: pcState.session.remainingSeconds,
        expired: !!pcState.session.expired
      });
    }

    // Flush any security violations recorded offline during server maintenance
    while (offlineViolations.length > 0) {
      const v = offlineViolations.shift();
      socket.emit('client_reported_violation', { pcId, violation: v });
    }
  });

  socket.on('registered', (data) => {
    if (data && data.pcId) {
      pcId = data.pcId;
      localStorage.setItem('cyberpulse_pc_id', data.pcId);
      if (lockPcName) lockPcName.textContent = data.pcId;
      if (hudPcName) hudPcName.textContent = data.pcId;
    }
  });

  socket.on('disconnect', () => {
    console.warn('Server connection paused. Session running in offline resilience mode.');
    // Keep session alive locally without kicking the client or interrupting the game
    if (!offlineTicker) {
      offlineTicker = setInterval(() => {
        if (pcState && pcState.status === 'in_session' && pcState.session && !pcState.session.isPaused) {
          const s = pcState.session;
          s.elapsedSeconds = (s.elapsedSeconds || 0) + 1;

          if (s.type === 'fixed_time' || s.type === 'fixed_amount') {
            if (s.remainingSeconds !== null && s.remainingSeconds !== undefined) {
              s.remainingSeconds = Math.max(0, s.remainingSeconds - 1);
              if (s.remainingSeconds === 0 && !s.expired) {
                s.expired = true;
                pcState.status = 'locked';
                updatePcUI(pcState);
                if (window.cyberAudio) window.cyberAudio.playWarning();
                showAlertBanner('Time Expired!', 'Your session time has ended.');
              }
            }
          }
          updateTimerDisplay(s);
        }
      }, 1000);
    }
  });

  // -------------------------------------------------------------
  // FULLSCREEN & ANTI-TAMPER SCREEN LOCK SHIELD
  // -------------------------------------------------------------
  function enforceFullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }
  document.addEventListener('click', enforceFullscreen);
  document.addEventListener('keydown', enforceFullscreen);

  // Prevent right-click context menu (inspect element, back, reload)
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // Intercept window close (Alt+F4 / browser close prompt)
  window.addEventListener('beforeunload', (e) => {
    if (window.isMasterAuthorizedExit) return;
    e.preventDefault();
    e.returnValue = 'CyberPulse Station Lock active. Please use Master Admin credentials to close.';
    return e.returnValue;
  });

  // Trap shortcut keys (F11, F12, DevTools, Ctrl+W, Ctrl+R, etc.)
  document.addEventListener('keydown', (e) => {
    // Secret Master Cashier / Admin exit combo: Ctrl + Alt + Shift + F12
    if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'F12' || e.code === 'F12')) {
      e.preventDefault();
      const pass = prompt('Enter Master Cashier Password to exit lock screen:');
      if (pass === 'admin') {
        window.isMasterAuthorizedExit = true;
        window.close();
      }
      return;
    }

    // Block F11 (exit fullscreen)
    if (e.key === 'F11' || e.code === 'F11') {
      e.preventDefault();
      return false;
    }

    // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (Developer Tools)
    if (e.key === 'F12' ||
       (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
       (e.ctrlKey && ['u', 'U', 's', 'S'].includes(e.key))) {
      e.preventDefault();
      return false;
    }

    // Block Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Shift+N (Browser Navigation)
    if (e.ctrlKey && ['w', 'W', 't', 'T', 'n', 'N', 'q', 'Q'].includes(e.key)) {
      e.preventDefault();
      return false;
    }

    // When station is locked, block Alt+F4
    if (e.altKey && (e.key === 'F4' || e.code === 'F4')) {
      if (!pcState || pcState.status !== 'in_session') {
        e.preventDefault();
        return false;
      }
    }
  }, true);

  // Clock Update for Lock Screen
  function updateClock() {
    const now = new Date();
    lockTime.textContent = now.toLocaleTimeString('ar-EG');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    lockDate.textContent = now.toLocaleDateString('ar-EG', options);
  }
  setInterval(updateClock, 1000);
  updateClock();

  function checkClientWordFilter(text) {
    if (!text || !localWordFilter || !localWordFilter.enabled) return;
    const lower = String(text).toLowerCase();
    const words = localWordFilter.words || [];
    const now = Date.now();

    for (const w of words) {
      if (!w.enabled) continue;
      const target = (w.word || '').toLowerCase().trim();
      if (!target) continue;

      if (lower.includes(target)) {
        const lastTrigger = localFilterCooldowns.get(target) || 0;
        if (now - lastTrigger < 30000) continue;
        localFilterCooldowns.set(target, now);

        const customMsg = localWordFilter.customWarningMessage || 'Prohibited content detected by Cyber Security.';
        const penalty = localWordFilter.penaltyAction || 'warn_only';

        const violation = {
          word: w.word,
          category: w.category || 'Security',
          detectedText: text,
          timestamp: new Date().toLocaleTimeString('ar-EG'),
          penalty
        };

        if (penalty === 'lock_session') {
          if (pcState) {
            pcState.status = 'locked';
            if (pcState.session) pcState.session.expired = true;
            updatePcUI(pcState);
          }
          if (window.cyberAudio) window.cyberAudio.playWarning();
          showAlertBanner('Security Violation - Session Locked', `${customMsg} (${w.word})`);
        } else {
          if (window.cyberAudio) window.cyberAudio.playWarning();
          showAlertBanner('Security Warning', `${customMsg} (${w.word})`);
        }

        if (socket && socket.connected) {
          socket.emit('client_reported_violation', { pcId, violation });
        } else {
          offlineViolations.push(violation);
        }
        break;
      }
    }
  }

  // Fetch initial state from server
  fetch('/api/state')
    .then(r => r.json())
    .then(data => {
      allGames = data.games || [];
      renderGames(allGames);
      renderCafeteriaMenu(data.menu || []);

      if (data.settings && data.settings.wordFilter) {
        localWordFilter = data.settings.wordFilter;
      }

      if (data.settings && data.settings.branding && data.settings.branding.shopName) {
        document.querySelectorAll('.brand-title').forEach(el => el.textContent = data.settings.branding.shopName);
        if (data.settings.branding.shopSubtitle) {
          document.querySelectorAll('.brand-sub').forEach(el => el.textContent = data.settings.branding.shopSubtitle);
        }
      }

      const pc = data.pcs.find(p => p.id === pcId);
      if (pc) {
        updatePcUI(pc);
      }
    });

  socket.on('word_filter_sync', (wf) => {
    if (wf) localWordFilter = wf;
  });

  socket.on('wordfilter_updated', (wf) => {
    if (wf) localWordFilter = wf;
  });

  socket.on('branding_updated', (branding) => {
    if (branding && branding.shopName) {
      document.querySelectorAll('.brand-title').forEach(el => el.textContent = branding.shopName);
      if (branding.shopSubtitle) {
        document.querySelectorAll('.brand-sub').forEach(el => el.textContent = branding.shopSubtitle);
      }
    }
  });

  socket.on('menu_updated', (menu) => {
    renderCafeteriaMenu(menu);
  });

  // Handle PC Update
  function updatePcUI(pc) {
    pcState = pc;
    lockPcName.textContent = pc.name;
    lockPcSpecs.textContent = pc.specs;
    lockPcRate.textContent = `\${pc.ratePerHour} EGP/hr`;

    hudPcName.textContent = pc.name;
    hudPcZone.textContent = pc.zone;

    if (pc.status === 'in_session' && pc.session) {
      lockScreen.classList.remove('active');
      launcherScreen.style.display = 'flex';
      hudCustomerName.textContent = pc.session.customerName || 'Guest';
      updateTimerDisplay(pc.session);
    } else {
      // Locked or Available without active session
      lockScreen.classList.add('active');
      launcherScreen.style.display = 'none';
      if (activeGame) {
        exitGame();
      }
    }
  }

  // Format seconds to HH:MM:SS
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function updateTimerDisplay(session) {
    if (!session) return;
    hudTotalCost.textContent = (session.totalCost || 0).toFixed(2);
    hudOrderCount.textContent = (pcState.orders || []).length;

    if (session.type === 'open') {
      hudTimer.textContent = formatTime(session.elapsedSeconds);
      hudTimer.className = 'hud-timer-val';
    } else {
      hudTimer.textContent = formatTime(session.remainingSeconds);
      if (session.remainingSeconds <= 60) {
        hudTimer.className = 'hud-timer-val critical';
      } else if (session.remainingSeconds <= 300) {
        hudTimer.className = 'hud-timer-val warning';
      } else {
        hudTimer.className = 'hud-timer-val';
      }
    }

    // In game timer
    const inGameTimer = document.getElementById('inGameTimer');
    if (inGameTimer) {
      inGameTimer.textContent = hudTimer.textContent;
    }
  }

  // Socket Events
  socket.on('games_updated', (games) => {
    allGames = games || [];
    renderGames(allGames);
  });

  socket.on('pc_updated', (pc) => {
    if (pc.id === pcId) {
      updatePcUI(pc);
    }
  });

  socket.on('tick_update', (pcs) => {
    const pcData = pcs.find(p => p.id === pcId);
    if (pcData && pcData.session && pcState) {
      pcState.session = pcData.session;
      updateTimerDisplay(pcData.session);
    }
  });

  socket.on('session_started', (session) => {
    window.cyberAudio.playUnlock();
    if (pcState) {
      pcState.status = 'in_session';
      pcState.session = session;
      updatePcUI(pcState);
    }
    showToast('Session Started', 'Enjoy your gaming experience!');
  });

  socket.on('session_closed', () => {
    window.cyberAudio.playWarning();
    if (pcState) {
      pcState.status = 'available';
      pcState.session = null;
      updatePcUI(pcState);
    }
    showToast('Session Ended', 'Thank you for playing at CyberPulse!');
  });

  socket.on('session_warning', (data) => {
    window.cyberAudio.playWarning();
    showAlertBanner('Time Ending Warning', data.message);
  });

  socket.on('session_expired', (data) => {
    window.cyberAudio.playWarning();
    showAlertBanner('Time Expired!', `Your session time has ended. Total bill: \${data.totalCost} EGP`);
    if (pcState) {
      pcState.status = 'locked';
      updatePcUI(pcState);
    }
  });

  socket.on('remote_command', (data) => {
    if (data.action === 'lock') {
      window.cyberAudio.playWarning();
      lockScreen.classList.add('active');
    } else if (data.action === 'unlock') {
      window.cyberAudio.playUnlock();
      lockScreen.classList.remove('active');
    } else if (data.action === 'reload') {
      window.location.reload();
    }
  });

  socket.on('admin_alert_message', (data) => {
    window.cyberAudio.playWarning();
    showAlertBanner('Message from Cashier', data.message);
  });

  socket.on('force_kill_game', (data) => {
    window.cyberAudio.playWarning();
    showAlertBanner('Process Blocked', data.message);
    exitGame();
  });

  // -------------------------------------------------------------
  // REMOTE DESKTOP & SCREEN STREAMING AGENT
  // -------------------------------------------------------------
  socket.on('start_screen_streaming', (data) => {
    isStreamingToAdmin = true;
    console.log('Admin started screen streaming, mode:', data.mode);
  });

  socket.on('stop_screen_streaming', () => {
    isStreamingToAdmin = false;
    adminCursor.classList.remove('active');
  });

  // Execute remote input from admin (Remote Desktop Full Control)
  socket.on('execute_remote_input', (data) => {
    // Show admin cursor
    adminCursor.classList.add('active');
    // Position cursor relative to screen container
    const xPct = data.x; // 0 to 1
    const yPct = data.y; // 0 to 1

    adminCursor.style.left = `${xPct * 100}%`;
    adminCursor.style.top = `${yPct * 100}%`;

    if (data.type === 'mousedown') {
      // Simulate click effect
      adminCursor.style.transform = 'scale(0.85)';
      setTimeout(() => adminCursor.style.transform = 'scale(1)', 100);
      window.cyberAudio.playClick();
    }
  });

  // Loop to send screen frames to server (10 FPS for smooth monitoring)
  setInterval(() => {
    // Always render frame to screenCaptureCanvas
    renderScreenFrame();
    
    // Broadcast snapshot & execute client-side word filter inspection
    const activeWin = activeGame ? activeGame.title : (pcState && pcState.status === 'in_session' ? 'Game Launcher' : 'Locked Screen');
    checkClientWordFilter(activeWin);

    if (socket && socket.connected) {
      const frameData = screenCaptureCanvas.toDataURL('image/jpeg', 0.6);
      socket.emit('screen_frame', {
        pcId,
        image: frameData,
        activeWindow: activeWin
      });
    }
  }, 300);

  function renderScreenFrame() {
    screenCaptureCtx.fillStyle = '#07090e';
    screenCaptureCtx.fillRect(0, 0, screenCaptureCanvas.width, screenCaptureCanvas.height);

    if (activeGame) {
      // Draw actual game canvas
      screenCaptureCtx.drawImage(gameCanvas, 0, 0, screenCaptureCanvas.width, screenCaptureCanvas.height);
      // Overlay game title
      screenCaptureCtx.fillStyle = 'rgba(0,0,0,0.6)';
      screenCaptureCtx.fillRect(10, 10, 240, 40);
      screenCaptureCtx.fillStyle = '#00f3ff';
      screenCaptureCtx.font = '16px Cairo';
      screenCaptureCtx.fillText(`🎮 ${activeGame.title} (FPS: 144)`, 20, 35);
    } else if (pcState && pcState.status === 'in_session') {
      // Launcher mode preview
      screenCaptureCtx.fillStyle = '#0f172a';
      screenCaptureCtx.fillRect(0, 0, screenCaptureCanvas.width, screenCaptureCanvas.height);
      screenCaptureCtx.fillStyle = '#00f3ff';
      screenCaptureCtx.font = 'bold 24px Orbitron';
      screenCaptureCtx.fillText(`CYBERPULSE LAUNCHER - ${pcId}`, 30, 50);

      screenCaptureCtx.fillStyle = '#05ffa1';
      screenCaptureCtx.font = '20px Cairo';
      screenCaptureCtx.fillText(`Time: \${hudTimer.textContent} | Cost: \${hudTotalCost.textContent} EGP`, 30, 90);

      // Draw mock game tiles
      for (let i = 0; i < 4; i++) {
        screenCaptureCtx.fillStyle = '#1e293b';
        screenCaptureCtx.fillRect(30 + (i * 180), 120, 160, 220);
        screenCaptureCtx.strokeStyle = '#334155';
        screenCaptureCtx.strokeRect(30 + (i * 180), 120, 160, 220);
      }
    } else {
      // Locked screen preview
      screenCaptureCtx.fillStyle = '#05070c';
      screenCaptureCtx.fillRect(0, 0, screenCaptureCanvas.width, screenCaptureCanvas.height);
      screenCaptureCtx.fillStyle = '#ff0055';
      screenCaptureCtx.font = 'bold 32px Cairo';
      screenCaptureCtx.fillText(`🔒 \${pcId} - LOCKED`, screenCaptureCanvas.width / 2 - 120, screenCaptureCanvas.height / 2);
    }
  }

  // -------------------------------------------------------------
  // GAMES RENDERING & INTERACTIVE IN-GAME SIMULATION
  // -------------------------------------------------------------
  function renderGames(games) {
    const grid = document.getElementById('gamesGrid');
    grid.innerHTML = '';

    const filtered = currentCategory === 'all' 
      ? games 
      : games.filter(g => g.category.toLowerCase().includes(currentCategory.toLowerCase()));

    document.getElementById('displayedGamesCount').textContent = filtered.length;

    filtered.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = `
        <div class="game-poster-wrap">
          <img src="${game.poster}" class="game-poster" alt="${game.title}">
          <span class="game-badge">Ready to Play</span>
        </div>
        <div class="game-details">
          <div>
            <div class="game-title">${game.title}</div>
            <div class="game-meta">
              <span>${game.category}</span>
              <span>${game.developer}</span>
            </div>
          </div>
          <button class="btn-launch" data-game-id="${game.id}">
            <span>▶</span> Play Game
          </button>
        </div>
      `;

      card.querySelector('.btn-launch').addEventListener('click', () => {
        launchGame(game);
      });

      grid.appendChild(card);
    });
  }

  // Filter Categories
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      window.cyberAudio.playClick();
      renderGames(allGames);
    });
  });

  // Search Games
  document.getElementById('gameSearchInput').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderGames(allGames);
      return;
    }
    const filtered = allGames.filter(g => 
      g.title.toLowerCase().includes(query) || 
      g.category.toLowerCase().includes(query)
    );
    renderGames(filtered);
  });

  // Launch Game
  function launchGame(game) {
    activeGame = game;
    window.cyberAudio.playGameLaunch();
    document.getElementById('activeGameTitle').textContent = game.title;
    gameWindow.classList.add('active');

    // Notify server
    socket.emit('game_launched', { pcId, gameTitle: game.title });

    // Start live gaming canvas simulation
    startGameSimulation(game);
  }

  // Exit Game
  function exitGame() {
    if (!activeGame) return;
    const oldTitle = activeGame.title;
    activeGame = null;
    gameWindow.classList.remove('active');
    if (gameAnimationId) cancelAnimationFrame(gameAnimationId);

    socket.emit('game_closed', { pcId, gameTitle: oldTitle });
    window.cyberAudio.playClick();
  }

  document.getElementById('btnExitGame').addEventListener('click', exitGame);

  // High-FPS Interactive 3D/Canvas Simulation for Games
  function startGameSimulation(game) {
    let frame = 0;
    const particles = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * gameCanvas.width,
        y: Math.random() * gameCanvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: Math.random() * 4 + 2,
        color: i % 2 === 0 ? '#00f3ff' : '#bd00ff'
      });
    }

    function draw() {
      frame++;
      gameCtx.fillStyle = '#060a14';
      gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

      // Sci-fi grid floor
      gameCtx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
      gameCtx.lineWidth = 1;
      const horizon = gameCanvas.height * 0.65;
      
      // Horizontal perspective lines
      for (let y = horizon; y < gameCanvas.height; y += 20 + ((y - horizon) * 0.2)) {
        gameCtx.beginPath();
        gameCtx.moveTo(0, y);
        gameCtx.lineTo(gameCanvas.width, y);
        gameCtx.stroke();
      }

      // Sun/Core
      const grad = gameCtx.createRadialGradient(gameCanvas.width / 2, horizon - 50, 20, gameCanvas.width / 2, horizon - 50, 180);
      grad.addColorStop(0, '#ff0055');
      grad.addColorStop(0.5, '#7b00ff');
      grad.addColorStop(1, 'transparent');
      gameCtx.fillStyle = grad;
      gameCtx.beginPath();
      gameCtx.arc(gameCanvas.width / 2, horizon - 50, 180, 0, Math.PI * 2);
      gameCtx.fill();

      // Draw animated particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > gameCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > gameCanvas.height) p.vy *= -1;

        gameCtx.fillStyle = p.color;
        gameCtx.beginPath();
        gameCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        gameCtx.fill();
      });

      // Crosshair / Shooter HUD
      const cx = gameCanvas.width / 2 + Math.sin(frame * 0.05) * 30;
      const cy = gameCanvas.height / 2 + Math.cos(frame * 0.04) * 20;

      gameCtx.strokeStyle = '#05ffa1';
      gameCtx.lineWidth = 2;
      // Crosshair circle
      gameCtx.beginPath();
      gameCtx.arc(cx, cy, 25, 0, Math.PI * 2);
      gameCtx.stroke();
      // Reticles
      gameCtx.beginPath();
      gameCtx.moveTo(cx - 35, cy);
      gameCtx.lineTo(cx - 10, cy);
      gameCtx.moveTo(cx + 10, cy);
      gameCtx.lineTo(cx + 35, cy);
      gameCtx.moveTo(cx, cy - 35);
      gameCtx.lineTo(cx, cy - 10);
      gameCtx.moveTo(cx, cy + 10);
      gameCtx.lineTo(cx, cy + 35);
      gameCtx.stroke();

      // In-game score / status
      gameCtx.fillStyle = '#fff';
      gameCtx.font = 'bold 20px Cairo';
      gameCtx.fillText(`Game: \${game.title}`, 40, 60);
      gameCtx.fillStyle = '#05ffa1';
      gameCtx.font = '16px Orbitron';
      gameCtx.fillText(`FPS: 144 • PING: 18ms • K/D: 14/2`, 40, 90);

      gameAnimationId = requestAnimationFrame(draw);
    }

    draw();
  }

  // -------------------------------------------------------------
  // CAFETERIA MENU & ORDERING
  // -------------------------------------------------------------
  function renderCafeteriaMenu(menu) {
    const grid = document.getElementById('clientCafeGrid');
    grid.innerHTML = '';

    menu.forEach(item => {
      const el = document.createElement('div');
      el.className = 'menu-card-item';
      el.innerHTML = `
        <div class="menu-item-icon">${item.icon}</div>
        <div class="menu-item-name">${item.name}</div>
        <div class="menu-item-price">${item.price} EGP</div>
        <button class="btn-add-snack" ${item.stock <= 0 ? 'disabled' : ''}>
          ${item.stock > 0 ? '+ Add to Order' : 'Out of Stock'}
        </button>
      `;

      el.querySelector('.btn-add-snack').addEventListener('click', () => {
        addToCart(item);
      });

      grid.appendChild(el);
    });
  }

  function addToCart(item) {
    window.cyberAudio.playClick();
    const existing = cart.find(c => c.itemId === item.id);
    if (existing) {
      existing.qty++;
    } else {
      cart.push({ itemId: item.id, name: item.name, price: item.price, qty: 1 });
    }
    renderCart();
  }

  function renderCart() {
    const list = document.getElementById('clientCartList');
    const totalEl = document.getElementById('clientCartTotal');
    const submitBtn = document.getElementById('btnSubmitClientOrder');

    if (cart.length === 0) {
      list.innerHTML = '<p class="empty-text">Cart is empty, pick items from the menu</p>';
      totalEl.textContent = '0';
      submitBtn.disabled = true;
      return;
    }

    list.innerHTML = '';
    let total = 0;

    cart.forEach((it, idx) => {
      total += it.price * it.qty;
      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <span>${it.name} (${it.qty}×)</span>
        <div>
          <b>${it.price * it.qty} EGP</b>
          <button style="background:transparent; border:none; color:#ff0055; margin-right:8px; cursor:pointer;" data-del="${idx}">✖</button>
        </div>
      `;

      row.querySelector(`[data-del="${idx}"]`).addEventListener('click', () => {
        cart.splice(idx, 1);
        renderCart();
      });

      list.appendChild(row);
    });

    totalEl.textContent = total;
    submitBtn.disabled = false;
  }

  // Open / Close Cafeteria Modal
  const cafeModal = document.getElementById('cafeModal');
  document.getElementById('btnOpenCafeteria').addEventListener('click', () => {
    window.cyberAudio.playClick();
    cafeModal.classList.add('active');
  });
  document.getElementById('btnCloseCafeModal').addEventListener('click', () => {
    cafeModal.classList.remove('active');
  });

  // Submit Client Order
  document.getElementById('btnSubmitClientOrder').addEventListener('click', () => {
    if (cart.length === 0) return;
    window.cyberAudio.playCash();

    socket.emit('client_order_request', {
      pcId,
      items: cart
    });

    cart = [];
    renderCart();
    cafeModal.classList.remove('active');
    showToast('Order Sent', 'Your order was sent to cashier and is being prepared!');
  });

  // Call Staff / Cashier
  function callStaff() {
    window.cyberAudio.playClick();
    socket.emit('client_call_staff', {
      pcId,
      reason: 'Customer calling cashier for assistance'
    });
    showToast('Cashier Called', 'Staff notified and will assist you shortly.');
  }

  document.getElementById('btnCallStaffLauncher').addEventListener('click', callStaff);
  document.getElementById('btnCallCashierLocked').addEventListener('click', callStaff);

  // Request End Session
  document.getElementById('btnRequestEndSession').addEventListener('click', () => {
    if (confirm('Do you want to end your session and calculate the bill now?')) {
      fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcId })
      });
    }
  });

  // Toast / Banner Helpers
  function showAlertBanner(title, msg) {
    const banner = document.getElementById('alertBanner');
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMsg').textContent = msg;
    banner.classList.add('active');
  }

  document.getElementById('btnDismissAlert').addEventListener('click', () => {
    document.getElementById('alertBanner').classList.remove('active');
  });

  function showToast(title, msg) {
    showAlertBanner(title, msg);
    setTimeout(() => {
      document.getElementById('alertBanner').classList.remove('active');
    }, 4000);
  }

  // Member Login Modal
  const memberModal = document.getElementById('memberModal');
  document.getElementById('btnMemberLoginModal').addEventListener('click', () => {
    memberModal.classList.add('active');
  });
  document.getElementById('btnCloseMemberModal').addEventListener('click', () => {
    memberModal.classList.remove('active');
  });
  document.getElementById('btnSubmitMemberLogin').addEventListener('click', () => {
    const input = document.getElementById('memberInput').value.trim();
    if (!input) return alert('Please enter phone number or card code');

    fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pcId,
        type: 'fixed_time',
        durationMinutes: 60,
        customerName: `Member (\${input.slice(-4)})`
      })
    }).then(r => r.json()).then(res => {
      memberModal.classList.remove('active');
    });
  });
});
