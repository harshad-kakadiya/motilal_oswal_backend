const express = require('express');
const router = express.Router();
const tradingController = require('../controllers/Trading');
const authMiddleware = require('../middleware/auth');

router.post('/buy', authMiddleware, tradingController.buyStock);
router.post('/sell', authMiddleware, tradingController.sellStock);

module.exports = router;