// Pemeriksaan arah untuk panel uji tahap 1 (docs/06 bagian 2): memastikan AI membaca kiri–kanan
// secara anatomis, bukan menurut layar. Fungsi murni.
import { UJI_ARAH, VISIBILITY_MIN } from "../config";
import { PERGELANGAN_TANGAN } from "./handIndex";
import { POSE } from "./poseIndex";
import type { Titik } from "./types";

export type SisiTubuh = "kiri" | "kanan" | "sejajar";
export type ArahLirikan = "kanan" | "kiri" | "lurus";

// Sumbu y gambar membesar ke bawah, jadi titik yang lebih tinggi punya y lebih kecil.
function bandingkanTinggi(kiri: Titik, kanan: Titik, selisihMin: number): SisiTubuh {
  const beda = kiri.y - kanan.y;
  if (Math.abs(beda) < selisihMin) return "sejajar";
  return beda > 0 ? "kanan" : "kiri";
}

/** Lengan mana yang lebih tinggi menurut titik pose; null bila salah satu pergelangan tidak terlihat. */
export function lenganLebihTinggi(pose: Titik[] | null, selisihMin: number = UJI_ARAH.selisihTinggi): SisiTubuh | null {
  const kiri = pose?.[POSE.PERGELANGAN_KIRI];
  const kanan = pose?.[POSE.PERGELANGAN_KANAN];
  if (!kiri || !kanan) return null;
  if ((kiri.visibility ?? 1) < VISIBILITY_MIN || (kanan.visibility ?? 1) < VISIBILITY_MIN) return null;
  return bandingkanTinggi(kiri, kanan, selisihMin);
}

/** Tangan mana yang lebih tinggi menurut model tangan; null bila kedua tangan tidak terdeteksi. */
export function tanganLebihTinggi(
  tanganKiri: Titik[] | null,
  tanganKanan: Titik[] | null,
  selisihMin: number = UJI_ARAH.selisihTinggi,
): SisiTubuh | null {
  const kiri = tanganKiri?.[PERGELANGAN_TANGAN];
  const kanan = tanganKanan?.[PERGELANGAN_TANGAN];
  if (!kiri || !kanan) return null;
  return bandingkanTinggi(kiri, kanan, selisihMin);
}

export function arahLirikan(lirikan: number, ambang: number = UJI_ARAH.ambangLirikan): ArahLirikan {
  if (lirikan > ambang) return "kanan";
  if (lirikan < -ambang) return "kiri";
  return "lurus";
}
