const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const verificationRoutes = require('./verification.routes');
const candidateRoutes = require('./candidate.routes');
const electionRoutes = require('./election.routes');
const voteRoutes = require('./vote.routes');
const resultRoutes = require('./result.routes');
const feedRoutes = require('./feed.routes');
const auditRoutes = require('./audit.routes');
const notificationRoutes = require('./notification.routes');

const router = express.Router();

// Mount sub-routers
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/verification', verificationRoutes);
router.use('/candidates', candidateRoutes);
router.use('/elections', electionRoutes);
router.use('/votes', voteRoutes);
router.use('/results', resultRoutes);
router.use('/feed', feedRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
