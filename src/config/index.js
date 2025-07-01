// src/config/index.js - Main configuration file
module.exports = {
    // Server settings
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',

    // TikTok Live settings
    tiktok: {
        maxConnections: 5,
        reconnectInterval: 5000,
        commentCooldown: 1000,
        enableGifts: true,
        enableFollows: true,
        mockMode: true // Set to false when tiktok-live-connector is installed
    },

    // Alert system settings
    alerts: {
        maxQueueSize: 100,
        defaultDuration: 5000,
        ttsEnabled: true,
        types: {
            donation: {
                duration: 8000,
                sound: true,
                tts: true
            },
            follow: {
                duration: 5000,
                sound: true,
                tts: true
            },
            subscribe: {
                duration: 6000,
                sound: true,
                tts: true
            },
            superchat: {
                duration: 9000,
                sound: true,
                tts: true
            },
            tiktok_comment: {
                duration: 4000,
                sound: false,
                tts: true
            },
            tiktok_gift: {
                duration: 6000,
                sound: true,
                tts: true
            }
        }
    },

    // Logging settings
    logging: {
        level: 'info',
        colorize: true,
        enableFileLogging: false,
        logDirectory: './logs'
    },

    // Socket.IO settings
    socket: {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"]
        },
        pingTimeout: 60000,
        pingInterval: 25000
    },

    // API settings
    api: {
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        },
        bodyLimit: '10mb'
    }
};