// Tipe data hasil deteksi MediaPipe yang dipakai di seluruh aplikasi.

/** Satu titik (landmark). x, y ternormalisasi 0–1 terhadap gambar; z relatif kedalaman. */
export type Titik = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

/** Blendshape wajah yang dipakai untuk unsur tangkep (docs/04 bagian 1). Nilai 0–1. */
export const BLENDSHAPE_DIPAKAI = [
  "eyeLookInLeft",
  "eyeLookOutLeft",
  "eyeLookInRight",
  "eyeLookOutRight",
  "mouthSmileLeft",
  "mouthSmileRight",
] as const;
export type NamaBlendshape = (typeof BLENDSHAPE_DIPAKAI)[number];
export type BlendshapeWajah = Record<NamaBlendshape, number>;

/**
 * Hasil deteksi satu frame. null berarti bagian itu tidak terdeteksi di frame tersebut.
 * Koordinat gambar dipakai untuk menggambar dan fitur posisi; koordinat dunia (meter,
 * berpusat di pinggul) dipakai untuk sudut sendi (docs/04 bagian 4).
 * Titik wajah mentah sengaja tidak dibawa; hanya blendshape (docs/05 bagian 5).
 */
export type HasilDeteksi = {
  waktuMs: number;
  /** Lebar ÷ tinggi gambar. Koordinat x dan y ternormalisasi terhadap sisi berbeda, jadi jarak di
   *  bidang gambar hanya benar bila x dikalikan rasio ini (penting untuk fitur perpindahan). */
  rasioGambar: number;
  pose: Titik[] | null; // 33 titik, lihat poseIndex.ts
  poseDunia: Titik[] | null;
  tanganKiri: Titik[] | null; // 21 titik, lihat handIndex.ts
  tanganKanan: Titik[] | null;
  tanganKiriDunia: Titik[] | null;
  tanganKananDunia: Titik[] | null;
  wajah: BlendshapeWajah | null;
};

/** Perangkat tempat model dijalankan. GPU lebih cepat; CPU sebagai cadangan. */
export type Delegasi = "GPU" | "CPU";

/** Jalur AI: satu model Holistic (utama) atau tiga model terpisah (cadangan, docs/04 bagian 2). */
export type JalurAi = "holistic" | "terpisah";
