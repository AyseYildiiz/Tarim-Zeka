const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Location search with Nominatim
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Arama terimi en az 2 karakter olmalı' });
        }

        const searchStrategies = [
            { q: query, format: 'json', addressdetails: 1, limit: 25, countrycodes: 'tr', 'accept-language': 'tr', namedetails: 1, extratags: 1, dedupe: 0 },
            { q: `${query}, Türkiye`, format: 'json', addressdetails: 1, limit: 15, countrycodes: 'tr', 'accept-language': 'tr', namedetails: 1, extratags: 1, dedupe: 0 }
        ];

        let allResults = [];

        for (const params of searchStrategies) {
            try {
                const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params,
                    headers: { 'User-Agent': 'TarimZeka-App/1.0 (Agricultural Mobile Application)', 'Accept': 'application/json' },
                    timeout: 10000
                });

                if (response.data && response.data.length > 0) {
                    allResults = [...allResults, ...response.data];
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                // Continue with next strategy
            }
        }

        // Deduplicate
        const uniqueMap = new Map();
        allResults.forEach(item => {
            if (!uniqueMap.has(item.place_id)) {
                uniqueMap.set(item.place_id, item);
            }
        });
        allResults = Array.from(uniqueMap.values());

        const results = allResults.map((item, index) => {
            const address = item.address || {};
            const nameDetails = item.namedetails || {};
            const itemType = item.type?.toLowerCase() || '';
            const itemClass = item.class?.toLowerCase() || '';

            let type = 'place';
            let category = '';

            // Type classification
            if (itemClass === 'amenity') {
                type = 'poi';
                const amenityTypes = {
                    'hospital': 'Hastane', 'clinic': 'Klinik', 'pharmacy': 'Eczane', 'school': 'Okul',
                    'university': 'Üniversite', 'bank': 'Banka', 'mosque': 'Cami', 'restaurant': 'Restoran',
                    'cafe': 'Kafe', 'fuel': 'Benzin İstasyonu', 'parking': 'Otopark'
                };
                category = amenityTypes[itemType] || 'Tesis';
            } else if (itemClass === 'shop') {
                type = 'poi';
                category = 'Mağaza';
            } else if (itemClass === 'building') {
                type = 'building';
                category = 'Bina';
            } else if (itemClass === 'highway' || ['street', 'road', 'residential', 'primary', 'secondary'].includes(itemType)) {
                type = 'street';
                category = 'Sokak/Cadde';
            } else if (itemType === 'neighbourhood' || itemType === 'suburb') {
                type = 'neighborhood';
                category = 'Mahalle';
            } else if (itemType === 'town' || itemType === 'village') {
                type = 'district';
                category = 'İlçe';
            } else if (itemType === 'city' || itemType === 'administrative') {
                type = 'city';
                category = 'Şehir';
            }

            let title = nameDetails.name || item.name || '';
            if (!title) {
                if (type === 'street') title = address.road || 'Bilinmeyen Sokak';
                else if (type === 'neighborhood') title = address.neighbourhood || address.suburb || 'Bilinmeyen Mahalle';
                else if (type === 'district') title = address.town || address.village || 'Bilinmeyen İlçe';
                else if (type === 'city') title = address.city || address.state || 'Bilinmeyen Şehir';
                else title = item.display_name?.split(',')[0] || query;
            }

            const subtitleParts = [];
            if (category && type !== 'city' && type !== 'district') subtitleParts.push(category);
            if (address.road && type !== 'street') subtitleParts.push(address.road);
            if (address.neighbourhood && type !== 'neighborhood') subtitleParts.push(address.neighbourhood);
            if ((address.town || address.village) && type !== 'district') subtitleParts.push(address.town || address.village);
            if ((address.city || address.state) && type !== 'city') {
                const city = address.city || address.state;
                if (!subtitleParts.includes(city)) subtitleParts.push(city);
            }

            return {
                id: `${item.place_id}-${index}`,
                title,
                subtitle: subtitleParts.filter(p => p && p !== title).join(', ') || 'Türkiye',
                fullAddress: item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                type,
                category,
                importance: item.importance || 0
            };
        });

        // Sort by relevance
        const lowerQuery = query.toLowerCase();
        results.sort((a, b) => {
            const aExact = a.title.toLowerCase() === lowerQuery ? 1 : 0;
            const bExact = b.title.toLowerCase() === lowerQuery ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;

            const aStarts = a.title.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
            const bStarts = b.title.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            const typeOrder = { poi: 0, building: 1, street: 2, neighborhood: 3, district: 4, city: 5, place: 6 };
            return (typeOrder[a.type] || 6) - (typeOrder[b.type] || 6);
        });

        // Remove duplicates
        const uniqueResults = [];
        const seen = new Set();
        for (const result of results) {
            const key = `${result.title.toLowerCase()}-${result.type}-${result.subtitle.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueResults.push(result);
            }
        }

        res.json(uniqueResults.slice(0, 20));
    } catch (error) {
        res.status(500).json({ error: 'Konum araması başarısız' });
    }
});

// Reverse geocoding
router.get('/reverse', authenticateToken, async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Koordinatlar gerekli' });
        }

        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat, lon, format: 'json', addressdetails: 1, 'accept-language': 'tr', zoom: 18 },
            headers: { 'User-Agent': 'TarimZeka-App/1.0 (Agricultural Mobile Application)' },
            timeout: 10000
        });

        const data = response.data;
        const address = data.address || {};

        const addressParts = [];
        if (address.road) addressParts.push(address.road);
        if (address.house_number) addressParts.push(`No: ${address.house_number}`);
        if (address.neighbourhood) addressParts.push(address.neighbourhood);
        if (address.suburb && address.suburb !== address.neighbourhood) addressParts.push(address.suburb);
        if (address.village || address.town) addressParts.push(address.village || address.town);
        if (address.county) addressParts.push(address.county);
        if (address.city || address.state || address.province) {
            const city = address.city || address.state || address.province;
            if (!addressParts.includes(city)) addressParts.push(city);
        }

        const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : data.display_name || `${lat}, ${lon}`;

        res.json({
            address: formattedAddress,
            fullAddress: data.display_name,
            details: {
                road: address.road,
                houseNumber: address.house_number,
                neighborhood: address.neighbourhood || address.suburb,
                village: address.village,
                town: address.town,
                district: address.county,
                city: address.city || address.state || address.province,
                country: address.country,
                postcode: address.postcode
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Adres bulunamadı' });
    }
});

module.exports = router;
