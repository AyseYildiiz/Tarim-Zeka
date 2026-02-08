# TarımZeka Backend

Express.js tabanlı REST API servisi.

## Yapı

```
tarimzeka-backend/
├── server.js              # Ana giriş noktası
├── config/
│   └── database.js        # Prisma client
├── middleware/
│   └── auth.js            # JWT authentication
├── routes/
│   ├── auth.js            # Kayıt, giriş, şifre sıfırlama
│   ├── fields.js          # Tarla CRUD
│   ├── irrigation.js      # Sulama takvimi
│   ├── location.js        # Konum arama
│   ├── notifications.js   # Bildirimler
│   ├── savings.js         # Tasarruf verileri
│   ├── soilAnalysis.js    # AI toprak analizi
│   ├── users.js           # Kullanıcı profili
│   └── weather.js         # Hava durumu
├── services/
│   ├── irrigation.js      # Sulama iş mantığı, 50+ ürün profili
│   └── notification.js    # Bildirim oluşturma
├── utils/
│   └── helpers.js         # Yardımcı fonksiyonlar
└── prisma/
    └── schema.prisma      # Veritabanı şeması
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Kayıt
- `POST /api/auth/login` - Giriş
- `POST /api/auth/forgot-password` - Şifre sıfırlama maili
- `POST /api/auth/reset-password` - Şifre sıfırlama

### Fields
- `GET /api/fields` - Tüm tarlalar
- `POST /api/fields` - Tarla ekle
- `GET /api/fields/:id` - Tarla detayı
- `PUT /api/fields/:id` - Tarla güncelle
- `DELETE /api/fields/:id` - Tarla sil
- `POST /api/fields/:fieldId/calculate-irrigation-schedule` - Sulama hesapla

### Irrigation
- `GET /api/irrigation/schedules` - Sulama takvimi
- `PATCH /api/irrigation/schedules/:id` - Durum güncelle
- `POST /api/irrigation/log` - Manuel sulama kaydı

### Soil Analysis
- `POST /api/soil-analysis` - AI analiz (görsel yükle)
- `GET /api/soil-analysis/history` - Analiz geçmişi
- `GET /api/soil-analysis/:id` - Analiz detayı

### Weather
- `GET /api/weather/current` - Anlık hava durumu
- `GET /api/weather/forecast` - 7 günlük tahmin

### Others
- `GET /api/savings` - Tasarruf özeti
- `GET /api/notifications` - Bildirimler
- `GET /api/users/me` - Kullanıcı profili
- `GET /api/health` - Sağlık kontrolü

## Veritabanı Modelleri

- **User**: Kullanıcı bilgileri
- **Field**: Tarla (konum, toprak tipi, ürün)
- **SoilAnalysis**: AI toprak analizi sonuçları
- **IrrigationSchedule**: Planlı sulamalar
- **IrrigationLog**: Gerçekleşen sulamalar
- **Notification**: Bildirimler
- **WeatherCache**: Hava durumu önbelleği

## Komutlar

```bash
npm start           # Production
npm run dev         # Development (nodemon)
npm run build       # Prisma generate + migrate
npx prisma studio   # Veritabanı görüntüleyici
```

## Desteklenen Ürünler

Buğday, Arpa, Mısır, Ayçiçeği, Pamuk, Soya, Şeker Pancarı, Patates, Domates, Biber, Patlıcan, Salatalık, Kabak, Kavun, Karpuz, Soğan, Sarımsak, Havuç, Marul, Ispanak, Lahana, Brokoli, Karnabahar, Fasulye, Nohut, Mercimek, Bakla, Bezelye, Çilek, Üzüm, Elma, Armut, Şeftali, Kayısı, Kiraz, Erik, İncir, Nar, Ceviz, Badem, Fındık, Zeytin, Çay, Tütün, Lavanta, Nane, Fesleğen, Kekik, Biberiye, Maydanoz
