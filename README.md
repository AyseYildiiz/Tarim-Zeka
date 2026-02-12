# TarımZeka

Yapay zeka destekli akıllı tarım platformu

Tarım sektörü Türkiye'nin su tüketiminin yaklaşık %70'ini oluşturuyor.

TarımZeka Türkiye'nin tarım sektöründe su verimliliğini artırmayı hedefliyor.

Mobil uygulama, toprak tipini, hava koşullarını ve ürün çeşidini değerlendirmek için yapay zeka kullanıyor, yüklenen fotoğraflardan toprak analizi yapıyor ve çiftçiler için hassas su miktarı önerileriyle kişiselleştirilmiş sulama programları oluşturuyor.

• Tech Stack: React Native (Expo), Node.js/Express, TypeScript, Prisma ORM, PostgreSQL

Tarım Zeka Tanıtım Videosu:
https://youtube.com/shorts/XsgvebtxJwU

<img width="1080" height="764" alt="TarımZeka" src="https://github.com/user-attachments/assets/52c6226c-1f91-49f0-8c82-0a8c835e811b" />


## Proje Yapısı

```
TarımZeka/
├── tarimzeka-backend/    # Node.js/Express API
└── tarimzeka-mobile/     # React Native/Expo mobil uygulama
```

## Özellikler

- **AI Toprak Analizi**: Görsel tabanlı toprak analizi (GPT-4 Vision)
- **Akıllı Sulama Takvimi**: Hava durumu ve ürün bazlı otomatik sulama planlaması
- **50+ Ürün Desteği**: Detaylı ürün profilleri ve su ihtiyaçları
- **Hava Durumu Entegrasyonu**: OpenWeatherMap ile gerçek zamanlı veriler
- **Su Tasarrufu Takibi**: Haftalık/aylık tasarruf raporları
- **Bildirim Sistemi**: Sulama hatırlatmaları, hava uyarıları

## Teknolojiler

### Backend
- Node.js + Express
- PostgreSQL + Prisma ORM
- JWT Authentication
- Cloudinary (görsel depolama)
- OpenAI GPT-4 Vision
- OpenWeatherMap API

### Mobile
- React Native + Expo SDK 54
- expo-router (file-based routing)
- AsyncStorage
- expo-location, expo-image-picker

## Kurulum

### Backend
```bash
cd tarimzeka-backend
npm install
npx prisma generate
npx prisma migrate deploy
npm start
```

### Mobile
```bash
cd tarimzeka-mobile
npm install
npx expo start
```

## Ortam Değişkenleri

Backend için `.env` dosyası:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
OPENAI_API_KEY=sk-...
OPENWEATHER_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

## Deployment

- **Backend**: Render.com (https://tarimzeka-api.onrender.com)
- **Database**: Render PostgreSQL

## Lisans

MIT License
