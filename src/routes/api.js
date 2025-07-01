
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

module.exports = (alertService, tiktokService) => {


    router.get('/health', (req, res) => {
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
                tiktok: tiktok
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });


    router.get('/status', (req, res) => {
        try {
            const alertStats = alertService && alertService.getStats ?
                alertService.getStats() : {
                    server: { status: 'unknown' },
                    connections: { obsConnections: 0, dashboardConnections: 0 },
                    statistics: { totalAlerts: 0, totalDonations: 0, totalTikTokComments: 0 }
                };
            const tiktokStats = tiktokService && tiktokService.getStats ?
                tiktokService.getStats() : { activeConnections: 0 };

            res.json({
                ...alertStats,
                tiktok: tiktokStats
            });
        } catch (error) {
            logger.error(`Status API Error: ${error.message}`);
            res.status(500).json({
                error: 'Failed to get status',
                message: error.message
            });
        }
    });


    router.post('/donation', (req, res) => {
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

            const result = alertService.processAlert(alertData, req.app.get('io'));

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


    router.post('/tiktok/connect', async (req, res) => {
        try {
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({
                    error: 'Username is required'
                });
            }

            if (!tiktokService || typeof tiktokService.connectToStream !== 'function') {
                return res.status(500).json({
                    error: 'TikTok service not available'
                });
            }

            const result = await tiktokService.connectToStream(username);

            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }

        } catch (error) {
            logger.error(`TikTok Connect API Error: ${error.message}`);
            res.status(500).json({
                error: 'Failed to connect to TikTok',
                message: error.message
            });
        }
    });

    router.post('/tiktok/disconnect', async (req, res) => {
        try {
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({
                    error: 'Username is required'
                });
            }

            if (!tiktokService || typeof tiktokService.disconnectFromStream !== 'function') {
                return res.status(500).json({
                    error: 'TikTok service not available'
                });
            }

            const result = await tiktokService.disconnectFromStream(username);
            res.json(result);

        } catch (error) {
            logger.error(`TikTok Disconnect API Error: ${error.message}`);
            res.status(500).json({
                error: 'Failed to disconnect from TikTok',
                message: error.message
            });
        }
    });

    router.get('/tiktok/connections', (req, res) => {
        try {
            const stats = tiktokService && tiktokService.getStats ? tiktokService.getStats() : { activeConnections: 0 };
            const connections = tiktokService && tiktokService.getActiveConnections ? tiktokService.getActiveConnections() : [];

            res.json({
                stats: stats,
                connections: connections
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get TikTok connections',
                message: error.message
            });
        }
    });


    router.post('/clear-alerts', (req, res) => {
        try {
            if (!alertService || typeof alertService.clearAllAlerts !== 'function') {
                return res.status(500).json({
                    error: 'Alert service not available'
                });
            }

            alertService.clearAllAlerts(req.app.get('io'));
            res.json({
                success: true,
                message: 'All alerts cleared',
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to clear alerts',
                message: error.message
            });
        }
    });


    router.get('/docs', (req, res) => {
        res.json({
            name: 'Donation Alert System with TikTok Live',
            version: '2.0.0',
            endpoints: {
                'GET /api/health': 'Server health check',
                'GET /api/status': 'Detailed server status and statistics',
                'POST /api/donation': 'Trigger donation alert via API',
                'POST /api/tiktok/connect': 'Connect to TikTok Live stream',
                'POST /api/tiktok/disconnect': 'Disconnect from TikTok Live stream',
                'GET /api/tiktok/connections': 'Get TikTok connection status',
                'POST /api/clear-alerts': 'Clear all active alerts',
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
                    }
                },
                tiktok_connect: {
                    url: '/api/tiktok/connect',
                    method: 'POST',
                    body: {
                        username: 'TikTok username (without @)'
                    }
                }
            },
            socket_events: {
                client_to_server: {
                    identify: 'Identify connection type (obs/dashboard)',
                    'trigger-alert': 'Trigger alert from dashboard',
                    'tiktok-connect': 'Connect to TikTok Live',
                    'tiktok-disconnect': 'Disconnect from TikTok Live'
                },
                server_to_client: {
                    'show-alert': 'Display alert (to OBS)',
                    'tiktok-comment-received': 'New TikTok comment',
                    'tiktok-status': 'TikTok connection status update'
                }
            }
        });
    });

    return router;
};