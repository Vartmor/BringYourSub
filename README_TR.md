# BringYourSub - Yapay Zeka Destekli YouTube Altyazı Oluşturucu

<div align="center">

![BringYourSub Logo](bringyoursub-chrome/icons/icon128.png)

**Kendi OpenAI API anahtarınızı kullanarak YouTube videoları için yüksek kaliteli, bağlama duyarlı çeviri altyazıları oluşturun.**

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome](https://img.shields.io/badge/Chrome-Eklenti-4285F4?logo=googlechrome&logoColor=white)](https://github.com)
[![Firefox](https://img.shields.io/badge/Firefox-Eklenti-FF7139?logo=firefox&logoColor=white)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[🇬🇧 English](README.md)

</div>

---

## 📑 İçindekiler

- [Özellikler](#-özellikler)
- [Ekran Görüntüleri](#-ekran-görüntüleri)
- [Kurulum](#-kurulum)
- [Kullanım](#-kullanım)
- [Geliştirme](#️-geliştirme)
- [Geri Bildirim](#geri-bildirim)
- [Güvenlik](#-güvenlik)
- [Lisans](#-lisans)

---

## ✨ Özellikler

### 🔐 Gizlilik Öncelikli (BYOK)
API anahtarınız tarayıcınızda kalır. Arka uç sunucusu yok, veri toplama yok, izleme yok.

### 🧠 Bağlam Kilitli Çeviri
Cümle cümle çeviri yerine, BringYourSub önce tüm video bağlamını analiz eder ve şu özellikleri sağlar:
- Baştan sona tutarlı terminoloji
- Doğal akan çeviriler
- Teknik terimlerin doğru işlenmesi

### 🎙️ Whisper Yedeği
Videoda altyazı yok mu? Sorun değil. Otomatik olarak OpenAI'nin ses transkripsiyonu için Whisper'a geçer.

### 🌍 Çoklu Dil Desteği
- Türkçe
- Almanca
- İspanyolca
- Fransızca
- İtalyanca

### 🎨 Modern Arayüz
Yumuşak animasyonlar ve sezgisel kontrollerle şık koyu mod arayüzü.

---

## 📸 Ekran Görüntüleri

### Eklenti Popup'ı
<!-- Ekran görüntüsü ekleyin: popup arayüzü -->
![Eklenti Popup'ı](docs/screenshots/popup.png)

### Altyazı Oluşturma
<!-- Ekran görüntüsü ekleyin: altyazı oluşturma işlemi -->
![Altyazı Oluşturma](docs/screenshots/generation.png)

### YouTube Overlay
<!-- Ekran görüntüsü ekleyin: YouTube'da görünen altyazılar -->
![YouTube Overlay](docs/screenshots/overlay.png)

---

## 📦 Kurulum

### Ön Koşullar

Kurulumdan önce aşağıdakilere sahip olduğunuzdan emin olun:
- **OpenAI API Anahtarı** - [platform.openai.com](https://platform.openai.com/api-keys) adresinden alın

### Yöntem 1: Hazır Eklenti (Önerilen)

#### Google Chrome / Chromium Tabanlı Tarayıcılar (Edge, Brave, Opera, Vivaldi)

1. [Releases](https://github.com/Vartmor/bringyoursub/releases) sayfasından son sürümü indirin
2. ZIP dosyasını bir klasöre çıkarın
3. Tarayıcınızı açın ve eklentiler sayfasına gidin:
   - **Chrome**: Adres çubuğuna `chrome://extensions/` yazın
   - **Edge**: Adres çubuğuna `edge://extensions/` yazın
   - **Brave**: Adres çubuğuna `brave://extensions/` yazın
4. **Geliştirici modu**'nu etkinleştirin (sağ üst köşedeki anahtar)
5. **Paketsiz yükle** butonuna tıklayın
6. `bringyoursub-chrome/dist` klasörünü seçin
7. Eklenti simgesi araç çubuğunuzda görünecektir

#### Mozilla Firefox

1. [Releases](https://github.com/Vartmor/bringyoursub/releases) sayfasından son sürümü indirin
2. ZIP dosyasını bir klasöre çıkarın
3. Firefox'u açın ve adres çubuğuna `about:debugging` yazın
4. Sol kenar çubuğunda **Bu Firefox** seçeneğine tıklayın
5. **Geçici Eklenti Yükle** butonuna tıklayın
6. `bringyoursub-firefox/dist` klasörüne gidin ve `manifest.json` dosyasını seçin
7. Eklenti simgesi araç çubuğunuzda görünecektir

> **Not:** Firefox geçici eklentileri tarayıcı kapatıldığında kaldırılır. Kalıcı kurulum için eklentinin Mozilla tarafından imzalanması gerekir.

### Yöntem 2: Kaynaktan Derleme

#### Gereksinimler
- Node.js 18 veya üstü
- npm (Node.js ile birlikte gelir)

#### Windows

1. Komut İstemi veya PowerShell'i açın
2. Depoyu klonlayın:
   ```cmd
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Bağımlılıkları yükleyin:
   ```cmd
   npm install
   ```
4. Eklentileri derleyin:
   ```cmd
   npm run build
   ```
5. Eklentiyi yüklemek için yukarıdaki tarayıcıya özel talimatları izleyin:
   - Chrome: `bringyoursub-chrome/dist`
   - Firefox: `bringyoursub-firefox/dist/manifest.json`

#### macOS

1. Terminal'i açın
2. Depoyu klonlayın:
   ```bash
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
4. Eklentileri derleyin:
   ```bash
   npm run build
   ```
5. Eklentiyi yüklemek için yukarıdaki tarayıcıya özel talimatları izleyin

#### Linux

1. Terminal'i açın
2. Depoyu klonlayın:
   ```bash
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
4. Eklentileri derleyin:
   ```bash
   npm run build
   ```
5. Eklentiyi yüklemek için yukarıdaki tarayıcıya özel talimatları izleyin

---

## 🚀 Kullanım

1. **OpenAI API Anahtarı Alın**
   - [platform.openai.com](https://platform.openai.com/api-keys) adresini ziyaret edin
   - Yeni bir API anahtarı oluşturun

2. **Bir YouTube Videosu Açın**
   - Herhangi bir YouTube videosuna gidin

3. **Eklenti Simgesine Tıklayın**
   - API anahtarınızı girin
   - Hedef dili seçin
   - "Altyazı Oluştur" butonuna tıklayın

4. **Dışa Aktar**
   - Panoya kopyalayın veya .SRT dosyası olarak indirin

---

## 🛠️ Geliştirme

### Komutlar

```bash
# Bağımlılıkları yükle
npm install

# Üretim için derle
npm run build

# İzleme modu (geliştirme)
npm run watch
```

### Proje Yapısı

```
bringyoursub/
├── bringyoursub-chrome/    # Chrome eklentisi (MV3)
│   ├── extension/
│   │   ├── background/     # Service worker
│   │   ├── content/        # İçerik betikleri
│   │   └── popup/          # Popup arayüzü
│   ├── shared/
│   │   └── ai-core/        # AI pipeline modülleri
│   └── manifest.json
├── bringyoursub-firefox/   # Firefox eklentisi (MV2)
├── build.mjs               # esbuild yapılandırması
├── package.json
└── tsconfig.json
```

---

## Geri Bildirim

Öneriniz mi var veya bir hata mı buldunuz? Lütfen [GitHub](https://github.com/Vartmor/bringyoursub/issues) üzerinde bir issue açın.

Daha fazla bilgi için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

---

## 🔒 Güvenlik

Bu eklenti **Kendi Anahtarını Getir (BYOK)** mimarisini kullanır. API anahtarınız:
- Tarayıcınızda yerel olarak saklanır
- OpenAI'nin API'si haricinde hiçbir sunucuya gönderilmez
- Asla kaydedilmez veya izlenmez

Daha fazla bilgi için [SECURITY.md](SECURITY.md) dosyasına bakın.

---

## 📜 Lisans

MIT Lisansı - Muhammed Köseoğlu

Daha fazla bilgi için [LICENSE](LICENSE) dosyasına bakın.

---

## Teşekkürler

- GPT ve Whisper API'leri için [OpenAI](https://openai.com)

---

<div align="center">
Topluluk için ❤️ ile yapıldı
</div>
