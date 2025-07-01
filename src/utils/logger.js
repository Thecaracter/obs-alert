class Logger {
    constructor() {
        this.colors = {
            INFO: '\x1b[36m',
            SUCCESS: '\x1b[32m',
            ERROR: '\x1b[31m',
            WARNING: '\x1b[33m',
            TIKTOK: '\x1b[35m'
        };
        this.reset = '\x1b[0m';
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const color = this.colors[type] || this.colors.INFO;
        console.log(`${color}[${timestamp}] ${type}: ${message}${this.reset}`);
    }

    info(message) {
        this.log(message, 'INFO');
    }

    success(message) {
        this.log(message, 'SUCCESS');
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    warning(message) {
        this.log(message, 'WARNING');
    }

    tiktok(message) {
        this.log(message, 'TIKTOK');
    }
}

module.exports = new Logger();