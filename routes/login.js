const express = require('express');
const router = express.Router();
const { motilalLogin }  = require('../controllers/login');

router.get('/login', motilalLogin.redirectToMotilal);
router.get('/callback', motilalLogin.handleCallback);

module.exports = router;