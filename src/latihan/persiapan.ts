// Langkah persiapan sebelum menari: satu perintah terpenting, ditampilkan besar dan diucapkan pelatih
// suara. Murid berdiri 2–3 meter dari layar, dan di ponsel daftar cek kecil tidak terbaca dari jarak
// itu (uji ketua dengan iPhone XR, 8 Nov 2026).
import { KUALITAS } from "../config";

export type KeadaanPersiapan = {
  /** AI menemukan orang (walau tubuhnya belum utuh). */
  adaOrang: boolean;
  /** Kepala sampai kaki terlihat. */
  tubuh: boolean;
  /** Tinggi tubuh di kamera (0–1), atau null bila belum terukur. */
  ukuranTubuh: number | null;
  gelap: boolean;
  buram: boolean;
};

export type LangkahPersiapan = {
  teks: string;
  /** Semua syarat terpenuhi; tinggal gestur atau tombol Mulai. */
  siap: boolean;
  /** Ikon besar di samping perintah, supaya jenis perintahnya terlihat dari jauh. */
  ikon: string;
};

export const LANGKAH_SIAP = "Angkat kedua tangan di atas kepala untuk mulai";

/**
 * Urutannya mengikuti apa yang harus dibereskan lebih dulu: ada orang, tubuh utuh, jarak, cahaya, lensa.
 * Gelap dan buram diperiksa sesudah jarak, karena tubuh yang terlalu kecil juga membuat AI ragu.
 */
export function langkahPersiapan(k: KeadaanPersiapan): LangkahPersiapan {
  if (!k.adaOrang) return { teks: "Berdiri di depan kamera, 2–3 langkah dari layar", siap: false, ikon: "🧍" };
  if (!k.tubuh) return { teks: "Mundur sampai kepala dan kaki terlihat", siap: false, ikon: "👣" };
  if (k.ukuranTubuh !== null && k.ukuranTubuh < KUALITAS.tubuhMin) return { teks: "Maju 1–2 langkah", siap: false, ikon: "👣" };
  if (k.gelap) return { teks: "Tambah cahaya dari depan", siap: false, ikon: "💡" };
  if (k.buram) return { teks: "Bersihkan lensa kamera", siap: false, ikon: "🔍" };
  return { teks: LANGKAH_SIAP, siap: true, ikon: "🙌" };
}

/**
 * Kapan langkah persiapan diucapkan: hanya bila ada orang di depan kamera (tidak berbicara ke ruangan
 * kosong), saat perintahnya berubah dengan jeda minimal, atau diulang bila murid belum bergerak.
 */
export function perluDiucapkan(
  langkah: LangkahPersiapan,
  adaOrang: boolean,
  terakhir: { teks: string; waktu: number },
  sekarang: number,
  jeda: { gantiMs: number; ulangMs: number },
): boolean {
  if (!adaOrang) return false;
  const selang = sekarang - terakhir.waktu;
  if (langkah.teks !== terakhir.teks) return selang >= jeda.gantiMs;
  return selang >= jeda.ulangMs;
}
