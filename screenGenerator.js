/**
 * Ultra-Realistic Live Screen Generator for Cyber Cafe Stations
 * Generates vector-sharp SVG data URLs simulating active gameplays,
 * CyberPulse Launcher, Windows 11 Gaming Desktops, and Matrix Security Lock Screens.
 */

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateStationScreen(pc) {
  pc = pc || {};
  const width = 960;
  const height = 540;
  const pcId = pc.id || 'PC-01';
  const name = pc.name || pcId;
  const status = pc.status || 'available';
  const game = pc.currentGame;
  const specs = pc.specs || 'RTX 4060 • 144Hz • 1080p';

  let body = '';

  if (status === 'in_session' && game) {
    const gameUpper = (game || '').toUpperCase();
    const isValorant = gameUpper.includes('VALORANT');
    const isGTA = gameUpper.includes('GTA') || gameUpper.includes('FIVEM');
    const isCS2 = gameUpper.includes('COUNTER') || gameUpper.includes('CS');
    const isFIFA = gameUpper.includes('FC') || gameUpper.includes('FIFA');

    if (isGTA) {
      // 1. GTA V / FIVEM SCREEN
      body = `
        <defs>
          <linearGradient id="gtaSky_${pcId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0a0518"/>
            <stop offset="60%" stop-color="#1f1035"/>
            <stop offset="100%" stop-color="#381735"/>
          </linearGradient>
          <linearGradient id="cityGrad_${pcId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#100b20"/>
            <stop offset="100%" stop-color="#06030c"/>
          </linearGradient>
        </defs>

        <rect width="960" height="540" fill="url(#gtaSky_${pcId})"/>

        <!-- City Skyline Silhouettes -->
        <polygon points="40,360 40,220 90,200 130,220 130,360" fill="url(#cityGrad_${pcId})"/>
        <polygon points="140,360 140,160 200,140 250,180 250,360" fill="url(#cityGrad_${pcId})"/>
        <polygon points="260,360 260,240 330,210 370,250 370,360" fill="url(#cityGrad_${pcId})"/>
        <polygon points="560,360 560,180 630,150 700,200 700,360" fill="url(#cityGrad_${pcId})"/>
        <polygon points="720,360 720,210 780,190 840,230 840,360" fill="url(#cityGrad_${pcId})"/>

        <!-- Highway Ground -->
        <polygon points="0,360 960,360 960,540 0,540" fill="#0d0d14"/>
        <polygon points="480,360 480,360 900,540 60,540" fill="#151722"/>
        <line x1="480" y1="365" x2="480" y2="535" stroke="#facc15" stroke-dasharray="16,14" stroke-width="3"/>

        <!-- Ambient Lights on Road -->
        <circle cx="380" cy="460" r="18" fill="rgba(255, 51, 102, 0.45)"/>
        <circle cx="580" cy="460" r="18" fill="rgba(0, 243, 255, 0.45)"/>

        <!-- TOP RIGHT GTA CASH & WEAPON -->
        <g transform="translate(730, 24)">
          <rect width="210" height="75" rx="8" fill="rgba(10, 15, 26, 0.88)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <text x="195" y="32" fill="#22c55e" font-family="'Impact', 'Arial Black', sans-serif" font-size="28" font-weight="900" text-anchor="end">$1,842,500</text>
          <text x="195" y="60" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="16" text-anchor="end">250 <tspan fill="#64748b" font-size="12">/ 30</tspan></text>
          <text x="16" y="60" fill="#facc15" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="13">SMG Mk II</text>
        </g>

        <!-- TOP CENTER FIVEM SERVER INFO -->
        <rect x="360" y="16" width="240" height="34" rx="6" fill="rgba(10, 15, 26, 0.88)" stroke="#facc15" stroke-width="1"/>
        <text x="480" y="38" fill="#facc15" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="14" text-anchor="middle">⚡ FIVEM ROLEPLAY • LOS SANTOS</text>

        <!-- TOP LEFT DIAGNOSTICS -->
        <rect x="24" y="16" width="160" height="30" rx="4" fill="rgba(0,0,0,0.7)"/>
        <circle cx="36" cy="31" r="4" fill="#05ffa1"/>
        <text x="46" y="36" fill="#05ffa1" font-family="sans-serif" font-weight="bold" font-size="12">144 FPS • 18ms</text>

        <!-- GTA BOTTOM LEFT RADAR -->
        <g transform="translate(30, 395)">
          <circle cx="60" cy="60" r="55" fill="rgba(15, 23, 42, 0.95)" stroke="#38bdf8" stroke-width="2"/>
          <line x1="20" y1="60" x2="100" y2="60" stroke="#64748b" stroke-width="2"/>
          <line x1="60" y1="20" x2="60" y2="100" stroke="#64748b" stroke-width="2"/>
          <circle cx="60" cy="60" r="4.5" fill="#facc15"/>
          <path d="M 10 60 A 50 50 0 0 1 60 10" fill="none" stroke="#22c55e" stroke-width="4"/>
          <path d="M 60 10 A 50 50 0 0 1 110 60" fill="none" stroke="#38bdf8" stroke-width="4"/>
          <text x="60" y="132" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="11" text-anchor="middle">VINEWOOD BLVD</text>
        </g>

        <!-- ACTIVE MISSION NOTIFICATION -->
        <g transform="translate(200, 460)">
          <rect width="360" height="42" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(250, 204, 21, 0.4)" stroke-width="1"/>
          <text x="14" y="26" fill="#facc15" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="12">CURRENT OBJECTIVE:</text>
          <text x="150" y="26" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="12">Deliver customized vehicle to garage</text>
        </g>
      `;
    } else if (isCS2) {
      // 2. COUNTER-STRIKE 2 SCREEN
      body = `
        <defs>
          <linearGradient id="csBg_${pcId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#14181f"/>
            <stop offset="60%" stop-color="#2a251e"/>
            <stop offset="100%" stop-color="#111317"/>
          </linearGradient>
        </defs>

        <rect width="960" height="540" fill="url(#csBg_${pcId})"/>

        <!-- Dust II Sandstone Arch Silhouette -->
        <path d="M 0 350 L 960 350 M 0 380 L 960 380 M 0 440 L 960 440 M 0 540 L 960 540" stroke="rgba(217, 119, 6, 0.15)" stroke-width="1.5"/>
        <path d="M 480 350 L 0 540 M 480 350 L 200 540 M 480 350 L 760 540 M 480 350 L 960 540" stroke="rgba(217, 119, 6, 0.12)" stroke-width="1.5"/>
        <polygon points="100,350 100,200 220,170 300,210 300,350" fill="rgba(30, 25, 20, 0.8)" stroke="rgba(217,119,6,0.3)" stroke-width="1"/>
        <polygon points="660,350 660,190 750,170 820,210 820,350" fill="rgba(30, 25, 20, 0.8)" stroke="rgba(217,119,6,0.3)" stroke-width="1"/>

        <!-- CS2 TOP SCOREBAR -->
        <rect x="340" y="16" width="280" height="44" rx="8" fill="rgba(10, 15, 26, 0.9)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <rect x="345" y="20" width="75" height="36" rx="6" fill="rgba(56, 189, 248, 0.25)"/>
        <text x="382" y="44" fill="#38bdf8" font-family="'Cairo', sans-serif" font-weight="900" font-size="18" text-anchor="middle">CT 11</text>
        <text x="480" y="45" fill="#ffffff" font-family="'Cairo', sans-serif" font-weight="900" font-size="20" text-anchor="middle">0:52</text>
        <rect x="540" y="20" width="75" height="36" rx="6" fill="rgba(217, 119, 6, 0.25)"/>
        <text x="577" y="44" fill="#f59e0b" font-family="'Cairo', sans-serif" font-weight="900" font-size="18" text-anchor="middle">09 T</text>

        <!-- TOP-RIGHT DIAGNOSTICS -->
        <rect x="740" y="16" width="200" height="32" rx="4" fill="rgba(0,0,0,0.7)"/>
        <circle cx="754" cy="32" r="4" fill="#05ffa1"/>
        <text x="765" y="37" fill="#05ffa1" font-family="sans-serif" font-weight="bold" font-size="13">144.1 FPS • 9ms</text>

        <!-- CENTER CROSSHAIR -->
        <g transform="translate(480, 270)">
          <circle cx="0" cy="0" r="1.5" fill="#05ffa1"/>
          <line x1="-10" y1="0" x2="-3" y2="0" stroke="#05ffa1" stroke-width="1.8"/>
          <line x1="3" y1="0" x2="10" y2="0" stroke="#05ffa1" stroke-width="1.8"/>
          <line x1="0" y1="-10" x2="0" y2="-3" stroke="#05ffa1" stroke-width="1.8"/>
          <line x1="0" y1="3" x2="0" y2="10" stroke="#05ffa1" stroke-width="1.8"/>
        </g>

        <!-- BOTTOM HUD -->
        <g transform="translate(30, 470)">
          <rect width="180" height="50" rx="8" fill="rgba(10, 15, 26, 0.9)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <text x="20" y="36" fill="#05ffa1" font-family="'Cairo', sans-serif" font-weight="900" font-size="24">+ 100</text>
          <text x="110" y="36" fill="#38bdf8" font-family="'Cairo', sans-serif" font-weight="900" font-size="20">🛡️ 100</text>
        </g>

        <g transform="translate(30, 100)">
          <text x="0" y="0" fill="#22c55e" font-family="'Impact', sans-serif" font-size="26">$4,850</text>
        </g>

        <g transform="translate(740, 470)">
          <rect width="190" height="50" rx="8" fill="rgba(10, 15, 26, 0.9)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <text x="16" y="34" fill="#ffffff" font-family="'Cairo', sans-serif" font-weight="bold" font-size="14">AK-47</text>
          <text x="175" y="36" fill="#f59e0b" font-family="'Cairo', sans-serif" font-weight="900" font-size="24" text-anchor="end">30 <tspan fill="#64748b" font-size="14">/ 90</tspan></text>
        </g>
      `;
    } else if (isFIFA) {
      // 3. EA FC 25 / SPORTS SCREEN
      body = `
        <defs>
          <linearGradient id="pitchGrad_${pcId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0a1a0d"/>
            <stop offset="50%" stop-color="#143d1a"/>
            <stop offset="100%" stop-color="#0e2a12"/>
          </linearGradient>
        </defs>

        <rect width="960" height="540" fill="url(#pitchGrad_${pcId})"/>

        <!-- Stadium Light Glows -->
        <circle cx="150" cy="50" r="120" fill="rgba(255, 255, 255, 0.1)"/>
        <circle cx="810" cy="50" r="120" fill="rgba(255, 255, 255, 0.1)"/>

        <!-- Pitch Field Lines in Perspective -->
        <ellipse cx="480" cy="340" rx="140" ry="60" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
        <line x1="480" y1="180" x2="480" y2="500" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
        <polygon points="120,500 840,500 740,240 220,240" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>

        <!-- TOP SCOREBOARD -->
        <g transform="translate(30, 24)">
          <rect width="320" height="42" rx="8" fill="rgba(10, 15, 26, 0.9)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <text x="18" y="27" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13">RMA</text>
          <text x="65" y="28" fill="#00f3ff" font-family="'Impact', sans-serif" font-size="20">2</text>
          <text x="85" y="27" fill="#64748b" font-family="sans-serif" font-size="14">-</text>
          <text x="100" y="28" fill="#facc15" font-family="'Impact', sans-serif" font-size="20">1</text>
          <text x="125" y="27" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13">MCI</text>
          <rect x="230" y="10" width="75" height="22" rx="4" fill="rgba(5, 255, 161, 0.2)"/>
          <text x="267" y="26" fill="#05ffa1" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="12" text-anchor="middle">74:20</text>
        </g>

        <!-- TOP-RIGHT DIAGNOSTICS -->
        <rect x="760" y="24" width="170" height="32" rx="4" fill="rgba(0,0,0,0.7)"/>
        <text x="775" y="45" fill="#05ffa1" font-family="sans-serif" font-weight="bold" font-size="13">🟢 144 FPS • 4K HDR</text>

        <!-- BOTTOM RADAR -->
        <g transform="translate(400, 440)">
          <rect width="160" height="80" rx="8" fill="rgba(10, 15, 26, 0.85)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <circle cx="80" cy="40" r="4" fill="#00f3ff"/>
          <circle cx="60" cy="30" r="3" fill="#ffffff"/>
          <circle cx="100" cy="50" r="3" fill="#facc15"/>
        </g>

        <!-- ACTIVE PLAYER CARD -->
        <g transform="translate(30, 465)">
          <rect width="200" height="50" rx="8" fill="rgba(10, 15, 26, 0.9)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <text x="16" y="26" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13">Vinícius Jr. #7</text>
          <rect x="16" y="34" width="140" height="6" rx="3" fill="rgba(255,255,255,0.2)"/>
          <rect x="16" y="34" width="115" height="6" rx="3" fill="#05ffa1"/>
        </g>
      `;
    } else {
      // 4. VALORANT / DEFAULT SHOOTER SCREEN
      body = `
        <defs>
          <linearGradient id="bgGrad_${pcId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#070a14"/>
            <stop offset="50%" stop-color="#141c2e"/>
            <stop offset="100%" stop-color="#0b0f1a"/>
          </linearGradient>
          <radialGradient id="sunGlow_${pcId}" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stop-color="rgba(0, 243, 255, 0.25)"/>
            <stop offset="60%" stop-color="rgba(168, 85, 247, 0.1)"/>
            <stop offset="100%" stop-color="rgba(0, 0, 0, 0)"/>
          </radialGradient>
        </defs>

        <rect width="960" height="540" fill="url(#bgGrad_${pcId})"/>
        <rect width="960" height="340" fill="url(#sunGlow_${pcId})"/>

        <!-- 3D Perspective Floor Grid -->
        <path d="M 0 340 L 960 340 M 0 370 L 960 370 M 0 415 L 960 415 M 0 475 L 960 475 M 0 540 L 960 540" stroke="rgba(0,243,255,0.18)" stroke-width="1.5"/>
        <path d="M 480 340 L 0 540 M 480 340 L 160 540 M 480 340 L 320 540 M 480 340 L 640 540 M 480 340 L 800 540 M 480 340 L 960 540" stroke="rgba(0,243,255,0.12)" stroke-width="1.5"/>

        <!-- Silhouettes -->
        <polygon points="120,340 120,240 180,210 240,240 240,340" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(0,243,255,0.3)" stroke-width="1"/>
        <polygon points="260,340 260,200 340,180 380,220 380,340" fill="rgba(30, 41, 59, 0.7)" stroke="rgba(168,85,247,0.3)" stroke-width="1"/>
        <polygon points="680,340 680,190 760,170 820,220 820,340" fill="rgba(30, 41, 59, 0.7)" stroke="rgba(0,243,255,0.3)" stroke-width="1"/>

        <!-- TOP HUD: MATCH BAR -->
        <rect x="330" y="16" width="300" height="42" rx="8" fill="rgba(10, 15, 26, 0.88)" stroke="rgba(0, 243, 255, 0.4)" stroke-width="1.5"/>
        <rect x="335" y="20" width="80" height="34" rx="6" fill="rgba(5, 255, 161, 0.25)"/>
        <text x="375" y="43" fill="#05ffa1" font-family="'Cairo', sans-serif" font-weight="900" font-size="18" text-anchor="middle">DEF 09</text>
        <text x="480" y="44" fill="#ffffff" font-family="'Cairo', sans-serif" font-weight="900" font-size="20" text-anchor="middle">01:34</text>
        <rect x="545" y="20" width="80" height="34" rx="6" fill="rgba(255, 51, 102, 0.25)"/>
        <text x="585" y="43" fill="#ff3366" font-family="'Cairo', sans-serif" font-weight="900" font-size="18" text-anchor="middle">07 ATK</text>

        <!-- TOP-RIGHT DIAGNOSTICS -->
        <rect x="730" y="16" width="215" height="36" rx="6" fill="rgba(5, 10, 20, 0.85)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <circle cx="745" cy="34" r="4" fill="#05ffa1"/>
        <text x="758" y="39" fill="#05ffa1" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13">144.0 FPS</text>
        <text x="830" y="39" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="12">• 12ms • RTX 40</text>

        <!-- TOP-LEFT RADAR MINIMAP -->
        <g transform="translate(24, 20)">
          <rect width="130" height="130" rx="12" fill="rgba(10, 15, 26, 0.88)" stroke="rgba(0, 243, 255, 0.5)" stroke-width="1.5"/>
          <circle cx="65" cy="65" r="50" fill="none" stroke="rgba(0, 243, 255, 0.2)" stroke-width="1"/>
          <circle cx="65" cy="65" r="30" fill="none" stroke="rgba(0, 243, 255, 0.3)" stroke-width="1"/>
          <line x1="65" y1="15" x2="65" y2="115" stroke="rgba(0, 243, 255, 0.2)" stroke-width="1"/>
          <line x1="15" y1="65" x2="115" y2="65" stroke="rgba(0, 243, 255, 0.2)" stroke-width="1"/>
          <polygon points="65,65 52,38 78,38" fill="rgba(0, 243, 255, 0.35)"/>
          <circle cx="65" cy="65" r="4.5" fill="#00f3ff"/>
          <text x="42" y="48" fill="#ffb703" font-family="sans-serif" font-weight="900" font-size="12">A</text>
          <text x="88" y="85" fill="#ffb703" font-family="sans-serif" font-weight="900" font-size="12">B</text>
          <circle cx="82" cy="40" r="3.5" fill="#ff3366"/>
          <text x="65" y="142" fill="#00f3ff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="10" text-anchor="middle">SITE RADAR • ACTIVE</text>
        </g>

        <!-- CENTER CROSSHAIR -->
        <g transform="translate(480, 270)">
          <circle cx="0" cy="0" r="1.5" fill="#05ffa1"/>
          <line x1="-12" y1="0" x2="-4" y2="0" stroke="#05ffa1" stroke-width="1.8"/>
          <line x1="4" y1="0" x2="12" y2="0" stroke="#05ffa1" stroke-width="1.8"/>
          <line x1="0" y1="-12" x2="0" y2="-4" stroke="#05ffa1" stroke-width="1.8"/>
          <line x1="0" y1="4" x2="0" y2="12" stroke="#05ffa1" stroke-width="1.8"/>
        </g>

        <!-- RIGHT KILL FEED -->
        <g transform="translate(710, 70)">
          <rect x="0" y="0" width="230" height="26" rx="4" fill="rgba(15, 23, 42, 0.85)"/>
          <text x="10" y="18" fill="#05ffa1" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="11">⚡ ${escapeXml(pcId)}</text>
          <text x="80" y="18" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="10">[Vandal]</text>
          <text x="140" y="18" fill="#ff3366" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="11">Enemy_3</text>
        </g>

        <!-- BOTTOM HUD -->
        <g transform="translate(24, 465)">
          <rect width="210" height="55" rx="8" fill="rgba(10, 15, 26, 0.9)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <rect x="14" y="12" width="80" height="8" rx="4" fill="#00f3ff"/>
          <text x="102" y="20" fill="#00f3ff" font-family="'Cairo', sans-serif" font-weight="bold" font-size="13">50 AP</text>
          <rect x="14" y="30" width="80" height="12" rx="4" fill="#05ffa1"/>
          <text x="102" y="42" fill="#05ffa1" font-family="'Cairo', sans-serif" font-weight="900" font-size="18">100 HP</text>
        </g>

        <g transform="translate(360, 475)">
          <rect x="0" y="0" width="45" height="45" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <text x="22.5" y="27" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14" text-anchor="middle">C</text>
          <rect x="55" y="0" width="45" height="45" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <text x="77.5" y="27" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14" text-anchor="middle">Q</text>
          <rect x="110" y="0" width="45" height="45" rx="6" fill="rgba(0, 243, 255, 0.25)" stroke="#00f3ff" stroke-width="1.5"/>
          <text x="132.5" y="27" fill="#00f3ff" font-family="sans-serif" font-weight="bold" font-size="14" text-anchor="middle">E</text>
          <rect x="165" y="0" width="55" height="45" rx="6" fill="rgba(255, 183, 3, 0.25)" stroke="#ffb703" stroke-width="1.5"/>
          <text x="192.5" y="27" fill="#ffb703" font-family="sans-serif" font-weight="bold" font-size="14" text-anchor="middle">X 🔥</text>
        </g>

        <g transform="translate(730, 465)">
          <rect width="206" height="55" rx="8" fill="rgba(10, 15, 26, 0.9)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <text x="18" y="28" fill="#ffffff" font-family="'Cairo', sans-serif" font-weight="bold" font-size="14">${escapeXml(gameUpper)}</text>
          <text x="18" y="46" fill="#94a3b8" font-family="sans-serif" font-size="10">AUTOMATIC 7.62mm</text>
          <text x="190" y="40" fill="#05ffa1" font-family="'Cairo', sans-serif" font-weight="900" font-size="24" text-anchor="end">25 <tspan fill="#64748b" font-size="14">/ 75</tspan></text>
        </g>

        <rect x="24" y="160" width="130" height="24" rx="4" fill="rgba(0,0,0,0.6)"/>
        <text x="89" y="176" fill="#00f3ff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="11" text-anchor="middle">🎮 LIVE: ${escapeXml(game)}</text>
      `;
    }
  } else if (status === 'in_session') {
    // 5. IN-SESSION CYBER LAUNCHER DESKTOP
    body = `
      <defs>
        <linearGradient id="launcherBg_${pcId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0e1a"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#070a12"/>
        </linearGradient>
      </defs>

      <rect width="960" height="540" fill="url(#launcherBg_${pcId})"/>
      <circle cx="480" cy="270" r="280" fill="rgba(0, 243, 255, 0.06)"/>

      <!-- TOP BAR -->
      <rect width="960" height="52" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <text x="24" y="33" fill="#00f3ff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="18">⚡ CYBERPULSE ARENA LAUNCHER</text>
      <text x="340" y="32" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="13">Station: <tspan fill="#ffffff" font-weight="bold">${escapeXml(pcId)}</tspan></text>

      <rect x="680" y="10" width="256" height="32" rx="6" fill="rgba(5, 255, 161, 0.15)" stroke="#05ffa1" stroke-width="1"/>
      <circle cx="698" cy="26" r="4.5" fill="#05ffa1"/>
      <text x="712" y="31" fill="#05ffa1" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13">SESSION ACTIVE • PLAYING</text>

      <!-- PROMO / BANNER -->
      <rect x="40" y="75" width="880" height="100" rx="12" fill="rgba(30, 41, 59, 0.6)" stroke="rgba(0, 243, 255, 0.3)" stroke-width="1.5"/>
      <text x="70" y="115" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22">WELCOME TO CYBERPULSE ESPORTS ARENA</text>
      <text x="70" y="145" fill="#38bdf8" font-family="'Segoe UI', sans-serif" font-size="14">Select your favorite game • 144Hz ultra-smooth display • Low-ping fiber gaming network</text>
      
      <!-- QUICK LAUNCH GAME TILES -->
      <text x="40" y="205" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13">POPULAR TITLES (CLICK TO PLAY)</text>

      <!-- Game 1: Valorant -->
      <g transform="translate(40, 220)">
        <rect width="200" height="240" rx="10" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(0,243,255,0.4)" stroke-width="1.5"/>
        <rect width="200" height="130" rx="10" fill="#ff4655"/>
        <text x="100" y="75" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" text-anchor="middle">VALORANT</text>
        <text x="100" y="100" fill="rgba(255,255,255,0.8)" font-family="'Segoe UI', sans-serif" font-size="11" text-anchor="middle">Riot Games • FPS</text>
        <text x="20" y="165" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="14">Competitive 5v5</text>
        <rect x="20" y="185" width="160" height="32" rx="6" fill="#00f3ff"/>
        <text x="100" y="206" fill="#050811" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="13" text-anchor="middle">▶ PLAY NOW</text>
      </g>

      <!-- Game 2: GTA V -->
      <g transform="translate(266, 220)">
        <rect width="200" height="240" rx="10" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <rect width="200" height="130" rx="10" fill="#1e3a5f"/>
        <text x="100" y="75" fill="#facc15" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" text-anchor="middle">GTA V / FIVEM</text>
        <text x="100" y="100" fill="rgba(255,255,255,0.8)" font-family="'Segoe UI', sans-serif" font-size="11" text-anchor="middle">Rockstar • Roleplay</text>
        <text x="20" y="165" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="14">Los Santos RP</text>
        <rect x="20" y="185" width="160" height="32" rx="6" fill="rgba(255,255,255,0.15)"/>
        <text x="100" y="206" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13" text-anchor="middle">LAUNCH</text>
      </g>

      <!-- Game 3: CS2 -->
      <g transform="translate(493, 220)">
        <rect width="200" height="240" rx="10" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <rect width="200" height="130" rx="10" fill="#d97706"/>
        <text x="100" y="75" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="20" text-anchor="middle">COUNTER-STRIKE 2</text>
        <text x="100" y="100" fill="rgba(255,255,255,0.8)" font-family="'Segoe UI', sans-serif" font-size="11" text-anchor="middle">Valve • Source 2</text>
        <text x="20" y="165" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="14">Premier Mode</text>
        <rect x="20" y="185" width="160" height="32" rx="6" fill="rgba(255,255,255,0.15)"/>
        <text x="100" y="206" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13" text-anchor="middle">LAUNCH</text>
      </g>

      <!-- Game 4: FC 25 -->
      <g transform="translate(720, 220)">
        <rect width="200" height="240" rx="10" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <rect width="200" height="130" rx="10" fill="#047857"/>
        <text x="100" y="75" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" text-anchor="middle">EA SPORTS FC 25</text>
        <text x="100" y="100" fill="rgba(255,255,255,0.8)" font-family="'Segoe UI', sans-serif" font-size="11" text-anchor="middle">EA • Ultimate Team</text>
        <text x="20" y="165" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="14">Champions Cup</text>
        <rect x="20" y="185" width="160" height="32" rx="6" fill="rgba(255,255,255,0.15)"/>
        <text x="100" y="206" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13" text-anchor="middle">LAUNCH</text>
      </g>

      <!-- BOTTOM WINDOWS 11 TASKBAR -->
      <g transform="translate(0, 492)">
        <rect width="960" height="48" fill="rgba(10, 15, 26, 0.96)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <g transform="translate(420, 10)">
          <rect x="0" y="2" width="24" height="24" rx="4" fill="#00f3ff"/>
          <text x="12" y="19" fill="#000" font-family="sans-serif" font-weight="900" font-size="14" text-anchor="middle">⊞</text>
          <rect x="34" y="2" width="24" height="24" rx="4" fill="rgba(255,255,255,0.1)"/>
          <text x="46" y="18" fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle">🔍</text>
          <rect x="68" y="2" width="24" height="24" rx="4" fill="rgba(0, 243, 255, 0.25)" stroke="#00f3ff" stroke-width="1"/>
          <text x="80" y="18" fill="#00f3ff" font-family="sans-serif" font-size="12" text-anchor="middle">⚡</text>
          <rect x="102" y="2" width="24" height="24" rx="4" fill="rgba(255,255,255,0.1)"/>
          <text x="114" y="18" fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle">♨</text>
        </g>
        <text x="930" y="30" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="12" text-anchor="end">16:35 • ENG</text>
      </g>
    `;
  } else if (status === 'locked') {
    // 6. CYBERPULSE SECURITY LOCK SCREEN
    body = `
      <defs>
        <linearGradient id="lockBg_${pcId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090510"/>
          <stop offset="50%" stop-color="#150a21"/>
          <stop offset="100%" stop-color="#090510"/>
        </linearGradient>
      </defs>

      <rect width="960" height="540" fill="url(#lockBg_${pcId})"/>

      <path d="M 0 100 L 960 100 M 0 200 L 960 200 M 0 300 L 960 300 M 0 400 L 960 400" stroke="rgba(255, 51, 102, 0.08)" stroke-width="1"/>
      <path d="M 200 0 L 200 540 M 400 0 L 400 540 M 600 0 L 600 540 M 800 0 L 800 540" stroke="rgba(255, 51, 102, 0.08)" stroke-width="1"/>

      <text x="30" y="40" fill="#ff3366" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="16">🔒 CYBERPULSE SECURITY LOCK SYSTEM</text>
      <text x="930" y="40" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="14" text-anchor="end">SECURE HARDWARE CLIENT</text>

      <text x="480" y="160" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="64" text-anchor="middle">16:35</text>
      <text x="480" y="195" fill="#a855f7" font-family="'Cairo', sans-serif" font-weight="bold" font-size="16" text-anchor="middle">Sunday, 1 November 2026</text>

      <g transform="translate(305, 220)">
        <rect width="350" height="230" rx="16" fill="rgba(20, 10, 30, 0.85)" stroke="rgba(255, 51, 102, 0.4)" stroke-width="2"/>
        <circle cx="175" cy="50" r="30" fill="rgba(255, 51, 102, 0.15)"/>
        <text x="175" y="60" fill="#ff3366" font-family="sans-serif" font-size="30" text-anchor="middle">🔒</text>

        <text x="175" y="110" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" text-anchor="middle">STATION ${escapeXml(pcId)}</text>
        <text x="175" y="135" fill="#f43f5e" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13" text-anchor="middle">STATION LOCKED • PLEASE START SESSION</text>

        <g transform="translate(115, 155)">
          <circle cx="20" cy="15" r="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
          <circle cx="50" cy="15" r="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
          <circle cx="80" cy="15" r="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
          <circle cx="110" cy="15" r="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
        </g>

        <text x="175" y="208" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="12" text-anchor="middle">Please contact cashier or use membership card to unlock</text>
      </g>
    `;
  } else {
    // 7. AVAILABLE / STANDBY (WINDOWS 11 GAMING DESKTOP)
    body = `
      <defs>
        <linearGradient id="winBg_${pcId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#060913"/>
          <stop offset="40%" stop-color="#0d1527"/>
          <stop offset="70%" stop-color="#171e38"/>
          <stop offset="100%" stop-color="#090d18"/>
        </linearGradient>
        <radialGradient id="bloom1_${pcId}" cx="35%" cy="45%" r="50%">
          <stop offset="0%" stop-color="rgba(0, 243, 255, 0.22)"/>
          <stop offset="50%" stop-color="rgba(168, 85, 247, 0.12)"/>
          <stop offset="100%" stop-color="rgba(0, 0, 0, 0)"/>
        </radialGradient>
      </defs>

      <rect width="960" height="540" fill="url(#winBg_${pcId})"/>
      <circle cx="400" cy="240" r="320" fill="url(#bloom1_${pcId})"/>

      <path d="M 200 450 Q 400 180 600 320 T 900 180" fill="none" stroke="rgba(0, 243, 255, 0.25)" stroke-width="3"/>
      <path d="M 150 480 Q 450 150 700 280 T 960 220" fill="none" stroke="rgba(168, 85, 247, 0.2)" stroke-width="2"/>

      <!-- DESKTOP ICONS (LEFT COLUMN) -->
      <g transform="translate(30, 30)">
        <rect width="52" height="52" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="#00f3ff" stroke-width="1.5"/>
        <text x="26" y="34" fill="#00f3ff" font-family="sans-serif" font-weight="900" font-size="24" text-anchor="middle">⚡</text>
        <text x="26" y="66" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="10" text-anchor="middle">CyberPulse</text>
      </g>

      <g transform="translate(30, 115)">
        <rect width="52" height="52" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <text x="26" y="34" fill="#38bdf8" font-family="sans-serif" font-weight="900" font-size="22" text-anchor="middle">♨</text>
        <text x="26" y="66" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="10" text-anchor="middle">Steam</text>
      </g>

      <g transform="translate(30, 200)">
        <rect width="52" height="52" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <text x="26" y="34" fill="#ff4655" font-family="sans-serif" font-weight="900" font-size="22" text-anchor="middle">👊</text>
        <text x="26" y="66" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="10" text-anchor="middle">Riot Client</text>
      </g>

      <g transform="translate(30, 285)">
        <rect width="52" height="52" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <text x="26" y="34" fill="#facc15" font-family="sans-serif" font-weight="900" font-size="22" text-anchor="middle">✦</text>
        <text x="26" y="66" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="10" text-anchor="middle">Epic Games</text>
      </g>

      <g transform="translate(30, 370)">
        <rect width="52" height="52" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <text x="26" y="34" fill="#818cf8" font-family="sans-serif" font-weight="900" font-size="22" text-anchor="middle">🎧</text>
        <text x="26" y="66" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="10" text-anchor="middle">Discord</text>
      </g>

      <!-- CENTER FLOATING STATUS CARD -->
      <g transform="translate(310, 170)">
        <rect width="360" height="150" rx="16" fill="rgba(10, 15, 26, 0.88)" stroke="rgba(5, 255, 161, 0.4)" stroke-width="1.5"/>
        <circle cx="180" cy="40" r="18" fill="rgba(5, 255, 161, 0.2)"/>
        <circle cx="180" cy="40" r="8" fill="#05ffa1"/>
        
        <text x="180" y="80" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" text-anchor="middle">STATION ${escapeXml(pcId)} • READY</text>
        <text x="180" y="105" fill="#05ffa1" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="14" text-anchor="middle">STATION AVAILABLE • READY TO PLAY</text>
        <text x="180" y="128" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="12" text-anchor="middle">${escapeXml(specs)}</text>
      </g>

      <!-- WINDOWS 11 TASKBAR -->
      <g transform="translate(0, 492)">
        <rect width="960" height="48" fill="rgba(10, 15, 26, 0.96)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <g transform="translate(430, 10)">
          <rect x="0" y="2" width="24" height="24" rx="4" fill="#00f3ff"/>
          <text x="12" y="19" fill="#000" font-family="sans-serif" font-weight="900" font-size="14" text-anchor="middle">⊞</text>
          <rect x="34" y="2" width="24" height="24" rx="4" fill="rgba(255,255,255,0.1)"/>
          <text x="46" y="18" fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle">🔍</text>
          <rect x="68" y="2" width="24" height="24" rx="4" fill="rgba(255,255,255,0.1)"/>
          <text x="80" y="18" fill="#38bdf8" font-family="sans-serif" font-size="12" text-anchor="middle">🌐</text>
          <rect x="102" y="2" width="24" height="24" rx="4" fill="rgba(255,255,255,0.1)"/>
          <text x="114" y="18" fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle">♨</text>
        </g>
        <text x="930" y="30" fill="#94a3b8" font-family="'Segoe UI', sans-serif" font-size="12" text-anchor="end">16:35 • 🟢 Ready</text>
      </g>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%" height="100%">${body}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

module.exports = {
  escapeXml,
  generateStationScreen
};
