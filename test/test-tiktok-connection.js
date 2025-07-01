// test/test-tiktok-connection.js - Test TikTok Live Connection
const TikTokService = require('../src/services/tiktokService');

async function testTikTokConnection() {
    console.log('🧪 Testing TikTok Live Connection');
    console.log('================================\n');

    // Mock io object
    const mockIo = {
        emit: (event, data) => {
            console.log(`📡 Event: ${event}`);
            console.log(`📋 Data:`, data);
            console.log('');
        }
    };

    const tiktokService = new TikTokService(mockIo);

    console.log('📊 TikTok Service Stats:');
    console.log(tiktokService.getStats());
    console.log('');

    // Test connection to a popular TikTok user
    const testUsername = process.argv[2] || 'tiktok'; // Default to @tiktok official account
    
    console.log(`🔗 Testing connection to @${testUsername}...`);
    
    try {
        const result = await tiktokService.connectToStream(testUsername);
        
        if (result.success) {
            console.log('✅ Connection successful!');
            console.log(`   Type: ${result.type}`);
            console.log(`   Message: ${result.message}`);
            
            if (result.roomInfo) {
                console.log(`   Room ID: ${result.roomInfo.roomId || 'Unknown'}`);
                console.log(`   Status: ${result.roomInfo.status || 'Unknown'}`);
            }
            
            // Wait for some events
            console.log('\n⏳ Waiting for TikTok events (30 seconds)...');
            console.log('   You should see comments, gifts, follows, etc. if the user is live');
            
            setTimeout(async () => {
                console.log('\n📊 Final Stats:');
                console.log(tiktokService.getStats());
                
                console.log('\n🔌 Disconnecting...');
                await tiktokService.disconnectFromStream(testUsername);
                
                console.log('✅ Test completed!');
                process.exit(0);
            }, 30000);
            
        } else {
            console.log('❌ Connection failed:');
            console.log(`   Message: ${result.message}`);
            process.exit(1);
        }
        
    } catch (error) {
        console.log('❌ Test error:', error.message);
        process.exit(1);
    }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n👋 Test interrupted by user');
    process.exit(0);
});

// Run test
testTikTokConnection();
