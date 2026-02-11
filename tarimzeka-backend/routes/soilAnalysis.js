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
    console.log('📥 Soil analysis request started');

    try {
        if (!req.file) {
            console.log('❌ No image file provided');
            return res.status(400).json({ error: 'No image file provided' });
        }

        let { fieldId } = req.body;

        /* ---------- FIELD CHECK ---------- */
        if (!fieldId) {
            console.log('ℹ️ fieldId yok → latest field aranıyor');

            const latestField = await prisma.field.findFirst({
                where: { userId: req.user.userId },
                orderBy: { createdAt: 'desc' },
                select: { id: true }
            });

            if (!latestField) {
                console.log('❌ Kullanıcının tarlası yok');
                return res.status(400).json({
                    error: 'Field required',
                    details: 'Önce bir tarla ekleyin.'
                });
            }

            fieldId = latestField.id;
        }

        /* ---------- CLOUDINARY ---------- */
        console.log('☁️ Uploading image to Cloudinary...');

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

        console.log('✅ Cloudinary upload success');

        /* ---------- OPENAI ---------- */
        console.log('🤖 Calling OpenAI...');

        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Sen bir toprak analizi asistanısın. SADECE geçerli JSON döndür.`
                        },
                        {
                            type: 'image_url',
                            image_url: { url: cloudinaryResult.secure_url }
                        }
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

        console.log('✅ OpenAI response received');

        /* ---------- PARSE ---------- */
        let analysis;
        try {
            const clean = apiResponse.data.choices[0].message.content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            analysis = JSON.parse(clean);
        } catch (err) {
            console.error('❌ JSON parse error');
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

        analysis = deepCapitalizeTr(analysis);

        /* ---------- SAVE DB ---------- */
        console.log('💾 Saving analysis to database...');

        const soilAnalysis = await prisma.soilAnalysis.create({
            data: {
                fieldId,
                imageUrl: cloudinaryResult.secure_url,
                soilType: analysis.soilType || 'Unknown',
                moistureLevel: analysis.moistureLevel || 'Unknown',
                waterManagement: JSON.stringify(analysis.irrigation || {}),
                recommendedCrops: analysis.suitableCrops || [],
                aiResponse: JSON.stringify(analysis),
                analysisDate: new Date()
            }
        });

        console.log('✅ Analysis saved:', soilAnalysis.id);

        res.json({
            success: true,
            id: soilAnalysis.id,
            imageUrl: soilAnalysis.imageUrl,
            aiResponse: analysis,
            analysisDate: soilAnalysis.analysisDate
        });

    } catch (error) {
        console.error('❌ Soil analysis error:', error.message);

        if (error.response) {
            console.error(error.response.data);
        }

        res.status(500).json({
            error: 'Soil analysis failed',
            message: error.message
        });
    }
});
