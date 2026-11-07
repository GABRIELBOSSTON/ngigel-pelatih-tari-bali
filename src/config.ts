// SATU SUMBER untuk semua ambang, bobot, dan parameter penilaian (keputusan K10, docs/01).
// Semua nilai di bawah adalah NILAI AWAL dari docs/04_SPESIFIKASI_AI_DAN_PENILAIAN.md (versi 2).
// Nilai dikalibrasi dengan uji "gerak benar vs gerak sengaja salah" (docs/04 bagian 10),
// lalu hasil akhirnya ditulis kembali di docs/04.
import type { Unsur } from "./scoring/types";

/** Bobot skor total per unsur; jumlahnya harus 1 (diuji di tests/config.test.ts). */
export const BOBOT_UNSUR: Record<Unsur, number> = {
  agem: 0.35,
  tandang: 0.2,
  tangkis: 0.3,
  tangkep: 0.15,
};

/**
 * Toleransi tiap jenis fitur (docs/04 bagian 7). Setiap selisih dibagi toleransinya,
 * sehingga semua fitur memakai satuan yang sama: "berapa kali toleransi".
 */
export const TOLERANSI_FITUR = {
  sudutDerajat: 15,
  // Sudut tekuk jari. Uji ujung ke ujung 3 Nov 2026 (docs/09 bagian 10): pada gerak yang IDENTIK,
  // jarak kelompok jari tetap ±1 toleransi bila toleransinya 15°, artinya derau ukur jari sendiri
  // ±15° RMS (tangan kecil di gambar seluruh badan). Toleransi harus di atas derau alat ukurnya.
  sudutJariDerajat: 25,
  posisiPanjangBadan: 0.15,
  lirikan: 0.2,
  senyum: 0.25,
  waktuDetik: 0.25,
} as const;

/**
 * τ pada skor = 100 × exp(−d / τ), dengan d = jarak RMS dalam satuan toleransi.
 * τ = 2 berarti selisih rata-rata tepat 1 toleransi memberi skor ±61.
 */
export const TAU_UNSUR: Record<Unsur, number> = {
  agem: 2,
  tandang: 2,
  tangkis: 2,
  tangkep: 2,
};

/**
 * Agregasi jarak per unsur (docs/04 bagian 7). Fitur dikelompokkan per bagian tubuh, supaya
 * kelompok berfitur banyak (mis. 10 jari) tidak menenggelamkan kesalahan bagian lain. Lalu:
 * jarak² = (1 − w) × rata-rata(jarak kelompok²) + w × (jarak kelompok terburuk)².
 * w > 0 meniru guru: "agemnya kurang karena lututnya", walau bagian lain sudah benar.
 *
 * Kalibrasi 3 Nov 2026 (docs/09 bagian 7): w = 1, artinya nilai unsur ditentukan bagian tubuh yang
 * paling jauh dari guru. Hanya pengaturan ini yang memenuhi kedua kriteria docs/04 bagian 10 pada
 * 74 kasus sintetis (gerak mirip terendah 75; gerak salah median 48), dan pada uji ujung ke ujung
 * memberi gerak benar 79, gerak lain 32. Sebelumnya 0,5 (gerak salah median 56, terlalu lunak).
 */
export const BOBOT_KELOMPOK_TERBURUK = 1;

/**
 * Kelompok bagian tubuh hanya dinilai bila datanya ada di minimal porsi ini dari pasangan frame
 * unsurnya. Dengan w = 1, beberapa frame jari berderau tidak boleh menentukan nilai unsur sendirian.
 */
export const MIN_PORSI_KELOMPOK = 0.25;

/** Selisih rata-rata (satuan toleransi) minimal supaya sebuah fitur dijadikan kalimat koreksi. */
export const MIN_SELISIH_KOREKSI = 0.75;

/**
 * Untuk sudut jari, ambang koreksinya 1 toleransi (25°). Uji 7 Nov: penari IDENTIK mendapat selisih jari
 * tengah yang konsisten ±19° (0,76 toleransi). Itu bias alat ukur, karena kamera palsu 640×360 membuat
 * tangan lebih kecil daripada di video guru 854×480. Di bawah 1 toleransi, kesalahan jari tidak bisa
 * dibedakan dari bias resolusi. Nilai unsur tidak berubah; ini hanya untuk kalimat koreksi.
 */
export const MIN_SELISIH_KOREKSI_JARI = 1;

/** Batas selisih sudut (derajat) untuk warna garis saat latihan: 1× dan 2× toleransi sudut. */
export const AMBANG_WARNA_DERAJAT = {
  hijau: TOLERANSI_FITUR.sudutDerajat, // di bawah ini: mirip
  kuning: TOLERANSI_FITUR.sudutDerajat * 2, // di bawah ini: hampir; di atasnya: meleset
} as const;

/**
 * Kelonggaran keterlambatan untuk umpan balik real-time (docs/04 bagian 8):
 * frame murid dibandingkan dengan frame guru yang paling mirip dalam [t − mundur, t + maju].
 */
export const JENDELA_REALTIME_DETIK = {
  mundur: 0.6,
  maju: 0.2,
} as const;

/**
 * Segmentasi gerak menjadi pokok (agem), peralihan (tangkis), dan perpindahan (tandang).
 * Dihitung dari deret fitur, supaya bisa diulang dari JSON pelajaran yang tersimpan.
 */
export const SEGMENTASI = {
  // Kecepatan anggota badan tercepat, dalam satuan toleransi per detik (1 = mis. siku berubah
  // 15° per detik). Di bawah ambang dianggap diam. Ambangnya adaptif: minimal kecepatanDiam, dinaikkan
  // ke persentil persentilDiam kecepatan tarian itu sendiri. Tari yang terus mengalir (uji Janger
  // 3 Nov 2026: persentil 5 = 1,6) tetap punya sikap pokok, yaitu bagian paling tenangnya (docs/09).
  kecepatanDiam: 1.0,
  persentilDiam: 20,
  minDurasiPokokDetik: 0.4,
  ambangPerpindahan: 0.3, // perpindahan pusat pinggul dalam jendela, satuan panjang badan
  jendelaPerpindahanDetik: 0.5, // perpindahan diukur antara t − jendela dan t + jendela
  jendelaHalusDetik: 0.2, // rata-rata bergerak kecepatan, supaya getar satu frame tidak memotong segmen
} as const;

/** Titik dengan keyakinan (visibility) di bawah ini diabaikan. */
export const VISIBILITY_MIN = 0.5;

/** Unsur ditandai "tidak terbaca" bila porsi frame yang hilang melebihi nilai ini. */
export const BATAS_FRAME_HILANG = 0.4;

/**
 * Penghalusan fitur dengan rata-rata bergerak eksponensial, BERBASIS WAKTU: bobot setara alfa 0,35 per
 * frame pada FPS_ACUAN_PENGHALUSAN (konstanta waktu ±0,155 detik). Sebelum 3 Nov 2026 alfa dipakai per
 * frame, sehingga murid di perangkat lambat (±7 fps) dihaluskan dua kali lebih lama daripada guru
 * (15 fps) dan gerak cepat seperti seledet tampak lambat (docs/09 bagian 11).
 */
export const ALFA_PENGHALUSAN = 0.35;
export const FPS_ACUAN_PENGHALUSAN = 15;

/** Lebar jendela Sakoe-Chiba pada DTW, sebagai porsi dari panjang deret. */
export const DTW_JENDELA = 0.2;

/**
 * Deteksi seledet sebagai kejadian (src/scoring/seledet.ts): lirikan, relatif terhadap median penari,
 * melewati ±ambangLirikan dalam ≤ maksDurasiDetik. Pada video Janger ini memberi 39 kejadian dalam
 * ±155 detik (docs/09 bagian 11). Gerak kepala tidak dijadikan syarat karena tidak membedakan.
 */
export const SELEDET = {
  ambangLirikan: 0.35,
  maksDurasiDetik: 0.3, // pada FPS_ACUAN_PENGHALUSAN; di fps lebih rendah dilonggarkan (batasCepatDetik)
  batasDurasiDetik: 0.6, // batas atas setelah dilonggarkan, supaya lirikan pelan tetap bukan seledet
  fpsAndal: 8, // di bawah ini halaman Hasil memberi catatan bahwa angka seledet kurang pasti
  jedaMinDetik: 0.5, // dua kejadian lebih rapat dari ini dihitung satu
  jendelaCocokDetik: 0.5, // kejadian murid ±0,5 detik dari waktu guru yang sepadan (setelah DTW)
  minPorsiTerbaca: 0.3, // di bawah porsi frame berlirikan ini, seledet murid "tidak terbaca"
} as const;

/**
 * Kinerja. Uji ujung ke ujung 3 Nov 2026: Holistic CPU 4,2–8,3 deteksi/detik di laptop pengembang
 * (docs/09 bagian 10). Di bawah fpsPeringatan selama lamaPeringatanDetik, studio menyarankan menutup
 * aplikasi lain atau menyalakan mode cepat. Mode tidak diganti otomatis, karena mode cepat mematikan
 * ekspresi wajah dan mengubah unsur yang dinilai.
 */
export const KINERJA = {
  fpsTarget: 15,
  fpsPeringatan: 4,
  lamaPeringatanDetik: 5,
} as const;

/** Studio latihan (src/pages/Latihan.tsx): satu tempat untuk angka-angka perilakunya. */
export const STUDIO = {
  /** Hitung mundur cukup lama supaya murid sempat mundur 2–3 langkah sesudah menekan Mulai. */
  hitungMundurDetik: 5,
  /** Tubuh tidak terlihat selama ini saat menari → video dijeda otomatis (docs/03 bagian C). */
  jedaBilaTubuhHilangDetik: 2,
  /** Sesudah jeda otomatis, tubuh terlihat utuh selama ini → lanjut sendiri. */
  lanjutBilaTubuhKembaliDetik: 1,
  /** Kedua tangan di atas kepala selama ini di layar persiapan → mulai, tanpa menyentuh laptop. */
  gesturMulaiDetik: 1.5,
  /** Rata-rata kecerahan kamera (0–255) di bawah ini selama lamaGelapDetik → saran tambah cahaya. */
  kecerahanMin: 45,
  lamaGelapDetik: 3,
  /** Petunjuk di layar diganti paling cepat setiap sekian milidetik, supaya sempat dibaca. */
  jedaGantiPetunjukMs: 1500,
  /** Pelatih suara mengucapkan petunjuk paling sering setiap sekian milidetik. */
  jedaSuaraPetunjukMs: 3000,
} as const;

/**
 * Gerbang kualitas kamera (src/latihan/kualitas.ts, docs/04 bagian 8). Bila gambar kamera kurang jelas,
 * garis tidak diberi warna merah/kuning, petunjuk berganti menjadi saran memperbaiki kamera, dan frame
 * itu tidak dinilai. Nilai awal 7 Nov 2026 dari uji kamera palsu yang diperkecil, digelapkan, dan
 * diburamkan (docs/09 bagian 12); perlu dikalibrasi ulang dengan orang sungguhan.
 */
export const KUALITAS = {
  /**
   * Tinggi kepala–kaki ÷ tinggi gambar. Kamera laptop (sudut pandang vertikal ±45°) memberi ±0,75 pada
   * jarak 2,5 m dan ±0,4 pada ±5 m. Di bawah ini penari dianggap terlalu kecil.
   */
  tubuhMin: 0.4,
  /** Rata-rata visibility 12 titik lengan dan tungkai. Di bawah ini AI dianggap ragu. */
  keyakinanMin: 0.6,
  /**
   * Ketajaman gambar (src/vision/kecerahan.ts). Kamera palsu 320×180: tajam 0,18–0,51 (termasuk gelap
   * dan dinding polos), diburamkan 3 px 0,0075. Pada gambar buram itu keyakinan AI tetap 0,97, tetapi
   * tangkis penari identik turun ke 40 karena jari ikut kabur.
   */
  ketajamanMin: 0.03,
  /** Masalah harus bertahan selama ini sebelum garis jadi abu-abu, supaya satu frame jelek tidak mengganggu. */
  tahanDetik: 1,
  /** Bila lebih dari porsi frame ini kurang jelas, halaman Hasil memberi catatan. */
  porsiCatatan: 0.1,
  /**
   * Bila separuh latihan atau lebih kurang jelas, sesi tidak dinilai sama sekali: frame sisanya juga
   * diambil dalam kondisi yang sama. Uji 7 Nov (penari identik, tubuh 30% layar): 27% frame lolos
   * gerbang dan memberi nilai 49 dengan tiga koreksi palsu.
   */
  porsiTolak: 0.5,
  /**
   * Bila kaki tidak terbaca, ukuran tubuh diperkirakan dari panjang badan (tengah bahu → tengah pinggul)
   * dibagi rasio ini. Pada orang berdiri, badan ±0,3 tinggi badan dan hidung–pergelangan kaki ±0,87,
   * jadi rasionya ±0,35.
   */
  rasioBadan: 0.35,
} as const;

/**
 * Kartu "kesalahan berulang" saat menari (src/latihan/kesalahan.ts, usul ketua tim 4 Nov 2026). Petunjuk
 * biasa berganti tiap 1,5 detik; kartu muncul bila kesalahan yang sama mendominasi beberapa detik.
 */
export const KESALAHAN = {
  /** Kesalahan dihitung berulang bila ≥ porsiMin frame (dan ≥ frameMin frame) dalam jendela ini sama. */
  jendelaDetik: 2.5,
  porsiMin: 0.6,
  frameMin: 4,
  /**
   * Atau bila terjadi ≥ kejadianMin kali dalam jendelaKejadianDetik; satu kejadian = ≥ kejadianMinFrame
   * frame berurutan. Gerak tari berganti cepat: pada Janger detik 40–70, tangan guru jelas tidak sejajar
   * hanya di 25% frame dan paling lama 1,5 detik, jadi kesalahan "kebalik" muncul sebentar-sebentar.
   */
  kejadianMin: 3,
  kejadianMinFrame: 2,
  jendelaKejadianDetik: 15,
  /** Kebalik bila ≥ porsi ini dari frame guru (di jendela waktu) yang tangannya jelas tidak sejajar berlawanan arah dengan murid. */
  porsiKebalik: 0.7,
  /**
   * Pembeda terlambat dan kebalik: bila > porsiSamaMaks frame guru dalam masaLaluDetik terakhir (sebelum
   * jendela) mengangkat tangan yang SAMA dengan murid, murid dianggap tertinggal, bukan kebalik.
   * Simulasi Janger 40–70: kebalik palsu murid terlambat 1,5 dtk turun dari 8% frame (4 kejadian) ke 0;
   * murid yang benar-benar dicerminkan tetap 16% frame (7 kejadian).
   */
  masaLaluDetik: 2.5,
  porsiSamaMaks: 0.3,
  /**
   * Kartu "tertinggal": gerak murid kurang cocok dengan guru sekarang (jarak ≥ jarakTertinggalMin, yaitu
   * kemiripan ≤ ±61), tetapi jauh lebih cocok dengan guru dalam masaLaluDetik terakhir (jarak ≤ rasio ×).
   * Simulasi Janger 40–70: terlambat 1,0/1,5/2,0 dtk terdeteksi di 39/61/65% frame dengan perkiraan
   * 1,0/1,5/2,0 dtk; tepat waktu 0%; tarian lain 1–9% frame. Karena itu kartu ini hanya muncul bila
   * mendominasi jendela, tidak dari kejadian sesekali.
   */
  jarakTertinggalMin: 1,
  rasioTertinggal: 0.5,
  /** Kartu tampil minimal selama ini; kartu yang sama baru boleh muncul lagi setelah jedaUlangDetik. */
  lamaKartuDetik: 4,
  jedaUlangDetik: 8,
  /** Petunjuk biasa baru dijadikan kartu bila selisihnya ≥ sekian toleransi (jelas salah, bukan tipis). */
  selisihMin: 1.5,
  /** Beda tinggi tangan kanan–kiri (panjang badan) supaya "di atas / di bawah" jelas: 2× toleransi posisi. */
  bedaTanganMin: 0.3,
} as const;

/** RENCANA (belum dibangun): batas waktu menunggu LLM sebelum memakai kalimat templat (docs/04 bagian 9). */
export const LLM_TIMEOUT_MS = 6000;

/**
 * Opsi Holistic Landmarker (docs/04 bagian 2). Nilai bawaan MediaPipe 0,5; ditulis eksplisit
 * supaya bisa dikalibrasi di satu tempat.
 */
export const OPSI_HOLISTIC = {
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minHandLandmarksConfidence: 0.5,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
} as const;

/**
 * Perangkat untuk Holistic. CPU, karena uji 2 Nov 2026 (Chrome, tasks-vision 1.1.1) menunjukkan
 * graf blendshape wajah gagal dibuka dengan delegasi GPU ("StridedSlice does not support
 * shrink_axis_mask"), sehingga setiap frame gagal. Ganti ke "GPU" hanya setelah diuji ulang.
 */
export const DELEGASI_HOLISTIC: "GPU" | "CPU" = "CPU";

/** Deteksi yang gagal berturut-turut sebanyak ini dianggap kerusakan, bukan gangguan sesaat. */
export const BATAS_GAGAL_DETEKSI = 10;

/** Resolusi kamera yang diminta. Holistic mengecilkan gambar sendiri, jadi 640×480 cukup dan hemat. */
export const KAMERA = {
  lebarIdeal: 640,
  tinggiIdeal: 480,
} as const;

/** Letak aset AI di server sendiri (docs/01 K15), relatif terhadap BASE_URL aplikasi. */
export const ASET_AI = {
  folderWasm: "mediapipe/wasm",
  model: "models/holistic_landmarker.task",
  // Jalur cadangan: tiga model terpisah (docs/04 bagian 2).
  modelPose: "models/pose_landmarker_lite.task",
  modelTangan: "models/hand_landmarker.task",
  modelWajah: "models/face_landmarker.task",
} as const;

/**
 * Ambang panel uji arah tahap 1 (docs/06 bagian 2): selisih tinggi dalam satuan tinggi gambar,
 * dan nilai lirikan minimal untuk dianggap melirik.
 */
export const UJI_ARAH = {
  selisihTinggi: 0.05,
  ambangLirikan: 0.15,
} as const;

/** Kriteria lulus kalibrasi (docs/04 bagian 10). */
export const KRITERIA_KALIBRASI = {
  minSkorGerakBenar: 75,
  maksSkorUnsurSalah: 50,
  maksSelisihAntarOrang: 10,
  maksTurunTempoLambat: 10,
} as const;
