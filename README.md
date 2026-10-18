# 🏝️ Drotch — Dynamic Island & Living Companion for Windows

<p align="center">
  <img src="icons/icon.ico" width="80" height="80" alt="Drotch Logo" />
</p>

<p align="center">
  <strong>Dynamic Island desktop widget yang elegan, interaktif, dan responsif untuk Windows 10 & 11.</strong><br>
  Dibangun dengan <strong>Tauri v2 (Rust)</strong> + <strong>React 18</strong> + <strong>TypeScript</strong>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/Tauri-v2.0-FFC131?logo=tauri&logoColor=black" alt="Tauri" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Rust-1.78+-DEA584?logo=rust&logoColor=black" alt="Rust" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## ✨ Fitur Unggulan

### 1. 🐱 Living Companion (Mata Interaktif)
- **Real-Time Mouse Tracking**: Mata companion mengikuti arah kursor mouse secara presisi dan halus menggunakan algoritma *Lerp* (tanpa re-render React berlebih, 0% CPU lag).
- **Perilaku Otonom (Autonomous Living AI)**:
  - Berkedip alami (*blinking*) dengan kemungkinan *playful double-blink*.
  - Melirik santai (*saccades*), mengantuk sejenak lalu bangun kaget, memiringkan kepala penasaran, mengedipkan sebelah mata (*wink*), senyum gembira `(^_^)`, hingga ekspresi langka mata hati cinta `(♥_♥)`.
- **Sentuh & Mainkan**: Klik mata untuk berinteraksi, double-klik untuk membuka/menutup Drotch.

### 2. ⚡ Real-Time Typing Reactive (Efek Saat Mengetik)
- **Gaze Focus ke Keyboard**: Saat kamu mengetik (coding, chatting, browsing), mata Drotch otomatis menunduk ke bawah memperhatikan keyboard dan bergerak lincah ke kiri-kanan mengikuti ritme jemari kamu.
- **Ambient Neon Wave**: Garis cahaya di bawah notch menyala dan bergelombang dinamis selaras dengan kecepatan mengetikmu (*keystrokes per second*).
- **Celebration Cheer**: Saat kamu selesai mengetik, companion menyambut dengan lompatan ceria gembira `(^o^)`!
- **100% Privacy-Safe (Zero Keylogging)**: Menggunakan Win32 `WH_KEYBOARD_LL` hook yang **hanya menghitung frekuensi ketukan tanpa membaca atau merekam isi ketikan sama sekali**.

### 3. 🎵 Musik & Lirik Tersinkronisasi (Split View)
- **Windows SMTC Integration**: Mendukung Spotify, Apple Music, YouTube Music, browser Chrome/Edge, dan media player lainnya secara native.
- **Synced Lyrics (LRCLIB)**: Lirik lagu bergulir otomatis sesuai detik lagu, baris aktif di-highlight dengan efek glow, dan kamu bisa mengklik baris lirik mana pun untuk melompat (*seek*) lagu!
- **Spinning Vinyl Record**: Piringan hitam berputar halus dengan gaya Apple Music vector yang estetik.
- **Auto Cover Art**: Otomatis mengambil album art resolusi tinggi dari iTunes / Deezer cache.

### 4. 📊 Audio Loopback Visualizer Real-Time
- Menggunakan loopback audio **Windows WASAPI** di backend Rust.
- Spektrum frekuensi suara langsung divisualisasikan dalam bentuk gelombang audio di bagian bawah notch dan equalizer header bar secara akurat dan responsif.

### 5. 🎛️ 6 Panel Carousel Navigasi (Swipe & Wheel)
Geser (*drag swipe*) atau gunakan *mouse wheel* untuk berpindah antar panel:
1. **Music Player**: Kontrol pemutar lagu ⏮ ⏯ ⏭, seekbar interaktif, dan tombol ekspansi lirik.
2. **Weather**: Ramalan cuaca real-time dari Open-Meteo (suhu, deskripsi, kelembapan, kecepatan angin) dengan preset kota cepat.
3. **Water Reminder**: Pelacak target hidrasi harian, logging konsumsi air minum (100ml / 250ml), dan visual progress bar.
4. **To-Do List**: Checklist tugas harian yang tersimpan otomatis di penyimpanan lokal.
5. **Shelf**: Tempat drop file cepat (drag & drop file apa saja ke notch untuk disimpan sementara, klik untuk membuka langsung).
6. **Settings**: Panel preferensi komprehensif untuk mengatur shortcut, startup, kota cuaca, dll.

### 6. ⌨️ Global Shortcut & Windows on Startup
- **Buka/Tutup dari Mana Saja**: Tekan kombinasi tombol pintas di keyboard kamu untuk memunculkan atau menciutkan Drotch tanpa perlu menyentuh mouse:
  - `Ctrl + Shift + Space` *(Default)*
  - `Alt + Space` *(Gaya macOS Spotlight)*
  - `Ctrl + \`` *(Backtick)*
  - `Ctrl + Shift + N`
  - *Dapat diubah atau dinonaktifkan di Pengaturan.*
- **Jalankan Otomatis (Windows on Startup)**: Terhubung langsung ke registry Windows (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`), Drotch siap menemani kamu setiap kali login ke PC/laptop.
- **Selalu di Depan (Always on Top)**: Drotch tetap melayang elegan di atas aplikasi fullscreen atau window yang sedang dibuka.

---

## 🛠️ Arsitektur & Teknologi

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **Core Framework** | [Tauri v2](https://v2.tauri.app/) | Runtime desktop ultra-ringan berbasis Rust & WebView2 |
| **Backend** | Rust 2021 | Windows API (Win32 Hook, WASAPI Loopback, SMTC Media, Registry) |
| **Frontend** | React 18 + TypeScript | Komponen modular dan type-safe |
| **Styling** | Modern Vanilla CSS | Glassmorphism, Dynamic Island Spring Physics, Zero-Reflow layout |
| **Penyimpanan** | JSON Lokal (`%APPDATA%`) | 100% offline, tanpa akun, tanpa analitik/pelacakan |
| **API Eksternal** | LRCLIB & Open-Meteo | Sumber lirik & cuaca publik (gratis, tanpa API key) |

---

## 📋 Prasyarat Sistem (Untuk Development / Build)

Pastikan lingkungan Windows kamu sudah terpasang:
1. **Windows 10 / 11 (64-bit)**
2. **Node.js** (versi 18 ke atas) — [Download Node.js](https://nodejs.org/)
3. **Rust & Cargo** — Pasang via [rustup.rs](https://rustup.rs/) (pilih default `stable-x86_64-pc-windows-msvc`)
4. **Visual Studio Build Tools 2022** — Centang workload *"Desktop development with C++"*
5. **Microsoft Edge WebView2** (Bawaan Windows 10/11)

---

## 🚀 Memulai (Mode Development)

1. **Clone repositori**:
   ```powershell
   git clone https://github.com/username/notch.git
   cd notch
   ```

2. **Install dependensi Node.js**:
   ```powershell
   npm install
   ```

3. **Jalankan aplikasi (Dev Mode)**:
   ```powershell
   npm run tauri dev
   ```

---

## 📦 Build Installer & Standalone Executable

Untuk menghasilkan file installer (`.msi`, `.exe`) yang siap dibagikan atau dipasang di laptop mana saja:

```powershell
npm run tauri build
```

Hasil build akan otomatis tersedia di direktori:
- **Installer NSIS**: `src-tauri/target/release/bundle/nsis/Drotch_0.1.0_x64-setup.exe`
- **Installer MSI**: `src-tauri/target/release/bundle/msi/Drotch_0.1.0_x64_en-US.msi`
- **Standalone Binary**: `src-tauri/target/release/drotch.exe`

---

## 📂 Struktur Direktori

```
notch/
├── icons/                     # Icon aset aplikasi (.ico, .png)
├── src/
│   ├── components/
│   │   ├── Icons.tsx          # Kumpulan ikon SVG tajam kustom
│   │   └── NotchEyes.tsx      # Komponen Living Eyes Companion & Tracking
│   ├── panels/
│   │   ├── lyrics.tsx         # Panel lirik tersinkronisasi (LRCLIB)
│   │   ├── media.ts           # Hook SMTC Windows Media
│   │   ├── music.tsx          # Panel pemutar musik + vinyl spinning
│   │   ├── settings.tsx       # Panel pengaturan (Shortcut, Autostart, dll.)
│   │   ├── shelf.tsx          # Panel penyimpanan file cepat (Shelf)
│   │   ├── todo.tsx           # Panel catatan & to-do list
│   │   ├── water.tsx          # Widget pengingat minum air (Hydration)
│   │   └── weather.tsx        # Widget ramalan cuaca (Open-Meteo)
│   ├── App.tsx                # Window shell, gestur swipe, carousel, event routing
│   ├── main.tsx               # Titik masuk React
│   └── styles.css             # Desain Dynamic Island, animasi, dan tema gelap
├── src-tauri/
│   ├── src/
│   │   ├── cover.rs           # Pengambil cover art resolusi tinggi
│   │   ├── lyric.rs           # Fetcher & parser LRC dari LRCLIB
│   │   ├── main.rs            # Entry point Tauri + registrasi perintah
│   │   ├── media.rs           # WinRT SMTC (System Media Transport Controls)
│   │   ├── settings.rs        # Registry autostart Windows & sinkronisasi konfigurasi
│   │   ├── shelf.rs           # File shelf backend
│   │   ├── store.rs           # Pembaca/penyimpan JSON lokal di AppData
│   │   ├── todo.rs            # Penyimpanan task to-do lokal
│   │   ├── typing.rs          # Win32 WH_KEYBOARD_LL hook & deteksi kecepatan ngetik
│   │   ├── visualizer.rs      # Windows WASAPI Loopback real-time audio FFT
│   │   └── weather.rs         # Client ramalan cuaca Open-Meteo
│   ├── Cargo.toml             # Konfigurasi dependensi Rust
│   └── tauri.conf.json        # Konfigurasi window & bundle Tauri
└── package.json
```

---

## 🔒 Privasi & Keamanan Data
- **100% Offline & Lokal**: Seluruh data task to-do, file shelf, dan konfigurasi tersimpan aman di direktori lokal komputer kamu (`%APPDATA%/com.jif.drotch/`).
- **Nol Pelacakan**: Tidak ada analitik, tidak ada telemetri, dan tidak memerlukan login/akun.
- **Deteksi Ketikan Aman**: Fitur reaksi mengetik hanya menghitung laju kejadian tombol tanpa menyadap atau menyimpan huruf/angka apa pun yang diketik.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **MIT**. Kamu bebas memodifikasi, menggunakan, dan mendistribusikannya kembali.
