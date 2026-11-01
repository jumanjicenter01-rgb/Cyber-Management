// CyberPulse Central Admin & Cashier Controller
// Global Modal Handlers
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    if (window.cyberAudio && window.cyberAudio.playClick) {
      window.cyberAudio.playClick();
    }
  }
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
  }
};

const openModal = window.openModal;
const closeModal = window.closeModal;

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let state = {
    pcs: [],
    menu: [],
    games: [],
    shift: {},
    invoices: [],
    auditLog: [],
    screenshots: []
  };

  // Toggle Load-Balanced Gaming VPN on PC
  window.togglePcVPN = function(pcId) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc) return;
    const targetState = !pc.vpnEnabled;

    fetch('/api/mikrotik/vpn/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pcId, enable: targetState })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          if (targetState) {
            window.cyberAudio?.playUnlock?.();
          } else {
            window.cyberAudio?.playClick?.();
          }
          fetchState();
        } else {
          alert(res.error || 'Failed to toggle VPN');
        }
      });
  };

  let activeFilter = 'all';
  let activeRemotePcId = null;
  let activeRemoteMode = 'view_only'; // 'view_only' | 'full_control'
  let remoteScreenImg = new Image();
  let selectedStartSessionType = 'open';
  let posCart = [];
  let currentViewMode = localStorage.getItem('cyber_view_mode') || 'large';
  let isGridScreenView = localStorage.getItem('cyber_grid_screen_view') !== 'false';
  let screenViewPollInterval = null;
  let cachedScreenSnapshots = {};

  // DOM Elements
  const pcsCardsGrid = document.getElementById('pcsCardsGrid');
  
  // Power Hub & Device Selection State
  let selectedPcs = new Set();
  let lastSelectedPcId = null;
  const selectedPcsCountBadge = document.getElementById('selectedPcsCountBadge');

  function handleCardSelect(pcId, event) {
    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isShift && lastSelectedPcId) {
      const pcList = state.pcs;
      const fromIdx = pcList.findIndex(p => p.id === lastSelectedPcId);
      const toIdx = pcList.findIndex(p => p.id === pcId);

      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);

        if (!isCtrl) {
          selectedPcs.clear();
        }
        for (let i = start; i <= end; i++) {
          selectedPcs.add(pcList[i].id);
        }
      } else {
        selectedPcs.add(pcId);
        lastSelectedPcId = pcId;
      }
    } else if (isCtrl) {
      if (selectedPcs.has(pcId)) {
        selectedPcs.delete(pcId);
      } else {
        selectedPcs.add(pcId);
        lastSelectedPcId = pcId;
      }
    } else {
      // Single click: select only this card
      selectedPcs.clear();
      selectedPcs.add(pcId);
      lastSelectedPcId = pcId;
    }

    updateSelectedPcsUI();
    if (window.cyberAudio && window.cyberAudio.playClick) {
      window.cyberAudio.playClick();
    }
  }

  function updateSelectedPcsUI() {
    if (selectedPcsCountBadge) {
      selectedPcsCountBadge.innerHTML = `Selected: <b>${selectedPcs.size}</b>`;
    }
    state.pcs.forEach(pc => {
      const card = document.getElementById(`card_${pc.id}`);
      if (card) {
        card.classList.toggle('card-selected', selectedPcs.has(pc.id));
      }
    });
  }

  // Clear selection when clicking between devices or outside cards
  document.addEventListener('click', (e) => {
    if (e.target.closest('.pc-card') || e.target.closest('.power-quick-bar') || e.target.closest('.modal-overlay') || e.target.closest('.modal-box')) {
      return;
    }
    if (selectedPcs && selectedPcs.size > 0) {
      selectedPcs.clear();
      lastSelectedPcId = null;
      updateSelectedPcsUI();
    }
  });
  const surveillanceGrid = document.getElementById('surveillanceGrid');
  const remoteScreenCanvas = document.getElementById('remoteScreenCanvas');
  const remoteScreenCtx = remoteScreenCanvas.getContext('2d');
  const remoteWatermark = document.getElementById('remoteWatermark');

  // -------------------------------------------------------------
  // [EN]
  // -------------------------------------------------------------
  let currentTheme = localStorage.getItem('cyber_theme') || 'dark';
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeToggleIcon = document.getElementById('themeToggleIcon');

  function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('cyber_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggleIcon) {
      if (theme === 'light') {
        themeToggleIcon.textContent = '☀️';
        if (btnThemeToggle) btnThemeToggle.title = 'Light Mode - Click to switch to Dark Mode';
      } else {
        themeToggleIcon.textContent = '🌙';
        if (btnThemeToggle) btnThemeToggle.title = 'Dark Mode - Click to switch to Light Mode';
      }
    }
  }
  applyTheme(currentTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      window.cyberAudio?.playClick?.();
    });
  }

  const btnShiftOrdersBadge = document.getElementById('btnShiftOrdersBadge');
  if (btnShiftOrdersBadge) {
    btnShiftOrdersBadge.addEventListener('click', () => {
      switchTab('cafeteriaTab');
      window.cyberAudio?.playClick?.();
    });
  }

  // -------------------------------------------------------------
  // [EN]
  // -------------------------------------------------------------
  const masterAuthModal = document.getElementById('masterAuthModal');
  const masterLoginForm = document.getElementById('masterLoginForm');
  const masterPasswordInput = document.getElementById('masterPasswordInput');
  const authErrorMessage = document.getElementById('authErrorMessage');
  const btnTogglePassVisibility = document.getElementById('btnTogglePassVisibility');
  const btnLockMaster = document.getElementById('btnLockMasterDashboard');
  const authServerIpDisplay = document.getElementById('authServerIpDisplay');

  let masterToken = sessionStorage.getItem('cyber_master_token');

  function checkMasterAuth() {
    if (!masterToken) {
      showAuthGate();
      return;
    }

    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: masterToken })
    })
      .then(r => r.json())
      .then(res => {
        if (!res.authenticated) {
          sessionStorage.removeItem('cyber_master_token');
          masterToken = null;
          showAuthGate();
        } else {
          hideAuthGate();
        }
      })
      .catch(() => showAuthGate());
  }

  function showAuthGate() {
    if (masterAuthModal) {
      masterAuthModal.classList.add('active');
      if (masterPasswordInput) {
        masterPasswordInput.value = '';
        setTimeout(() => masterPasswordInput.focus(), 150);
      }
    }
  }

  function hideAuthGate() {
    if (masterAuthModal) {
      masterAuthModal.classList.remove('active');
    }
    if (authErrorMessage) authErrorMessage.style.display = 'none';
  }

  if (masterLoginForm) {
    masterLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = (masterPasswordInput.value || '').trim();
      if (!password) {
        authErrorMessage.textContent = 'Please enter master password!';
        authErrorMessage.style.display = 'block';
        return;
      }

      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            masterToken = res.token;
            sessionStorage.setItem('cyber_master_token', masterToken);
            hideAuthGate();
            window.cyberAudio.playCash();
            fetchState();
          } else {
            authErrorMessage.textContent = res.error || 'Incorrect master password!';
            authErrorMessage.style.display = 'block';
            window.cyberAudio.playWarning();
            masterPasswordInput.select();
          }
        })
        .catch(() => {
          authErrorMessage.textContent = 'Network connection error!';
          authErrorMessage.style.display = 'block';
        });
    });
  }

  if (btnTogglePassVisibility && masterPasswordInput) {
    btnTogglePassVisibility.addEventListener('click', () => {
      const isPass = masterPasswordInput.type === 'password';
      masterPasswordInput.type = isPass ? 'text' : 'password';
      btnTogglePassVisibility.textContent = isPass ? '🔒' : '👁️';
    });
  }

  if (btnLockMaster) {
    btnLockMaster.addEventListener('click', () => {
      sessionStorage.removeItem('cyber_master_token');
      masterToken = null;
      showAuthGate();
      window.cyberAudio.playWarning();
    });
  }

  // ==============================================================
  // REVENUE MASKING & EYE PASSWORD UNLOCK SYSTEM
  // ==============================================================
  let isRevenueRevealed = false;
  const revenueAuthModal = document.getElementById('revenueAuthModal');
  const revenueAuthForm = document.getElementById('revenueAuthForm');
  const revenuePasswordInput = document.getElementById('revenuePasswordInput');
  const revenueAuthErrorMessage = document.getElementById('revenueAuthErrorMessage');
  const btnCloseRevenueAuth = document.getElementById('btnCloseRevenueAuth');
  const btnCancelRevenueAuth = document.getElementById('btnCancelRevenueAuth');
  const btnToggleRevenuePassVisibility = document.getElementById('btnToggleRevenuePassVisibility');

  function openRevenueAuthModal() {
    if (revenueAuthModal) {
      revenueAuthModal.classList.add('active');
      if (revenueAuthErrorMessage) revenueAuthErrorMessage.style.display = 'none';
      if (revenuePasswordInput) {
        revenuePasswordInput.value = '';
        setTimeout(() => revenuePasswordInput.focus(), 150);
      }
    }
  }

  function closeRevenueAuthModal() {
    if (revenueAuthModal) {
      revenueAuthModal.classList.remove('active');
    }
    if (revenueAuthErrorMessage) revenueAuthErrorMessage.style.display = 'none';
  }

  if (btnCloseRevenueAuth) btnCloseRevenueAuth.addEventListener('click', closeRevenueAuthModal);
  if (btnCancelRevenueAuth) btnCancelRevenueAuth.addEventListener('click', closeRevenueAuthModal);

  if (btnToggleRevenuePassVisibility && revenuePasswordInput) {
    btnToggleRevenuePassVisibility.addEventListener('click', () => {
      const isPass = revenuePasswordInput.type === 'password';
      revenuePasswordInput.type = isPass ? 'text' : 'password';
      btnToggleRevenuePassVisibility.textContent = isPass ? '🔒' : '👁️';
    });
  }

  function handleRevenueToggleClick() {
    if (isRevenueRevealed) {
      isRevenueRevealed = false;
      if (state && state.shift) updateShiftStats(state.shift);
      window.cyberAudio?.playClick?.();
      showToast('🔒 Revenue figures hidden');
    } else {
      openRevenueAuthModal();
    }
  }

  ['pillGameRevenue', 'pillCafeRevenue', 'pillDrawerCash', 'eyeIconGameRev', 'eyeIconCafeRev', 'eyeIconDrawerCash'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRevenueToggleClick();
      });
    }
  });

  if (revenueAuthForm) {
    revenueAuthForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = (revenuePasswordInput ? revenuePasswordInput.value : '').trim();
      if (!password) {
        if (revenueAuthErrorMessage) {
          revenueAuthErrorMessage.textContent = 'Please enter manager password!';
          revenueAuthErrorMessage.style.display = 'block';
        }
        return;
      }

      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            isRevenueRevealed = true;
            closeRevenueAuthModal();
            window.cyberAudio?.playCash?.();
            if (state && state.shift) updateShiftStats(state.shift);
            showToast('✅ Identity verified. Revenue unlocked.');
          } else {
            if (revenueAuthErrorMessage) {
              revenueAuthErrorMessage.textContent = res.error || 'Incorrect authorization password!';
              revenueAuthErrorMessage.style.display = 'block';
            }
            window.cyberAudio?.playWarning?.();
            if (revenuePasswordInput) revenuePasswordInput.select();
          }
        })
        .catch(() => {
          if (revenueAuthErrorMessage) {
            revenueAuthErrorMessage.textContent = 'Server connection error!';
            revenueAuthErrorMessage.style.display = 'block';
          }
        });
    });
  }


  checkMasterAuth();

  // Connect Socket.io
  const socket = io();

  socket.on('connect', () => {
    console.log('Connected to Cyber Server as Admin');
    socket.emit('register_role', { role: 'admin' });
  });

  // Load initial data
  function fetchState() {
    fetch('/api/state')
      .then(r => r.json())
      .then(data => {
        state = data;
        if (data.serverIp && authServerIpDisplay) {
          authServerIpDisplay.textContent = `${data.serverIp}:${data.serverPort || 4000}`;
        }
        renderAll();
      });
  }
  fetchState();

  // Socket Live Listeners
  socket.on('tick_update', (pcsData) => {
    let reRenderNeeded = false;
    pcsData.forEach(pData => {
      const pc = state.pcs.find(p => p.id === pData.id);
      if (pc) {
        if (pc.status !== pData.status) {
          reRenderNeeded = true;
        }
        pc.status = pData.status;
        pc.session = pData.session;
        pc.currentGame = pData.currentGame;
        updatePcCardLive(pc);
      }
    });
    if (reRenderNeeded) {
      renderPcsGrid();
    }
    updateShiftSummary();
  });

  socket.on('settings_icons_updated', (icons) => {
    if (!state.settings) state.settings = {};
    state.settings.statusIcons = icons;
    syncStatusIconsUI();
    renderPcsGrid();
  });

  socket.on('pc_updated', (updatedPc) => {
    const idx = state.pcs.findIndex(p => p.id === updatedPc.id);
    if (idx !== -1) {
      state.pcs[idx] = updatedPc;
    } else {
      state.pcs.push(updatedPc);
    }
    renderPcsGrid();
    renderSurveillanceGrid();
    updateShiftSummary();
  });

  socket.on('pc_online_status', (data) => {
    const pc = state.pcs.find(p => p.id === data.pcId);
    if (pc) {
      pc.isOnline = data.isOnline;
      renderPcsGrid();
      renderSurveillanceGrid();
    }
  });

  socket.on('pc_discovered', (newPc) => {
    if (!state.pcs) state.pcs = [];
    const existing = state.pcs.find(p => p.id === newPc.id);
    if (!existing) {
      state.pcs.push(newPc);
    } else {
      Object.assign(existing, newPc);
    }
    updateShiftSummary();
    renderPcsGrid();
    renderSurveillanceGrid();
    if (window.cyberAudio) window.cyberAudio.playUnlock();
    showToast('Device Discovered 📡', `New station connected from network: ${newPc.name} [${newPc.id}] (${newPc.ip})`);
  });

  socket.on('pc_removed', (data) => {
    if (!state.pcs) return;
    state.pcs = state.pcs.filter(p => p.id !== data.pcId);
    selectedPcs.delete(data.pcId);
    updateShiftSummary();
    renderPcsGrid();
    renderSurveillanceGrid();
  });

  socket.on('state_updated', (data) => {
    if (data && Array.isArray(data.pcs)) {
      state.pcs = data.pcs;
      updateShiftSummary();
      renderPcsGrid();
      renderSurveillanceGrid();
    }
  });

  socket.on('shift_updated', (shift) => {
    state.shift = shift;
    updateShiftSummary();
  });

  socket.on('audit_update', (item) => {
    state.auditLog.unshift(item);
    renderAuditLog();
  });

  socket.on('games_updated', (games) => {
    state.games = games;
    renderMasterGames();
  });

  socket.on('menu_updated', (menu) => {
    state.menu = menu;
    renderCafeteriaPos();
  });

  socket.on('branding_updated', (branding) => {
    if (!state.settings) state.settings = {};
    state.settings.branding = branding;
    applyBranding(branding);
  });

  socket.on('screenshot_saved', (shot) => {
    if (!state.screenshots) state.screenshots = [];
    state.screenshots.unshift(shot);
    renderScreenshotsGallery();
  });

  // Client Alert & Orders Notifications
  socket.on('staff_called', (data) => {
    window.cyberAudio.playWarning();
    alert(`🚨 Staff Assistance Requested from ${data.pcId}!\nReason: ${data.reason}`);
  });

  socket.on('new_client_order_alert', (data) => {
    window.cyberAudio.playCash();
    renderIncomingClientOrdersQueue();
    // Update count badge
    const badge = document.getElementById('incomingOrdersCount');
    badge.textContent = parseInt(badge.textContent || 0) + 1;
  });

  // Hotspot WiFi Vouchers Socket Listeners
  socket.on('voucher_created', (voucher) => {
    if (!state.vouchers) state.vouchers = [];
    const idx = state.vouchers.findIndex(v => v.code === voucher.code);
    if (idx !== -1) {
      state.vouchers[idx] = voucher;
    } else {
      state.vouchers.unshift(voucher);
    }
    renderHotspotVouchersTable(state.vouchers);
  });

  socket.on('voucher_deleted', (data) => {
    if (!state.vouchers) return;
    state.vouchers = state.vouchers.filter(v => v.code !== data.code);
    renderHotspotVouchersTable(state.vouchers);
  });

  socket.on('hotspot_settings_updated', (hotspot) => {
    if (!state.settings) state.settings = {};
    state.settings.hotspot = hotspot;
    syncHotspotSettingsUI();
  });

  // -------------------------------------------------------------
  // [EN]
  // -------------------------------------------------------------
  socket.on('screen_frame_relay', (data) => {
    cachedScreenSnapshots[data.pcId] = data;

    // 1. Update Surveillance Thumbnail
    const thumbImg = document.getElementById(`monitor_img_${data.pcId}`);
    if (thumbImg && data.image) {
      thumbImg.src = data.image;
      thumbImg.style.display = 'block';
    }
    const winTag = document.getElementById(`monitor_win_${data.pcId}`);
    if (winTag) {
      winTag.textContent = data.activeWindow || 'Desktop';
    }

    // 2. If In-Place Grid Screen View is active, update PC card's live screen feed
    if (isGridScreenView) {
      const cardImg = document.getElementById(`card_screen_img_${data.pcId}`);
      const placeholder = document.getElementById(`placeholder_${data.pcId}`);
      const cardWinTag = document.getElementById(`card_win_tag_${data.pcId}`);
      if (cardImg && data.image) {
        cardImg.src = data.image;
        cardImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (cardWinTag) cardWinTag.textContent = data.activeWindow || 'Desktop';
    }

    // 3. If this PC is open in Remote Desktop Modal, draw to canvas
    if (activeRemotePcId === data.pcId) {
      remoteScreenImg.onload = () => {
        remoteScreenCtx.drawImage(remoteScreenImg, 0, 0, remoteScreenCanvas.width, remoteScreenCanvas.height);
      };
      remoteScreenImg.src = data.image;
    }
  });

  // -------------------------------------------------------------
  // RENDERING FUNCTIONS
  // -------------------------------------------------------------
  function renderAll() {
    updateShiftSummary();
    renderPcsGrid();
    renderSurveillanceGrid();
    renderScreenshotsGallery();
    renderMasterGames();
    renderCafeteriaPos();
    renderInvoices();
    renderAuditLog();
    updateShiftSummary();
    if (state.vouchers) {
      renderHotspotVouchersTable(state.vouchers);
    }
    if (state.settings && state.settings.branding) {
      applyBranding(state.settings.branding);
    }
    applyViewMode(currentViewMode);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function updateShiftSummary() {
    const shift = state.shift || {};
    const cashierEl = document.getElementById('shiftCashierName');
    if (cashierEl) cashierEl.textContent = shift.cashierName || 'Cashier';
    
    const pcsList = Array.isArray(state.pcs) ? state.pcs : [];
    const activeCount = pcsList.filter(p => p.status === 'in_session').length;
    const totalCount = pcsList.length;

    const elActive = document.getElementById('activePcsCount');
    const elTotal = document.getElementById('totalPcsCount');
    const elAll = document.getElementById('countAll');
    const elBusy = document.getElementById('countBusy');
    const elAvail = document.getElementById('countAvail');
    const elLocked = document.getElementById('countLocked');

    if (elActive) elActive.textContent = activeCount;
    if (elTotal) elTotal.textContent = totalCount;
    if (elAll) elAll.textContent = totalCount;
    if (elBusy) elBusy.textContent = activeCount;
    if (elAvail) elAvail.textContent = pcsList.filter(p => p.status === 'available').length;
    if (elLocked) elLocked.textContent = pcsList.filter(p => p.status === 'locked').length;

    const gameRev = (shift.totalGameRevenue || 0);
    const cafeRev = (shift.totalCafeRevenue || 0);
    const totalCash = (shift.startDrawerCash || 0) + gameRev + cafeRev;

    const gameEl = document.getElementById('gameRevenue');
    const cafeEl = document.getElementById('cafeRevenue');
    const drawerEl = document.getElementById('totalDrawerCash');
    const eyeGame = document.getElementById('eyeIconGameRev');
    const eyeCafe = document.getElementById('eyeIconCafeRev');
    const eyeDrawer = document.getElementById('eyeIconDrawerCash');

    const eyeIcon = isRevenueRevealed ? '👁️' : '🔒';
    if (eyeGame) eyeGame.textContent = eyeIcon;
    if (eyeCafe) eyeCafe.textContent = eyeIcon;
    if (eyeDrawer) eyeDrawer.textContent = eyeIcon;

    if (gameEl) gameEl.textContent = isRevenueRevealed ? gameRev.toFixed(2) : '••••';
    if (cafeEl) cafeEl.textContent = isRevenueRevealed ? cafeRev.toFixed(2) : '••••';
    if (drawerEl) drawerEl.textContent = isRevenueRevealed ? totalCash.toFixed(2) : '••••';
  }

  // 1. Render PC Grid
  
  // -------------------------------------------------------------
  // UNIVERSAL HARDWARE SVG GENERATOR (Curved, UltraWide, Tower, Laptop)
  // -------------------------------------------------------------
  const defaultStateVisuals = {
    maintenance: { model: 'curved_monitor', color: '#ff9900', label: 'MAINTENANCE', badgeIcon: '🔧' },
    idle: { model: 'curved_monitor', color: '#a855f7', label: 'IDLE STANDBY', badgeIcon: '💤' },
    openTime: { model: 'curved_monitor', color: '#00f3ff', label: 'OPEN PLAY', badgeIcon: '🟢' },
    fixedTime: { model: 'curved_monitor', color: '#6366f1', label: 'FIXED TIME', badgeIcon: '⏱️' },
    member: { model: 'ultrawide', color: '#ffd700', label: 'VIP MEMBER', badgeIcon: '👑' },
    admin: { model: 'gaming_tower', color: '#10b981', label: 'ADMIN / STAFF', badgeIcon: '🛡️' },
    disconnected: { model: 'curved_monitor', color: '#ef4444', label: 'NO SIGNAL', badgeIcon: '⚠️' },
    offline: { model: 'curved_monitor', color: '#475569', label: 'POWERED OFF', badgeIcon: '⚫' },
    locked: { model: 'curved_monitor', color: '#ff0055', label: 'LOCKED', badgeIcon: '🔒' },
    lowTime: { model: 'curved_monitor', color: '#ff0055', label: 'EXPIRING TIME', badgeIcon: '🔥' },
    available: { model: 'curved_monitor', color: '#05ffa1', label: 'READY TO PLAY', badgeIcon: '⚡' }
  };

  const AVAILABLE_ESPORTS_ICONS = [
    { id: 'icon_gamepad', category: 'esports', title: 'Esports Controller', symbol: '🎮', desc: 'Pro wireless controller badge' },
    { id: 'icon_joystick', category: 'esports', title: 'Arcade Joystick', symbol: '🕹️', desc: 'Classic arcade flight stick' },
    { id: 'icon_swords', category: 'esports', title: 'Crossed Swords', symbol: '⚔️', desc: 'Battle arena & PvP combat' },
    { id: 'icon_crown', category: 'esports', title: 'VIP Royal Crown', symbol: '👑', desc: 'Gold VIP lounge tier' },
    { id: 'icon_shield', category: 'esports', title: 'Aegis Defense Shield', symbol: '🛡️', desc: 'Security & defense shield' },
    { id: 'icon_lightning', category: 'esports', title: 'Cyber Pulse Flash', symbol: '⚡', desc: 'High-speed overclocked power' },
    { id: 'icon_rocket', category: 'esports', title: 'Nitro Boost Rocket', symbol: '🚀', desc: 'Max performance speed boost' },
    { id: 'icon_target', category: 'esports', title: 'Crosshair Scope', symbol: '🎯', desc: 'Sniper & FPS precision target' },
    { id: 'icon_headset', category: 'esports', title: 'Gaming Headset', symbol: '🎧', desc: 'Surround sound audio rig' },
    { id: 'icon_trophy', category: 'esports', title: 'Tournament Trophy', symbol: '🏆', desc: 'Champion esports winner' },
    { id: 'icon_alien', category: 'esports', title: 'Space Invader', symbol: '👾', desc: 'Retro gaming alien creature' },
    { id: 'icon_bomb', category: 'esports', title: 'Tactical Bomb', symbol: '💣', desc: 'Defuse & tactical plant match' },
    { id: 'icon_racing', category: 'esports', title: 'Sim Racing Wheel', symbol: '🏎️', desc: 'Motorsports simulator cockpit' },
    { id: 'icon_diamond', category: 'esports', title: 'Diamond Tier', symbol: '💎', desc: 'Premium elite master tier' },
    { id: 'icon_fire', category: 'esports', title: 'On Fire Win Streak', symbol: '🔥', desc: 'Hot gaming win streak' },
    { id: 'icon_wrench', category: 'system', title: 'Workshop Wrench', symbol: '🔧', desc: 'Hardware repair & maintenance' },
    { id: 'icon_tools', category: 'system', title: 'Engineer Tools', symbol: '🛠️', desc: 'Technical workbench tuning' },
    { id: 'icon_lock', category: 'system', title: 'Security Padlock', symbol: '🔒', desc: 'Station locked & secured' },
    { id: 'icon_warning', category: 'system', title: 'Hazard Alert', symbol: '⚠️', desc: 'Warning & urgent inspection' },
    { id: 'icon_sleep', category: 'system', title: 'Sleep Standby', symbol: '💤', desc: 'Low-power idle standby' },
    { id: 'icon_offline', category: 'system', title: 'Power Terminated', symbol: '🚫', desc: 'Powered off / disabled' },
    { id: 'icon_skull', category: 'system', title: 'Lost Signal', symbol: '💀', desc: 'Connection dropped / fatal ping' }
  ];

  function getIconSymbol(modelId) {
    if (!modelId) return '🖥️';
    const found = AVAILABLE_ESPORTS_ICONS.find(i => i.id === modelId);
    if (found) return found.symbol;
    if (typeof modelId === 'string' && modelId.startsWith('custom_')) return modelId.replace('custom_', '');
    return '🎮';
  }

  function generateHardwareSvg(model, color, pcId, label, enableStandRgb, pcState, pc, isMini = false) {
    const uid = `${pcId || 'preview'}_${Math.random().toString(36).substr(2, 5)}`;
    const pcClickAttr = '';
    let overlayContent = '';

    if (model && (model.startsWith('icon_') || model.startsWith('custom_'))) {
      const sym = getIconSymbol(model);
      return `
        <div class="real-curved-monitor-wrapper ${isMini ? 'mini-wrapper' : ''}" ${pcClickAttr}>
          <div class="monitor-ambient-glow" style="background: radial-gradient(circle, ${color}45 0%, transparent 70%);"></div>
          <div style="width: 100%; height: ${isMini ? '68px' : '150px'}; display: flex; align-items: center; justify-content: center; position: relative;">
            <div style="width: ${isMini ? '48px' : '100px'}; height: ${isMini ? '48px' : '100px'}; border-radius: ${isMini ? '10px' : '18px'}; background: radial-gradient(circle at center, ${color}22 0%, #080e18 90%); border: ${isMini ? '2px' : '3px'} solid ${color}; box-shadow: 0 0 ${isMini ? '8px' : '18px'} ${color}55; display: flex; align-items: center; justify-content: center; font-size: ${isMini ? '1.6rem' : '3.2rem'}; filter: drop-shadow(0 0 10px ${color});">
              ${sym}
            </div>
          </div>
          <div class="screen-content-overlay">${overlayContent}</div>
        </div>
      `;
    }

    if (model === 'ultrawide') {
      return `
        <div class="real-curved-monitor-wrapper ${isMini ? 'mini-wrapper' : ''}" ${pcClickAttr}>
          <div class="monitor-ambient-glow" style="background: radial-gradient(circle, ${color}35 0%, transparent 70%);"></div>
          <svg class="real-curved-monitor-svg" viewBox="0 0 360 160" fill="none">
            <defs>
              <radialGradient id="uwGlass_${uid}" cx="50%" cy="38%" r="85%">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.95" />
                <stop offset="35%" stop-color="${color}" stop-opacity="0.75" />
                <stop offset="70%" stop-color="${color}" stop-opacity="0.45" />
                <stop offset="92%" stop-color="#04121a" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#020810" stop-opacity="1" />
              </radialGradient>
              <linearGradient id="rainbow_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ff0055" />
                <stop offset="35%" stop-color="#bd00ff" />
                <stop offset="70%" stop-color="#00f3ff" />
                <stop offset="100%" stop-color="#05ffa1" />
              </linearGradient>
            </defs>
            <polygon points="172,60 188,60 185,130 175,130" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
            <rect x="120" y="128" width="120" height="12" rx="6" fill="#111827" stroke="#374151" stroke-width="1.5" />
            <line x1="125" y1="134" x2="235" y2="134" stroke="${enableStandRgb ? `url(#rainbow_${uid})` : color}" stroke-width="3" stroke-linecap="round" />
            <path d="M 12,22 Q 180,10 348,22 L 343,95 Q 180,105 17,95 Z" fill="#0c101a" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" style="filter: drop-shadow(0 0 10px ${color});" />
            <path d="M 15,25 Q 180,13 345,25 L 340,92 Q 180,102 20,92 Z" fill="url(#uwGlass_${uid})" style="filter: drop-shadow(0 0 12px ${color}88);" />
            <path d="M 25,98 Q 180,108 335,98" stroke="${color}" stroke-width="4.5" stroke-linecap="round" style="filter: drop-shadow(0 0 12px ${color});" />
          </svg>
          <div class="screen-content-overlay" style="top: 25px;">
            ${overlayContent}
          </div>
        </div>
      `;
    } else if (model === 'gaming_tower') {
      return `
        <div class="real-curved-monitor-wrapper ${isMini ? 'mini-wrapper' : ''}" ${pcClickAttr}>
          <div class="monitor-ambient-glow" style="background: radial-gradient(circle, ${color}35 0%, transparent 70%);"></div>
          <svg class="real-curved-monitor-svg" viewBox="0 0 200 240" fill="none">
            <defs>
              <linearGradient id="towGlass_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0f172a" stop-opacity="0.95" />
                <stop offset="50%" stop-color="#020617" stop-opacity="0.85" />
                <stop offset="100%" stop-color="${color}" stop-opacity="0.35" />
              </linearGradient>
            </defs>
            <rect x="25" y="15" width="150" height="205" rx="14" fill="#090d16" stroke="${color}" stroke-width="3.5" style="filter: drop-shadow(0 0 10px ${color});" />
            <rect x="35" y="25" width="130" height="185" rx="8" fill="url(#towGlass_${uid})" stroke="#1e293b" stroke-width="1.5" />
            <circle cx="100" cy="65" r="24" stroke="${color}" stroke-width="3" fill="none" style="filter: drop-shadow(0 0 8px ${color});" />
            <circle cx="100" cy="65" r="8" fill="${color}" />
            <circle cx="100" cy="120" r="24" stroke="${color}" stroke-width="3" fill="none" style="filter: drop-shadow(0 0 8px ${color});" />
            <circle cx="100" cy="120" r="8" fill="${color}" />
            <circle cx="100" cy="175" r="24" stroke="${color}" stroke-width="3" fill="none" style="filter: drop-shadow(0 0 8px ${color});" />
            <circle cx="100" cy="175" r="8" fill="${color}" />
            <rect x="35" y="218" width="25" height="8" rx="3" fill="#1e293b" />
            <rect x="140" y="218" width="25" height="8" rx="3" fill="#1e293b" />
            <line x1="30" y1="228" x2="170" y2="228" stroke="${color}" stroke-width="4" stroke-linecap="round" style="filter: drop-shadow(0 0 10px ${color});" />
          </svg>
          <div class="screen-content-overlay" style="top: 55px;">
            ${overlayContent}
          </div>
        </div>
      `;
    } else if (model === 'gaming_laptop') {
      return `
        <div class="real-curved-monitor-wrapper ${isMini ? 'mini-wrapper' : ''}" ${pcClickAttr}>
          <div class="monitor-ambient-glow" style="background: radial-gradient(circle, ${color}35 0%, transparent 70%);"></div>
          <svg class="real-curved-monitor-svg" viewBox="0 0 300 180" fill="none">
            <defs>
              <radialGradient id="lapScreen_${uid}" cx="50%" cy="40%" r="75%">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.95" />
                <stop offset="60%" stop-color="#021424" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#020810" stop-opacity="1" />
              </radialGradient>
            </defs>
            <polygon points="45,15 255,15 265,115 35,115" fill="#090d16" stroke="${color}" stroke-width="3" style="filter: drop-shadow(0 0 10px ${color});" />
            <polygon points="52,22 248,22 258,108 42,108" fill="url(#lapScreen_${uid})" />
            <polygon points="20,118 280,118 295,160 5,160" fill="#0f172a" stroke="#334155" stroke-width="2" />
            <polygon points="48,124 252,124 262,145 38,145" fill="#1e293b" stroke="${color}" stroke-width="1.2" />
            <polygon points="125,148 175,148 177,157 123,157" fill="#111827" stroke="#475569" stroke-width="1" />
            <line x1="15" y1="162" x2="285" y2="162" stroke="${color}" stroke-width="4" stroke-linecap="round" style="filter: drop-shadow(0 0 12px ${color});" />
          </svg>
          <div class="screen-content-overlay" style="top: 25px;">
            ${overlayContent}
          </div>
        </div>
      `;
    } else if (model === 'flat_monitor') {
      return `
        <div class="real-curved-monitor-wrapper ${isMini ? 'mini-wrapper' : ''}" ${pcClickAttr}>
          <div class="monitor-ambient-glow" style="background: radial-gradient(circle, ${color}35 0%, transparent 70%);"></div>
          <svg class="real-curved-monitor-svg" viewBox="0 0 320 185" fill="none">
            <defs>
              <linearGradient id="flatGlass_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.95" />
                <stop offset="40%" stop-color="${color}" stop-opacity="0.75" />
                <stop offset="85%" stop-color="#021424" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#020810" stop-opacity="1" />
              </linearGradient>
            </defs>
            <!-- Heavy Pedestal Base -->
            <polygon points="154,118 166,118 163,148 157,148" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
            <ellipse cx="160" cy="150" rx="55" ry="12" fill="#111827" stroke="${color}" stroke-width="2.5" style="filter: drop-shadow(0 0 8px ${color});" />
            <!-- Tournament Screen Outer Frame -->
            <rect x="22" y="20" width="276" height="98" rx="6" fill="#090d16" stroke="${color}" stroke-width="3.5" style="filter: drop-shadow(0 0 10px ${color});" />
            <rect x="26" y="24" width="268" height="90" rx="4" fill="url(#flatGlass_${uid})" />
            <!-- Bottom Underglow Beam -->
            <line x1="30" y1="123" x2="290" y2="123" stroke="${color}" stroke-width="4" stroke-linecap="round" style="filter: drop-shadow(0 0 10px ${color});" />
          </svg>
          <div class="screen-content-overlay">${overlayContent}</div>
        </div>
      `;
    } else if (model === 'console_rig') {
      return `
        <div class="real-curved-monitor-wrapper ${isMini ? 'mini-wrapper' : ''}" ${pcClickAttr}>
          <div class="monitor-ambient-glow" style="background: radial-gradient(circle, ${color}35 0%, transparent 70%);"></div>
          <svg class="real-curved-monitor-svg" viewBox="0 0 320 185" fill="none">
            <defs>
              <linearGradient id="conGlass_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#0f172a" />
                <stop offset="50%" stop-color="${color}" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#0f172a" />
              </linearGradient>
            </defs>
            <!-- Sleek Console Unit -->
            <rect x="35" y="85" width="250" height="48" rx="10" fill="#090d16" stroke="${color}" stroke-width="3" style="filter: drop-shadow(0 0 10px ${color});" />
            <rect x="42" y="92" width="236" height="34" rx="6" fill="url(#conGlass_${uid})" />
            <line x1="55" y1="108" x2="265" y2="108" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
            <!-- Gamepad Controller On Top -->
            <path d="M 115,50 Q 160,42 205,50 Q 220,72 215,82 Q 195,85 185,75 Q 160,82 135,75 Q 125,85 105,82 Q 100,72 115,50 Z" 
                  fill="#111827" stroke="${color}" stroke-width="2" style="filter: drop-shadow(0 0 6px ${color});" />
            <circle cx="138" cy="66" r="6" fill="${color}" />
            <circle cx="182" cy="66" r="6" fill="${color}" />
            <!-- Console Underglow -->
            <line x1="45" y1="138" x2="275" y2="138" stroke="${color}" stroke-width="4" stroke-linecap="round" style="filter: drop-shadow(0 0 12px ${color});" />
          </svg>
          <div class="screen-content-overlay">${overlayContent}</div>
        </div>
      `;
    } else {
      // Default: 1000R Curved Monitor - Rich, Vibrant, Saturated Display
      return `
        <div class="real-curved-monitor-wrapper ${isMini ? 'mini-wrapper' : ''}" ${pcClickAttr}>
          <div class="monitor-ambient-glow" style="background: radial-gradient(ellipse at 50% 50%, ${color}77 0%, ${color}25 50%, transparent 75%); filter: blur(16px);"></div>
          <div class="stand-rgb-desk-glow"></div>
          <svg class="real-curved-monitor-svg" viewBox="0 0 320 185" fill="none">
            <defs>
              <radialGradient id="curvScreen_${uid}" cx="50%" cy="38%" r="85%">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.95" />
                <stop offset="35%" stop-color="${color}" stop-opacity="0.75" />
                <stop offset="70%" stop-color="${color}" stop-opacity="0.45" />
                <stop offset="92%" stop-color="#04121a" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#020810" stop-opacity="1" />
              </radialGradient>
              <linearGradient id="rainbow_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ff0055"><animate attributeName="stop-color" values="#ff0055;#00f3ff;#05ffa1;#ffb800;#bd00ff;#ff0055" dur="3.5s" repeatCount="indefinite" /></stop>
                <stop offset="35%" stop-color="#bd00ff"><animate attributeName="stop-color" values="#bd00ff;#ff0055;#00f3ff;#05ffa1;#ffb800;#bd00ff" dur="3.5s" repeatCount="indefinite" /></stop>
                <stop offset="70%" stop-color="#00f3ff"><animate attributeName="stop-color" values="#00f3ff;#05ffa1;#ffb800;#bd00ff;#ff0055;#00f3ff" dur="3.5s" repeatCount="indefinite" /></stop>
                <stop offset="100%" stop-color="#05ffa1"><animate attributeName="stop-color" values="#05ffa1;#ffb800;#bd00ff;#ff0055;#00f3ff;#05ffa1" dur="3.5s" repeatCount="indefinite" /></stop>
              </linearGradient>
              <linearGradient id="flare_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
                <stop offset="50%" stop-color="#ffffff" stop-opacity="0.02" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="metal_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#1e293b" /><stop offset="50%" stop-color="#475569" /><stop offset="100%" stop-color="#1e293b" />
              </linearGradient>
            </defs>
            <ellipse cx="160" cy="65" rx="36" ry="36" class="monitor-rear-ring" stroke="${color}" stroke-width="4.5" fill="none" style="filter: drop-shadow(0 0 10px ${color});" />
            <polygon points="152,70 168,70 165,138 155,138" fill="url(#metal_${uid})" stroke="#0f172a" stroke-width="1.5" />
            <ellipse cx="160" cy="112" rx="3.5" ry="7" fill="#0b0f19" stroke="#334155" stroke-width="1" />
            <line x1="158" y1="140" x2="82" y2="165" class="stand-rgb-strip-left" stroke="${enableStandRgb ? `url(#rainbow_${uid})` : color}" stroke-width="3.5" stroke-linecap="round" />
            <line x1="162" y1="140" x2="238" y2="165" class="stand-rgb-strip-right" stroke="${enableStandRgb ? `url(#rainbow_${uid})` : color}" stroke-width="3.5" stroke-linecap="round" />
            <circle cx="160" cy="140" r="3.2" class="stand-rgb-core" fill="${enableStandRgb ? `url(#rainbow_${uid})` : color}" />
            <path class="monitor-outer-bezel" d="M 14,20 Q 160,8 306,20 L 301,118 Q 160,126 19,118 Z" fill="#080e18" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" style="filter: drop-shadow(0 0 12px ${color});" />
            <path class="monitor-screen-glass" d="M 17,23 Q 160,11 303,23 L 298,114 Q 160,122 22,114 Z" fill="url(#curvScreen_${uid})" style="filter: drop-shadow(0 0 12px ${color});" />
            <!-- High-Contrast Saturated Cyber Gaming Display Graphics -->
            <g class="monitor-screen-gaming-hud" pointer-events="none">
              <path d="M 22,86 Q 160,68 298,86" stroke="${color}" stroke-width="2.5" opacity="0.95" fill="none" style="filter: drop-shadow(0 0 8px ${color});" />
              <path d="M 38,96 Q 160,82 282,96" stroke="${color}" stroke-width="1.5" opacity="0.75" fill="none" />
              <polygon points="160,38 178,51 172,74 160,82 148,74 142,51" stroke="#ffffff" stroke-width="2" fill="${color}" fill-opacity="0.6" style="filter: drop-shadow(0 0 10px #ffffff) drop-shadow(0 0 16px ${color});" />
              <circle cx="160" cy="59" r="4.5" fill="#ffffff" style="filter: drop-shadow(0 0 8px #ffffff);" />
              <line x1="85" y1="28" x2="160" y2="82" stroke="${color}" stroke-width="1.2" opacity="0.45" />
              <line x1="235" y1="28" x2="160" y2="82" stroke="${color}" stroke-width="1.2" opacity="0.45" />
            </g>
            <path d="M 17,23 Q 160,11 303,23 L 300,60 Q 160,42 20,60 Z" fill="url(#flare_${uid})" pointer-events="none" />
            <path class="monitor-bottom-chin" d="M 19,113 Q 160,121 301,113 L 300,118 Q 160,126 20,118 Z" fill="#111827" stroke="#1e293b" stroke-width="1.5" />
            <circle cx="160" cy="116" r="2.5" class="monitor-power-dot" fill="${color}" style="filter: drop-shadow(0 0 8px ${color});" />
            <path d="M 28,121 Q 160,129 292,121" class="monitor-underglow-beam" stroke="${color}" stroke-width="4.5" stroke-linecap="round" style="filter: drop-shadow(0 0 16px ${color});" />
          </svg>
          <div class="screen-content-overlay">
            ${overlayContent}
          </div>
        </div>
      `;
    }
  }

  function renderPcsGrid() {
    if (pcsCardsGrid) pcsCardsGrid.className = 'pc-cards-grid view-' + (currentViewMode || 'large');
    pcsCardsGrid.innerHTML = '';

    if (!state.pcs || state.pcs.length === 0) {
      pcsCardsGrid.innerHTML = `
        <div class="empty-pcs-state" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4.5rem 2rem; background: rgba(13, 17, 27, 0.7); border: 2px dashed rgba(0, 243, 255, 0.35); border-radius: 20px; text-align: center; margin: 1.5rem 0;">
          <div style="font-size: 3.8rem; margin-bottom: 1rem; filter: drop-shadow(0 0 15px rgba(0,243,255,0.6));">📡</div>
          <h3 style="font-family: 'Orbitron', 'Segoe UI', sans-serif; color: #00f3ff; font-size: 1.5rem; margin-bottom: 0.6rem; font-weight: 700;">Waiting for Stations to Connect...</h3>
          <p style="color: #94a3b8; font-size: 1rem; max-width: 550px; line-height: 1.7; margin-bottom: 1.8rem;">
            All stations cleared. Once <code>START-CLIENT.bat</code> or the client URL is opened on any arena PC, it will be automatically detected and registered here instantly.
          </p>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">
            <button class="btn btn-primary" id="btnEmptyAddPc" style="padding: 0.7rem 1.4rem; font-size: 0.95rem;">
              <span>➕</span> Add Station Manually
            </button>
            <button class="btn btn-secondary" id="btnEmptyRefresh" style="padding: 0.7rem 1.4rem; font-size: 0.95rem;">
              <span>🔄</span> Scan Network LAN
            </button>
          </div>
        </div>
      `;
      const btnAdd = pcsCardsGrid.querySelector('#btnEmptyAddPc');
      if (btnAdd) btnAdd.addEventListener('click', () => openAddPcModal());
      const btnRef = pcsCardsGrid.querySelector('#btnEmptyRefresh');
      if (btnRef) btnRef.addEventListener('click', () => scanNetworkLan());
      return;
    }

    const filtered = state.pcs.filter(p => {
      if (activeFilter === 'all') return true;
      return p.status === activeFilter;
    });

    if (filtered.length === 0) {
      pcsCardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #64748b;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🔍</div>
          <div style="font-size: 1.1rem; color: #94a3b8;">No stations found matching filter (${activeFilter})</div>
        </div>
      `;
      return;
    }

    filtered.forEach(pc => {
      const card = document.createElement('div');
      card.className = `pc-card status-${pc.status}`;
      if (selectedPcs.has(pc.id)) {
        card.classList.add('card-selected');
      }
      card.id = `card_${pc.id}`;

      card.addEventListener('click', (e) => {
        if (e.target.closest('button, .btn-card-action, a, input, select, textarea')) {
          return;
        }
        handleCardSelect(pc.id, e);
      });

      // Resolve pcState for hardware model & color
      let pcState = 'available';
      if (pc.isMaintenance || pc.status === 'maintenance') {
        pcState = 'maintenance';
      } else if (pc.status === 'offline') {
        pcState = 'offline';
      } else if (pc.status === 'locked') {
        pcState = 'locked';
      } else if (pc.status === 'in_session') {
        if (pc.session && pc.session.type !== 'open' && pc.session.remainingSeconds !== undefined && pc.session.remainingSeconds > 0 && pc.session.remainingSeconds <= 300) {
          pcState = 'lowTime';
        } else if (pc.isAdminSession || (pc.session && (pc.session.isAdmin || pc.session.customerName === 'Admin' || pc.session.customerName === 'Staff'))) {
          pcState = 'admin';
        } else if (pc.session && (pc.session.isMember || pc.session.memberId || (pc.session.customerName && (pc.session.customerName.toLowerCase().includes('member') || pc.session.customerName.toLowerCase().includes('vip'))))) {
          pcState = 'member';
        } else if (pc.session && pc.session.type === 'open') {
          pcState = 'openTime';
        } else {
          pcState = 'fixedTime';
        }
      } else if (pc.isIdle || (pc.isOnline && pc.lastActive && (Date.now() - pc.lastActive > 10 * 60 * 1000))) {
        pcState = 'idle';
      } else if (pc.status === 'available') {
        pcState = 'available';
      } else if (!pc.isOnline || pc.status === 'disconnected') {
        pcState = 'disconnected';
      }

      const stateVisualsMap = (currentVisuals && currentVisuals.stateVisuals) || defaultStateVisuals;
      const stateConf = stateVisualsMap[pcState] || defaultStateVisuals[pcState] || defaultStateVisuals.available;
      const model = pc.customModel || stateConf.model || 'curved_monitor';
      const color = pc.customColor || stateConf.color || '#05ffa1';

      const hardwareModelHtml = generateHardwareSvg(model, color, pc.id, stateConf.label, currentVisuals.enableStandRgb, pcState, pc);

      let middleContent = hardwareModelHtml;
      if (isGridScreenView) {
        const shot = cachedScreenSnapshots[pc.id];
        const shotSrc = (shot && shot.image) ? shot.image : (window.generateStationScreen ? window.generateStationScreen(pc) : '');
        const activeWin = (shot && shot.activeWindow) ? shot.activeWindow : (pc.currentGame || (pc.status === 'in_session' ? 'Cyber Launcher' : (pc.status === 'locked' ? 'Locked Screen' : 'Ready to Play')));

        const isFeedLive = !!shotSrc || pc.status === 'in_session';
        middleContent = `
          <div class="pc-live-screen-feed-wrap ${isFeedLive ? 'feed-active' : ''}" id="screen_feed_${pc.id}">
            <div class="screen-top-bar">
              <span class="screen-live-badge ${pc.status === 'in_session' ? 'active-live' : 'standby-live'}">
                <span class="live-dot-pulse"></span>
                <span>${pc.status === 'in_session' ? 'LIVE' : 'IDLE'}</span>
              </span>
              <span class="screen-res-badge">${pc.specs ? pc.specs.split('•')[0].trim() : '1080p'}</span>
            </div>

            <img id="card_screen_img_${pc.id}" src="${shotSrc}" alt="${pc.name}" style="display:block;" onerror="if(window.generateStationScreen) this.src = window.generateStationScreen(state.pcs.find(p=>p.id==='${pc.id}') || {});">
            
            <div class="screen-empty-placeholder" id="placeholder_${pc.id}" style="display:none;"></div>

            <div class="screen-feed-win-tag" id="card_win_tag_${pc.id}" title="${activeWin}">
              ${activeWin}
            </div>

            <div class="screen-hover-overlay">
              <button class="screen-hover-act-btn btn-hover-zoom" onclick="event.stopPropagation(); openRemoteModal('${pc.id}')" title="Full Remote Desktop & Interactive Control">
                <span>🔍 Zoom & Control</span>
              </button>
              <button class="screen-hover-act-btn btn-hover-shot" onclick="event.stopPropagation(); saveQuickCardSnapshot('${pc.id}')" title="Take Instant Snapshot & Save to Archive">
                <span>📸 Quick Snapshot</span>
              </button>
              <button class="screen-hover-act-btn btn-hover-msg" onclick="event.stopPropagation(); quickCardMessage('${pc.id}')" title="Send Instant Screen Alert Toast">
                <span>💬 Screen Alert</span>
              </button>
            </div>
          </div>
        `;
      }

      const isElapsedType = pc.session ? (pc.session.type === 'open' || pc.session.type === 'admin' || pc.isAdminSession) : false;
      let timerStr = (pc.status === 'in_session' && pc.session)
        ? (isElapsedType ? formatTime(pc.session.elapsedSeconds) : formatTime(pc.session.remainingSeconds))
        : '';
      if (pc.session && pc.session.isPaused) {
        timerStr = `⏸️ ${timerStr} (PAUSED)`;
      }
      const costDisplayVal = (pc.session && (pc.session.type === 'admin' || pc.isAdminSession)) 
        ? '0.00' 
        : ((pc.session && pc.session.totalCost) ? pc.session.totalCost.toFixed(2) : '0.00');
      const costStr = (pc.status === 'in_session' && pc.session)
        ? `<span class="cost-num">${costDisplayVal}</span> <small>EGP</small>`
        : '';
      const isDanger = pc.status === 'in_session' && pc.session && !isElapsedType && (pc.session.remainingSeconds <= 300);

      const vpnBadgeHtml = pc.vpnEnabled ? `
        <div class="pc-vpn-badge" title="Traffic load-balanced via ${pc.vpnServer || 'VPN'} (${pc.vpnServerIp || ''})">
          <span class="vpn-dot"></span> 🛡️ VPN ACTIVE
        </div>
      ` : '';

      // PC card: Name + Status Badge on top, Hardware Icon or Live Screen in middle, Timer directly under hardware icon, Cost under timer
      const stateBadge = stateConf.badgeIcon || '⚡';
      card.innerHTML = `
        <div class="centered-name-header">
          <div class="header-name-row" style="display:flex; align-items:center; justify-content:center; gap:0.4rem; position:relative;">
            <div class="centered-title" title="${pc.specs} • IP: ${pc.ip || '10.10.10.101'}">
              <span class="pc-name-txt">${pc.name}</span>
              <span class="pc-state-indicator-badge" title="${stateConf.label} (${pcState})">${stateBadge}</span>
            </div>
          </div>
          ${vpnBadgeHtml}
        </div>
        ${middleContent}
        <div class="pc-timer-under-device ${isDanger ? 'timer-danger' : ''}" id="timer_${pc.id}">${timerStr}</div>
        <div class="pc-cost-under-timer" id="cost_${pc.id}">${costStr}</div>
      `;

      card.addEventListener('dblclick', () => {
        if (pc.status === 'in_session') {
          openRemoteModal(pc.id);
        } else {
          openStartSessionModal(pc.id, 'open');
        }
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleCardSelect(pc.id, e);
        showPcContextMenu(pc.id, e.clientX, e.clientY);
      });

      pcsCardsGrid.appendChild(card);
    });
  }
  // Update PC Card on second tick
  function updatePcCardLive(pc) {
    const timerEl = document.getElementById(`timer_${pc.id}`);
    const costEl = document.getElementById(`cost_${pc.id}`);
    if (pc.status === 'in_session' && pc.session) {
      const isElapsedType = pc.session.type === 'open' || pc.session.type === 'admin' || pc.isAdminSession;
      const timeVal = isElapsedType 
        ? formatTime(pc.session.elapsedSeconds)
        : formatTime(pc.session.remainingSeconds);

      if (timerEl) {
        timerEl.textContent = timeVal;
        if (!isElapsedType && pc.session.remainingSeconds <= 300) {
          timerEl.className = 'pc-timer-under-device timer-danger';
        } else {
          timerEl.className = 'pc-timer-under-device';
        }
      }

      if (costEl) {
        const costVal = (pc.session.type === 'admin' || pc.isAdminSession) ? '0.00' : (pc.session.totalCost || 0).toFixed(2);
        costEl.innerHTML = `<span class="cost-num">${costVal}</span> <small>EGP</small>`;
      }
    } else {
      if (timerEl) {
        timerEl.textContent = '';
        timerEl.className = 'pc-timer-under-device';
      }
      if (costEl) {
        costEl.innerHTML = '';
      }
    }
  }

  // 2. Render Surveillance Multi-Screen Wall
  function renderSurveillanceGrid() {
    if (!surveillanceGrid) return;
    surveillanceGrid.innerHTML = '';

    state.pcs.forEach(pc => {
      const shot = cachedScreenSnapshots[pc.id];
      const screenSrc = (shot && shot.image) ? shot.image : (window.generateStationScreen ? window.generateStationScreen(pc) : '');
      const activeWin = (shot && shot.activeWindow) ? shot.activeWindow : (pc.currentGame || (pc.status === 'in_session' ? 'Cyber Launcher' : (pc.status === 'locked' ? 'Locked' : 'Desktop')));

      const monitor = document.createElement('div');
      monitor.className = 'monitor-frame-card';
      monitor.innerHTML = `
        <div class="monitor-header">
          <span class="monitor-pc-name">${pc.name}</span>
          <span class="monitor-live-tag" style="background:rgba(0,243,255,0.15); border:1px solid #00f3ff; color:#00f3ff; padding:1px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">144 FPS</span>
          <span id="monitor_win_${pc.id}" class="text-neon-cyan" style="font-size:0.75rem; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${activeWin}">${activeWin}</span>
        </div>
        <div class="monitor-screen-feed">
          <img id="monitor_img_${pc.id}" src="${screenSrc}" alt="${pc.name}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="if(window.generateStationScreen) this.src = window.generateStationScreen(state.pcs.find(p=>p.id==='${pc.id}') || {});">
          <div class="monitor-overlay-hover">
            <button class="btn btn-primary btn-sm" onclick="openRemoteModal('${pc.id}')">
              <span>👁️</span> Interactive View / Control
            </button>
            <button class="btn btn-secondary btn-sm" onclick="saveQuickCardSnapshot('${pc.id}')">
              <span>📸</span> Capture Snapshot
            </button>
          </div>
        </div>
      `;
      surveillanceGrid.appendChild(monitor);
    });
  }

  // 4. Render Cafeteria POS
  let activeCafeCategory = 'all';

  function renderDynamicCafeCategories() {
    const tabsContainer = document.getElementById('posCategoryTabs');
    if (!tabsContainer) return;

    const categoriesSet = new Set();
    (state.menu || []).forEach(m => {
      if (m.category) categoriesSet.add(m.category);
    });

    const defaultCats = ['Cold Drinks', 'Hot Drinks', 'Meals', 'Snacks'];
    defaultCats.forEach(c => categoriesSet.add(c));

    let html = `<button class="pos-cat-btn ${activeCafeCategory === 'all' ? 'active' : ''}" data-pos-cat="all">All</button>`;
    categoriesSet.forEach(cat => {
      const isActive = activeCafeCategory === cat ? 'active' : '';
      let emoji = '📦';
      const cLower = cat.toLowerCase();
      if (cLower.includes('cold') || cLower.includes('drink') || cLower.includes('pepsi')) emoji = '🥤';
      else if (cLower.includes('hot') || cLower.includes('coffee') || cLower.includes('tea')) emoji = '☕';
      else if (cLower.includes('meal') || cLower.includes('food') || cLower.includes('burger')) emoji = '🍜';
      else if (cLower.includes('snack') || cLower.includes('candy') || cLower.includes('chip')) emoji = '🍫';
      html += `<button class="pos-cat-btn ${isActive}" data-pos-cat="${cat}">${cat} ${emoji}</button>`;
    });

    tabsContainer.innerHTML = html;

    tabsContainer.querySelectorAll('.pos-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCafeCategory = btn.dataset.posCat;
        renderCafeteriaPos();
      });
    });
  }

  function renderCafeteriaPos() {
    const grid = document.getElementById('posItemsGrid');
    const targetSelect = document.getElementById('posTargetSelect');
    if (!grid) return;

    grid.innerHTML = '';
    if (targetSelect) {
      targetSelect.innerHTML = '<option value="">🛒 Direct Walk-in Sale (Takeaway)</option>';
      state.pcs.forEach(pc => {
        const opt = document.createElement('option');
        opt.value = pc.id;
        opt.textContent = `💻 ${pc.name} ${pc.status === 'in_session' ? '(In Session)' : ''}`;
        targetSelect.appendChild(opt);
      });
    }

    renderDynamicCafeCategories();

    const menu = state.menu || [];
    const items = menu.filter(item => {
      if (activeCafeCategory === 'all') return true;
      return item.category === activeCafeCategory;
    });

    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2.5rem; font-size: 0.95rem;">No products found in this category. Click "➕ Add Product" above to create one!</div>';
      return;
    }

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'pos-item-card';
      el.innerHTML = `
        <div class="pos-card-manage-bar">
          <button class="btn-pos-manage-btn btn-pos-edit" title="Edit Product" onclick="event.stopPropagation(); window.openEditProductModal('${item.id}');">✏️</button>
          <button class="btn-pos-manage-btn btn-pos-delete" title="Delete Product" onclick="event.stopPropagation(); window.deleteProductItem('${item.id}');">🗑️</button>
        </div>
        <div class="pos-item-icon">${item.icon || '🥤'}</div>
        <div class="pos-item-name">${item.name}</div>
        <div class="pos-item-price">${item.price} EGP</div>
        <div class="pos-item-stock">In Stock: ${item.stock}</div>
      `;

      el.addEventListener('click', () => {
        addPosItemToCart(item);
      });

      grid.appendChild(el);
    });
  }

  // Open Add Product Modal
  window.openAddProductModal = function() {
    const modalId = document.getElementById('productCrudId');
    if (modalId) modalId.value = '';
    const heading = document.getElementById('productCrudHeading');
    if (heading) heading.textContent = 'Add New Product';
    const nameEl = document.getElementById('productCrudName');
    if (nameEl) nameEl.value = '';
    const catEl = document.getElementById('productCrudCategory');
    if (catEl) catEl.value = 'Cold Drinks';
    const priceEl = document.getElementById('productCrudPrice');
    if (priceEl) priceEl.value = '';
    const stockEl = document.getElementById('productCrudStock');
    if (stockEl) stockEl.value = '50';
    const iconEl = document.getElementById('productCrudIcon');
    if (iconEl) iconEl.value = '🥤';
    openModal('modalProductCrud');
  };

  const btnOpenAddProduct = document.getElementById('btnOpenAddProductModal');
  if (btnOpenAddProduct) {
    btnOpenAddProduct.addEventListener('click', window.openAddProductModal);
  }

  // Open Edit Product Modal
  window.openEditProductModal = function(id) {
    const item = (state.menu || []).find(m => m.id === id);
    if (!item) return;

    document.getElementById('productCrudId').value = item.id;
    document.getElementById('productCrudHeading').textContent = `Edit Product (${item.name})`;
    document.getElementById('productCrudName').value = item.name;
    document.getElementById('productCrudCategory').value = item.category || 'Cold Drinks';
    document.getElementById('productCrudPrice').value = item.price;
    document.getElementById('productCrudStock').value = item.stock;
    document.getElementById('productCrudIcon').value = item.icon || '🥤';
    openModal('modalProductCrud');
  };

  // Delete Product Item
  window.deleteProductItem = function(id) {
    const item = (state.menu || []).find(m => m.id === id);
    if (!item) return;

    if (confirm(`Are you sure you want to delete (${item.name}) from cafeteria products?`)) {
      fetch(`/api/menu/${id}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            window.cyberAudio.playWarning();
            if (res.menu) state.menu = res.menu;
            renderCafeteriaPos();
          }
        });
    }
  };

  // Submit Add / Edit Product
  const btnSaveProductSubmit = document.getElementById('btnSaveProductSubmit');
  if (btnSaveProductSubmit) {
    btnSaveProductSubmit.addEventListener('click', () => {
      const id = document.getElementById('productCrudId').value;
      const name = document.getElementById('productCrudName').value.trim();
      const category = document.getElementById('productCrudCategory').value.trim() || 'General';
      const price = parseFloat(document.getElementById('productCrudPrice').value) || 0;
      const stock = parseInt(document.getElementById('productCrudStock').value, 10) || 0;
      const icon = document.getElementById('productCrudIcon').value.trim() || '🥤';

      if (!name) return alert('Product name is required!');
      if (price <= 0) return alert('Please enter a valid price in EGP!');

      const isUpdate = !!id;
      const url = isUpdate ? `/api/menu/${id}` : '/api/menu/add';
      const method = isUpdate ? 'PUT' : 'POST';

      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, price, stock, icon })
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          window.cyberAudio.playUnlock();
          closeModal('modalProductCrud');
          if (res.menu) state.menu = res.menu;
          renderCafeteriaPos();
        } else {
          alert(res.error || 'Failed to save product');
        }
      });
    });
  }

  function addPosItemToCart(item) {
    window.cyberAudio.playClick();
    const existing = posCart.find(c => c.itemId === item.id);
    if (existing) {
      existing.qty++;
    } else {
      posCart.push({ itemId: item.id, name: item.name, price: item.price, qty: 1 });
    }
    renderPosCart();
  }

  function renderPosCart() {
    const list = document.getElementById('posCartList');
    const totalEl = document.getElementById('posCartTotal');
    const btnConfirm = document.getElementById('btnConfirmPosSale');

    if (posCart.length === 0) {
      list.innerHTML = '<p class="empty-text">Select items from menu to add</p>';
      totalEl.textContent = '0.00';
      btnConfirm.disabled = true;
      return;
    }

    list.innerHTML = '';
    let total = 0;

    posCart.forEach((it, idx) => {
      total += it.price * it.qty;
      const row = document.createElement('div');
      row.className = 'receipt-row';
      row.innerHTML = `
        <span>${it.name} (${it.qty}×)</span>
        <div>
          <b>${it.price * it.qty} EGP</b>
          <button style="background:transparent; border:none; color:#ff0055; margin-right:8px; cursor:pointer;" onclick="deletePosCartItem(${idx})">✖</button>
        </div>
      `;
      list.appendChild(row);
    });

    totalEl.textContent = total.toFixed(2);
    btnConfirm.disabled = false;
  }

  window.deletePosCartItem = function(idx) {
    posCart.splice(idx, 1);
    renderPosCart();
  };

  document.getElementById('btnConfirmPosSale').addEventListener('click', () => {
    const targetPcId = document.getElementById('posTargetSelect').value;
    
    // Process items
    posCart.forEach(it => {
      fetch('/api/orders/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pcId: targetPcId || null,
          itemId: it.itemId,
          qty: it.qty
        })
      });
    });

    window.cyberAudio.playCash();
    posCart = [];
    renderPosCart();
    alert('Order completed successfully!');
    fetchState();
  });

  function renderIncomingClientOrdersQueue() {
    const list = document.getElementById('clientOrdersQueueList');
    list.innerHTML = '';

    let hasOrders = false;
    state.pcs.forEach(pc => {
      if (pc.orders && pc.orders.length > 0) {
        pc.orders.forEach(o => {
          hasOrders = true;
          const div = document.createElement('div');
          div.className = 'queue-order-item';
          div.innerHTML = `
            <div>
              <b>${pc.name}</b>: ${o.qty}× ${o.name} (${o.total} EGP)
              <br><small style="color:#888;">${o.time}</small>
            </div>
            <span class="text-green">Ready to Deliver ✔️</span>
          `;
          list.appendChild(div);
        });
      }
    });

    if (!hasOrders) {
      list.innerHTML = '<p class="empty-text">No pending client orders</p>';
    }
  }

  // 5. Render Invoices Table
  function renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const invoicesCount = document.getElementById('invoicesCount');
    if (invoicesCount) invoicesCount.textContent = (state.invoices || []).length;

    (state.invoices || []).forEach(inv => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b>${inv.id}</b></td>
        <td>${inv.pcName}</td>
        <td>${inv.customerName || 'Guest'}</td>
        <td>${inv.durationMinutes} min</td>
        <td>${inv.gameCost} EGP</td>
        <td>${inv.ordersCost} EGP</td>
        <td>${inv.discount} EGP</td>
        <td><b class="text-green">${inv.totalAmount} EGP</b></td>
        <td><span class="badge-tag">${inv.paymentMethod}</span></td>
        <td>${new Date(inv.endTime).toLocaleTimeString('ar-EG')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 6. Render Audit Log
  function renderAuditLog() {
    const list = document.getElementById('auditLogList') || document.getElementById('auditListContainer');
    if (!list) return;
    list.innerHTML = '';

    (state.auditLog || []).forEach(a => {
      const div = document.createElement('div');
      div.className = `audit-item level-${a.level}`;
      div.innerHTML = `
        <div>
          <b>${a.action}</b>: ${a.details}
        </div>
        <div style="font-family: monospace; font-size: 0.8rem; color: #888;">
          ${a.timeFormatted}
        </div>
      `;
      list.appendChild(div);
    });
  }

  // -------------------------------------------------------------
  // REMOTE DESKTOP & SCREEN CONTROL ENGINE
  // -------------------------------------------------------------
  window.openRemoteModal = function(pcId) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc) return;

    activeRemotePcId = pcId;
    window.cyberAudio.playClick();

    document.getElementById('remoteModalPcName').textContent = pc.name;
    document.getElementById('remoteModalPcSpecs').textContent = pc.specs;
    document.getElementById('remoteModalActiveGame').textContent = pc.currentGame || (pc.status === 'in_session' ? 'Cyber Launcher' : 'Locked Screen');

    // Default to View Only
    setRemoteMode('view_only');

    // Immediately draw active screen to canvas so viewer is instant!
    const shot = cachedScreenSnapshots[pcId];
    const screenSrc = (shot && shot.image) ? shot.image : (window.generateStationScreen ? window.generateStationScreen(pc) : '');
    if (screenSrc) {
      const img = new Image();
      img.onload = () => {
        if (remoteScreenCtx && remoteScreenCanvas) {
          remoteScreenCtx.drawImage(img, 0, 0, remoteScreenCanvas.width, remoteScreenCanvas.height);
        }
      };
      img.src = screenSrc;
    }

    // Notify server to start screen stream
    socket.emit('admin_request_screen', {
      pcId,
      mode: activeRemoteMode
    });

    document.getElementById('remoteControlModal').classList.add('active');
  };

  function setRemoteMode(mode) {
    activeRemoteMode = mode;
    const btnView = document.getElementById('btnModeViewOnly');
    const btnControl = document.getElementById('btnModeFullControl');

    if (mode === 'view_only') {
      btnView.classList.add('active');
      btnControl.classList.remove('active');
      remoteWatermark.textContent = 'Surveillance Mode (View Only - Stealth)';
      remoteScreenCanvas.style.cursor = 'default';
    } else {
      btnControl.classList.add('active');
      btnView.classList.remove('active');
      remoteWatermark.textContent = 'Remote Control Mode (Interactive Mouse & Keyboard)';
      remoteScreenCanvas.style.cursor = 'crosshair';
    }

    if (activeRemotePcId) {
      socket.emit('admin_request_screen', {
        pcId: activeRemotePcId,
        mode
      });
    }
  }

  document.getElementById('btnModeViewOnly').addEventListener('click', () => setRemoteMode('view_only'));
  document.getElementById('btnModeFullControl').addEventListener('click', () => setRemoteMode('full_control'));

  // Transmit Mouse / Keyboard Events when in Full Remote Control
  remoteScreenCanvas.addEventListener('mousemove', (e) => {
    if (activeRemoteMode !== 'full_control' || !activeRemotePcId) return;
    const rect = remoteScreenCanvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    socket.emit('remote_input_event', {
      pcId: activeRemotePcId,
      type: 'mousemove',
      x: xRatio,
      y: yRatio
    });
  });

  remoteScreenCanvas.addEventListener('mousedown', (e) => {
    if (activeRemoteMode !== 'full_control' || !activeRemotePcId) return;
    const rect = remoteScreenCanvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    socket.emit('remote_input_event', {
      pcId: activeRemotePcId,
      type: 'mousedown',
      x: xRatio,
      y: yRatio,
      button: e.button
    });
  });

  // Close Remote Modal
  document.getElementById('btnCloseRemoteModal').addEventListener('click', () => {
    if (activeRemotePcId) {
      socket.emit('admin_stop_screen', { pcId: activeRemotePcId });
    }
    activeRemotePcId = null;
    document.getElementById('remoteControlModal').classList.remove('active');
  });

  // Remote Actions
  document.getElementById('btnRemoteScreenshot').addEventListener('click', () => {
    if (!activeRemotePcId) return;
    const link = document.createElement('a');
    link.download = `CyberPulse_Screenshot_${activeRemotePcId}_${Date.now()}.jpg`;
    link.href = remoteScreenCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
    window.cyberAudio.playCash();
  });

  document.getElementById('btnRemoteKillGame').addEventListener('click', () => {
    if (!activeRemotePcId) return;
    if (confirm(`Are you sure you want to terminate the game on ${activeRemotePcId} remotely?`)) {
      socket.emit('admin_kill_game', { pcId: activeRemotePcId });
    }
  });

  document.getElementById('btnRemoteSendMessage').addEventListener('click', () => {
    if (!activeRemotePcId) return;
    const msg = prompt(`Enter notification toast to display on screen of ${activeRemotePcId}:`);
    if (msg) {
      socket.emit('admin_send_message', { pcId: activeRemotePcId, message: msg });
      alert('Toast notification sent to player screen!');
    }
  });

  document.getElementById('btnRemoteLock').addEventListener('click', () => {
    if (!activeRemotePcId) return;
    toggleLockPc(activeRemotePcId);
  });

  // -------------------------------------------------------------
  // START SESSION MODAL & LOGIC
  // -------------------------------------------------------------
  window.openStartSessionModal = function(pcId, defaultType = 'open') {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc) return;

    if (pc.status === 'in_session') {
      openCheckoutModal(pc.id);
      return;
    }

    if (window.cyberAudio && window.cyberAudio.playClick) {
      window.cyberAudio.playClick();
    }
    document.getElementById('startModalPcId').value = pc.id;
    document.getElementById('startModalPcName').textContent = pc.name;
    document.getElementById('startCustomerName').value = '';

    selectedStartSessionType = defaultType;
    document.querySelectorAll('.session-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stype === defaultType);
    });
    document.getElementById('amountPresetsSection').style.display = defaultType === 'fixed_amount' ? 'block' : 'none';
    document.getElementById('timePresetsSection').style.display = defaultType === 'fixed_time' ? 'block' : 'none';
    document.getElementById('openTimeNoteSection').style.display = defaultType === 'open' ? 'block' : 'none';
    const adminNote = document.getElementById('adminNoteSection');
    if (adminNote) adminNote.style.display = defaultType === 'admin' ? 'block' : 'none';

    openModal('startSessionModal');
  };

  window.quickStartOpenTime = function(pcId) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc) return;
    if (pc.status === 'in_session') {
      openCheckoutModal(pc.id);
      return;
    }

    fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pcId: pc.id,
        type: 'open',
        customerName: 'Guest Player'
      })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        if (window.cyberAudio && window.cyberAudio.playUnlock) {
          window.cyberAudio.playUnlock();
        }
        const localPc = state.pcs.find(p => p.id === pc.id);
        if (localPc) {
          localPc.status = res.pc.status;
          localPc.session = res.pc.session;
          renderPcsGrid();
        }
        fetchState();
      } else {
        alert(res.error || 'Failed to start open time session');
      }
    }).catch(err => {
      alert('Network error while starting open time: ' + err.message);
    });
  };

  // Switch session type tabs
  document.querySelectorAll('.session-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.session-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStartSessionType = btn.dataset.stype;

      document.getElementById('amountPresetsSection').style.display = selectedStartSessionType === 'fixed_amount' ? 'block' : 'none';
      document.getElementById('timePresetsSection').style.display = selectedStartSessionType === 'fixed_time' ? 'block' : 'none';
      document.getElementById('openTimeNoteSection').style.display = selectedStartSessionType === 'open' ? 'block' : 'none';
      const adminNote = document.getElementById('adminNoteSection');
      if (adminNote) adminNote.style.display = selectedStartSessionType === 'admin' ? 'block' : 'none';
    });
  });

  // Quick Amount presets
  document.querySelectorAll('[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-amount]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('customAmountInput').value = btn.dataset.amount;
    });
  });

  // Quick Time presets
  document.querySelectorAll('[data-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-minutes]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('customMinutesInput').value = btn.dataset.minutes;
    });
  });

  document.getElementById('btnConfirmStartSession').addEventListener('click', () => {
    const pcId = document.getElementById('startModalPcId').value;
    const customerName = document.getElementById('startCustomerName').value.trim() || 'Guest Player';
    const amount = document.getElementById('customAmountInput').value;
    const durationMinutes = document.getElementById('customMinutesInput').value;
    const sessionType = selectedStartSessionType || 'open';

    if (sessionType === 'admin') {
      closeModal('startSessionModal');
      startAdminSession(pcId);
      return;
    }

    fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pcId,
        type: sessionType,
        amount: parseFloat(amount) || 20,
        durationMinutes: parseInt(durationMinutes) || 60,
        customerName
      })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        if (window.cyberAudio && window.cyberAudio.playUnlock) {
          window.cyberAudio.playUnlock();
        }
        closeModal('startSessionModal');
        const localPc = state.pcs.find(p => p.id === pcId);
        if (localPc) {
          localPc.status = res.pc.status;
          localPc.session = res.pc.session;
          renderPcsGrid();
        }
        fetchState();
      } else {
        alert(res.error || 'Error occurred while starting session');
      }
    }).catch(err => {
      alert('Network error while starting session: ' + err.message);
    });
  });

  // -------------------------------------------------------------
  // CHECKOUT & CLOSE SESSION MODAL & LOGIC
  // -------------------------------------------------------------
  window.openCheckoutModal = function(pcId) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc || !pc.session) return;

    window.cyberAudio.playClick();
    document.getElementById('checkoutPcId').value = pc.id;
    document.getElementById('checkoutPcName').textContent = pc.name;
    document.getElementById('checkoutElapsed').textContent = Math.round(pc.session.elapsedSeconds / 60);
    document.getElementById('checkoutGameCost').textContent = pc.session.gameCost.toFixed(2);
    document.getElementById('checkoutOrdersCost').textContent = pc.session.ordersCost.toFixed(2);
    document.getElementById('checkoutDiscountInput').value = '0';

    const ordersList = document.getElementById('checkoutOrdersList');
    ordersList.innerHTML = '';
    (pc.orders || []).forEach(o => {
      const line = document.createElement('div');
      line.className = 'receipt-row';
      line.style.fontSize = '0.85rem';
      line.style.color = '#ffb800';
      line.innerHTML = `<span>• ${o.qty}× ${o.name}</span><span>${o.total} EGP</span>`;
      ordersList.appendChild(line);
    });

    updateCheckoutFinalTotal();
    openModal('checkoutModal');
  };

  function updateCheckoutFinalTotal() {
    const pcId = document.getElementById('checkoutPcId').value;
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc || !pc.session) return;

    const discount = parseFloat(document.getElementById('checkoutDiscountInput').value) || 0;
    const raw = pc.session.gameCost + pc.session.ordersCost;
    const finalVal = Math.max(0, raw - discount);
    document.getElementById('checkoutFinalTotal').textContent = finalVal.toFixed(2);
  }

  document.getElementById('checkoutDiscountInput').addEventListener('input', updateCheckoutFinalTotal);

  document.getElementById('btnConfirmCheckout').addEventListener('click', () => {
    const pcId = document.getElementById('checkoutPcId').value;
    const discount = document.getElementById('checkoutDiscountInput').value;
    const activePayBtn = document.querySelector('.pay-btn.active');
    const paymentMethod = activePayBtn ? activePayBtn.dataset.pay : 'cash';

    fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pcId,
        discount,
        paymentMethod
      })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        window.cyberAudio.playCash();
        closeModal('checkoutModal');
        fetchState();
      } else {
        alert(res.error || 'Error occurred while closing session');
      }
    });
  });

  // Payment Tabs Switch
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // -------------------------------------------------------------
  // TRANSFER SESSION
  // -------------------------------------------------------------
  window.openTransferModal = function(fromPcId) {
    const fromPc = state.pcs.find(p => p.id === fromPcId);
    if (!fromPc || !fromPc.session) return;

    document.getElementById('transferFromPcId').value = fromPc.id;
    document.getElementById('transferFromPcName').textContent = fromPc.name;

    const select = document.getElementById('transferToSelect');
    select.innerHTML = '';

    const availPcs = state.pcs.filter(p => p.status === 'available' && p.id !== fromPc.id);
    if (availPcs.length === 0) {
      alert('No other available PCs to transfer session to!');
      return;
    }

    availPcs.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.specs})`;
      select.appendChild(opt);
    });

    openModal('transferModal');
  };

  document.getElementById('btnConfirmTransfer').addEventListener('click', () => {
    const fromPcId = document.getElementById('transferFromPcId').value;
    const toPcId = document.getElementById('transferToSelect').value;

    fetch('/api/session/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromPcId, toPcId })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        window.cyberAudio.playUnlock();
        closeModal('transferModal');
        alert('Session transferred successfully!');
        fetchState();
      } else {
        alert(res.error || 'Failed to transfer session');
      }
    });
  });

  // -------------------------------------------------------------
  // CLOSE SHIFT MODAL & LOGIC
  // -------------------------------------------------------------
  document.getElementById('btnCloseShiftModal').addEventListener('click', () => {
    const totalRev = (state.shift.totalGameRevenue || 0) + (state.shift.totalCafeRevenue || 0);
    const expected = (state.shift.startDrawerCash || 0) + totalRev;

    document.getElementById('closeExpectedCash').textContent = expected.toFixed(2);
    document.getElementById('closeGameRev').textContent = `${(state.shift.totalGameRevenue || 0).toFixed(2)} EGP`;
    document.getElementById('closeCafeRev').textContent = `${(state.shift.totalCafeRevenue || 0).toFixed(2)} EGP`;
    document.getElementById('closeActualCashInput').value = expected.toFixed(2);

    openModal('closeShiftModal');
  });

  document.getElementById('btnConfirmCloseShift').addEventListener('click', () => {
    const actualCash = document.getElementById('closeActualCashInput').value;
    const notes = document.getElementById('closeShiftNotes').value;

    fetch('/api/shift/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actualCashInDrawer: parseFloat(actualCash),
        notes
      })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        window.cyberAudio.playCash();
        closeModal('closeShiftModal');
        alert(`Shift closed successfully!\nDrawer discrepancy: ${res.closedShift.difference} EGP`);
        fetchState();
      }
    });
  });

  // Toggle Remote Lock
  window.toggleLockPc = function(pcId) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc) return;
    const shouldLock = pc.status !== 'locked';

    fetch('/api/remote/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pcId, lock: shouldLock })
    }).then(() => fetchState());
  };

  // Quick Add Snack directly from PC card
  window.openQuickAddSnack = function(pcId) {
    // Switch to cafeteria tab and preselect this PC
    switchTab('cafeteriaTab');
    const select = document.getElementById('posTargetSelect');
    select.value = pcId;
  };

  // Tab switching (Persistent View)
  function switchTab(tabId) {
    if (!tabId) return;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === tabId);
    });
    localStorage.setItem('cyber_active_tab', tabId);
    if (tabId === 'surveillanceTab') {
      fetchLiveScreenSnapshots();
      renderSurveillanceGrid();
    }
    if (window.cyberAudio && window.cyberAudio.playClick) {
      window.cyberAudio.playClick();
    }
  }

  document.querySelectorAll('.nav-tab').forEach(t => {
    t.addEventListener('click', () => {
      switchTab(t.dataset.tab);
    });
  });

  // Filter chips (Persistent Selection)
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      localStorage.setItem('cyber_active_filter', activeFilter);
      renderPcsGrid();
    });
  });

  // -------------------------------------------------------------
  // GRID VIEW SWITCHER CONTROLLER
  // -------------------------------------------------------------
  const viewModeSelect = document.getElementById('viewModeSelect');
  function applyViewMode(mode) {
    if (!mode) mode = 'large';
    currentViewMode = mode;
    localStorage.setItem('cyber_view_mode', mode);
    if (pcsCardsGrid) {
      pcsCardsGrid.className = 'pc-cards-grid view-' + mode;
    }
    if (viewModeSelect && viewModeSelect.value !== mode) {
      viewModeSelect.value = mode;
    }
    // Sync to backend viewMode settings
    fetch('/api/settings/view-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewMode: mode })
    }).catch(() => {});
  }

  if (viewModeSelect) {
    viewModeSelect.value = currentViewMode || 'large';
    viewModeSelect.addEventListener('change', () => {
      applyViewMode(viewModeSelect.value);
      if (window.cyberAudio && window.cyberAudio.playClick) {
        window.cyberAudio.playClick();
      }
    });
  }
  // Initialize view mode immediately
  applyViewMode(currentViewMode);

  // -------------------------------------------------------------
  // [EN]
  // -------------------------------------------------------------
  const gamePosterPresets = {
    valorant: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80',
    cs2: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=500&auto=format&fit=crop&q=80',
    cod: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=80',
    lol: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=80',
    fc25: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop&q=80',
    gta5: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&auto=format&fit=crop&q=80',
    fortnite: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=500&auto=format&fit=crop&q=80'
  };

  window.setGamePosterPreset = function(presetKey) {
    if (gamePosterPresets[presetKey]) {
      document.getElementById('gamePosterInput').value = gamePosterPresets[presetKey];
    }
  };

  let selectedGameCategory = 'all';

  function renderGameCategoryFilterTabs() {
    const bar = document.getElementById('gameCategoriesFilterBar');
    if (!bar) return;

    const cats = new Set();
    (state.games || []).forEach(g => {
      if (g.category) cats.add(g.category);
    });

    const defaultGameCats = ['Shooters', 'Battle Royale', 'MOBA', 'Sports', 'Open World', 'Apps & Tools', 'Browsers', 'Design & Media', 'Emulators'];
    defaultGameCats.forEach(c => cats.add(c));

    let html = `<button class="pos-cat-btn ${selectedGameCategory === 'all' ? 'active' : ''}" data-game-cat="all">All Titles</button>`;
    cats.forEach(c => {
      const isActive = selectedGameCategory === c ? 'active' : '';
      html += `<button class="pos-cat-btn ${isActive}" data-game-cat="${c}">${c}</button>`;
    });

    bar.innerHTML = html;
    bar.querySelectorAll('.pos-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedGameCategory = btn.dataset.gameCat;
        renderMasterGames();
      });
    });
  }

  function renderMasterGames() {
    const grid = document.getElementById('masterGamesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    renderGameCategoryFilterTabs();

    const games = (state.games || []).filter(g => {
      if (selectedGameCategory === 'all') return true;
      return g.category === selectedGameCategory;
    });

    if (games.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2.5rem; font-size: 0.95rem;">No titles found in this category. Click "➕ Add Title" above to configure games, apps, or scripts!</div>';
      return;
    }

    games.forEach(game => {
      const isBat = (game.executable || '').toLowerCase().endsWith('.bat') || (game.executable || '').toLowerCase().endsWith('.cmd');
      const exeBadge = game.executable 
        ? (isBat ? '<span style="background:rgba(255,184,0,0.2); border:1px solid rgba(255,184,0,0.5); color:#ffb800; padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:800; margin-left:4px;">BAT SCRIPT</span>' : '<span style="background:rgba(0,243,255,0.2); border:1px solid rgba(0,243,255,0.5); color:#00f3ff; padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:800; margin-left:4px;">EXE BINARY</span>')
        : '';

      const card = document.createElement('div');
      card.className = 'master-game-card';
      card.innerHTML = `
        <div class="master-poster-wrap">
          <img src="${game.poster}" class="master-poster-img" alt="${game.title}" onerror="this.src='https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&q=80'">
          <span class="game-category-badge">${game.category}</span>
        </div>
        <div class="master-game-details">
          <div>
            <div class="game-title-text">${game.title}</div>
            <div class="game-developer-text">Studio: ${game.developer || 'Not Specified'}</div>
          </div>
          <div class="game-exe-path" title="${game.executable || 'Auto Path'}">
            📁 ${game.executable || 'Default Windows executable path'} ${exeBadge}
          </div>
          <div class="master-card-actions">
            <button class="btn btn-sm btn-game-edit" onclick="openEditGameModal('${game.id}')">
              <span>✏️</span> Edit
            </button>
            <button class="btn btn-sm btn-game-delete" onclick="deleteGame('${game.id}')">
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // Handle custom category toggle
  const gameCatSelect = document.getElementById('gameCategoryInput');
  const gameCustomCatInput = document.getElementById('gameCustomCategoryInput');
  if (gameCatSelect && gameCustomCatInput) {
    gameCatSelect.addEventListener('change', () => {
      if (gameCatSelect.value === '__custom__') {
        gameCustomCatInput.style.display = 'block';
        gameCustomCatInput.focus();
      } else {
        gameCustomCatInput.style.display = 'none';
      }
    });
  }

  // Open Add Game Modal
  const btnOpenAddGame = document.getElementById('btnOpenAddGameModal');
  if (btnOpenAddGame) {
    btnOpenAddGame.addEventListener('click', () => {
      document.getElementById('gameModalId').value = '';
      document.getElementById('gameModalHeading').textContent = 'Add New Title (Game / App / Script)';
      document.getElementById('gameTitleInput').value = '';
      if (gameCatSelect) gameCatSelect.value = 'Shooters';
      if (gameCustomCatInput) {
        gameCustomCatInput.value = '';
        gameCustomCatInput.style.display = 'none';
      }
      document.getElementById('gameDeveloperInput').value = '';
      document.getElementById('gamePosterInput').value = '';
      document.getElementById('gameExecutableInput').value = '';
      openModal('gameModal');
    });
  }

  window.openEditGameModal = function(gameId) {
    const game = (state.games || []).find(g => g.id === gameId);
    if (!game) return;

    document.getElementById('gameModalId').value = game.id;
    document.getElementById('gameModalHeading').textContent = `Edit Title (${game.title})`;
    document.getElementById('gameTitleInput').value = game.title;
    
    // Check if category is in select options
    let hasOption = false;
    if (gameCatSelect) {
      for (let i = 0; i < gameCatSelect.options.length; i++) {
        if (gameCatSelect.options[i].value === game.category) {
          hasOption = true;
          break;
        }
      }
      if (hasOption) {
        gameCatSelect.value = game.category;
        if (gameCustomCatInput) gameCustomCatInput.style.display = 'none';
      } else {
        gameCatSelect.value = '__custom__';
        if (gameCustomCatInput) {
          gameCustomCatInput.style.display = 'block';
          gameCustomCatInput.value = game.category || '';
        }
      }
    }

    document.getElementById('gameDeveloperInput').value = game.developer || '';
    document.getElementById('gamePosterInput').value = game.poster || '';
    document.getElementById('gameExecutableInput').value = game.executable || '';

    openModal('gameModal');
  };

  window.deleteGame = function(gameId) {
    const game = (state.games || []).find(g => g.id === gameId);
    if (!game) return;

    if (confirm(`Are you sure you want to delete (${game.title}) from the launcher library?`)) {
      fetch(`/api/games/${gameId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            window.cyberAudio.playWarning();
            if (res.games) state.games = res.games;
            renderMasterGames();
          }
        });
    }
  };

  // Save Game (Add or Update)
  const btnSaveGame = document.getElementById('btnSaveGameSubmit');
  if (btnSaveGame) {
    btnSaveGame.addEventListener('click', () => {
      const id = document.getElementById('gameModalId').value;
      const title = document.getElementById('gameTitleInput').value.trim();
      let category = gameCatSelect ? gameCatSelect.value : 'Shooters';
      if (category === '__custom__') {
        category = (gameCustomCatInput && gameCustomCatInput.value.trim()) || 'General';
      }
      const developer = document.getElementById('gameDeveloperInput').value.trim();
      const poster = document.getElementById('gamePosterInput').value.trim();
      const executable = document.getElementById('gameExecutableInput').value.trim();

      if (!title) return alert('Title is required!');

      const isUpdate = !!id;
      const url = isUpdate ? `/api/games/update/${id}` : '/api/games/add';
      const method = isUpdate ? 'PUT' : 'POST';

      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, developer, poster, executable })
      }).then(r => r.json()).then(res => {
        if (res.success) {
          window.cyberAudio.playUnlock();
          closeModal('gameModal');
          if (res.games) state.games = res.games;
          renderMasterGames();
        } else {
          alert(res.error || 'Error occurred while saving');
        }
      });
    });
  }

  // -------------------------------------------------------------
  // SHOP BRANDING & CUSTOM LOUNGE IDENTITY
  // -------------------------------------------------------------
  function applyBranding(branding) {
    if (!branding) return;
    if (branding.shopName) {
      const elName = document.getElementById('brandShopName');
      if (elName) elName.textContent = branding.shopName;
      const setInput = document.getElementById('settingShopName');
      if (setInput) setInput.value = branding.shopName;
      const modalInput = document.getElementById('modalBrandingName');
      if (modalInput) modalInput.value = branding.shopName;
      document.title = branding.shopName + ' - Gaming Lounge Management System';
    }
    if (branding.shopSubtitle !== undefined) {
      const elSub = document.getElementById('brandShopSub');
      if (elSub) elSub.textContent = branding.shopSubtitle;
      const setSub = document.getElementById('settingShopSub');
      if (setSub) setSub.value = branding.shopSubtitle;
      const modalSub = document.getElementById('modalBrandingSub');
      if (modalSub) modalSub.value = branding.shopSubtitle;
    }
    if (branding.shopLogo) {
      const elLogo = document.getElementById('brandLogoIcon');
      if (elLogo) elLogo.textContent = branding.shopLogo;
      const setLogo = document.getElementById('settingShopLogo');
      if (setLogo) setLogo.value = branding.shopLogo;
      const modalLogo = document.getElementById('modalBrandingLogo');
      if (modalLogo) modalLogo.value = branding.shopLogo;
    }
  }

  // Header Brand click opens quick customize modal
  const headerBrandWrap = document.getElementById('headerBrandWrap');
  if (headerBrandWrap) {
    headerBrandWrap.addEventListener('click', () => {
      const currentName = document.getElementById('brandShopName') ? document.getElementById('brandShopName').textContent : 'CYBERPULSE OS';
      const currentSub = document.getElementById('brandShopSub') ? document.getElementById('brandShopSub').textContent : '';
      const currentLogo = document.getElementById('brandLogoIcon') ? document.getElementById('brandLogoIcon').textContent : '⚡';
      if (document.getElementById('modalBrandingName')) document.getElementById('modalBrandingName').value = currentName;
      if (document.getElementById('modalBrandingSub')) document.getElementById('modalBrandingSub').value = currentSub;
      if (document.getElementById('modalBrandingLogo')) document.getElementById('modalBrandingLogo').value = currentLogo;
      openModal('modalEditBranding');
    });
  }

  // Submit modal branding
  const btnSubmitModalBranding = document.getElementById('btnSubmitModalBranding');
  if (btnSubmitModalBranding) {
    btnSubmitModalBranding.addEventListener('click', () => {
      const shopName = document.getElementById('modalBrandingName').value.trim();
      const shopSubtitle = document.getElementById('modalBrandingSub').value.trim();
      const shopLogo = document.getElementById('modalBrandingLogo').value.trim() || '⚡';
      if (!shopName) return alert('Shop name cannot be empty!');

      fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopName, shopSubtitle, shopLogo })
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          applyBranding(res.branding);
          closeModal('modalEditBranding');
          window.cyberAudio.playSuccess();
        }
      });
    });
  }

  // Save branding from Settings section
  const btnSaveBrandingSettings = document.getElementById('btnSaveBrandingSettings');
  if (btnSaveBrandingSettings) {
    btnSaveBrandingSettings.addEventListener('click', () => {
      const shopName = document.getElementById('settingShopName').value.trim();
      const shopSubtitle = document.getElementById('settingShopSub').value.trim();
      const shopLogo = document.getElementById('settingShopLogo').value.trim() || '⚡';
      if (!shopName) return alert('Shop name cannot be empty!');

      fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopName, shopSubtitle, shopLogo })
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          applyBranding(res.branding);
          window.cyberAudio.playSuccess();
          alert('Shop identity & branding saved successfully!');
        }
      });
    });
  }

  // -------------------------------------------------------------
  // SCREENSHOT GALLERY & REMOTE DESKTOP ACTIONS
  // -------------------------------------------------------------
  function renderScreenshotsGallery() {
    const grid = document.getElementById('screenshotsGalleryGrid');
    const badge = document.getElementById('screenshotsCountBadge');
    if (!grid) return;

    const screenshots = state.screenshots || [];
    if (badge) badge.textContent = `${screenshots.length} snapshots saved`;

    if (screenshots.length === 0) {
      grid.innerHTML = '<p class="empty-text">No snapshots captured yet</p>';
      return;
    }

    grid.innerHTML = '';
    screenshots.forEach(shot => {
      const card = document.createElement('div');
      card.className = 'shot-card';
      card.innerHTML = `
        <div class="shot-img-wrap">
          <img src="${shot.image}" alt="${shot.pcId}">
        </div>
        <div class="shot-meta-bar">
          <b class="text-neon-cyan">${shot.pcId}</b>
          <small class="text-muted">${shot.timeFormatted}</small>
        </div>
      `;

      card.addEventListener('click', () => {
        document.getElementById('previewShotTitle').textContent = `Security Screenshot - ${shot.pcId}`;
        document.getElementById('previewShotImg').src = shot.image;
        document.getElementById('previewShotMeta').textContent = `Capture Date: ${shot.timeFormatted} (${shot.note || ''})`;
        
        document.getElementById('btnDownloadPreviewShot').onclick = () => {
          const a = document.createElement('a');
          a.href = shot.image;
          a.download = `CyberPulse_Security_${shot.pcId}_${shot.timestamp}.jpg`;
          a.click();
        };

        openModal('screenshotPreviewModal');
      });

      grid.appendChild(card);
    });
  }

  // Remote Modal: Save to Security Gallery
  const btnSaveGallery = document.getElementById('btnRemoteSaveGallery');
  if (btnSaveGallery) {
    btnSaveGallery.addEventListener('click', () => {
      if (!activeRemotePcId) return;
      const imageData = remoteScreenCanvas.toDataURL('image/jpeg', 0.85);

      fetch('/api/screenshots/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pcId: activeRemotePcId,
          image: imageData,
          note: 'Screenshot manually saved by Cashier'
        })
      }).then(r => r.json()).then(res => {
        if (res.success) {
          window.cyberAudio.playCash();
          alert(`Screenshot of PC ${activeRemotePcId} saved to security gallery successfully!`);
        }
      });
    });
  }

  // Remote Modal: Send Buzzer Siren
  const btnSendBuzzer = document.getElementById('btnRemoteSendBuzzer');
  if (btnSendBuzzer) {
    btnSendBuzzer.addEventListener('click', () => {
      if (!activeRemotePcId) return;
      socket.emit('admin_send_message', {
        pcId: activeRemotePcId,
        message: '⚠️ Audio Warning: Please follow arena rules and lower volume!',
        level: 'warning'
      });
      window.cyberAudio.playWarning();
      alert(`Audio siren buzzer triggered on PC ${activeRemotePcId}!`);
    });
  }

  // -------------------------------------------------------------
  // POWER MANAGEMENT CONTROLLER (WOL Select - Restart - Shutdown Select - Shutdown Idle)
  // -------------------------------------------------------------

  const btnVpnSelect = document.getElementById('btnVpnSelect');
  if (btnVpnSelect) {
    btnVpnSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please select at least one PC to toggle or balance Gaming VPN routes!');
      }
      if (selectedPcs.size === 1) {
        const singleId = Array.from(selectedPcs)[0];
        togglePcVPN(singleId);
        return;
      }
      const pcIds = Array.from(selectedPcs);
      btnVpnSelect.disabled = true;
      btnVpnSelect.innerHTML = '<span class="power-act-icon">⏳</span>';

      fetch('/api/mikrotik/vpn/bulk-distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcIds })
      })
        .then(r => r.json())
        .then(res => {
          btnVpnSelect.disabled = false;
          btnVpnSelect.innerHTML = '<span class="power-act-icon">🛡️</span>';
          if (res.success) {
            window.cyberAudio?.playUnlock?.();
            const summary = (res.results || []).map(r => 
              r.vpnEnabled ? `• ${r.name} -> ${r.flag} ${r.server} (${r.ip})` : `• ${r.name} -> VPN Disabled (WAN)`
            ).join('\n');
            alert(`Gaming VPN Load-Balanced across ${res.count} PC(s):\n\n${summary}`);
          } else {
            alert(res.error || 'Failed to distribute VPN');
          }
        })
        .catch(err => {
          btnVpnSelect.disabled = false;
          btnVpnSelect.innerHTML = '<span class="power-act-icon">🛡️</span>';
          alert('Network error distributing VPN: ' + err.message);
        });
    });
  }

  // -------------------------------------------------------------
  // IN-PLACE LIVE SCREEN CONTROLLER & HOVER ACTIONS
  // -------------------------------------------------------------
  function toggleGridScreenView(explicitVal) {
    if (typeof explicitVal === 'boolean') {
      isGridScreenView = explicitVal;
    } else {
      isGridScreenView = !isGridScreenView;
    }

    localStorage.setItem('cyber_grid_screen_view', isGridScreenView ? 'true' : 'false');

    const btnPower = document.getElementById('btnScreenSelect');
    const btnHeader = document.getElementById('btnToggleLiveScreensHeader');

    if (btnPower) btnPower.classList.toggle('screen-view-active', isGridScreenView);
    if (btnHeader) btnHeader.classList.toggle('screen-view-active', isGridScreenView);

    if (isGridScreenView) {
      window.cyberAudio?.playUnlock?.();
      fetchLiveScreenSnapshots();
      if (screenViewPollInterval) clearInterval(screenViewPollInterval);
      screenViewPollInterval = setInterval(fetchLiveScreenSnapshots, 2500);
      showToast('Live Screens Activated 📺', 'Live screen feeds are now active directly on station cards');
    } else {
      window.cyberAudio?.playClick?.();
      if (screenViewPollInterval) clearInterval(screenViewPollInterval);
      screenViewPollInterval = null;
      showToast('Hardware Icons Mode 🖥️', 'Switched to hardware icons mode');
    }

    renderPcsGrid();
  }

  window.toggleGridScreenView = toggleGridScreenView;

  const btnScreenSelect = document.getElementById('btnScreenSelect');
  if (btnScreenSelect) {
    btnScreenSelect.addEventListener('click', () => toggleGridScreenView());
    btnScreenSelect.classList.toggle('screen-view-active', isGridScreenView);
  }

  const btnToggleLiveScreensHeader = document.getElementById('btnToggleLiveScreensHeader');
  if (btnToggleLiveScreensHeader) {
    btnToggleLiveScreensHeader.addEventListener('click', () => toggleGridScreenView());
    btnToggleLiveScreensHeader.classList.toggle('screen-view-active', isGridScreenView);
  }

  // Quick Card Actions: Snapshot from Card
  window.saveQuickCardSnapshot = function(pcId) {
    const shot = cachedScreenSnapshots[pcId];
    const imgEl = document.getElementById(`card_screen_img_${pcId}`);
    let imageData = (shot && shot.image) || (imgEl && imgEl.src);

    if (!imageData || imageData.length < 50 || imageData.includes('placeholder')) {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#00f3ff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(`CYBER SURVEILLANCE CAPTURE: ${pcId}`, 60, 100);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(`Timestamp: ${new Date().toLocaleString()}`, 60, 150);
      imageData = canvas.toDataURL('image/jpeg', 0.85);
    }

    fetch('/api/screenshots/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pcId,
        image: imageData,
        note: `Quick dashboard snapshot (${pcId})`
      })
    })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        window.cyberAudio?.playCash?.();
        showToast('📸 Snapshot Saved', `Snapshot of ${pcId} saved to surveillance archive successfully.`);
      }
    });
  };

  // Quick Card Actions: Send Toast Message to Screen
  window.quickCardMessage = function(pcId) {
    const msg = prompt(`Enter message to broadcast on ${pcId} screen:`, 'Please observe arena rules and keep quiet.');
    if (!msg || !msg.trim()) return;

    socket.emit('admin_send_message', {
      pcId,
      message: msg.trim(),
      level: 'warning'
    });
    window.cyberAudio?.playClick?.();
    showToast('💬 Message Sent', `Message dispatched to ${pcId} screen successfully.`);
  };

  // Auto-init screen view if saved in preferences
  if (isGridScreenView) {
    setTimeout(() => {
      fetchLiveScreenSnapshots();
      if (screenViewPollInterval) clearInterval(screenViewPollInterval);
      screenViewPollInterval = setInterval(fetchLiveScreenSnapshots, 2500);
    }, 350);
  }

  // Checkout & Settle Bill on Selected PC
  const btnCheckoutSelect = document.getElementById('btnCheckoutSelect');
  if (btnCheckoutSelect) {
    btnCheckoutSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please select an active PC to checkout!');
      }
      const firstId = Array.from(selectedPcs)[0];
      const pc = state.pcs.find(p => p.id === firstId);
      if (!pc || pc.status !== 'in_session') {
        return alert('Selected PC does not have an active session to checkout.');
      }
      openCheckoutModal(firstId);
    });
  }

  const btnWolSelect = document.getElementById('btnWolSelect');
  if (btnWolSelect) {
    btnWolSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please select at least one PC first (click card to select, Ctrl+click for multiple, Shift+click for range)!');
      }
      const pcIds = Array.from(selectedPcs);
      fetch('/api/power/wol-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcIds })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            window.cyberAudio.playUnlock();
            alert(`⚡ ${res.message}`);
          } else {
            alert(res.error || 'Failed to send WOL magic packet');
          }
        });
    });
  }

  // Start Session on Selected PC
  const btnStartSelect = document.getElementById('btnStartSelect');
  if (btnStartSelect) {
    btnStartSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        const firstAvail = state.pcs.find(p => p.status === 'available');
        if (firstAvail) {
          selectedPcs.clear();
          selectedPcs.add(firstAvail.id);
          updateSelectedPcsUI();
          openStartSessionModal(firstAvail.id, 'open');
          return;
        }
        return alert('Please select a PC to start a session!');
      }
      const firstId = Array.from(selectedPcs)[0];
      openStartSessionModal(firstId, 'open');
    });
  }

  // -------------------------------------------------------------
  // DESKTOP CONTEXT MENU CONTROLLER
  // -------------------------------------------------------------
  const pcContextMenu = document.getElementById('pcContextMenu');
  let activeContextMenuPcId = null;

  function showPcContextMenu(pcId, x, y) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc || !pcContextMenu) return;

    activeContextMenuPcId = pcId;
    const nameEl = document.getElementById('ctxPcName');
    const ipEl = document.getElementById('ctxPcIp');
    if (nameEl) nameEl.textContent = pc.name;
    if (ipEl) ipEl.textContent = pc.ip || '10.10.10.101';

    const ctxActOpen = document.getElementById('ctxActOpenTime');
    const ctxActAdmin = document.getElementById('ctxActAdminSession');
    const ctxActCust = document.getElementById('ctxActCustomSession');
    const ctxActFree = document.getElementById('ctxActAddFreeTime');
    const ctxActCheck = document.getElementById('ctxActCheckout');

    if (pc.status === 'in_session') {
      if (ctxActOpen) ctxActOpen.style.display = 'none';
      if (ctxActAdmin) ctxActAdmin.style.display = 'none';
      if (ctxActCust) ctxActCust.style.display = 'none';
      if (ctxActFree) ctxActFree.style.display = 'flex';
      if (ctxActCheck) ctxActCheck.style.display = 'flex';
    } else {
      if (ctxActOpen) ctxActOpen.style.display = 'flex';
      if (ctxActAdmin) ctxActAdmin.style.display = 'flex';
      if (ctxActCust) ctxActCust.style.display = 'flex';
      if (ctxActFree) ctxActFree.style.display = 'none';
      if (ctxActCheck) ctxActCheck.style.display = 'none';
    }

    pcContextMenu.style.display = 'flex';
    const menuWidth = 230;
    const menuHeight = 350;
    const posX = (x + menuWidth > window.innerWidth) ? (window.innerWidth - menuWidth - 10) : x;
    const posY = (y + menuHeight > window.innerHeight) ? (window.innerHeight - menuHeight - 10) : y;
    pcContextMenu.style.left = `${posX}px`;
    pcContextMenu.style.top = `${posY}px`;
  }

  function hidePcContextMenu() {
    if (pcContextMenu) {
      pcContextMenu.style.display = 'none';
    }
    activeContextMenuPcId = null;
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#pcContextMenu')) {
      hidePcContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePcContextMenu();
  });

  const ctxActOpenTime = document.getElementById('ctxActOpenTime');
  if (ctxActOpenTime) {
    ctxActOpenTime.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) quickStartOpenTime(pcId);
    });
  }

  const ctxActAdminSession = document.getElementById('ctxActAdminSession');
  if (ctxActAdminSession) {
    ctxActAdminSession.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) startAdminSession(pcId);
    });
  }

  const ctxActCustomSession = document.getElementById('ctxActCustomSession');
  if (ctxActCustomSession) {
    ctxActCustomSession.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) openStartSessionModal(pcId, 'fixed_time');
    });
  }

  const ctxActAddFreeTime = document.getElementById('ctxActAddFreeTime');
  if (ctxActAddFreeTime) {
    ctxActAddFreeTime.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) openAddFreeTimeModal(pcId);
    });
  }

  const ctxActCheckout = document.getElementById('ctxActCheckout');
  if (ctxActCheckout) {
    ctxActCheckout.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) openCheckoutModal(pcId);
    });
  }

  const ctxActVpn = document.getElementById('ctxActVpn');
  if (ctxActVpn) {
    ctxActVpn.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) togglePcVPN(pcId);
    });
  }

  const ctxActScreen = document.getElementById('ctxActScreen');
  if (ctxActScreen) {
    ctxActScreen.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) openRemoteModal(pcId);
    });
  }

  const ctxActLock = document.getElementById('ctxActLock');
  if (ctxActLock) {
    ctxActLock.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) toggleLockPc(pcId);
    });
  }

  const ctxActCafe = document.getElementById('ctxActCafe');
  if (ctxActCafe) {
    ctxActCafe.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        const cafeTabBtn = document.querySelector('[data-tab="cafeteriaTab"]');
        if (cafeTabBtn) cafeTabBtn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const cafeTab = document.getElementById('cafeteriaTab');
        if (cafeTab) cafeTab.classList.add('active');
        const posTargetSelect = document.getElementById('posTargetSelect');
        if (posTargetSelect) posTargetSelect.value = pcId;
      }
    });
  }

  const ctxActRestart = document.getElementById('ctxActRestart');
  if (ctxActRestart) {
    ctxActRestart.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId && confirm(`Restart PC ${pcId}?`)) {
        fetch('/api/power/restart-select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pcIds: [pcId] })
        }).then(r => r.json()).then(res => alert(res.message || 'Restart command dispatched'));
      }
    });
  }

  const ctxActShutdown = document.getElementById('ctxActShutdown');
  if (ctxActShutdown) {
    ctxActShutdown.addEventListener('click', () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (pcId && confirm(`Shutdown PC ${pcId}?`)) {
        fetch('/api/power/shutdown-select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pcIds: [pcId] })
        }).then(r => r.json()).then(res => alert(res.message || 'Shutdown command dispatched'));
      }
    });
  }

  const ctxActDeletePc = document.getElementById('ctxActDeletePc');
  if (ctxActDeletePc) {
    ctxActDeletePc.addEventListener('click', async () => {
      const pcId = activeContextMenuPcId;
      hidePcContextMenu();
      if (!pcId) return;
      const pc = state.pcs.find(p => p.id === pcId);
      const name = pc ? pc.name : pcId;
      if (confirm(`Are you sure you want to remove station [${name}] from arena?`)) {
        try {
          const res = await fetch(`/api/pcs/${pcId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            state.pcs = data.pcs;
            selectedPcs.delete(pcId);
            updateShiftSummary();
            renderPcsGrid();
            renderSurveillanceGrid();
            showToast('Station Removed', `Removed ${name} from registry.`);
          } else {
            alert(data.error || 'Failed to remove station');
          }
        } catch (err) {
          alert('Error removing station');
        }
      }
    });
  }

  function openAddPcModal() {
    const modal = document.getElementById('modalAddPc');
    if (!modal) return;
    const nextNum = (state.pcs || []).length + 1;
    const defaultId = `PC-${String(nextNum).padStart(2, '0')}`;
    document.getElementById('addPcId').value = defaultId;
    document.getElementById('addPcName').value = `PC ${String(nextNum).padStart(2, '0')}`;
    document.getElementById('addPcIp').value = `192.168.1.${100 + nextNum}`;
    modal.classList.add('active');
  }

  const btnAddPcTop = document.getElementById('btnAddPcTop');
  if (btnAddPcTop) {
    btnAddPcTop.addEventListener('click', openAddPcModal);
  }

  const formAddPc = document.getElementById('formAddPc');
  if (formAddPc) {
    formAddPc.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('addPcId').value.trim();
      const name = document.getElementById('addPcName').value.trim();
      const ip = document.getElementById('addPcIp').value.trim();
      const zone = document.getElementById('addPcZone').value;
      const ratePerHour = parseFloat(document.getElementById('addPcRate').value) || 20;

      try {
        const res = await fetch('/api/pcs/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name, ip, zone, ratePerHour })
        });
        const data = await res.json();
        if (data.success) {
          closeModal('modalAddPc');
          state.pcs = data.pcs;
          updateShiftSummary();
          renderPcsGrid();
          renderSurveillanceGrid();
          showToast('Station Registered 🖥️', `Station ${name || id} added successfully!`);
        } else {
          alert(data.error || 'Failed to add station');
        }
      } catch (err) {
        alert('Error adding station: ' + err.message);
      }
    });
  }

  const btnClearPcsTop = document.getElementById('btnClearPcsTop');
  if (btnClearPcsTop) {
    btnClearPcsTop.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all registered stations?\n\nThe list will be cleared and real arena PCs will auto-connect as soon as they are active.')) {
        try {
          const res = await fetch('/api/pcs/clear-all', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            state.pcs = [];
            selectedPcs.clear();
            updateShiftSummary();
            renderPcsGrid();
            renderSurveillanceGrid();
            showToast('All Stations Cleared 🧹', 'Stations cleared. Waiting for arena devices to connect.');
          }
        } catch (err) {
          showToast('Error', 'Failed to clear stations');
        }
      }
    });
  }

  async function scanNetworkLan() {
    showToast('Network Scanner 📡', 'Scanning local LAN for active stations...');
    try {
      const res = await fetch('/api/network/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        state.pcs = data.pcs || [];
        updateShiftSummary();
        renderPcsGrid();
        renderSurveillanceGrid();
        if (window.cyberAudio) window.cyberAudio.playUnlock();
        if (data.newlyAddedCount > 0) {
          showToast('Scan Successful ⚡', `Discovered and registered ${data.newlyAddedCount} new station(s)!`);
        } else if (data.discoveredCount > 0) {
          showToast('Network Verified ✔', `Verified LAN stations (${data.discoveredCount} active stations).`);
        } else {
          showToast('Scan Finished ℹ️', 'No new stations found. Ensure station PCs are powered on.');
        }
      }
    } catch (err) {
      showToast('Error', 'Network scan failed: ' + err.message);
    }
  }
  window.scanNetworkLan = scanNetworkLan;
  window.openAddPcModal = openAddPcModal;

  const btnScanPcsTop = document.getElementById('btnScanPcsTop');
  if (btnScanPcsTop) {
    btnScanPcsTop.addEventListener('click', scanNetworkLan);
  }

  // Lock / Unlock Selected PCs
  const btnLockSelect = document.getElementById('btnLockSelect');
  if (btnLockSelect) {
    btnLockSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please select at least one PC to lock/unlock!');
      }
      selectedPcs.forEach(pcId => {
        toggleLockPc(pcId);
      });
    });
  }

  // Restart Selected PCs
  const btnRestartSelect = document.getElementById('btnRestartSelect');
  if (btnRestartSelect) {
    btnRestartSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please select at least one PC to restart!');
      }
      if (!confirm(`Are you sure you want to restart ${selectedPcs.size} selected PC(s)?`)) return;

      const pcIds = Array.from(selectedPcs);
      fetch('/api/power/restart-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcIds })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            window.cyberAudio.playWarning();
            alert(`🔄 ${res.message}`);
          } else {
            alert(res.error || 'Failed to execute restart command');
          }
        });
    });
  }

  // [EN]
  const btnShutdownSelect = document.getElementById('btnShutdownSelect');
  if (btnShutdownSelect) {
    btnShutdownSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please select at least one PC to shutdown!');
      }
      if (!confirm(`Warning: Are you sure you want to shut down ${selectedPcs.size} selected PC(s) immediately?`)) return;

      const pcIds = Array.from(selectedPcs);
      fetch('/api/power/shutdown-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcIds })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            window.cyberAudio.playWarning();
            alert(`🛑 ${res.message}`);
            fetchState();
          } else {
            alert(res.error || 'Failed to execute shutdown command');
          }
        });
    });
  }

  // [EN]
  const btnShutdownIdle = document.getElementById('btnShutdownIdle');
  if (btnShutdownIdle) {
    btnShutdownIdle.addEventListener('click', () => {
      fetch('/api/power/shutdown-idle-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            window.cyberAudio.playCash();
            alert(`💤 ${res.message}`);
            fetchState();
          } else {
            alert(res.error || 'Failed to shutdown idle PCs');
          }
        });
    });
  }

  
  // Top Action: Toggle Maintenance on Selected PC(s)
  const btnMaintSelect = document.getElementById('btnMaintSelect');
  if (btnMaintSelect) {
    btnMaintSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please click on a PC card (or multiple PCs) to select them first before toggling Maintenance Mode!');
      }
      const pcIds = Array.from(selectedPcs);
      fetch('/api/pc/maintenance-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcIds })
      })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.pcs) {
          res.pcs.forEach(upd => {
            const idx = state.pcs.findIndex(p => p.id === upd.id);
            if (idx !== -1) state.pcs[idx] = upd;
          });
          renderPcsGrid();
          window.cyberAudio?.playClick?.();
          alert(`🔧 Toggled Maintenance Mode for ${res.count} station(s)!`);
        }
      });
    });
  }

  // Top Action: Open Cafe Order for Selected PC
  const btnCafeOrderSelect = document.getElementById('btnCafeOrderSelect');
  if (btnCafeOrderSelect) {
    btnCafeOrderSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please click on a PC card to select it first, then click Cafe Order!');
      }
      const pcId = Array.from(selectedPcs)[0];
      openQuickAddSnack(pcId);
    });
  }

  // Top Action: Transfer Session for Selected PC
  const btnTransferSelect = document.getElementById('btnTransferSelect');
  if (btnTransferSelect) {
    btnTransferSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please click on an active PC to select it first, then click Transfer PC!');
      }
      const activePcId = Array.from(selectedPcs).find(id => {
        const p = state.pcs.find(x => x.id === id);
        return p && p.session;
      }) || Array.from(selectedPcs)[0];
      
      const p = state.pcs.find(x => x.id === activePcId);
      if (!p || !p.session) {
        return alert(`Selected station (${activePcId}) does not have an active customer session to transfer!`);
      }
      openTransferModal(activePcId);
    });
  }

  // Top Action: Open Admin Session (Free / 0 EGP)
  const btnAdminSessionSelect = document.getElementById('btnAdminSessionSelect');
  if (btnAdminSessionSelect) {
    btnAdminSessionSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please click on a PC card to select it first, then click Open Admin Session!');
      }
      const pcId = Array.from(selectedPcs)[0];
      startAdminSession(pcId);
    });
  }

  // Top Action: Add Free Bonus Time to Active Session
  const btnAddFreeTimeSelect = document.getElementById('btnAddFreeTimeSelect');
  if (btnAddFreeTimeSelect) {
    btnAddFreeTimeSelect.addEventListener('click', () => {
      if (selectedPcs.size === 0) {
        return alert('Please click on an active PC to select it first, then click Add Free Time!');
      }
      const pcId = Array.from(selectedPcs)[0];
      openAddFreeTimeModal(pcId);
    });
  }

  window.startAdminSession = function(pcId) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc) return;
    if (pc.status === 'in_session') {
      alert(`Station ${pc.name} is already active in a session!`);
      return;
    }

    fetch('/api/session/start-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pcId })
    })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        window.cyberAudio?.playUnlock?.();
        const localPc = state.pcs.find(p => p.id === pcId);
        if (localPc) {
          localPc.status = res.pc.status;
          localPc.isAdminSession = true;
          localPc.session = res.pc.session;
          renderPcsGrid();
        }
        fetchState();
      } else {
        alert(res.error || 'Failed to start Admin session');
      }
    })
    .catch(err => {
      alert('Network error while starting Admin session: ' + err.message);
    });
  };

  window.openAddFreeTimeModal = function(pcId) {
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc || !pc.session) {
      alert(`Selected station (${pcId}) does not have an active session to add free time!`);
      return;
    }

    document.getElementById('freeTimePcId').value = pc.id;
    document.getElementById('freeTimePcName').textContent = pc.name;
    document.getElementById('customFreeMinutesInput').value = 15;
    document.querySelectorAll('[data-free-min]').forEach(b => b.classList.toggle('active', b.dataset.freeMin === '15'));
    openModal('addFreeTimeModal');
  };

  document.querySelectorAll('[data-free-min]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-free-min]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('customFreeMinutesInput').value = btn.dataset.freeMin;
    });
  });

  const btnConfirmAddFreeTime = document.getElementById('btnConfirmAddFreeTime');
  if (btnConfirmAddFreeTime) {
    btnConfirmAddFreeTime.addEventListener('click', () => {
      const pcId = document.getElementById('freeTimePcId').value;
      const minutes = parseInt(document.getElementById('customFreeMinutesInput').value) || 15;

      fetch('/api/session/add-free-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcId, minutes })
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          window.cyberAudio?.playCash?.();
          closeModal('addFreeTimeModal');
          fetchState();
        } else {
          alert(res.error || 'Failed to add free time');
        }
      })
      .catch(err => {
        alert('Network error while adding free time: ' + err.message);
      });
    });
  }

  function fetchLiveScreenSnapshots() {
    fetch('/api/surveillance/snapshots')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.snapshots) {
          cachedScreenSnapshots = { ...cachedScreenSnapshots, ...res.snapshots };
          state.pcs.forEach(pc => {
            const shot = cachedScreenSnapshots[pc.id];
            const screenSrc = (shot && shot.image) ? shot.image : (window.generateStationScreen ? window.generateStationScreen(pc) : '');
            const winName = (shot && shot.activeWindow) ? shot.activeWindow : (pc.currentGame || (pc.status === 'in_session' ? 'Cyber Launcher' : 'Desktop'));

            const cardImg = document.getElementById(`card_screen_img_${pc.id}`);
            const placeholder = document.getElementById(`placeholder_${pc.id}`);
            const cardWinTag = document.getElementById(`card_win_tag_${pc.id}`);
            if (cardImg) {
              cardImg.src = screenSrc;
              cardImg.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            if (cardWinTag) cardWinTag.textContent = winName;

            const monitorImg = document.getElementById(`monitor_img_${pc.id}`);
            const monitorWin = document.getElementById(`monitor_win_${pc.id}`);
            if (monitorImg) {
              monitorImg.src = screenSrc;
              monitorImg.style.display = 'block';
            }
            if (monitorWin) monitorWin.textContent = winName;
          });
        }
      })
      .catch(() => {});
  }

  // Surveillance refresh button
  const btnRefreshSurveillance = document.getElementById('btnRefreshSurveillance');
  if (btnRefreshSurveillance) {
    btnRefreshSurveillance.addEventListener('click', () => {
      fetchLiveScreenSnapshots();
      renderSurveillanceGrid();
      window.cyberAudio?.playClick?.();
      showToast('Surveillance Wall Refreshed 🔄', 'تم تحديث بث الشاشات الحية للأجهزة في جدار المراقبة');
    });
  }

  // Quick jump to Visual Settings
  const btnGoToVisualSettings = document.getElementById('btnGoToVisualSettings');
  if (btnGoToVisualSettings) {
    btnGoToVisualSettings.addEventListener('click', () => {
      switchTab('settingsTab');
      switchSettingsSection('secPcVisuals');
    });
  }

  // -------------------------------------------------------------
  // [EN]
  // -------------------------------------------------------------
  function switchSettingsSection(sectionId) {
    if (!sectionId) return;
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.settingsSection === sectionId);
    });
    document.querySelectorAll('.settings-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === sectionId);
    });
    localStorage.setItem('cyber_active_settings_section', sectionId);
    if (sectionId === 'secPowerIdle') {
      renderPowerTable();
    } else if (sectionId === 'secMikrotik') {
      renderMikrotikSection();
      syncHotspotSettingsUI();
      fetchHotspotVouchersLive();
    } else if (sectionId === 'secPcVisuals') {
      syncStatusIconsUI();
    } else if (sectionId === 'secWordFilter') {
      renderWordFilterSection();
    }
  }

  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchSettingsSection(btn.dataset.settingsSection);
      window.cyberAudio.playClick();
    });
  });

  // -------------------------------------------------------------
  // [EN]
  // -------------------------------------------------------------
  const defaultVisuals = {
    enableStandRgb: true,
    stateVisuals: Object.assign({}, defaultStateVisuals)
  };

  let currentVisuals = {
    enableStandRgb: true,
    stateVisuals: JSON.parse(JSON.stringify(defaultStateVisuals))
  };

  try {
    const saved = localStorage.getItem('cyber_custom_visuals');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.stateVisuals) {
        Object.keys(defaultStateVisuals).forEach(k => {
          if (parsed.stateVisuals[k]) {
            currentVisuals.stateVisuals[k] = Object.assign({}, defaultStateVisuals[k], parsed.stateVisuals[k]);
          }
        });
      }
      if (typeof parsed.enableStandRgb === 'boolean') {
        currentVisuals.enableStandRgb = parsed.enableStandRgb;
      }
    }
  } catch(e) {}

  const toggleStandRgb = document.getElementById('toggleStandRgb');
  const livePreviewCard = document.getElementById('liveInteractivePreviewCard');
  let activePreviewStatus = 'available';

  function syncCustomizerInputs() {
    if (toggleStandRgb) toggleStandRgb.checked = currentVisuals.enableStandRgb;

    const stateVisualsMap = currentVisuals.stateVisuals || defaultStateVisuals;

    // Synchronize all state selects and color pickers
    document.querySelectorAll('.state-model-select').forEach(sel => {
      const key = sel.dataset.stateKey;
      if (stateVisualsMap[key]) {
        sel.value = stateVisualsMap[key].model;
      }
      sel.onchange = () => {
        if (!currentVisuals.stateVisuals[key]) currentVisuals.stateVisuals[key] = {};
        currentVisuals.stateVisuals[key].model = sel.value;
        renderMiniPreviews();
        renderLivePreview();
      };
    });

    document.querySelectorAll('.state-color-picker').forEach(picker => {
      const key = picker.dataset.stateKey;
      const hexInput = document.querySelector(`.state-color-hex[data-state-key="${key}"]`);
      if (stateVisualsMap[key]) {
        picker.value = stateVisualsMap[key].color;
        if (hexInput) hexInput.value = stateVisualsMap[key].color;
      }
      picker.oninput = () => {
        if (hexInput) hexInput.value = picker.value;
        if (!currentVisuals.stateVisuals[key]) currentVisuals.stateVisuals[key] = {};
        currentVisuals.stateVisuals[key].color = picker.value;
        renderMiniPreviews();
        renderLivePreview();
      };
      if (hexInput) {
        hexInput.oninput = () => {
          if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
            picker.value = hexInput.value;
            if (!currentVisuals.stateVisuals[key]) currentVisuals.stateVisuals[key] = {};
            currentVisuals.stateVisuals[key].color = hexInput.value;
            renderMiniPreviews();
            renderLivePreview();
          }
        };
      }
    });

    // Synchronize and inject state badge icon selects
    const STATUS_BADGE_OPTIONS = [
      { value: '⚡', label: '⚡ Cyber Lightning' },
      { value: '🟢', label: '🟢 Online Green' },
      { value: '🎮', label: '🎮 Gamepad' },
      { value: '👑', label: '👑 VIP Crown' },
      { value: '🔥', label: '🔥 Fire Alert' },
      { value: '⏱️', label: '⏱️ Stopwatch Timer' },
      { value: '⏳', label: '⏳ Hourglass' },
      { value: '💤', label: '💤 Zzz Idle' },
      { value: '🔧', label: '🔧 Wrench Repair' },
      { value: '🛡️', label: '🛡️ Shield Admin' },
      { value: '⚠️', label: '⚠️ Warning Hazard' },
      { value: '⚫', label: '⚫ Offline Dark' },
      { value: '🚀', label: '🚀 Nitro Rocket' },
      { value: '🎯', label: '🎯 Crosshair Target' },
      { value: '💎', label: '💎 Diamond' },
      { value: '🏆', label: '🏆 Trophy' },
      { value: '🕹️', label: '🕹️ Joystick' },
      { value: '👾', label: '👾 Retro Alien' },
      { value: '💻', label: '💻 Esports Laptop' }
    ];

    document.querySelectorAll('.state-visual-item-card').forEach(itemCard => {
      const key = itemCard.dataset.stateKey;
      if (!key) return;
      const controlsWrap = itemCard.querySelector('.state-visual-controls');
      if (controlsWrap && !controlsWrap.querySelector('.state-badge-select')) {
        const badgeGroup = document.createElement('div');
        badgeGroup.className = 'control-group state-badge-group';
        badgeGroup.innerHTML = `
          <label title="Icon badge displayed next to station name">Status Badge:</label>
          <select class="form-input state-badge-select" data-state-key="${key}">
            ${STATUS_BADGE_OPTIONS.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
        `;
        controlsWrap.appendChild(badgeGroup);
      }
    });

    document.querySelectorAll('.state-badge-select').forEach(sel => {
      const key = sel.dataset.stateKey;
      if (stateVisualsMap[key] && stateVisualsMap[key].badgeIcon) {
        sel.value = stateVisualsMap[key].badgeIcon;
      } else if (defaultStateVisuals[key] && defaultStateVisuals[key].badgeIcon) {
        sel.value = defaultStateVisuals[key].badgeIcon;
      }
      sel.onchange = () => {
        if (!currentVisuals.stateVisuals[key]) currentVisuals.stateVisuals[key] = {};
        currentVisuals.stateVisuals[key].badgeIcon = sel.value;
        localStorage.setItem('cyber_custom_visuals', JSON.stringify(currentVisuals));
        renderPcsGrid();
      };
    });

    renderMiniPreviews();
    renderLivePreview();
  }

  function renderMiniPreviews() {
    const stateVisualsMap = currentVisuals.stateVisuals || defaultStateVisuals;
    Object.keys(stateVisualsMap).forEach(key => {
      const target = document.getElementById(`miniHwPreview_${key}`);
      if (target) {
        const conf = stateVisualsMap[key];
        target.innerHTML = generateHardwareSvg(conf.model, conf.color, `mini_${key}`, '', false, key, null, true);
        target.style.cursor = 'pointer';
        target.title = 'Double-click to choose icon and customize appearance';
        target.onclick = (e) => {
          e.stopPropagation();
          openStateIconGallery(key);
        };
        target.ondblclick = (e) => {
          e.stopPropagation();
          openStateIconGallery(key);
        };
      }
      const itemCard = document.querySelector(`.state-visual-item-card[data-state-key="${key}"]`);
      if (itemCard) {
        itemCard.style.cursor = 'pointer';
        itemCard.title = 'Double-click to choose icon and customize appearance';
        itemCard.ondblclick = (e) => {
          if (e.target.closest('select') || e.target.closest('input')) return;
          e.stopPropagation();
          openStateIconGallery(key);
        };
      }
      const itemMeta = document.querySelector(`.state-visual-item-card[data-state-key="${key}"] .state-visual-meta`);
      if (itemMeta) {
        itemMeta.style.cursor = 'pointer';
        itemMeta.title = 'Double-click to choose icon and customize appearance';
        itemMeta.onclick = (e) => {
          e.stopPropagation();
          openStateIconGallery(key);
        };
        itemMeta.ondblclick = (e) => {
          e.stopPropagation();
          openStateIconGallery(key);
        };
      }
    });
  }

  function renderLivePreview() {
    if (!livePreviewCard) return;
    const stateVisualsMap = currentVisuals.stateVisuals || defaultStateVisuals;
    const conf = stateVisualsMap[activePreviewStatus] || defaultStateVisuals[activePreviewStatus] || defaultStateVisuals.available;
    livePreviewCard.innerHTML = generateHardwareSvg(conf.model, conf.color, 'live_preview_box', conf.label, currentVisuals.enableStandRgb, activePreviewStatus, null, false);
  }

  if (toggleStandRgb) {
    toggleStandRgb.addEventListener('change', () => {
      currentVisuals.enableStandRgb = toggleStandRgb.checked;
      renderLivePreview();
      renderPcsGrid();
    });
  }

  // Preview Mode Buttons
  document.querySelectorAll('.preview-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preview-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePreviewStatus = btn.dataset.previewStatus;
      renderLivePreview();
      window.cyberAudio?.playClick?.();
    });
  });

  // Theme Presets
  const themePresetsData = {
    cyberpunk: { openTime: '#00f3ff', lowTime: '#ff0055', available: '#05ffa1', maintenance: '#ff9900' },
    emerald: { openTime: '#00e5ff', lowTime: '#e11d48', available: '#00ff88', maintenance: '#f59e0b' },
    dragon: { openTime: '#ff5500', lowTime: '#ff0033', available: '#05ffa1', maintenance: '#ffaa00' },
    royal: { openTime: '#bd00ff', lowTime: '#ff0066', available: '#05ffa1', maintenance: '#ffd700' },
    blizzard: { openTime: '#00d0ff', lowTime: '#f43f5e', available: '#05ffa1', maintenance: '#38bdf8' }
  };

  document.querySelectorAll('.btn-theme-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-theme-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = themePresetsData[btn.dataset.preset];
      if (preset) {
        Object.keys(preset).forEach(k => {
          if (currentVisuals.stateVisuals[k]) {
            currentVisuals.stateVisuals[k].color = preset[k];
          }
        });
        syncCustomizerInputs();
        window.cyberAudio?.playClick?.();
      }
    });
  });

  // Save Visuals Button
  const btnSaveVisualSettings = document.getElementById('btnSaveVisualSettings');
  if (btnSaveVisualSettings) {
    btnSaveVisualSettings.addEventListener('click', () => {
      fetch('/api/settings/visuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentVisuals)
      })
      .then(r => r.json())
      .then(res => {
        localStorage.setItem('cyber_custom_visuals', JSON.stringify(currentVisuals));
        renderPcsGrid();
        window.cyberAudio?.playCash?.();
        alert('✨ Hardware models and screen neon visuals saved successfully!');
      });
    });
  }

  // Reset Visuals Button
  const btnResetVisualSettings = document.getElementById('btnResetVisualSettings');
  if (btnResetVisualSettings) {
    btnResetVisualSettings.addEventListener('click', () => {
      if (!confirm('Reset device hardware models and screen colors to factory defaults?')) return;
      currentVisuals = {
        enableStandRgb: true,
        stateVisuals: JSON.parse(JSON.stringify(defaultStateVisuals))
      };
      localStorage.removeItem('cyber_custom_visuals');
      syncCustomizerInputs();
      renderPcsGrid();
      window.cyberAudio?.playClick?.();
    });
  }

  // Socket listener for visuals updated
  socket.on('settings_visuals_updated', (vis) => {
    if (vis && vis.stateVisuals) {
      currentVisuals.stateVisuals = Object.assign({}, defaultStateVisuals, vis.stateVisuals);
      syncCustomizerInputs();
      renderPcsGrid();
    }
  });

  // Initialize
  syncCustomizerInputs();
  // Close modals on overlay backdrop click or Escape key
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });

  // Save Idle Threshold Setting
  const btnSaveIdleSettings = document.getElementById('btnSaveIdleSettings');
  const selectIdleMinutes = document.getElementById('selectIdleMinutes');
  const toggleAutoShutdownIdle = document.getElementById('toggleAutoShutdownIdle');

  if (btnSaveIdleSettings) {
    btnSaveIdleSettings.addEventListener('click', () => {
      fetch('/api/power/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoShutdownIdleEnabled: toggleAutoShutdownIdle ? toggleAutoShutdownIdle.checked : true,
          idleThresholdMinutes: selectIdleMinutes ? selectIdleMinutes.value : 10
        })
      }).then(r => r.json()).then(res => {
        if (res.success) {
          window.cyberAudio.playCash();
          alert('✅ Inactivity auto-shutdown settings saved successfully!');
        }
      });
    });
  }

  // Settings section batch buttons
  const btnSettingsShutdownIdleNow = document.getElementById('btnSettingsShutdownIdleNow');
  if (btnSettingsShutdownIdleNow) {
    btnSettingsShutdownIdleNow.addEventListener('click', () => {
      if (btnShutdownIdle) btnShutdownIdle.click();
    });
  }
  const btnSettingsWolAll = document.getElementById('btnSettingsWolAll');
  if (btnSettingsWolAll) {
    btnSettingsWolAll.addEventListener('click', () => {
      if (btnWolSelect) btnWolSelect.click();
    });
  }
  const btnSettingsRestartAll = document.getElementById('btnSettingsRestartAll');
  if (btnSettingsRestartAll) {
    btnSettingsRestartAll.addEventListener('click', () => {
      if (btnRestartSelect) btnRestartSelect.click();
    });
  }
  const btnSettingsShutdownAll = document.getElementById('btnSettingsShutdownAll');
  if (btnSettingsShutdownAll) {
    btnSettingsShutdownAll.addEventListener('click', () => {
      if (btnShutdownSelect) btnShutdownSelect.click();
    });
  }
  // Restore Active Navigation Tab & Settings Section from LocalStorage
  const savedActiveTab = localStorage.getItem('cyber_active_tab');
  if (savedActiveTab && document.getElementById(savedActiveTab)) {
    switchTab(savedActiveTab);
  }

  const savedSettingsSection = localStorage.getItem('cyber_active_settings_section');
  if (savedSettingsSection && document.getElementById(savedSettingsSection)) {
    switchSettingsSection(savedSettingsSection);
  }

  const savedActiveFilter = localStorage.getItem('cyber_active_filter');
  if (savedActiveFilter) {
    activeFilter = savedActiveFilter;
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.filter === activeFilter);
    });
  }


  // -------------------------------------------------------------
  // WORD FILTER & SECURITY SHIELD CONTROLLER
  // -------------------------------------------------------------
  const toggleWfMaster = document.getElementById('toggleWfMaster');
  const wfActionAlertCashier = document.getElementById('wfActionAlertCashier');
  const wfActionTakeSnapshot = document.getElementById('wfActionTakeSnapshot');
  const wfActionWarnClient = document.getElementById('wfActionWarnClient');
  const wfCustomWarningMessage = document.getElementById('wfCustomWarningMessage');
  const btnResetWfMessage = document.getElementById('btnResetWfMessage');
  const btnPreviewWfMessage = document.getElementById('btnPreviewWfMessage');
  const btnSaveWordFilterConfig = document.getElementById('btnSaveWordFilterConfig');
  const inputWfWord = document.getElementById('inputWfWord');
  const selectWfCategory = document.getElementById('selectWfCategory');
  const selectWfSeverity = document.getElementById('selectWfSeverity');
  const btnAddWfWord = document.getElementById('btnAddWfWord');
  const wfWordsTableBody = document.getElementById('wfWordsTableBody');
  const wfWordsCountBadge = document.getElementById('wfWordsCountBadge');
  const inputFilterWfList = document.getElementById('inputFilterWfList');
  const wfViolationsTableBody = document.getElementById('wfViolationsTableBody');
  const btnClearWfViolations = document.getElementById('btnClearWfViolations');
  const btnTestWordFilterTrigger = document.getElementById('btnTestWordFilterTrigger');

  let currentWfConfig = null;

  const defaultWarningMsg = 'Security Shield Alert: Access to prohibited term "{word}" was detected on {pc}. Please close this immediately or your station will face enforcement.';

  function renderWordFilterSection() {
    fetch('/api/wordfilter/config')
      .then(r => r.json())
      .then(res => {
        currentWfConfig = res.wordFilter || {};
        if (toggleWfMaster) toggleWfMaster.checked = !!currentWfConfig.enabled;
        if (wfActionAlertCashier) wfActionAlertCashier.checked = !!currentWfConfig.actionAlertCashier;
        if (wfActionTakeSnapshot) wfActionTakeSnapshot.checked = !!currentWfConfig.actionTakeSnapshot;
        if (wfActionWarnClient) wfActionWarnClient.checked = !!currentWfConfig.actionWarnClient;

        if (wfCustomWarningMessage) {
          wfCustomWarningMessage.value = currentWfConfig.customWarningMessage || defaultWarningMsg;
        }

        // Set active penalty radio card
        const activePenalty = currentWfConfig.penaltyAction || 'warn_only';
        document.querySelectorAll('.wf-penalty-card').forEach(card => {
          const isCardActive = card.dataset.penalty === activePenalty;
          card.classList.toggle('active', isCardActive);
          const radio = card.querySelector('input[type="radio"]');
          if (radio) radio.checked = isCardActive;
        });

        renderWfWordsTable(currentWfConfig.words || []);
        renderWfViolationsTable(currentWfConfig.violations || []);
      });
  }

  // Click handler for Penalty Radio Cards
  document.querySelectorAll('.wf-penalty-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.wf-penalty-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      if (window.cyberAudio && window.cyberAudio.playClick) {
        window.cyberAudio.playClick();
      }
    });
  });

  // Helper to insert dynamic tags into custom message textarea
  window.insertWfTag = function(tag) {
    if (!wfCustomWarningMessage) return;
    const start = wfCustomWarningMessage.selectionStart || wfCustomWarningMessage.value.length;
    const end = wfCustomWarningMessage.selectionEnd || wfCustomWarningMessage.value.length;
    const text = wfCustomWarningMessage.value;
    wfCustomWarningMessage.value = text.substring(0, start) + tag + text.substring(end);
    wfCustomWarningMessage.focus();
    wfCustomWarningMessage.selectionStart = wfCustomWarningMessage.selectionEnd = start + tag.length;
  };

  if (btnResetWfMessage) {
    btnResetWfMessage.addEventListener('click', () => {
      if (wfCustomWarningMessage) {
        wfCustomWarningMessage.value = defaultWarningMsg;
        window.cyberAudio?.playClick?.();
      }
    });
  }

  if (btnPreviewWfMessage) {
    btnPreviewWfMessage.addEventListener('click', () => {
      const template = (wfCustomWarningMessage?.value || defaultWarningMsg);
      const previewText = template
        .replace(/\{word\}/gi, 'pornhub.com')
        .replace(/\{pc\}/gi, 'PC-04')
        .replace(/\{time\}/gi, new Date().toLocaleTimeString('en-US'));

      window.cyberAudio?.playWarning?.();
      alert(`🖥️ CLIENT SCREEN PREVIEW:\n\n${previewText}\n\n[Action upon detection will be executed based on the selected penalty policy]`);
    });
  }

  function renderWfWordsTable(words) {
    if (!wfWordsTableBody) return;
    wfWordsTableBody.innerHTML = '';

    const filterTerm = (inputFilterWfList?.value || '').toLowerCase().trim();
    const filtered = words.filter(w => !filterTerm || w.word.toLowerCase().includes(filterTerm) || w.category.toLowerCase().includes(filterTerm));

    if (wfWordsCountBadge) wfWordsCountBadge.textContent = filtered.length;

    if (filtered.length === 0) {
      wfWordsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1rem;">No prohibited words found</td></tr>';
      return;
    }

    filtered.forEach(w => {
      const tr = document.createElement('tr');
      const sevClass = w.severity === 'high' ? 'badge-sev-high' : (w.severity === 'medium' ? 'badge-sev-medium' : 'badge-sev-low');
      tr.innerHTML = `
        <td><code style="color:var(--neon-pink); background:rgba(255,0,85,0.08); padding:3px 8px; border-radius:4px; font-weight:700;">${w.word}</code></td>
        <td><span class="cat-pill">${w.category}</span></td>
        <td><span class="${sevClass}">${(w.severity || 'medium').toUpperCase()}</span></td>
        <td><span class="cat-pill" style="color:var(--neon-cyan); border:1px solid rgba(0,243,255,0.3); background:rgba(0,243,255,0.06); font-weight:700;"><i class="fa-solid fa-globe"></i> All Stations (Global)</span></td>
        <td><span style="color:var(--neon-green); font-size:0.8rem; font-weight:700;">● Active Shield</span></td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteWfWord('${w.id}')" title="Delete keyword from blacklist">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      wfWordsTableBody.appendChild(tr);
    });
  }

  function renderWfViolationsTable(violations) {
    if (!wfViolationsTableBody) return;
    wfViolationsTableBody.innerHTML = '';

    if (violations.length === 0) {
      wfViolationsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.2rem;">No security violations detected yet. System secure.</td></tr>';
      return;
    }

    violations.forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size:0.82rem; color:var(--text-muted); font-family:monospace;">${v.timeFormatted || 'Just now'}</td>
        <td style="font-weight:700; color:#fff;">${v.pcName || v.pcId}</td>
        <td><span class="badge-sev-high">${v.detectedWord}</span></td>
        <td><span class="cat-pill">${v.category || 'Security'}</span></td>
        <td style="font-size:0.82rem; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${v.activeWindow || ''}">${v.activeWindow || 'Prohibited process'}</td>
        <td>
          ${v.hasSnapshot ? '<span style="color:var(--neon-cyan); font-size:0.8rem; font-weight:700;"><i class="fa-solid fa-camera"></i> Snapshot Saved</span>' : '<span style="color:var(--text-muted); font-size:0.8rem;">None</span>'}
        </td>
      `;
      wfViolationsTableBody.appendChild(tr);
    });
  }

  window.deleteWfWord = function(wordId) {
    if (!confirm('Remove this keyword from the security blacklist?')) return;
    fetch(`/api/wordfilter/words/${wordId}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(res => {
        if (currentWfConfig) currentWfConfig.words = res.words;
        renderWfWordsTable(res.words);
        window.cyberAudio?.playClick?.();
      });
  };

  if (inputFilterWfList) {
    inputFilterWfList.addEventListener('input', () => {
      if (currentWfConfig) renderWfWordsTable(currentWfConfig.words || []);
    });
  }

  if (btnAddWfWord) {
    btnAddWfWord.addEventListener('click', () => {
      const word = (inputWfWord?.value || '').trim();
      const category = selectWfCategory?.value || 'General';
      const severity = selectWfSeverity?.value || 'medium';

      if (!word) {
        alert('Please enter a term or process name to blacklist.');
        return;
      }

      fetch('/api/wordfilter/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, category, severity })
      })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          if (ok) {
            if (inputWfWord) inputWfWord.value = '';
            if (currentWfConfig) currentWfConfig.words = data.words;
            renderWfWordsTable(data.words);
            window.cyberAudio?.playCash?.();
            alert(`✅ Added "${data.newWord.word}" to security blacklist!`);
          } else {
            alert('⚠️ ' + (data.error || 'Failed to add word'));
          }
        });
    });
  }

  if (btnSaveWordFilterConfig) {
    btnSaveWordFilterConfig.addEventListener('click', () => {
      const selectedPenaltyRadio = document.querySelector('input[name="wfPenaltyRadio"]:checked');
      const penaltyAction = selectedPenaltyRadio ? selectedPenaltyRadio.value : 'warn_only';
      const customWarningMessage = wfCustomWarningMessage ? wfCustomWarningMessage.value.trim() : '';

      const data = {
        enabled: toggleWfMaster ? toggleWfMaster.checked : true,
        actionAlertCashier: wfActionAlertCashier ? wfActionAlertCashier.checked : true,
        actionTakeSnapshot: wfActionTakeSnapshot ? wfActionTakeSnapshot.checked : true,
        actionWarnClient: wfActionWarnClient ? wfActionWarnClient.checked : true,
        penaltyAction,
        customWarningMessage
      };

      fetch('/api/wordfilter/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(r => r.json())
        .then(res => {
          window.cyberAudio?.playCash?.();
          alert(`✅ Word Filter security policy saved successfully!\n\nEnforcement Penalty: ${penaltyAction.toUpperCase()}\nPolicy synced across ALL devices.`);
        });
    });
  }

  if (btnClearWfViolations) {
    btnClearWfViolations.addEventListener('click', () => {
      if (!confirm('Clear all security violation incident logs?')) return;
      fetch('/api/wordfilter/clear-logs', { method: 'POST' })
        .then(() => {
          if (currentWfConfig) currentWfConfig.violations = [];
          renderWfViolationsTable([]);
          window.cyberAudio?.playClick?.();
        });
    });
  }

  if (btnTestWordFilterTrigger) {
    btnTestWordFilterTrigger.addEventListener('click', () => {
      fetch('/api/wordfilter/test-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcId: 'PC-01', simulatedText: 'cheatengine.exe - Speedhack active' })
      })
        .then(r => r.json())
        .then(res => {
          window.cyberAudio?.playWarning?.();
          alert('⚡ Test trigger executed: Simulated cheatengine detection on PC-01! Check alerts and violations table.');
        });
    });
  }

  // Socket Listener for Live Word Filter Alert
  socket.on('word_filter_alert', (violation) => {
    window.cyberAudio?.playWarning?.();
    alert(`🚨 SECURITY SHIELD ALERT!\n\nProhibited activity detected on ${violation.pcName}!\nTerm: "${violation.detectedWord}" [${violation.category}]\nWindow: ${violation.activeWindow}\n\nEvidence screenshot has been captured into Security Archive.`);
    if (currentWfConfig) {
      if (!currentWfConfig.violations) currentWfConfig.violations = [];
      currentWfConfig.violations.unshift(violation);
      renderWfViolationsTable(currentWfConfig.violations);
    }
  });

  // -------------------------------------------------------------
  // MIKROTIK ROUTEROS & GAMING VPN CONTROLLER
  // -------------------------------------------------------------
  const btnTestMikrotikConn = document.getElementById('btnTestMikrotikConn');
  const btnSaveMikrotikSettings = document.getElementById('btnSaveMikrotikSettings');
  const mtSimulationMode = document.getElementById('mtSimulationMode');
  const btnProvisionMikrotikVpn = document.getElementById('btnProvisionMikrotikVpn');
  const btnCopyMikrotikScript = document.getElementById('btnCopyMikrotikScript');
  const btnCopyScriptModal = document.getElementById('btnCopyScriptModal');
  const btnOpenAddVpnServerModal = document.getElementById('btnOpenAddVpnServerModal');
  const btnSubmitAddVpnServer = document.getElementById('btnSubmitAddVpnServer');
  const provisionLogBox = document.getElementById('provisionLogBox');

  function updateMikrotikStatusUI(status) {
    const pill = document.getElementById('mtStatusPill');
    if (!pill) return;
    if (status && status.connected) {
      pill.className = 'mt-conn-status-pill connected';
      pill.style.background = 'rgba(5, 255, 161, 0.15)';
      pill.style.borderColor = 'var(--neon-green, #05ffa1)';
      pill.style.color = 'var(--neon-green, #05ffa1)';
      const modelLabel = status.model || 'RouterOS';
      pill.innerHTML = `🟢 Connected • Verified (${modelLabel})`;
    } else {
      pill.className = 'mt-conn-status-pill disconnected';
      pill.style.background = 'rgba(255, 0, 85, 0.15)';
      pill.style.borderColor = 'var(--neon-pink, #ff0055)';
      pill.style.color = 'var(--neon-pink, #ff0055)';
      pill.innerHTML = `🔴 Disconnected • Unverified`;
    }
  }

  function renderVpnServersTable(servers) {
    const tbody = document.getElementById('vpnServersTableBody');
    if (!tbody) return;
    if (!servers || servers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No VPN servers configured yet.</td></tr>`;
      return;
    }

    // Count active machines per server
    const serverLoad = {};
    (state.pcs || []).forEach(p => {
      if (p.vpnEnabled && p.vpnServerId) {
        serverLoad[p.vpnServerId] = (serverLoad[p.vpnServerId] || 0) + 1;
      }
    });

    tbody.innerHTML = servers.map(srv => {
      const activePcsCount = serverLoad[srv.id] || 0;
      const loadBadge = activePcsCount > 0 
        ? `<span class="badge" style="background:rgba(0,243,255,0.18); color:var(--neon-blue); border:1px solid rgba(0,243,255,0.4); padding:3px 8px; border-radius:6px; font-weight:700;">🟢 ${activePcsCount} PC(s) Active</span>`
        : `<span style="color:var(--text-muted); font-size:0.8rem;">Idle (Standby)</span>`;

      return `
        <tr>
          <td style="font-size:1.3rem;">${srv.flag || '🌐'}</td>
          <td style="font-weight:700; color:#fff;">${srv.name}</td>
          <td><code>${srv.ip}</code></td>
          <td><span class="badge" style="background:rgba(5,255,161,0.15); color:var(--neon-green); border:1px solid rgba(5,255,161,0.3); padding:2px 8px; border-radius:6px; font-weight:700;">${srv.ping || '25ms'}</span></td>
          <td>${loadBadge}</td>
          <td>
            <button class="btn btn-danger-soft btn-xs btn-delete-vpn-server" data-server-id="${srv.id}" style="padding:4px 10px; font-size:0.75rem; border-radius:6px; cursor:pointer;" title="Delete this VPN server from the network">
              🗑️ Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-delete-vpn-server').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.serverId;
        if (!confirm('Are you sure you want to remove this VPN server from the pool?')) return;
        fetch(`/api/mikrotik/servers/${id}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(res => {
            if (res.success) {
              renderVpnServersTable(res.servers);
              window.cyberAudio?.playClick?.();
            }
          })
          .catch(err => alert('Failed to delete server: ' + err.message));
      };
    });
  }

  function getMikrotikPayload() {
    return {
      host: document.getElementById('mtHost')?.value?.trim() || '10.10.10.1',
      port: parseInt(document.getElementById('mtPort')?.value) || 8728,
      restPort: parseInt(document.getElementById('mtRestPort')?.value) || 80,
      username: document.getElementById('mtUsername')?.value?.trim() || 'admin',
      password: document.getElementById('mtPassword')?.value || '',
      vpnList: document.getElementById('mtVpnList')?.value?.trim() || 'GAMING-VPN',
      vpnServer: document.getElementById('mtVpnServer')?.value?.trim() || '219.100.37.115',
      vpnProto: document.getElementById('mtVpnProto')?.value || 'sstp',
      vpnUser: document.getElementById('mtVpnUser')?.value?.trim() || 'vpn',
      vpnPassword: document.getElementById('mtVpnPassword')?.value || 'vpn',
      vpnIpsecSecret: document.getElementById('mtVpnIpsecSecret')?.value || 'vpn',
      robloxDst: document.getElementById('mtRobloxDst')?.value?.trim() || '128.116.0.0/16',
      routingMark: 'to_GAMING_VPN'
    };
  }

  function renderMikrotikSection() {
    fetch('/api/mikrotik/config')
      .then(r => r.json())
      .then(res => {
        if (!res.success || !res.mikrotik) return;
        const mt = res.mikrotik;
        if (!state.settings) state.settings = {};
        state.settings.mikrotik = mt;

        const hostEl = document.getElementById('mtHost');
        const portEl = document.getElementById('mtPort');
        const restPortEl = document.getElementById('mtRestPort');
        const userEl = document.getElementById('mtUsername');
        const passEl = document.getElementById('mtPassword');
        const vpnListEl = document.getElementById('mtVpnList');
        const vpnServerEl = document.getElementById('mtVpnServer');
        const vpnProtoEl = document.getElementById('mtVpnProto');
        const vpnUserEl = document.getElementById('mtVpnUser');
        const vpnPassEl = document.getElementById('mtVpnPassword');
        const vpnIpsecEl = document.getElementById('mtVpnIpsecSecret');
        const robloxDstEl = document.getElementById('mtRobloxDst');

        if (hostEl) hostEl.value = mt.host || '10.10.10.1';
        if (portEl) portEl.value = mt.port || 8728;
        if (restPortEl) restPortEl.value = mt.restPort || 80;
        if (userEl) userEl.value = mt.username || 'admin';
        if (passEl && mt.password) passEl.value = mt.password;
        if (vpnListEl) vpnListEl.value = mt.vpnList || 'GAMING-VPN';
        if (vpnServerEl) vpnServerEl.value = mt.vpnServer || mt.activeVpnServer || '219.100.37.115';
        if (vpnProtoEl && mt.vpnProto) vpnProtoEl.value = mt.vpnProto;
        if (vpnUserEl) vpnUserEl.value = mt.vpnUser || 'vpn';
        if (vpnPassEl && mt.vpnPassword) vpnPassEl.value = mt.vpnPassword;
        if (vpnIpsecEl && mt.vpnIpsecSecret) vpnIpsecEl.value = mt.vpnIpsecSecret;
        if (robloxDstEl) robloxDstEl.value = mt.robloxDst || '128.116.0.0/16';

        updateMikrotikStatusUI(mt);
        renderVpnServersTable(mt.vpnServers || []);
        syncHotspotSettingsUI();
        if (state.vouchers) {
          renderHotspotVouchersTable(state.vouchers);
        }
      })
      .catch(err => console.error('Failed to load MikroTik config:', err));
  }

  if (btnTestMikrotikConn) {
    btnTestMikrotikConn.addEventListener('click', () => {
      btnTestMikrotikConn.disabled = true;
      btnTestMikrotikConn.innerHTML = '<span>⏳</span> Testing RouterOS...';

      const payload = getMikrotikPayload();

      fetch('/api/mikrotik/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(() => fetch('/api/mikrotik/test', { method: 'POST' }))
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        btnTestMikrotikConn.disabled = false;
        btnTestMikrotikConn.innerHTML = '<span>⚡</span> Test Connection';
        if (ok && data.connected) {
          updateMikrotikStatusUI({ connected: true, model: data.model });
          window.cyberAudio?.playUnlock?.();
          alert(`Successfully connected to MikroTik router!\nModel: ${data.model}\nStatus: Connected and ready.`);
        } else {
          updateMikrotikStatusUI({ connected: false });
          window.cyberAudio?.playWarning?.();
          alert(`Failed to connect to MikroTik router at ${payload.host}:${payload.port}.\nError: ${data.error || data.message || 'Connection refused or timed out'}\nPlease verify IP address, port, username and password.`);
        }
      })
      .catch(err => {
        btnTestMikrotikConn.disabled = false;
        btnTestMikrotikConn.innerHTML = '<span>⚡</span> Test Connection';
        updateMikrotikStatusUI({ connected: false });
        alert('Router connection test failed: ' + err.message);
      });
    });
  }

  if (btnSaveMikrotikSettings) {
    btnSaveMikrotikSettings.addEventListener('click', () => {
      const payload = getMikrotikPayload();

      btnSaveMikrotikSettings.disabled = true;
      btnSaveMikrotikSettings.innerHTML = '<span>💾</span> Saving...';

      fetch('/api/mikrotik/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(res => {
        btnSaveMikrotikSettings.disabled = false;
        btnSaveMikrotikSettings.innerHTML = '<span>💾</span> Save Router Settings';
        if (res.success) {
          if (!state.settings) state.settings = {};
          state.settings.mikrotik = res.mikrotik;
          window.cyberAudio?.playCash?.();
          alert('MikroTik router settings and VPN configuration saved successfully.');
        }
      })
      .catch(err => {
        btnSaveMikrotikSettings.disabled = false;
        btnSaveMikrotikSettings.innerHTML = '<span>💾</span> Save Router Settings';
        alert('Failed to save settings: ' + err.message);
      });
    });
  }

  if (btnProvisionMikrotikVpn) {
    btnProvisionMikrotikVpn.addEventListener('click', () => {
      btnProvisionMikrotikVpn.disabled = true;
      btnProvisionMikrotikVpn.innerHTML = '<span>⏳</span> Provisioning MikroTik rules...';

      const payload = getMikrotikPayload();

      fetch('/api/mikrotik/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(() => fetch('/api/mikrotik/provision-vpn', { method: 'POST' }))
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          btnProvisionMikrotikVpn.disabled = false;
          btnProvisionMikrotikVpn.innerHTML = '<span>⚡</span> Auto-Provision Rules on MikroTik';
          if (ok && data.success) {
            if (provisionLogBox) {
              provisionLogBox.style.display = 'block';
              const logLines = (data.executedResults || []).map(item => `<div>✔ ${item}</div>`).join('');
              provisionLogBox.innerHTML = `
                <div style="color:var(--neon-green); font-weight:bold; margin-bottom:0.6rem;">🛡️ [SUCCESS] MikroTik Diskless & Gaming Rules Provisioned Successfully:</div>
                <div style="color:#05ffa1; font-size:0.78rem; line-height:1.6; margin-bottom:0.8rem;">${logLines}</div>
                <div style="color:var(--neon-cyan); font-size:0.75rem; border-top:1px solid rgba(0,243,255,0.2); padding-top:0.5rem;">
                  <b>Notes:</b> Diskless boot traffic remains 100% direct and secure. Only targeted game traffic routes via tunnel, while normal browsing and game downloads operate at full direct line speed.
                </div>
              `;
            }
            window.cyberAudio?.playUnlock?.();
            alert('MikroTik rules provisioned and configured successfully!');
          } else {
            window.cyberAudio?.playWarning?.();
            alert('Failed to provision MikroTik: ' + (data.error || 'Connection error'));
          }
        })
        .catch(err => {
          btnProvisionMikrotikVpn.disabled = false;
          btnProvisionMikrotikVpn.innerHTML = '<span>⚡</span> Auto-Provision Rules on MikroTik';
          alert('Error during provisioning: ' + err.message);
        });
    });
  }

  if (btnCopyMikrotikScript) {
    btnCopyMikrotikScript.addEventListener('click', () => {
      btnCopyMikrotikScript.disabled = true;
      btnCopyMikrotikScript.innerHTML = '<span>⏳</span> Generating script...';

      const payload = getMikrotikPayload();

      fetch('/api/mikrotik/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(() => fetch('/api/mikrotik/script'))
      .then(r => r.json())
      .then(res => {
        btnCopyMikrotikScript.disabled = false;
        btnCopyMikrotikScript.innerHTML = '<span>📋</span> View & Copy Terminal Script';
        if (res.success && res.script) {
          const textarea = document.getElementById('mikrotikScriptTextarea');
          if (textarea) textarea.value = res.script;
          const fb = document.getElementById('copyScriptFeedback');
          if (fb) fb.style.display = 'none';
          openModal('mikrotikScriptModal');
        } else {
          alert('Failed to generate terminal script');
        }
      })
      .catch(err => {
        btnCopyMikrotikScript.disabled = false;
        btnCopyMikrotikScript.innerHTML = '<span>📋</span> View & Copy Terminal Script';
        alert('Failed to generate script: ' + err.message);
      });
    });
  }

  if (btnCopyScriptModal) {
    btnCopyScriptModal.addEventListener('click', () => {
      const textarea = document.getElementById('mikrotikScriptTextarea');
      const fb = document.getElementById('copyScriptFeedback');
      if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
          btnCopyScriptModal.innerHTML = '<span>✅</span> Copied to Clipboard!';
          if (fb) fb.style.display = 'inline';
          window.cyberAudio?.playClick?.();
          setTimeout(() => {
            btnCopyScriptModal.innerHTML = '<span>📄</span> Copy Entire Script';
          }, 2500);
        });
      }
    });
  }

  if (btnOpenAddVpnServerModal) {
    btnOpenAddVpnServerModal.addEventListener('click', () => {
      openModal('addVpnServerModal');
    });
  }

  if (btnSubmitAddVpnServer) {
    btnSubmitAddVpnServer.addEventListener('click', () => {
      const name = document.getElementById('newVpnName')?.value?.trim();
      const ip = document.getElementById('newVpnIp')?.value?.trim();
      const ping = document.getElementById('newVpnPing')?.value?.trim() || '25ms';
      const flag = document.getElementById('newVpnFlag')?.value?.trim() || '🌐';

      if (!name || !ip) {
        alert('Please enter both VPN server name and IP address.');
        return;
      }

      fetch('/api/mikrotik/servers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ip, ping, flag })
      })
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.success) {
          renderVpnServersTable(data.servers);
          closeModal('addVpnServerModal');
          document.getElementById('newVpnName').value = '';
          document.getElementById('newVpnIp').value = '';
          window.cyberAudio?.playCash?.();
          alert(`Added VPN Server "${name}" successfully.`);
        } else {
          alert('Failed to add VPN server: ' + (data.error || 'Validation error'));
        }
      });
    });
  }

  // -------------------------------------------------------------
  // MIKROTIK HOTSPOT SPEED PROFILES & WIFI VOUCHERS CONTROLLER
  // -------------------------------------------------------------
  let currentActiveTicket = null;
  let activeVoucherQuotaGb = 1;

  function syncHotspotSettingsUI() {
    const hs = (state.settings && state.settings.hotspot) || {};
    const defProfileEl = document.getElementById('mtHotspotDefProfile');
    const priceEl = document.getElementById('mtHotspotPricePerGb');
    const ssidEl = document.getElementById('mtHotspotSsid');
    const loginUrlEl = document.getElementById('mtHotspotLoginUrl');

    if (defProfileEl && hs.defaultProfile) defProfileEl.value = hs.defaultProfile;
    if (priceEl && hs.pricePerGb) priceEl.value = hs.pricePerGb;
    if (ssidEl && hs.ssid) ssidEl.value = hs.ssid;
    if (loginUrlEl && hs.loginUrl) loginUrlEl.value = hs.loginUrl;
  }

  function fetchHotspotVouchersLive() {
    const btn = document.getElementById('btnRefreshVouchersLive');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Syncing...';
    }

    fetch('/api/mikrotik/hotspot/vouchers')
      .then(r => r.json())
      .then(res => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>🔄</span> Sync Live Traffic';
        }
        if (res.success && Array.isArray(res.vouchers)) {
          state.vouchers = res.vouchers;
          renderHotspotVouchersTable(res.vouchers);
        }
      })
      .catch(err => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>🔄</span> Sync Live Traffic';
        }
        console.error('Failed to sync vouchers live:', err);
      });
  }

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return mb.toFixed(1) + ' MB';
    return (mb / 1024).toFixed(2) + ' GB';
  }

  function renderHotspotVouchersTable(vouchers) {
    const tbody = document.getElementById('hotspotVouchersTableBody');
    if (!tbody) return;

    if (!vouchers || vouchers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:1.8rem; text-align:center; color:var(--text-muted);">No WiFi vouchers issued yet. Click <b>🎫 Issue WiFi Voucher</b> to generate one.</td></tr>`;
      return;
    }

    tbody.innerHTML = vouchers.map(v => {
      const pinFormatted = (v.code || '').replace(/(\d{3})(\d{3})/, '$1 $2');
      const usedBytes = (v.bytesIn || 0) + (v.bytesOut || 0);
      const limitBytes = v.limitBytesTotal || (v.gigabytes * 1073741824);
      const pct = Math.min(100, Math.max(0, Math.round((usedBytes / limitBytes) * 100)));

      let statusBadge = `<span class="badge-voucher-status active">● Active</span>`;
      if (v.status === 'depleted') {
        statusBadge = `<span class="badge-voucher-status depleted">⚠ Depleted</span>`;
      } else if (v.status === 'expired') {
        statusBadge = `<span class="badge-voucher-status expired">⏱ Expired (30d)</span>`;
      }

      const speedLabel = (v.speedProfile || 'profile_4m').replace('profile_', '').toUpperCase();
      const createdDateStr = v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

      return `
        <tr>
          <td>
            <span class="font-cyber" style="color:var(--neon-cyan); font-weight:800; font-size:1.05rem; letter-spacing:1px; background:rgba(0,243,255,0.08); padding:3px 8px; border-radius:6px; border:1px solid rgba(0,243,255,0.25);">
              ${pinFormatted}
            </span>
          </td>
          <td>
            <b style="color:#fff; font-size:0.95rem;">${v.gigabytes} GB</b>
          </td>
          <td>
            <div style="min-width:140px;">
              <div class="voucher-traffic-bar">
                <div class="fill ${pct > 90 ? 'danger' : (pct > 70 ? 'warning' : '')}" style="width:${pct}%;"></div>
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px; display:flex; justify-content:space-between;">
                <span>${formatBytes(usedBytes)}</span>
                <span style="font-weight:700; color:${pct > 90 ? 'var(--neon-pink)' : '#94a3b8'};">${pct}%</span>
              </div>
            </div>
          </td>
          <td>
            <span class="badge" style="background:rgba(5,255,161,0.12); color:var(--neon-green); border:1px solid rgba(5,255,161,0.3); padding:3px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">
              ${speedLabel}
            </span>
          </td>
          <td style="font-size:0.76rem; color:var(--text-muted);">${createdDateStr}</td>
          <td>
            <span style="font-size:0.78rem; color:#94a3b8;">30 Days <small style="color:var(--neon-cyan);">(1 Device)</small></span>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; gap:0.35rem; justify-content:center;">
              <button class="btn btn-secondary-soft btn-xs btn-show-ticket" data-code="${v.code}" style="padding:4px 8px; font-size:0.75rem; border-radius:5px;" title="View & Print Ticket">
                🎫 Print
              </button>
              <button class="btn btn-danger-soft btn-xs btn-delete-voucher" data-code="${v.code}" style="padding:4px 8px; font-size:0.75rem; border-radius:5px;" title="Delete Voucher from MikroTik">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach listeners for Print & Delete buttons
    tbody.querySelectorAll('.btn-show-ticket').forEach(b => {
      b.onclick = () => {
        const code = b.dataset.code;
        const v = (state.vouchers || []).find(x => x.code === code);
        if (v) showVoucherTicket(v);
      };
    });

    tbody.querySelectorAll('.btn-delete-voucher').forEach(b => {
      b.onclick = () => {
        const code = b.dataset.code;
        if (!confirm(`Are you sure you want to delete and revoke WiFi Voucher (${code}) from MikroTik router immediately?`)) return;
        fetch(`/api/mikrotik/hotspot/voucher/${code}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(res => {
            if (res.success) {
              state.vouchers = (state.vouchers || []).filter(x => x.code !== code);
              renderHotspotVouchersTable(state.vouchers);
              window.cyberAudio?.playClick?.();
            } else {
              alert('Failed to delete voucher: ' + (res.error || 'Error'));
            }
          })
          .catch(err => alert('Network error: ' + err.message));
      };
    });
  }

  function getHotspotPricePerGb() {
    const inputVal = parseFloat(document.getElementById('mtHotspotPricePerGb')?.value);
    if (!isNaN(inputVal) && inputVal > 0) return inputVal;
    return (state.settings && state.settings.hotspot && state.settings.hotspot.pricePerGb) || 5;
  }

  function updateVoucherPriceCalculation() {
    const pricePerGb = getHotspotPricePerGb();
    const priceInput = document.getElementById('voucherPriceInput');
    if (priceInput) {
      priceInput.value = (activeVoucherQuotaGb * pricePerGb).toFixed(0);
    }
    // Update pills price labels
    const p1 = document.getElementById('pillPrice1');
    const p2 = document.getElementById('pillPrice2');
    const p3 = document.getElementById('pillPrice3');
    const p4 = document.getElementById('pillPrice4');
    if (p1) p1.textContent = (1 * pricePerGb).toFixed(0);
    if (p2) p2.textContent = (2 * pricePerGb).toFixed(0);
    if (p3) p3.textContent = (3 * pricePerGb).toFixed(0);
    if (p4) p4.textContent = (4 * pricePerGb).toFixed(0);
  }

  function openIssueVoucherModal() {
    const hs = (state.settings && state.settings.hotspot) || {};
    const defaultProfile = hs.defaultProfile || 'profile_4m';
    const profileSelect = document.getElementById('voucherSpeedProfile');
    if (profileSelect) profileSelect.value = defaultProfile;

    // Default to 1 GB
    activeVoucherQuotaGb = 1;
    document.querySelectorAll('.quota-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.quota === '1');
    });

    const customWrap = document.getElementById('customQuotaWrap');
    if (customWrap) customWrap.style.display = 'none';

    updateVoucherPriceCalculation();

    const noteInput = document.getElementById('voucherCustomerName');
    if (noteInput) noteInput.value = '';

    const chkDrawer = document.getElementById('voucherAddToDrawer');
    if (chkDrawer) chkDrawer.checked = true;

    openModal('issueVoucherModal');
  }

  window.openIssueVoucherModal = openIssueVoucherModal;

  // Quota pills click handler
  document.querySelectorAll('.quota-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.quota-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const quota = pill.dataset.quota;
      const customWrap = document.getElementById('customQuotaWrap');

      if (quota === 'custom') {
        if (customWrap) customWrap.style.display = 'block';
        const customInput = document.getElementById('customQuotaGb');
        activeVoucherQuotaGb = parseFloat(customInput?.value) || 5;
      } else {
        if (customWrap) customWrap.style.display = 'none';
        activeVoucherQuotaGb = parseFloat(quota) || 1;
      }
      updateVoucherPriceCalculation();
      window.cyberAudio?.playClick?.();
    });
  });

  const customQuotaInput = document.getElementById('customQuotaGb');
  if (customQuotaInput) {
    customQuotaInput.addEventListener('input', () => {
      const val = parseFloat(customQuotaInput.value);
      if (!isNaN(val) && val > 0) {
        activeVoucherQuotaGb = val;
        updateVoucherPriceCalculation();
      }
    });
  }

  // Quick Issue Button in Top Action Bar
  const btnQuickIssueVoucher = document.getElementById('btnQuickIssueVoucher');
  if (btnQuickIssueVoucher) {
    btnQuickIssueVoucher.addEventListener('click', () => {
      openIssueVoucherModal();
    });
  }

  // Provision Hotspot Profiles Button
  const btnProvisionHotspotProfiles = document.getElementById('btnProvisionHotspotProfiles');
  if (btnProvisionHotspotProfiles) {
    btnProvisionHotspotProfiles.addEventListener('click', () => {
      btnProvisionHotspotProfiles.disabled = true;
      btnProvisionHotspotProfiles.innerHTML = '<span>⏳</span> Installing profiles on MikroTik...';

      fetch('/api/mikrotik/hotspot/profiles/provision', { method: 'POST' })
        .then(r => r.json().then(data => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          btnProvisionHotspotProfiles.disabled = false;
          btnProvisionHotspotProfiles.innerHTML = '<span>⚡</span> Install Profiles on MikroTik Now';
          if (ok && data.success) {
            window.cyberAudio?.playUnlock?.();
            alert(`✅ All 4 speed profiles installed and configured on MikroTik successfully!\n\n1. profile_2m (2 Mbps)\n2. profile_4m (4 Mbps)\n3. profile_8m (8 Mbps)\n4. profile_10m (10 Mbps)\n\nRules active: 1 device binding (shared-users=1) and auto-removal upon 30 days or quota depletion.`);
          } else {
            window.cyberAudio?.playWarning?.();
            alert('Failed to install profiles: ' + (data.error || 'Connection error'));
          }
        })
        .catch(err => {
          btnProvisionHotspotProfiles.disabled = false;
          btnProvisionHotspotProfiles.innerHTML = '<span>⚡</span> Install Profiles on MikroTik Now';
          alert('Error during profile provisioning: ' + err.message);
        });
    });
  }

  // Copy Hotspot Script Button
  const btnCopyHotspotScript = document.getElementById('btnCopyHotspotScript');
  if (btnCopyHotspotScript) {
    btnCopyHotspotScript.addEventListener('click', () => {
      fetch('/api/mikrotik/hotspot/profiles/script')
        .then(r => r.json())
        .then(res => {
          if (res.success && res.script) {
            const textarea = document.getElementById('hotspotScriptTextarea');
            if (textarea) textarea.value = res.script;
            const fb = document.getElementById('copyHotspotScriptFeedback');
            if (fb) fb.style.display = 'none';
            openModal('hotspotScriptModal');
          } else {
            alert('Failed to generate terminal script');
          }
        })
        .catch(err => alert('Error generating script: ' + err.message));
    });
  }

  const btnCopyHotspotScriptModal = document.getElementById('btnCopyHotspotScriptModal');
  if (btnCopyHotspotScriptModal) {
    btnCopyHotspotScriptModal.addEventListener('click', () => {
      const textarea = document.getElementById('hotspotScriptTextarea');
      const fb = document.getElementById('copyHotspotScriptFeedback');
      if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
          if (fb) fb.style.display = 'inline';
          window.cyberAudio?.playClick?.();
          setTimeout(() => { if (fb) fb.style.display = 'none'; }, 3000);
        });
      }
    });
  }

  // Save Hotspot Settings Button
  const btnSaveHotspotSettings = document.getElementById('btnSaveHotspotSettings');
  if (btnSaveHotspotSettings) {
    btnSaveHotspotSettings.addEventListener('click', () => {
      const defaultProfile = document.getElementById('mtHotspotDefProfile')?.value || 'profile_4m';
      const pricePerGb = parseFloat(document.getElementById('mtHotspotPricePerGb')?.value) || 5;
      const ssid = document.getElementById('mtHotspotSsid')?.value?.trim() || 'CyberPulse_Gaming_WiFi';
      const loginUrl = document.getElementById('mtHotspotLoginUrl')?.value?.trim() || 'http://10.10.10.1/login';

      btnSaveHotspotSettings.disabled = true;
      btnSaveHotspotSettings.innerHTML = '<span>💾</span> Saving...';

      fetch('/api/mikrotik/hotspot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultProfile, pricePerGb, ssid, loginUrl })
      })
      .then(r => r.json())
      .then(res => {
        btnSaveHotspotSettings.disabled = false;
        btnSaveHotspotSettings.innerHTML = '<span>💾</span> Save WiFi Settings';
        if (res.success) {
          if (!state.settings) state.settings = {};
          state.settings.hotspot = res.hotspot;
          window.cyberAudio?.playCash?.();
          alert('WiFi voucher settings saved successfully (persisted for all future vouchers).');
        }
      })
      .catch(err => {
        btnSaveHotspotSettings.disabled = false;
        btnSaveHotspotSettings.innerHTML = '<span>💾</span> Save WiFi Settings';
        alert('Failed to save settings: ' + err.message);
      });
    });
  }

  // Refresh Vouchers Live Button
  const btnRefreshVouchersLive = document.getElementById('btnRefreshVouchersLive');
  if (btnRefreshVouchersLive) {
    btnRefreshVouchersLive.addEventListener('click', () => {
      fetchHotspotVouchersLive();
      window.cyberAudio?.playClick?.();
    });
  }

  // Issue Voucher Form Submission
  const formIssueVoucher = document.getElementById('formIssueVoucher');
  if (formIssueVoucher) {
    formIssueVoucher.addEventListener('submit', (e) => {
      e.preventDefault();

      const gigabytes = activeVoucherQuotaGb;
      const speedProfile = document.getElementById('voucherSpeedProfile')?.value || 'profile_4m';
      const price = parseFloat(document.getElementById('voucherPriceInput')?.value) || (gigabytes * 5);
      const customerName = document.getElementById('voucherCustomerName')?.value?.trim() || '';
      const addToDrawer = document.getElementById('voucherAddToDrawer')?.checked ?? true;

      const submitBtn = document.getElementById('btnSubmitIssueVoucher');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Connecting to MikroTik and issuing voucher...';
      }

      fetch('/api/mikrotik/hotspot/voucher/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gigabytes, speedProfile, price, customerName, addToDrawer })
      })
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>⚡</span> Issue & Print Voucher Now';
        }

        if (ok && data.success && data.voucher) {
          closeModal('issueVoucherModal');
          window.cyberAudio?.playCash?.();
          if (!state.vouchers) state.vouchers = [];
          state.vouchers.unshift(data.voucher);
          renderHotspotVouchersTable(state.vouchers);
          showVoucherTicket(data.voucher);
          if (addToDrawer) {
            fetchState();
          }
        } else {
          window.cyberAudio?.playWarning?.();
          alert('Failed to issue voucher: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(err => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>⚡</span> Issue & Print Voucher Now';
        }
        alert('Error during voucher issuance: ' + err.message);
      });
    });
  }

  // Ticket Modal Display Function
  function showVoucherTicket(v) {
    currentActiveTicket = v;

    const pinEl = document.getElementById('ticketPinCode');
    const qrImg = document.getElementById('ticketQrImage');
    const quotaEl = document.getElementById('ticketQuota');
    const speedEl = document.getElementById('ticketSpeed');
    const validityEl = document.getElementById('ticketValidity');
    const priceEl = document.getElementById('ticketPrice');
    const ssidEl = document.getElementById('ticketSsid');
    const timeEl = document.getElementById('ticketTimestamp');
    const feedbackEl = document.getElementById('copyVoucherFeedback');

    if (feedbackEl) feedbackEl.style.display = 'none';

    if (pinEl) {
      pinEl.textContent = (v.code || '').replace(/(\d{3})(\d{3})/, '$1 $2');
    }
    if (qrImg && v.qrCodeDataUrl) {
      qrImg.src = v.qrCodeDataUrl;
    }
    if (quotaEl) {
      quotaEl.textContent = `${v.gigabytes} GB (${v.gigabytes} جيجابايت)`;
    }
    if (speedEl) {
      const sp = (v.speedProfile || 'profile_4m').replace('profile_', '').toUpperCase();
      speedEl.textContent = `${sp} Dedicated`;
    }
    if (validityEl) {
      validityEl.textContent = '30 يوم من أول استخدام';
    }
    if (priceEl) {
      priceEl.textContent = `${Number(v.price).toFixed(2)} EGP`;
    }
    if (ssidEl) {
      ssidEl.textContent = v.ssid || (state.settings && state.settings.hotspot && state.settings.hotspot.ssid) || 'CyberPulse_Gaming_WiFi';
    }
    if (timeEl) {
      timeEl.textContent = v.createdAt ? new Date(v.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG');
    }

    openModal('voucherTicketModal');
  }

  window.showVoucherTicket = showVoucherTicket;

  // Print Ticket Slip Button
  const btnPrintVoucherTicket = document.getElementById('btnPrintVoucherTicket');
  if (btnPrintVoucherTicket) {
    btnPrintVoucherTicket.addEventListener('click', () => {
      window.print();
    });
  }

  // Copy PIN Code Button
  const btnCopyVoucherCode = document.getElementById('btnCopyVoucherCode');
  if (btnCopyVoucherCode) {
    btnCopyVoucherCode.addEventListener('click', () => {
      if (currentActiveTicket && currentActiveTicket.code) {
        navigator.clipboard.writeText(currentActiveTicket.code).then(() => {
          const fb = document.getElementById('copyVoucherFeedback');
          if (fb) fb.style.display = 'inline';
          window.cyberAudio?.playClick?.();
          setTimeout(() => { if (fb) fb.style.display = 'none'; }, 2500);
        });
      }
    });
  }

  // Issue Another Voucher Button
  const btnIssueAnotherVoucher = document.getElementById('btnIssueAnotherVoucher');
  if (btnIssueAnotherVoucher) {
    btnIssueAnotherVoucher.addEventListener('click', () => {
      closeModal('voucherTicketModal');
      openIssueVoucherModal();
    });
  }

  // -------------------------------------------------------------
  // DOUBLE-CLICK DEVICE ICON PICKER CONTROLLER
  // -------------------------------------------------------------
  let activeIconPickerPcId = null;
  let activePickerModel = 'curved_monitor';
  let activePickerColor = '#00f3ff';

  const modalIconPicker = document.getElementById('deviceIconPickerModal');
  const btnCloseIconPicker = document.getElementById('btnCloseIconPicker');
  const iconPickerModalTitle = document.getElementById('iconPickerModalTitle');
  const iconPickerLivePreview = document.getElementById('iconPickerLivePreview');
  const pickerModalColorInput = document.getElementById('pickerModalColorInput');
  const pickerModalColorHex = document.getElementById('pickerModalColorHex');
  const chkApplyIconToAll = document.getElementById('chkApplyIconToAll');
  const btnSubmitIconPicker = document.getElementById('btnSubmitIconPicker');

  window.openDeviceIconPickerModal = function(pcId) {
    activeIconPickerPcId = pcId;
    const pc = state.pcs.find(p => p.id === pcId);
    if (!pc) return;

    const titleEl = document.getElementById('iconPickerModalTitle');
    if (titleEl) {
      titleEl.textContent = `Choose Icon & Style for ${pc.name}`;
    }

    activePickerModel = pc.customModel || 'curved_monitor';
    activePickerColor = pc.customColor || '#00f3ff';

    const colorInput = document.getElementById('pickerModalColorInput');
    const colorHex = document.getElementById('pickerModalColorHex');
    const chkAll = document.getElementById('chkApplyIconToAll');

    if (colorInput) colorInput.value = activePickerColor;
    if (colorHex) colorHex.value = activePickerColor;
    if (chkAll) chkAll.checked = false;

    // Set active radio card
    document.querySelectorAll('[data-picker-style]').forEach(card => {
      const isSel = card.dataset.pickerStyle === activePickerModel;
      card.classList.toggle('active', isSel);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSel;
    });

    renderPickerModalPreview();

    const modal = document.getElementById('deviceIconPickerModal');
    if (modal) {
      modal.classList.add('active');
    }
    window.cyberAudio?.playClick?.();
  };

  function renderPickerModalPreview() {
    if (!iconPickerLivePreview) return;
    iconPickerLivePreview.innerHTML = generateHardwareSvg(activePickerModel, activePickerColor, 'picker_preview', '', false, 'available', null, false);
  }

  // Model card clicks inside picker modal
  document.querySelectorAll('[data-picker-style]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-picker-style]').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      activePickerModel = card.dataset.pickerStyle;
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      renderPickerModalPreview();
      window.cyberAudio?.playClick?.();
    });
  });

  // Color changes inside picker modal
  if (pickerModalColorInput && pickerModalColorHex) {
    pickerModalColorInput.addEventListener('input', () => {
      pickerModalColorHex.value = pickerModalColorInput.value;
      activePickerColor = pickerModalColorInput.value;
      renderPickerModalPreview();
    });
    pickerModalColorHex.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(pickerModalColorHex.value)) {
        pickerModalColorInput.value = pickerModalColorHex.value;
        activePickerColor = pickerModalColorHex.value;
        renderPickerModalPreview();
      }
    });
  }

  // Close button
  if (btnCloseIconPicker) {
    btnCloseIconPicker.addEventListener('click', () => {
      if (modalIconPicker) modalIconPicker.classList.remove('active');
    });
  }

  // Submit button
  if (btnSubmitIconPicker) {
    btnSubmitIconPicker.addEventListener('click', () => {
      const applyToAll = chkApplyIconToAll ? chkApplyIconToAll.checked : false;
      fetch('/api/pc/visuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pcId: activeIconPickerPcId,
          model: activePickerModel,
          color: activePickerColor,
          applyToAll
        })
      })
      .then(r => r.json())
      .then(res => {
        if (applyToAll) {
          state.pcs.forEach(p => {
            p.customModel = activePickerModel;
            p.customColor = activePickerColor;
          });
        } else if (res.pc) {
          const idx = state.pcs.findIndex(p => p.id === activeIconPickerPcId);
          if (idx !== -1) state.pcs[idx] = res.pc;
        }
        if (modalIconPicker) modalIconPicker.classList.remove('active');
        renderPcsGrid();
        window.cyberAudio?.playCash?.();
        alert('Device icon and color updated successfully.');
      });
    });
  }


  // -------------------------------------------------------------
  // STATE ICON GALLERY CHOOSER CONTROLLER (MULTI-CATEGORY & EMOJIS)
  // -------------------------------------------------------------
  const AVAILABLE_HARDWARE_MODELS = [
    { id: 'curved_monitor', category: 'hardware', title: '1000R Curved Gaming Monitor', desc: 'Curved OLED screen with ambient underglow & V-Legs', symbol: '🖥️' },
    { id: 'ultrawide', category: 'hardware', title: 'UltraWide 34" Curved Display', desc: 'Cinematic 21:9 curved screen with wide desktop base', symbol: '📺' },
    { id: 'gaming_tower', category: 'hardware', title: 'RGB Glass Gaming Tower Case', desc: 'Tempered glass chassis with ARGB cooling fans', symbol: '🎮' },
    { id: 'gaming_laptop', category: 'hardware', title: 'Pro Esports Gaming Laptop', desc: 'Slim esports laptop with illuminated RGB keyboard', symbol: '💻' },
    { id: 'flat_monitor', category: 'hardware', title: 'Flat Esports Tournament Display', desc: 'Zero-bezel 16:9 tournament monitor with circular base', symbol: '🖥️' },
    { id: 'console_rig', category: 'hardware', title: 'Console Lounge Battlestation', desc: 'Next-gen gaming console with dual wireless gamepad', symbol: '🕹️' }
  ];

  let currentGalleryStateKey = null;
  let currentGalleryActiveModel = 'curved_monitor';
  let currentGalleryActiveColor = '#00f3ff';
  let currentGalleryCategoryFilter = 'all';

  function updateGalleryLivePreviewBox() {
    const previewWrap = document.getElementById('galleryLivePreviewWrap');
    const titleEl = document.getElementById('gallerySelectedTitle');
    const descEl = document.getElementById('gallerySelectedDesc');

    if (previewWrap) {
      previewWrap.innerHTML = generateHardwareSvg(currentGalleryActiveModel, currentGalleryActiveColor, 'gal_preview', '', false, currentGalleryStateKey, null, true);
    }

    const allItems = [...AVAILABLE_HARDWARE_MODELS, ...AVAILABLE_ESPORTS_ICONS];
    const found = allItems.find(i => i.id === currentGalleryActiveModel);
    if (found) {
      if (titleEl) titleEl.textContent = found.title;
      if (descEl) descEl.textContent = found.desc;
    } else if (currentGalleryActiveModel && currentGalleryActiveModel.startsWith('custom_')) {
      if (titleEl) titleEl.textContent = `Custom Symbol (${currentGalleryActiveModel.replace('custom_', '')})`;
      if (descEl) descEl.textContent = 'Custom player-defined symbol with ambient neon glow';
    }
  }

  function renderGalleryGrid() {
    const grid = document.getElementById('stateGalleryGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const allItems = [...AVAILABLE_HARDWARE_MODELS, ...AVAILABLE_ESPORTS_ICONS];
    const filtered = allItems.filter(item => {
      if (currentGalleryCategoryFilter === 'all') return true;
      return item.category === currentGalleryCategoryFilter;
    });

    filtered.forEach(m => {
      const card = document.createElement('div');
      const isSelected = m.id === currentGalleryActiveModel;
      card.className = `gallery-model-card ${isSelected ? 'active' : ''}`;
      card.style.cursor = 'pointer';
      card.title = 'Double-click to select immediately';

      card.innerHTML = `
        <div class="gallery-card-preview" style="height: 100px; display: flex; align-items: center; justify-content: center;">
          ${generateHardwareSvg(m.id, currentGalleryActiveColor, `gal_${m.id}`, '', false, currentGalleryStateKey, null, true)}
        </div>
        <div class="gallery-card-info" style="margin-top: 0.5rem; text-align: center;">
          <div class="gallery-card-title" style="font-size: 0.88rem; font-weight: 700; color: #fff;">${m.title}</div>
          <div class="gallery-card-desc" style="font-size: 0.74rem; color: var(--text-muted);">${m.desc}</div>
        </div>
        <div class="gallery-select-badge" style="margin-top: 0.5rem;">${isSelected ? '✓ SELECTED' : 'SELECT'}</div>
      `;

      card.addEventListener('click', () => {
        currentGalleryActiveModel = m.id;
        updateGalleryLivePreviewBox();
        renderGalleryGrid();
      });

      card.addEventListener('dblclick', () => {
        currentGalleryActiveModel = m.id;
        selectModelForState(currentGalleryStateKey, m.id, currentGalleryActiveColor);
      });

      grid.appendChild(card);
    });
  }

  window.openStateIconGallery = function(stateKey) {
    currentGalleryStateKey = stateKey;
    const stateVisualsMap = (currentVisuals && currentVisuals.stateVisuals) || defaultStateVisuals;
    const stateConf = stateVisualsMap[stateKey] || defaultStateVisuals[stateKey] || defaultStateVisuals.available;
    
    currentGalleryActiveColor = stateConf.color || '#00f3ff';
    currentGalleryActiveModel = stateConf.model || 'curved_monitor';
    currentGalleryCategoryFilter = 'all';

    const titleEl = document.getElementById('galleryStateTitle');
    if (titleEl) {
      const stateLabels = {
        maintenance: 'Maintenance Mode Stations',
        idle: 'Idle / Inactive Stations',
        openTime: 'Open-Time Sessions',
        fixedTime: 'Fixed-Time Prepaid Sessions',
        member: 'Member / VIP Account Sessions',
        admin: 'Admin / Staff Sessions',
        disconnected: 'Connection Lost Stations',
        offline: 'Powered Off / Offline Stations',
        lowTime: 'Low-Time Warning (< 5 Mins)',
        available: 'Available / Ready Stations'
      };
      titleEl.textContent = `Choose Icon for: ${stateLabels[stateKey] || stateKey}`;
    }

    const colorPicker = document.getElementById('galleryColorPicker');
    const colorHex = document.getElementById('galleryColorHex');
    if (colorPicker) colorPicker.value = currentGalleryActiveColor;
    if (colorHex) colorHex.value = currentGalleryActiveColor;

    document.querySelectorAll('.gallery-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabFilter === 'all');
    });

    updateGalleryLivePreviewBox();
    renderGalleryGrid();

    const modal = document.getElementById('stateIconGalleryModal');
    if (modal) {
      modal.classList.add('active');
    }
    window.cyberAudio?.playClick?.();
  };

  // Gallery tabs filter listener
  document.querySelectorAll('.gallery-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gallery-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGalleryCategoryFilter = btn.dataset.tabFilter || 'all';
      renderGalleryGrid();
    });
  });

  // Gallery live color input
  const galleryColorPicker = document.getElementById('galleryColorPicker');
  const galleryColorHex = document.getElementById('galleryColorHex');
  if (galleryColorPicker && galleryColorHex) {
    galleryColorPicker.addEventListener('input', () => {
      galleryColorHex.value = galleryColorPicker.value;
      currentGalleryActiveColor = galleryColorPicker.value;
      updateGalleryLivePreviewBox();
      renderGalleryGrid();
    });
    galleryColorHex.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(galleryColorHex.value)) {
        galleryColorPicker.value = galleryColorHex.value;
        currentGalleryActiveColor = galleryColorHex.value;
        updateGalleryLivePreviewBox();
        renderGalleryGrid();
      }
    });
  }

  // Custom symbol input
  const btnApplyCustomSymbol = document.getElementById('btnApplyCustomSymbol');
  const galleryCustomSymbolInput = document.getElementById('galleryCustomSymbolInput');
  if (btnApplyCustomSymbol && galleryCustomSymbolInput) {
    btnApplyCustomSymbol.addEventListener('click', () => {
      const sym = galleryCustomSymbolInput.value.trim();
      if (!sym) return;
      currentGalleryActiveModel = `custom_${sym}`;
      updateGalleryLivePreviewBox();
      renderGalleryGrid();
      window.cyberAudio?.playClick?.();
    });
  }

  // Confirm selection button
  const btnConfirmGallerySelection = document.getElementById('btnConfirmGallerySelection');
  if (btnConfirmGallerySelection) {
    btnConfirmGallerySelection.addEventListener('click', () => {
      selectModelForState(currentGalleryStateKey, currentGalleryActiveModel, currentGalleryActiveColor);
    });
  }

  function selectModelForState(stateKey, modelId, newColor) {
    if (!currentVisuals.stateVisuals) currentVisuals.stateVisuals = {};
    if (!currentVisuals.stateVisuals[stateKey]) {
      currentVisuals.stateVisuals[stateKey] = {};
    }
    currentVisuals.stateVisuals[stateKey].model = modelId;
    if (newColor) {
      currentVisuals.stateVisuals[stateKey].color = newColor;
    }

    // Update select dropdown in settings row
    const sel = document.querySelector(`.state-model-select[data-state-key="${stateKey}"]`);
    if (sel) {
      let optExists = Array.from(sel.options).some(o => o.value === modelId);
      if (!optExists) {
        const newOpt = document.createElement('option');
        newOpt.value = modelId;
        const allItems = [...AVAILABLE_HARDWARE_MODELS, ...AVAILABLE_ESPORTS_ICONS];
        const found = allItems.find(i => i.id === modelId);
        newOpt.textContent = found ? `${found.symbol} ${found.title}` : (modelId.startsWith('custom_') ? modelId.replace('custom_', '') : modelId);
        sel.appendChild(newOpt);
      }
      sel.value = modelId;
    }

    // Update color picker in settings row
    if (newColor) {
      const picker = document.querySelector(`.state-color-picker[data-state-key="${stateKey}"]`);
      const hexInput = document.querySelector(`.state-color-hex[data-state-key="${stateKey}"]`);
      if (picker) picker.value = newColor;
      if (hexInput) hexInput.value = newColor;
    }

    // Persist immediately to localStorage and server
    localStorage.setItem('cyber_custom_visuals', JSON.stringify(currentVisuals));
    fetch('/api/settings/visuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentVisuals)
    }).catch(e => console.error(e));

    renderMiniPreviews();
    renderLivePreview();
    renderPcsGrid();

    const modal = document.getElementById('stateIconGalleryModal');
    if (modal) modal.classList.remove('active');

    window.cyberAudio?.playUnlock?.();
  }

});
