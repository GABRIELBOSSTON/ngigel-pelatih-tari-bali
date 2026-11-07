// Satu sesi latihan bersama video guru: rentang latihan, garis waktu kemiripan, dan penilaian akhir.
// Fungsi murni (docs/03 bagian D–E). Waktu murid dicatat dalam detik VIDEO GURU saat frame kamera
// diambil, jadi kecepatan putar 0,5× atau 0,75× tidak dianggap "tempo lambat".
import { SELEDET, VISIBILITY_MIN } from "../config";
import type { Segmen } from "../lessons/schema";
import { hitungDeretFitur, tukarSisi, type FrameFitur } from "../scoring/fitur";
import { nilaiLatihan, type HasilPenilaian } from "../scoring/penilaian";
import { labelDariSegmen } from "../scoring/segmentasi";
import { cariSeledet, cocokkanSeledet, type HasilSeledet } from "../scoring/seledet";
import { POSE } from "../vision/poseIndex";
import type { HasilDeteksi, Titik } from "../vision/types";
import { FITUR_TUBUH } from "./petunjuk";

/** Rentang latihan dalam detik video guru. */
export type Rentang = { mulai: number; akhir: number };

const ada = (v: number | null | undefined): v is number => v !== null && v !== undefined;

const TITIK_WAJIB = [
  POSE.HIDUNG,
  POSE.BAHU_KIRI,
  POSE.BAHU_KANAN,
  POSE.PINGGUL_KIRI,
  POSE.PINGGUL_KANAN,
  POSE.LUTUT_KIRI,
  POSE.LUTUT_KANAN,
  POSE.PERGELANGAN_KAKI_KIRI,
  POSE.PERGELANGAN_KAKI_KANAN,
];

/** Batas tinggi pergelangan di atas hidung untuk gestur mulai, dalam satuan tinggi gambar. */
const MARGIN_GESTUR = 0.05;

/**
 * Kedua pergelangan tangan jelas di atas hidung (koordinat gambar; y kecil = atas). Dipakai sebagai
 * gestur "mulai" di layar persiapan, supaya murid tidak perlu kembali ke laptop.
 */
export function tanganDiAtasKepala(pose: readonly Titik[] | null): boolean {
  if (!pose) return false;
  const terlihat = (t: Titik | undefined): t is Titik => t !== undefined && (t.visibility ?? 1) >= VISIBILITY_MIN;
  const hidung = pose[POSE.HIDUNG];
  const kiri = pose[POSE.PERGELANGAN_KIRI];
  const kanan = pose[POSE.PERGELANGAN_KANAN];
  if (!terlihat(hidung) || !terlihat(kiri) || !terlihat(kanan)) return false;
  return kiri.y < hidung.y - MARGIN_GESTUR && kanan.y < hidung.y - MARGIN_GESTUR;
}

/** Kepala sampai pergelangan kaki terlihat dan berada di dalam gambar (syarat sebelum mulai menari). */
export function tubuhLengkap(pose: readonly Titik[] | null): boolean {
  return (
    pose !== null &&
    TITIK_WAJIB.every((n) => {
      const t = pose[n];
      return t !== undefined && (t.visibility ?? 1) >= VISIBILITY_MIN && t.x >= 0 && t.x <= 1 && t.y >= 0 && t.y <= 1;
    })
  );
}

/**
 * Saat menari: ada bagian tubuh yang benar-benar keluar dari gambar (perkiraan titiknya di luar 0–1).
 * Berbeda dengan tubuhLengkap: kaki yang tertutup badan saat berlutut tetap di dalam gambar, jadi murid
 * tidak disuruh mundur (uji 7 Nov, Janger detik 75–105).
 */
export function tubuhTerpotong(pose: readonly Titik[] | null): boolean {
  return (
    pose !== null &&
    TITIK_WAJIB.some((n) => {
      const t = pose[n];
      return t !== undefined && (t.x < 0 || t.x > 1 || t.y < 0 || t.y > 1);
    })
  );
}

/** Frame guru yang tubuhnya cukup terbaca (minimal separuh fitur tubuh). */
const tubuhTerbaca = (f: FrameFitur) => FITUR_TUBUH.filter((n) => ada(f.nilai[n])).length >= FITUR_TUBUH.length / 2;

/**
 * Awal gerak guru: frame pertama yang tubuhnya terbaca, dikurangi 0,5 detik untuk ancang-ancang.
 * Banyak video dibuka dengan layar kosong atau penari yang baru masuk.
 */
export function awalGerak(guru: readonly FrameFitur[]): number {
  const pertama = guru.find(tubuhTerbaca);
  return pertama ? Math.max(0, pertama.t - 0.5) : 0;
}

/** Akhir gerak guru: frame terakhir yang tubuhnya terbaca, ditambah 0,5 detik. */
export function akhirGerak(guru: readonly FrameFitur[]): number {
  for (let i = guru.length - 1; i >= 0; i--) if (tubuhTerbaca(guru[i]!)) return guru[i]!.t + 0.5;
  return guru[guru.length - 1]?.t ?? 0;
}

/**
 * Membagi rentang menjadi babak ±`target` detik, dengan batas digeser ke batas segmen terdekat
 * (dalam ±25% target) supaya babak tidak terpotong di tengah gerak.
 */
export function bagiBabak(segmen: readonly Segmen[], rentang: Rentang, target = 30): Rentang[] {
  const lama = rentang.akhir - rentang.mulai;
  if (lama <= target * 1.5) return [rentang];
  const jumlah = Math.round(lama / target);
  const batasSegmen = segmen.map((s) => s.mulaiDetik).filter((t) => t > rentang.mulai && t < rentang.akhir);
  const batas = [rentang.mulai];
  for (let k = 1; k < jumlah; k++) {
    const ideal = rentang.mulai + (lama * k) / jumlah;
    let terbaik: number | null = null;
    for (const t of batasSegmen) {
      if (Math.abs(t - ideal) <= target * 0.25 && (terbaik === null || Math.abs(t - ideal) < Math.abs(terbaik - ideal))) terbaik = t;
    }
    batas.push(terbaik ?? ideal);
  }
  batas.push(rentang.akhir);
  return batas.slice(1).map((akhir, i) => ({ mulai: batas[i]!, akhir }));
}

/**
 * Deret guru di dalam rentang. Perpindahan (geser_x, geser_y) dihitung ulang dari posisi awal
 * rentang, karena perpindahan murid juga dihitung dari posisi saat ia mulai.
 */
export function potongGuru(guru: readonly FrameFitur[], rentang: Rentang): FrameFitur[] {
  const potong = guru.filter((f) => f.t >= rentang.mulai && f.t <= rentang.akhir);
  const awalX = potong.find((f) => ada(f.nilai.geser_x))?.nilai.geser_x;
  const awalY = potong.find((f) => ada(f.nilai.geser_y))?.nilai.geser_y;
  return potong.map((f) => {
    const nilai = { ...f.nilai };
    if (ada(nilai.geser_x) && ada(awalX)) nilai.geser_x = nilai.geser_x - awalX;
    if (ada(nilai.geser_y) && ada(awalY)) nilai.geser_y = nilai.geser_y - awalY;
    return { t: f.t, nilai };
  });
}

/**
 * Keterlambatan murid (detik): median selisih waktu pasangan DTW, murid − guru.
 * Positif = murid melakukan gerak yang sama lebih lambat daripada guru.
 */
export function hitungKeterlambatan(guru: readonly FrameFitur[], murid: readonly FrameFitur[], jalur: ReadonlyArray<readonly [number, number]>): number | null {
  const selisih = jalur.map(([i, j]) => murid[j]!.t - guru[i]!.t).sort((a, b) => a - b);
  if (selisih.length === 0) return null;
  return Math.round(selisih[Math.floor(selisih.length / 2)]! * 100) / 100;
}

/** Satu sampel kemiripan saat menari (detik video guru, 0–100). */
export type SampelKemiripan = { t: number; kemiripan: number };

/** Rata-rata kemiripan per `lebar` detik di dalam rentang; null bila tidak ada sampel. */
export function garisWaktu(sampel: readonly SampelKemiripan[], rentang: Rentang, lebar = 1): (number | null)[] {
  const jumlah = Math.max(1, Math.ceil((rentang.akhir - rentang.mulai) / lebar));
  const total = new Array<number>(jumlah).fill(0);
  const n = new Array<number>(jumlah).fill(0);
  for (const s of sampel) {
    const k = Math.floor((s.t - rentang.mulai) / lebar);
    if (k < 0 || k >= jumlah) continue;
    total[k]! += s.kemiripan;
    n[k]! += 1;
  }
  return total.map((v, k) => (n[k]! > 0 ? Math.round(v / n[k]!) : null));
}

/**
 * Jendela `lebar` detik dengan rata-rata kemiripan terendah (bagian tersulit), sebagai rentang
 * video guru. null bila jendela itu tidak punya sampel sama sekali.
 */
export function bagianTersulit(garis: readonly (number | null)[], mulai: number, lebar = 8): Rentang | null {
  const panjang = Math.min(lebar, garis.length);
  let terbaik: { k: number; rata: number } | null = null;
  for (let k = 0; k + panjang <= garis.length; k++) {
    const isi = garis.slice(k, k + panjang).filter(ada);
    if (isi.length < panjang / 2) continue;
    const rata = isi.reduce((a, b) => a + b, 0) / isi.length;
    if (!terbaik || rata < terbaik.rata) terbaik = { k, rata };
  }
  return terbaik ? { mulai: mulai + terbaik.k, akhir: mulai + terbaik.k + panjang } : null;
}

/** Hasil seledet sesi; null bila rentang guru tidak punya seledet. */
export type RingkasanSeledet = HasilSeledet | { tidakTerbaca: true; jumlahGuru: number };

export type HasilSesi =
  | {
      jenis: "nilai";
      penilaian: HasilPenilaian;
      terlambatDetik: number | null;
      tubuhTerbacaPersen: number;
      seledet: RingkasanSeledet | null;
    }
  | { jenis: "kurang-data"; tubuhTerbacaPersen: number; jumlahFrame: number };

/** Minimal frame murid yang tubuhnya terbaca supaya nilai layak dihitung (±2 detik pada 5 fps). */
export const MIN_FRAME_TERBACA = 10;

/**
 * Peta detik guru → detik murid yang sepadan, dari jalur DTW (median waktu murid yang dipasangkan
 * dengan frame guru terdekat). Dipakai untuk mencocokkan kejadian seledet.
 */
export function petaWaktuMurid(guru: readonly FrameFitur[], murid: readonly FrameFitur[], jalur: ReadonlyArray<readonly [number, number]>): (tGuru: number) => number {
  const pasangan = new Map<number, number[]>();
  for (const [i, j] of jalur) {
    const daftar = pasangan.get(i) ?? [];
    daftar.push(murid[j]!.t);
    pasangan.set(i, daftar);
  }
  return (tGuru) => {
    let terdekat = 0;
    guru.forEach((f, i) => {
      if (Math.abs(f.t - tGuru) < Math.abs(guru[terdekat]!.t - tGuru)) terdekat = i;
    });
    const waktu = pasangan.get(terdekat);
    if (!waktu || waktu.length === 0) return tGuru;
    const urut = [...waktu].sort((a, b) => a - b);
    return urut[Math.floor(urut.length / 2)]!;
  };
}

/** Seledet guru vs murid. Guru yang memperagakan cermin ditukar sisinya dulu (arah lirikan berbalik). */
export function nilaiSeledet(guru: readonly FrameFitur[], murid: readonly FrameFitur[], jalur: ReadonlyArray<readonly [number, number]>, guruMemperagakanCermin: boolean): RingkasanSeledet | null {
  const guruDipakai = guruMemperagakanCermin ? guru.map((f) => ({ t: f.t, nilai: tukarSisi(f.nilai) })) : guru;
  const kejadianGuru = cariSeledet(guruDipakai);
  if (kejadianGuru.length === 0) return null;
  const berlirikan = murid.filter((f) => f.nilai.lirikan !== null && f.nilai.lirikan !== undefined).length;
  if (murid.length === 0 || berlirikan / murid.length < SELEDET.minPorsiTerbaca) return { tidakTerbaca: true, jumlahGuru: kejadianGuru.length };
  return cocokkanSeledet(kejadianGuru, cariSeledet(murid), petaWaktuMurid(guruDipakai, murid, jalur));
}

/**
 * Penilaian akhir sesi. `rekaman` = hasil deteksi kamera dengan waktuMs = waktu video guru.
 * Guru dipotong sesuai rentang; murid dihaluskan dengan rumus yang sama seperti guru (hitungDeretFitur).
 */
export function nilaiSesi(guru: readonly FrameFitur[], segmen: readonly Segmen[], rekaman: readonly HasilDeteksi[], rentang: Rentang, guruMemperagakanCermin: boolean): HasilSesi {
  const terbaca = rekaman.filter((h) => h.poseDunia !== null).length;
  const tubuhTerbacaPersen = rekaman.length > 0 ? Math.round((100 * terbaca) / rekaman.length) : 0;
  if (terbaca < MIN_FRAME_TERBACA) return { jenis: "kurang-data", tubuhTerbacaPersen, jumlahFrame: rekaman.length };

  const guruPotong = potongGuru(guru, rentang);
  const murid = hitungDeretFitur([...rekaman].sort((a, b) => a.waktuMs - b.waktuMs));
  const penilaian = nilaiLatihan(guruPotong, labelDariSegmen(guruPotong, segmen), murid, { guruMemperagakanCermin });
  return {
    jenis: "nilai",
    penilaian,
    terlambatDetik: hitungKeterlambatan(guruPotong, murid, penilaian.jalur),
    tubuhTerbacaPersen,
    seledet: nilaiSeledet(guruPotong, murid, penilaian.jalur, guruMemperagakanCermin),
  };
}

/**
 * Kata penilaian untuk skor total. Batasnya mengikuti lantai derau yang terukur (docs/09 bagian 10):
 * penari yang identik dengan guru mendapat ±79 lewat kamera, jadi 75 ke atas sudah "luar biasa".
 */
export const BATAS_PREDIKAT = { luarBiasa: 75, bagus: 60, cukup: 45 } as const;

export function predikat(skor: number | null): string {
  if (skor === null) return "Belum bisa dinilai";
  if (skor >= BATAS_PREDIKAT.luarBiasa) return "Luar biasa!";
  if (skor >= BATAS_PREDIKAT.bagus) return "Bagus!";
  if (skor >= BATAS_PREDIKAT.cukup) return "Cukup, terus berlatih";
  return "Ayo coba lagi";
}
