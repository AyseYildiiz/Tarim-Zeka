require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

// Route imports
const authRoutes = require('./routes/auth');
const locationRoutes = require('./routes/location');
const weatherRoutes = require('./routes/weather');
const fieldRoutes = require('./routes/fields');
const soilAnalysisRoutes = require('./routes/soilAnalysis');
const irrigationRoutes = require('./routes/irrigation');
const savingsRoutes = require('./routes/savings');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============ ROUTES ============

app.use('/api/auth', authRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/soil-analysis', soilAnalysisRoutes);
app.use('/api/irrigation', irrigationRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'TarımZeka API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ============ 404 HANDLER ============

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Sunucu hatası' });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`TarimZeka API running on port ${PORT}`);
});
