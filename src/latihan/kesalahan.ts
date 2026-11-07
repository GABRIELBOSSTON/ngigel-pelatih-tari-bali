// Kartu "kesalahan berulang" saat menari (usul ketua tim 4 Nov 2026; ngigel/RENCANA_FITUR_LANJUTAN.md
// bagian 3). Petunjuk biasa berganti tiap 1,5 detik dan mudah terlewat. Bila murid mengulang kesalahan
// yang sama, layar menampilkan kartu besar yang membandingkan guru dan murid dalam bahasa sederhana,
// termasuk kesalahan "kebalik" (kiri–kanan tertukar). Video tetap berjalan. Ambang di KESALAHAN (config).
import { JENDELA_REALTIME_DETIK, KESALAHAN } from "../config";
import { tukarSisi, type FrameFitur, type NamaFitur } from "../scoring/fitur";
import { frameGuruTerdekat, jarakTubuh, type Petunjuk } from "./petunjuk";

type Nilai = FrameFitur["nilai"];

const ada = (v: number | null | undefined): v is number => v !== null && v !== undefined;

export type KartuKesalahan = {
  /** Jenis kesalahan; kartu yang sama tidak dimunculkan berulang-ulang. */
  kunci: string;
  judul: string;
  /** "Guru: …" dan "Anda: …"; null bila fitur ini tidak punya perbandingan yang jelas. */
  guru: string | null;
  anda: string | null;
  /** Perintah perbaikan, ditampilkan paling besar. */
  saran: string;
  /** Kalimat pendek untuk pelatih suara. */
  ucapan: string;
  /** Hanya boleh muncul bila mendominasi jendela, tidak dari kejadian sesekali (mis. "tertinggal"). */
  butuhDominan?: boolean;
};

const SISI = { L: "kiri", R: "kanan" } as const;

/** Tinggi tangan kanan − kiri (panjang badan); positif = tangan kanan lebih tinggi. */
function bedaTangan(n: Nilai): number | null {
  const kanan = n.tinggi_pergelangan_R;
  const kiri = n.tinggi_pergelangan_L;
  return ada(kanan) && ada(kiri) ? kanan - kiri : null;
}

/** Beda tangan guru yang jelas tidak sejajar, untuk frame dengan dari ≤ t ≤ sampai (deret urut waktu). */
function bedaJelasAntara(guru: readonly FrameFitur[], dari: number, sampai: number): number[] {
  let kiri = 0;
  let kanan = guru.length;
  while (kiri < kanan) {
    const tengah = (kiri + kanan) >> 1;
    if (guru[tengah]!.t < dari) kiri = tengah + 1;
    else kanan = tengah;
  }
  const hasil: number[] = [];
  for (let i = kiri; i < guru.length && guru[i]!.t <= sampai; i++) {
    const g = bedaTangan(guru[i]!.nilai);
    if (g !== null && Math.abs(g) >= KESALAHAN.bedaTanganMin) hasil.push(g);
  }
  return hasil;
}

/**
 * Kiri–kanan tertukar pada detik video guru t: murid jelas mengangkat satu tangan lebih tinggi, dan
 * - hampir semua frame guru di jendela waktu (−mundur…+maju, seperti umpan balik) yang tangannya jelas
 *   tidak sejajar mengangkat tangan yang lain. Pembandingnya seluruh jendela, bukan frame guru yang
 *   paling mirip, karena frame yang paling mirip dengan murid yang terbalik justru cenderung frame saat
 *   tangan guru sejajar;
 * - pose murid itu TIDAK baru saja dilakukan guru (masaLaluDetik terakhir). Kalau baru saja dilakukan,
 *   murid sekadar tertinggal, bukan kebalik.
 * Mengembalikan arah guru (true = tangan kanan guru lebih tinggi), atau null bila tidak kebalik.
 */
export function kebalikPada(guru: readonly FrameFitur[], t: number, murid: Nilai): boolean | null {
  const m = bedaTangan(murid);
  if (m === null || Math.abs(m) < KESALAHAN.bedaTanganMin) return null;
  const sekarang = bedaJelasAntara(guru, t - JENDELA_REALTIME_DETIK.mundur, t + JENDELA_REALTIME_DETIK.maju);
  if (sekarang.length < 2) return null;
  if (sekarang.filter((g) => Math.sign(g) !== Math.sign(m)).length / sekarang.length < KESALAHAN.porsiKebalik) return null;
  const lalu = bedaJelasAntara(guru, t - KESALAHAN.masaLaluDetik, t - JENDELA_REALTIME_DETIK.mundur);
  if (lalu.length > 0 && lalu.filter((g) => Math.sign(g) === Math.sign(m)).length / lalu.length > KESALAHAN.porsiSamaMaks) return null;
  return m < 0;
}

function kartuKebalik(guruKananLebihTinggi: boolean): KartuKesalahan {
  const [atas, bawah] = guruKananLebihTinggi ? (["kanan", "kiri"] as const) : (["kiri", "kanan"] as const);
  return {
    // Satu kunci untuk kedua arah: ini satu kesalahan yang sama (meniru dengan sisi tertukar).
    kunci: "kebalik-tangan",
    judul: "Kebalik kiri–kanan",
    guru: `tangan ${atas} di atas, tangan ${bawah} di bawah`,
    anda: `tangan ${atas} di bawah, tangan ${bawah} di atas`,
    saran: `Tukar: angkat tangan ${atas}, turunkan tangan ${bawah}`,
    ucapan: `Kebalik. Angkat tangan ${atas}, turunkan tangan ${bawah}.`,
  };
}

/** Letak tangan atau siku terhadap bahu; nilai fitur tinggi_* dalam panjang badan (positif = di atas bahu). */
const letak = (v: number) => (v > 0.1 ? "di atas bahu" : v < -0.1 ? "di bawah bahu" : "setinggi bahu");
const bentuk = (sudut: number) => (sudut >= 160 ? "lurus" : sudut >= 120 ? "agak ditekuk" : "ditekuk");

/**
 * Kalimat "Guru: …" dan "Anda: …" untuk satu fitur. Bila kategorinya sama (mis. keduanya "di bawah
 * bahu"), kalimat murid menyebut arahnya terhadap guru supaya kartu tidak tampak bertentangan.
 * Hanya untuk fitur yang mudah dibayangkan; fitur lain → null (kartu tetap memuat perintahnya).
 */
export function bandingkanFitur(nama: NamaFitur, guru: number, murid: number): { guru: string; anda: string } | null {
  const cocok = /^(.*)_(L|R)$/.exec(nama);
  if (!cocok) return null;
  const dasar = cocok[1]!;
  const s = SISI[cocok[2] as "L" | "R"];
  switch (dasar) {
    case "tinggi_pergelangan":
    case "tinggi_siku": {
      const bagian = dasar === "tinggi_siku" ? `siku ${s}` : `tangan ${s}`;
      const anda = letak(murid) === letak(guru) ? `${murid < guru ? "lebih rendah" : "lebih tinggi"} dari guru` : letak(murid);
      return { guru: `${bagian} ${letak(guru)}`, anda: `${bagian} ${anda}` };
    }
    case "siku":
    case "lutut": {
      const bagian = `${dasar} ${s}`;
      const arah = murid > guru ? "kurang ditekuk" : "terlalu ditekuk";
      return { guru: `${bagian} ${bentuk(guru)} (±${Math.round(guru)}°)`, anda: `${bagian} ±${Math.round(murid)}°, ${arah}` };
    }
    default:
      return null;
  }
}

/**
 * Murid tertinggal: gerak murid kurang cocok dengan guru sekarang, tetapi jauh lebih cocok dengan gerak
 * guru beberapa saat lalu. Mengembalikan perkiraan keterlambatan (detik), atau null.
 * Bukan tertinggal bila gerak murid yang kiri–kanannya ditukar cocok dengan guru SEKARANG: tari yang
 * bergantian sisi (seperti Janger) membuat murid yang kebalik mirip guru beberapa detik lalu. Uji 7 Nov:
 * murid dicerminkan sempat mendapat kartu "tertinggal ±2 detik"; simulasi 8% frame → 0% dengan pemeriksaan ini.
 */
export function tertinggalPada(guru: readonly FrameFitur[], t: number, murid: Nilai): number | null {
  const kini = frameGuruTerdekat(guru, murid, t);
  if (!kini || kini.jarak < KESALAHAN.jarakTertinggalMin) return null;
  const dari = t - KESALAHAN.masaLaluDetik;
  const sampai = t - JENDELA_REALTIME_DETIK.mundur;
  let lalu: { t: number; jarak: number } | null = null;
  for (const f of guru) {
    if (f.t < dari) continue;
    if (f.t > sampai) break;
    const d = jarakTubuh(f.nilai, murid);
    if (d !== null && (lalu === null || d < lalu.jarak)) lalu = { t: f.t, jarak: d };
  }
  if (!lalu || lalu.jarak > KESALAHAN.rasioTertinggal * kini.jarak) return null;
  const cermin = frameGuruTerdekat(guru, tukarSisi(murid), t);
  return cermin && cermin.jarak <= lalu.jarak ? null : t - lalu.t;
}

function kartuTertinggal(lambatDetik: number): KartuKesalahan {
  const kira = String(Math.round(lambatDetik * 2) / 2).replace(".", ",");
  return {
    kunci: "tertinggal",
    judul: "Tertinggal dari guru",
    guru: null,
    anda: null,
    saran: `Percepat: gerak Anda ±${kira} detik di belakang guru`,
    ucapan: "Anda tertinggal. Percepat sedikit.",
    butuhDominan: true,
  };
}

/**
 * Kartu calon dari satu frame murid pada detik video guru t, berurutan:
 * 1. kebalik, kesalahan paling khas saat meniru video;
 * 2. tertinggal, karena bila murid terlambat, petunjuk bagian tubuh menyesatkan (geraknya benar, hanya telat);
 * 3. petunjuk biasa yang selisihnya jelas besar (≥ selisihMin).
 */
export function kartuDariFrame(guru: readonly FrameFitur[], t: number, murid: Nilai, petunjuk: Petunjuk | null): KartuKesalahan | null {
  const kebalik = kebalikPada(guru, t, murid);
  if (kebalik !== null) return kartuKebalik(kebalik);
  const lambat = tertinggalPada(guru, t, murid);
  if (lambat !== null) return kartuTertinggal(lambat);
  if (!petunjuk || petunjuk.selisihToleransi < KESALAHAN.selisihMin) return null;
  const banding = bandingkanFitur(petunjuk.fitur, petunjuk.nilaiGuru, petunjuk.nilaiMurid);
  return {
    kunci: `petunjuk-${petunjuk.teks}`,
    judul: "Kesalahan berulang",
    guru: banding?.guru ?? null,
    anda: banding?.anda ?? null,
    saran: petunjuk.teks,
    ucapan: petunjuk.teks,
  };
}

export type CatatanKesalahan = { kartu: KartuKesalahan; kali: number; detikVideo: number };

/**
 * Memantau kartu calon dari waktu ke waktu. Kartu tampil bila satu jenis kesalahan mendominasi jendela
 * pengamatan, atau terjadi berkali-kali (≥ kejadianMin kejadian dalam jendelaKejadianDetik). Kartu bertahan
 * selama kesalahannya berlanjut (minimal lamaKartuDetik), lalu jenis yang sama baru boleh muncul lagi
 * setelah jedaUlangDetik. Satu frame jelek tidak memunculkan kartu.
 */
export class PemantauKesalahan {
  private jejak: { t: number; kartu: KartuKesalahan | null }[] = [];
  private tampil: { kartu: KartuKesalahan; sejak: number } | null = null;
  private terakhir = new Map<string, number>();
  /** Rentetan frame berurutan dengan kesalahan yang sama, dan waktu setiap kejadian per jenis. */
  private rentetan: { kunci: string | null; n: number } = { kunci: null, n: 0 };
  private kejadian = new Map<string, number[]>();
  /** Kartu yang pernah tampil di sesi ini, untuk halaman Hasil. */
  readonly catatan = new Map<string, CatatanKesalahan>();

  /** tMs = jam dinding (ms); detikVideo = waktu video guru saat itu. */
  amati(tMs: number, calon: KartuKesalahan | null, detikVideo: number): { kartu: KartuKesalahan | null; baru: boolean } {
    this.jejak.push({ t: tMs, kartu: calon });
    while (this.jejak.length > 0 && tMs - this.jejak[0]!.t > KESALAHAN.jendelaDetik * 1000) this.jejak.shift();

    // Satu kejadian dihitung saat rentetan kesalahan yang sama mencapai kejadianMinFrame frame.
    const kunciIni = calon?.kunci ?? null;
    this.rentetan = kunciIni === this.rentetan.kunci ? { kunci: kunciIni, n: this.rentetan.n + 1 } : { kunci: kunciIni, n: 1 };
    const batasKejadian = KESALAHAN.jendelaKejadianDetik * 1000;
    if (kunciIni !== null && this.rentetan.n === KESALAHAN.kejadianMinFrame) {
      this.kejadian.set(kunciIni, [...(this.kejadian.get(kunciIni) ?? []).filter((w) => tMs - w <= batasKejadian), tMs]);
    }

    // Per jenis: jumlah frame dan kartu terbaru (teksnya mengikuti keadaan sekarang, mis. arah kebalik).
    const hitung = new Map<string, { n: number; kartu: KartuKesalahan }>();
    for (const j of this.jejak) {
      if (!j.kartu) continue;
      hitung.set(j.kartu.kunci, { n: (hitung.get(j.kartu.kunci)?.n ?? 0) + 1, kartu: j.kartu });
    }
    let dominan: { n: number; kartu: KartuKesalahan } | null = null;
    for (const h of hitung.values()) if (!dominan || h.n > dominan.n) dominan = h;
    const lamaKartu = KESALAHAN.lamaKartuDetik * 1000;

    let pemicu: KartuKesalahan | null = null;
    if (dominan && dominan.n >= KESALAHAN.frameMin && dominan.n / this.jejak.length >= KESALAHAN.porsiMin) pemicu = dominan.kartu;
    else if (calon && !calon.butuhDominan && (this.kejadian.get(calon.kunci) ?? []).filter((w) => tMs - w <= batasKejadian).length >= KESALAHAN.kejadianMin)
      pemicu = calon;

    if (pemicu) {
      const kunci = pemicu.kunci;
      if (this.tampil?.kartu.kunci === kunci) {
        // Kesalahan yang sama berlanjut: teksnya diperbarui bila keadaannya berubah (mis. guru ganti tangan).
        if (calon?.kunci === kunci) this.tampil = { kartu: calon, sejak: this.tampil.sejak };
        return { kartu: this.tampil.kartu, baru: false };
      }
      const lalu = this.terakhir.get(kunci);
      const bebas = lalu === undefined || tMs - lalu >= KESALAHAN.jedaUlangDetik * 1000;
      if (bebas && (!this.tampil || tMs - this.tampil.sejak >= lamaKartu)) {
        this.tampil = { kartu: pemicu, sejak: tMs };
        this.terakhir.set(kunci, tMs);
        const c = this.catatan.get(kunci);
        this.catatan.set(kunci, { kartu: c?.kartu ?? pemicu, kali: (c?.kali ?? 0) + 1, detikVideo: c?.detikVideo ?? detikVideo });
        return { kartu: pemicu, baru: true };
      }
    }
    if (this.tampil && tMs - this.tampil.sejak < lamaKartu) return { kartu: this.tampil.kartu, baru: false };
    if (this.tampil) {
      // Jeda ulang dihitung sejak kartu hilang.
      this.terakhir.set(this.tampil.kartu.kunci, tMs);
      this.tampil = null;
    }
    return { kartu: null, baru: false };
  }
}
