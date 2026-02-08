# TarımZeka Mobile

React Native + Expo ile geliştirilmiş mobil uygulama.

## Yapı

```
tarimzeka-mobile/
├── app/                    # Sayfalar (file-based routing)
│   ├── _layout.tsx         # Root layout
│   ├── index.tsx           # Splash/yönlendirme
│   ├── login.tsx           # Giriş
│   ├── register.tsx        # Kayıt
│   ├── forgot-password.tsx # Şifre unutma
│   ├── reset-password.tsx  # Şifre sıfırlama
│   ├── add-field.tsx       # Tarla ekleme
│   ├── edit-field.tsx      # Tarla düzenleme
│   ├── soil-analysis.tsx   # Toprak analizi
│   ├── irrigation-schedule.tsx # Sulama detayı
│   └── (tabs)/             # Tab navigator
│       ├── _layout.tsx
│       ├── index.tsx       # Ana sayfa
│       ├── fields.tsx      # Tarlalarım
│       ├── calendar.tsx    # Sulama takvimi
│       ├── notifications.tsx # Bildirimler
│       ├── savings.tsx     # Tasarruf
│       └── settings.tsx    # Ayarlar
├── components/             # Ortak bileşenler
│   ├── LocationPicker.tsx  # Harita seçici
│   └── ui/                 # UI bileşenleri
├── context/
│   ├── AuthContext.js      # Kimlik doğrulama
│   └── ThemeContext.js     # Tema (açık/koyu)
├── hooks/                  # Custom hooks
├── constants/
│   └── theme.ts            # Renk paleti
└── config.js               # API URL yapılandırması
```

## Özellikler

- **Kimlik Doğrulama**: JWT tabanlı giriş/kayıt
- **Tarla Yönetimi**: Ekleme, düzenleme, silme
- **Konum Seçici**: Harita üzerinde tarla konumu
- **AI Toprak Analizi**: Kameradan görsel çekip analiz
- **Sulama Takvimi**: Tarih bazlı görüntüleme
- **Bildirimler**: Sulama hatırlatmaları
- **Tasarruf Takibi**: Su ve para tasarrufu
- **Tema Desteği**: Açık/koyu mod

## Komutlar

```bash
npm start           # Expo dev server
npm run android     # Android'de aç
npm run ios         # iOS'ta aç
npm run web         # Web'de aç
```

## Yapılandırma

`config.js` dosyasında API URL'ini ayarlayın:

```javascript
// Lokal geliştirme
export const API_URL = 'http://192.168.x.x:3000/api';

// Production
export const API_URL = 'https://tarimzeka-api.onrender.com/api';
```

## Bağımlılıklar

- Expo SDK 54
- React Native 0.81.5
- expo-router 6.x
- react-native-maps
- expo-location
- expo-image-picker
- AsyncStorage

## Gereksinimler

- Node.js 18+
- Expo Go uygulaması (test için)
- Android Studio / Xcode (emülatör için)
