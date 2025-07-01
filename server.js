// server.js - Updated main application entry point
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Import services (with proper path checking)
let AlertService, TikTokService, SocketService;
let apiRoutes, webhookRoutes;
let logger, config;

try {
    // Try to import services
    AlertService = require('./src/services/alertService');
    TikTokService = require('./src/services/tiktokService');
    SocketService = require('./src/services/socketService');

    // Try to import routes
    apiRoutes = require('./src/routes/api');
    webhookRoutes = require('./src/routes/webhook');

    // Try to import utilities
    logger = require('./src/utils/logger');
    config = require('./src/config');
} catch (error) {
    console.error('❌ Error importing modules:', error.message);
    console.log('📁 Please ensure the following file structure exists:');
    console.log('   src/');
    console.log('   ├── services/');
    console.log('   │   ├── alertService.js');
    console.log('   │   ├── tiktokService.js');
    console.log('   │   └── socketService.js');
    console.log('   ├── routes/');
    console.log('   │   ├── api.js');
    console.log('   │   └── webhook.js');
    console.log('   ├── utils/');
    console.log('   │   ├── logger.js');
    console.log('   │   └── validation.js');
    console.log('   └── config/');
    console.log('       └── index.js');

    // Fallback simple logger
    logger = {
        info: (msg) => console.log(`[INFO] ${msg}`),
        success: (msg) => console.log(`[SUCCESS] ${msg}`),
        error: (msg) => console.log(`[ERROR] ${msg}`),
        warning: (msg) => console.log(`[WARNING] ${msg}`)
    };

    // Fallback config
    config = {
        port: 3000,
        host: 'localhost'
    };
}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '.')));

// Make io available to routes
app.set('io', io);

// Initialize services with error handling
let alertService, tiktokService, socketService;

try {
    if (AlertService) {
        alertService = new AlertService();
        logger.success('✅ Alert Service initialized');
    }

    if (TikTokService) {
        tiktokService = new TikTokService(io);
        logger.success('✅ TikTok Service initialized');
    }

    if (SocketService) {
        socketService = new SocketService(io, alertService, tiktokService);
        logger.success('✅ Socket Service initialized');
    }
} catch (error) {
    logger.error(`Service initialization error: ${error.message}`);
}

// Routes with error handling
if (apiRoutes && alertService && tiktokService) {
    try {
        app.use('/api', apiRoutes(alertService, tiktokService));
        logger.success('✅ API routes loaded');
    } catch (error) {
        logger.error(`API routes error: ${error.message}`);
    }
}

if (webhookRoutes && alertService) {
    try {
        app.use('/webhook', webhookRoutes(alertService));
        logger.success('✅ Webhook routes loaded');
    } catch (error) {
        logger.error(`Webhook routes error: ${error.message}`);
    }
}

// Static pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

app.get('/obs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/obs-overlay.html'));
});
app.get('/obs-comments', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/obs-comments.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

// Health check endpoint (always available)
app.get('/api/health', (req, res) => {
    try {
        const connections = alertService && alertService.getConnectionStats ?
            alertService.getConnectionStats() : { obsConnections: 0, dashboardConnections: 0 };
        const tiktok = tiktokService && tiktokService.getStats ?
            tiktokService.getStats() : { activeConnections: 0 };

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            connections: connections,
            tiktok: tiktok,
            services: {
                alertService: !!alertService,
                tiktokService: !!tiktokService,
                socketService: !!socketService
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Status endpoint (always available)
app.get('/api/status', (req, res) => {
    try {
        const alertStats = alertService && alertService.getStats ?
            alertService.getStats() : {
                server: { status: 'partial' },
                connections: { obsConnections: 0, dashboardConnections: 0 },
                statistics: { totalAlerts: 0, totalDonations: 0, totalTikTokComments: 0 }
            };
        const tiktokStats = tiktokService && tiktokService.getStats ?
            tiktokService.getStats() : { activeConnections: 0 };

        res.json({
            ...alertStats,
            tiktok: tiktokStats,
            services: {
                alertService: !!alertService,
                tiktokService: !!tiktokService,
                socketService: !!socketService
            }
        });
    } catch (error) {
        logger.error(`Status API Error: ${error.message}`);
        res.status(500).json({
            error: 'Failed to get status',
            message: error.message
        });
    }
});

// Simple donation endpoint (always available)
app.post('/api/donation', (req, res) => {
    try {
        const { name, amount, message, type = 'donation', source = 'api' } = req.body;

        if (!name || !amount) {
            return res.status(400).json({
                error: 'Missing required fields: name and amount'
            });
        }

        const alertData = {
            type: type,
            data: {
                name: name.toString().trim(),
                amount: amount.toString().trim(),
                message: message ? message.toString().trim() : '',
                timestamp: Date.now(),
                source: source
            }
        };

        if (!alertService || typeof alertService.processAlert !== 'function') {
            return res.status(500).json({
                error: 'Alert service not available'
            });
        }

        const result = alertService.processAlert(alertData, io);
        logger.success(`API Alert: ${type} from ${name} (${amount})`);
        res.json(result);

    } catch (error) {
        logger.error(`API Error: ${error.message}`);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// API documentation
app.get('/api/docs', (req, res) => {
    res.json({
        name: 'Donation Alert System with TikTok Live',
        version: '2.0.0',
        status: {
            alertService: !!alertService,
            tiktokService: !!tiktokService,
            socketService: !!socketService
        },
        endpoints: {
            'GET /api/health': 'Server health check',
            'GET /api/status': 'Detailed server status and statistics',
            'POST /api/donation': 'Trigger donation alert via API',
            'POST /api/tiktok/connect': 'Connect to TikTok Live stream (if service available)',
            'POST /api/tiktok/disconnect': 'Disconnect from TikTok Live stream (if service available)',
            'GET /': 'Dashboard interface',
            'GET /obs': 'OBS overlay page',
            'GET /obs-comments': 'OBS comments overlay page',
            'GET /api/docs': 'This documentation'
        },
        usage: {
            donation_api: {
                url: '/api/donation',
                method: 'POST',
                body: {
                    name: 'Donor Name (required)',
                    amount: 'Rp 50,000 (required)',
                    message: 'Thank you message (optional)',
                    type: 'donation|follow|subscribe|superchat (optional, default: donation)'
                },
                example: 'curl -X POST http://localhost:3000/api/donation -H "Content-Type: application/json" -d \'{"name":"Test User","amount":"Rp 50,000","message":"Test donation!"}\''
            }
        },
        setup_instructions: {
            obs: {
                1: 'Add Browser Source in OBS',
                2: `Set URL to: http://localhost:${config.port}/obs`,
                3: 'Set Width: 1920, Height: 1080',
                4: 'Enable: Shutdown source when not visible',
                5: 'Enable: Refresh browser when scene becomes active'
            },
            dashboard: {
                1: `Open dashboard at: http://localhost:${config.port}/`,
                2: 'Use the form to test donation alerts',
                3: 'Connect to TikTok Live for comment integration'
            }
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `${req.method} ${req.path} is not available`,
        availableEndpoints: [
            'GET /',
            'GET /obs',
            'GET /obs-comments',
            'GET /api/status',
            'GET /api/health',
            'POST /api/donation',
            'GET /api/docs'
        ]
    });
});

// Error handling
app.use((error, req, res, next) => {
    logger.error(`Express Error: ${error.message}`);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// Server startup
const PORT = process.env.PORT || config.port;
const HOST = process.env.HOST || config.host;

server.listen(PORT, () => {
    console.log('\n🚀=================================🚀');
    console.log('🎮   DONATION ALERT SERVER READY   🎮');
    console.log('🚀=================================🚀\n');

    logger.success(`Server running on http://${HOST}:${PORT}`);
    logger.info(`Dashboard: http://${HOST}:${PORT}/`);
    logger.info(`OBS Overlay: http://${HOST}:${PORT}/obs`);
    logger.info(`API Documentation: http://${HOST}:${PORT}/api/docs`);

    console.log('\n📋 Quick Setup for OBS:');
    console.log('1. Add Browser Source');
    console.log(`2. URL: http://${HOST}:${PORT}/obs`);
    console.log('3. Width: 1920, Height: 1080');
    console.log('4. ✅ Shutdown source when not visible');
    console.log('5. ✅ Refresh browser when scene becomes active\n');

    console.log('🎵 TikTok Live Comments (Mock Mode):');
    console.log('1. Masuk ke Dashboard');
    console.log('2. Input username TikTok (tanpa @)');
    console.log('3. Klik "Connect to TikTok Live"');
    console.log('4. Comments akan otomatis muncul di OBS\n');

    if (!AlertService || !TikTokService || !SocketService) {
        console.log('⚠️  WARNING: Some services failed to load');
        console.log('   Please check the file structure and try again\n');
    } else {
        console.log('✅ All services loaded successfully\n');
    }

    console.log('💡 Note: TikTok integration dalam mock mode');
    console.log('   Install tiktok-live-connector untuk fitur lengkap\n');
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.warning(`Received ${signal}, shutting down gracefully...`);

    // Disconnect all TikTok connections if service is available
    if (tiktokService && typeof tiktokService.disconnectAll === 'function') {
        tiktokService.disconnectAll();
    }

    server.close(() => {
        logger.info('HTTP server closed');
        io.close(() => {
            logger.info('Socket.IO server closed');
            logger.success('Server shutdown complete');
            process.exit(0);
        });
    });

    setTimeout(() => {
        logger.error('Force closing server...');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    console.error(error.stack);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = { app, server, io, alertService, tiktokService };