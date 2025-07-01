
const logger = require('../utils/logger');
const Validator = require('../utils/validation');
const config = require('../config');

class AlertService {
    constructor() {
        this.connections = {
            obs: new Map(),
            dashboard: new Map()
        };

        this.stats = {
            totalAlerts: 0,
            totalDonations: 0,
            totalTikTokComments: 0,
            serverStartTime: Date.now(),
            lastAlert: null
        };
    }

    // Connection management
    addConnection(socketId, type, userAgent = 'Unknown') {
        if (!['obs', 'dashboard'].includes(type)) return false;

        this.connections[type].set(socketId, {
            id: socketId,
            connectedAt: Date.now(),
            userAgent: userAgent
        });

        logger.success(`${type.toUpperCase()} client connected: ${socketId}`);
        return true;
    }

    removeConnection(socketId) {
        this.connections.obs.delete(socketId);
        this.connections.dashboard.delete(socketId);
        logger.warning(`Client disconnected: ${socketId}`);
    }

    getConnectionStats() {
        return {
            obsConnections: this.connections.obs.size,
            dashboardConnections: this.connections.dashboard.size,
            totalConnections: this.connections.obs.size + this.connections.dashboard.size
        };
    }

    // Alert processing
    processAlert(alertData, io, triggeredBy = null) {
        try {
            if (!Validator.validateAlertData(alertData)) {
                throw new Error('Invalid alert data format');
            }

            // Add metadata
            const enrichedAlertData = {
                ...alertData,
                metadata: {
                    triggeredBy: triggeredBy,
                    triggeredAt: Date.now(),
                    serverId: process.pid
                }
            };

            // Update statistics
            this.updateStats(alertData.type);
            this.stats.lastAlert = enrichedAlertData;

            // Send to OBS clients
            const sentCount = this.broadcastToOBS(enrichedAlertData, io);

            // Broadcast to dashboard clients
            this.broadcastToDashboard(enrichedAlertData, io, triggeredBy);

            logger.success(
                `Alert sent: ${alertData.type} from ${alertData.data.name} to ${sentCount} OBS client(s)`
            );

            return {
                success: true,
                alertData: enrichedAlertData,
                sentToObsCount: sentCount,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error(`Error processing alert: ${error.message}`);
            throw error;
        }
    }

    updateStats(alertType) {
        this.stats.totalAlerts++;

        switch (alertType) {
            case 'donation':
                this.stats.totalDonations++;
                break;
            case 'tiktok_comment':
            case 'tiktok_gift':
                this.stats.totalTikTokComments++;
                break;
        }
    }

    broadcastToOBS(alertData, io) {
        let sentCount = 0;
        this.connections.obs.forEach((obsConnection, obsId) => {
            io.to(obsId).emit('show-alert', alertData);
            sentCount++;
        });
        return sentCount;
    }

    broadcastToDashboard(alertData, io, excludeSocketId = null) {
        this.connections.dashboard.forEach((dashConnection, dashId) => {
            if (dashId !== excludeSocketId) {
                io.to(dashId).emit('alert-broadcast', alertData);
            }
        });
    }

    clearAllAlerts(io) {
        const clearData = { type: 'clear' };
        this.connections.obs.forEach((obsConnection, obsId) => {
            io.to(obsId).emit('show-alert', clearData);
        });
        logger.info('All alerts cleared');
    }

    getStats() {
        const uptime = Date.now() - this.stats.serverStartTime;
        return {
            server: {
                status: 'running',
                uptime: uptime,
                startTime: new Date(this.stats.serverStartTime).toISOString(),
                nodeVersion: process.version,
                platform: process.platform
            },
            connections: this.getConnectionStats(),
            statistics: {
                totalAlerts: this.stats.totalAlerts,
                totalDonations: this.stats.totalDonations,
                totalTikTokComments: this.stats.totalTikTokComments,
                lastAlert: this.stats.lastAlert
            },
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = AlertService;