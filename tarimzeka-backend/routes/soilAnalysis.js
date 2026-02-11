// Backend - routes/soilAnalysis.js - TAM HALİ

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
                    role: 'system',
                    content: `Sen bir tarım uzmanısın. Toprak görselini analiz et ve SADECE JSON formatında yanıt ver. 
Hiçbir açıklama, markdown, veya ekstra metin OLMADAN sadece JSON döndür.

JSON formatı şu şekilde olmalı:
{
  "soilType": "string",
  "soilColor": "string",
  "moistureLevel": "string",
  "moisturePercentage": number,
  "organicMatter": {
    "level": "string",
    "percentage": number,
    "description": "string"
  },
  "structure": {
    "type": "string",
    "quality": "string",
    "description": "string"
  },
  "texture": {
    "class": "string",
    "sandPercentage": number,
    "clayPercentage": number,
    "siltPercentage": number
  },
  "drainage": {
    "status": "string",
    "description": "string"
  },
  "ph": {
    "estimated": number,
    "status": "string",
    "description": "string"
  },
  "nutrients": {
    "nitrogen": "string",
    "phosphorus": "string",
    "potassium": "string",
    "description": "string"
  },
  "irrigation": {
    "currentNeed": "string",
    "recommendedMethod": "string",
    "frequency": "string",
    "amount": "string",
    "bestTime": "string",
    "warnings": ["string"]
  },
  "fertilization": {
    "needed": boolean,
    "recommendations": [{
      "type": "string",
      "product": "string",
      "amount": "string",
      "timing": "string",
      "method": "string"
    }],
    "organicOptions": ["string"]
  },
  "suitableCrops": {
    "excellent": [{"name": "string", "reason": "string", "tips": "string"}],
    "good": [{"name": "string", "reason": "string", "precautions": "string"}],
    "notRecommended": [{"name": "string", "reason": "string"}]
  },
  "soilImprovement": {
    "shortTerm": ["string"],
    "longTerm": ["string"],
    "priority": "string"
  },
  "problems": [{
    "type": "string",
    "severity": "string",
    "description": "string",
    "solution": "string"
  }],
  "overallScore": {
    "value": number,
    "label": "string",
    "summary": "string"
  },
  "confidence": number,
  "additionalNotes": "string"
}`
                }, {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Bu toprak görselini yukarıdaki JSON formatında analiz et. SADECE JSON döndür, başka hiçbir şey yazma.'
                        },
                        {
                            type: 'image_url',
                            image_url: { url: cloudinaryResult.secure_url }
                        }
                    ]
                }],
                max_tokens: 2500,
                temperature: 0.7
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ [SOIL] OpenAI response geldi');

        const rawContent = apiResponse.data.choices[0].message.content;
        console.log('📄 [SOIL] Raw OpenAI response:', rawContent.substring(0, 200));

        /* ---------- PARSE ---------- */
        let analysis;

        try {
            // Tüm markdown formatlarını temizle
            let clean = rawContent
                .replace(/```json\s*/g, '')
                .replace(/```\s*/g, '')
                .replace(/^[^{]*/g, '') // { karakterinden önceki her şeyi sil
                .replace(/[^}]*$/g, '') // } karakterinden sonraki her şeyi sil
                .trim();

            console.log('🧹 [SOIL] Cleaned content:', clean.substring(0, 200));

            analysis = JSON.parse(clean);
            console.log('✅ [SOIL] JSON parse başarılı');

        } catch (parseErr) {
            console.error('❌ [SOIL] JSON parse hatası:', parseErr.message);
            console.error('📄 [SOIL] Parse edilemeyen içerik:', rawContent);

            // Fallback: Basit bir analiz objesi oluştur
            analysis = {
                soilType: 'Bilinmiyor',
                soilColor: 'Görsel analizi yapılamadı',
                moistureLevel: 'Orta',
                moisturePercentage: 50,
                organicMatter: {
                    level: 'Orta',
                    percentage: 2,
                    description: 'Analiz tamamlanamadı'
                },
                structure: {
                    type: 'Bilinmiyor',
                    quality: 'Değerlendirilemiyor',
                    description: 'Detaylı analiz yapılamadı'
                },
                texture: {
                    class: 'Tınlı',
                    sandPercentage: 33,
                    clayPercentage: 33,
                    siltPercentage: 34
                },
                drainage: {
                    status: 'Normal',
                    description: 'Değerlendirilemiyor'
                },
                ph: {
                    estimated: 7,
                    status: 'Nötr',
                    description: 'Tahmin edilemiyor'
                },
                nutrients: {
                    nitrogen: 'Orta',
                    phosphorus: 'Orta',
                    potassium: 'Orta',
                    description: 'Detaylı analiz için laboratuvar testi önerilir'
                },
                irrigation: {
                    currentNeed: 'Normal',
                    recommendedMethod: 'Damla sulama',
                    frequency: 'Haftada 2-3 kez',
                    amount: '20-30 mm',
                    bestTime: 'Sabah erken saatler',
                    warnings: ['Laboratuvar testi yapılması önerilir']
                },
                fertilization: {
                    needed: false,
                    recommendations: [],
                    organicOptions: ['Kompost', 'Yanmış ahır gübresi']
                },
                suitableCrops: {
                    excellent: [],
                    good: [],
                    notRecommended: []
                },
                soilImprovement: {
                    shortTerm: ['Profesyonel toprak analizi yaptırın'],
                    longTerm: ['Organik madde ekleyin'],
                    priority: 'Laboratuvar analizi'
                },
                problems: [{
                    type: 'Analiz hatası',
                    severity: 'Orta',
                    description: 'AI analizi tamamlanamadı',
                    solution: 'Laboratuvar testi yaptırın'
                }],
                overallScore: {
                    value: 50,
                    label: 'Değerlendirilemiyor',
                    summary: 'Detaylı analiz için profesyonel test gerekli'
                },
                confidence: 30,
                additionalNotes: 'AI analizi başarısız oldu. Kesin sonuçlar için laboratuvar testi önerilir.'
            };
        }

        analysis = deepCapitalizeTr(analysis);

        /* ---------- DB SAVE ---------- */
        console.log('💾 [SOIL] DB kayıt yapılıyor...');

        const soilAnalysis = await prisma.soilAnalysis.create({
            data: {
                fieldId,
                imageUrl: cloudinaryResult.secure_url,
                soilType: analysis.soilType || 'Unknown',
                soilQuality: analysis.overallScore?.label || 'Unknown',
                moistureLevel: analysis.moistureLevel || 'Unknown',
                waterManagement: JSON.stringify(analysis.irrigation || {}),
                recommendedCrops: analysis.suitableCrops?.excellent?.map(c => c.name) || [],
                aiResponse: JSON.stringify(analysis),
                analysisDate: new Date()
            }
        });

        console.log('🎉 [SOIL] Kayıt tamamlandı | id:', soilAnalysis.id);

        // FRONTEND'İN BEKLEDİĞİ FORMAT
        res.json({
            success: true,
            id: soilAnalysis.id,
            imageUrl: soilAnalysis.imageUrl,
            aiResponse: analysis,  // ✅ OBJECT olarak dönüyor
            analysisDate: soilAnalysis.analysisDate
        });

    } catch (error) {
        console.error('❌ [SOIL] Genel hata:', error.message);

        if (error.response) {
            console.error('OpenAI Error:', error.response.data);
        }

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
            id: a.id,
            imageUrl: a.imageUrl,
            aiResponse: safeJsonParse(a.aiResponse),
            createdAt: a.analysisDate
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