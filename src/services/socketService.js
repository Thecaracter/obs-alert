// src/services/socketService.js - Fixed Socket Service Implementation
const logger = require('../utils/logger');

class SocketService {
    constructor(io, alertService, tiktokService) {
        this.io = io;
        this.alertService = alertService;
        this.tiktokService = tiktokService;

        this.setupSocketHandlers();
        this.setupTikTokEventHandlers();

        logger.info('🔌 Socket Service initialized');
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`New connection established: ${socket.id}`);

            // Client identification
            socket.on('identify', (data) => {
                try {
                    const userAgent = socket.request.headers['user-agent'] || 'Unknown';

                    // Safety check for alertService
                    if (!this.alertService || typeof this.alertService.addConnection !== 'function') {
                        logger.error('AlertService not properly initialized');
                        socket.emit('connection-error', {
                            message: 'AlertService not available'
                        });
                        return;
                    }

                    const success = this.alertService.addConnection(socket.id, data.type, userAgent);

                    if (success) {
                        // Get current stats safely
                        const serverStats = this.alertService.getConnectionStats ?
                            this.alertService.getConnectionStats() :
                            { obsConnections: 0, dashboardConnections: 0 };

                        const tiktokStats = this.tiktokService && this.tiktokService.getStats ?
                            this.tiktokService.getStats() :
                            { activeConnections: 0 };

                        socket.emit('connection-confirmed', {
                            connectionId: socket.id,
                            serverStats: serverStats,
                            tiktokStats: tiktokStats
                        });

                        // Broadcast connection update to all clients
                        this.io.emit('connection-update', serverStats);
                    }
                } catch (error) {
                    logger.error(`Error in identify handler: ${error.message}`);
                    socket.emit('connection-error', {
                        message: 'Failed to identify connection'
                    });
                }
            });

            // Alert triggering
            socket.on('trigger-alert', (alertData) => {
                try {
                    if (!this.alertService || typeof this.alertService.processAlert !== 'function') {
                        socket.emit('alert-error', {
                            message: 'AlertService not available',
                            error: 'Service not initialized'
                        });
                        return;
                    }

                    const result = this.alertService.processAlert(alertData, this.io, socket.id);
                    socket.emit('alert-sent', result);
                } catch (error) {
                    logger.error(`Error processing alert: ${error.message}`);
                    socket.emit('alert-error', {
                        message: 'Failed to process alert',
                        error: error.message
                    });
                }
            });

            // TikTok connection management
            socket.on('tiktok-connect', async (data) => {
                try {
                    if (!this.tiktokService || typeof this.tiktokService.connectToStream !== 'function') {
                        socket.emit('tiktok-connect-result', {
                            success: false,
                            message: 'TikTok service not available'
                        });
                        return;
                    }

                    const result = await this.tiktokService.connectToStream(data.username);
                    socket.emit('tiktok-connect-result', result);
                } catch (error) {
                    logger.error(`TikTok connect error: ${error.message}`);
                    socket.emit('tiktok-connect-result', {
                        success: false,
                        message: error.message
                    });
                }
            });

            socket.on('tiktok-disconnect', async (data) => {
                try {
                    if (!this.tiktokService || typeof this.tiktokService.disconnectFromStream !== 'function') {
                        socket.emit('tiktok-disconnect-result', {
                            success: false,
                            message: 'TikTok service not available'
                        });
                        return;
                    }

                    const result = await this.tiktokService.disconnectFromStream(data.username);
                    socket.emit('tiktok-disconnect-result', result);
                } catch (error) {
                    logger.error(`TikTok disconnect error: ${error.message}`);
                    socket.emit('tiktok-disconnect-result', {
                        success: false,
                        message: error.message
                    });
                }
            });

            // TikTok status requests
            socket.on('tiktok-get-status', () => {
                try {
                    const stats = this.tiktokService && this.tiktokService.getStats ?
                        this.tiktokService.getStats() :
                        { activeConnections: 0 };

                    const connections = this.tiktokService && this.tiktokService.getActiveConnections ?
                        this.tiktokService.getActiveConnections() :
                        [];

                    socket.emit('tiktok-status-update', {
                        stats: stats,
                        connections: connections
                    });
                } catch (error) {
                    logger.error(`Error getting TikTok status: ${error.message}`);
                    socket.emit('tiktok-status-update', {
                        stats: { activeConnections: 0 },
                        connections: []
                    });
                }
            });

            // Clear all alerts
            socket.on('clear-alerts', () => {
                try {
                    if (this.alertService && typeof this.alertService.clearAllAlerts === 'function') {
                        this.alertService.clearAllAlerts(this.io);
                        socket.emit('alerts-cleared', { success: true });
                    } else {
                        socket.emit('alerts-cleared', {
                            success: false,
                            message: 'AlertService not available'
                        });
                    }
                } catch (error) {
                    logger.error(`Error clearing alerts: ${error.message}`);
                    socket.emit('alerts-cleared', {
                        success: false,
                        message: error.message
                    });
                }
            });

            // Ping/Pong for connection health
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: Date.now() });
            });

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                try {
                    logger.info(`Client disconnected: ${socket.id} (${reason})`);

                    if (this.alertService && typeof this.alertService.removeConnection === 'function') {
                        this.alertService.removeConnection(socket.id);

                        // Broadcast updated connection stats
                        const stats = this.alertService.getConnectionStats ?
                            this.alertService.getConnectionStats() :
                            { obsConnections: 0, dashboardConnections: 0 };

                        this.io.emit('connection-update', stats);
                    }
                } catch (error) {
                    logger.error(`Error handling disconnect: ${error.message}`);
                }
            });

            // Handle socket errors
            socket.on('error', (error) => {
                logger.error(`Socket error for ${socket.id}: ${error.message}`);
            });
        });
    }

    setupTikTokEventHandlers() {
        // Listen for TikTok comment events from TikTok service
        this.io.on('tiktok-comment-received', (commentData) => {
            try {
                // Process the comment through alert service
                if (this.alertService && typeof this.alertService.processAlert === 'function') {
                    const result = this.alertService.processAlert(commentData, this.io, 'tiktok-service');
                    logger.tiktok(`Processed TikTok comment from ${commentData.data.name}`);
                }

                // Broadcast TikTok activity to dashboard clients
                this.broadcastToType('dashboard', 'tiktok-activity', {
                    type: commentData.type,
                    username: commentData.data.streamUsername,
                    data: commentData.data,
                    timestamp: Date.now()
                });

            } catch (error) {
                logger.error(`Error processing TikTok comment: ${error.message}`);
            }
        });

        // Listen for TikTok gift events
        this.io.on('tiktok-gift-received', (giftData) => {
            try {
                // Process the gift through alert service
                if (this.alertService && typeof this.alertService.processAlert === 'function') {
                    const result = this.alertService.processAlert(giftData, this.io, 'tiktok-service');
                    logger.tiktok(`Processed TikTok gift from ${giftData.data.name}`);
                }

                // Broadcast TikTok activity to dashboard clients
                this.broadcastToType('dashboard', 'tiktok-activity', {
                    type: giftData.type,
                    username: giftData.data.streamUsername,
                    data: giftData.data,
                    timestamp: Date.now()
                });

            } catch (error) {
                logger.error(`Error processing TikTok gift: ${error.message}`);
            }
        });
    }

    // Utility method to broadcast to specific client types
    broadcastToType(type, event, data) {
        try {
            if (!this.alertService || !this.alertService.connections || !this.alertService.connections[type]) {
                return;
            }

            this.alertService.connections[type].forEach((connection, socketId) => {
                this.io.to(socketId).emit(event, data);
            });
        } catch (error) {
            logger.error(`Error broadcasting to type ${type}: ${error.message}`);
        }
    }

    // Utility method to broadcast to all clients
    broadcastToAll(event, data) {
        try {
            this.io.emit(event, data);
        } catch (error) {
            logger.error(`Error broadcasting to all: ${error.message}`);
        }
    }

    // Method to get service statistics
    getServiceStats() {
        try {
            const alertStats = this.alertService && this.alertService.getStats ?
                this.alertService.getStats() :
                { connections: { obsConnections: 0, dashboardConnections: 0 } };

            const tiktokStats = this.tiktokService && this.tiktokService.getStats ?
                this.tiktokService.getStats() :
                { activeConnections: 0 };

            return {
                alert: alertStats,
                tiktok: tiktokStats,
                socket: {
                    totalConnections: this.io.engine.clientsCount || 0
                }
            };
        } catch (error) {
            logger.error(`Error getting service stats: ${error.message}`);
            return {
                alert: { connections: { obsConnections: 0, dashboardConnections: 0 } },
                tiktok: { activeConnections: 0 },
                socket: { totalConnections: 0 }
            };
        }
    }
}

module.exports = SocketService;