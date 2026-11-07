// Seledet sebagai KEJADIAN (docs/04 bagian 6): lirikan yang cepat ke samping. Fungsi murni.
// Definisi IGEL (2023): "gerakan mata ke arah samping kanan dan samping kiri yang disertai dengan
// gerakan dagu serta gerakan muka". Gerak kepala TIDAK dijadikan syarat: pada video Janger, rentang
// gerak kepala saat seledet (median 0,16) sama dengan pada waktu acak (0,16), jadi tidak membedakan
// (docs/09 bagian 11).
import { FPS_ACUAN_PENGHALUSAN, SELEDET } from "../config";
import type { FrameFitur } from "./fitur";
import { median } from "./geometri";

/** arah: +1 = melirik ke kanan PENARI, −1 = ke kiri (tanda lirikan, docs/04 bagian 3). */
export type KejadianSeledet = { t: number; arah: 1 | -1 };

const ada = (v: number | null | undefined): v is number => v !== null && v !== undefined;

/**
 * Batas "cepat" untuk deret dengan selang frame tertentu. maksDurasiDetik ditetapkan pada 15 fps. Pada fps
 * lebih rendah, frame terakhir yang masih netral dan frame pertama yang melewati ambang masing-masing bisa
 * bergeser hingga satu selang frame, jadi batasnya ditambah dua kali selisih selang frame terhadap 15 fps.
 * Simulasi penari yang sama pada 5,3 fps: seledet yang tertangkap naik dari 36% ke 74%, sedangkan pada
 * 15 fps tidak berubah (docs/09 bagian 11).
 */
export function batasCepatDetik(waktu: readonly number[]): number {
  const selang = median(waktu.slice(1).map((t, i) => t - waktu[i]!)) ?? 0;
  return Math.min(SELEDET.batasDurasiDetik, SELEDET.maksDurasiDetik + 2 * Math.max(0, selang - 1 / FPS_ACUAN_PENGHALUSAN));
}

/**
 * Kejadian seledet dalam satu deret. Lirikan diukur relatif terhadap median penari itu sendiri,
 * karena tiap orang punya bias "netral" (Janger: −0,215). Satu kejadian = lirikan relatif melewati
 * ±ambangLirikan, dan dalam batas cepat sebelumnya (batasCepatDetik) masih dekat netral (< ambang/2).
 * Sesudah satu kejadian, lirikan harus kembali dekat netral sebelum kejadian berikutnya dihitung.
 */
export function cariSeledet(deret: readonly FrameFitur[]): KejadianSeledet[] {
  const nilai = deret.flatMap((f) => (ada(f.nilai.lirikan) ? [{ t: f.t, x: f.nilai.lirikan }] : []));
  const netral = median(nilai.map((n) => n.x));
  if (netral === null) return [];
  const a = SELEDET.ambangLirikan;
  const batasCepat = batasCepatDetik(nilai.map((n) => n.t));
  const kejadian: KejadianSeledet[] = [];
  let siap = true;
  let terakhir = Number.NEGATIVE_INFINITY;
  nilai.forEach(({ t, x }, i) => {
    const r = x - netral;
    if (Math.abs(r) < a / 2) siap = true;
    if (!siap || Math.abs(r) < a || t - terakhir < SELEDET.jedaMinDetik) return;
    let cepat = false;
    for (let j = i - 1; j >= 0 && t - nilai[j]!.t <= batasCepat; j--) {
      if (Math.abs(nilai[j]!.x - netral) < a / 2) {
        cepat = true;
        break;
      }
    }
    if (!cepat) return;
    kejadian.push({ t, arah: r > 0 ? 1 : -1 });
    terakhir = t;
    siap = false;
  });
  return kejadian;
}

export type StatusSeledet = "tepat" | "arah-salah" | "terlewat";

export type HasilSeledet = {
  jumlahGuru: number;
  tepat: number;
  arahSalah: number;
  /** Per kejadian guru (detik video guru), untuk penanda di garis waktu. */
  kejadian: { t: number; status: StatusSeledet }[];
};

/**
 * Mencocokkan kejadian guru dengan kejadian murid. `keWaktuMurid` memetakan detik guru ke detik
 * murid yang sepadan (dari jalur DTW), supaya murid yang terlambat tidak dianggap melewatkan seledet.
 * Setiap kejadian murid hanya dipakai sekali.
 */
export function cocokkanSeledet(
  guru: readonly KejadianSeledet[],
  murid: readonly KejadianSeledet[],
  keWaktuMurid: (tGuru: number) => number,
  jendela: number = SELEDET.jendelaCocokDetik,
): HasilSeledet {
  const terpakai = new Set<number>();
  let tepat = 0;
  let arahSalah = 0;
  const kejadian = guru.map((g) => {
    const tm = keWaktuMurid(g.t);
    let terbaik = -1;
    murid.forEach((m, k) => {
      if (terpakai.has(k) || Math.abs(m.t - tm) > jendela) return;
      if (terbaik < 0 || Math.abs(m.t - tm) < Math.abs(murid[terbaik]!.t - tm)) terbaik = k;
    });
    if (terbaik < 0) return { t: g.t, status: "terlewat" as const };
    terpakai.add(terbaik);
    if (murid[terbaik]!.arah === g.arah) {
      tepat += 1;
      return { t: g.t, status: "tepat" as const };
    }
    arahSalah += 1;
    return { t: g.t, status: "arah-salah" as const };
  });
  return { jumlahGuru: guru.length, tepat, arahSalah, kejadian };
}
