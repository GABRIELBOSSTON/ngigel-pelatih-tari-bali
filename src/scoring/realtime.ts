// Umpan balik real-time: warna garis per bagian tubuh (docs/04 bagian 8). Fungsi murni.
// Murid yang sedikit terlambat tidak langsung "merah": setiap bagian dibandingkan dengan frame guru
// yang paling mirip di dalam jendela [t − mundur, t + maju].
import { AMBANG_WARNA_DERAJAT, JENDELA_REALTIME_DETIK, TOLERANSI_FITUR } from "../config";
import type { BagianGambar } from "../vision/garis";
import { JENIS_FITUR, TOLERANSI_JENIS, type FrameFitur, type NamaFitur } from "./fitur";
import type { WarnaKemiripan } from "./types";

const jari = (s: "L" | "R") => [1, 2, 3, 4, 5].map((n) => `tekuk_jari_${n}_${s}` as NamaFitur);

export const FITUR_BAGIAN: Record<BagianGambar, readonly NamaFitur[]> = {
  lenganKiri: ["siku_L", "bahu_L"],
  lenganKanan: ["siku_R", "bahu_R"],
  tungkaiKiri: ["lutut_L", "pinggul_L"],
  tungkaiKanan: ["lutut_R", "pinggul_R"],
  badan: ["miring_badan"],
  tanganKiri: jari("L"),
  tanganKanan: jari("R"),
};

/**
 * Selisih terbesar pada satu bagian, dalam "derajat setara sudut tubuh": selisih dibagi toleransi
 * jenisnya lalu dikali toleransi sudut tubuh. Sudut tubuh tidak berubah; sudut jari (toleransi 25°)
 * ikut longgar, sehingga ambang warna jari menjadi 25° dan 50°. null bila tidak ada fitur bersama.
 */
function selisihBagian(guru: FrameFitur["nilai"], murid: FrameFitur["nilai"], fitur: readonly NamaFitur[]): number | null {
  let terbesar: number | null = null;
  for (const nama of fitur) {
    const g = guru[nama];
    const m = murid[nama];
    if (g === null || g === undefined || m === null || m === undefined) continue;
    const setara = (Math.abs(m - g) / TOLERANSI_JENIS[JENIS_FITUR[nama]]) * TOLERANSI_FITUR.sudutDerajat;
    terbesar = Math.max(terbesar ?? 0, setara);
  }
  return terbesar;
}

export function warnaDariSelisih(derajat: number): WarnaKemiripan {
  if (derajat < AMBANG_WARNA_DERAJAT.hijau) return "hijau";
  if (derajat < AMBANG_WARNA_DERAJAT.kuning) return "kuning";
  return "merah";
}

/**
 * Warna setiap bagian tubuh murid pada waktu video guru `t` (detik).
 * Bagian tanpa data di kedua sisi tidak diberi warna (digambar netral).
 */
export function warnaRealtime(guru: readonly FrameFitur[], murid: FrameFitur["nilai"], t: number): Partial<Record<BagianGambar, WarnaKemiripan>> {
  const dari = t - JENDELA_REALTIME_DETIK.mundur;
  const sampai = t + JENDELA_REALTIME_DETIK.maju;
  const calon = guru.filter((f) => f.t >= dari && f.t <= sampai);
  const hasil: Partial<Record<BagianGambar, WarnaKemiripan>> = {};
  for (const [bagian, fitur] of Object.entries(FITUR_BAGIAN) as [BagianGambar, readonly NamaFitur[]][]) {
    let terkecil: number | null = null;
    for (const f of calon) {
      const s = selisihBagian(f.nilai, murid, fitur);
      if (s !== null) terkecil = Math.min(terkecil ?? Number.POSITIVE_INFINITY, s);
    }
    if (terkecil !== null) hasil[bagian] = warnaDariSelisih(terkecil);
  }
  return hasil;
}

/** Warna garis di layar. Kontras dicek terhadap latar kamera gelap maupun terang (garis berbayangan). */
export const KODE_WARNA: Record<WarnaKemiripan, string> = {
  hijau: "#22c55e",
  kuning: "#facc15",
  merah: "#ef4444",
};
