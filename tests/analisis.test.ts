import { describe, expect, it } from "vitest";
import type { FrameFitur } from "../src/scoring/fitur";
import { geserFitur, persentil, porsiSegmen, statistikDeteksi, tambahDerau, ubahTempo, ujiCermin } from "../src/uji/analisis";
import { POSE } from "../src/vision/poseIndex";
import type { HasilDeteksi, Titik } from "../src/vision/types";

const deret = (n: number): FrameFitur[] => Array.from({ length: n }, (_, i) => ({ t: i / 15, nilai: { siku_L: i * 2, lutut_L: 150, lirikan: null } }));

const kosong = (): HasilDeteksi => ({
  waktuMs: 0, rasioGambar: 1, pose: null, poseDunia: null, tanganKiri: null, tanganKanan: null,
  tanganKiriDunia: null, tanganKananDunia: null, wajah: null,
});

describe("alat analisis benchmark", () => {
  it("ubahTempo memperpanjang deret dan menginterpolasi nilai", () => {
    const lambat = ubahTempo(deret(16), 1.25);
    expect(lambat.length).toBe(20);
    expect(lambat[0]!.nilai.siku_L).toBe(0);
    expect(lambat[lambat.length - 1]!.nilai.siku_L).toBeCloseTo(30);
    expect(lambat[5]!.nilai.lirikan).toBeNull();
  });

  it("geserFitur dan tambahDerau hanya mengubah fitur yang ada", () => {
    const g = geserFitur(deret(3), { lutut_L: 25, lirikan: 1 });
    expect(g[0]!.nilai.lutut_L).toBe(175);
    expect(g[0]!.nilai.lirikan).toBeNull();
    const d = tambahDerau(deret(30), 5);
    expect(d.every((f, i) => Math.abs(f.nilai.lutut_L! - 150) <= 5 && f.t === deret(30)[i]!.t)).toBe(true);
  });

  it("persentil dan porsi segmen", () => {
    expect(persentil([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(porsiSegmen(["pokok", "pokok", "peralihan", "perpindahan"])).toEqual({ pokok: 50, peralihan: 25, perpindahan: 25 });
  });

  it("statistik deteksi menghitung porsi frame yang terbaca", () => {
    const f = [kosong(), { ...kosong(), pose: [] as Titik[] }];
    const s = statistikDeteksi(f, [20, 40]);
    expect(s.tubuhPersen).toBe(50);
    expect(s.prosesRataMs).toBe(30);
    expect(s.fpsMaksimum).toBeCloseTo(33.3, 1);
  });

  it("uji cermin mengenali label kiri–kanan yang tertukar", () => {
    // Gambar asli: pergelangan kiri di x = 0,7. Gambar dibalik: titik yang sama tampak di x = 0,3
    // dan diberi label KANAN oleh model (label tertukar).
    // Seperti pose sungguhan, setiap sendi kiri dan kanan terpisah dan tidak simetris.
    const pose = (kiriX: number, kananX: number): Titik[] => {
      const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
      const pasangan = [
        [POSE.BAHU_KIRI, POSE.BAHU_KANAN], [POSE.SIKU_KIRI, POSE.SIKU_KANAN], [POSE.PERGELANGAN_KIRI, POSE.PERGELANGAN_KANAN],
        [POSE.PINGGUL_KIRI, POSE.PINGGUL_KANAN], [POSE.LUTUT_KIRI, POSE.LUTUT_KANAN], [POSE.PERGELANGAN_KAKI_KIRI, POSE.PERGELANGAN_KAKI_KANAN],
      ] as const;
      pasangan.forEach(([kiri, kanan], k) => {
        p[kiri] = { x: kiriX - k * 0.01, y: 0.3 + k * 0.1, z: 0, visibility: 0.9 };
        p[kanan] = { x: kananX + k * 0.01, y: 0.35 + k * 0.1, z: 0, visibility: 0.9 };
      });
      return p;
    };
    const asliPose = pose(0.7, 0.2);
    // Gambar dibalik + label tertukar: titik KIRI baru = cermin titik KANAN lama, dan sebaliknya.
    const balikPose = asliPose.map((t) => ({ ...t, x: 1 - t.x }));
    for (const [kiri, kanan] of [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28]] as const) {
      [balikPose[kiri], balikPose[kanan]] = [balikPose[kanan]!, balikPose[kiri]!];
    }
    const h = ujiCermin([{ ...kosong(), pose: asliPose }], [{ ...kosong(), pose: balikPose }]);
    expect(h.poseSelisihTukar).toBe(0);
    expect(h.poseSelisihSama!).toBeGreaterThan(0.1);
  });
});
