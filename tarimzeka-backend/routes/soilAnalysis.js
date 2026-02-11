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
                    content: `Sen bir tarım uzmanısın. Toprak görselini analiz et ve SADECE JSON formatında Türkçe yanıt ver. 
Tüm açıklamaları, değerleri ve metinleri Türkçe yaz.
Hiçbir açıklama, markdown, veya ekstra metin OLMADAN sadece JSON döndür.

JSON formatı şu şekilde olmalı (TÜM DEĞERLER TÜRKÇE):
{
  "soilType": "Killi toprak / Kumlu toprak / Tınlı toprak vb.",
  "soilColor": "Koyu kahverengi / Açık kahverengi vb.",
  "moistureLevel": "Çok kuru / Kuru / Orta / Nemli / Islak",
  "moisturePercentage": 45,
  "organicMatter": {
    "level": "Düşük / Orta / Yüksek",
    "percentage": 2.5,
    "description": "Organik madde durumu hakkında Türkçe açıklama"
  },
  "structure": {
    "type": "Granüler / Blok / Levhamsı vb.",
    "quality": "İyi / Orta / Zayıf",
    "description": "Toprak yapısı hakkında Türkçe açıklama"
  },
  "texture": {
    "class": "Killi / Kumlu / Tınlı / Killi-tın vb.",
    "sandPercentage": 30,
    "clayPercentage": 40,
    "siltPercentage": 30
  },
  "drainage": {
    "status": "İyi / Orta / Zayıf",
    "description": "Drenaj durumu hakkında Türkçe açıklama"
  },
  "ph": {
    "estimated": 6.8,
    "status": "Asidik / Nötr / Bazik",
    "description": "pH seviyesi hakkında Türkçe açıklama"
  },
  "nutrients": {
    "nitrogen": "Düşük / Orta / Yüksek",
    "phosphorus": "Düşük / Orta / Yüksek",
    "potassium": "Düşük / Orta / Yüksek",
    "description": "Besin elementi durumu hakkında Türkçe açıklama"
  },
  "irrigation": {
    "currentNeed": "Acil / Yakında / Normal / Gerek yok",
    "recommendedMethod": "Damla sulama / Yağmurlama / Salma sulama vb.",
    "frequency": "Günlük / Haftada 2-3 kez / Haftada 1 kez vb.",
    "amount": "20-30 mm / 40-50 litre/m² vb.",
    "bestTime": "Sabah erken saatler / Akşam saatleri vb.",
    "warnings": ["Türkçe uyarı 1", "Türkçe uyarı 2"]
  },
  "fertilization": {
    "needed": true,
    "recommendations": [{
      "type": "Azotlu / Fosforlu / Potasyumlu / Kompoze gübre",
      "product": "20-20-0 NPK / Amonyum nitrat vb.",
      "amount": "100-150 kg/dekar",
      "timing": "Ekimden önce / Büyüme döneminde vb.",
      "method": "Toprağa karıştırarak / Yaprak gübrelemesi vb."
    }],
    "organicOptions": ["Ahır gübresi", "Kompost", "Yeşil gübre vb."]
  },
  "suitableCrops": {
    "excellent": [
      {
        "name": "Domates",
        "reason": "Bu ürünün bu toprakta yetişme sebebi (Türkçe)",
        "tips": "Yetiştirme ipuçları (Türkçe)"
      }
    ],
    "good": [
      {
        "name": "Biber",
        "reason": "Uygun olma sebebi (Türkçe)",
        "precautions": "Dikkat edilmesi gerekenler (Türkçe)"
      }
    ],
    "notRecommended": [
      {
        "name": "Patates",
        "reason": "Önerilmeme sebebi (Türkçe)"
      }
    ]
  },
  "soilImprovement": {
    "shortTerm": [
      "Kısa vadeli öneri 1 (Türkçe)",
      "Kısa vadeli öneri 2 (Türkçe)"
    ],
    "longTerm": [
      "Uzun vadeli öneri 1 (Türkçe)",
      "Uzun vadeli öneri 2 (Türkçe)"
    ],
    "priority": "En öncelikli yapılması gereken (Türkçe)"
  },
  "problems": [{
    "type": "Sorun türü (Türkçe)",
    "severity": "Düşük / Orta / Yüksek",
    "description": "Sorun açıklaması (Türkçe)",
    "solution": "Çözüm önerisi (Türkçe)"
  }],
  "overallScore": {
    "value": 75,
    "label": "Çok İyi / İyi / Orta / Zayıf / Çok Zayıf",
    "summary": "Genel değerlendirme özeti (Türkçe)"
  },
  "confidence": 85,
  "additionalNotes": "Ek notlar ve öneriler (Türkçe)"
}

ÖNEMLİ: Tüm metin alanlarını Türkçe doldur. İngilizce kelime kullanma.`
                }, {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Bu toprak görselini detaylı şekilde analiz et. Tüm açıklamaları Türkçe yaz. SADECE JSON formatında yanıt ver, başka hiçbir şey yazma.'
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