// setup-real-tiktok.js - Setup script untuk TikTok Live real connection
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 TikTok Live Real Connection Setup');
console.log('=====================================\n');

async function setupRealTikTok() {
    try {
        // Check if package.json exists
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            console.log('❌ package.json not found. Please run npm init first.');
            return;
        }

        console.log('📦 Installing tiktok-live-connector...');

        try {
            execSync('npm install tiktok-live-connector', {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            console.log('✅ tiktok-live-connector installed successfully!\n');
        } catch (error) {
            console.log('❌ Failed to install tiktok-live-connector');
            console.log('💡 Try manually: npm install tiktok-live-connector\n');
            return;
        }

        // Update package.json with additional scripts
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

            if (!packageJson.scripts) {
                packageJson.scripts = {};
            }

            packageJson.scripts['tiktok-real'] = 'node -e "console.log(\'Real TikTok mode enabled!\')"';
            packageJson.scripts['test-tiktok'] = 'node test/test-tiktok-connection.js';

            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log('✅ Updated package.json with TikTok scripts\n');
        } catch (error) {
            console.log('⚠️ Could not update package.json:', error.message);
        }

        // Create test file
        const testDir = path.join(process.cwd(), 'test');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir);
        }

        const testFile = path.join(testDir, 'test-tiktok-connection.js');
        const testContent = `// test/test-tiktok-connection.js - Test TikTok Live Connection
const TikTokService = require('../src/services/tiktokService');

async function testTikTokConnection() {
    console.log('🧪 Testing TikTok Live Connection');
    console.log('================================\\n');

    // Mock io object
    const mockIo = {
        emit: (event, data) => {
            console.log(\`📡 Event: \${event}\`);
            console.log(\`📋 Data:\`, data);
            console.log('');
        }
    };

    const tiktokService = new TikTokService(mockIo);

    console.log('📊 TikTok Service Stats:');
    console.log(tiktokService.getStats());
    console.log('');

    // Test connection to a popular TikTok user
    const testUsername = process.argv[2] || 'tiktok'; // Default to @tiktok official account
    
    console.log(\`🔗 Testing connection to @\${testUsername}...\`);
    
    try {
        const result = await tiktokService.connectToStream(testUsername);
        
        if (result.success) {
            console.log('✅ Connection successful!');
            console.log(\`   Type: \${result.type}\`);
            console.log(\`   Message: \${result.message}\`);
            
            if (result.roomInfo) {
                console.log(\`   Room ID: \${result.roomInfo.roomId || 'Unknown'}\`);
                console.log(\`   Status: \${result.roomInfo.status || 'Unknown'}\`);
            }
            
            // Wait for some events
            console.log('\\n⏳ Waiting for TikTok events (30 seconds)...');
            console.log('   You should see comments, gifts, follows, etc. if the user is live');
            
            setTimeout(async () => {
                console.log('\\n📊 Final Stats:');
                console.log(tiktokService.getStats());
                
                console.log('\\n🔌 Disconnecting...');
                await tiktokService.disconnectFromStream(testUsername);
                
                console.log('✅ Test completed!');
                process.exit(0);
            }, 30000);
            
        } else {
            console.log('❌ Connection failed:');
            console.log(\`   Message: \${result.message}\`);
            process.exit(1);
        }
        
    } catch (error) {
        console.log('❌ Test error:', error.message);
        process.exit(1);
    }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\\n👋 Test interrupted by user');
    process.exit(0);
});

// Run test
testTikTokConnection();
`;

        fs.writeFileSync(testFile, testContent);
        console.log('✅ Created test file: test/test-tiktok-connection.js\n');

        // Create usage instructions
        console.log('🎯 Setup Complete! Here\'s how to use real TikTok Live:');
        console.log('================================================\n');

        console.log('1️⃣ Test TikTok Connection:');
        console.log('   npm run test-tiktok [username]');
        console.log('   Example: npm run test-tiktok tiktok\n');

        console.log('2️⃣ Start your server:');
        console.log('   npm start\n');

        console.log('3️⃣ In Dashboard:');
        console.log('   - Enter TikTok username (without @)');
        console.log('   - Click "Connect to TikTok Live"');
        console.log('   - Real comments/gifts will appear!\n');

        console.log('📝 Important Notes:');
        console.log('   ✅ User must be LIVE streaming on TikTok');
        console.log('   ✅ Username must be exact (case sensitive)');
        console.log('   ✅ Some users might have restricted live access');
        console.log('   ✅ Rate limiting may apply for popular streamers\n');

        console.log('🔧 Troubleshooting:');
        console.log('   - If connection fails, try different username');
        console.log('   - Check if user is actually live streaming');
        console.log('   - Some private/restricted accounts won\'t work');
        console.log('   - Network issues can cause connection failures\n');

        console.log('🚀 Ready to go! Start with: npm start');

    } catch (error) {
        console.log('❌ Setup failed:', error.message);
        console.log('\n💡 Manual setup:');
        console.log('   1. npm install tiktok-live-connector');
        console.log('   2. npm start');
    }
}

// Run setup
setupRealTikTok();