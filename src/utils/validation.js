
class Validator {
    static validateAlertData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.type || !['donation', 'follow', 'subscribe', 'superchat', 'tiktok_comment', 'tiktok_gift'].includes(data.type)) return false;
        if (!data.data || typeof data.data !== 'object') return false;
        if (!data.data.name || typeof data.data.name !== 'string') return false;
        return true;
    }

    static validateTikTokUsername(username) {
        if (!username || typeof username !== 'string') return false;


        username = username.replace('@', '');


        if (username.length < 1 || username.length > 24) return false;
        if (!/^[a-zA-Z0-9._-]+$/.test(username)) return false;

        return username;
    }

    static sanitizeComment(comment) {
        if (!comment || typeof comment !== 'string') return '';


        return comment.trim().substring(0, 500);
    }

    static validateWebhookData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.donor_name && !data.amount) return false;
        return true;
    }
}

module.exports = Validator;