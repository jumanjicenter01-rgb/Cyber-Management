const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backupRoot = path.join(__dirname, 'backups');
const snapshotDir = path.join(backupRoot, 'restore-point-stable');

if (!fs.existsSync(backupRoot)) {
    fs.mkdirSync(backupRoot, { recursive: true });
}
if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
}

// Copy file or directory recursively excluding node_modules and backups
function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const item of fs.readdirSync(src)) {
            if (['node_modules', '.git', 'backups', '.gemini'].includes(item)) continue;
            copyRecursive(path.join(src, item), path.join(dest, item));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Perform copy
const items = ['server.js', 'package.json', 'package-lock.json', 'start-server.bat', 'README.md', 'public', 'client'];
for (const item of items) {
    const srcPath = path.join(__dirname, item);
    const destPath = path.join(snapshotDir, item);
    if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
    }
}

// Create backup manifest
const manifest = {
    createdAt: new Date().toISOString(),
    name: "CyberPulse Stable Restore Point",
    version: "2.0.0",
    description: "Stable clean version: English UI, Floor Map removed, Windows Explorer multi-select, solid RGB underglow, View modes selector",
    filesIncluded: items
};
fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('Snapshot created successfully in:', snapshotDir);

// Create ZIP archive using PowerShell Compress-Archive
const zipPath = path.join(backupRoot, 'CyberPulse_RestorePoint_Stable.zip');
try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${snapshotDir}\\*' -DestinationPath '${zipPath}' -Force"`);
    console.log('ZIP Archive created successfully at:', zipPath);
} catch (e) {
    console.log('Zip creation info:', e.message);
}
