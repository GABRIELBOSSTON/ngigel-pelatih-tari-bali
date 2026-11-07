import { describe, expect, it } from "vitest";
import { KESALAHAN } from "../src/config";
import { bandingkanFitur, kartuDariFrame, kebalikPada, PemantauKesalahan, tertinggalPada, type KartuKesalahan } from "../src/latihan/kesalahan";
import type { Petunjuk } from "../src/latihan/petunjuk";
import { tukarSisi, type FrameFitur } from "../src/scoring/fitur";

// Tinggi tangan dalam panjang badan: positif = di atas bahu.
const kananAtas = { tinggi_pergelangan_R: 0.4, tinggi_pergelangan_L: -0.3 };
const kiriAtas = { tinggi_pergelangan_R: -0.3, tinggi_pergelangan_L: 0.4 };
const sejajar = { tinggi_pergelangan_R: 0.05, tinggi_pergelangan_L: 0 };
type Nilai = FrameFitur["nilai"];
/** Deret guru 0–4 detik (15 fps): pose `sebelum` sampai detik `ganti`, lalu pose `sesudah`. Dinilai pada T. */
const T = 3.5;
const guru = (sesudah: Nilai, sebelum: Nilai = sesudah, ganti = 0): FrameFitur[] =>
  Array.from({ length: 61 }, (_, i) => ({ t: i / 15, nilai: i / 15 < ganti ? sebelum : sesudah }));

const petunjuk = (p: Partial<Petunjuk>): Petunjuk => ({
  teks: "Tekuk siku kanan lebih banyak",
  bagian: "lenganKanan",
  fitur: "siku_R",
  nilaiGuru: 90,
  nilaiMurid: 150,
  selisih: 60,
  selisihToleransi: 4,
  ...p,
});

describe("kartu kesalahan: kebalik dan perbandingan guru–murid", () => {
  it("kebalik bila murid jelas mengangkat tangan yang berlawanan dengan guru di jendela waktunya", () => {
    expect(kebalikPada(guru(kananAtas), T, kiriAtas)).toBe(true);
    expect(kebalikPada(guru(kiriAtas), T, kananAtas)).toBe(false);
    expect(kebalikPada(guru(kananAtas), T, kananAtas)).toBeNull();
    // Tangan murid hampir sejajar: belum jelas kebalik.
    expect(kebalikPada(guru(kananAtas), T, sejajar)).toBeNull();
    // Guru sejajar: tidak ada yang bisa tertukar.
    expect(kebalikPada(guru(sejajar), T, kiriAtas)).toBeNull();
    // Guru baru saja berganti dari sejajar: yang dihitung hanya frame yang jelas.
    expect(kebalikPada(guru(kananAtas, sejajar, 3.2), T, kiriAtas)).toBe(true);
  });

  it("murid yang tertinggal (meniru pose guru 1,5 detik lalu) bukan kebalik", () => {
    // Guru mengangkat tangan kiri sampai detik 2,5, lalu tangan kanan. Murid masih tangan kiri di detik 3,5.
    expect(kebalikPada(guru(kananAtas, kiriAtas, 2.5), T, kiriAtas)).toBeNull();
    // Bila guru sejak tadi mengangkat tangan kanan, murid yang mengangkat tangan kiri memang kebalik.
    expect(kebalikPada(guru(kananAtas), T, kiriAtas)).toBe(true);
  });

  it("murid yang tertinggal dikenali beserta perkiraan keterlambatannya; yang tepat waktu tidak", () => {
    // Guru terus bergerak: siku dan bahu berayun dengan periode 3 detik.
    const pose = (t: number): Nilai => {
      const s = Math.sin((2 * Math.PI * t) / 3);
      const c = Math.cos((2 * Math.PI * t) / 3);
      return { siku_L: 90 + 60 * s, siku_R: 90 + 60 * c, bahu_L: 60 + 30 * s, bahu_R: 60 + 30 * c, lutut_L: 160, lutut_R: 160 };
    };
    const bergerak = Array.from({ length: 61 }, (_, i) => ({ t: i / 15, nilai: pose(i / 15) }));
    expect(tertinggalPada(bergerak, T, pose(T - 1.5))).toBeCloseTo(1.5, 5);
    expect(tertinggalPada(bergerak, T, pose(T))).toBeNull();
    const k = kartuDariFrame(bergerak, T, pose(T - 1.5), petunjuk({}))!;
    expect(k.kunci).toBe("tertinggal");
    expect(k.saran).toBe("Percepat: gerak Anda ±1,5 detik di belakang guru");
  });

  it("murid yang kebalik pada tari bergantian sisi tidak dianggap tertinggal", () => {
    // Guru mengangkat tangan kanan sampai detik 2, lalu gerak yang sama di sisi kiri.
    const kanan: Nilai = { siku_L: 90, siku_R: 170, bahu_L: 30, bahu_R: 120, tinggi_pergelangan_L: -0.4, tinggi_pergelangan_R: 0.4, lutut_L: 160, lutut_R: 160 };
    const kiri = tukarSisi(kanan);
    const bergantian = guru(kiri, kanan, 2);
    // Murid kebalik di detik 3,5: gerak sisi kanan, sama dengan guru 1,5 detik lalu.
    expect(tertinggalPada(bergantian, T, kanan)).toBeNull();
  });

  it("kartu kebalik ditulis dalam bahasa sederhana, sisi menurut tubuh murid sendiri", () => {
    const k = kartuDariFrame(guru(kananAtas), T, kiriAtas, null)!;
    expect(k.judul).toBe("Kebalik kiri–kanan");
    expect(k.guru).toBe("tangan kanan di atas, tangan kiri di bawah");
    expect(k.anda).toBe("tangan kanan di bawah, tangan kiri di atas");
    expect(k.saran).toBe("Tukar: angkat tangan kanan, turunkan tangan kiri");
  });

  it("kebalik ke dua arah adalah satu jenis kesalahan; teksnya mengikuti arah guru", () => {
    const a = kartuDariFrame(guru(kananAtas), T, kiriAtas, null)!;
    const b = kartuDariFrame(guru(kiriAtas), T, kananAtas, null)!;
    expect(a.kunci).toBe(b.kunci);
    expect(b.saran).toBe("Tukar: angkat tangan kiri, turunkan tangan kanan");
  });

  it("kebalik didahulukan; petunjuk biasa hanya menjadi kartu bila selisihnya jelas besar", () => {
    expect(kartuDariFrame(guru(kananAtas), T, kiriAtas, petunjuk({}))!.kunci).toMatch(/^kebalik/);
    expect(kartuDariFrame([], T, {}, petunjuk({ selisihToleransi: KESALAHAN.selisihMin - 0.1 }))).toBeNull();
    const k = kartuDariFrame([], T, {}, petunjuk({}))!;
    expect(k.saran).toBe("Tekuk siku kanan lebih banyak");
    expect(k.guru).toBe("siku kanan ditekuk (±90°)");
    expect(k.anda).toBe("siku kanan ±150°, kurang ditekuk");
  });

  it("perbandingan letak tangan: kategori sama → arah terhadap guru", () => {
    expect(bandingkanFitur("tinggi_pergelangan_L", 0.3, -0.4)).toEqual({ guru: "tangan kiri di atas bahu", anda: "tangan kiri di bawah bahu" });
    expect(bandingkanFitur("tinggi_pergelangan_L", -0.2, -0.6)).toEqual({ guru: "tangan kiri di bawah bahu", anda: "tangan kiri lebih rendah dari guru" });
    expect(bandingkanFitur("miring_badan", 10, 30)).toBeNull();
  });
});

describe("pemantau kesalahan berulang", () => {
  const kartu = (kunci: string): KartuKesalahan => ({ kunci, judul: "x", guru: null, anda: null, saran: kunci, ucapan: kunci });
  const langkah = 200; // 5 frame per detik

  it("satu atau dua frame jelek tidak memunculkan kartu", () => {
    const p = new PemantauKesalahan();
    let t = 0;
    for (let i = 0; i < 10; i++, t += langkah) expect(p.amati(t, i === 3 || i === 7 ? kartu("a") : null, 0).kartu).toBeNull();
  });

  it("kesalahan yang mendominasi memunculkan kartu sekali, bertahan selama berlanjut, lalu hilang", () => {
    const p = new PemantauKesalahan();
    let t = 0;
    const tampil: (string | null)[] = [];
    let baru = 0;
    for (let i = 0; i < 40; i++, t += langkah) {
      const r = p.amati(t, i < 25 ? kartu("a") : null, 40 + i * 0.2);
      tampil.push(r.kartu?.kunci ?? null);
      if (r.baru) baru += 1;
    }
    expect(baru).toBe(1);
    expect(tampil[KESALAHAN.frameMin - 1]).toBe("a");
    expect(tampil[24]).toBe("a");
    expect(tampil[39]).toBeNull();
    expect(p.catatan.get("a")).toMatchObject({ kali: 1 });
  });

  it("kesalahan pendek yang terjadi berkali-kali (≥ kejadianMin dalam 15 detik) juga memunculkan kartu", () => {
    const p = new PemantauKesalahan();
    let t = 0;
    let baru = 0;
    // Kejadian 0,4 detik (2 frame), lalu 2 detik benar; diulang. Tidak pernah mendominasi jendela 2,5 detik.
    for (let ulang = 0; ulang < KESALAHAN.kejadianMin; ulang++) {
      expect(baru).toBe(0);
      for (let i = 0; i < 2; i++, t += langkah) if (p.amati(t, kartu("kebalik"), 0).baru) baru += 1;
      for (let i = 0; i < 10; i++, t += langkah) p.amati(t, null, 0);
    }
    expect(baru).toBe(1);
    // Dua kejadian saja belum cukup.
    const q = new PemantauKesalahan();
    t = 0;
    for (let ulang = 0; ulang < KESALAHAN.kejadianMin - 1; ulang++) {
      for (let i = 0; i < 2; i++, t += langkah) expect(q.amati(t, kartu("kebalik"), 0).baru).toBe(false);
      for (let i = 0; i < 10; i++, t += langkah) q.amati(t, null, 0);
    }
  });

  it("kartu yang butuh dominan (tertinggal) tidak muncul dari kejadian sesekali", () => {
    const p = new PemantauKesalahan();
    const lambat = { ...kartu("tertinggal"), butuhDominan: true };
    let t = 0;
    for (let ulang = 0; ulang < KESALAHAN.kejadianMin + 1; ulang++) {
      for (let i = 0; i < 2; i++, t += langkah) expect(p.amati(t, lambat, 0).baru).toBe(false);
      for (let i = 0; i < 10; i++, t += langkah) p.amati(t, null, 0);
    }
    let baru = 0;
    for (let i = 0; i < 10; i++, t += langkah) if (p.amati(t, lambat, 0).baru) baru += 1;
    expect(baru).toBe(1);
  });

  it("kartu yang sama tidak muncul lagi sebelum jeda ulang lewat", () => {
    const p = new PemantauKesalahan();
    let t = 0;
    const jalankan = (n: number, k: string | null) => {
      let baru = 0;
      for (let i = 0; i < n; i++, t += langkah) if (p.amati(t, k ? kartu(k) : null, 0).baru) baru += 1;
      return baru;
    };
    expect(jalankan(10, "a")).toBe(1);
    expect(jalankan(30, null)).toBe(0); // 6 detik tanpa kesalahan: kartu hilang
    expect(jalankan(10, "a")).toBe(0); // masih dalam jeda ulang
    expect(jalankan(40, null)).toBe(0);
    expect(jalankan(10, "a")).toBe(1); // jeda ulang sudah lewat
    expect(p.catatan.get("a")!.kali).toBe(2);
  });
});
