// Segmentasi gerak (docs/04 bagian 5): pokok → agem, peralihan → tangkis, perpindahan → tandang.
// Fungsi murni atas deret fitur.
import { SEGMENTASI } from "../config";
import { JENIS_FITUR, TOLERANSI_JENIS, type FrameFitur, type NamaFitur } from "./fitur";
import { persentil } from "./geometri";

export type JenisSegmen = "pokok" | "peralihan" | "perpindahan";
export type Segmen = { jenis: JenisSegmen; mulaiDetik: number; selesaiDetik: number };

/**
 * Anggota badan untuk mengukur "diam atau bergerak". Kecepatan dihitung per anggota lalu diambil
 * yang tercepat: tangkis sering hanya menggerakkan lengan, dan gerak satu lengan tidak boleh
 * tenggelam oleh tungkai yang diam.
 */
const ANGGOTA_GERAK: ReadonlyArray<readonly NamaFitur[]> = [
  ["siku_L", "bahu_L", "tinggi_siku_L", "tinggi_pergelangan_L"],
  ["siku_R", "bahu_R", "tinggi_siku_R", "tinggi_pergelangan_R"],
  ["lutut_L", "pinggul_L"],
  ["lutut_R", "pinggul_R"],
];

/** Kecepatan gerak per frame, dalam satuan toleransi per detik; null bila tidak ada fitur. */
export function kecepatanGerak(deret: readonly FrameFitur[]): (number | null)[] {
  const mentah = deret.map((f, i) => {
    const sebelum = deret[i - 1];
    if (!sebelum || f.t <= sebelum.t) return null;
    let tercepat: number | null = null;
    for (const anggota of ANGGOTA_GERAK) {
      let jumlah = 0;
      let n = 0;
      for (const nama of anggota) {
        const a = sebelum.nilai[nama];
        const b = f.nilai[nama];
        if (a === null || a === undefined || b === null || b === undefined) continue;
        jumlah += Math.abs(b - a) / TOLERANSI_JENIS[JENIS_FITUR[nama]];
        n += 1;
      }
      if (n > 0) tercepat = Math.max(tercepat ?? 0, jumlah / n / (f.t - sebelum.t));
    }
    return tercepat;
  });
  // Rata-rata bergerak berdasarkan waktu.
  return mentah.map((_, i) => {
    const pusat = deret[i]!.t;
    let jumlah = 0;
    let n = 0;
    for (let j = 0; j < deret.length; j++) {
      const v = mentah[j];
      if (v !== null && v !== undefined && Math.abs(deret[j]!.t - pusat) <= SEGMENTASI.jendelaHalusDetik / 2) {
        jumlah += v;
        n += 1;
      }
    }
    return n > 0 ? jumlah / n : null;
  });
}

/**
 * Posisi mendatar pinggul pada frame terdekat dengan waktu t. Hanya sumbu mendatar: naik-turun
 * pinggul karena lutut ditekuk (agem) bukan perpindahan tempat.
 */
function geserPada(deret: readonly FrameFitur[], t: number): number | null {
  let terbaik: FrameFitur | undefined;
  for (const f of deret) {
    if (f.nilai.geser_x === null || f.nilai.geser_x === undefined) continue;
    if (!terbaik || Math.abs(f.t - t) < Math.abs(terbaik.t - t)) terbaik = f;
  }
  return terbaik ? (terbaik.nilai.geser_x as number) : null;
}

/**
 * Ambang "diam": minimal SEGMENTASI.kecepatanDiam, dinaikkan ke persentil SEGMENTASI.persentilDiam
 * kecepatan deret itu sendiri. Tari dengan jeda diam memakai ambang tetap; tari yang terus mengalir
 * memakai bagian paling tenangnya sebagai sikap pokok.
 */
export function ambangDiam(kecepatan: readonly (number | null)[]): number {
  const ada = kecepatan.filter((v): v is number => v !== null);
  return Math.max(SEGMENTASI.kecepatanDiam, persentil(ada, SEGMENTASI.persentilDiam) ?? 0);
}

/** Label segmen untuk setiap frame. */
export function labelSegmen(deret: readonly FrameFitur[]): JenisSegmen[] {
  const kecepatan = kecepatanGerak(deret);
  const ambang = ambangDiam(kecepatan);
  const label: JenisSegmen[] = deret.map(() => "peralihan");

  // Pokok: diam cukup lama.
  let mulai = -1;
  const tutupRun = (akhir: number) => {
    if (mulai >= 0 && deret[akhir]!.t - deret[mulai]!.t >= SEGMENTASI.minDurasiPokokDetik) {
      for (let k = mulai; k <= akhir; k++) label[k] = "pokok";
    }
    mulai = -1;
  };
  kecepatan.forEach((v, i) => {
    const diam = v !== null && v < ambang;
    if (diam && mulai < 0) mulai = i;
    if (!diam && mulai >= 0) tutupRun(i - 1);
  });
  if (mulai >= 0) tutupRun(deret.length - 1);

  // Perpindahan: pusat pinggul bergeser jauh dalam jendela waktu; mengalahkan label lain.
  const w = SEGMENTASI.jendelaPerpindahanDetik;
  deret.forEach((f, i) => {
    const a = geserPada(deret, f.t - w);
    const b = geserPada(deret, f.t + w);
    if (a !== null && b !== null && Math.abs(b - a) > SEGMENTASI.ambangPerpindahan) label[i] = "perpindahan";
  });
  return label;
}

/**
 * Menggabungkan label per frame menjadi daftar segmen (format JSON pelajaran). Segmen berupa
 * rentang setengah terbuka: berakhir di awal frame berikutnya, supaya segmen satu frame pun
 * punya durasi.
 */
export function keSegmen(deret: readonly FrameFitur[], label: readonly JenisSegmen[]): Segmen[] {
  const segmen: Segmen[] = [];
  const langkah = deret.length > 1 ? deret[1]!.t - deret[0]!.t : 0;
  deret.forEach((f, i) => {
    const jenis = label[i]!;
    const akhir = deret[i + 1]?.t ?? f.t + langkah;
    const terakhir = segmen[segmen.length - 1];
    if (terakhir && terakhir.jenis === jenis) terakhir.selesaiDetik = akhir;
    else segmen.push({ jenis, mulaiDetik: f.t, selesaiDetik: akhir });
  });
  return segmen;
}

/** Kebalikan keSegmen: label per frame dari daftar segmen yang tersimpan di JSON pelajaran. */
export function labelDariSegmen(deret: readonly FrameFitur[], segmen: readonly Segmen[]): JenisSegmen[] {
  const e = 1e-6; // toleransi pembulatan angka di JSON
  return deret.map((f) => segmen.find((s) => f.t >= s.mulaiDetik - e && f.t < s.selesaiDetik - e)?.jenis ?? "peralihan");
}
