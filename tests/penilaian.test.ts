import { describe, expect, it } from "vitest";
import { SEGMENTASI } from "../src/config";
import { dtw } from "../src/scoring/dtw";
import { alfaUntuk, hitungDeretFitur, hitungFiturFrame, selisihFitur, TAU_PENGHALUSAN, tukarSisi, type FrameFitur } from "../src/scoring/fitur";
import { sudutTigaTitik } from "../src/scoring/geometri";
import { nilaiLatihan, uraikan } from "../src/scoring/penilaian";
import { warnaDariSelisih, warnaRealtime } from "../src/scoring/realtime";
import { ambangDiam, kecepatanGerak, keSegmen, labelSegmen } from "../src/scoring/segmentasi";
import { POSE } from "../src/vision/poseIndex";
import type { HasilDeteksi, Titik } from "../src/vision/types";

const titik = (x: number, y: number, z = 0, visibility = 0.9): Titik => ({ x, y, z, visibility });

/** Pose dunia sederhana: badan tegak 0,5 m, lengan kiri dengan siku menekuk sudut tertentu. */
function poseDunia(sudutSikuKiri: number): Titik[] {
  const p = Array.from({ length: 33 }, () => titik(0, 0));
  p[POSE.BAHU_KIRI] = titik(0.2, -0.5);
  p[POSE.BAHU_KANAN] = titik(-0.2, -0.5);
  p[POSE.PINGGUL_KIRI] = titik(0.1, 0);
  p[POSE.PINGGUL_KANAN] = titik(-0.1, 0);
  // Lengan atas kiri mendatar ke samping; lengan bawah membentuk sudut di siku.
  p[POSE.SIKU_KIRI] = titik(0.5, -0.5);
  const rad = ((180 - sudutSikuKiri) * Math.PI) / 180;
  p[POSE.PERGELANGAN_KIRI] = titik(0.5 + 0.3 * Math.cos(rad), -0.5 - 0.3 * Math.sin(rad));
  p[POSE.SIKU_KANAN] = titik(-0.5, -0.5);
  p[POSE.PERGELANGAN_KANAN] = titik(-0.8, -0.5);
  for (const [lutut, kaki, x] of [[POSE.LUTUT_KIRI, POSE.PERGELANGAN_KAKI_KIRI, 0.1], [POSE.LUTUT_KANAN, POSE.PERGELANGAN_KAKI_KANAN, -0.1]] as const) {
    p[lutut] = titik(x, 0.45);
    p[kaki] = titik(x, 0.9);
  }
  return p;
}

const hasil = (sudutSiku: number, waktuMs = 0): HasilDeteksi => ({
  waktuMs,
  rasioGambar: 4 / 3,
  pose: poseDunia(sudutSiku).map((t) => ({ ...t, x: 0.5 + t.x * 0.3, y: 0.5 + t.y * 0.4 })),
  poseDunia: poseDunia(sudutSiku),
  tanganKiri: null,
  tanganKanan: null,
  tanganKiriDunia: null,
  tanganKananDunia: null,
  wajah: null,
});

describe("geometri", () => {
  it("sudut siku tegak lurus = 90°, lurus = 180°", () => {
    expect(sudutTigaTitik({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
    expect(sudutTigaTitik({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(180);
  });
});

describe("fitur per frame", () => {
  it("sudut siku, lutut lurus, badan tegak, lengan setinggi bahu", () => {
    const f = hitungFiturFrame(hasil(90));
    expect(f.siku_L).toBeCloseTo(90, 0);
    expect(f.siku_R).toBeCloseTo(180, 0);
    expect(f.lutut_L).toBeCloseTo(180, 0);
    expect(f.miring_badan).toBeCloseTo(0, 0);
    expect(f.tinggi_siku_R).toBeCloseTo(0, 5); // siku sejajar bahu (miles-agem)
  });

  it("titik ragu-ragu membuat fiturnya kosong, bukan nol", () => {
    const h = hasil(90);
    h.poseDunia![POSE.SIKU_KIRI] = { ...h.poseDunia![POSE.SIKU_KIRI]!, visibility: 0.1 };
    const f = hitungFiturFrame(h);
    expect(f.siku_L).toBeNull();
    expect(f.siku_R).not.toBeNull();
    expect(f.lirikan).toBeNull(); // tanpa wajah
  });

  it("tukarSisi menukar kiri–kanan dan membalik arah mendatar", () => {
    const t = tukarSisi({ siku_L: 90, siku_R: 170, lirikan: 0.4, geser_x: 0.2, senyum: 0.5 });
    expect(t).toEqual({ siku_R: 90, siku_L: 170, lirikan: -0.4, geser_x: -0.2, senyum: 0.5 });
  });

  it("perpindahan pinggul diukur relatif posisi awal, dalam satuan panjang badan", () => {
    const frame = [hasil(90, 0), hasil(90, 100)];
    frame[1]!.pose = frame[1]!.pose!.map((t) => ({ ...t, x: t.x + 0.1 }));
    const deret = hitungDeretFitur(frame);
    expect(deret[0]!.nilai.geser_x).toBe(0);
    expect(deret[1]!.nilai.geser_x!).toBeGreaterThan(0);
  });
});

describe("DTW", () => {
  const deret = (n: number, cepat = 1) => Array.from({ length: n }, (_, i) => Math.sin((i * cepat) / 5));

  it("deret identik: biaya 0 dan jalur diagonal", () => {
    const a = deret(40);
    const h = dtw(a.length, a.length, (i, j) => Math.abs(a[i]! - a[j]!));
    expect(h.biayaRata).toBe(0);
    expect(h.jalur.every(([i, j]) => i === j)).toBe(true);
  });

  it("deret yang diperlambat tetap selaras dengan biaya kecil", () => {
    const guru = deret(40);
    const murid = Array.from({ length: 50 }, (_, j) => Math.sin((j * 40) / 50 / 5));
    const h = dtw(guru.length, murid.length, (i, j) => Math.abs(guru[i]! - murid[j]!));
    expect(h.biayaRata).toBeLessThan(0.05);
    expect(h.jalur[0]).toEqual([0, 0]);
    expect(h.jalur[h.jalur.length - 1]).toEqual([39, 49]);
  });
});

const deretSintetis = (n: number, ubah: (i: number) => Partial<FrameFitur["nilai"]> = () => ({})): FrameFitur[] =>
  Array.from({ length: n }, (_, i) => ({
    t: i / 15,
    nilai: {
      // Diam di awal, lalu siku bergerak, lalu diam lagi.
      siku_L: i < 15 ? 90 : i < 30 ? 90 + (i - 15) * 6 : 180,
      siku_R: 170, bahu_L: 90, bahu_R: 90, lutut_L: 150, lutut_R: 150, pinggul_L: 170, pinggul_R: 170,
      tinggi_siku_L: 0, tinggi_siku_R: 0, tinggi_pergelangan_L: 0.2, tinggi_pergelangan_R: 0,
      miring_badan: 5, bentang_lengan: 2, geser_x: 0, geser_y: 0, arah_hadap: 0,
      lirikan: i % 20 < 10 ? 0.4 : -0.4, arah_kepala: 0, senyum: 0.5,
      ...ubah(i),
    },
  }));

describe("segmentasi", () => {
  it("diam → pokok, siku bergerak → peralihan, pinggul berpindah → perpindahan", () => {
    const d = deretSintetis(45);
    const label = labelSegmen(d);
    expect(label[5]).toBe("pokok");
    expect(label[22]).toBe("peralihan");
    expect(label[40]).toBe("pokok");
    const pindah = deretSintetis(45, (i) => ({ geser_x: i * 0.05 }));
    expect(labelSegmen(pindah)[22]).toBe("perpindahan");
    expect(keSegmen(d, label).map((s) => s.jenis)).toEqual(["pokok", "peralihan", "pokok"]);
  });

  it("ambang diam memakai config", () => {
    expect(SEGMENTASI.kecepatanDiam).toBeGreaterThan(0);
  });

  it("ambang diam adaptif: tari yang tidak pernah diam tetap punya sikap pokok di bagian paling tenangnya", () => {
    // Siku kiri bergetar dengan beda per frame naik dari 5° ke 20° (kecepatan ±1,25 → 5 toleransi/detik).
    const d = deretSintetis(60, (i) => ({ siku_L: 100 + (i % 2) * (5 + (15 * i) / 59), lirikan: 0 }));
    const ambang = ambangDiam(kecepatanGerak(d));
    expect(ambang).toBeGreaterThan(SEGMENTASI.kecepatanDiam);
    const label = labelSegmen(d);
    expect(label[5]).toBe("pokok");
    expect(label[45]).toBe("peralihan");
  });

  it("ambang diam tidak pernah di bawah nilai config", () => {
    expect(ambangDiam([0, 0, 0.1, null])).toBe(SEGMENTASI.kecepatanDiam);
    expect(ambangDiam([])).toBe(SEGMENTASI.kecepatanDiam);
  });
});

describe("penilaian", () => {
  const guru = deretSintetis(45);
  const label = labelSegmen(guru);

  it("murid identik dengan guru → 100 di semua unsur yang ada", () => {
    const h = nilaiLatihan(guru, label, guru);
    expect(h.skor.agem).toBe(100);
    expect(h.skor.tangkis).toBe(100);
    expect(h.skor.tangkep).toBe(100);
    expect(h.skor.tandang).toBeNull(); // guru tidak berpindah tempat
    expect(h.alasan.tandang).toBe("tidak-ada-bagian");
    expect(h.skorTotal).toBe(100);
    expect(h.rasioTempo).toBeCloseTo(1);
  });

  it("lutut murid terlalu lurus → agem turun, tangkep tidak berubah, penyimpangan menunjuk lutut", () => {
    const murid = deretSintetis(45, () => ({ lutut_L: 180, lutut_R: 180 }));
    const h = nilaiLatihan(guru, label, murid);
    expect(h.skor.agem!).toBeLessThan(80);
    expect(h.skor.tangkep).toBe(100);
    expect(h.penyimpangan[0]!.fitur).toMatch(/^lutut_/);
    expect(h.penyimpangan[0]!.jenis).toContain("kurang ditekuk");
    expect(h.penyimpangan[0]!.selisihDerajat).toBe(30);
  });

  it("murid lebih lambat 25% → skor tetap tinggi berkat DTW, rasio tempo ≈ 1,25", () => {
    const lambat = Array.from({ length: 56 }, (_, j) => {
      const sumber = guru[Math.min(44, Math.round((j * 44) / 55))]!;
      return { t: j / 15, nilai: sumber.nilai };
    });
    const h = nilaiLatihan(guru, label, lambat);
    expect(h.skorTotal!).toBeGreaterThan(90);
    expect(h.rasioTempo).toBeCloseTo(55 / 44, 2);
  });

  it("guru memperagakan cermin: murid sisi tertukar dinilai tinggi hanya bila opsi aktif", () => {
    const tertukar = guru.map((f) => ({ t: f.t, nilai: tukarSisi(f.nilai) }));
    expect(nilaiLatihan(guru, label, tertukar).skor.tangkis!).toBeLessThan(80);
    expect(nilaiLatihan(guru, label, tertukar, { guruMemperagakanCermin: true }).skor.tangkis).toBe(100);
  });

  it("wajah tidak terbaca → tangkep tidak dinilai dan bobotnya dibagi ulang", () => {
    const tanpaWajah = deretSintetis(45, () => ({ lirikan: null, arah_kepala: null, senyum: null }));
    const h = nilaiLatihan(guru, label, tanpaWajah);
    expect(h.skor.tangkep).toBeNull();
    expect(h.alasan.tangkep).toBe("tidak-terbaca");
    expect(h.skorTotal).toBe(100);
  });

  it("uraian penyimpangan memakai bahasa guru", () => {
    expect(uraikan("lutut_R", 20)).toEqual({ bagian: "lutut kanan", jenis: "kurang ditekuk (badan terlalu tinggi)" });
    expect(uraikan("tinggi_pergelangan_L", -0.2)).toEqual({ bagian: "tangan kiri", jenis: "kurang tinggi" });
    expect(uraikan("tekuk_jari_2_L", 15).bagian).toBe("telunjuk kiri");
  });
});

describe("warna real-time", () => {
  const guru: FrameFitur[] = Array.from({ length: 30 }, (_, i) => ({ t: i / 15, nilai: { siku_L: 90 + i * 3, lutut_L: 150 } }));

  it("ambang warna: < 15° hijau, < 30° kuning, sisanya merah", () => {
    expect(warnaDariSelisih(10)).toBe("hijau");
    expect(warnaDariSelisih(20)).toBe("kuning");
    expect(warnaDariSelisih(40)).toBe("merah");
  });

  it("murid terlambat 0,4 detik dengan gerak benar tetap hijau", () => {
    // Pada t = 1,0 s guru di siku 135°; murid masih di posisi guru 0,4 s sebelumnya (117°).
    const murid = { siku_L: 90 + 9 * 3, lutut_L: 150 };
    expect(warnaRealtime(guru, murid, 1.0).lenganKiri).toBe("hijau");
  });

  it("bagian yang salah merah; bagian tanpa data tidak diberi warna", () => {
    const warna = warnaRealtime(guru, { siku_L: 100, lutut_L: 190 }, 1.0);
    expect(warna.tungkaiKiri).toBe("merah");
    expect(warna.tanganKiri).toBeUndefined();
  });
});

describe("menyusun pelajaran dari ekstraksi", async () => {
  const { susunPelajaran, keSlug } = await import("../src/lessons/susunPelajaran");
  const { labelDariSegmen } = await import("../src/scoring/segmentasi");
  const deret = deretSintetis(45);
  const label = labelSegmen(deret);
  const data = {
    judul: "Gerak Dasar Putri",
    namaGerak: "Agem Kanan",
    guru: { nama: "Penari Uji" },
    sumberVideo: { jenis: "unggahan" as const, lisensi: "CC-BY-SA" as const, kredit: "WikiNgigel, CC BY-SA 4.0" },
    guruMemperagakanCermin: false,
    modelVersi: "uji",
    fps: 15,
  };

  it("hasilnya lolos skema dan segmen bisa dibaca kembali menjadi label yang sama", () => {
    const h = susunPelajaran(data, deret, label);
    expect(h.success).toBe(true);
    const gerak = h.data!.gerak[0]!;
    expect(gerak.id).toBe("agem-kanan");
    expect(gerak.unsurUtama).toEqual(["agem", "tangkis", "tangkep"]);
    // Dibaca kembali dari JSON (frame dan segmen sama-sama dibulatkan), seperti saat latihan.
    expect(labelDariSegmen(gerak.frame, gerak.segmen ?? [])).toEqual(label);
  });

  it("slug aman dari huruf beraksen dan simbol", () => {
    expect(keSlug("Ngelik – Muli Siger (2026)!")).toBe("ngelik-muli-siger-2026");
    expect(keSlug("***")).toBe("pelajaran");
  });
});

describe("fitur arah (temuan uji Janger 3 Nov 2026)", () => {
  const dunia = (ubah: Record<number, Titik>): Titik[] => Array.from({ length: 33 }, (_, i) => ubah[i] ?? titik(0, 0, 0, 0.1));
  const hasilDunia = (poseDunia: Titik[]): HasilDeteksi => ({
    waktuMs: 0, rasioGambar: 16 / 9, pose: null, poseDunia, tanganKiri: null, tanganKanan: null, tanganKiriDunia: null, tanganKananDunia: null, wajah: null,
  });

  it("arah kepala tetap terbatas saat kepala menoleh hampir 90° (jarak mendatar antarmata ≈ 0)", () => {
    // Mata hampir segaris di sumbu x (berbeda 1 mm) tetapi berjarak 6 cm di sumbu z.
    const f = hitungFiturFrame(
      hasilDunia(dunia({ [POSE.HIDUNG]: titik(0.03, -0.6, -0.1), [POSE.MATA_KIRI]: titik(0.0005, -0.62, -0.05), [POSE.MATA_KANAN]: titik(-0.0005, -0.62, -0.11) })),
    );
    expect(f.arah_kepala).toBeCloseTo(0.5, 1); // versi lama: 0,03 ÷ 0,001 = 30
  });

  it("arah hadap melingkar: 179° dan −179° berselisih 2°, bukan 358°", () => {
    expect(selisihFitur("arah_hadap", 179, -179)).toBeCloseTo(-2);
    expect(selisihFitur("arah_hadap", -179, 179)).toBeCloseTo(2);
    expect(selisihFitur("siku_L", 179, -179)).toBe(358); // fitur biasa tidak dibungkus
    expect(selisihFitur("arah_hadap", 179 / 15, -179 / 15, 360 / 15)).toBeCloseTo(-2 / 15); // satuan toleransi
  });

  it("penghalusan arah hadap tidak membalik penari yang membelakangi kamera ke 0°", () => {
    const deret = hitungDeretFitur(
      Array.from({ length: 10 }, (_, i) =>
        // Membelakangi kamera: bahu kiri di sisi kiri gambar; z bergantian sehingga sudutnya +179°/−179°.
        hasilDunia(dunia({ [POSE.BAHU_KIRI]: titik(-0.15, -0.5, i % 2 ? 0.003 : -0.003), [POSE.BAHU_KANAN]: titik(0.15, -0.5, 0), [POSE.PINGGUL_KIRI]: titik(-0.1, 0, 0), [POSE.PINGGUL_KANAN]: titik(0.1, 0, 0) })),
      ),
    );
    for (const f of deret) expect(Math.abs(f.nilai.arah_hadap ?? 0)).toBeGreaterThan(170);
  });

  it("penilaian arah hadap: guru 179°, murid −179° hampir sama", () => {
    const guru = Array.from({ length: 30 }, (_, i) => ({ t: i / 15, nilai: { arah_hadap: 179, geser_x: i * 0.05, lutut_L: 150, lutut_R: 150 } }));
    const murid = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, arah_hadap: -179 } }));
    const h = nilaiLatihan(guru, guru.map(() => "perpindahan" as const), murid);
    expect(h.jarakKelompok.tandang.arah).toBeLessThan(0.2);
    expect(h.skor.tandang).toBeGreaterThan(90);
  });
});

describe("kalimat koreksi templat", () => {
  it("fitur arah menjadi kalimat yang wajar (bukan 'Kepala arah kepala berbeda')", () => {
    const kalimat = (n: Parameters<typeof uraikan>[0]) => {
      const { bagian, jenis } = uraikan(n, 1);
      return `${bagian} ${jenis}`;
    };
    expect(kalimat("arah_kepala")).toBe("kepala menoleh ke arah yang berbeda dari guru");
    expect(kalimat("arah_hadap")).toBe("badan menghadap ke arah yang berbeda dari guru");
    expect(kalimat("lirikan")).toBe("mata melirik (seledet) ke arah yang berbeda dari guru");
    expect(kalimat("senyum")).toBe("wajah tersenyum lebih lebar dari guru");
  });
});

describe("toleransi jari dan pola perpindahan (temuan uji ujung ke ujung 3 Nov 2026)", () => {
  it("jari memakai toleransi sendiri (25°): meleset 20° masih hijau, siku meleset 20° kuning", () => {
    const guru = [{ t: 1, nilai: { tekuk_jari_2_L: 150, siku_L: 100 } }];
    const w = warnaRealtime(guru, { tekuk_jari_2_L: 170, siku_L: 120 }, 1);
    expect(w.tanganKiri).toBe("hijau");
    expect(w.lenganKiri).toBe("kuning");
  });

  it("selisih jari tetap dilaporkan dalam derajat pada kalimat koreksi", () => {
    const guru = Array.from({ length: 30 }, (_, i) => ({ t: i / 15, nilai: { tekuk_jari_3_L: 120, siku_L: 100 } }));
    const murid = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, tekuk_jari_3_L: 160 } }));
    const h = nilaiLatihan(guru, guru.map(() => "pokok" as const), murid);
    const jari = h.penyimpangan.find((p) => p.fitur === "tekuk_jari_3_L");
    expect(jari?.selisihDerajat).toBe(40);
    expect(jari?.selisihToleransi).toBeCloseTo(40 / 25);
  });

  it("langkah yang bergeser tetap dari guru dinilai sebagai pola yang sama", () => {
    const guru = Array.from({ length: 45 }, (_, i) => ({ t: i / 15, nilai: { geser_x: Math.sin(i / 7), arah_hadap: 0, lutut_L: 150, lutut_R: 150 } }));
    const murid = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, geser_x: (f.nilai.geser_x as number) + 0.5 } }));
    const h = nilaiLatihan(guru, guru.map(() => "perpindahan" as const), murid);
    expect(h.jarakKelompok.tandang.langkah).toBeLessThan(0.05);
    expect(h.skor.tandang).toBeGreaterThan(95);
  });
});

describe("kelompok terburuk menentukan nilai unsur (kalibrasi 3 Nov 2026)", () => {
  it("kelompok yang jarang terbaca tidak dinilai, jadi beberapa frame jari berderau tidak menjatuhkan agem", () => {
    const guru = Array.from({ length: 30 }, (_, i) => ({ t: i / 15, nilai: { lutut_L: 150, lutut_R: 150, ...(i < 2 ? { tekuk_jari_1_L: 90 } : {}) } }));
    const murid = guru.map((f, i) => ({ t: f.t, nilai: { ...f.nilai, ...(i < 2 ? { tekuk_jari_1_L: 170 } : {}) } }));
    const h = nilaiLatihan(guru, guru.map(() => "pokok" as const), murid);
    expect(h.jarakKelompok.agem.jari).toBeUndefined();
    expect(h.skor.agem).toBe(100);
  });

  it("satu bagian yang meleset menentukan nilai unsurnya walau bagian lain tepat", () => {
    const guru = Array.from({ length: 30 }, (_, i) => ({ t: i / 15, nilai: { lutut_L: 150, lutut_R: 150, pinggul_L: 165, pinggul_R: 165, miring_badan: 5 } }));
    const murid = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, lutut_L: 175, lutut_R: 175 } }));
    const h = nilaiLatihan(guru, guru.map(() => "pokok" as const), murid);
    // Lutut meleset 25° (1,67 toleransi) → skor = 100 × e^(−1,67/2) ≈ 43, tidak tertolong pinggul dan badan yang tepat.
    expect(h.skor.agem).toBeGreaterThanOrEqual(42);
    expect(h.skor.agem).toBeLessThanOrEqual(45);
  });
});

describe("penghalusan berbasis waktu (temuan uji ujung ke ujung 3 Nov 2026)", () => {
  it("pada 15 fps sama dengan alfa 0,35 per frame; pada fps rendah bobot nilai baru lebih besar", () => {
    expect(alfaUntuk(1 / 15)).toBeCloseTo(0.35, 6);
    expect(alfaUntuk(2 / 15)).toBeCloseTo(1 - 0.65 ** 2, 6);
    expect(alfaUntuk(0)).toBe(0);
    expect(TAU_PENGHALUSAN).toBeCloseTo(0.155, 3);
  });

  it("lompatan nilai mencapai 90% dalam waktu yang sama pada 15 fps dan 5 fps", () => {
    const deret = (fps: number) =>
      hitungDeretFitur(
        Array.from({ length: fps * 2 }, (_, i): HasilDeteksi => ({
          waktuMs: (i * 1000) / fps, rasioGambar: 1, pose: null, poseDunia: null, tanganKiri: null, tanganKanan: null, tanganKiriDunia: null, tanganKananDunia: null,
          wajah: i < fps ? { eyeLookInLeft: 0, eyeLookOutLeft: 0, eyeLookInRight: 0, eyeLookOutRight: 0, mouthSmileLeft: 0, mouthSmileRight: 0 }
            : { eyeLookInLeft: 0, eyeLookOutLeft: 0, eyeLookInRight: 0, eyeLookOutRight: 0, mouthSmileLeft: 1, mouthSmileRight: 1 },
        })),
      );
    const waktu90 = (d: FrameFitur[]) => d.find((f) => f.t >= 1 && (f.nilai.senyum ?? 0) >= 0.9)!.t - 1;
    expect(Math.abs(waktu90(deret(15)) - waktu90(deret(5)))).toBeLessThan(0.21);
  });
});

describe("koreksi hanya untuk selisih di luar toleransi", () => {
  it("selisih kecil (masih dalam toleransi) tidak dijadikan koreksi; selisih besar tetap", () => {
    const guru = Array.from({ length: 30 }, (_, i) => ({ t: i / 15, nilai: { tekuk_jari_5_R: 150, lutut_L: 150, lutut_R: 150 } }));
    const kecil = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, tekuk_jari_5_R: 157 } })); // 7° = 0,28 toleransi jari
    expect(nilaiLatihan(guru, guru.map(() => "pokok" as const), kecil).penyimpangan).toEqual([]);
    const besar = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, lutut_R: 180 } })); // 30° = 2 toleransi
    expect(nilaiLatihan(guru, guru.map(() => "pokok" as const), besar).penyimpangan.map((p) => p.fitur)).toContain("lutut_R");
  });

  it("selisih yang bergoyang ke dua arah (derau) tidak dijadikan koreksi berarah", () => {
    // Jari bergoyang ±30° (1,2 toleransi jari) bergantian: rata-rata mutlak besar, rata-rata bertanda ±0.
    const guru = Array.from({ length: 40 }, (_, i) => ({ t: i / 15, nilai: { tekuk_jari_3_L: 150, lutut_L: 150, lutut_R: 150 } }));
    const goyang = guru.map((f, i) => ({ t: f.t, nilai: { ...f.nilai, tekuk_jari_3_L: i % 2 === 0 ? 180 : 120 } }));
    expect(nilaiLatihan(guru, guru.map(() => "pokok" as const), goyang).penyimpangan.map((p) => p.fitur)).not.toContain("tekuk_jari_3_L");
    // Selisih yang sama besar tetapi konsisten satu arah tetap dikoreksi.
    const lurus = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, tekuk_jari_3_L: 180 } }));
    expect(nilaiLatihan(guru, guru.map(() => "pokok" as const), lurus).penyimpangan.map((p) => p.fitur)).toContain("tekuk_jari_3_L");
  });

  it("jari baru dikoreksi bila selisihnya ≥ 1 toleransi (25°); di bawahnya bisa jadi bias resolusi kamera", () => {
    const guru = Array.from({ length: 40 }, (_, i) => ({ t: i / 15, nilai: { tekuk_jari_3_L: 150, lutut_L: 150, lutut_R: 150 } }));
    // Jari 20° konsisten: 0,8 toleransi jari → bukan koreksi. Lutut 15° (1 toleransi sudut tubuh) → koreksi.
    const murid = guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, tekuk_jari_3_L: 170, lutut_L: 165 } }));
    const fitur = nilaiLatihan(guru, guru.map(() => "pokok" as const), murid).penyimpangan.map((p) => p.fitur);
    expect(fitur).not.toContain("tekuk_jari_3_L");
    expect(fitur).toContain("lutut_L");
  });
});
