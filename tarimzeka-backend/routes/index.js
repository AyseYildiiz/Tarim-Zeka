const authRoutes = require('./auth');
const locationRoutes = require('./location');
const weatherRoutes = require('./weather');
const fieldRoutes = require('./fields');
const soilAnalysisRoutes = require('./soilAnalysis');
const irrigationRoutes = require('./irrigation');
const savingsRoutes = require('./savings');
const notificationRoutes = require('./notifications');
const userRoutes = require('./users');

module.exports = {
    authRoutes,
    locationRoutes,
    weatherRoutes,
    fieldRoutes,
    soilAnalysisRoutes,
    irrigationRoutes,
    savingsRoutes,
    notificationRoutes,
    userRoutes
};
