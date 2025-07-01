// setup.js - Script to create proper directory structure
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Donation Alert System directory structure...\n');

// Directory structure to create
const directories = [
    'src',
    'src/services',
    'src/routes',
    'src/utils',
    'src/config',
    'public'
];

// Create directories
directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    } else {
        console.log(`📁 Directory exists: ${dir}`);
    }
});

// Move files to correct locations if they're in the wrong place
const fileMoves = [
    { from: 'index.js', to: 'src/config/index.js' },
    { from: 'api.js', to: 'src/routes/api.js' },
    { from: 'webhook.js', to: 'src/routes/webhook.js' },
    { from: 'alertService.js', to: 'src/services/alertService.js' },
    { from: 'socketService.js', to: 'src/services/socketService.js' },
    { from: 'logger.js', to: 'src/utils/logger.js' },
    { from: 'validation.js', to: 'src/utils/validation.js' },
    { from: 'dashboard.html', to: 'public/dashboard.html' },
    { from: 'obs-overlay.html', to: 'public/obs-overlay.html' }
];

console.log('\n📋 Checking file locations...');

fileMoves.forEach(({ from, to }) => {
    const fromPath = path.join(__dirname, from);
    const toPath = path.join(__dirname, to);

    if (fs.existsSync(fromPath) && !fs.existsSync(toPath)) {
        try {
            // Ensure target directory exists
            const targetDir = path.dirname(toPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Copy file
            fs.copyFileSync(fromPath, toPath);
            console.log(`📝 Copied ${from} → ${to}`);

            // Optionally remove original (uncomment if you want to move instead of copy)
            // fs.unlinkSync(fromPath);
        } catch (error) {
            console.log(`❌ Error copying ${from}: ${error.message}`);
        }
    } else if (fs.existsSync(toPath)) {
        console.log(`✅ File in correct location: ${to}`);
    } else {
        console.log(`⚠️  File not found: ${from}`);
    }
});

// Create TikTok service file with the corrected content
const tiktokServicePath = path.join(__dirname, 'src/services/tiktokService.js');
if (!fs.existsSync(tiktokServicePath)) {
    console.log('\n🎵 Creating TikTok Service file...');

    const tiktokServiceContent = `// TikTok Service will be created here
// Please copy the TikTok Service code from the artifacts above
console.log('TikTok Service placeholder - replace with actual implementation');

class TikTokService {
    constructor(io) {
        this.io = io;
        this.connections = new Map();
        this.stats = { activeConnections: 0 };
    }
    
    async connectToStream(username) {
        return { success: false, message: 'TikTok service not implemented yet' };
    }
    
    async disconnectFromStream(username) {
        return { success: false, message: 'TikTok service not implemented yet' };
    }
    
    disconnectAll() {
        console.log('Disconnecting all TikTok connections...');
    }
    
    getStats() {
        return this.stats;
    }
    
    getActiveConnections() {
        return [];
    }
}

module.exports = TikTokService;`;

    try {
        fs.writeFileSync(tiktokServicePath, tiktokServiceContent);
        console.log('✅ Created placeholder TikTok Service');
    } catch (error) {
        console.log(`❌ Error creating TikTok Service: ${error.message}`);
    }
}

console.log('\n🎯 Setup Instructions:');
console.log('1. Replace the TikTok Service content with the proper implementation from the artifacts');
console.log('2. Make sure all other service files are in the src/ directory');
console.log('3. Run: npm start');
console.log('\n📁 Expected structure:');
console.log('   ├── server.js');
console.log('   ├── package.json');
console.log('   ├── src/');
console.log('   │   ├── services/');
console.log('   │   │   ├── alertService.js');
console.log('   │   │   ├── tiktokService.js');
console.log('   │   │   └── socketService.js');
console.log('   │   ├── routes/');
console.log('   │   │   ├── api.js');
console.log('   │   │   └── webhook.js');
console.log('   │   ├── utils/');
console.log('   │   │   ├── logger.js');
console.log('   │   │   └── validation.js');
console.log('   │   └── config/');
console.log('   │       └── index.js');
console.log('   └── public/');
console.log('       ├── dashboard.html');
console.log('       └── obs-overlay.html');

console.log('\n✨ Setup complete! You can now start the server.\n');