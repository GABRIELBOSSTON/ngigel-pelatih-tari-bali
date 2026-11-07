// Mutu gambar kamera: kecerahan untuk saran "tambah cahaya" (docs/03 bagian G) dan ketajaman untuk
// saran "gambar buram" (gerbang kualitas, docs/04 bagian 8). Fungsi murni; tidak ada gambar yang disimpan.

/** Rata-rata luma (0–255, rumus Rec. 601) dari data RGBA; null bila kosong. */
export function rataKecerahan(data: ArrayLike<number>): number | null {
  const piksel = Math.floor(data.length / 4);
  if (piksel === 0) return null;
  let jumlah = 0;
  for (let i = 0; i < piksel * 4; i += 4) jumlah += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  return jumlah / piksel;
}

/** Kontras minimal (variansi luma) supaya ketajaman bisa dinilai; gambar hampir rata (mis. hitam) → null. */
const KONTRAS_MIN = 50;

/**
 * Ketajaman: variansi Laplacian luma dibagi variansi luma. Pembagian membuat ukurannya tidak
 * bergantung pada terang-gelap: uji kamera palsu 320×180 (docs/09 bagian 12) memberi 0,18–0,51 untuk
 * gambar tajam (termasuk gelap dan dinding polos), dan 0,0075 untuk gambar yang diburamkan 3 px.
 */
export function ketajaman(data: ArrayLike<number>, lebar: number, tinggi: number): number | null {
  if (lebar < 3 || tinggi < 3 || data.length < lebar * tinggi * 4) return null;
  const luma = new Float32Array(lebar * tinggi);
  for (let i = 0; i < luma.length; i++) luma[i] = 0.299 * data[4 * i]! + 0.587 * data[4 * i + 1]! + 0.114 * data[4 * i + 2]!;
  let n = 0;
  let jl = 0;
  let jl2 = 0;
  let jg = 0;
  let jg2 = 0;
  for (let y = 1; y < tinggi - 1; y++) {
    for (let x = 1; x < lebar - 1; x++) {
      const i = y * lebar + x;
      const g = luma[i]!;
      const l = 4 * g - luma[i - 1]! - luma[i + 1]! - luma[i - lebar]! - luma[i + lebar]!;
      jl += l;
      jl2 += l * l;
      jg += g;
      jg2 += g * g;
      n += 1;
    }
  }
  const varLaplacian = jl2 / n - (jl / n) ** 2;
  const varLuma = jg2 / n - (jg / n) ** 2;
  return varLuma < KONTRAS_MIN ? null : varLaplacian / varLuma;
}
