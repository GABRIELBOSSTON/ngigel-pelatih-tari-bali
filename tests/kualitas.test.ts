import { describe, expect, it } from "vitest";
import { KUALITAS } from "../src/config";
import { keyakinanTubuh, masalahKualitas, ringkasKualitas, tahanMasalah, ukuranTubuh } from "../src/latihan/kualitas";
import { POSE } from "../src/vision/poseIndex";
import type { Titik } from "../src/vision/types";

/** Pose berdiri: kepala di y = atas, kaki di y = bawah, semua titik terlihat dengan visibility v. */
function pose(atas: number, bawah: number, v = 0.95): Titik[] {
  const p: Titik[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: (atas + bawah) / 2, z: 0, visibility: v }));
  for (const i of [POSE.HIDUNG, POSE.MATA_KIRI, POSE.MATA_KANAN]) p[i] = { x: 0.5, y: atas, z: 0, visibility: v };
  for (const i of [POSE.PERGELANGAN_KAKI_KIRI, POSE.PERGELANGAN_KAKI_KANAN, POSE.TUMIT_KIRI, POSE.TUMIT_KANAN, POSE.UJUNG_KAKI_KIRI, POSE.UJUNG_KAKI_KANAN])
    p[i] = { x: 0.5, y: bawah, z: 0, visibility: v };
  return p;
}

describe("gerbang kualitas kamera", () => {
  it("ukuran tubuh = jarak kepala ke kaki dibagi tinggi gambar; tanpa kaki diperkirakan dari panjang badan", () => {
    expect(ukuranTubuh(pose(0.15, 0.85))).toBeCloseTo(0.7, 5);
    // Berlutut: kepala–kaki tinggal 0,4, tetapi badan (0,25) tetap → ukuran setara berdiri, bukan "terlalu kecil".
    const berlutut = pose(0.3, 0.7);
    for (const i of [POSE.BAHU_KIRI, POSE.BAHU_KANAN]) berlutut[i] = { ...berlutut[i]!, y: 0.38 };
    for (const i of [POSE.PINGGUL_KIRI, POSE.PINGGUL_KANAN]) berlutut[i] = { ...berlutut[i]!, y: 0.63 };
    expect(ukuranTubuh(berlutut)).toBeCloseTo(0.25 / KUALITAS.rasioBadan, 5);
    expect(ukuranTubuh(berlutut)!).toBeGreaterThan(KUALITAS.tubuhMin);
    const tanpaKaki = pose(0.1, 0.9);
    for (const i of [POSE.PERGELANGAN_KAKI_KIRI, POSE.PERGELANGAN_KAKI_KANAN, POSE.TUMIT_KIRI, POSE.TUMIT_KANAN, POSE.UJUNG_KAKI_KIRI, POSE.UJUNG_KAKI_KANAN])
      tanpaKaki[i] = { ...tanpaKaki[i]!, visibility: 0.1 };
    // Badan (tengah bahu → tengah pinggul) 0,1 tinggi gambar → perkiraan 0,1 ÷ rasioBadan.
    for (const i of [POSE.BAHU_KIRI, POSE.BAHU_KANAN]) tanpaKaki[i] = { ...tanpaKaki[i]!, y: 0.4 };
    for (const i of [POSE.PINGGUL_KIRI, POSE.PINGGUL_KANAN]) tanpaKaki[i] = { ...tanpaKaki[i]!, y: 0.5 };
    expect(ukuranTubuh(tanpaKaki)).toBeCloseTo(0.1 / KUALITAS.rasioBadan, 5);
    // Bahu juga tidak terlihat → tidak bisa diukur.
    tanpaKaki[POSE.BAHU_KIRI] = { ...tanpaKaki[POSE.BAHU_KIRI]!, visibility: 0.1 };
    expect(ukuranTubuh(tanpaKaki)).toBeNull();
    expect(ukuranTubuh(null)).toBeNull();
  });

  it("keyakinan = rata-rata visibility lengan dan tungkai", () => {
    expect(keyakinanTubuh(pose(0.2, 0.8, 0.4))).toBeCloseTo(0.4, 5);
    expect(keyakinanTubuh(null)).toBeNull();
  });

  it("masalah: gelap didahulukan, lalu buram, lalu tubuh terlalu kecil, lalu AI ragu", () => {
    expect(masalahKualitas({ ukuran: 0.7, keyakinan: 0.95, gelap: false })).toBeNull();
    expect(masalahKualitas({ ukuran: 0.2, keyakinan: 0.95, gelap: false, buram: true })).toBe("buram");
    expect(masalahKualitas({ ukuran: 0.7, keyakinan: 0.95, gelap: true, buram: true })).toBe("gelap");
    expect(masalahKualitas({ ukuran: KUALITAS.tubuhMin - 0.05, keyakinan: 0.95, gelap: false })).toBe("kecil");
    expect(masalahKualitas({ ukuran: 0.7, keyakinan: KUALITAS.keyakinanMin - 0.1, gelap: false })).toBe("ragu");
    expect(masalahKualitas({ ukuran: 0.2, keyakinan: 0.2, gelap: true })).toBe("gelap");
    // Kaki tidak terlihat (ukuran null) bukan "terlalu kecil": itu urusan cek tubuh lengkap.
    expect(masalahKualitas({ ukuran: null, keyakinan: 0.95, gelap: false })).toBeNull();
  });

  it("masalah baru aktif setelah bertahan tahanDetik; satu frame jelek tidak cukup", () => {
    const tahan = KUALITAS.tahanDetik * 1000;
    let k = { masalah: null as ReturnType<typeof masalahKualitas>, sejak: 0 };
    let r = tahanMasalah(k, "kecil", 1000);
    expect(r.aktif).toBeNull();
    k = r.keadaan;
    r = tahanMasalah(k, "kecil", 1000 + tahan - 1);
    expect(r.aktif).toBeNull();
    r = tahanMasalah(r.keadaan, "kecil", 1000 + tahan);
    expect(r.aktif).toBe("kecil");
    // Masalah berganti → hitungan mulai lagi.
    r = tahanMasalah(r.keadaan, "gelap", 1000 + tahan + 10);
    expect(r.aktif).toBeNull();
    r = tahanMasalah(r.keadaan, null, 1000 + tahan + 20);
    expect(r.aktif).toBeNull();
  });

  it("ringkasan sesi: median ukuran dan keyakinan, porsi frame kurang jelas, masalah utama", () => {
    const r = ringkasKualitas([
      { ukuran: 0.3, keyakinan: 0.9, kurangJelas: "kecil" },
      { ukuran: 0.32, keyakinan: 0.9, kurangJelas: "kecil" },
      { ukuran: 0.6, keyakinan: 0.5, kurangJelas: "ragu" },
      { ukuran: 0.6, keyakinan: 0.9, kurangJelas: null },
    ]);
    expect(r).toEqual({ ukuranTubuh: 0.46, keyakinan: 0.9, porsiKurangJelas: 0.75, masalahUtama: "kecil" });
    expect(ringkasKualitas([])).toEqual({ ukuranTubuh: null, keyakinan: null, porsiKurangJelas: 0, masalahUtama: null });
  });
});
