# BringYourSub - Yapay Zeka Destekli YouTube Altyazı Oluşturucu

<div align="center">

![BringYourSub Logo](bringyoursub-chrome/icons/icon128.png)

**Kendi OpenAI API anahtarınızı kullanarak YouTube videoları için yüksek kaliteli, bağlama duyarlı çeviri altyazıları oluşturun.**

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome](https://img.shields.io/badge/Chrome-Eklenti-4285F4?logo=googlechrome&logoColor=white)](https://github.com)
[![Firefox](https://img.shields.io/badge/Firefox-Eklenti-FF7139?logo=firefox&logoColor=white)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Ozellikler](#ozellikler) | [Kurulum](#kurulum) | [Kullanim](#kullanim) | [Gelistirme](#gelistirme)

</div>

---

## Ozellikler

### Gizlilik Oncelikli (BYOK)
API anahtarınız tarayıcınızda kalır. Arka uç sunucusu yok, veri toplama yok, izleme yok.

### Baglam Kilitli Ceviri
Cumle cumle ceviri yerine, BringYourSub once tum video baglamını analiz eder ve su ozellikleri saglar:
- Bastan sona tutarlı terminoloji
- Dogal akan ceviriler
- Teknik terimlerin dogru islenmesi

### Whisper Yedegi
Videoda altyazı yok mu? Sorun degil. Otomatik olarak OpenAI'nin ses transkripsiyonu icin Whisper'a gecer.

### Coklu Dil Destegi
- Turkce
- Almanca
- Ispanyolca
- Fransızca
- Italyanca

### Modern Arayuz
Yumusak animasyonlar ve sezgisel kontrollerle sik koyu mod arayuzu.

---

## Kurulum

### On Kosullar

Kurulumdan once asagıdakilere sahip oldugunuzdan emin olun:
- **OpenAI API Anahtarı** - [platform.openai.com](https://platform.openai.com/api-keys) adresinden alın

### Yontem 1: Hazır Eklenti (Onerilen)

#### Google Chrome / Chromium Tabanli Tarayicilar (Edge, Brave, Opera, Vivaldi)

1. [Releases](https://github.com/Vartmor/bringyoursub/releases) sayfasından son surumu indirin
2. ZIP dosyasını bir klasore cıkarın
3. Tarayıcınızı acın ve eklentiler sayfasına gidin:
   - **Chrome**: Adres cubuguna `chrome://extensions/` yazın
   - **Edge**: Adres cubuguna `edge://extensions/` yazın
   - **Brave**: Adres cubuguna `brave://extensions/` yazın
4. **Gelistirici modu**'nu etkinlestirin (sag ust kosedeki anahtar)
5. **Paketsiz yukle** butonuna tıklayın
6. `bringyoursub-chrome/dist` klasorunu secin
7. Eklenti simgesi arac cubugunuzda gorunecektir

#### Mozilla Firefox

1. [Releases](https://github.com/Vartmor/bringyoursub/releases) sayfasından son surumu indirin
2. ZIP dosyasını bir klasore cıkarın
3. Firefox'u acın ve adres cubuguna `about:debugging` yazın
4. Sol kenar cubugunda **Bu Firefox** secenegine tıklayın
5. **Gecici Eklenti Yukle** butonuna tıklayın
6. `bringyoursub-firefox/dist` klasorune gidin ve `manifest.json` dosyasını secin
7. Eklenti simgesi arac cubugunuzda gorunecektir

> Not: Firefox gecici eklentileri tarayıcı kapatıldıgında kaldırılır. Kalıcı kurulum icin eklentinin Mozilla tarafından imzalanması gerekir.

### Yontem 2: Kaynaktan Derleme

#### Gereksinimler
- Node.js 18 veya ustü
- npm (Node.js ile birlikte gelir)

#### Windows

1. Komut Istemi veya PowerShell'i acın
2. Depoyu klonlayın:
   ```cmd
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Bagımlılıkları yukleyin:
   ```cmd
   npm install
   ```
4. Eklentileri derleyin:
   ```cmd
   npm run build
   ```
5. Eklentiyi yuklemek icin yukarıdaki tarayıcıya ozel talimatları izleyin:
   - Chrome: `bringyoursub-chrome/dist`
   - Firefox: `bringyoursub-firefox/dist/manifest.json`

#### macOS

1. Terminal'i acın
2. Depoyu klonlayın:
   ```bash
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Bagımlılıkları yukleyin:
   ```bash
   npm install
   ```
4. Eklentileri derleyin:
   ```bash
   npm run build
   ```
5. Eklentiyi yuklemek icin yukarıdaki tarayıcıya ozel talimatları izleyin

#### Linux

1. Terminal'i acın
2. Depoyu klonlayın:
   ```bash
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Bagımlılıkları yukleyin:
   ```bash
   npm install
   ```
4. Eklentileri derleyin:
   ```bash
   npm run build
   ```
5. Eklentiyi yuklemek icin yukarıdaki tarayıcıya ozel talimatları izleyin

---

## Kullanim

1. **OpenAI API Anahtarı Alın**
   - [platform.openai.com](https://platform.openai.com/api-keys) adresini ziyaret edin
   - Yeni bir API anahtarı olusturun

2. **Bir YouTube Videosu Acın**
   - Herhangi bir YouTube videosuna gidin

3. **Eklenti Simgesine Tıklayın**
   - API anahtarınızı girin
   - Hedef dili secin
   - "Altyazı Olustur" butonuna tıklayın

4. **Dısa Aktar**
   - Panoya kopyalayın veya .SRT dosyası olarak indirin

---

## Gelistirme

### Komutlar

```bash
# Bagımlılıkları yukle
npm install

# Uretim icin derle
npm run build

# Izleme modu (gelistirme)
npm run watch
```

### Proje Yapisi

```
bringyoursub/
├── bringyoursub-chrome/    # Chrome eklentisi (MV3)
│   ├── extension/
│   │   ├── background/     # Service worker
│   │   ├── content/        # Icerik betikleri
│   │   └── popup/          # Popup arayuzu
│   ├── shared/
│   │   └── ai-core/        # AI pipeline modulleri
│   └── manifest.json
├── bringyoursub-firefox/   # Firefox eklentisi (MV2)
├── build.mjs               # esbuild yapılandırması
├── package.json
└── tsconfig.json
```

---

## Geri Bildirim

Oneriniz mi var veya bir hata mı buldunuz? Lutfen [GitHub](https://github.com/Vartmor/bringyoursub/issues) uzerinde bir issue acın.

Daha fazla bilgi icin [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

---

## Guvenlik

Bu eklenti **Kendi Anahtarını Getir (BYOK)** mimarisini kullanır. API anahtarınız:
- Tarayıcınızda yerel olarak saklanır
- OpenAI'nin API'si haricinde hicbir sunucuya gonderilmez
- Asla kaydedilmez veya izlenmez

Daha fazla bilgi icin [SECURITY.md](SECURITY.md) dosyasına bakın.

---

## Lisans

MIT Lisansı - Muhammed Koseoglu

Daha fazla bilgi icin [LICENSE](LICENSE) dosyasına bakın.

---

## Tesekkurler

- GPT ve Whisper API'leri icin [OpenAI](https://openai.com)

---

<div align="center">
Topluluk icin yapıldı
</div>
