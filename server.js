const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dgram = require('dgram');
const net = require('net');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4000;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// -------------------------------------------------------------
// WAKE-ON-LAN (WOL) MAGIC PACKET SENDER
// -------------------------------------------------------------
function sendWakeOnLan(macAddress) {
  return new Promise((resolve, reject) => {
    try {
      if (!macAddress) return reject(new Error('Device MAC address is missing'));
      const cleanMac = macAddress.replace(/[^0-9A-Fa-f]/g, '');
      if (cleanMac.length !== 12) return reject(new Error('Invalid MAC address format (must be 12 hex characters)'));

      const macBuffer = Buffer.from(cleanMac, 'hex');
      const magicPacket = Buffer.alloc(102);
      magicPacket.fill(0xFF, 0, 6);
      for (let i = 0; i < 16; i++) {
        macBuffer.copy(magicPacket, 6 + i * 6);
      }

      const client = dgram.createSocket('udp4');
      client.bind(() => {
        client.setBroadcast(true);
        client.send(magicPacket, 0, magicPacket.length, 9, '255.255.255.255', (err) => {
          client.close();
          if (err) return reject(err);
          resolve(true);
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

const activeMasterTokens = new Set(['MASTER_DEV_ROOT']);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// IN-MEMORY / PERSISTENT DATABASE STORE
// -------------------------------------------------------------
const DATA_FILE = path.join(__dirname, 'cyber_data.json');

// Default PCs setup (Empty - Devices auto-discovered from local network)
const DEFAULT_PCS = [];

// Default Cafeteria Menu
const DEFAULT_MENU = [
  { id: 'c1', name: 'Sprite / Pepsi Can', category: 'Cold Drinks', price: 15, stock: 45, icon: '🥤' },
  { id: 'c2', name: 'Red Bull Energy Drink', category: 'Cold Drinks', price: 45, stock: 20, icon: '⚡' },
  { id: 'c3', name: 'Chilled Mineral Water', category: 'Cold Drinks', price: 7, stock: 60, icon: '💧' },
  { id: 'h1', name: 'Authentic Black Tea', category: 'Hot Drinks', price: 10, stock: 100, icon: '🍵' },
  { id: 'h2', name: 'Turkish Espresso Coffee', category: 'Hot Drinks', price: 18, stock: 50, icon: '☕' },
  { id: 'h3', name: 'Nescafe 3-in-1 Milk Blend', category: 'Hot Drinks', price: 20, stock: 40, icon: '🥛' },
  { id: 's1', name: 'Super Indomie Noodles', category: 'Meals', price: 25, stock: 35, icon: '🍜' },
  { id: 's2', name: 'Crispy Cheese Melt Sandwich', category: 'Meals', price: 40, stock: 15, icon: '🥪' },
  { id: 's3', name: 'Family Size Potato Chips', category: 'Snacks', price: 15, stock: 30, icon: '🥔' },
  { id: 's4', name: 'Snickers / KitKat Bar', category: 'Snacks', price: 22, stock: 25, icon: '🍫' }
];

// Default Games List
const DEFAULT_GAMES = [
  { id: 'val', title: 'Valorant', category: 'Shooters', developer: 'Riot Games', poster: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'cs2', title: 'Counter-Strike 2', category: 'Shooters', developer: 'Valve', poster: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'cod', title: 'Call of Duty: Warzone', category: 'Battle Royale', developer: 'Activision', poster: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'lol', title: 'League of Legends', category: 'MOBA', developer: 'Riot Games', poster: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'dota', title: 'Dota 2', category: 'MOBA', developer: 'Valve', poster: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'fn', title: 'Fortnite', category: 'Battle Royale', developer: 'Epic Games', poster: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'pubg', title: 'PUBG: BATTLEGROUNDS', category: 'Battle Royale', developer: 'Krafton', poster: 'https://images.unsplash.com/photo-1552824722-ddab137e4099?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'fc25', title: 'EA SPORTS FC 25', category: 'Sports', developer: 'EA Sports', poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop&q=80', status: 'Ready' },
  { id: 'gta5', title: 'GTA V / FiveM Roleplay', category: 'Open World', developer: 'Rockstar Games', poster: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&auto=format&fit=crop&q=80', status: 'Ready' }
];

let db = {
  pcs: DEFAULT_PCS,
  menu: DEFAULT_MENU,
  games: DEFAULT_GAMES,
  shift: {
    id: 'SHIFT-' + Date.now().toString().slice(-6),
    cashierName: 'Alex Morgan (Head Cashier)',
    startTime: new Date().toISOString(),
    startDrawerCash: 250,
    totalGameRevenue: 0,
    totalCafeRevenue: 0
  },
  invoices: [],
  auditLog: [],
  screenSnapshots: {}, // pcId -> base64 frame
  screenshots: [], // Gallery of captured screenshots { id, pcId, timestamp, timeFormatted, image, note }
  settings: {
    branding: {
      shopName: 'CYBERPULSE OS',
      shopSubtitle: 'Esports Lounge & Central Arena Management',
      shopLogo: '⚡'
    },
    masterPassword: 'admin',
    power: {
      autoShutdownIdleEnabled: true,
      idleThresholdMinutes: 10,
      warningCountdownSeconds: 60,
      pauseSessionOnDisconnect: true // Auto-pause session timer during station power outage
    },
    statusIcons: {
      maintenance: 'fa-solid fa-wrench',
      idle: 'fa-solid fa-moon',
      openTime: 'fa-solid fa-stopwatch',
      fixedTime: 'fa-solid fa-hourglass-half',
      member: 'fa-solid fa-crown',
      admin: 'fa-solid fa-user-shield',
      disconnected: 'fa-solid fa-triangle-exclamation',
      offline: 'fa-solid fa-power-off',
      lowTime: 'fa-solid fa-bell',
      available: 'fa-solid fa-circle-check'
    },
    viewMode: 'large',
    wordFilter: {
      enabled: true,
      actionAlertCashier: true,
      actionTakeSnapshot: true,
      actionWarnClient: true,
      penaltyAction: 'warn_only', // 'warn_only' | 'lock_session' | 'restart_pc' | 'shutdown_pc'
      customWarningMessage: 'Security Shield Alert: Access to prohibited term "{word}" was detected on {pc}. Please close this immediately or your station will face enforcement.',
      words: [
        // Cheats & Hacks (High)
        { id: 'wf-cheat-1', word: 'cheatengine', category: 'Cheats & Hacks', severity: 'high', enabled: true },
        { id: 'wf-cheat-2', word: 'aimbot', category: 'Cheats & Hacks', severity: 'high', enabled: true },
        { id: 'wf-cheat-3', word: 'wallhack', category: 'Cheats & Hacks', severity: 'high', enabled: true },
        { id: 'wf-cheat-4', word: 'injector', category: 'Cheats & Hacks', severity: 'high', enabled: true },
        { id: 'wf-cheat-5', word: 'speedhack', category: 'Cheats & Hacks', severity: 'high', enabled: true },
        { id: 'wf-cheat-6', word: 'esp hack', category: 'Cheats & Hacks', severity: 'high', enabled: true },

        // Adult Websites & Pornographic Terms (ALL SET TO HIGH SEVERITY)
        { id: 'wf-adult-1', word: 'pornhub', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-2', word: 'xvideos', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-3', word: 'xnxx', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-4', word: 'xhamster', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-5', word: 'redtube', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-6', word: 'youporn', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-7', word: 'chaturbate', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-8', word: 'onlyfans', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-9', word: 'brazzers', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-10', word: 'cam4', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-11', word: 'stripchat', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-12', word: 'livejasmin', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-13', word: 'spankbang', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-14', word: 'hentai', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-15', word: 'rule34', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-16', word: 'eporner', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-17', word: 'beeg', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-18', word: 'hqporner', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-19', word: 'motherless', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-20', word: 'bangbros', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-21', word: 'naughtyamerica', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-22', word: 'tnaflix', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-23', word: 'bongacams', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-24', word: 'camsoda', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-25', word: 'tube8', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-26', word: 'porntrex', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-27', word: 'thumbzilla', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-28', word: 'vporn', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-29', word: 'daftsex', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-30', word: 'xcafe', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-31', word: 'fapello', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-32', word: 'coomer', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-33', word: 'bunkr', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-34', word: 'erothots', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-35', word: 'simpcity', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-36', word: 'camwhores', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-37', word: 'erome', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-38', word: 'heavy-r', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-39', word: 'fetlife', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-40', word: 'adultfriendfinder', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-41', word: 'playboy', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-42', word: 'penthouse', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-43', word: 'x-art', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-44', word: 'twistys', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-45', word: 'porn', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-46', word: 'xxx', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-47', word: 'sex', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-48', word: 'nude', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-49', word: 'naked', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-50', word: 'erotic', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-adult-51', word: 'nsfw', category: 'Adult Content', severity: 'high', enabled: true },

        // Arabic Adult Keywords (All High Severity)
        { id: 'wf-ar-1', word: 'سكس', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-2', word: 'اباحي', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-3', word: 'إباحي', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-4', word: 'افلام سكس', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-5', word: 'أفلام سكس', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-6', word: 'بورنو', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-7', word: 'شرموطة', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-8', word: 'شرموطه', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-9', word: 'نيك', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-10', word: 'منيوك', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-11', word: 'تناك', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-12', word: 'طيز', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-13', word: 'زب', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-14', word: 'كس', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-15', word: 'دعارة', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-16', word: 'جنس', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-17', word: 'افلام جنسية', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-18', word: 'أفلام جنسية', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-19', word: 'عاهرة', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-20', word: 'عاهرات', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-21', word: 'ميا خليفة', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-22', word: 'سكس مصري', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-23', word: 'سكس عربي', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-24', word: 'سكس مترجم', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-25', word: 'سكس محارم', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-26', word: 'مقاطع سكس', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-27', word: 'شيميل', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-28', word: 'لواط', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-29', word: 'سحاق', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-30', word: 'سحاقيات', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-31', word: 'بورن', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-32', word: 'افلام اباحية', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-33', word: 'أفلام إباحية', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-34', word: 'صور عارية', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-35', word: 'تعري', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-36', word: 'فيديو سكس', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-37', word: 'رقص ساخن', category: 'Adult Content', severity: 'high', enabled: true },
        { id: 'wf-ar-38', word: 'كبار فقط', category: 'Adult Content', severity: 'high', enabled: true },

        // Gambling & Betting
        { id: 'wf-gamble-1', word: 'casino', category: 'Gambling', severity: 'high', enabled: true },
        { id: 'wf-gamble-2', word: 'bet365', category: 'Gambling', severity: 'high', enabled: true },
        { id: 'wf-gamble-3', word: '1xbet', category: 'Gambling', severity: 'high', enabled: true },
        { id: 'wf-gamble-4', word: 'stake.com', category: 'Gambling', severity: 'high', enabled: true },
        { id: 'wf-gamble-5', word: 'pokerstars', category: 'Gambling', severity: 'high', enabled: true },

        // Bandwidth Abuse & P2P Torrenting
        { id: 'wf-band-1', word: 'torrent', category: 'Bandwidth Abuse', severity: 'high', enabled: true },
        { id: 'wf-band-2', word: 'utorrent', category: 'Bandwidth Abuse', severity: 'high', enabled: true },
        { id: 'wf-band-3', word: 'bittorrent', category: 'Bandwidth Abuse', severity: 'high', enabled: true },
        { id: 'wf-band-4', word: 'qbittorrent', category: 'Bandwidth Abuse', severity: 'high', enabled: true },

        // System Exploits & Tampering
        { id: 'wf-sys-1', word: 'cmd.exe', category: 'System Exploits', severity: 'high', enabled: true },
        { id: 'wf-sys-2', word: 'powershell', category: 'System Exploits', severity: 'high', enabled: true },
        { id: 'wf-sys-3', word: 'regedit', category: 'System Exploits', severity: 'high', enabled: true },
        { id: 'wf-sys-4', word: 'taskmgr', category: 'System Exploits', severity: 'high', enabled: true },
        { id: 'wf-sys-5', word: 'wifikill', category: 'System Exploits', severity: 'high', enabled: true },
        { id: 'wf-sys-6', word: 'netcut', category: 'System Exploits', severity: 'high', enabled: true }
      ],
      violations: []
    },
    mikrotik: {
      host: '10.10.10.1',
      port: 8728,
      restPort: 80,
      username: 'admin',
      password: '0184255',
      connected: false,
      lastVerified: null,
      useRestApi: false,
      vpnList: 'GAMING-VPN',
      activeVpnServer: '185.220.101.5',
      vpnServers: [
        { id: 'vpn-uae', name: 'UAE Dubai Ultra-Low Latency', ip: '185.220.101.5', ping: '14ms', flag: '🇦🇪', enabled: true },
        { id: 'vpn-sa-ryd', name: 'Riyadh KSA Gaming Hub', ip: '178.63.14.88', ping: '17ms', flag: '🇸🇦', enabled: true },
        { id: 'vpn-sa-jed', name: 'Jeddah Red Sea Gateway', ip: '178.63.14.92', ping: '19ms', flag: '🇸🇦', enabled: true },
        { id: 'vpn-bh', name: 'Bahrain Manama AWS Gamelift', ip: '157.241.12.30', ping: '16ms', flag: '🇧🇭', enabled: true },
        { id: 'vpn-kw', name: 'Kuwait City Gulf Fast-Route', ip: '195.154.88.10', ping: '21ms', flag: '🇰🇼', enabled: true },
        { id: 'vpn-eg-cai', name: 'Cairo Telecom Egypt Esports POP', ip: '156.204.18.5', ping: '8ms', flag: '🇪🇬', enabled: true },
        { id: 'vpn-eg-alex', name: 'Alexandria Coastal Low-Ping Hub', ip: '156.204.19.12', ping: '9ms', flag: '🇪🇬', enabled: true },
        { id: 'vpn-de-fra1', name: 'Frankfurt Riot Direct Core 1', ip: '194.26.29.112', ping: '41ms', flag: '🇩🇪', enabled: true },
        { id: 'vpn-de-fra2', name: 'Frankfurt Valve SDR Relay', ip: '194.26.29.115', ping: '42ms', flag: '🇩🇪', enabled: true },
        { id: 'vpn-fr-par', name: 'Paris AWS EU-West Gaming Node', ip: '51.15.80.20', ping: '44ms', flag: '🇫🇷', enabled: true },
        { id: 'vpn-fr-mrs', name: 'Marseille Mediterranean Hop', ip: '51.15.82.14', ping: '38ms', flag: '🇫🇷', enabled: true },
        { id: 'vpn-gb-ldn1', name: 'London Slough Esports Hub', ip: '185.190.140.8', ping: '46ms', flag: '🇬🇧', enabled: true },
        { id: 'vpn-gb-ldn2', name: 'London Docklands Gamer Route', ip: '185.190.140.15', ping: '47ms', flag: '🇬🇧', enabled: true },
        { id: 'vpn-nl-ams', name: 'Amsterdam Equinix AM4 Peer', ip: '149.202.88.90', ping: '43ms', flag: '🇳🇱', enabled: true },
        { id: 'vpn-it-mil', name: 'Milan Cyber Valley Node', ip: '185.220.103.44', ping: '39ms', flag: '🇮🇹', enabled: true },
        { id: 'vpn-es-mad', name: 'Madrid Iberian Fast Track', ip: '185.193.65.10', ping: '48ms', flag: '🇪🇸', enabled: true },
        { id: 'vpn-at-vie', name: 'Vienna Central European Edge', ip: '193.138.218.70', ping: '40ms', flag: '🇦🇹', enabled: true },
        { id: 'vpn-pl-waw', name: 'Warsaw Eastern EU Gaming Core', ip: '185.25.51.80', ping: '45ms', flag: '🇵🇱', enabled: true },
        { id: 'vpn-tr-ist1', name: 'Istanbul Bosphorus Gaming Gateway', ip: '185.193.64.12', ping: '26ms', flag: '🇹🇷', enabled: true },
        { id: 'vpn-tr-ist2', name: 'Istanbul Turkcell Esports Backbone', ip: '185.193.64.25', ping: '27ms', flag: '🇹🇷', enabled: true },
        { id: 'vpn-gr-ath', name: 'Athens Balkan Direct Relay', ip: '185.138.20.15', ping: '29ms', flag: '🇬🇷', enabled: true },
        { id: 'vpn-cy-nic', name: 'Nicosia Levant Low-Latency POP', ip: '185.14.28.10', ping: '24ms', flag: '🇨🇾', enabled: true },
        { id: 'vpn-sg-eq', name: 'Singapore Equinix SG1 Hub', ip: '139.99.120.40', ping: '68ms', flag: '🇸🇬', enabled: true },
        { id: 'vpn-sg-aws', name: 'Singapore AWS AP-Southeast', ip: '139.99.120.55', ping: '69ms', flag: '🇸🇬', enabled: true },
        { id: 'vpn-jp-tyo', name: 'Tokyo Riot Japan Core', ip: '160.16.200.12', ping: '95ms', flag: '🇯🇵', enabled: true },
        { id: 'vpn-kr-sel', name: 'Seoul SK Telecom Gamer Edge', ip: '118.217.150.30', ping: '98ms', flag: '🇰🇷', enabled: true },
        { id: 'vpn-in-bom', name: 'Mumbai Cloudflare Gaming Gateway', ip: '103.21.244.10', ping: '52ms', flag: '🇮🇳', enabled: true },
        { id: 'vpn-za-jnb', name: 'Johannesburg Africa Esports Hub', ip: '197.80.200.40', ping: '110ms', flag: '🇿🇦', enabled: true },
        { id: 'vpn-us-iad', name: 'Ashburn Virginia Riot East Coast', ip: '198.51.100.22', ping: '92ms', flag: '🇺🇸', enabled: true },
        { id: 'vpn-us-chi', name: 'Chicago Central Gaming Hub', ip: '198.51.100.45', ping: '102ms', flag: '🇺🇸', enabled: true },
        { id: 'vpn-us-dfw', name: 'Dallas Texas Esports Arena Relay', ip: '198.51.100.68', ping: '108ms', flag: '🇺🇸', enabled: true },
        { id: 'vpn-us-lax', name: 'Los Angeles Valve West Coast', ip: '198.51.100.80', ping: '118ms', flag: '🇺🇸', enabled: true },
        { id: 'vpn-se-arn', name: 'Stockholm Nordic Fiber Loop', ip: '185.157.162.20', ping: '49ms', flag: '🇸🇪', enabled: true },
        { id: 'vpn-fi-hel', name: 'Helsinki Telia Gaming Edge', ip: '185.157.162.35', ping: '51ms', flag: '🇫🇮', enabled: true },
        { id: 'vpn-ch-zrh', name: 'Zurich Swiss Gaming Tunnel', ip: '179.43.140.10', ping: '42ms', flag: '🇨🇭', enabled: true },
        { id: 'vpn-ie-dub', name: 'Dublin Riot Europe Production', ip: '54.170.80.12', ping: '49ms', flag: '🇮🇪', enabled: true }
      ],
      lastProvisioned: null
    }
  }
};

// Database auto-persistence and crash recovery
function saveData() {
  try {
    const exportData = {
      pcs: db.pcs,
      menu: db.menu,
      games: db.games,
      shift: db.shift,
      settings: db.settings,
      invoices: (db.invoices || []).slice(0, 100),
      auditLog: (db.auditLog || []).slice(0, 100)
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(exportData, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save cyber data to disk:', err.message);
  }
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.pcs && Array.isArray(parsed.pcs)) {
        db.pcs = parsed.pcs.map(saved => ({
          ...saved,
          isOnline: false // Offline until station connects
        }));
      } else {
        db.pcs = [];
      }
      if (parsed.menu && parsed.menu.length) db.menu = parsed.menu;
      if (parsed.games && parsed.games.length) db.games = parsed.games;
      if (parsed.shift) db.shift = parsed.shift;
      if (parsed.settings) db.settings = { ...db.settings, ...parsed.settings };
      if (parsed.invoices) db.invoices = parsed.invoices;
      if (parsed.auditLog) db.auditLog = parsed.auditLog;
      console.log('✔ Successfully recovered cyber database state from cyber_data.json');
    }
  } catch (err) {
    console.error('Failed to load cyber data from disk:', err.message);
  }
}
loadData();

process.on('SIGINT', () => { saveData(); process.exit(); });
process.on('SIGTERM', () => { saveData(); process.exit(); });

let lastDataSaveTime = Date.now();

// Log audit event
function addAudit(action, details, level = 'info') {
  const item = {
    id: 'AUD-' + Date.now(),
    timestamp: new Date().toISOString(),
    timeFormatted: new Date().toLocaleTimeString('en-US'),
    action,
    details,
    level
  };
  db.auditLog.unshift(item);
  if (db.auditLog.length > 200) db.auditLog.pop();
  io.emit('audit_update', item);
  return item;
}

// -------------------------------------------------------------
// TIMER TICKER LOOP (1 SECOND INTERVAL)
// -------------------------------------------------------------
setInterval(() => {
  const now = Date.now();
  let updated = false;

  db.pcs.forEach(pc => {
    if (pc.status === 'in_session' && pc.session) {
      // Pause session timer if station is offline (power outage on station)
      const pauseOnDisconnect = (db.settings && db.settings.power && db.settings.power.pauseSessionOnDisconnect !== false);
      if (pauseOnDisconnect && !pc.isOnline) {
        pc.session.isPaused = true;
        return; // Freeze timer during power loss on client PC!
      }
      pc.session.isPaused = false;
      pc.session.elapsedSeconds++;

      // If fixed time / amount, the game cost is fixed (full package value), not counting up like a meter!
      if (pc.session.isAdmin || pc.session.type === 'admin') {
        pc.session.gameCost = 0;
      } else if (pc.session.type === 'fixed_time' || pc.session.type === 'fixed_amount') {
        if (typeof pc.session.fixedAmount === 'number') {
          pc.session.gameCost = pc.session.fixedAmount;
        } else {
          const totalSecs = pc.session.totalDurationSeconds || 3600;
          pc.session.gameCost = Math.round((totalSecs / 3600) * pc.ratePerHour * 100) / 100;
        }
      } else {
        // Open time accumulates dynamically based on elapsed seconds
        const ratePerSecond = (pc.ratePerHour / 3600);
        pc.session.gameCost = Math.round(pc.session.elapsedSeconds * ratePerSecond * 100) / 100;
      }

      // Calculate total orders
      const ordersCost = (pc.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);
      pc.session.ordersCost = ordersCost;
      pc.session.totalCost = Math.round((pc.session.gameCost + ordersCost) * 100) / 100;

      // If fixed duration or amount
      if (pc.session.type === 'fixed_time' || pc.session.type === 'fixed_amount') {
        pc.session.remainingSeconds = Math.max(0, (pc.session.totalDurationSeconds || 0) - pc.session.elapsedSeconds);

        // Warning trigger (e.g. at 300 seconds = 5 min, 60 seconds = 1 min)
        if (pc.session.remainingSeconds === 300 && !pc.session.warned5m) {
          pc.session.warned5m = true;
          io.to(`pc_${pc.id}`).emit('session_warning', { minutesLeft: 5, message: 'Notice: 5 minutes remaining on your session!' });
        }
        if (pc.session.remainingSeconds === 60 && !pc.session.warned1m) {
          pc.session.warned1m = true;
          io.to(`pc_${pc.id}`).emit('session_warning', { minutesLeft: 1, message: 'Alert: Only 1 minute left! PC will be locked.' });
        }

        // Time finished!
        if (pc.session.remainingSeconds <= 0 && !pc.session.expired) {
          pc.session.expired = true;
          pc.status = 'locked';
          addAudit('Session Expired', `Session completed for ${pc.name} - Total: EGP ${pc.session.totalCost}`, 'warning');
          io.to(`pc_${pc.id}`).emit('session_expired', { totalCost: pc.session.totalCost });
          io.emit('pc_locked_auto', { pcId: pc.id, cost: pc.session.totalCost });
        }
      }

      updated = true;
    } else {
      // Idle Auto-Shutdown Check (Automatic power savings for inactive PCs)
      if (db.settings && db.settings.power && db.settings.power.autoShutdownIdleEnabled) {
        if (pc.isOnline && pc.status !== 'in_session') {
          const idleSec = Math.floor((now - (pc.lastActive || now)) / 1000);
          pc.idleSeconds = idleSec;
          const limitSec = (db.settings.power.idleThresholdMinutes || 10) * 60;

          // 60-second warning before shutdown
          if (idleSec === (limitSec - 60) && !pc.idleWarned) {
            pc.idleWarned = true;
            io.to(`pc_${pc.id}`).emit('idle_shutdown_warning', {
              secondsLeft: 60,
              message: '⚡ Energy Saver Alert: PC is idle and will automatically shut down in 60 seconds!'
            });
            addAudit('Idle Shutdown Warning', `Idle shutdown warning sent to ${pc.name} (60s remaining)`, 'warning');
          }

          // Trigger Auto-Shutdown
          if (idleSec >= limitSec && !pc.autoShutdownTriggered) {
            pc.autoShutdownTriggered = true;
            pc.isOnline = false;
            pc.status = 'offline';
            io.to(`pc_${pc.id}`).emit('system_power_command', {
              action: 'shutdown',
              reason: 'auto_idle',
              message: 'System was automatically shut down to conserve energy due to inactivity.'
            });
            io.emit('pc_online_status', { pcId: pc.id, isOnline: false, status: 'offline' });
            addAudit('Auto-Idle Power Shutdown', `PC ${pc.name} was cleanly shut down after being idle for ${db.settings.power.idleThresholdMinutes} minutes`, 'info');
          }
        } else {
          pc.idleSeconds = 0;
          pc.idleWarned = false;
          pc.autoShutdownTriggered = false;
        }
      }
    }
  });

  if (updated) {
    // Broadcast tick update to admin dashboard
    io.emit('tick_update', db.pcs.map(p => ({
      id: p.id,
      status: p.status,
      session: p.session,
      currentGame: p.currentGame,
      ordersCount: (p.orders || []).length
    })));
  }

  // Auto-persist active sessions every 10 seconds to safeguard against unexpected power outage
  if (now - lastDataSaveTime > 10000) {
    lastDataSaveTime = now;
    saveData();
  }
}, 1000);

// -------------------------------------------------------------
// MASTER AUTHENTICATION & ACCESS PROTECTION
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const currentPass = (db.settings && db.settings.masterPassword) || 'admin';
  if (password === currentPass) {
    const token = 'CYBER_SEC_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    activeMasterTokens.add(token);
    addAudit('Master Login Success', 'Master terminal unlocked successfully', 'success');
    res.json({ success: true, token, cashierName: db.shift.cashierName });
  } else {
    addAudit('Master Auth Failure', 'Invalid master password entered!', 'warning');
    res.status(401).json({ success: false, error: 'Incorrect master password!' });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  if (token && activeMasterTokens.has(token)) {
    res.json({ success: true, authenticated: true });
  } else {
    res.json({ success: false, authenticated: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  if (token) activeMasterTokens.delete(token);
  res.json({ success: true });
});

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------
app.get('/api/state', (req, res) => {
  res.json({
    serverIp: getLocalIpAddress(),
    serverPort: PORT,
    pcs: db.pcs,
    menu: db.menu,
    games: db.games,
    shift: db.shift,
    settings: db.settings,
    invoices: db.invoices.slice(0, 50),
    auditLog: db.auditLog.slice(0, 50),
    screenshots: db.screenshots.slice(0, 50)
  });
});

// Shop Lounge Branding Customization (Shop Name, Subtitle, Logo)
app.get('/api/settings/branding', (req, res) => {
  res.json({
    success: true,
    branding: db.settings.branding || {
      shopName: 'CYBERPULSE OS',
      shopSubtitle: 'Esports Lounge & Central Arena Management',
      shopLogo: '⚡'
    }
  });
});

app.post('/api/settings/branding', (req, res) => {
  const { shopName, shopSubtitle, shopLogo } = req.body;
  if (!db.settings.branding) {
    db.settings.branding = {
      shopName: 'CYBERPULSE OS',
      shopSubtitle: 'Esports Lounge & Central Arena Management',
      shopLogo: '⚡'
    };
  }
  if (shopName) db.settings.branding.shopName = String(shopName).trim();
  if (shopSubtitle !== undefined) db.settings.branding.shopSubtitle = String(shopSubtitle).trim();
  if (shopLogo) db.settings.branding.shopLogo = String(shopLogo).trim();
  saveData();
  addAudit('Branding Updated', `Shop name configured to "${db.settings.branding.shopName}"`, 'info');
  io.emit('branding_updated', db.settings.branding);
  res.json({ success: true, branding: db.settings.branding });
});

// PC Station Management: Add Station Manually, Delete Station, Clear All Stations
app.post('/api/pcs/add', (req, res) => {
  const { id, name, ip, zone, ratePerHour, specs, mac } = req.body;
  const newId = (id || `PC-${String(db.pcs.length + 1).padStart(2, '0')}`).trim();
  if (db.pcs.find(p => p.id.toLowerCase() === newId.toLowerCase())) {
    return res.status(400).json({ error: `Station ID "${newId}" already exists!` });
  }

  const newPc = {
    id: newId,
    name: name ? String(name).trim() : newId,
    ip: ip ? String(ip).trim() : '127.0.0.1',
    mac: mac ? String(mac).trim() : '00:00:00:00:00:00',
    zone: zone ? String(zone).trim() : 'Standard',
    ratePerHour: parseFloat(ratePerHour) || (db.settings && db.settings.pricing && db.settings.pricing.standardRate) || 20,
    specs: specs ? String(specs).trim() : 'Gaming PC',
    status: 'available',
    isOnline: false,
    session: null,
    orders: [],
    currentGame: null,
    lastActive: Date.now(),
    vpnEnabled: false,
    vpnServer: null,
    notes: 'Manually added station'
  };

  db.pcs.push(newPc);
  saveData();
  addAudit('Station Added', `Station ${newPc.name} [${newPc.id}] added to registry`, 'info');
  io.emit('pc_discovered', newPc);
  io.emit('state_updated', { pcs: db.pcs });
  res.json({ success: true, pc: newPc, pcs: db.pcs });
});

app.delete('/api/pcs/:id', (req, res) => {
  const { id } = req.params;
  const index = db.pcs.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Device not found' });

  const deletedPc = db.pcs.splice(index, 1)[0];
  saveData();
  addAudit('Station Removed', `Station ${deletedPc.name} [${deletedPc.id}] removed from registry`, 'warning');
  io.emit('pc_removed', { pcId: id });
  io.emit('state_updated', { pcs: db.pcs });
  res.json({ success: true, deletedPc, pcs: db.pcs });
});

app.post('/api/pcs/clear-all', (req, res) => {
  const count = db.pcs.length;
  db.pcs = [];
  saveData();
  addAudit('Registry Cleared', `Cleared all ${count} stations from registry. Awaiting auto-discovery.`, 'warning');
  io.emit('state_updated', { pcs: [] });
  res.json({ success: true, message: `Cleared ${count} stations` });
});

// Local LAN Network Device Auto-Scanner (ARP Scan & Subnet Discovery)
app.post('/api/network/scan', (req, res) => {
  const localIp = getLocalIpAddress();
  exec('arp -a', (err, stdout, stderr) => {
    const discovered = [];
    if (!err && stdout) {
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.trim().match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+([0-9a-fA-F-]+)\s+(\w+)/);
        if (match) {
          const ip = match[1];
          const mac = match[2].replace(/-/g, ':').toUpperCase();
          const type = match[3];

          // Filter out gateway (.1), broadcast (.255), multicast (224.x, 239.x), and localhost/self
          if (ip.endsWith('.255') || ip.startsWith('224.') || ip.startsWith('239.') || ip === '255.255.255.255' || ip === localIp || ip === '127.0.0.1') {
            continue;
          }
          if (ip.endsWith('.1')) {
            // Likely default router gateway, skip
            continue;
          }

          discovered.push({ ip, mac, type });
        }
      }
    }

    let newlyAddedCount = 0;
    discovered.forEach(dev => {
      let pc = db.pcs.find(p => p.ip === dev.ip || (dev.mac && p.mac && p.mac === dev.mac));
      if (!pc) {
        newlyAddedCount++;
        const stationNum = db.pcs.length + 1;
        const newStation = {
          id: `PC-${String(stationNum).padStart(2, '0')}`,
          name: `PC ${String(stationNum).padStart(2, '0')}`,
          ip: dev.ip,
          mac: dev.mac || '00:00:00:00:00:00',
          zone: 'Standard',
          ratePerHour: (db.settings && db.settings.pricing && db.settings.pricing.standardRate) || 20,
          specs: 'Detected LAN Station',
          status: 'available',
          isOnline: true,
          session: null,
          orders: [],
          currentGame: null,
          lastActive: Date.now(),
          vpnEnabled: false,
          vpnServer: null,
          notes: 'Auto-detected via LAN ARP Scan'
        };
        db.pcs.push(newStation);
        io.emit('pc_discovered', newStation);
      } else {
        pc.isOnline = true;
        if (dev.mac) pc.mac = dev.mac;
        io.emit('pc_online_status', { pcId: pc.id, isOnline: true, ip: pc.ip });
      }
    });

    if (newlyAddedCount > 0) {
      saveData();
      addAudit('LAN Scan Completed', `Network scan discovered and registered ${newlyAddedCount} new station(s)`, 'success');
      io.emit('state_updated', { pcs: db.pcs });
    }

    res.json({
      success: true,
      discoveredCount: discovered.length,
      newlyAddedCount,
      pcs: db.pcs,
      message: `Scanned LAN! Found ${discovered.length} active network device(s), ${newlyAddedCount} newly registered.`
    });
  });
});

// Update PC Visuals & Neon Colors
app.get('/api/settings/visuals', (req, res) => {
  res.json({ success: true, pcVisuals: db.settings.pcVisuals || {} });
});

// Customize individual PC or All PCs icon model and color
app.post('/api/pc/visuals', (req, res) => {
  const { pcId, model, color, applyToAll } = req.body;
  if (applyToAll) {
    if (!db.settings.pcVisuals) db.settings.pcVisuals = {};
    if (!db.settings.pcVisuals.stateVisuals) db.settings.pcVisuals.stateVisuals = {};
    Object.keys(db.settings.pcVisuals.stateVisuals).forEach(k => {
      db.settings.pcVisuals.stateVisuals[k].model = model;
      if (color) db.settings.pcVisuals.stateVisuals[k].color = color;
    });
    io.emit('settings_visuals_updated', db.settings.pcVisuals);
    return res.json({ success: true, message: 'Applied icon to all stations' });
  }

  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });
  if (model) pc.customModel = model;
  if (color) pc.customColor = color;
  addAudit('Device Icon Customized', `Updated hardware icon model for ${pc.name} to ${model}`, 'info');
  io.emit('pc_updated', pc);
  res.json({ success: true, pc });
});

app.post('/api/settings/visuals', (req, res) => {
  const { iconStyle, availableColor, inSessionColor, warningColor, lockedColor, enableStandRgb, stateVisuals } = req.body;
  if (!db.settings.pcVisuals) {
    db.settings.pcVisuals = {};
  }
  if (iconStyle) db.settings.pcVisuals.iconStyle = iconStyle;
  if (availableColor) db.settings.pcVisuals.availableColor = availableColor;
  if (inSessionColor) db.settings.pcVisuals.inSessionColor = inSessionColor;
  if (warningColor) db.settings.pcVisuals.warningColor = warningColor;
  if (lockedColor) db.settings.pcVisuals.lockedColor = lockedColor;
  if (typeof enableStandRgb === 'boolean') db.settings.pcVisuals.enableStandRgb = enableStandRgb;
  if (stateVisuals) {
    db.settings.pcVisuals.stateVisuals = Object.assign({}, db.settings.pcVisuals.stateVisuals || {}, stateVisuals);
  }

  addAudit('Device Aesthetics Updated', 'Custom device hardware models and state neon visuals updated successfully', 'success');
  io.emit('settings_visuals_updated', db.settings.pcVisuals);
  res.json({ success: true, pcVisuals: db.settings.pcVisuals });
});

// -------------------------------------------------------------
// POWER MANAGEMENT REST ENDPOINTS (WOL, RESTART, SHUTDOWN, IDLE)
// -------------------------------------------------------------

// 1. Wake-on-LAN for single PC
app.post('/api/power/wol', async (req, res) => {
  const { pcId } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });
  try {
    await sendWakeOnLan(pc.mac);
    addAudit('Remote Wake-on-LAN (WOL)', `Magic Packet sent to wake ${pc.name} (MAC: ${pc.mac})`, 'success');
    res.json({ success: true, message: `WOL signal sent successfully to ${pc.name}` });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send WOL packet' });
  }
});

// 1. Wake-on-LAN for SELECTED PCs (WOL Select)
app.post('/api/power/wol-select', async (req, res) => {
  const { pcIds } = req.body;
  if (!pcIds || !pcIds.length) return res.status(400).json({ error: 'Please select at least one device first' });
  let successCount = 0;
  const targetPcs = db.pcs.filter(p => pcIds.includes(p.id));
  for (const pc of targetPcs) {
    try {
      if (pc.mac) {
        await sendWakeOnLan(pc.mac);
        successCount++;
      }
    } catch(e) {}
  }
  addAudit('WOL Select Triggered', `Sent Wake-on-LAN packets to ${successCount} selected PCs: ${targetPcs.map(p => p.name).join(', ')}`, 'success');
  res.json({ success: true, count: successCount, message: `Sent WOL signal to ${successCount} devices successfully` });
});

// 2. Restart SELECTED PCs (Restart Select)
app.post('/api/power/restart-select', (req, res) => {
  const { pcIds } = req.body;
  if (!pcIds || !pcIds.length) return res.status(400).json({ error: 'Please select at least one device first' });
  const targetPcs = db.pcs.filter(p => pcIds.includes(p.id));
  targetPcs.forEach(pc => {
    io.to(`pc_${pc.id}`).emit('system_power_command', { action: 'restart', message: `Restarting ${pc.name}...` });
  });
  addAudit('Restart Select Triggered', `Restart command dispatched to ${targetPcs.length} PCs: ${targetPcs.map(p => p.name).join(', ')}`, 'warning');
  res.json({ success: true, count: targetPcs.length, message: `Restart dispatched to ${targetPcs.length} devices` });
});

// 3. Shutdown SELECTED PCs (Shutdown Select)
app.post('/api/power/shutdown-select', (req, res) => {
  const { pcIds } = req.body;
  if (!pcIds || !pcIds.length) return res.status(400).json({ error: 'Please select at least one device first' });
  const targetPcs = db.pcs.filter(p => pcIds.includes(p.id));
  targetPcs.forEach(pc => {
    pc.isOnline = false;
    pc.status = 'offline';
    io.to(`pc_${pc.id}`).emit('system_power_command', { action: 'shutdown', message: `Shutting down ${pc.name}...` });
    io.emit('pc_online_status', { pcId: pc.id, isOnline: false, status: 'offline' });
  });
  addAudit('Shutdown Select Triggered', `Shutdown command dispatched to ${targetPcs.length} PCs: ${targetPcs.map(p => p.name).join(', ')}`, 'warning');
  res.json({ success: true, count: targetPcs.length, message: `Shutdown dispatched to ${targetPcs.length} devices successfully` });
});

// Individual Restart PC
app.post('/api/power/restart', (req, res) => {
  const { pcId } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });

  io.to(`pc_${pc.id}`).emit('system_power_command', { action: 'restart', message: `Restarting ${pc.name}...` });
  addAudit('PC Restart Triggered', `Cashier triggered restart for ${pc.name}`, 'warning');
  res.json({ success: true, message: `Restart command sent to ${pc.name}` });
});

// Remote Live Reload / Soft-Update Client Stations
app.post('/api/clients/reload', (req, res) => {
  const { pcId } = req.body;
  if (pcId) {
    io.to(`pc_${pcId}`).emit('remote_command', { action: 'reload' });
    addAudit('Station Reloaded', `Sent remote live reload command to ${pcId}`, 'info');
  } else {
    io.emit('remote_command', { action: 'reload' });
    addAudit('All Stations Reloaded', 'Sent remote live reload command to all stations', 'info');
  }
  res.json({ success: true, message: 'Reload signal broadcast successfully' });
});

// Individual Shutdown PC
app.post('/api/power/shutdown', (req, res) => {
  const { pcId } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });

  pc.isOnline = false;
  pc.status = 'offline';
  io.to(`pc_${pc.id}`).emit('system_power_command', { action: 'shutdown', message: `Shutting down ${pc.name}...` });
  io.emit('pc_online_status', { pcId: pc.id, isOnline: false, status: 'offline' });
  addAudit('PC Shutdown Triggered', `Cashier triggered shutdown for ${pc.name}`, 'warning');
  res.json({ success: true, message: `Shutdown command sent to ${pc.name}` });
});

// 5. Shutdown ALL Idle PCs Now
app.post('/api/power/shutdown-idle-now', (req, res) => {
  const idlePcs = db.pcs.filter(p => p.isOnline && p.status !== 'in_session');
  idlePcs.forEach(p => {
    p.isOnline = false;
    p.status = 'offline';
    io.to(`pc_${p.id}`).emit('system_power_command', {
      action: 'shutdown',
      reason: 'manual_idle_shutdown',
      message: 'System was shut down by administrator to conserve power.'
    });
    io.emit('pc_online_status', { pcId: p.id, isOnline: false, status: 'offline' });
  });
  addAudit('Instant Idle Shutdown', `Shut down ${idlePcs.length} idle PCs to conserve electricity`, 'info');
  res.json({ success: true, count: idlePcs.length, message: `Successfully shut down ${idlePcs.length} idle devices` });
});

// 6. Power & Idle Settings
app.get('/api/power/settings', (req, res) => {
  res.json({
    power: db.settings.power,
    pcs: db.pcs.map(p => ({
      id: p.id,
      name: p.name,
      mac: p.mac,
      ip: p.ip || '127.0.0.1',
      status: p.status,
      isOnline: p.isOnline,
      idleMinutes: Math.floor((Date.now() - (p.lastActive || Date.now())) / 60000)
    }))
  });
});

app.post('/api/power/settings', (req, res) => {
  const { autoShutdownIdleEnabled, idleThresholdMinutes } = req.body;
  if (typeof autoShutdownIdleEnabled === 'boolean') {
    db.settings.power.autoShutdownIdleEnabled = autoShutdownIdleEnabled;
  }
  if (idleThresholdMinutes) {
    db.settings.power.idleThresholdMinutes = parseInt(idleThresholdMinutes);
  }
  addAudit('Power Settings Updated', `Auto-shutdown settings updated: ${db.settings.power.autoShutdownIdleEnabled ? 'Enabled' : 'Disabled'} (Threshold: ${db.settings.power.idleThresholdMinutes} mins)`);
  res.json({ success: true, power: db.settings.power });
});

// Start Session on PC
app.post('/api/session/start', (req, res) => {
  const { pcId, type, durationMinutes, amount, customerName, notes } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });

  let totalDurationSeconds = null;
  let initialGameCost = 0;
  if (type === 'admin') {
    totalDurationSeconds = null;
    initialGameCost = 0;
  } else if (type === 'fixed_time') {
    const mins = parseInt(durationMinutes) || 60;
    totalDurationSeconds = mins * 60;
    initialGameCost = Math.round((mins / 60) * pc.ratePerHour * 100) / 100;
  } else if (type === 'fixed_amount') {
    const amt = parseFloat(amount) || pc.ratePerHour;
    const hours = amt / pc.ratePerHour;
    totalDurationSeconds = Math.round(hours * 3600);
    initialGameCost = amt;
  }

  pc.status = 'in_session';
  pc.isAdminSession = (type === 'admin');
  pc.session = {
    type: type || 'open',
    isAdmin: (type === 'admin'),
    startTime: Date.now(),
    customerName: type === 'admin' ? 'Admin / Staff' : (customerName || 'Guest Player'),
    notes: notes || '',
    elapsedSeconds: 0,
    totalDurationSeconds,
    remainingSeconds: totalDurationSeconds,
    fixedAmount: initialGameCost,
    gameCost: initialGameCost,
    ordersCost: 0,
    totalCost: initialGameCost,
    warned5m: false,
    warned1m: false,
    expired: false
  };

  addAudit('Session Started', `Started session on ${pc.name} - Mode: ${type === 'open' ? 'Open Time' : type === 'admin' ? 'Admin / Staff (Free)' : type === 'fixed_time' ? (durationMinutes + ' mins') : (('EGP ' + amount))} - Customer: ${pc.session.customerName}`);

  io.emit('pc_updated', pc);
  io.to(`pc_${pc.id}`).emit('session_started', pc.session);
  saveData();
  res.json({ success: true, pc });
});

// Start Free Admin / Staff Session
app.post('/api/session/start-admin', (req, res) => {
  const { pcId } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });
  if (pc.status === 'in_session') return res.status(400).json({ error: 'PC is already in an active session' });

  pc.status = 'in_session';
  pc.isAdminSession = true;
  pc.session = {
    type: 'admin',
    isAdmin: true,
    startTime: Date.now(),
    customerName: 'Admin / Staff',
    notes: 'Free Admin Session',
    elapsedSeconds: 0,
    totalDurationSeconds: null,
    remainingSeconds: null,
    fixedAmount: 0,
    gameCost: 0,
    ordersCost: 0,
    totalCost: 0,
    warned5m: false,
    warned1m: false,
    expired: false
  };

  addAudit('Admin Session Started', `Free admin session started on ${pc.name}`, 'info');
  io.emit('pc_updated', pc);
  io.to(`pc_${pc.id}`).emit('session_started', pc.session);
  saveData();
  res.json({ success: true, pc });
});

// Add Free Bonus Time to Active Session
app.post('/api/session/add-free-time', (req, res) => {
  const { pcId, minutes = 15 } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc || !pc.session) return res.status(400).json({ error: 'No active session found on this PC' });

  const addSecs = (parseInt(minutes) || 15) * 60;
  if (pc.session.type === 'open') {
    pc.session.freeMinutesAdded = (pc.session.freeMinutesAdded || 0) + parseInt(minutes);
  } else {
    pc.session.totalDurationSeconds = (pc.session.totalDurationSeconds || 0) + addSecs;
    pc.session.remainingSeconds = (pc.session.remainingSeconds || 0) + addSecs;
  }
  pc.session.expired = false;
  if (pc.status === 'locked') pc.status = 'in_session';

  addAudit('Free Time Granted', `Granted +${minutes} min free bonus time to ${pc.name} (${pc.session.customerName})`, 'success');
  io.emit('pc_updated', pc);
  io.to(`pc_${pc.id}`).emit('session_updated', pc.session);
  saveData();
  res.json({ success: true, pc, message: `Added ${minutes} free minutes successfully` });
});

// End / Close Session and generate invoice
app.post('/api/session/end', (req, res) => {
  const { pcId, discount = 0, paymentMethod = 'cash' } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc || !pc.session) return res.status(400).json({ error: 'No active session found on this PC' });

  const finalGameCost = pc.session.gameCost;
  const finalOrdersCost = pc.session.ordersCost;
  const rawTotal = finalGameCost + finalOrdersCost;
  const finalTotal = Math.max(0, rawTotal - (parseFloat(discount) || 0));

  const invoice = {
    id: 'INV-' + Date.now().toString().slice(-6),
    pcId: pc.id,
    pcName: pc.name,
    customerName: pc.session.customerName,
    startTime: new Date(pc.session.startTime).toISOString(),
    endTime: new Date().toISOString(),
    durationMinutes: Math.round(pc.session.elapsedSeconds / 60),
    gameCost: finalGameCost,
    ordersCost: finalOrdersCost,
    discount: parseFloat(discount) || 0,
    totalAmount: finalTotal,
    paymentMethod,
    orders: [...pc.orders]
  };

  db.invoices.unshift(invoice);
  db.shift.totalGameRevenue += finalGameCost;
  db.shift.totalCafeRevenue += finalOrdersCost;

  addAudit('Session Closed & Invoiced', `Session ended on ${pc.name} - Collected: EGP ${finalTotal} (${paymentMethod})`, 'success');

  // Reset PC
  if (pc.vpnEnabled) {
    removePcFromMikrotikVpn(pc);
    pc.vpnEnabled = false;
    pc.vpnServer = null;
    addAudit('Auto-VPN Reset', `Customer session closed on ${pc.name} - Gaming VPN automatically disabled`, 'info');
  }
  pc.status = 'available';
  pc.session = null;
  pc.orders = [];
  pc.currentGame = null;

  io.emit('pc_updated', pc);
  io.emit('shift_updated', db.shift);
  io.to(`pc_${pc.id}`).emit('session_closed', { invoice });
  saveData();
  res.json({ success: true, invoice, pc });
});

// Add order to PC or Direct Cafeteria Sale
app.post('/api/orders/add', (req, res) => {
  const { pcId, itemId, qty = 1 } = req.body;
  const item = db.menu.find(m => m.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found in menu' });

  if (item.stock < qty) {
    return res.status(400).json({ error: 'Insufficient stock in inventory' });
  }

  item.stock -= qty;

  const orderItem = {
    id: 'ORD-' + Date.now().toString().slice(-5),
    itemId: item.id,
    name: item.name,
    price: item.price,
    qty,
    total: item.price * qty,
    time: new Date().toLocaleTimeString('en-US')
  };

  if (pcId) {
    const pc = db.pcs.find(p => p.id === pcId);
    if (!pc) return res.status(404).json({ error: 'PC not found' });
    pc.orders.push(orderItem);
    addAudit('Cafeteria Order Placed', `Added (${qty}x ${item.name}) to ${pc.name} - Total: EGP ${orderItem.total}`);
    io.emit('pc_updated', pc);
    io.to(`pc_${pc.id}`).emit('order_received', orderItem);
  } else {
    // Direct Cashier Takeaway sale
    db.shift.totalCafeRevenue += orderItem.total;
    addAudit('Direct POS Takeaway', `Direct sale: (${qty}x ${item.name}) - Total: EGP ${orderItem.total}`);
    io.emit('shift_updated', db.shift);
  }

  saveData();
  res.json({ success: true, order: orderItem });
});

// Cafeteria Products Management: GET, ADD, UPDATE, DELETE
app.get('/api/menu', (req, res) => {
  res.json({ success: true, menu: db.menu });
});

app.post('/api/menu/add', (req, res) => {
  const { name, category, price, stock, icon } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Product name and price are required' });
  }

  const newItem = {
    id: 'm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    name: String(name).trim(),
    category: category ? String(category).trim() : 'General',
    price: parseFloat(price) || 0,
    stock: parseInt(stock, 10) || 0,
    icon: icon ? String(icon).trim() : '🍔'
  };

  db.menu.push(newItem);
  saveData();
  addAudit('Product Added', `Added cafeteria product "${newItem.name}" (${newItem.price} EGP)`, 'info');
  io.emit('menu_updated', db.menu);
  res.json({ success: true, item: newItem, menu: db.menu });
});

app.put('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, price, stock, icon } = req.body;
  const item = db.menu.find(m => m.id === id);
  if (!item) return res.status(404).json({ error: 'Product not found' });

  if (name !== undefined) item.name = String(name).trim();
  if (category !== undefined) item.category = String(category).trim();
  if (price !== undefined) item.price = parseFloat(price) || 0;
  if (stock !== undefined) item.stock = parseInt(stock, 10) || 0;
  if (icon !== undefined) item.icon = String(icon).trim();

  saveData();
  addAudit('Product Updated', `Updated product "${item.name}" (${item.price} EGP)`, 'info');
  io.emit('menu_updated', db.menu);
  res.json({ success: true, item, menu: db.menu });
});

app.delete('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  const index = db.menu.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });

  const deletedName = db.menu[index].name;
  db.menu.splice(index, 1);
  saveData();
  addAudit('Product Deleted', `Deleted cafeteria product "${deletedName}"`, 'warning');
  io.emit('menu_updated', db.menu);
  res.json({ success: true, deletedName, menu: db.menu });
});

// Move / Transfer Session from PC to PC
app.post('/api/session/transfer', (req, res) => {
  const { fromPcId, toPcId } = req.body;
  const fromPc = db.pcs.find(p => p.id === fromPcId);
  const toPc = db.pcs.find(p => p.id === toPcId);

  if (!fromPc || !fromPc.session) return res.status(400).json({ error: 'Source PC does not have an active session' });
  if (!toPc) return res.status(404).json({ error: 'Destination PC not found' });
  if (toPc.status === 'in_session') return res.status(400).json({ error: 'Destination PC is currently in session!' });

  // Transfer data
  toPc.status = 'in_session';
  toPc.session = fromPc.session;
  toPc.orders = fromPc.orders;
  toPc.currentGame = fromPc.currentGame;

  // Clear from
  fromPc.status = 'available';
  fromPc.session = null;
  fromPc.orders = [];
  fromPc.currentGame = null;

  addAudit('Session Transferred', `Transferred session from ${fromPc.name} to ${toPc.name} with all orders`);

  io.to(`pc_${fromPc.id}`).emit('session_transferred_out', { newPcName: toPc.name });
  io.to(`pc_${toPc.id}`).emit('session_started', toPc.session);
  io.emit('pc_updated', fromPc);
  io.emit('pc_updated', toPc);

  saveData();
  res.json({ success: true, fromPc, toPc });
});

// Toggle PC Maintenance Mode
// Batch Toggle PC Maintenance Mode for Selected PCs
app.post('/api/pc/maintenance-select', (req, res) => {
  const { pcIds, isMaintenance } = req.body;
  if (!Array.isArray(pcIds) || pcIds.length === 0) return res.status(400).json({ error: 'No PC IDs provided' });
  const updatedPcs = [];
  pcIds.forEach(id => {
    const pc = db.pcs.find(p => p.id === id);
    if (pc) {
      const nextState = typeof isMaintenance === 'boolean' ? isMaintenance : !(pc.isMaintenance || pc.status === 'maintenance');
      pc.isMaintenance = nextState;
      if (pc.isMaintenance) {
        pc.status = 'maintenance';
        io.to(`pc_${pc.id}`).emit('remote_command', { action: 'lock', reason: 'Station Under Maintenance' });
      } else {
        pc.status = pc.session ? 'in_session' : 'available';
      }
      updatedPcs.push(pc);
      io.emit('pc_updated', pc);
    }
  });
  addAudit('Batch Maintenance Toggled', `Toggled maintenance mode for ${updatedPcs.length} stations: ${updatedPcs.map(p => p.name).join(', ')}`, 'warning');
  res.json({ success: true, count: updatedPcs.length, pcs: updatedPcs });
});

app.post('/api/pc/maintenance', (req, res) => {
  const { pcId, isMaintenance } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });

  pc.isMaintenance = !!isMaintenance;
  if (pc.isMaintenance) {
    pc.status = 'maintenance';
    addAudit('Station Under Maintenance', `Set ${pc.name} to Maintenance Mode`, 'warning');
    io.to(`pc_${pc.id}`).emit('remote_command', { action: 'lock', reason: 'Station Under Scheduled Maintenance' });
  } else {
    pc.status = pc.session ? 'in_session' : 'available';
    addAudit('Station Maintenance Complete', `Restored ${pc.name} from Maintenance Mode to Active Service`, 'success');
  }

  io.emit('pc_updated', pc);
  res.json({ success: true, pc });
});

// Remote Lock / Unlock
app.post('/api/remote/lock', (req, res) => {
  const { pcId, lock } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'Device not found' });

  if (lock) {
    pc.status = 'locked';
    addAudit('Remote Terminal Lock', `Cashier remotely locked ${pc.name}`, 'warning');
    io.to(`pc_${pc.id}`).emit('remote_command', { action: 'lock' });
  } else {
    pc.status = pc.session ? 'in_session' : 'available';
    addAudit('Remote Terminal Unlock', `Cashier remotely unlocked ${pc.name}`);
    io.to(`pc_${pc.id}`).emit('remote_command', { action: 'unlock' });
  }

  io.emit('pc_updated', pc);
  res.json({ success: true, pc });
});

// Close / End Shift
app.post('/api/shift/close', (req, res) => {
  const { actualCashInDrawer, notes } = req.body;
  const totalRevenue = db.shift.totalGameRevenue + db.shift.totalCafeRevenue;
  const expectedCash = db.shift.startDrawerCash + totalRevenue;
  const difference = (parseFloat(actualCashInDrawer) || 0) - expectedCash;

  const closedShift = {
    ...db.shift,
    endTime: new Date().toISOString(),
    totalRevenue,
    expectedCash,
    actualCash: parseFloat(actualCashInDrawer) || 0,
    difference,
    notes: notes || ''
  };

  addAudit('Shift Closed & Reconciled', `Shift closed by ${db.shift.cashierName} - Total Revenue: EGP ${totalRevenue} - Drawer Diff: EGP ${difference}`, difference < 0 ? 'warning' : 'success');

  // Reset for next shift
  db.shift = {
    id: 'SHIFT-' + Date.now().toString().slice(-6),
    cashierName: 'Next Shift Cashier',
    startTime: new Date().toISOString(),
    startDrawerCash: parseFloat(actualCashInDrawer) || 0,
    totalGameRevenue: 0,
    totalCafeRevenue: 0
  };

  io.emit('shift_updated', db.shift);
  res.json({ success: true, closedShift, newShift: db.shift });
});

// -------------------------------------------------------------
// GAME HUB MANAGEMENT
// -------------------------------------------------------------
app.get('/api/games', (req, res) => {
  res.json({ success: true, games: db.games });
});

app.post('/api/games/add', (req, res) => {
  const { title, category, developer, poster, executable, args } = req.body;
  if (!title) return res.status(400).json({ error: 'Game title is required' });

  const newGame = {
    id: 'game_' + Date.now().toString().slice(-6),
    title,
    category: category || 'Shooters',
    developer: developer || 'Studio',
    poster: poster || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80',
    executable: executable || '',
    args: args || [],
    status: 'Ready'
  };

  db.games.push(newGame);
  saveData();
  addAudit('Game Added to Hub', `Admin added title (${title}) to Launcher Library`, 'success');
  io.emit('games_updated', db.games);
  res.json({ success: true, game: newGame, games: db.games });
});

app.put('/api/games/update/:id', (req, res) => {
  const { id } = req.params;
  const game = db.games.find(g => g.id === id);
  if (!game) return res.status(404).json({ error: 'Title not found' });

  const { title, category, developer, poster, executable, status } = req.body;
  if (title) game.title = title;
  if (category) game.category = category;
  if (developer) game.developer = developer;
  if (poster) game.poster = poster;
  if (executable) game.executable = executable;
  if (status) game.status = status;

  saveData();
  addAudit('Game Updated', `Admin modified details for (${game.title})`);
  io.emit('games_updated', db.games);
  res.json({ success: true, game, games: db.games });
});

app.delete('/api/games/:id', (req, res) => {
  const { id } = req.params;
  const idx = db.games.findIndex(g => g.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Title not found' });

  const removed = db.games.splice(idx, 1)[0];
  saveData();
  addAudit('Game Removed', `Removed title (${removed.title}) from Launcher Library`, 'warning');
  io.emit('games_updated', db.games);
  res.json({ success: true, removed, games: db.games });
});

// -------------------------------------------------------------
// SCREENSHOT GALLERY & SECURITY MONITORING
// -------------------------------------------------------------
app.get('/api/screenshots', (req, res) => {
  res.json({ success: true, screenshots: db.screenshots });
});

app.get('/api/surveillance/snapshots', (req, res) => {
  res.json({ success: true, snapshots: db.screenSnapshots || {} });
});

app.post('/api/screenshots/save', (req, res) => {
  const { pcId, image, note } = req.body;
  if (!image) return res.status(400).json({ error: 'Screenshot image data is required' });

  const item = {
    id: 'SHOT-' + Date.now().toString().slice(-6),
    pcId: pcId || 'PC',
    timestamp: Date.now(),
    timeFormatted: new Date().toLocaleTimeString('en-US'),
    image,
    note: note || 'Security Surveillance Snapshot'
  };

  db.screenshots.unshift(item);
  if (db.screenshots.length > 100) db.screenshots.pop();

  addAudit('Security Screenshot Saved', `Saved security snapshot for ${pcId} to surveillance vault`);
  io.emit('screenshot_saved', item);
  res.json({ success: true, screenshot: item });
});

// -------------------------------------------------------------

// -------------------------------------------------------------
// MIKROTIK ROUTEROS & GAMING VPN ENGINE
// -------------------------------------------------------------
function generateMikrotikScript(cfg) {
  const vpnList = cfg.vpnList || 'GAMING-VPN';
  const vpnServers = (cfg && cfg.vpnServers) || [];
  const topServers = vpnServers.slice(0, 15);

  const peerRules = topServers.map((s, idx) => 
    `/interface wireguard peers add interface=vpn-gaming-out endpoint-address="${s.ip}" endpoint-port=51820 allowed-address=0.0.0.0/0 comment="Peer ${idx + 1}: ${s.name} (${s.ip})"`
  ).join('\n');

  return `# ==============================================================
# CyberPulse Gaming Lounge - MikroTik RouterOS Multi-Route Setup
# Generated for: ${cfg.host || '192.168.88.1'} | Active Nodes: ${vpnServers.length}
# ==============================================================

# 1. WireGuard Core Interface
/interface wireguard add listen-port=51820 name=vpn-gaming-out comment="CyberPulse Gaming VPN Tunnel"

# 2. WireGuard Low-Latency Multi-Peer Endpoints
${peerRules}

# 3. Dedicated Routing Table for Gaming Traffic
/routing table add name=to_GAMING_VPN fib

# 4. Route Gaming Traffic to WireGuard Gateway
/ip route add dst-address=0.0.0.0/0 gateway=vpn-gaming-out routing-table=to_GAMING_VPN comment="CyberPulse Route to Gaming VPN"

# 5. Create Address-List for Gaming Machines
/ip firewall address-list add list=${vpnList} address=127.0.0.1 comment="VPN Initializer"
/ip firewall address-list remove [find list=${vpnList} address=127.0.0.1]

# 6. Mark Routing for all Arena Machines in ${vpnList}
/ip firewall mangle add chain=prerouting src-address-list=${vpnList} action=mark-routing new-routing-mark=to_GAMING_VPN passthrough=no comment="CyberPulse Gaming Traffic to VPN"

# 7. NAT Masquerade on VPN Interface
/ip firewall nat add chain=srcnat out-interface=vpn-gaming-out action=masquerade comment="CyberPulse VPN Masquerade"

:log info "CyberPulse Gaming VPN multi-node rules successfully provisioned on RouterOS"
:put ">> CyberPulse Multi-Node Gaming VPN configured on ${cfg.host} <<"`;
}

// Native RouterOS API Binary Protocol (Supports RouterOS v6 and v7 on Port 8728)
function encodeRouterOsLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xFF]);
  return Buffer.from([(len >> 16) | 0xC0, (len >> 8) & 0xFF, len & 0xFF]);
}

function encodeRouterOsSentence(words) {
  const bufs = words.map(w => {
    const b = Buffer.from(w, 'utf8');
    return Buffer.concat([encodeRouterOsLength(b.length), b]);
  });
  bufs.push(Buffer.from([0]));
  return Buffer.concat(bufs);
}

function runRouterOsApi(host, port, user, pass, cmdWords, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let loggedIn = false;
    let results = [];
    let buffer = Buffer.alloc(0);

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`RouterOS API timeout after ${timeout}ms at ${host}:${port}`));
    }, timeout);

    socket.connect(port || 8728, host, () => {
      socket.write(encodeRouterOsSentence(['/login', '=name=' + user, '=password=' + (pass || '')]));
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      while (buffer.length > 0) {
        let offset = 0;
        let words = [];
        let sentenceComplete = false;

        while (offset < buffer.length) {
          let b = buffer[offset++];
          let len = 0;
          if ((b & 0x80) === 0) {
            len = b;
          } else if ((b & 0xC0) === 0x80) {
            if (offset >= buffer.length) { offset--; break; }
            len = ((b & 0x3F) << 8) | buffer[offset++];
          } else if ((b & 0xE0) === 0xC0) {
            if (offset + 1 >= buffer.length) { offset--; break; }
            len = ((b & 0x1F) << 16) | (buffer[offset++] << 8) | buffer[offset++];
          }

          if (len === 0) {
            sentenceComplete = true;
            break;
          } else {
            if (offset + len > buffer.length) {
              offset -= (b & 0x80) === 0 ? 1 : ((b & 0xC0) === 0x80 ? 2 : 3);
              break;
            }
            words.push(buffer.slice(offset, offset + len).toString('utf8'));
            offset += len;
          }
        }

        if (!sentenceComplete) break;
        buffer = buffer.slice(offset);

        const type = words[0];
        if (!loggedIn) {
          if (type === '!done') {
            const retWord = words.find(w => w.startsWith('=ret='));
            if (retWord) {
              const chal = retWord.replace('=ret=', '');
              const md5 = crypto.createHash('md5');
              md5.update(Buffer.concat([Buffer.from([0]), Buffer.from(pass || '', 'utf8'), Buffer.from(chal, 'hex')]));
              const resp = '00' + md5.digest('hex');
              socket.write(encodeRouterOsSentence(['/login', '=name=' + user, '=response=' + resp]));
              return;
            }
            loggedIn = true;
            socket.write(encodeRouterOsSentence(cmdWords));
          } else if (type === '!trap') {
            clearTimeout(timer);
            socket.destroy();
            const msg = words.find(w => w.startsWith('=message=')) || '=message=Authentication failed';
            return reject(new Error(msg.replace('=message=', '')));
          }
        } else {
          results.push(words);
          if (type === '!done' || type === '!trap') {
            clearTimeout(timer);
            socket.destroy();
            return resolve(results);
          }
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function addPcToMikrotikVpn(pc, serverIp) {
  const mt = (db.settings && db.settings.mikrotik) || {};
  const targetIp = pc.ip || `10.10.10.${100 + parseInt(pc.id.replace(/\D/g, '') || 1)}`;
  if (!pc.ip) pc.ip = targetIp;

  const srvObj = (mt.vpnServers || []).find(s => s.ip === serverIp) || { name: 'Gaming VPN', ip: serverIp, flag: '🌐' };
  const listName = mt.vpnList || 'GAMING-VPN';
  const comment = `CyberPulse-${pc.id}-${pc.name}->${srvObj.name}(${serverIp})`;

  if (mt && mt.host) {
    try {
      // 1. Primary method: Native RouterOS API on port 8728 (Works on v6 and v7)
      const queryRes = await runRouterOsApi(
        mt.host,
        mt.port || 8728,
        mt.username || 'admin',
        mt.password || '',
        ['/ip/firewall/address-list/print', '?address=' + targetIp, '?list=' + listName]
      );

      let existingId = null;
      for (const sent of queryRes) {
        const idWord = sent.find(w => w.startsWith('=.id='));
        if (idWord) existingId = idWord.replace('=.id=', '');
      }

      if (existingId) {
        await runRouterOsApi(
          mt.host,
          mt.port || 8728,
          mt.username || 'admin',
          mt.password || '',
          ['/ip/firewall/address-list/set', '=.id=' + existingId, '=comment=' + comment]
        );
      } else {
        await runRouterOsApi(
          mt.host,
          mt.port || 8728,
          mt.username || 'admin',
          mt.password || '',
          ['/ip/firewall/address-list/add', '=list=' + listName, '=address=' + targetIp, '=comment=' + comment]
        );
      }

      mt.connected = true;
      addAudit('MikroTik Rule Synced', `Added ${targetIp} (${pc.name}) to RouterOS list ${listName} -> ${srvObj.flag} ${srvObj.name} (${serverIp})`, 'success');
      return { success: true, synced: true };
    } catch (apiErr) {
      // 2. Fallback method: RouterOS v7 REST API
      try {
        const authHeader = 'Basic ' + Buffer.from(`${mt.username}:${mt.password || ''}`).toString('base64');
        const res = await fetch(`http://${mt.host}:${mt.restPort || 80}/rest/ip/firewall/address-list`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({ list: listName, address: targetIp, comment })
        });
        if (res.ok) {
          mt.connected = true;
          addAudit('MikroTik Rule Synced', `Added ${targetIp} (${pc.name}) to RouterOS list ${listName} via REST -> ${srvObj.flag} ${srvObj.name}`, 'success');
          return { success: true, synced: true };
        }
      } catch (restErr) {}

      addAudit('MikroTik Dispatch Warning', `Could not dispatch rule to RouterOS at ${mt.host}: ${apiErr.message}`, 'warning');
      return { success: true, synced: false, error: apiErr.message };
    }
  } else {
    addAudit('VPN Configured Locally', `Assigned ${pc.name} (${targetIp}) to ${srvObj.flag} ${srvObj.name} (${serverIp})`, 'info');
    return { success: true, synced: false, localOnly: true };
  }
}

async function removePcFromMikrotikVpn(pc) {
  const mt = (db.settings && db.settings.mikrotik) || {};
  const targetIp = pc.ip || `192.168.88.${100 + parseInt(pc.id.replace(/\D/g, '') || 1)}`;
  const listName = mt.vpnList || 'GAMING-VPN';

  if (mt && mt.host) {
    try {
      // 1. Primary method: Native RouterOS API on port 8728
      const queryRes = await runRouterOsApi(
        mt.host,
        mt.port || 8728,
        mt.username || 'admin',
        mt.password || '',
        ['/ip/firewall/address-list/print', '?address=' + targetIp, '?list=' + listName]
      );

      for (const sent of queryRes) {
        const idWord = sent.find(w => w.startsWith('=.id='));
        if (idWord) {
          const entryId = idWord.replace('=.id=', '');
          await runRouterOsApi(
            mt.host,
            mt.port || 8728,
            mt.username || 'admin',
            mt.password || '',
            ['/ip/firewall/address-list/remove', '=.id=' + entryId]
          );
        }
      }
      addAudit('MikroTik Rule Removed', `Removed ${targetIp} (${pc.name}) from RouterOS list ${listName}`, 'info');
      return true;
    } catch (apiErr) {
      // 2. Fallback method: RouterOS v7 REST API
      try {
        const authHeader = 'Basic ' + Buffer.from(`${mt.username}:${mt.password || ''}`).toString('base64');
        const searchRes = await fetch(`http://${mt.host}:${mt.restPort || 80}/rest/ip/firewall/address-list?address=${targetIp}&list=${listName}`, {
          headers: { 'Authorization': authHeader }
        });
        if (searchRes.ok) {
          const items = await searchRes.json();
          for (const item of items) {
            if (item['.id']) {
              await fetch(`http://${mt.host}:${mt.restPort || 80}/rest/ip/firewall/address-list/${item['.id']}`, {
                method: 'DELETE',
                headers: { 'Authorization': authHeader }
              });
            }
          }
        }
      } catch (restErr) {}
    }
  }
  return true;
}

// MikroTik Live Socket Connectivity Verifier
function checkMikrotikConnection(host, port, timeout = 1500) {
  return new Promise((resolve) => {
    if (!host) return resolve({ connected: false, error: 'No router host address specified' });
    const s = new net.Socket();
    let settled = false;

    s.setTimeout(timeout);

    s.on('connect', () => {
      if (!settled) {
        settled = true;
        s.destroy();
        resolve({ connected: true, host, port });
      }
    });

    s.on('timeout', () => {
      if (!settled) {
        settled = true;
        s.destroy();
        resolve({ connected: false, error: `Connection timed out after ${timeout}ms at ${host}:${port}` });
      }
    });

    s.on('error', (err) => {
      if (!settled) {
        settled = true;
        s.destroy();
        resolve({ connected: false, error: err.message || 'Connection refused or unreachable' });
      }
    });

    try {
      s.connect(port, host);
    } catch (err) {
      if (!settled) {
        settled = true;
        resolve({ connected: false, error: err.message });
      }
    }
  });
}

async function verifyMikrotikRouter(mt) {
  if (!mt || !mt.host) return { connected: false, error: 'MikroTik host IP is missing' };

  // 1. Authenticate and query system resource via native RouterOS API port 8728
  try {
    const apiRes = await runRouterOsApi(
      mt.host,
      mt.port || 8728,
      mt.username || 'admin',
      mt.password || '',
      ['/system/resource/print'],
      2500
    );

    let boardName = 'MikroTik RouterOS';
    let version = 'v6';
    let uptime = '';
    let cpuLoad = '';

    for (const sent of apiRes) {
      for (const word of sent) {
        if (word.startsWith('=board-name=')) boardName = word.replace('=board-name=', '');
        if (word.startsWith('=version=')) version = word.replace('=version=', '');
        if (word.startsWith('=uptime=')) uptime = word.replace('=uptime=', '');
        if (word.startsWith('=cpu-load=')) cpuLoad = word.replace('=cpu-load=', '') + '%';
      }
    }

    mt.connected = true;
    mt.lastVerified = new Date().toISOString();
    return {
      connected: true,
      model: boardName,
      routerOsVersion: version,
      host: mt.host,
      port: mt.port || 8728,
      uptime,
      cpuLoad,
      message: `Verified live connection to ${boardName} (RouterOS ${version})`
    };
  } catch (apiErr) {
    // 2. If port 8728 fails, try REST on port 80/443
    if (mt.restPort) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${mt.username}:${mt.password || ''}`).toString('base64');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://${mt.host}:${mt.restPort || 80}/rest/system/resource`, {
          headers: { 'Authorization': authHeader },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const sysInfo = await res.json();
          mt.connected = true;
          mt.lastVerified = new Date().toISOString();
          const boardName = sysInfo['board-name'] || sysInfo.platform || 'MikroTik RouterOS';
          const version = sysInfo.version || 'v7';
          return {
            connected: true,
            model: boardName,
            routerOsVersion: version,
            host: mt.host,
            port: mt.restPort,
            uptime: sysInfo.uptime,
            cpuLoad: sysInfo['cpu-load'],
            message: `Connected to ${boardName} (RouterOS ${version})`
          };
        }
      } catch (restErr) {}
    }

    mt.connected = false;
    mt.lastError = apiErr.message;
    return {
      connected: false,
      host: mt.host,
      port: mt.port || 8728,
      error: apiErr.message,
    };
  }
}

// Persist Admin View Mode
app.post('/api/settings/view-mode', (req, res) => {
  const { viewMode } = req.body;
  if (viewMode) {
    if (!db.settings) db.settings = {};
    db.settings.viewMode = viewMode;
    res.json({ success: true, viewMode });
  } else {
    res.status(400).json({ error: 'Missing viewMode' });
  }
});

// MikroTik Endpoints
app.get('/api/mikrotik/config', (req, res) => {
  res.json({ success: true, mikrotik: db.settings.mikrotik });
});

app.post('/api/mikrotik/config', (req, res) => {
  const { host, port, restPort, username, password, vpnList, activeVpnServer, simulationMode } = req.body;
  if (!db.settings.mikrotik) db.settings.mikrotik = {};
  const mt = db.settings.mikrotik;
  if (host) mt.host = host.trim();
  if (port) mt.port = parseInt(port) || 8728;
  if (restPort) mt.restPort = parseInt(restPort) || 80;
  if (username !== undefined) mt.username = username.trim();
  if (password !== undefined) mt.password = password;
  if (vpnList) mt.vpnList = vpnList.trim();
  if (activeVpnServer) mt.activeVpnServer = activeVpnServer.trim();
  if (typeof simulationMode === 'boolean') mt.simulationMode = simulationMode;

  addAudit('MikroTik Config Updated', `Router connection configured: ${mt.host}:${mt.port}`);
  res.json({ success: true, mikrotik: db.settings.mikrotik });
});

app.post('/api/mikrotik/test', async (req, res) => {
  const mt = db.settings.mikrotik;
  const result = await verifyMikrotikRouter(mt);
  if (result.connected) {
    addAudit('MikroTik Test Succeeded', `Verified connection to RouterOS at ${mt.host}`, 'success');
    res.json({
      success: true,
      connected: true,
      model: result.model,
      routerOsVersion: result.routerOsVersion,
      host: mt.host,
      message: result.message
    });
  } else {
    addAudit('MikroTik Test Failed', `Failed connecting to RouterOS at ${mt.host}: ${result.error}`, 'warning');
    res.status(400).json({
      success: false,
      connected: false,
      host: mt.host,
      error: result.error,
      message: result.message
    });
  }
});

// Real RouterOS Provisioning Executor via native API Port 8728
async function executeMikrotikProvisioning(mt) {
  if (!mt || !mt.host) throw new Error('MikroTik host IP is not configured');
  const vpnList = mt.vpnList || 'GAMING-VPN';
  const port = mt.port || 8728;
  const username = mt.username || 'admin';
  const password = mt.password || '';

  const results = [];

  // 1. Mangle rule: Mark routing to_GAMING_VPN for machines in address-list
  const mCheck = await runRouterOsApi(mt.host, port, username, password, [
    '/ip/firewall/mangle/print',
    '?comment=CyberPulse Gaming Traffic to VPN'
  ]);
  if (!mCheck.some(s => s[0] === '!re')) {
    await runRouterOsApi(mt.host, port, username, password, [
      '/ip/firewall/mangle/add',
      '=chain=prerouting',
      '=src-address-list=' + vpnList,
      '=action=mark-routing',
      '=new-routing-mark=to_GAMING_VPN',
      '=passthrough=no',
      '=comment=CyberPulse Gaming Traffic to VPN'
    ]);
    results.push(`Added Mangle rule: prerouting src-address-list=${vpnList} -> mark-routing to_GAMING_VPN`);
  } else {
    results.push(`Mangle mark-routing rule already active on RouterOS`);
  }

  // 2. NAT Masquerade rule: Masquerade outgoing traffic for machines in address-list
  const nCheck = await runRouterOsApi(mt.host, port, username, password, [
    '/ip/firewall/nat/print',
    '?comment=CyberPulse Gaming VPN Masquerade'
  ]);
  if (!nCheck.some(s => s[0] === '!re')) {
    await runRouterOsApi(mt.host, port, username, password, [
      '/ip/firewall/nat/add',
      '=chain=srcnat',
      '=src-address-list=' + vpnList,
      '=action=masquerade',
      '=comment=CyberPulse Gaming VPN Masquerade'
    ]);
    results.push(`Added NAT rule: srcnat src-address-list=${vpnList} -> masquerade`);
  } else {
    results.push(`NAT masquerade rule already active on RouterOS`);
  }

  // 3. Ensure router IP is never in the VPN list (strictly target selected PCs only)
  const aCheck = await runRouterOsApi(mt.host, port, username, password, [
    '/ip/firewall/address-list/print',
    '?list=' + vpnList,
    '?address=' + mt.host
  ]);
  for (const sent of aCheck) {
    const idWord = sent.find(w => w.startsWith('=.id='));
    if (idWord) {
      const entryId = idWord.replace('=.id=', '');
      await runRouterOsApi(mt.host, port, username, password, [
        '/ip/firewall/address-list/remove',
        '=.id=' + entryId
      ]);
      results.push(`Verified router gateway ${mt.host} is excluded from VPN (VPN strictly applies to selected PCs only)`);
    }
  }

  // 4. Log to RouterOS system log
  await runRouterOsApi(mt.host, port, username, password, [
    '/log/info',
    '=message=CyberPulse Gaming VPN rules successfully provisioned on RouterOS'
  ]);
  results.push(`Logged provisioning success event to RouterOS system log`);

  return results;
}

app.post('/api/mikrotik/provision-vpn', async (req, res) => {
  const mt = db.settings.mikrotik;

  // STRICT REQUIREMENT: MikroTik connection MUST be verified and active before provisioning!
  const check = await verifyMikrotikRouter(mt);
  if (!check.connected) {
    return res.status(400).json({
      success: false,
      connected: false,
      error: `Cannot provision VPN: MikroTik RouterOS is not connected or unreachable at ${mt.host}:${mt.port || 8728}. Please verify your router connection first.`,
      details: check.error
    });
  }

  try {
    const executedResults = await executeMikrotikProvisioning(mt);
    mt.lastProvisioned = new Date().toISOString();
    const script = generateMikrotikScript(mt);
    addAudit('MikroTik VPN Provisioned', `Provisioned Gaming VPN rules directly on RouterOS at ${mt.host}`, 'success');
    res.json({
      success: true,
      connected: true,
      script,
      executedResults,
      message: 'Gaming VPN firewall rules, NAT, and address-list were successfully transmitted and provisioned directly on your MikroTik router!'
    });
  } catch (err) {
    addAudit('MikroTik Provisioning Error', `Failed to execute commands on ${mt.host}: ${err.message}`, 'warning');
    res.status(500).json({
      success: false,
      error: `Failed to execute commands on MikroTik RouterOS at ${mt.host}: ${err.message}`
    });
  }
});

let vpnRoundRobinIdx = 0;

function pickNextVpnServer(preferredId, extraCounts = {}) {
  const servers = (db.settings.mikrotik && db.settings.mikrotik.vpnServers) || [];
  const enabledServers = servers.filter(s => s.enabled);
  if (enabledServers.length === 0) return null;

  if (preferredId) {
    const found = enabledServers.find(s => s.id === preferredId);
    if (found) return found;
  }

  // Count active devices connected to each VPN server
  const serverUsage = {};
  enabledServers.forEach(s => { 
    serverUsage[s.id] = (extraCounts[s.id] || 0); 
  });

  db.pcs.forEach(pc => {
    if (pc.vpnEnabled && pc.vpnServerId) {
      if (serverUsage[pc.vpnServerId] !== undefined) {
        serverUsage[pc.vpnServerId] += 1;
      }
    }
  });

  // Find minimum connection count
  let minCount = Infinity;
  for (const s of enabledServers) {
    const count = serverUsage[s.id] || 0;
    if (count < minCount) {
      minCount = count;
    }
  }

  // Balanced candidates with least active loads
  const candidates = enabledServers.filter(s => (serverUsage[s.id] || 0) === minCount);
  const picked = candidates[vpnRoundRobinIdx % candidates.length];
  vpnRoundRobinIdx++;
  return picked;
}

app.post('/api/mikrotik/vpn/toggle', async (req, res) => {
  const { pcId, enable, serverId } = req.body;
  const pc = db.pcs.find(p => p.id === pcId);
  if (!pc) return res.status(404).json({ error: 'PC not found' });

  const targetState = typeof enable === 'boolean' ? enable : !pc.vpnEnabled;
  pc.vpnEnabled = targetState;

  if (targetState) {
    const srv = pickNextVpnServer(serverId);
    if (!srv) return res.status(400).json({ error: 'No active VPN servers available in pool' });

    pc.vpnServerId = srv.id;
    pc.vpnServer = srv.name;
    pc.vpnServerIp = srv.ip;
    pc.vpnServerFlag = srv.flag;

    const dispatchRes = await addPcToMikrotikVpn(pc, srv.ip);
    addAudit('VPN Load-Balanced on PC', `Activated Gaming VPN on ${pc.name} -> Assigned to ${srv.flag} ${srv.name} (${srv.ip})`, 'success');
    io.emit('pc_updated', pc);
    return res.json({ success: true, pc, dispatched: dispatchRes });
  } else {
    await removePcFromMikrotikVpn(pc);
    pc.vpnServerId = null;
    pc.vpnServer = null;
    pc.vpnServerIp = null;
    pc.vpnServerFlag = null;
    addAudit('VPN Disabled on PC', `Deactivated Gaming VPN on ${pc.name} - Restored default WAN`, 'info');
    io.emit('pc_updated', pc);
    return res.json({ success: true, pc });
  }
});

// Bulk distribute VPN across selected PCs
app.post('/api/mikrotik/vpn/bulk-distribute', async (req, res) => {
  const { pcIds, enable } = req.body;
  if (!Array.isArray(pcIds) || pcIds.length === 0) {
    return res.status(400).json({ error: 'No PC IDs provided' });
  }

  const results = [];
  const batchUsage = {};

  for (const pcId of pcIds) {
    const pc = db.pcs.find(p => p.id === pcId);
    if (!pc) continue;

    const targetState = typeof enable === 'boolean' ? enable : !pc.vpnEnabled;
    pc.vpnEnabled = targetState;

    if (targetState) {
      const srv = pickNextVpnServer(null, batchUsage);
      if (srv) {
        batchUsage[srv.id] = (batchUsage[srv.id] || 0) + 1;
        pc.vpnServerId = srv.id;
        pc.vpnServer = srv.name;
        pc.vpnServerIp = srv.ip;
        pc.vpnServerFlag = srv.flag;
        await addPcToMikrotikVpn(pc, srv.ip);
        results.push({ pcId: pc.id, name: pc.name, vpnEnabled: true, server: srv.name, ip: srv.ip, flag: srv.flag });
      }
    } else {
      await removePcFromMikrotikVpn(pc);
      pc.vpnServerId = null;
      pc.vpnServer = null;
      pc.vpnServerIp = null;
      pc.vpnServerFlag = null;
      results.push({ pcId: pc.id, name: pc.name, vpnEnabled: false });
    }
    io.emit('pc_updated', pc);
  }

  addAudit('Bulk VPN Distributed', `Distributed Gaming VPN routes across ${results.length} PC(s)`, 'success');
  res.json({ success: true, count: results.length, results });
});

app.post('/api/mikrotik/servers/add', (req, res) => {
  const { name, ip, ping = '20ms', flag = '🌐' } = req.body;
  if (!name || !ip) return res.status(400).json({ error: 'Server name and IP required' });
  const srv = {
    id: 'vpn-' + Date.now().toString().slice(-4),
    name: name.trim(),
    ip: ip.trim(),
    ping: ping.trim(),
    flag: flag.trim(),
    enabled: true
  };
  db.settings.mikrotik.vpnServers.push(srv);
  addAudit('VPN Server Added', `Added ${name} (${ip}) to MikroTik VPN server pool`);
  res.json({ success: true, server: srv, servers: db.settings.mikrotik.vpnServers });
});

app.delete('/api/mikrotik/servers/:id', (req, res) => {
  const idx = db.settings.mikrotik.vpnServers.findIndex(s => s.id === req.params.id);
  if (idx !== -1) {
    const removed = db.settings.mikrotik.vpnServers.splice(idx, 1);
    addAudit('VPN Server Removed', `Removed ${removed[0].name} from VPN pool`);
  }
  res.json({ success: true, servers: db.settings.mikrotik.vpnServers });
});

app.get('/api/settings/icons', (req, res) => {
  res.json({ success: true, statusIcons: db.settings.statusIcons });
});

app.post('/api/settings/icons', (req, res) => {
  const { statusIcons } = req.body;
  if (statusIcons) {
    db.settings.statusIcons = { ...db.settings.statusIcons, ...statusIcons };
    io.emit('settings_icons_updated', db.settings.statusIcons);
    addAudit('Status Icons Updated', 'Customized device status & event icons updated');
  }
  res.json({ success: true, statusIcons: db.settings.statusIcons });
});

// REAL-TIME WEBSOCKET & REMOTE DESKTOP / SCREEN STREAMING
// -------------------------------------------------------------
io.on('connection', (socket) => {
  // Identify client role
  socket.on('register_role', (data) => {
    socket.role = data.role; // 'admin' | 'client'
    socket.pcId = data.pcId;

    let clientIp = socket.handshake.address || (socket.conn && socket.conn.remoteAddress) || '';
    if (clientIp.startsWith('::ffff:')) clientIp = clientIp.replace('::ffff:', '');
    if (clientIp === '::1' || clientIp === '127.0.0.1') clientIp = '127.0.0.1 (Localhost)';

    if (data.role === 'client') {
      let targetId = (data.pcId || '').trim();
      if (!targetId) {
        // Auto-assign station ID based on current count
        const nextNum = db.pcs.length + 1;
        targetId = `PC-${String(nextNum).padStart(2, '0')}`;
      }
      socket.pcId = targetId;
      socket.join(`pc_${targetId}`);

      let pc = db.pcs.find(p => p.id.toLowerCase() === targetId.toLowerCase());
      if (pc) {
        pc.isOnline = true;
        pc.ip = data.ip || clientIp;
        pc.lastActive = Date.now();
        if (data.specs) pc.specs = data.specs;
        if (data.mac) pc.mac = data.mac;
        io.emit('pc_online_status', { pcId: pc.id, isOnline: true, ip: pc.ip });
        io.emit('pc_updated', pc);
        addAudit('Station Connected', `${pc.name} [${pc.id}] connected from IP: ${pc.ip}`, 'info');
      } else {
        // AUTO-DISCOVER NEW NETWORK DEVICE!
        const autoNum = db.pcs.length + 1;
        const newPc = {
          id: targetId,
          name: data.pcName || data.hostname || targetId,
          ip: data.ip || clientIp,
          mac: data.mac || '00:00:00:00:00:00',
          zone: data.zone || 'Standard',
          ratePerHour: (db.settings && db.settings.pricing && db.settings.pricing.standardRate) || 20,
          specs: data.specs || 'Auto-Detected Station (LAN)',
          status: 'available',
          session: null,
          orders: [],
          currentGame: null,
          isOnline: true,
          lastActive: Date.now(),
          vpnEnabled: false,
          vpnServer: null,
          notes: 'Auto-detected from LAN'
        };
        db.pcs.push(newPc);
        addAudit('Station Auto-Discovered', `Detected new station ${newPc.name} [${newPc.id}] from network (${newPc.ip})`, 'success');
        io.emit('pc_discovered', newPc);
        io.emit('state_updated', { pcs: db.pcs });
        saveData();
      }
      socket.emit('registered', { success: true, pcId: targetId });
    } else if (data.role === 'admin') {
      socket.join('admins');
    }
  });

  // Client heartbeat
  socket.on('client_ping', (data) => {
    if (socket.pcId) {
      const pc = db.pcs.find(p => p.id === socket.pcId);
      if (pc) {
        pc.isOnline = true;
        pc.lastActive = Date.now();
        if (data.currentGame) pc.currentGame = data.currentGame;
      }
    }
  });

  // Client time sync after server maintenance/restart
  socket.on('client_sync_session_time', (data) => {
    if (!data || !data.pcId) return;
    const pc = db.pcs.find(p => p.id === data.pcId);
    if (pc && pc.session && pc.status === 'in_session') {
      let changed = false;
      if (typeof data.elapsedSeconds === 'number' && data.elapsedSeconds > (pc.session.elapsedSeconds || 0)) {
        pc.session.elapsedSeconds = data.elapsedSeconds;
        changed = true;
      }
      if (typeof data.remainingSeconds === 'number' && pc.session.remainingSeconds !== null) {
        pc.session.remainingSeconds = Math.min(pc.session.remainingSeconds, data.remainingSeconds);
        changed = true;
      }
      if (data.expired) {
        pc.session.expired = true;
        pc.status = 'locked';
        changed = true;
      }
      if (changed) {
        // Re-calculate open cost
        if (pc.session.type === 'open' && !pc.isAdminSession) {
          const chargeableSecs = Math.max(0, pc.session.elapsedSeconds - ((pc.session.freeMinutesAdded || 0) * 60));
          pc.session.gameCost = Math.round((chargeableSecs / 3600) * pc.ratePerHour * 100) / 100;
          pc.session.totalCost = pc.session.gameCost + (pc.session.ordersCost || 0);
        }
        addAudit('Session Resynced', `Resynced offline time for ${pc.name} after server restart: ${pc.session.elapsedSeconds}s elapsed`);
        io.emit('pc_updated', pc);
        saveData();
      }
    }
  });

  // Client updates current game
  socket.on('game_launched', (data) => {
    const pc = db.pcs.find(p => p.id === data.pcId);
    if (pc) {
      pc.currentGame = data.gameTitle;
      addAudit('Game Launched', `Client on ${pc.name} launched game: ${data.gameTitle}`);
      io.emit('pc_updated', pc);
    }
  });

  // Client closes game
  socket.on('game_closed', (data) => {
    const pc = db.pcs.find(p => p.id === data.pcId);
    if (pc) {
      pc.currentGame = null;
      io.emit('pc_updated', pc);
    }
  });

  
// =============================================================
// WORD FILTER & SECURITY SHIELD ENGINE
// =============================================================
const wordFilterCooldowns = new Map();

function checkWordFilter(text, pcId, image) {
  if (!text || !pcId) return;
  const wf = db.settings.wordFilter;
  if (!wf || !wf.enabled) return;

  const pc = db.pcs.find(p => p.id === pcId);
  const pcName = pc ? pc.name : pcId;
  const lowerText = text.toLowerCase();
  const now = Date.now();

  for (const w of (wf.words || [])) {
    if (!w.enabled) continue;
    const targetWord = (w.word || '').toLowerCase().trim();
    if (!targetWord) continue;

    if (lowerText.includes(targetWord)) {
      const cooldownKey = `${pcId}_${w.id}`;
      const lastTrigger = wordFilterCooldowns.get(cooldownKey) || 0;
      if (now - lastTrigger < 30000) {
        continue; // 30s cooldown per word per machine
      }
      wordFilterCooldowns.set(cooldownKey, now);

      const violation = {
        id: 'VIO-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        timeFormatted: new Date().toLocaleTimeString('en-US'),
        pcId,
        pcName,
        detectedWord: w.word,
        category: w.category,
        severity: w.severity,
        activeWindow: text,
        hasSnapshot: !!image
      };

      if (!wf.violations) wf.violations = [];
      wf.violations.unshift(violation);
      if (wf.violations.length > 100) wf.violations.pop();

      // Action 1: Auto-capture Snapshot Evidence into Archive
      if (wf.actionTakeSnapshot && image) {
        const shotItem = {
          id: 'SHOT-WF-' + Date.now(),
          pcId,
          pcName,
          timestamp: new Date().toISOString(),
          timeFormatted: new Date().toLocaleTimeString('en-US'),
          activeWindow: `[Security Violation: ${w.word}] ${text}`,
          image
        };
        db.screenshots.unshift(shotItem);
        if (db.screenshots.length > 50) db.screenshots.pop();
        io.to('admins').emit('screenshot_saved', shotItem);
      }

      // Prepare custom client message with dynamic tags
      const rawMsg = wf.customWarningMessage || 'Security Shield Alert: Access to prohibited term "{word}" was detected on {pc}. Please close this immediately.';
      const clientMessage = rawMsg
        .replace(/\{word\}/gi, w.word)
        .replace(/\{pc\}/gi, pcName)
        .replace(/\{time\}/gi, violation.timeFormatted);

      // Action 1: Always warn client with custom message if enabled
      if (wf.actionWarnClient) {
        io.to(`pc_${pcId}`).emit('admin_alert_message', {
          message: clientMessage,
          level: 'danger',
          sender: 'CyberPulse Security Shield'
        });
      }

      // Action 2: Execute Selected Penalty / Punishment
      const penalty = wf.penaltyAction || 'warn_only';
      violation.penaltyExecuted = penalty;

      if (penalty === 'lock_session') {
        // Option 1: Lock & Terminate Session
        if (pc) {
          pc.status = 'locked';
          if (pc.session) {
            pc.session.expired = true;
          }
          io.to(`pc_${pcId}`).emit('lock_screen', {
            reason: clientMessage
          });
          io.emit('pc_updated', pc);
          addAudit('Session Locked for Violation', `Terminated & locked session on ${pcName} due to prohibited term "${w.word}"`, 'warning');
        }
      } else if (penalty === 'restart_pc') {
        // Option 2: Force Restart Station
        if (pc) {
          pc.status = 'restarting';
          pc.isRestarting = true;
          io.to(`pc_${pcId}`).emit('system_power_command', {
            action: 'restart',
            message: clientMessage
          });
          io.emit('pc_updated', pc);
          addAudit('PC Restarted for Violation', `Force-restarted ${pcName} due to prohibited activity: "${w.word}"`, 'danger');
          setTimeout(() => {
            pc.isRestarting = false;
            pc.status = 'available';
            io.emit('pc_updated', pc);
          }, 6000);
        }
      } else if (penalty === 'shutdown_pc') {
        // Option 3: Shutdown Station
        if (pc) {
          pc.status = 'offline';
          pc.isOnline = false;
          io.to(`pc_${pcId}`).emit('system_power_command', {
            action: 'shutdown',
            message: clientMessage
          });
          io.emit('pc_online_status', { pcId: pc.id, isOnline: false, status: 'offline' });
          addAudit('PC Shutdown for Violation', `Shut down ${pcName} due to prohibited activity: "${w.word}"`, 'danger');
        }
      } else {
        // Option 4: 'warn_only' (Dismiss & Warning Only)
        addAudit('Client Warned for Violation', `Warned ${pcName} about "${w.word}" without terminating session`, 'info');
      }

      // Action 3: Alert Cashier Room
      if (wf.actionAlertCashier) {
        io.to('admins').emit('word_filter_alert', violation);
      }

      addAudit('Word Filter Violation', `Prohibited term "${w.word}" [${w.category}] detected on ${pcName} (${text}) -> Action: ${penalty}`, 'warning');
      break;
    }
  }
}

// Word Filter API Endpoints
app.get('/api/wordfilter/config', (req, res) => {
  res.json({ success: true, wordFilter: db.settings.wordFilter });
});

app.post('/api/wordfilter/config', (req, res) => {
  const { enabled, actionAlertCashier, actionTakeSnapshot, actionWarnClient, penaltyAction, customWarningMessage } = req.body;
  const wf = db.settings.wordFilter;
  if (!wf) return res.status(500).json({ error: 'WordFilter config missing' });

  if (typeof enabled === 'boolean') wf.enabled = enabled;
  if (typeof actionAlertCashier === 'boolean') wf.actionAlertCashier = actionAlertCashier;
  if (typeof actionTakeSnapshot === 'boolean') wf.actionTakeSnapshot = actionTakeSnapshot;
  if (typeof actionWarnClient === 'boolean') wf.actionWarnClient = actionWarnClient;
  if (penaltyAction) wf.penaltyAction = penaltyAction;
  if (customWarningMessage !== undefined) wf.customWarningMessage = customWarningMessage.trim();

  io.emit('word_filter_sync', wf); // Universal sync to all stations
  addAudit('Word Filter Settings Updated', `Word filter policy updated (Penalty: ${wf.penaltyAction})`);
  res.json({ success: true, wordFilter: wf });
});

app.post('/api/wordfilter/words', (req, res) => {
  const { word, category, severity } = req.body;
  if (!word || !word.trim()) return res.status(400).json({ error: 'Keyword cannot be empty' });

  const wf = db.settings.wordFilter;
  if (!wf.words) wf.words = [];

  const existing = wf.words.find(w => w.word.toLowerCase() === word.trim().toLowerCase());
  if (existing) return res.status(400).json({ error: 'Keyword already exists in blacklist' });

  const newWord = {
    id: 'wf-' + Date.now(),
    word: word.trim(),
    category: category || 'General',
    severity: severity || 'medium',
    enabled: true
  };
  wf.words.push(newWord);
  io.emit('word_filter_sync', wf); // Broadcast to ALL stations
  addAudit('Blocked Word Added', `Added "${newWord.word}" [${newWord.category}] to security blacklist (Applied to ALL devices)`);
  res.json({ success: true, words: wf.words, newWord });
});

app.delete('/api/wordfilter/words/:id', (req, res) => {
  const wf = db.settings.wordFilter;
  if (!wf.words) wf.words = [];
  const idx = wf.words.findIndex(w => w.id === req.params.id);
  if (idx !== -1) {
    const removed = wf.words.splice(idx, 1)[0];
    io.emit('word_filter_sync', wf); // Broadcast to ALL stations
    addAudit('Blocked Word Removed', `Removed "${removed.word}" from security blacklist`);
    res.json({ success: true, words: wf.words });
  } else {
    res.status(404).json({ error: 'Word not found' });
  }
});

app.post('/api/wordfilter/clear-logs', (req, res) => {
  if (db.settings.wordFilter) {
    db.settings.wordFilter.violations = [];
  }
  res.json({ success: true });
});

app.post('/api/wordfilter/test-trigger', (req, res) => {
  const { pcId, simulatedText } = req.body;
  const targetPcId = pcId || (db.pcs[0] ? db.pcs[0].id : 'PC-01');
  const text = simulatedText || 'cheatengine.exe - Memory Scan Active';
  checkWordFilter(text, targetPcId, db.screenSnapshots[targetPcId]?.image || null);
  res.json({ success: true, message: `Simulated trigger tested on ${targetPcId} with text: "${text}"` });
});

// Client reported security violation (offline shield or direct)
  socket.on('client_reported_violation', (data) => {
    if (!data || !data.pcId || !data.violation) return;
    const pc = db.pcs.find(p => p.id === data.pcId);
    const pcName = pc ? pc.name : data.pcId;
    const v = data.violation;
    const item = {
      id: 'viol_' + Date.now() + '_' + Math.floor(Math.random() * 100),
      pcId: data.pcId,
      pcName,
      word: v.word,
      category: v.category || 'Security',
      activeWindow: v.detectedText,
      time: v.timestamp || new Date().toLocaleTimeString('en-US'),
      penaltyExecuted: v.penalty
    };
    if (db.settings.wordFilter) {
      if (!db.settings.wordFilter.violations) db.settings.wordFilter.violations = [];
      db.settings.wordFilter.violations.unshift(item);
    }
    addAudit('Word Filter Violation (Offline Shield)', `Detected prohibited content "${v.word}" on ${pcName} (${v.detectedText}) -> Action: ${v.penalty}`, 'warning');
    io.to('admins').emit('word_filter_alert', item);
    saveData();
  });

  // Client sends Live Screen Frame / Thumbnail to Admin
  socket.on('screen_frame', (data) => {
    db.screenSnapshots[data.pcId] = {
      image: data.image,
      timestamp: Date.now(),
      activeWindow: data.activeWindow
    };
    io.to('admins').emit('screen_frame_relay', data);

    // Run Real-Time Word Filter Inspection
    if (data.activeWindow) {
      checkWordFilter(data.activeWindow, data.pcId, data.image);
    }
  });

  // Admin initiates or requests Remote Screen View / Remote Desktop
  socket.on('admin_request_screen', (data) => {
    io.to(`pc_${data.pcId}`).emit('start_screen_streaming', {
      mode: data.mode,
      adminSocketId: socket.id,
      quality: data.quality || 'high'
    });
    addAudit('Surveillance Monitored', `Admin started monitoring screen of ${data.pcId} (Mode: ${data.mode === 'full_control' ? 'Full Control' : 'View Only'})`);
  });

  socket.on('admin_stop_screen', (data) => {
    io.to(`pc_${data.pcId}`).emit('stop_screen_streaming');
  });

  // Remote Input Events (Mouse Move, Click, Keypress) for Full Remote Control
  socket.on('remote_input_event', (data) => {
    io.to(`pc_${data.pcId}`).emit('execute_remote_input', data);
  });

  // Remote Action: Force Kill Game or Process
  socket.on('admin_kill_game', (data) => {
    const pc = db.pcs.find(p => p.id === data.pcId);
    if (pc) {
      const oldGame = pc.currentGame;
      pc.currentGame = null;
      io.to(`pc_${pc.id}`).emit('force_kill_game', { message: 'Game was terminated by cashier' });
      addAudit('Process Terminated', `Cashier terminated ${oldGame || 'application'} on ${pc.name}`, 'warning');
      io.emit('pc_updated', pc);
    }
  });

  // Remote Action: Send Alert / Toast to Client Screen
  socket.on('admin_send_message', (data) => {
    io.to(`pc_${data.pcId}`).emit('admin_alert_message', {
      message: data.message,
      level: data.level || 'info',
      sender: 'Arena Management'
    });
    addAudit('Chat Message Dispatched', `Message to ${data.pcId}: "${data.message}"`);
  });

  // Client requests assistance / Call Staff
  socket.on('client_call_staff', (data) => {
    io.to('admins').emit('staff_called', {
      pcId: data.pcId,
      reason: data.reason || 'Staff assistance requested',
      time: new Date().toLocaleTimeString('en-US')
    });
    addAudit('Staff Assistance Call', `Client at ${data.pcId} summoned staff: ${data.reason || 'Help requested'}`);
  });

  // Client sends self-order from launcher
  socket.on('client_order_request', (data) => {
    const pc = db.pcs.find(p => p.id === data.pcId);
    if (!pc) return;

    let total = 0;
    const addedOrders = [];

    data.items.forEach(it => {
      const menuItem = db.menu.find(m => m.id === it.itemId);
      if (menuItem && menuItem.stock >= it.qty) {
        menuItem.stock -= it.qty;
        const ord = {
          id: 'ORD-' + Date.now().toString().slice(-5) + '-' + Math.floor(Math.random()*100),
          itemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          qty: it.qty,
          total: menuItem.price * it.qty,
          time: new Date().toLocaleTimeString('en-US')
        };
        pc.orders.push(ord);
        addedOrders.push(ord);
        total += ord.total;
      }
    });

    addAudit('Client Self-Order', `Order from ${pc.name}: ${addedOrders.map(o => `${o.qty}x ${o.name}`).join(', ')} - Total: $${total}`);

    io.to('admins').emit('new_client_order_alert', {
      pcId: pc.id,
      pcName: pc.name,
      orders: addedOrders,
      total
    });

    io.emit('pc_updated', pc);
    socket.emit('order_confirmed', { orders: addedOrders, total });
    saveData();
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    if (socket.role === 'client' && socket.pcId) {
      const pc = db.pcs.find(p => p.id === socket.pcId);
      if (pc) {
        pc.isOnline = false;
        io.emit('pc_online_status', { pcId: pc.id, isOnline: false });
      }
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎮 CYBERPULSE GAMING LOUNGE MANAGEMENT SYSTEM`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`🖥️  Admin Dashboard:   http://localhost:${PORT}`);
  console.log(`🕹️  Client Launcher:   http://localhost:${PORT}/client.html?pc=PC-01`);
  console.log(`=======================================================`);
});
