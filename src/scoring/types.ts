// Tipe data mesin penilaian. Definisinya mengikuti docs/04_SPESIFIKASI_AI_DAN_PENILAIAN.md.

/** Empat unsur dasar tari Bali yang dinilai. */
export const DAFTAR_UNSUR = ["agem", "tandang", "tangkis", "tangkep"] as const;
export type Unsur = (typeof DAFTAR_UNSUR)[number];

/** Skor 0–100 per unsur; null bila unsur "tidak terbaca" (titiknya terlalu sering hilang). */
export type SkorUnsur = Record<Unsur, number | null>;

/** Satu penyimpangan terbesar yang dikirim ke LLM sebagai bahan kalimat koreksi (docs/03 bagian E). */
export type Penyimpangan = {
  unsur: Unsur;
  fitur: string;
  bagian: string;
  jenis: string;
  /** Rata-rata selisih dalam satuan toleransi (dasar pengurutan). */
  selisihToleransi: number;
  selisihDerajat?: number;
  selisihDetik?: number;
  /** Waktu di video guru saat selisihnya paling besar. */
  waktuDetik?: number;
  ketukan?: number;
};

export type HasilLatihan = {
  gerakId: string;
  skor: SkorUnsur;
  skorTotal: number;
  penyimpangan: Penyimpangan[];
};

/** Warna garis stickman saat latihan (docs/04 bagian 4). */
export type WarnaKemiripan = "hijau" | "kuning" | "merah";
