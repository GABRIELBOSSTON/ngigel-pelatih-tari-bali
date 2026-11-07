// Dynamic Time Warping dengan jendela Sakoe-Chiba (docs/04 bagian 9). Fungsi murni.
// Menyelaraskan deret murid dengan deret guru supaya gerakan yang sama dibandingkan dengan gerakan
// yang sama, walaupun tempo murid berbeda.
import { DTW_JENDELA } from "../config";

export type HasilDtw = {
  /** Rata-rata jarak sepanjang jalur. */
  biayaRata: number;
  /** Pasangan [indeks guru, indeks murid] dari awal ke akhir. */
  jalur: Array<[number, number]>;
};

export function dtw(n: number, m: number, jarak: (i: number, j: number) => number, jendela: number = DTW_JENDELA): HasilDtw {
  if (n === 0 || m === 0) return { biayaRata: Number.POSITIVE_INFINITY, jalur: [] };
  // Lebar pita minimal |n − m| supaya ujung kedua deret tetap bisa bertemu.
  const lebar = Math.max(Math.ceil(jendela * Math.max(n, m)), Math.abs(n - m));
  const kolom = m + 1;
  const biaya = new Float64Array((n + 1) * kolom).fill(Number.POSITIVE_INFINITY);
  biaya[0] = 0;
  for (let i = 1; i <= n; i++) {
    // Pita mengikuti diagonal yang diskalakan, supaya deret yang panjangnya berbeda tetap tercakup.
    const pusat = Math.round((i * m) / n);
    const dari = Math.max(1, pusat - lebar);
    const sampai = Math.min(m, pusat + lebar);
    for (let j = dari; j <= sampai; j++) {
      const terbaik = Math.min(biaya[(i - 1) * kolom + (j - 1)]!, biaya[(i - 1) * kolom + j]!, biaya[i * kolom + (j - 1)]!);
      biaya[i * kolom + j] = jarak(i - 1, j - 1) + terbaik;
    }
  }

  const jalur: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    jalur.push([i - 1, j - 1]);
    const diag = biaya[(i - 1) * kolom + (j - 1)]!;
    const atas = biaya[(i - 1) * kolom + j]!;
    const kiri = biaya[i * kolom + (j - 1)]!;
    if (diag <= atas && diag <= kiri) {
      i -= 1;
      j -= 1;
    } else if (atas <= kiri) i -= 1;
    else j -= 1;
  }
  jalur.reverse();
  return { biayaRata: biaya[n * kolom + m]! / jalur.length, jalur };
}
