const express = require('express');
const router = express.Router();
const refUserController = require('../controllers/RefUser');
const authMiddleware = require('../middleware/auth');

router.post('/select-ref-user', authMiddleware, refUserController.selectRefUser);
router.post('/verify-otp', authMiddleware, refUserController.verifyOTPAndApprove);
router.get('/connected-users', authMiddleware, refUserController.getConnectedUsers);

module.exports = router;