const express = require('express');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { deepCapitalizeTr, safeJsonParse } = require('../utils/helpers');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* =================================================
   SOIL ANALYSIS
================================================= */
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
    console.log('📥 [SOIL] Request geldi | user:', req.user.userId);

    try {
        /* ---------- IMAGE ---------- */
        if (!req.file) {
            console.log('❌ [SOIL] Image yok');
            return res.status(400).json({ error: 'No image file provided' });
        }

        let { fieldId } = req.body;

        /* ---------- FIELD ---------- */
        if (!fieldId) {
            console.log('ℹ️ [SOIL] fieldId yok → latest field aranıyor');

            const latestField = await prisma.field.findFirst({
                where: { userId: req.user.userId },
                orderBy: { createdAt: 'desc' },
                select: { id: true }
            });

            if (!latestField) {
                console.log('❌ [SOIL] Kullanıcının tarlası yok');
                return res.status(400).json({
                    error: 'Field required',
                    details: 'Önce bir tarla ekleyin.'
                });
            }

            fieldId = latestField.id;
        }

        console.log('✅ [SOIL] fieldId:', fieldId);

        /* ---------- CLOUDINARY ---------- */
        console.log('☁️ [SOIL] Cloudinary upload başlıyor...');

        const cloudinaryResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'tarimzeka/soil-analysis' },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        console.log('✅ [SOIL] Cloudinary OK:', cloudinaryResult.secure_url);

        /* ---------- OPENAI ---------- */
        console.log('🤖 [SOIL] OpenAI çağrılıyor...');

        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Toprak analizi yap ve SADECE JSON döndür.' },
                        { type: 'image_url', image_url: { url: cloudinaryResult.secure_url } }
                    ]
                }],
                max_tokens: 2000
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ [SOIL] OpenAI response geldi');

        /* ---------- PARSE ---------- */
        let analysis;

        try {
            const clean = apiResponse.data.choices[0].message.content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            analysis = JSON.parse(clean);
        } catch (err) {
            console.log('❌ [SOIL] JSON parse hatası');
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

        console.log('✅ [SOIL] JSON parse OK');

        analysis = deepCapitalizeTr(analysis);

        /* ---------- DB SAVE ---------- */
        console.log('💾 [SOIL] DB kayıt yapılıyor...');

        const soilAnalysis = await prisma.soilAnalysis.create({
            data: {
                fieldId,
                imageUrl: cloudinaryResult.secure_url,
                soilType: analysis.soilType || 'Unknown',
                soilQuality: analysis.soilQuality || 'Unknown',
                moistureLevel: analysis.moistureLevel || 'Unknown',
                waterManagement: JSON.stringify(analysis.waterManagement || {}),
                recommendedCrops: analysis.suitableCrops || [],
                aiResponse: JSON.stringify(analysis),
                analysisDate: new Date()
            }
        });

        console.log('🎉 [SOIL] Kayıt tamamlandı | id:', soilAnalysis.id);

        res.json({
            success: true,
            id: soilAnalysis.id,
            imageUrl: soilAnalysis.imageUrl,
            aiResponse: analysis,
            analysisDate: soilAnalysis.analysisDate
        });

    } catch (error) {
        console.error('❌ [SOIL] Genel hata:', error.message);

        if (error.response) console.error(error.response.data);

        res.status(500).json({
            error: 'Soil analysis failed',
            message: error.message
        });
    }
});


/* =================================================
   HISTORY
================================================= */
router.get('/history', authenticateToken, async (req, res) => {
    console.log('📜 [SOIL] History isteği | user:', req.user.userId);

    try {
        const analyses = await prisma.soilAnalysis.findMany({
            where: { field: { userId: req.user.userId } },
            orderBy: { analysisDate: 'desc' },
            take: 20
        });

        console.log('✅ [SOIL] History count:', analyses.length);

        res.json(analyses.map(a => ({
            ...a,
            aiResponse: safeJsonParse(a.aiResponse),
            waterManagement: safeJsonParse(a.waterManagement)
        })));

    } catch (error) {
        console.error('❌ [SOIL] History hata:', error);
        res.status(500).json({ error: 'Analiz geçmişi alınamadı' });
    }
});


/* =================================================
   DETAIL
================================================= */
router.get('/:id', authenticateToken, async (req, res) => {
    console.log('🔍 [SOIL] Detail:', req.params.id);

    try {
        const analysis = await prisma.soilAnalysis.findUnique({
            where: { id: req.params.id }
        });

        if (!analysis) {
            console.log('❌ [SOIL] Bulunamadı');
            return res.status(404).json({ error: 'Analiz bulunamadı' });
        }

        res.json({
            ...analysis,
            aiResponse: safeJsonParse(analysis.aiResponse),
            waterManagement: safeJsonParse(analysis.waterManagement)
        });

    } catch (error) {
        console.error('❌ [SOIL] Detail hata:', error);
        res.status(500).json({ error: 'Analiz bilgisi alınamadı' });
    }
});

module.exports = router;
