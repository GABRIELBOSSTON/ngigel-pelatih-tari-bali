import type { Category, HolisticLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { describe, expect, it } from "vitest";
import { hitungLirikan, hitungSenyum } from "../src/scoring/wajah";
import { garisPose, garisTangan } from "../src/vision/garis";
import { jenisGalatKamera } from "../src/vision/kamera";
import { PengukurFps } from "../src/vision/pengukurFps";
import { BAGIAN_TUBUH, POSE } from "../src/vision/poseIndex";
import { BLENDSHAPE_DIPAKAI, type BlendshapeWajah, type Titik } from "../src/vision/types";
import { pasangkanTangan, ubahHasilHolistic } from "../src/vision/ubahHasil";
import { arahLirikan, lenganLebihTinggi, tanganLebihTinggi } from "../src/vision/ujiArah";

const titikPalsu = (jumlah: number, visibility = 0.9): NormalizedLandmark[] =>
  Array.from({ length: jumlah }, (_, i) => ({ x: i / 100, y: 0.5, z: 0, visibility }));

const kategori = (nama: string, score: number): Category => ({ categoryName: nama, displayName: "", index: 0, score });

const hasilPalsu = (ubah: Partial<HolisticLandmarkerResult> = {}): HolisticLandmarkerResult => ({
  faceLandmarks: [],
  faceBlendshapes: [{ headIndex: 0, headName: "", categories: BLENDSHAPE_DIPAKAI.map((n) => kategori(n, 0.1)) }],
  poseLandmarks: [titikPalsu(33)],
  poseWorldLandmarks: [titikPalsu(33)],
  poseSegmentationMasks: [],
  leftHandLandmarks: [titikPalsu(21, 0)],
  leftHandWorldLandmarks: [titikPalsu(21, 0)],
  rightHandLandmarks: [],
  rightHandWorldLandmarks: [],
  ...ubah,
});

const wajahNetral = (): BlendshapeWajah =>
  Object.fromEntries(BLENDSHAPE_DIPAKAI.map((n) => [n, 0])) as BlendshapeWajah;

describe("ubahHasilHolistic", () => {
  it("mengambil pose, tangan, dan blendshape yang dipakai saja", () => {
    const h = ubahHasilHolistic(hasilPalsu(), 1000, 4 / 3);
    expect(h.waktuMs).toBe(1000);
    expect(h.pose).toHaveLength(33);
    expect(h.poseDunia).toHaveLength(33);
    expect(h.tanganKiri).toHaveLength(21);
    expect(h.tanganKanan).toBeNull();
    expect(Object.keys(h.wajah ?? {}).sort()).toEqual([...BLENDSHAPE_DIPAKAI].sort());
  });

  it("visibility dipertahankan untuk pose tetapi dibuang untuk tangan", () => {
    const h = ubahHasilHolistic(hasilPalsu(), 0, 4 / 3);
    expect(h.pose?.[0]?.visibility).toBe(0.9);
    expect(h.tanganKiri?.[0]).not.toHaveProperty("visibility");
  });

  it("wajah dianggap tidak terbaca bila blendshape tidak ada atau tidak lengkap", () => {
    expect(ubahHasilHolistic(hasilPalsu({ faceBlendshapes: [] }), 0, 4 / 3).wajah).toBeNull();
    const tidakLengkap = [{ headIndex: 0, headName: "", categories: [kategori("eyeLookInLeft", 0.5)] }];
    expect(ubahHasilHolistic(hasilPalsu({ faceBlendshapes: tidakLengkap }), 0, 4 / 3).wajah).toBeNull();
  });

  it("tanpa orang di kamera: semua bagian null", () => {
    const h = ubahHasilHolistic(
      hasilPalsu({ poseLandmarks: [], poseWorldLandmarks: [], leftHandLandmarks: [], leftHandWorldLandmarks: [], faceBlendshapes: [] }),
      0,
      4 / 3,
    );
    expect([h.pose, h.poseDunia, h.tanganKiri, h.tanganKanan, h.wajah]).toEqual([null, null, null, null, null]);
  });
});

describe("jalur cadangan: memasangkan tangan ke tubuh", () => {
  // Penari menghadap kamera: pergelangan KIRI-nya tampak di sisi kanan gambar.
  const pose: Titik[] = titikPalsu(33);
  pose[POSE.PERGELANGAN_KIRI] = { x: 0.7, y: 0.5, z: 0, visibility: 0.9 };
  pose[POSE.PERGELANGAN_KANAN] = { x: 0.3, y: 0.5, z: 0, visibility: 0.9 };
  const tangan = (x: number, label: string) => ({ pergelangan: { x, y: 0.5, z: 0 }, label });

  it("tangan dipasangkan ke pergelangan pose terdekat, bukan ke labelnya", () => {
    expect(pasangkanTangan(pose, [tangan(0.69, "Right"), tangan(0.31, "Left")], 4 / 3)).toEqual(["kiri", "kanan"]);
  });

  it("dua tangan berebut satu sisi: yang lebih dekat menang", () => {
    expect(pasangkanTangan(pose, [tangan(0.6, "Left"), tangan(0.68, "Left")], 4 / 3)).toEqual(["kanan", "kiri"]);
  });

  it("tanpa pose: memakai label model tangan (tangan subjek)", () => {
    expect(pasangkanTangan(null, [tangan(0.5, "Left"), tangan(0.2, "Right")], 1)).toEqual(["kiri", "kanan"]);
  });
});

describe("fitur wajah", () => {
  it("melirik ke kanan penari → lirikan positif; ke kiri → negatif; lurus → 0", () => {
    expect(hitungLirikan({ ...wajahNetral(), eyeLookOutRight: 0.8, eyeLookInLeft: 0.8 })).toBeCloseTo(0.8);
    expect(hitungLirikan({ ...wajahNetral(), eyeLookOutLeft: 0.6, eyeLookInRight: 0.6 })).toBeCloseTo(-0.6);
    expect(hitungLirikan(wajahNetral())).toBe(0);
  });

  it("senyum adalah rata-rata kedua sudut bibir", () => {
    expect(hitungSenyum({ ...wajahNetral(), mouthSmileLeft: 0.4, mouthSmileRight: 0.8 })).toBeCloseTo(0.6);
  });
});

describe("garis stickman", () => {
  const jumlahGarisTubuh = Object.values(BAGIAN_TUBUH).flat().length;

  it("semua garis tubuh digambar bila semua titik terlihat", () => {
    expect(garisPose(titikPalsu(33))).toHaveLength(jumlahGarisTubuh);
  });

  it("garis yang menyentuh titik ragu-ragu tidak digambar", () => {
    const pose: Titik[] = titikPalsu(33);
    pose[POSE.LUTUT_KIRI] = { x: 0, y: 0, z: 0, visibility: 0.1 };
    const garis = garisPose(pose);
    expect(garis).toHaveLength(jumlahGarisTubuh - 2); // pinggul–lutut dan lutut–pergelangan kaki
    expect(garis.every((g) => g.bagian !== "tungkaiKiri" || g.dari.visibility !== 0.1)).toBe(true);
  });

  it("tangan memakai 21 sambungan resmi", () => {
    expect(garisTangan(titikPalsu(21, 0), "tanganKanan")).toHaveLength(21);
  });
});

describe("uji arah tahap 1", () => {
  const poseDenganPergelangan = (yKiri: number, yKanan: number): Titik[] => {
    const pose: Titik[] = titikPalsu(33);
    pose[POSE.PERGELANGAN_KIRI] = { x: 0.3, y: yKiri, z: 0, visibility: 0.9 };
    pose[POSE.PERGELANGAN_KANAN] = { x: 0.7, y: yKanan, z: 0, visibility: 0.9 };
    return pose;
  };

  it("lengan kanan diangkat (y lebih kecil) → KANAN", () => {
    expect(lenganLebihTinggi(poseDenganPergelangan(0.6, 0.2))).toBe("kanan");
    expect(lenganLebihTinggi(poseDenganPergelangan(0.2, 0.6))).toBe("kiri");
    expect(lenganLebihTinggi(poseDenganPergelangan(0.5, 0.52))).toBe("sejajar");
  });

  it("pergelangan tidak terlihat → tidak menebak", () => {
    const pose = poseDenganPergelangan(0.6, 0.2);
    pose[POSE.PERGELANGAN_KANAN] = { x: 0.7, y: 0.2, z: 0, visibility: 0.2 };
    expect(lenganLebihTinggi(pose)).toBeNull();
    expect(lenganLebihTinggi(null)).toBeNull();
  });

  it("tangan dari model tangan dibandingkan lewat titik pergelangan", () => {
    const tangan = (y: number): Titik[] => [{ x: 0.5, y, z: 0 }];
    expect(tanganLebihTinggi(tangan(0.7), tangan(0.3))).toBe("kanan");
    expect(tanganLebihTinggi(tangan(0.7), null)).toBeNull();
  });

  it("arah lirikan memakai ambang", () => {
    expect(arahLirikan(0.4)).toBe("kanan");
    expect(arahLirikan(-0.4)).toBe("kiri");
    expect(arahLirikan(0.05)).toBe("lurus");
  });
});

describe("pengukur fps", () => {
  it("frame setiap 50 ms → 20 fps", () => {
    const p = new PengukurFps(1000);
    for (let t = 0; t <= 1000; t += 50) p.catat(t);
    expect(p.fps()).toBeCloseTo(20);
  });

  it("data lama di luar jendela dibuang; data kurang → 0", () => {
    const p = new PengukurFps(1000);
    expect(p.fps()).toBe(0);
    p.catat(0);
    p.catat(5000);
    expect(p.fps()).toBe(0); // hanya satu cap waktu tersisa di jendela
  });
});

describe("galat kamera", () => {
  it("nama DOMException dipetakan ke pesan yang bisa dijelaskan", () => {
    expect(jenisGalatKamera(new DOMException("x", "NotAllowedError"))).toBe("ditolak");
    expect(jenisGalatKamera(new DOMException("x", "NotFoundError"))).toBe("tidak-ditemukan");
    expect(jenisGalatKamera(new DOMException("x", "NotReadableError"))).toBe("sedang-dipakai");
    expect(jenisGalatKamera(new Error("lain"))).toBe("galat");
    expect(jenisGalatKamera("bukan objek")).toBe("galat");
  });
});
