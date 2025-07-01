
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const Validator = require('../utils/validation');

module.exports = (alertService) => {


    router.post('/donation', (req, res) => {
        try {
            logger.info(`Webhook received: ${JSON.stringify(req.body)}`);

            const {
                donor_name,
                amount,
                message,
                transaction_id,
                status,
                payment_method
            } = req.body;

            if (!Validator.validateWebhookData(req.body)) {
                return res.status(400).json({
                    error: 'Invalid webhook data'
                });
            }


            if (status && status.toLowerCase() !== 'success') {
                return res.json({
                    status: 'ignored',
                    reason: 'Payment not successful'
                });
            }

            const alertData = {
                type: 'donation',
                data: {
                    name: donor_name || 'Anonymous Donor',
                    amount: `Rp ${parseInt(amount).toLocaleString('id-ID')}`,
                    message: message || 'Terima kasih untuk donasi!',
                    timestamp: Date.now(),
                    source: 'webhook',
                    transactionId: transaction_id,
                    paymentMethod: payment_method
                }
            };

            const result = alertService.processAlert(alertData, req.app.get('io'));

            logger.success(
                `Webhook Alert: Donation from ${donor_name} (${amount}) - TXN: ${transaction_id}`
            );

            res.json({
                status: 'success',
                message: 'Donation alert processed',
                transactionId: transaction_id,
                sentToObsCount: result.sentToObsCount
            });

        } catch (error) {
            logger.error(`Webhook Error: ${error.message}`);
            res.status(500).json({
                error: 'Webhook processing failed',
                message: error.message
            });
        }
    });

    return router;
};