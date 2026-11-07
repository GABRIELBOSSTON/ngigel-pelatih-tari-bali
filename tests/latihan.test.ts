import { describe, expect, it } from "vitest";
import { DAFTAR_KELAS, formatDurasi, KATEGORI, MATERI_CONTOH, materiLatihan, saringKelas, SUMBER } from "../src/katalog/katalog";
import { jendelaGuru, kalimatPetunjuk, kemiripanDariJarak, umpanBalik } from "../src/latihan/petunjuk";
import { bacaRiwayat, buatIdSesi, cariSesi, hapusRiwayat, kemajuanPerKelas, MAKS_SESI, simpanSesi, type SesiTersimpan } from "../src/latihan/riwayat";
import {
  awalGerak,
  bagianTersulit,
  bagiBabak,
  garisWaktu,
  hitungKeterlambatan,
  nilaiSesi,
  potongGuru,
  predikat,
  tubuhLengkap,
  tubuhTerpotong,
} from "../src/latihan/sesi";
import type { FrameFitur } from "../src/scoring/fitur";
import { POSE } from "../src/vision/poseIndex";
import type { HasilDeteksi, Titik } from "../src/vision/types";

/** Satu frame fitur tubuh lengkap dengan nilai bawaan yang wajar. */
const tubuh = (ubah: Partial<FrameFitur["nilai"]> = {}): FrameFitur["nilai"] => ({
  siku_L: 100, siku_R: 100, bahu_L: 80, bahu_R: 80, lutut_L: 150, lutut_R: 150, pinggul_L: 165, pinggul_R: 165,
  miring_badan: 5, tinggi_siku_L: 0, tinggi_siku_R: 0, tinggi_pergelangan_L: 0.1, tinggi_pergelangan_R: 0.1, bentang_lengan: 2,
  ...ubah,
});

const deretGuru = (n: number, ubah: (i: number) => Partial<FrameFitur["nilai"]> = () => ({}), fps = 15): FrameFitur[] =>
  Array.from({ length: n }, (_, i) => ({ t: i / fps, nilai: tubuh(ubah(i)) }));

describe("katalog etalase", () => {
  it("id kelas unik, berupa slug, dan setiap kelas punya sumber yang terdaftar", () => {
    const id = DAFTAR_KELAS.map((k) => k.id);
    expect(new Set(id).size).toBe(id.length);
    for (const k of DAFTAR_KELAS) {
      expect(k.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(k.sumber.length).toBeGreaterThan(0);
      for (const s of k.sumber) expect(SUMBER[s]).toBeDefined();
      expect(KATEGORI.some((c) => c.id === k.kategori)).toBe(true);
    }
    for (const c of KATEGORI) expect(DAFTAR_KELAS.some((k) => k.kategori === c.id)).toBe(true);
  });

  it("kelas tanpa materi memakai video contoh dan ditandai sebagai contoh", () => {
    const pendet = DAFTAR_KELAS.find((k) => k.id === "tari-pendet")!;
    expect(materiLatihan(pendet)).toEqual({ materi: MATERI_CONTOH, contoh: true });
    const janger = DAFTAR_KELAS.find((k) => k.id === "tari-kreasi-janger")!;
    expect(materiLatihan(janger).contoh).toBe(false);
  });

  it("pencarian memaafkan huruf besar dan tanda hubung, dan bisa digabung dengan saringan", () => {
    expect(saringKelas(DAFTAR_KELAS, { kata: "Legong KRATON" }).map((k) => k.id)).toEqual(["legong-kraton"]);
    expect(saringKelas(DAFTAR_KELAS, { kata: "tangkep" }).some((k) => k.id === "gerak-seledet")).toBe(true);
    const dasarPemula = saringKelas(DAFTAR_KELAS, { kategori: "dasar", tingkat: "Pemula" });
    expect(dasarPemula.length).toBeGreaterThan(0);
    expect(dasarPemula.every((k) => k.kategori === "dasar" && k.tingkat === "Pemula")).toBe(true);
    expect(saringKelas(DAFTAR_KELAS, { kata: "xyzzy" })).toEqual([]);
  });

  it("durasi ditulis menit:detik, dibulatkan ke bawah", () => {
    expect(formatDurasi(172.5)).toBe("2:52");
    expect(formatDurasi(59.99)).toBe("0:59");
    expect(formatDurasi(-3)).toBe("0:00");
  });
});

describe("petunjuk saat menari", () => {
  it("kalimat perintah mengikuti arah selisih dan sisi tubuh murid", () => {
    expect(kalimatPetunjuk("siku_R", 20)).toEqual({ teks: "Tekuk siku kanan lebih banyak", bagian: "lenganKanan" });
    expect(kalimatPetunjuk("siku_L", -20)?.teks).toBe("Luruskan siku kiri");
    expect(kalimatPetunjuk("bahu_L", -30)?.teks).toBe("Angkat lengan kiri lebih tinggi");
    expect(kalimatPetunjuk("lutut_L", 25)).toEqual({ teks: "Tekuk lutut kiri lebih dalam", bagian: "tungkaiKiri" });
    expect(kalimatPetunjuk("tinggi_pergelangan_R", 0.3)?.teks).toBe("Turunkan tangan kanan");
    expect(kalimatPetunjuk("lirikan", 1)).toBeNull();
  });

  it("gerak identik: kemiripan 100, tanpa petunjuk, semua bagian hijau", () => {
    const guru = deretGuru(30);
    const ub = umpanBalik(guru, tubuh(), 1);
    expect(ub.kemiripan).toBe(100);
    expect(ub.petunjuk).toBeNull();
    expect(Object.values(ub.warna).every((w) => w === "hijau")).toBe(true);
  });

  it("satu sendi meleset: petunjuk menunjuk sendi itu dan warnanya merah", () => {
    const guru = deretGuru(30);
    const ub = umpanBalik(guru, tubuh({ siku_R: 140 }), 1);
    expect(ub.petunjuk?.teks).toBe("Tekuk siku kanan lebih banyak");
    expect(ub.petunjuk?.selisih).toBe(40);
    expect(ub.warna.lenganKanan).toBe("merah");
    expect(ub.warna.lenganKiri).toBe("hijau");
    expect(ub.kemiripan).toBeLessThan(100);
    expect(ub.kemiripan).toBeGreaterThan(0);
  });

  it("murid terlambat 0,4 detik tetap dianggap mirip (kelonggaran keterlambatan)", () => {
    // Siku guru berubah 60° per detik; murid di detik 2 meniru pose guru di detik 1,6 (frame ke-24).
    const guru = deretGuru(60, (i) => ({ siku_L: 60 + (i / 15) * 60 }));
    const ub = umpanBalik(guru, tubuh({ siku_L: 60 + 1.6 * 60 }), 2);
    expect(ub.kemiripan).toBe(100);
    expect(ub.petunjuk).toBeNull();
  });

  it("bagian yang sudah hijau tidak diberi petunjuk (temuan uji ujung ke ujung 3 Nov 2026)", () => {
    // Frame guru A (t = 0,8): paling mirip secara keseluruhan, tetapi siku kanan berbeda 20°.
    // Frame guru B (t = 1,0): siku kanan sama persis, lutut berbeda 14,9°. Lengan kanan hijau berkat B.
    const guru: FrameFitur[] = [
      { t: 0.8, nilai: tubuh({ siku_R: 120 }) },
      { t: 1.0, nilai: tubuh({ lutut_L: 164.9, lutut_R: 164.9 }) },
    ];
    const ub = umpanBalik(guru, tubuh(), 1);
    expect(ub.warna.lenganKanan).toBe("hijau");
    expect(ub.petunjuk).toBeNull();
  });

  it("jendela guru hanya memuat frame [t − 0,6; t + 0,2] dan kosong di luar deret", () => {
    const guru = deretGuru(60);
    const j = jendelaGuru(guru, 2);
    expect(j[0]!.t).toBeGreaterThanOrEqual(1.4 - 1e-9);
    expect(j[j.length - 1]!.t).toBeLessThanOrEqual(2.2 + 1e-9);
    expect(jendelaGuru(guru, 100)).toEqual([]);
  });

  it("terlalu sedikit fitur bersama: kemiripan tidak dihitung", () => {
    const ub = umpanBalik(deretGuru(30), { siku_L: 100, siku_R: 100 }, 1);
    expect(ub.kemiripan).toBeNull();
    expect(ub.petunjuk).toBeNull();
  });

  it("rumus kemiripan sama dengan rumus skor akhir", () => {
    expect(kemiripanDariJarak(0)).toBe(100);
    expect(kemiripanDariJarak(2)).toBe(37);
  });
});

describe("sesi latihan", () => {
  it("awal gerak melewati pembuka tanpa penari", () => {
    const guru = [...Array.from({ length: 30 }, (_, i) => ({ t: i / 15, nilai: {} })), ...deretGuru(30).map((f) => ({ ...f, t: f.t + 2 }))];
    expect(awalGerak(guru)).toBeCloseTo(1.5);
    expect(awalGerak(deretGuru(10))).toBe(0);
  });

  it("babak ±30 detik, batasnya digeser ke batas segmen terdekat", () => {
    const segmen = [
      { jenis: "peralihan" as const, mulaiDetik: 0, selesaiDetik: 33 },
      { jenis: "pokok" as const, mulaiDetik: 33, selesaiDetik: 100 },
    ];
    const babak = bagiBabak(segmen, { mulai: 0, akhir: 90 });
    expect(babak).toHaveLength(3);
    expect(babak[0]).toEqual({ mulai: 0, akhir: 33 });
    expect(babak[2]!.akhir).toBe(90);
    expect(bagiBabak(segmen, { mulai: 10, akhir: 40 })).toEqual([{ mulai: 10, akhir: 40 }]);
  });

  it("potongan guru menghitung ulang perpindahan dari awal rentang", () => {
    const guru = deretGuru(60, (i) => ({ geser_x: i * 0.1 }));
    const p = potongGuru(guru, { mulai: 2, akhir: 3 });
    expect(p[0]!.t).toBeCloseTo(2);
    expect(p[0]!.nilai.geser_x).toBeCloseTo(0);
    expect(p[p.length - 1]!.nilai.geser_x).toBeCloseTo(1.5);
    expect(guru[30]!.nilai.geser_x).toBeCloseTo(3); // deret asli tidak berubah
  });

  it("keterlambatan = median selisih waktu pasangan DTW", () => {
    const guru = deretGuru(10);
    const murid = guru.map((f) => ({ ...f, t: f.t + 0.5 }));
    const jalur = guru.map((_, i) => [i, i] as [number, number]);
    expect(hitungKeterlambatan(guru, murid, jalur)).toBeCloseTo(0.5);
    expect(hitungKeterlambatan(guru, murid, [])).toBeNull();
  });

  it("garis waktu per detik dan bagian tersulit", () => {
    const sampel = [
      { t: 10.2, kemiripan: 90 },
      { t: 10.8, kemiripan: 70 },
      { t: 12.5, kemiripan: 30 },
      { t: 13.5, kemiripan: 40 },
      { t: 30, kemiripan: 99 }, // di luar rentang
    ];
    const garis = garisWaktu(sampel, { mulai: 10, akhir: 14 });
    expect(garis).toEqual([80, null, 30, 40]);
    // Jendela dengan separuh detik kosong tetap boleh; rata-ratanya dari detik yang ada (30 < 35).
    expect(bagianTersulit(garis, 10, 2)).toEqual({ mulai: 11, akhir: 13 });
    // Jendela yang seluruhnya kosong dilewati, bukan dianggap nilai 0.
    expect(bagianTersulit([90, null, null, 95], 0, 2)).toEqual({ mulai: 0, akhir: 2 });
    expect(bagianTersulit([null, null], 0, 2)).toBeNull();
  });

  it("tubuh lengkap hanya bila kepala sampai pergelangan kaki terlihat di dalam gambar", () => {
    const pose: Titik[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    expect(tubuhLengkap(pose)).toBe(true);
    const tanpaKaki = pose.map((t, i) => (i === POSE.PERGELANGAN_KAKI_KIRI ? { ...t, visibility: 0.1 } : t));
    expect(tubuhLengkap(tanpaKaki)).toBe(false);
    const keluar = pose.map((t, i) => (i === POSE.HIDUNG ? { ...t, y: -0.05 } : t));
    expect(tubuhLengkap(keluar)).toBe(false);
    expect(tubuhLengkap(null)).toBe(false);
    // Saat menari: kaki tertutup badan (berlutut) bukan terpotong; kepala di luar gambar terpotong.
    expect(tubuhTerpotong(tanpaKaki)).toBe(false);
    expect(tubuhTerpotong(keluar)).toBe(true);
    expect(tubuhTerpotong(null)).toBe(false);
  });

  it("tubuh murid jarang terbaca: tidak dinilai, bukan nilai nol", () => {
    const kosong: HasilDeteksi = {
      waktuMs: 0, rasioGambar: 1, pose: null, poseDunia: null, tanganKiri: null, tanganKanan: null, tanganKiriDunia: null, tanganKananDunia: null, wajah: null,
    };
    const rekaman = Array.from({ length: 40 }, (_, i) => ({ ...kosong, waktuMs: i * 200 }));
    const h = nilaiSesi(deretGuru(120), [], rekaman, { mulai: 0, akhir: 8 }, false);
    expect(h).toEqual({ jenis: "kurang-data", tubuhTerbacaPersen: 0, jumlahFrame: 40 });
  });

  it("predikat mengikuti ambang nilai", () => {
    expect(predikat(null)).toBe("Belum bisa dinilai");
    expect(predikat(79)).toBe("Luar biasa!"); // penari identik lewat kamera (docs/09 bagian 10)
    expect(predikat(65)).toBe("Bagus!");
    expect(predikat(50)).toBe("Cukup, terus berlatih");
    expect(predikat(32)).toBe("Ayo coba lagi"); // gerak lain
  });
});

describe("riwayat di peramban", () => {
  const penyimpananPalsu = () => {
    const isi = new Map<string, string>();
    return {
      getItem: (k: string) => isi.get(k) ?? null,
      setItem: (k: string, v: string) => void isi.set(k, v),
      removeItem: (k: string) => void isi.delete(k),
      isi,
    };
  };
  const sesi = (id: string): SesiTersimpan => ({
    id, kelasId: "tari-kreasi-janger", namaKelas: "Tari Kreasi Janger", memakaiContoh: false, videoDariBerkas: false,
    dibuat: "2026-11-03T01:00:00.000Z", mulai: 15, akhir: 45, skorTotal: 72,
    skor: { agem: 70, tandang: null, tangkis: 75, tangkep: 68 }, alasan: { tandang: "tidak-ada-bagian" },
    penyimpangan: [{ unsur: "agem", fitur: "lutut_R", bagian: "lutut kanan", jenis: "terlalu ditekuk", selisihToleransi: 1.4, selisihDerajat: 21, waktuDetik: 20.5 }],
    terlambatDetik: 0.3, tubuhTerbacaPersen: 96, garisWaktu: [80, null, 60], segmen: [{ jenis: "peralihan", mulaiDetik: 15, selesaiDetik: 45 }],
    fpsRata: 5.2, modeAi: "Holistic · CPU", kecepatanPutar: 1,
  });

  it("menyimpan sesi terbaru di depan, mencari, dan membatasi jumlahnya", () => {
    const p = penyimpananPalsu();
    for (let i = 0; i < MAKS_SESI + 5; i++) expect(simpanSesi(sesi(`s${i}`), p)).toBe(true);
    const daftar = bacaRiwayat(p);
    expect(daftar).toHaveLength(MAKS_SESI);
    expect(daftar[0]!.id).toBe(`s${MAKS_SESI + 4}`);
    expect(cariSesi("s10", p)?.skorTotal).toBe(72);
    expect(cariSesi("s0", p)).toBeUndefined();
  });

  it("data rusak atau tidak lolos skema dibuang tanpa galat", () => {
    const p = penyimpananPalsu();
    p.setItem("ngigel.riwayat.v1", "{bukan json");
    expect(bacaRiwayat(p)).toEqual([]);
    p.setItem("ngigel.riwayat.v1", JSON.stringify([sesi("baik"), { id: "rusak" }, 42]));
    expect(bacaRiwayat(p).map((s) => s.id)).toEqual(["baik"]);
  });

  it("tanpa penyimpanan (mode privat): tidak galat, simpan mengembalikan false", () => {
    expect(bacaRiwayat(null)).toEqual([]);
    expect(simpanSesi(sesi("x"), null)).toBe(false);
  });

  it("riwayat bisa dihapus", () => {
    const p = penyimpananPalsu();
    simpanSesi(sesi("a"), p);
    hapusRiwayat(p);
    expect(bacaRiwayat(p)).toEqual([]);
  });

  it("id sesi aman untuk URL", () => {
    expect(buatIdSesi(0, 0)).toBe("0-0000");
    expect(buatIdSesi(Date.UTC(2026, 10, 3), 0.5)).toMatch(/^[a-z0-9]+-[a-z0-9]{4}$/);
  });
});

describe("kemajuan per kelas", () => {
  const s = (id: string, kelasId: string, dibuat: string, skorTotal: number | null): SesiTersimpan => ({
    id, kelasId, namaKelas: kelasId, memakaiContoh: false, videoDariBerkas: false, dibuat, mulai: 0, akhir: 30, skorTotal,
    skor: { agem: null, tandang: null, tangkis: null, tangkep: null }, alasan: {}, penyimpangan: [], terlambatDetik: null,
    tubuhTerbacaPersen: 100, garisWaktu: [], segmen: [], fpsRata: 5, modeAi: "Holistic · CPU", kecepatanPutar: 1,
  });

  it("dikelompokkan per kelas, urut waktu di dalam kelas, kelas terbaru di depan, minimal dua latihan", () => {
    // Riwayat tersimpan terbaru di depan.
    const riwayat = [
      s("4", "pendet", "2026-11-03T04:00:00Z", 70),
      s("3", "janger", "2026-11-03T03:00:00Z", 85),
      s("2", "janger", "2026-11-03T02:00:00Z", null),
      s("1", "janger", "2026-11-03T01:00:00Z", 60),
    ];
    const k = kemajuanPerKelas(riwayat);
    expect(k).toHaveLength(1); // pendet baru sekali
    expect(k[0]!.kelasId).toBe("janger");
    expect(k[0]!.data.map((d) => d.skor)).toEqual([60, null, 85]);
    expect(kemajuanPerKelas(riwayat, 1).map((x) => x.kelasId)).toEqual(["pendet", "janger"]);
  });
});
