// Gerbang kualitas kamera (docs/04 bagian 8): apakah gambar kamera cukup jelas untuk dinilai? Bila tidak,
// murid tidak disalahkan karena kamera: garis jadi abu-abu, petunjuk berganti menjadi saran memperbaiki
// kamera, dan frame itu tidak ikut dinilai. Fungsi murni; ambangnya di KUALITAS (config).
import { KUALITAS, VISIBILITY_MIN } from "../config";
import { median } from "../scoring/geometri";
import { POSE } from "../vision/poseIndex";
import type { Titik } from "../vision/types";

export type MasalahKualitas = "kecil" | "gelap" | "buram" | "ragu";

/** Kalimat pendek untuk layar dan pelatih suara. */
export const PESAN_KUALITAS: Record<MasalahKualitas, string> = {
  kecil: "Maju 1–2 langkah: tubuh Anda terlalu kecil di kamera",
  gelap: "Tambah cahaya dari depan: gambar kamera terlalu gelap",
  buram: "Gambar kamera buram: bersihkan lensa kamera",
  ragu: "Gambar kurang jelas: tambah cahaya atau bersihkan lensa kamera",
};

const KEPALA = [POSE.HIDUNG, POSE.MATA_KIRI, POSE.MATA_KANAN] as const;
const KAKI = [POSE.PERGELANGAN_KAKI_KIRI, POSE.PERGELANGAN_KAKI_KANAN, POSE.TUMIT_KIRI, POSE.TUMIT_KANAN, POSE.UJUNG_KAKI_KIRI, POSE.UJUNG_KAKI_KANAN] as const;
const ANGGOTA = [
  POSE.BAHU_KIRI,
  POSE.BAHU_KANAN,
  POSE.SIKU_KIRI,
  POSE.SIKU_KANAN,
  POSE.PERGELANGAN_KIRI,
  POSE.PERGELANGAN_KANAN,
  POSE.PINGGUL_KIRI,
  POSE.PINGGUL_KANAN,
  POSE.LUTUT_KIRI,
  POSE.LUTUT_KANAN,
  POSE.PERGELANGAN_KAKI_KIRI,
  POSE.PERGELANGAN_KAKI_KANAN,
] as const;

const terlihat = (t: Titik | undefined): t is Titik => t !== undefined && (t.visibility ?? 1) >= VISIBILITY_MIN;

/**
 * Ukuran penari di gambar, setara tinggi kepala sampai kaki saat berdiri, ÷ tinggi gambar. Diambil yang
 * lebih besar dari dua ukuran:
 * - tinggi kepala → kaki, yang menyusut saat penari merendah atau berlutut (banyak di tari Bali);
 * - panjang badan (tengah bahu → tengah pinggul) ÷ KUALITAS.rasioBadan, yang tidak menyusut saat berlutut
 *   dan tetap ada saat kaki tidak terbaca, tetapi memendek saat badan membungkuk.
 * null bila keduanya tidak bisa diukur.
 */
export function ukuranTubuh(pose: readonly Titik[] | null): number | null {
  if (!pose) return null;
  const atas = KEPALA.map((i) => pose[i]).filter(terlihat);
  const bawah = KAKI.map((i) => pose[i]).filter(terlihat);
  const kepalaKaki = atas.length > 0 && bawah.length > 0 ? Math.max(...bawah.map((t) => t.y)) - Math.min(...atas.map((t) => t.y)) : null;
  const badan = [POSE.BAHU_KIRI, POSE.BAHU_KANAN, POSE.PINGGUL_KIRI, POSE.PINGGUL_KANAN].map((i) => pose[i]);
  let dariBadan: number | null = null;
  if (badan.every(terlihat)) {
    const [bahuKi, bahuKa, pinggulKi, pinggulKa] = badan as Titik[];
    const panjangBadan = (pinggulKi!.y + pinggulKa!.y) / 2 - (bahuKi!.y + bahuKa!.y) / 2;
    if (panjangBadan > 0) dariBadan = panjangBadan / KUALITAS.rasioBadan;
  }
  if (kepalaKaki === null) return dariBadan;
  return dariBadan === null ? kepalaKaki : Math.max(kepalaKaki, dariBadan);
}

/** Rata-rata visibility titik lengan dan tungkai (0–1): seberapa yakin AI. null bila tidak ada orang. */
export function keyakinanTubuh(pose: readonly Titik[] | null): number | null {
  if (!pose) return null;
  const v = ANGGOTA.map((i) => pose[i]?.visibility).filter((x): x is number => x !== undefined);
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/**
 * Masalah kamera pada satu saat. Gelap dan buram diambil dari pengukuran gambar sekali per detik
 * (src/vision/kecerahan.ts); ukuran dan keyakinan dari titik AI frame ini.
 */
export function masalahKualitas(u: { ukuran: number | null; keyakinan: number | null; gelap: boolean; buram?: boolean }): MasalahKualitas | null {
  if (u.gelap) return "gelap";
  if (u.buram) return "buram";
  if (u.ukuran !== null && u.ukuran < KUALITAS.tubuhMin) return "kecil";
  if (u.keyakinan !== null && u.keyakinan < KUALITAS.keyakinanMin) return "ragu";
  return null;
}

/**
 * Masalah yang sudah bertahan ≥ tahanDetik. `sejak` menyimpan kapan masalah yang sama mulai terlihat;
 * fungsi mengembalikan keadaan baru beserta masalah yang aktif (null bila belum cukup lama).
 */
export function tahanMasalah(
  sebelumnya: { masalah: MasalahKualitas | null; sejak: number },
  masalah: MasalahKualitas | null,
  sekarangMs: number,
): { keadaan: { masalah: MasalahKualitas | null; sejak: number }; aktif: MasalahKualitas | null } {
  const keadaan = masalah === sebelumnya.masalah ? sebelumnya : { masalah, sejak: sekarangMs };
  const aktif = keadaan.masalah !== null && sekarangMs - keadaan.sejak >= KUALITAS.tahanDetik * 1000 ? keadaan.masalah : null;
  return { keadaan, aktif };
}

export type CatatanKualitas = { ukuran: number | null; keyakinan: number | null; kurangJelas: MasalahKualitas | null };

/** Ringkasan kualitas satu sesi, disimpan bersama hasil (rincian teknis dan catatan di Hasil). */
export function ringkasKualitas(catatan: readonly CatatanKualitas[]): {
  ukuranTubuh: number | null;
  keyakinan: number | null;
  porsiKurangJelas: number;
  masalahUtama: MasalahKualitas | null;
} {
  const bulat = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
  const hitung = new Map<MasalahKualitas, number>();
  for (const c of catatan) if (c.kurangJelas) hitung.set(c.kurangJelas, (hitung.get(c.kurangJelas) ?? 0) + 1);
  const kurang = [...hitung.values()].reduce((a, b) => a + b, 0);
  const utama = [...hitung.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    ukuranTubuh: bulat(median(catatan.map((c) => c.ukuran).filter((x): x is number => x !== null))),
    keyakinan: bulat(median(catatan.map((c) => c.keyakinan).filter((x): x is number => x !== null))),
    porsiKurangJelas: catatan.length > 0 ? Math.round((100 * kurang) / catatan.length) / 100 : 0,
    masalahUtama: utama,
  };
}
