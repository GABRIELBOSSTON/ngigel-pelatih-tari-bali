// Operasi geometri kecil untuk fitur gerak. Fungsi murni.
import type { Titik } from "../vision/types";

export type Vektor = { x: number; y: number; z: number };

export const kurang = (a: Vektor, b: Vektor): Vektor => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const tengah = (a: Vektor, b: Vektor): Vektor => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
export const panjang = (v: Vektor): number => Math.hypot(v.x, v.y, v.z);

/** Sudut antara dua vektor, dalam derajat (0–180). null bila salah satu vektor nol. */
export function sudutAntara(u: Vektor, v: Vektor): number | null {
  const pu = panjang(u);
  const pv = panjang(v);
  if (pu === 0 || pv === 0) return null;
  const kos = (u.x * v.x + u.y * v.y + u.z * v.z) / (pu * pv);
  return (Math.acos(Math.min(1, Math.max(-1, kos))) * 180) / Math.PI;
}

/** Sudut di titik b yang dibentuk a–b–c, dalam derajat. 180° = lurus (mis. siku terentang). */
export const sudutTigaTitik = (a: Vektor, b: Vektor, c: Vektor): number | null => sudutAntara(kurang(a, b), kurang(c, b));

/** Titik cukup terlihat untuk dipakai; titik tanpa visibility (mis. tangan) dianggap terlihat. */
export const terlihat = (t: Titik | undefined, ambang: number): t is Titik => t !== undefined && (t.visibility ?? 1) >= ambang;

export function median(nilai: number[]): number | null {
  if (nilai.length === 0) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const tengahIdx = Math.floor(urut.length / 2);
  return urut.length % 2 === 1 ? urut[tengahIdx]! : (urut[tengahIdx - 1]! + urut[tengahIdx]!) / 2;
}

/** Nilai pada persentil p (0–100), metode peringkat terdekat; null bila kosong. */
export function persentil(nilai: number[], p: number): number | null {
  if (nilai.length === 0) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  return urut[Math.min(urut.length - 1, Math.floor((p / 100) * urut.length))]!;
}
