// Mesin penilaian (docs/04 bagian 7 dan 9). Fungsi murni.
// 1. Deret murid diselaraskan dengan deret guru memakai DTW.
// 2. Untuk setiap unsur, selisih fitur dihitung hanya pada bagian gerak guru yang sesuai
//    (pokok → agem, peralihan → tangkis, perpindahan → tandang, seluruhnya → tangkep).
// 3. Jarak = akar rata-rata kuadrat selisih dalam satuan toleransi; skor = 100 × exp(−jarak/τ).
import {
  BATAS_FRAME_HILANG,
  BOBOT_KELOMPOK_TERBURUK,
  BOBOT_UNSUR,
  MIN_PORSI_KELOMPOK,
  MIN_SELISIH_KOREKSI,
  MIN_SELISIH_KOREKSI_JARI,
  TAU_UNSUR,
  TOLERANSI_FITUR,
} from "../config";
import { dtw } from "./dtw";
import {
  DAFTAR_FITUR,
  FITUR_UNSUR,
  JENIS_DERAJAT,
  JENIS_FITUR,
  KELOMPOK_UNSUR,
  pusatkanGeser,
  selisihFitur,
  TOLERANSI_JENIS,
  tukarSisi,
  type FrameFitur,
  type NamaFitur,
} from "./fitur";
import type { JenisSegmen } from "./segmentasi";
import { DAFTAR_UNSUR, type Penyimpangan, type SkorUnsur, type Unsur } from "./types";

const SEGMEN_UNSUR: Record<Unsur, JenisSegmen[] | "semua"> = {
  agem: ["pokok"],
  tangkis: ["peralihan"],
  tandang: ["perpindahan"],
  tangkep: "semua",
};

/** Jarak penyelarasan bila dua frame tidak punya fitur bersama (setara 3 toleransi). */
const JARAK_TANPA_DATA = 3;

export type AlasanTanpaSkor = "tidak-ada-bagian" | "tidak-terbaca";

export type HasilPenilaian = {
  skor: SkorUnsur;
  skorTotal: number | null;
  /** Jarak per unsur dalam satuan toleransi (untuk analisis dan kalibrasi). */
  jarak: Record<Unsur, number | null>;
  /** Jarak RMS tiap kelompok bagian tubuh per unsur, mis. agem.lutut (untuk kalibrasi dan koreksi). */
  jarakKelompok: Record<Unsur, Record<string, number>>;
  alasan: Partial<Record<Unsur, AlasanTanpaSkor>>;
  /** Lama murid ÷ lama guru; 1,0 = sama cepat, 1,25 = murid 25% lebih lambat. */
  rasioTempo: number;
  biayaPenyelarasan: number;
  /** Pasangan indeks (guru, murid) hasil DTW, untuk mengukur keterlambatan murid (src/latihan/sesi.ts). */
  jalur: Array<[number, number]>;
  penyimpangan: Penyimpangan[];
};

type Ternormalisasi = Partial<Record<NamaFitur, number>>;

function normalisasi(f: FrameFitur): Ternormalisasi {
  const hasil: Ternormalisasi = {};
  for (const nama of DAFTAR_FITUR) {
    const v = f.nilai[nama];
    if (v !== null && v !== undefined) hasil[nama] = v / TOLERANSI_JENIS[JENIS_FITUR[nama]];
  }
  return hasil;
}

/** Selisih dua nilai ternormalisasi; fitur melingkar (arah_hadap) dibungkus dengan periode 360°/toleransi. */
const beda = (nama: NamaFitur, y: number, x: number) => selisihFitur(nama, y, x, 360 / TOLERANSI_JENIS[JENIS_FITUR[nama]]);

function jarakFrame(a: Ternormalisasi, b: Ternormalisasi): number {
  let jumlah = 0;
  let n = 0;
  for (const nama of DAFTAR_FITUR) {
    const x = a[nama];
    const y = b[nama];
    if (x === undefined || y === undefined) continue;
    jumlah += beda(nama, x, y) ** 2;
    n += 1;
  }
  return n > 0 ? Math.sqrt(jumlah / n) : JARAK_TANPA_DATA;
}

const NAMA_JARI = ["jempol", "telunjuk", "jari tengah", "jari manis", "kelingking"];

/**
 * Bagian tubuh dan arah selisih (murid − guru), sebagai bahan kalimat koreksi (docs/03 bagian E).
 * Sudut sendi yang lebih besar berarti lebih lurus; tinggi yang lebih besar berarti lebih tinggi.
 */
export function uraikan(nama: NamaFitur, selisih: number): { bagian: string; jenis: string } {
  const sisi = nama.endsWith("_L") ? " kiri" : nama.endsWith("_R") ? " kanan" : "";
  const dasar = nama.replace(/_(L|R)$/, "");
  const lebih = selisih > 0;
  const jari = /^tekuk_jari_(\d)$/.exec(dasar);
  if (jari) return { bagian: `${NAMA_JARI[Number(jari[1]) - 1]}${sisi}`, jenis: lebih ? "terlalu lurus" : "terlalu ditekuk" };
  switch (dasar) {
    case "lutut": return { bagian: `lutut${sisi}`, jenis: lebih ? "kurang ditekuk (badan terlalu tinggi)" : "terlalu ditekuk" };
    case "siku": return { bagian: `siku${sisi}`, jenis: lebih ? "terlalu lurus" : "terlalu ditekuk" };
    case "bahu": return { bagian: `lengan${sisi}`, jenis: lebih ? "terangkat terlalu tinggi" : "kurang terangkat" };
    case "pinggul": return { bagian: `pinggul${sisi}`, jenis: lebih ? "terlalu tegak" : "terlalu condong" };
    case "tinggi_siku": return { bagian: `siku${sisi}`, jenis: lebih ? "posisinya terlalu tinggi" : "posisinya kurang tinggi" };
    case "tinggi_pergelangan": return { bagian: `tangan${sisi}`, jenis: lebih ? "terlalu tinggi" : "kurang tinggi" };
    case "miring_badan": return { bagian: "badan", jenis: lebih ? "terlalu miring" : "kurang miring" };
    case "bentang_lengan": return { bagian: "kedua lengan", jenis: lebih ? "terlalu lebar" : "kurang lebar" };
    case "arah_hadap": return { bagian: "badan", jenis: "menghadap ke arah yang berbeda dari guru" };
    case "arah_kepala": return { bagian: "kepala", jenis: "menoleh ke arah yang berbeda dari guru" };
    case "geser_x": return { bagian: "langkah ke samping", jenis: "berbeda dari pola lantai guru" };
    case "geser_y": return { bagian: "langkah maju–mundur", jenis: "berbeda dari guru" };
    case "lirikan": return { bagian: "mata", jenis: "melirik (seledet) ke arah yang berbeda dari guru" };
    default: return { bagian: "wajah", jenis: lebih ? "tersenyum lebih lebar dari guru" : "kurang tersenyum" };
  }
}

const unsurUntuk = (nama: NamaFitur): Unsur => DAFTAR_UNSUR.find((u) => FITUR_UNSUR[u].includes(nama)) ?? "agem";

/** Fitur yang kalimat koreksinya tidak menyebut arah (lihat uraikan). */
const FITUR_TANPA_ARAH: ReadonlySet<NamaFitur> = new Set<NamaFitur>(["arah_hadap", "arah_kepala", "geser_x", "geser_y", "lirikan"]);

/**
 * Kelonggaran waktu (TOLERANSI_FITUR.waktuDetik): nilai guru di frame i dibandingkan dengan nilai
 * murid yang paling dekat dalam ±k frame di sekitar pasangannya j. DTW menyelaraskan gerak secara
 * keseluruhan; kelonggaran ini mencegah fitur yang berubah cepat (lirikan, seledet) dihukum hanya
 * karena meleset sepersekian detik.
 */
function selisihTerdekat(x: number, m: Ternormalisasi[], j: number, k: number, nama: NamaFitur): number | undefined {
  let terbaik: number | undefined;
  for (let jj = Math.max(0, j - k); jj <= Math.min(m.length - 1, j + k); jj++) {
    const y = m[jj]![nama];
    if (y === undefined) continue;
    const d = beda(nama, y, x);
    if (terbaik === undefined || Math.abs(d) < Math.abs(terbaik)) terbaik = d;
  }
  return terbaik;
}

function frameKelonggaran(murid: readonly FrameFitur[]): number {
  const dt = murid.length > 1 ? (murid[murid.length - 1]!.t - murid[0]!.t) / (murid.length - 1) : 0;
  return dt > 0 ? Math.round(TOLERANSI_FITUR.waktuDetik / dt) : 0;
}

/** Jarak unsur dari jarak kelompok-kelompoknya (lihat BOBOT_KELOMPOK_TERBURUK di config). */
function gabungKelompok(jarakKelompok: number[]): number {
  const rataKuadrat = jarakKelompok.reduce((a, d) => a + d * d, 0) / jarakKelompok.length;
  const terburuk = Math.max(...jarakKelompok);
  return Math.sqrt((1 - BOBOT_KELOMPOK_TERBURUK) * rataKuadrat + BOBOT_KELOMPOK_TERBURUK * terburuk * terburuk);
}

export type OpsiPenilaian = { guruMemperagakanCermin?: boolean };

export function nilaiLatihan(
  guru: readonly FrameFitur[],
  labelGuru: readonly JenisSegmen[],
  murid: readonly FrameFitur[],
  opsi: OpsiPenilaian = {},
): HasilPenilaian {
  // Perpindahan dibandingkan sebagai pola terhadap posisi tengah masing-masing (pusatkanGeser).
  const guruDipakai = pusatkanGeser(opsi.guruMemperagakanCermin ? guru.map((f) => ({ t: f.t, nilai: tukarSisi(f.nilai) })) : guru);
  const g = guruDipakai.map(normalisasi);
  const m = pusatkanGeser(murid).map(normalisasi);
  const { jalur, biayaRata } = dtw(g.length, m.length, (i, j) => jarakFrame(g[i]!, m[j]!));

  const k = frameKelonggaran(murid);
  const skor = {} as SkorUnsur;
  const jarak = {} as Record<Unsur, number | null>;
  const jarakKelompok = {} as Record<Unsur, Record<string, number>>;
  const alasan: HasilPenilaian["alasan"] = {};
  for (const unsur of DAFTAR_UNSUR) {
    const segmen = SEGMEN_UNSUR[unsur];
    const pasangan = jalur.filter(([i]) => segmen === "semua" || segmen.includes(labelGuru[i]!));
    const namaKelompok = Object.keys(KELOMPOK_UNSUR[unsur]);
    const kelompok = Object.values(KELOMPOK_UNSUR[unsur]);
    const jumlah = kelompok.map(() => 0);
    const n = kelompok.map(() => 0);
    const nPasangan = kelompok.map(() => 0); // pasangan frame tempat kelompok ini punya data
    let kosong = 0;
    for (const [i, j] of pasangan) {
      let ada = false;
      kelompok.forEach((fitur, kk) => {
        let adaKelompok = false;
        for (const nama of fitur) {
          const x = g[i]![nama];
          if (x === undefined) continue;
          const selisih = selisihTerdekat(x, m, j, k, nama);
          if (selisih === undefined) continue;
          jumlah[kk]! += selisih * selisih;
          n[kk]! += 1;
          adaKelompok = true;
        }
        if (adaKelompok) nPasangan[kk]! += 1;
        ada ||= adaKelompok;
      });
      if (!ada) kosong += 1;
    }
    // Kelompok yang jarang terbaca (mis. jari yang hanya terdeteksi di beberapa frame) tidak dinilai:
    // dengan kelompok terburuk sebagai penentu, sedikit frame berderau tidak boleh menentukan nilai unsur.
    const minPasangan = Math.max(1, MIN_PORSI_KELOMPOK * pasangan.length);
    jarakKelompok[unsur] = Object.fromEntries(
      namaKelompok.flatMap((nama, kk) => (n[kk]! > 0 && nPasangan[kk]! >= minPasangan ? [[nama, Math.sqrt(jumlah[kk]! / n[kk]!)]] : [])),
    );
    const daftarJarak = Object.values(jarakKelompok[unsur]);
    if (pasangan.length === 0) alasan[unsur] = "tidak-ada-bagian";
    else if (daftarJarak.length === 0 || kosong / pasangan.length > BATAS_FRAME_HILANG) alasan[unsur] = "tidak-terbaca";
    jarak[unsur] = alasan[unsur] ? null : gabungKelompok(daftarJarak);
    skor[unsur] = jarak[unsur] === null ? null : Math.round(100 * Math.exp(-jarak[unsur]! / TAU_UNSUR[unsur]));
  }

  // Bobot unsur yang tidak dinilai dibagi ulang ke unsur lain (docs/04 bagian 7).
  let totalBobot = 0;
  let total = 0;
  for (const unsur of DAFTAR_UNSUR) {
    const s = skor[unsur];
    if (s === null) continue;
    total += BOBOT_UNSUR[unsur] * s;
    totalBobot += BOBOT_UNSUR[unsur];
  }

  const lama = (d: readonly FrameFitur[]) => (d.length > 1 ? d[d.length - 1]!.t - d[0]!.t : 0);
  return {
    skor,
    skorTotal: totalBobot > 0 ? Math.round(total / totalBobot) : null,
    jarak,
    jarakKelompok,
    alasan,
    rasioTempo: lama(guru) > 0 ? lama(murid) / lama(guru) : 1,
    biayaPenyelarasan: biayaRata,
    jalur,
    penyimpangan: cariPenyimpangan(guruDipakai, g, m, jalur, labelGuru, k),
  };
}

/**
 * Paling banyak tiga fitur dengan selisih rata-rata terbesar pada bagian gerak unsurnya (bahan kalimat
 * koreksi). Selisih rata-rata di bawah MIN_SELISIH_KOREKSI toleransi tidak dijadikan koreksi: uji ujung
 * ke ujung 3 Nov 2026 menunjukkan penari identik sempat diberi koreksi "kelingking terlalu lurus ±7°",
 * padahal masih jauh di dalam toleransi jari 25°.
 */
function cariPenyimpangan(
  guru: readonly FrameFitur[],
  g: Ternormalisasi[],
  m: Ternormalisasi[],
  jalur: Array<[number, number]>,
  labelGuru: readonly JenisSegmen[],
  k: number,
): Penyimpangan[] {
  const kandidat: Penyimpangan[] = [];
  for (const nama of DAFTAR_FITUR) {
    if (!DAFTAR_UNSUR.some((u) => FITUR_UNSUR[u].includes(nama))) continue; // fitur yang tidak dinilai (geser_y)
    const unsur = unsurUntuk(nama);
    const segmen = SEGMEN_UNSUR[unsur];
    let jumlahNorm = 0;
    let jumlahSelisih = 0;
    let n = 0;
    let terbesar = { nilai: -1, waktu: 0 };
    for (const [i, j] of jalur) {
      if (segmen !== "semua" && !segmen.includes(labelGuru[i]!)) continue;
      const x = g[i]![nama];
      if (x === undefined) continue;
      const selisih = selisihTerdekat(x, m, j, k, nama);
      if (selisih === undefined) continue;
      jumlahNorm += Math.abs(selisih);
      jumlahSelisih += selisih;
      n += 1;
      if (Math.abs(selisih) > terbesar.nilai) terbesar = { nilai: Math.abs(selisih), waktu: guru[i]!.t };
    }
    if (n < 3) continue; // terlalu sedikit pasangan untuk disimpulkan
    // Kalimat seperti "terlalu ditekuk" menyebut arah, jadi selisihnya harus konsisten ke satu arah.
    // Derau ukur bergoyang ke dua arah dan rata-ratanya mendekati nol (uji 7 Nov: penari identik sempat
    // dikoreksi "jari tengah terlalu ditekuk ±14°", padahal rata-rata mutlaknya berasal dari derau).
    // Jari punya ambang sendiri karena bias ukurnya bergantung resolusi kamera (MIN_SELISIH_KOREKSI_JARI).
    const minKoreksi = JENIS_FITUR[nama] === "sudutJari" ? MIN_SELISIH_KOREKSI_JARI : MIN_SELISIH_KOREKSI;
    if (jumlahNorm / n < minKoreksi) continue;
    if (!FITUR_TANPA_ARAH.has(nama) && Math.abs(jumlahSelisih / n) < minKoreksi) continue;
    // Kembali ke satuan asli (derajat, panjang badan) untuk kalimat koreksi.
    const rataMentah = (jumlahSelisih / n) * TOLERANSI_JENIS[JENIS_FITUR[nama]];
    const { bagian, jenis } = uraikan(nama, rataMentah);
    kandidat.push({
      unsur,
      fitur: nama,
      bagian,
      jenis,
      selisihToleransi: jumlahNorm / n,
      ...(JENIS_DERAJAT.has(JENIS_FITUR[nama]) ? { selisihDerajat: Math.round(Math.abs(rataMentah)) } : {}),
      waktuDetik: Math.round(terbesar.waktu * 10) / 10,
    });
  }
  return kandidat.sort((a, b) => b.selisihToleransi - a.selisihToleransi).slice(0, 3);
}
