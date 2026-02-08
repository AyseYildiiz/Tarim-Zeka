# 🌾 TarımZeka - Yapay Zeka Destekli Sulama Takvimi

## Yeni Özellik: Akıllı Sulama Takvimi

Bu belgede, TarımZeka uygulamasına eklenen yapay zeka destekli sulama takvimi özelliğini açıklamaktadır.

---

## 📋 Özellik Özeti

**Akıllı Sulama Takvimi**, tarlanın konumu, ekilecek ürün, toprak türü ve gerçek zamanlı hava durumu verilerine dayanarak sulama takvimi oluşturur.

### Temel Özellikler:
- 🌤️ **Hava Durumu Analizi**: OpenWeatherMap API üzerinden 5 günlük hava tahmini
- 🌱 **Ürüne Göre Hesaplama**: 14 farklı ürün için optimize edilmiş su ihtiyacı
- 🌍 **Toprak Türü Düzeltmesi**: Kumlu, killi, tınlı vb. toprak türlerine göre ayarlama
- ☀️ **Sıcaklık Tabanlı Ayarlama**: Sıcaklık değişikliklerine göre su miktarının ayarlanması
- 💧 **Nem Oranı Analizi**: Havadaki nem oranına göre sulama miktarının minimize edilmesi
- 🌧️ **Yağmur Tahmini**: Beklenen yağmura göre sulama atlanması veya azaltılması
- 📊 **Verimlilik Takibi**: Gerçek su kullanımı ve tasarrufu kaydı

---

## 🔧 Teknik Yapı

### Backend Endpoint'leri

#### 1. Hava Durumu Alınız
```bash
GET /api/weather/current?lat=<latitude>&lon=<longitude>
```
**Yanıt:**
```json
{
  "location": "39.5,33.5",
  "latitude": 39.5,
  "longitude": 33.5,
  "temperature": 25.5,
  "humidity": 65,
  "condition": "Açık",
  "precipitation": 0,
  "forecast": [...]
}
```

#### 2. 7 Günlük Hava Tahmini
```bash
GET /api/weather/forecast?lat=<latitude>&lon=<longitude>
```
**Yanıt:**
```json
{
  "forecast": [
    {
      "date": "2/4/2026",
      "avgTemp": 25.5,
      "avgHumidity": 65,
      "totalRain": 0,
      "condition": "Açık",
      "details": [...]
    }
  ]
}
```

#### 3. Sulama Takvimi Hesapla
```bash
POST /api/fields/:fieldId/calculate-irrigation-schedule
```
**Yanıt:**
```json
{
  "message": "Sulama takvimi hesaplandı",
  "schedule": [
    {
      "id": "uuid",
      "date": "2026-02-05T00:00:00Z",
      "recommendedTime": "06:00-08:00",
      "waterAmount": 5.2,
      "weatherTemp": 24.5,
      "weatherHumidity": 68,
      "weatherCondition": "Hafif bulutlu",
      "status": "pending",
      "note": null
    }
  ]
}
```

#### 4. Sulama Tamamlama
```bash
PATCH /api/irrigation/schedule/:scheduleId/complete
Content-Type: application/json

{
  "waterUsed": 5.2,
  "duration": 30,
  "notes": "Başarıyla tamamlandı"
}
```

---

## 🧠 Yapay Zeka Algoritması

### Sulama Takvimi Hesaplama Süreci

```
1. ÜRÜN PROFİLİ SEÇME
   ├─ Temel su ihtiyacı (min-max)
   ├─ Optimal sıcaklık
   ├─ Min-max sıcaklık aralığı
   ├─ Optimal nem oranı
   └─ Diğer parametreler

2. TOPRAK AYARLAMASI
   ├─ Kumlu (1.3x): Su hızlı kayboluyor
   ├─ Killi (0.8x): Su daha iyi tutuluyor
   ├─ Tınlı (1.0x): Dengeleme
   └─ Diğer türler

3. HAVA DURUMU ANALİZİ
   ├─ Günlük ortalama sıcaklık
   ├─ Günlük ortalama nem
   ├─ Tahmini yağış miktarı
   └─ Hava koşulu tahmini

4. SU MİKTARI HESAPLAMASI
   ├─ Temel miktar = (waterMin + waterMax) / 2
   ├─ Sıcaklık faktörü = 1 + (|avgTemp - tempOptimal| / 10) × 0.2
   ├─ Nem faktörü = 1 + ((tempOptimal - avgHumidity) / 100) × 0.3
   ├─ Sonuç = temel × tempFactor × humFactor × soilMul
   └─ Yağmur düzeltmesi: Eğer yağış > 10mm: -50%, 5-10mm: -50%

5. SULAMA ZAMANI SEÇİMİ
   ├─ Çok sıcak (>28°C): 05:00-07:00 (erken)
   ├─ Sıcak (>24°C): 06:00-08:00
   ├─ Normal: 07:00-09:00
   └─ Soğuk (<12°C): 10:00-12:00
```

### Ürün Profilleri

```javascript
{
  'buğday': { waterMin: 3, waterMax: 5, tempOptimal: 20, tempMin: 0, tempMax: 30, humidityOptimal: 45 },
  'domates': { waterMin: 5, waterMax: 8, tempOptimal: 25, tempMin: 15, tempMax: 35, humidityOptimal: 60 },
  'pamuk': { waterMin: 6, waterMax: 8, tempOptimal: 26, tempMin: 18, tempMax: 38, humidityOptimal: 50 },
  'mercimek': { waterMin: 2.5, waterMax: 4, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 40 },
  'arpa': { waterMin: 3, waterMax: 5, tempOptimal: 18, tempMin: 0, tempMax: 28, humidityOptimal: 45 },
  'mısır': { waterMin: 5, waterMax: 7, tempOptimal: 24, tempMin: 15, tempMax: 32, humidityOptimal: 55 },
  'patates': { waterMin: 4, waterMax: 6, tempOptimal: 20, tempMin: 10, tempMax: 28, humidityOptimal: 50 },
  'soğan': { waterMin: 3, waterMax: 5, tempOptimal: 18, tempMin: 8, tempMax: 28, humidityOptimal: 50 },
  'biber': { waterMin: 4.5, waterMax: 7, tempOptimal: 25, tempMin: 15, tempMax: 35, humidityOptimal: 60 },
  'salatalık': { waterMin: 5, waterMax: 7, tempOptimal: 24, tempMin: 18, tempMax: 32, humidityOptimal: 65 },
  'ayçiçeği': { waterMin: 3.5, waterMax: 5.5, tempOptimal: 22, tempMin: 10, tempMax: 32, humidityOptimal: 45 },
  'zeytin': { waterMin: 1.5, waterMax: 3.5, tempOptimal: 21, tempMin: 10, tempMax: 32, humidityOptimal: 35 },
  'üzüm': { waterMin: 2, waterMax: 4.5, tempOptimal: 20, tempMin: 10, tempMax: 30, humidityOptimal: 40 },
  'elma': { waterMin: 2.5, waterMax: 4.5, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 50 }
}
```

---

## 📱 Mobil Uygulamada Kullanım

### Sulama Takvimi Sayfası

1. **Tarla Listesinde**: "Tarlalarım" sekmesinden bir tarlaya tıklayın
2. **Hızlı İşlemler**: "Takvim" butonuna tıklayın
3. **Yeni Takvim Oluşturma**: Sağ üstteki yenile butonuna tıklayın
4. **Sulama Tamamlama**: "Tamamla" butonuna tıklayarak sulamayı işaretleyin

### Sayfa Bileşenleri

- **Tarla Bilgisi**: Ürün türü, toprak türü gibi temel bilgiler
- **Yaklaşan Sulamalar**: Beklemede olan sulama işlemleri
- **Hava Durumu**: Her sulama günü için sıcaklık, nem, koşul
- **Su Miktarı**: L/m² cinsinden tavsiye edilen su miktarı
- **Uyarılar**: Yağmur uyarısı veya özel durumlar
- **Tamamlanan**: Bitirilen sulama işlemleri

---

## 📊 Veri Akışı

```
Mobil App
    ↓
[Tarla Seçimi: fieldId, cropType, soilType]
    ↓
Backend: POST /api/fields/:fieldId/calculate-irrigation-schedule
    ↓
[1] OpenWeatherMap API → 5 günlük hava tahmini
[2] Crop Profile × Weather × Soil Multiplier → AI Hesaplama
[3] Veritabanına Kaydet (IrrigationSchedule)
    ↓
Mobil App
    ↓
[Takvim Görüntüleme ve Sulama Tamamlama]
    ↓
Backend: PATCH /api/irrigation/schedule/:scheduleId/complete
    ↓
[1] Schedule durumu güncelle (completed)
[2] IrrigationLog kaydı oluştur
[3] Su tasarrufu hesapla ve Saving'e kaydet
    ↓
Kullanıcı
    ↓
[Su Tasarrufu İstatistikleri]
```

---

## 🚀 Kurulum ve Başlangıç

### Backend Başlatma

```bash
cd tarimzeka-backend

# .env dosyasını kontrol et
# OPENWEATHER_API_KEY olmalı

# Gerekli paketleri kur
npm install

# Veritabanı migration'ı çalıştır
npx prisma migrate dev

# Sunucuyu başlat
npm run dev
# veya
npm start
```

### Mobil App Başlatma

```bash
cd tarimzeka-mobile

# Gerekli paketleri kur
npm install

# Expo'yu başlat
npm start
# veya
expo start
```

---

## 🔑 Gerekli API Anahtarları

### .env Dosyası (Backend)

```env
# OpenWeatherMap API Key
OPENWEATHER_API_KEY=82d5d68d45c064ef867baef6a69fbba8

# Diğer konfigürasyonlar
DATABASE_URL=postgresql://...
JWT_SECRET=...
OPENAI_API_KEY=...
```

**Not**: OpenWeatherMap API anahtarını [https://openweathermap.org/api](https://openweathermap.org/api) adresinden ücretsiz olarak alabilirsiniz.

---

## 📈 Başarı Metrikleri

Uygulamayı kullanırken izleyebilileceğiniz metrikler:

- **Su Tasarrufu**: Yapay zeka tavsiyesiyle gerçek su kullanımı karşılaştırması
- **Verimlilik**: Tavsiye edilen sulama zamanına uyulma oranı
- **Mahsul Kalitesi**: Sulama takvimi uygulandıktan sonra ürün kalitesi
- **Maliyet Tasarrufu**: Azalan su kullanımından kaynaklanan tasarrufu

---

## 🐛 Sorun Giderme

### "Hava durumu alınamadı" Hatası
- OpenWeatherMap API anahtarını kontrol edin
- Konum koordinatlarının doğru olduğundan emin olun

### "Sulama takvimi hesaplanamadı" Hatası
- Tarlanın konumu (latitude, longitude) ayarlandığından emin olun
- Backend'in çalıştığını kontrol edin

### "Takvim Güncellenemedi" Hatası
- İnternet bağlantısını kontrol edin
- Token'ın geçerli olduğundan emin olun

---

## 📝 Notlar

- Sulama takvimi 5 günlük hava tahminini kullanır
- Su miktarları litre/m² cinsinden verilir
- Algoritma dünyadaki en yaygın tarım ürünleri için optimize edilmiştir
- Hava durumu verileri 30 dakikada bir cache'lenir

---

## 📞 Destek

Herhangi bir sorun veya öneriniz için lütfen bildirin.

---

**Son Güncelleme**: 4 Şubat 2026  
**Versiyon**: 1.0.0
