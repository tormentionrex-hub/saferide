const express = require('express');
const settingsController = require('../controllers/settingsController');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, authorize('admin'));

router.get('/monthly-carbon-goal', settingsController.getMonthlyCarbonGoal);
router.put('/monthly-carbon-goal', settingsController.updateMonthlyCarbonGoal);

module.exports = router;
