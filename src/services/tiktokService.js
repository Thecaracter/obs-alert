
const logger = require('../utils/logger');
const Validator = require('../utils/validation');


let TikTokLiveConnector;
try {
    TikTokLiveConnector = require('tiktok-live-connector').WebcastPushConnection;
    logger.success('✅ tiktok-live-connector loaded successfully');
} catch (error) {
    logger.warning('⚠️ tiktok-live-connector not found. Install it with: npm install tiktok-live-connector');
    TikTokLiveConnector = null;
}

class TikTokService {
    constructor(io) {
        this.io = io;
        this.connections = new Map();
        this.stats = {
            activeConnections: 0,
            totalCommentsReceived: 0,
            totalGiftsReceived: 0,
            totalFollows: 0,
            totalLikes: 0,
            startTime: Date.now()
        };


        this.realMode = !!TikTokLiveConnector;
        this.mockMode = !this.realMode;
        this.mockIntervals = new Map();

        if (this.realMode) {
            logger.success('🎵 TikTok Service initialized (Real Mode)');
        } else {
            logger.info('🎵 TikTok Service initialized (Mock Mode)');
            logger.info('💡 To enable real mode: npm install tiktok-live-connector');
        }
    }

    async connectToStream(username) {
        try {

            const cleanUsername = Validator.validateTikTokUsername(username);
            if (!cleanUsername) {
                return {
                    success: false,
                    message: 'Invalid TikTok username format'
                };
            }


            if (this.connections.has(cleanUsername)) {
                return {
                    success: false,
                    message: `Already connected to @${cleanUsername}`
                };
            }


            if (this.realMode) {
                return await this.connectRealStream(cleanUsername);
            } else {
                return await this.connectMockStream(cleanUsername);
            }

        } catch (error) {
            logger.error(`TikTok Connect Error: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }

    async connectRealStream(username) {
        try {
            if (!TikTokLiveConnector) {
                throw new Error('tiktok-live-connector not available');
            }

            logger.info(`🔗 Attempting real connection to @${username}...`);


            const tiktokConnection = new TikTokLiveConnector(username, {
                processInitialData: true,
                enableExtendedGiftInfo: true,
                enableWebsocketUpgrade: true,
                requestPollingIntervalMs: 1000,
                clientParams: {
                    app_name: 'tiktok_web',
                    device_platform: 'web'
                }
            });


            this.setupRealConnectionEvents(tiktokConnection, username);


            const state = await tiktokConnection.connect();


            const connectionData = {
                username: username,
                connectedAt: Date.now(),
                commentsReceived: 0,
                giftsReceived: 0,
                followsReceived: 0,
                status: 'connected',
                type: 'real',
                roomInfo: state.roomInfo || {},
                viewerCount: 0
            };

            this.connections.set(username, {
                connection: tiktokConnection,
                data: connectionData
            });

            this.stats.activeConnections++;


            this.broadcastStatusUpdate('connected', username, {
                type: 'real',
                roomInfo: state.roomInfo
            });

            logger.success(`✅ Real TikTok Live connected: @${username}`);
            logger.info(`   Room ID: ${state.roomInfo?.roomId || 'Unknown'}`);
            logger.info(`   Status: ${state.roomInfo?.status || 'Unknown'}`);

            return {
                success: true,
                message: `Connected to @${username} (Real Mode)`,
                username: username,
                type: 'real',
                roomInfo: state.roomInfo
            };

        } catch (error) {
            logger.error(`Real TikTok connection failed: ${error.message}`);


            logger.warning(`Falling back to mock mode for @${username}`);
            return await this.connectMockStream(username);
        }
    }

    setupRealConnectionEvents(tiktokConnection, username) {

        tiktokConnection.on('chat', (data) => {
            this.processRealTikTokComment(username, data);
        });


        tiktokConnection.on('gift', (data) => {
            this.processRealTikTokGift(username, data);
        });


        tiktokConnection.on('social', (data) => {
            this.processRealTikTokSocial(username, data);
        });


        tiktokConnection.on('like', (data) => {
            this.processRealTikTokLike(username, data);
        });


        tiktokConnection.on('member', (data) => {
            this.processRealTikTokMember(username, data);
        });


        tiktokConnection.on('roomUser', (data) => {
            const connectionData = this.connections.get(username);
            if (connectionData) {
                connectionData.data.viewerCount = data.viewerCount || 0;
            }
        });


        tiktokConnection.on('connected', (state) => {
            logger.success(`🎵 @${username} connected to live stream`);
            logger.info(`   Viewer count: ${state.roomInfo?.viewerCount || 0}`);
        });

        tiktokConnection.on('disconnected', () => {
            logger.warning(`❌ @${username} disconnected from live stream`);
            this.handleRealDisconnection(username);
        });

        tiktokConnection.on('error', (error) => {
            logger.error(`❌ TikTok connection error for @${username}: ${error.message}`);
            this.handleRealConnectionError(username, error);
        });


        tiktokConnection.on('streamEnd', () => {
            logger.info(`📺 @${username} stream ended`);
            this.broadcastStatusUpdate('stream_ended', username);
        });
    }

    processRealTikTokComment(username, data) {
        try {
            const connectionData = this.connections.get(username);
            if (!connectionData) return;


            connectionData.data.commentsReceived++;
            this.stats.totalCommentsReceived++;


            const alertData = {
                type: 'tiktok_comment',
                data: {
                    name: data.nickname || data.uniqueId || 'Anonymous',
                    amount: 'TikTok Comment',
                    message: Validator.sanitizeComment(data.comment),
                    timestamp: Date.now(),
                    source: 'tiktok_live_real',
                    streamUsername: username,
                    platform: 'TikTok',
                    userId: data.userId,
                    userLevel: data.userDetails?.level || 0,
                    profilePictureUrl: data.profilePictureUrl
                }
            };


            this.io.emit('tiktok-comment-received', alertData);
            this.io.emit('tiktok-activity', alertData);

            logger.tiktok(`💬 @${data.uniqueId}: ${data.comment}`);

        } catch (error) {
            logger.error(`Error processing real TikTok comment: ${error.message}`);
        }
    }

    processRealTikTokGift(username, data) {
        try {
            const connectionData = this.connections.get(username);
            if (!connectionData) return;


            connectionData.data.giftsReceived++;
            this.stats.totalGiftsReceived++;


            const giftName = data.giftName || 'Unknown Gift';
            const giftCount = data.repeatCount || 1;
            const totalCoins = (data.diamondCount || 0) * giftCount;


            const alertData = {
                type: 'tiktok_gift',
                data: {
                    name: data.nickname || data.uniqueId || 'Anonymous',
                    amount: `${giftName} x${giftCount}`,
                    message: `Mengirim ${giftName} (${totalCoins} coins)`,
                    timestamp: Date.now(),
                    source: 'tiktok_live_real',
                    streamUsername: username,
                    platform: 'TikTok',
                    giftType: giftName,
                    giftCount: giftCount,
                    giftValue: totalCoins,
                    userId: data.userId,
                    userLevel: data.userDetails?.level || 0,
                    profilePictureUrl: data.profilePictureUrl
                }
            };


            this.io.emit('tiktok-gift-received', alertData);
            this.io.emit('tiktok-activity', alertData);
            this.io.emit('show-alert', alertData);

            logger.tiktok(`🎁 @${data.uniqueId} sent ${giftName} x${giftCount} (${totalCoins} coins)`);

        } catch (error) {
            logger.error(`Error processing real TikTok gift: ${error.message}`);
        }
    }


    processRealTikTokSocial(username, data) {
        try {
            const connectionData = this.connections.get(username);
            if (!connectionData) return;


            if (data.displayType && data.displayType.includes('follow')) {
                connectionData.data.followsReceived++;
                this.stats.totalFollows++;

                const alertData = {
                    type: 'follow',
                    data: {
                        name: data.nickname || data.uniqueId || 'Anonymous',
                        amount: 'New Follower',
                        message: 'Terima kasih sudah follow!',
                        timestamp: Date.now(),
                        source: 'tiktok_live_real',
                        streamUsername: username,
                        platform: 'TikTok',
                        userId: data.userId,
                        profilePictureUrl: data.profilePictureUrl
                    }
                };


                this.io.emit('tiktok-follow-received', alertData);
                this.io.emit('tiktok-activity', alertData);
                this.io.emit('show-alert', alertData);

                logger.tiktok(`👥 @${data.uniqueId} started following`);
            }


            if (data.displayType && data.displayType.includes('share')) {
                logger.tiktok(`📤 @${data.uniqueId} shared the stream`);
            }

        } catch (error) {
            logger.error(`Error processing real TikTok social: ${error.message}`);
        }
    }


    processRealTikTokMember(username, data) {
        try {
            const connectionData = this.connections.get(username);
            if (!connectionData) return;


            if (data.action === 'join') {
                const alertData = {
                    type: 'follow',
                    data: {
                        name: data.nickname || data.uniqueId || 'Anonymous',
                        amount: 'New Viewer',
                        message: 'Bergabung ke stream!',
                        timestamp: Date.now(),
                        source: 'tiktok_live_real',
                        streamUsername: username,
                        platform: 'TikTok',
                        userId: data.userId,
                        profilePictureUrl: data.profilePictureUrl
                    }
                };

                this.io.emit('tiktok-activity', alertData);
                logger.tiktok(`👤 @${data.uniqueId} joined the stream`);
            }

        } catch (error) {
            logger.error(`Error processing real TikTok member: ${error.message}`);
        }
    }

    processRealTikTokLike(username, data) {
        try {
            this.stats.totalLikes += data.likeCount || 1;



            if (data.likeCount > 10) {
                logger.tiktok(`❤️ @${data.uniqueId} sent ${data.likeCount} likes`);
            }

        } catch (error) {
            logger.error(`Error processing real TikTok like: ${error.message}`);
        }
    }


    async connectMockStream(username) {
        try {
            logger.info(`🎭 Creating mock connection for @${username}...`);

            const connectionData = {
                username: username,
                connectedAt: Date.now(),
                commentsReceived: 0,
                giftsReceived: 0,
                followsReceived: 0,
                status: 'connected',
                type: 'mock'
            };

            this.connections.set(username, {
                connection: null,
                data: connectionData
            });

            this.stats.activeConnections++;
            this.startMockEvents(username);
            this.broadcastStatusUpdate('connected', username, { type: 'mock' });

            logger.tiktok(`Mock TikTok Live connected: @${username}`);

            return {
                success: true,
                message: `Connected to @${username} (Mock Mode)`,
                username: username,
                type: 'mock'
            };

        } catch (error) {
            throw new Error(`Mock connection failed: ${error.message}`);
        }
    }


    startMockEvents(username) {
        const mockComments = [
            { user: 'gaming_pro_id', comment: 'Keren banget streamnya!' },
            { user: 'maya_cantik', comment: 'Semangat terus kak!' },
            { user: 'indonesia_gamer', comment: 'Setup nya bagus banget' },
            { user: 'streamer_pemula', comment: 'Tips dong untuk OBS' },
            { user: 'viewer_setia', comment: 'Udah nunggu stream ini dari tadi' },
            { user: 'tiktok_fans', comment: 'Follow balik dong kak' },
            { user: 'live_watcher', comment: 'Gamenya apa nih?' },
            { user: 'comment_master', comment: 'Overlay alertnya kece!' },
            { user: 'streamer_indo', comment: 'Mantap jiwa!' },
            { user: 'live_enthusiast', comment: 'First time nonton!' }
        ];

        const mockGifts = [
            { user: 'generous_viewer', gift: 'Rose', value: 1 },
            { user: 'gift_giver', gift: 'Love', value: 5 },
            { user: 'supporter_elite', gift: 'Star', value: 10 },
            { user: 'big_supporter', gift: 'Heart', value: 15 }
        ];

        const mockFollowers = [
            { user: 'new_fan_123', message: 'Terima kasih sudah follow!' },
            { user: 'first_time_viewer', message: 'Started following!' },
            { user: 'loyal_supporter', message: 'Follow balik ya!' },
            { user: 'stream_lover', message: 'Follower baru nih!' }
        ];

        const interval = setInterval(() => {
            const connectionEntry = this.connections.get(username);
            if (!connectionEntry) {
                clearInterval(interval);
                return;
            }

            const random = Math.random();

            if (random < 0.7) {

                const randomComment = mockComments[Math.floor(Math.random() * mockComments.length)];
                this.processMockComment(username, randomComment);
            } else if (random < 0.9) {

                const randomGift = mockGifts[Math.floor(Math.random() * mockGifts.length)];
                this.processMockGift(username, randomGift);
            } else {

                const randomFollower = mockFollowers[Math.floor(Math.random() * mockFollowers.length)];
                this.processMockFollow(username, randomFollower);
            }

        }, Math.random() * 8000 + 5000);

        this.mockIntervals.set(username, interval);
    }

    processMockComment(streamUsername, commentData) {
        try {
            const connectionEntry = this.connections.get(streamUsername);
            if (!connectionEntry) return;

            connectionEntry.data.commentsReceived++;
            this.stats.totalCommentsReceived++;

            const alertData = {
                type: 'tiktok_comment',
                data: {
                    name: `@${commentData.user}`,
                    amount: 'TikTok Comment',
                    message: Validator.sanitizeComment(commentData.comment),
                    timestamp: Date.now(),
                    source: 'tiktok_live_mock',
                    streamUsername: streamUsername,
                    platform: 'TikTok'
                }
            };

            this.io.emit('tiktok-comment-received', alertData);
            this.io.emit('tiktok-activity', alertData);

            logger.tiktok(`💬 @${commentData.user}: ${commentData.comment}`);

        } catch (error) {
            logger.error(`Error processing mock TikTok comment: ${error.message}`);
        }
    }

    processMockGift(streamUsername, giftData) {
        try {
            const connectionEntry = this.connections.get(streamUsername);
            if (!connectionEntry) return;

            connectionEntry.data.giftsReceived++;
            this.stats.totalGiftsReceived++;

            const alertData = {
                type: 'tiktok_gift',
                data: {
                    name: `@${giftData.user}`,
                    amount: `${giftData.gift} Gift`,
                    message: `Mengirim ${giftData.gift} (${giftData.value} coins)`,
                    timestamp: Date.now(),
                    source: 'tiktok_live_mock',
                    streamUsername: streamUsername,
                    platform: 'TikTok',
                    giftType: giftData.gift,
                    giftValue: giftData.value
                }
            };

            this.io.emit('tiktok-gift-received', alertData);
            this.io.emit('tiktok-activity', alertData);
            this.io.emit('show-alert', alertData);

            logger.tiktok(`🎁 @${giftData.user}: ${giftData.gift} (${giftData.value})`);

        } catch (error) {
            logger.error(`Error processing mock TikTok gift: ${error.message}`);
        }
    }


    processMockFollow(streamUsername, followerData) {
        try {
            const connectionEntry = this.connections.get(streamUsername);
            if (!connectionEntry) return;

            connectionEntry.data.followsReceived++;
            this.stats.totalFollows++;

            const alertData = {
                type: 'follow',
                data: {
                    name: `@${followerData.user}`,
                    amount: 'New Follower',
                    message: followerData.message,
                    timestamp: Date.now(),
                    source: 'tiktok_live_mock',
                    streamUsername: streamUsername,
                    platform: 'TikTok'
                }
            };

            this.io.emit('tiktok-follow-received', alertData);
            this.io.emit('tiktok-activity', alertData);
            this.io.emit('show-alert', alertData);

            logger.tiktok(`👥 @${followerData.user}: New Follower!`);

        } catch (error) {
            logger.error(`Error processing mock TikTok follow: ${error.message}`);
        }
    }


    handleRealDisconnection(username) {
        const connectionData = this.connections.get(username);
        if (connectionData) {
            connectionData.data.status = 'disconnected';
            this.broadcastStatusUpdate('disconnected', username);
        }
    }

    handleRealConnectionError(username, error) {
        logger.error(`TikTok connection error for @${username}: ${error.message}`);


        setTimeout(() => {
            this.reconnectToStream(username);
        }, 5000);
    }

    async reconnectToStream(username) {
        try {
            logger.info(`🔄 Attempting to reconnect to @${username}...`);


            await this.disconnectFromStream(username);


            setTimeout(async () => {
                const result = await this.connectToStream(username);
                if (result.success) {
                    logger.success(`✅ Reconnected to @${username}`);
                } else {
                    logger.error(`❌ Failed to reconnect to @${username}: ${result.message}`);
                }
            }, 2000);

        } catch (error) {
            logger.error(`Reconnection error for @${username}: ${error.message}`);
        }
    }

    async disconnectFromStream(username) {
        try {
            const cleanUsername = Validator.validateTikTokUsername(username);
            if (!cleanUsername) {
                return {
                    success: false,
                    message: 'Invalid username'
                };
            }

            const connectionEntry = this.connections.get(cleanUsername);
            if (!connectionEntry) {
                return {
                    success: false,
                    message: `Not connected to @${cleanUsername}`
                };
            }


            if (connectionEntry.connection && typeof connectionEntry.connection.disconnect === 'function') {
                try {
                    connectionEntry.connection.disconnect();
                    logger.info(`📶 Disconnected real TikTok connection for @${cleanUsername}`);
                } catch (error) {
                    logger.warning(`Warning during disconnect: ${error.message}`);
                }
            }


            if (this.mockIntervals.has(cleanUsername)) {
                clearInterval(this.mockIntervals.get(cleanUsername));
                this.mockIntervals.delete(cleanUsername);
            }


            this.connections.delete(cleanUsername);
            this.stats.activeConnections--;


            this.broadcastStatusUpdate('disconnected', cleanUsername);

            logger.tiktok(`TikTok Live disconnected: @${cleanUsername}`);

            return {
                success: true,
                message: `Disconnected from @${cleanUsername}`,
                username: cleanUsername
            };

        } catch (error) {
            logger.error(`TikTok Disconnect Error: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }

    broadcastStatusUpdate(type, username, extra = {}) {
        this.io.emit('tiktok-status', {
            type: type,
            username: username,
            timestamp: Date.now(),
            activeConnections: this.stats.activeConnections,
            ...extra
        });
    }

    disconnectAll() {
        try {
            const usernames = Array.from(this.connections.keys());


            usernames.forEach(async (username) => {
                await this.disconnectFromStream(username);
            });


            this.mockIntervals.forEach((interval, username) => {
                clearInterval(interval);
                logger.tiktok(`Stopping mock events for @${username}`);
            });
            this.mockIntervals.clear();


            this.stats.activeConnections = 0;

            logger.tiktok('All TikTok connections disconnected');

        } catch (error) {
            logger.error(`Error disconnecting all TikTok streams: ${error.message}`);
        }
    }

    getActiveConnections() {
        const connections = [];
        this.connections.forEach((connectionEntry, username) => {
            const data = connectionEntry.data;
            connections.push({
                username: username,
                connectedAt: data.connectedAt,
                commentsReceived: data.commentsReceived,
                giftsReceived: data.giftsReceived || 0,
                followsReceived: data.followsReceived || 0,
                status: data.status,
                type: data.type,
                uptime: Date.now() - data.connectedAt,
                viewerCount: data.viewerCount || 0,
                roomInfo: data.roomInfo || {}
            });
        });
        return connections;
    }

    getStats() {
        return {
            activeConnections: this.stats.activeConnections,
            totalCommentsReceived: this.stats.totalCommentsReceived,
            totalGiftsReceived: this.stats.totalGiftsReceived,
            totalFollows: this.stats.totalFollows,
            totalLikes: this.stats.totalLikes,
            realMode: this.realMode,
            mockMode: this.mockMode,
            uptime: Date.now() - this.stats.startTime,
            connections: this.getActiveConnections()
        };
    }


    enableRealMode() {
        if (TikTokLiveConnector) {
            this.realMode = true;
            this.mockMode = false;
            logger.success('✅ TikTok Service switched to Real Mode');
        } else {
            logger.error('❌ Cannot enable real mode - tiktok-live-connector not installed');
            logger.info('💡 Install with: npm install tiktok-live-connector');
        }
    }


    enableMockMode() {
        this.realMode = false;
        this.mockMode = true;
        logger.warning('⚠️ TikTok Service switched to Mock Mode');
    }


    triggerTestComment(username, comment) {
        if (this.connections.has(username)) {
            const mockData = {
                user: 'test_user',
                comment: comment || 'This is a test comment from dashboard'
            };
            this.processMockComment(username, mockData);
        }
    }

    triggerTestGift(username, giftType) {
        if (this.connections.has(username)) {
            const mockData = {
                user: 'test_gifter',
                gift: giftType || 'Rose',
                value: 5
            };
            this.processMockGift(username, mockData);
        }
    }

    triggerTestFollow(username) {
        if (this.connections.has(username)) {
            const mockData = {
                user: 'test_follower',
                message: 'Thanks for the follow!'
            };
            this.processMockFollow(username, mockData);
        }
    }


    getConnectionInfo(username) {
        const connectionEntry = this.connections.get(username);
        if (!connectionEntry) {
            return null;
        }

        return {
            username: username,
            ...connectionEntry.data,
            uptime: Date.now() - connectionEntry.data.connectedAt,
            isReal: connectionEntry.data.type === 'real'
        };
    }


    async isUserLive(username) {
        try {
            if (!TikTokLiveConnector) {
                return false;
            }

            const tempConnection = new TikTokLiveConnector(username);
            const state = await tempConnection.getAvailableGifts();
            tempConnection.disconnect();

            return state && state.status === 2;

        } catch (error) {
            logger.warning(`Could not check live status for @${username}: ${error.message}`);
            return false;
        }
    }
}

module.exports = TikTokService;