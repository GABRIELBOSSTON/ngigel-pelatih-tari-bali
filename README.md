# Ngigel: Pelatih Tari Bali Berbasis AI

> **Status (3 November 2026): etalase, latihan bersama video guru, penilaian, seledet, pelatih suara, bagikan hasil, dan riwayat berjalan.** Kalimat koreksi oleh LLM belum dibangun (sekarang templat). Untuk AI Web Innovation Challenge — Bali DigiFest 2026.
> Bagian bertanda *(diisi)* dilengkapi saat MVP selesai. Daftar "Key Features" hanya memuat fitur yang **sudah berfungsi**.

## Description
Ngigel adalah aplikasi web tempat murid berlatih tari Bali di depan webcam. AI di peramban membaca **sikap tubuh, perpindahan, gerak tangan dan jari, serta ekspresi dan lirikan mata (seledet)**, lalu membandingkannya dengan video guru. Hasilnya berupa nilai dan koreksi menurut **empat unsur dasar tari Bali**:
- **agem**: sikap pokok;
- **tandang**: perpindahan gerak;
- **tangkis**: peralihan antarsikap;
- **tangkep**: ekspresi;

ditambah tempo.

## Problem & Target User
Murid tari Bali hanya mendapat koreksi gerak saat bertemu guru di sanggar. Saat berlatih sendiri dari video, tidak ada yang memberi tahu bagian mana yang salah.
- **Pengguna utama:** murid sanggar dan pelajar yang berlatih gerak dasar di rumah.
- **Pengguna kedua:** guru sanggar yang ingin muridnya berlatih dengan acuan darinya.

## Key Features
**Sudah berfungsi:**
- **Etalase kelas** (`/`): 18 kelas dalam 4 kategori (kreasi, penyambutan, pertunjukan, gerak dasar), dengan pencarian, saringan tingkat, dan pratinjau video. Deskripsi tiap tari punya sumber tertulis (halaman Tentang)
- **Studio latihan** (`/latihan/:kelasId`):
  - video guru di kiri dan kamera di kanan, keduanya seperti cermin;
  - hitung mundur 5 detik, atau **mulai tanpa menyentuh laptop** dengan mengangkat kedua tangan di atas kepala;
  - garis tubuh **hijau/kuning/merah**, kemiripan 0–100, dan **petunjuk perbaikan** ("Angkat lengan kanan lebih tinggi");
  - **pelatih suara** berbahasa Indonesia yang mengucapkan petunjuk, karena murid berdiri 2–3 meter dari layar;
  - **jeda otomatis** saat tubuh keluar bingkai, lanjut sendiri saat kembali; saran bila ruangan gelap atau perangkat lambat;
  - **gerbang kualitas kamera**: bila tubuh terlalu kecil di layar, gambar gelap, atau buram, garis menjadi abu-abu (murid tidak disalahkan karena kamera), muncul saran "Maju 1–2 langkah" / "Tambah cahaya" / "Bersihkan lensa", dan frame itu tidak dinilai;
  - **kartu kesalahan berulang**: bila gerak yang sama salah berkali-kali, kartu besar membandingkan guru dan murid, misalnya *Guru: tangan kanan di atas, tangan kiri di bawah · Anda: kebalik → Tukar*, atau *"Percepat: gerak Anda ±1,5 detik di belakang guru"* bila murid tertinggal;
  - panduan 3 langkah (letak laptop, jarak, cahaya) pada kunjungan pertama;
  - tanda **"Seledet!"** saat guru melirik;
  - rentang latihan per babak; kecepatan putar 0,5×/0,75×/1×
- **Penilaian setelah menari:**
  - segmentasi pokok/peralihan/perpindahan;
  - penyelarasan tempo dengan **DTW**;
  - nilai **agem, tandang, tangkis, tangkep**;
  - **seledet** dihitung per kejadian ("8 dari 10 tepat"), termasuk arah lirikannya;
  - tiga koreksi (templat), hanya untuk selisih yang cukup besar;
  - keterlambatan rata-rata, garis kemiripan per detik, dan tombol **latih bagian tersulit**
- **Bagikan ke guru** tanpa server: tautan hasil (isi di bagian `#`, tidak terkirim ke server) dan kartu hasil PNG
- **Riwayat** di peramban (tanpa server) dengan **garis kemajuan per kelas**, bisa dihapus kapan saja
- **Untuk Guru:** video gerak → JSON pelajaran, diproses di perangkat
- **Keamanan:** CSP tanpa sumber luar dan kamera hanya untuk situs sendiri (`vercel.json`)
- Uji ujung ke ujung di Chrome dengan kamera palsu berisi video tari (termasuk kamera jauh, gelap, buram, dan murid yang kiri–kanannya tertukar), bisa diulang dengan `scripts/uji/` (docs/09); 141 uji otomatis; CI (typecheck, uji, build)

**Belum:**
- Video untuk kelas selain Tari Kreasi Janger (kelas lain sementara memakai video contoh, dengan pemberitahuan)
- Kalimat koreksi oleh LLM
- Kalibrasi nilai dengan penari sungguhan

## Tech Stack
React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · React Router 7 · MediaPipe Tasks Vision · Zod · Vitest · GitHub Actions. Tahap fitur: Vercel Functions (LLM). Tahap final: Supabase.

Versi terkunci dan alasannya: [docs/01_TECH_STACK.md](docs/01_TECH_STACK.md).

## AI Implementation
| Bagian | Model/metode | Input → Output |
|---|---|---|
| Deteksi tubuh, tangan, dan wajah | **MediaPipe Holistic Landmarker**, delegasi CPU, di Web Worker (cadangan: Pose + Hand + Face Landmarker) | Frame kamera → 33 titik tubuh (gambar + 3D), 21 titik per tangan, 6 *blendshape* wajah |
| Segmentasi gerak | Kecepatan sendi dan perpindahan pinggul (implementasi sendiri) | Deret fitur → segmen pokok / peralihan / perpindahan |
| Penyelarasan tempo | Dynamic Time Warping (implementasi sendiri) | Deret fitur murid + guru → pasangan frame + keterlambatan |
| Umpan balik saat menari | Frame guru paling mirip dalam jendela −0,6…+0,2 detik (implementasi sendiri) | Fitur murid → warna per bagian, kemiripan 0–100, satu petunjuk perbaikan (juga diucapkan, Web Speech API) |
| Seledet | Kejadian lirikan cepat relatif terhadap netral penari, dicocokkan lewat peta waktu DTW (implementasi sendiri) | Deret lirikan murid + guru → tepat / arah berbeda / terlewat per kejadian |
| Kendali tanpa sentuh | Titik tubuh dari Holistic (implementasi sendiri) | Kedua tangan di atas kepala → mulai; tubuh hilang > 2 detik → jeda |
| Gerbang kualitas kamera | Ukuran tubuh di layar, keyakinan AI, kecerahan, ketajaman (variansi Laplacian) | Frame → kurang jelas? → garis abu-abu, saran kamera, frame tidak dinilai |
| Kartu kesalahan berulang | Kebalik kiri–kanan terhadap jendela waktu guru; tertinggal (gerak cocok dengan guru beberapa detik lalu); kesalahan yang mendominasi atau terjadi ≥ 3× dalam 15 detik | Deret kesalahan → kartu "Guru: … / Anda: …" + satu perintah |
| Penilaian | Jarak dalam satuan toleransi, kelompok bagian tubuh terburuk menentukan → `100 × exp(−d/τ)` | Selisih → skor 0–100 per unsur |
| Kalimat koreksi | Sekarang **templat**. Rencana: LLM *(penyedia diisi)* yang hanya menerima angka | Angka penyimpangan → kalimat |

Video kamera **tidak dikirim ke server**. Model dan WASM dimuat dari server Ngigel sendiri. Spesifikasi: [docs/04_SPESIFIKASI_AI_DAN_PENILAIAN.md](docs/04_SPESIFIKASI_AI_DAN_PENILAIAN.md).

## Architecture / Data Flow
```
Webcam (frame asli) → MediaPipe Holistic (di peramban, Web Worker) → fitur (kiri–kanan anatomis)
      → perbandingan real-time (warna stickman, kemiripan, petunjuk; kelonggaran keterlambatan)
      → setelah latihan: DTW → segmen → skor per unsur + seledet → koreksi dari templat
        (rencana: [angka saja] → API → LLM → kalimat koreksi)
      → riwayat disimpan di peramban (tanpa data murid di server)
      → bagikan: angka hasil dikompres di bagian # tautan (tidak terkirim ke server) atau kartu PNG
```
Alur lengkap: [docs/03_FLOW_PROYEK.md](docs/03_FLOW_PROYEK.md). Struktur folder: [docs/02_STRUKTUR_PROYEK.md](docs/02_STRUKTUR_PROYEK.md).

## Installation / Run Instructions
Prasyarat: Node.js ≥ 22.12, npm ≥ 10, peramban Chrome/Edge, webcam.
```bash
npm install --ignore-scripts   # pasang pustaka sesuai versi terkunci
npm run setup:model            # hanya bila public/models kosong: unduh model Holistic resmi (13,68 MB); ukuran dicocokkan
cp .env.example .env           # belum wajib di tahap fondasi; jangan di-commit
npm run dev                    # menyalin WASM MediaPipe otomatis; buka http://localhost:5173
npm run test                   # uji otomatis
npm run typecheck              # pemeriksaan tipe
npm run build                  # build produksi ke dist/
```
Panduan lengkap: [docs/08_PANDUAN_PENGEMBANGAN.md](docs/08_PANDUAN_PENGEMBANGAN.md). Uji ujung ke ujung, benchmark, dan kalibrasi yang bisa diulang: [scripts/uji/README.md](scripts/uji/README.md).

**Video contoh.** Semua kelas sementara memakai video Tari Kreasi Janger (Puputdhe, YouTube) sebagai contoh untuk prototipe lomba:
- `public/video/tari-kreasi-janger.mp4`;
- `public/lessons/tari-kreasi-janger.json`, data gerak guru yang dibuat dari video itu lewat halaman `/guru`.

Kredit dan keterangan hak cipta tampil di bawah video. Izin pemilik masih diminta, dan untuk produksi video ini diganti video berizin (docs/05 bagian 4.6). Bila berkas tidak ada, studio meminta pengguna memilih video tari dari perangkatnya sendiri; video itu dibaca di peramban dan tidak disimpan.

**Deploy lewat Git (Vercel), jangan unggah `dist/` hasil build lokal**, karena isi `public/video-lokal/` ikut tersalin ke sana.

## Deployment URL
*(diisi)*

## Demo Account
Tidak diperlukan; aplikasi bisa dipakai tanpa login.

## Known Limitations
- Kamera tunggal tidak melihat kedalaman dengan sempurna; gerak menghadap samping kurang akurat.
- Tandang (pola lantai) butuh ruang; di rumah, fokus pada langkah di tempat dan perpindahan pendek.
- Kualitas penjiwaan (*semu*/*greget*) tidak diukur; tangkep diwakili lirikan, gerak kepala, dan senyum.
- Kain atau kostum bisa menutupi lutut; lirikan mata butuh wajah cukup dekat dan terang.
- Nilai mengukur **kemiripan dengan guru acuan**, bukan kebenaran menurut pakem.
- Angka uji sejauh ini berasal dari **penari yang sama** dengan guru, lewat kamera palsu. Uji dengan orang yang berbeda bentuk tubuh belum dilakukan (docs/09 bagian 8).
- Di perangkat lambat (< 8 deteksi/detik), sebagian seledet cepat tidak tertangkap. Halaman Hasil memberi catatan ini.

## Third-party Resources / Credits
- Pustaka MediaPipe Tasks Vision (Google), Apache-2.0. Model Holistic Landmarker (Google): *model card* BlazePose GHUM 3D, Face Mesh V2, dan Hand Tracking menyatakan Apache-2.0. Pustaka lain tercantum di [docs/07_AI_TECHNOLOGY_DISCLOSURE.md](docs/07_AI_TECHNOLOGY_DISCLOSURE.md).
- Video contoh: Puputdhe, "Tari Kreasi JANGER Bali | Tari Kreasi Bali gerakan mudah" (YouTube). Video milik pemiliknya, dipakai sebagai contoh untuk prototipe MVP lomba, bukan untuk tujuan komersial. **Izin pemilik sedang diminta ketua tim**; video akan dihapus bila pemilik keberatan.
- Huruf Plus Jakarta Sans (Tokotype), SIL Open Font License 1.1, lewat paket `@fontsource-variable/plus-jakarta-sans` 5.3.0 (disajikan dari server sendiri).
- Gambar penari di etalase dan logo: digambar sendiri dengan SVG.
- Deskripsi kelas tari: sumber tercantum di `src/katalog/katalog.ts` (`SUMBER`) dan halaman Tentang.
- Definisi unsur tari Bali: *IGEL: Journal of Dance* 3(2), 2023; *Batarirupa* 2(1), 2022 (rincian di docs/04)

## Team Members
| Nama | Peran |
|---|---|
| Gabriel Hamonangan Lumban Tobing | Ketua; pengembang |
| Rahel Caroline Tobing | Anggota; *(peran diisi)* |
