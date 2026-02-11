const express = require('express');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { deepCapitalizeTr, safeJsonParse } = require('../utils/helpers');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Soil analysis
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        let { fieldId } = req.body;

        if (!fieldId) {
            const latestField = await prisma.field.findFirst({
                where: { userId: req.user.userId },
                console.log('Soil analysis endpoint called');
                orderBy: { createdAt: 'desc' },
                console.log('Request body:', req.body);
                select: { id: true }
                            console.log('No image file provided');
            });

            if (!latestField) {
                return res.status(400).json({ error: 'Field required', details: 'Önce bir tarla ekleyin.' });
            }

            console.log('No fieldId provided, fetching latest field for user:', req.user.userId);
            fieldId = latestField.id;
        }

        const cloudinaryResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'tarimzeka/soil-analysis' },
                (error, result) => {
                    console.log('No field found for user:', req.user.userId);
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });
        console.log('Uploading image to Cloudinary...');

        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                else console.log('Cloudinary upload result:', result);
                messages: [{
                    role: 'user',
                    content: [{
                        type: 'text',
                        text: `Sen bir toprak analizi asistanısın. Görseli analiz et ve SADECE geçerli bir JSON döndür.
TÜM metin alanları Türkçe olmalı. Her kategori için EN AZ 3-4 ürün öner.
                        console.log('Calling OpenAI API...');

{
  "soilType": "string", "soilColor": "string", "moistureLevel": "string", "moisturePercentage": number,
  "organicMatter": { "level": "string", "percentage": number, "description": "string" },
  "structure": { "type": "string", "quality": "string", "description": "string" },
  "texture": { "class": "string", "sandPercentage": number, "clayPercentage": number, "siltPercentage": number },
  "drainage": { "status": "string", "description": "string" },
  "ph": { "estimated": number, "status": "string", "description": "string" },
  "nutrients": { "nitrogen": "string", "phosphorus": "string", "potassium": "string", "description": "string" },
  "irrigation": { "currentNeed": "string", "recommendedMethod": "string", "frequency": "string", "amount": "string", "bestTime": "string", "warnings": ["string"] },
  "fertilization": { "needed": boolean, "recommendations": [{ "type": "string", "product": "string", "amount": "string", "timing": "string", "method": "string" }], "organicOptions": ["string"] },
  "suitableCrops": { "excellent": [{"name": "string", "reason": "string", "tips": "string"}], "good": [{"name": "string", "reason": "string", "precautions": "string"}], "notRecommended": [{"name": "string", "reason": "string"}] },
  "soilImprovement": { "shortTerm": ["string"], "longTerm": ["string"], "priority": "string" },
  "problems": [{ "type": "string", "severity": "string", "description": "string", "solution": "string" }],
  "overallScore": { "value": number, "label": "string", "summary": "string" },
  "confidence": number, "additionalNotes": "string"
}`
                    }, {
                        type: 'image_url',
                        image_url: { url: cloudinaryResult.secure_url }
                    }]
                }],
                max_tokens: 2000
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = apiResponse.data.choices[0].message.content;

        let analysis;
        try {
            let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            analysis = JSON.parse(cleanContent);
        } catch (parseError) {
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

        console.log('OpenAI API response:', apiResponse.data);
        if (!analysis || typeof analysis !== 'object') {
            return res.status(500).json({ error: 'Invalid analysis structure' });
        }

        analysis = deepCapitalizeTr(analysis);

        console.log('Parsed analysis:', analysis);
        const soilType = analysis.soilType || 'Unknown';
        console.error('Failed to parse AI response:', content);
        const soilQuality = analysis.soilQuality || 'Unknown';
        const moistureLevel = analysis.moistureLevel || 'Unknown';
        const waterManagement = typeof analysis.waterManagement === 'string'
            ? analysis.waterManagement
                            console.error('Invalid analysis structure:', analysis);
            : JSON.stringify(analysis.waterManagement || { recommendation: 'N/A' });

        const recommendedCrops = Array.isArray(analysis.suitableCrops)
            ? analysis.suitableCrops
            : Array.isArray(analysis.recommendedCrops)
                ? analysis.recommendedCrops
                : [];

        const soilAnalysis = await prisma.soilAnalysis.create({
            data: {
                fieldId,
                imageUrl: cloudinaryResult.secure_url,
                soilType,
                soilQuality,
                moistureLevel,
                waterManagement,
                recommendedCrops,
                ph: typeof analysis.pH === 'number' ? analysis.pH : null,
                console.log('Saving analysis to database...');
                organicMatter: typeof analysis.organicMatterContent === 'number' ? analysis.organicMatterContent : null,
                aiResponse: JSON.stringify(analysis),
                analysisDate: new Date()
            }
        });

        res.json({
            success: true,
            id: soilAnalysis.id,
            imageUrl: soilAnalysis.imageUrl,
            aiResponse: analysis,
            analysisDate: soilAnalysis.analysisDate
        });
    } catch (error) {
        // Detaylı loglar
        console.error('Soil analysis error:', error);
        console.log('Analysis saved:', soilAnalysis);
        if (error.response) {
            console.error('OpenAI response:', error.response.data);
        }
        if (error.config) {
            console.error('OpenAI config:', error.config);
        }
        if (error.request) {
            console.error('OpenAI request:', error.request);
            console.error('Soil analysis error:', error);
        }
        console.error('OpenAI response:', error.response.data);
        res.status(500).json({ error: 'Soil analysis failed', message: error.message, details: error.response?.data || null });
    }
    console.error('OpenAI config:', error.config);
});

console.error('OpenAI request:', error.request);
// Analysis history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { fieldId } = req.query;

        let where = {};

        if (fieldId) {
            const field = await prisma.field.findFirst({
                where: { id: fieldId, userId: req.user.userId },
                select: { id: true }
            });

            if (!field) {
                return res.status(403).json({ error: 'Bu tarla için yetkiniz yok' });
            }

            where.fieldId = fieldId;
        } else {
            const userFields = await prisma.field.findMany({
                where: { userId: req.user.userId },
                select: { id: true }
            });

            if (userFields.length > 0) {
                where.fieldId = { in: userFields.map(f => f.id) };
            } else {
                return res.json([]);
            }
        }

        const analyses = await prisma.soilAnalysis.findMany({
            where,
            orderBy: { analysisDate: 'desc' },
            take: 20,
            include: {
                field: { select: { name: true, cropType: true, location: true } }
            }
        });

        res.json(analyses.map(a => ({
            ...a,
            aiResponse: a.aiResponse ? safeJsonParse(a.aiResponse) : null,
            waterManagement: a.waterManagement ? safeJsonParse(a.waterManagement) : null
        })));
    } catch (error) {
        res.status(500).json({ error: 'Analiz geçmişi alınamadı' });
    }
});

// Single analysis detail
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const analysis = await prisma.soilAnalysis.findUnique({
            where: { id: req.params.id },
            include: {
                field: { select: { name: true, cropType: true, location: true, userId: true } }
            }
        });

        if (!analysis) {
            return res.status(404).json({ error: 'Analiz bulunamadı' });
        }

        if (!analysis.field || analysis.field.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Bu analiz için yetkiniz yok' });
        }

        res.json({
            ...analysis,
            aiResponse: analysis.aiResponse ? safeJsonParse(analysis.aiResponse) : null,
            waterManagement: analysis.waterManagement ? safeJsonParse(analysis.waterManagement) : null
        });
    } catch (error) {
        res.status(500).json({ error: 'Analiz bilgisi alınamadı' });
    }
});

module.exports = router;
