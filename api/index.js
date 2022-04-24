const router = require('express').Router();

router.use('/boats', require('./boats'));
router.use('/loads', require('./loads'));

module.exports = router;