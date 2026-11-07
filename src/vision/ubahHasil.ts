// Mengubah hasil MediaPipe menjadi HasilDeteksi yang ringkas.
// Dijalankan di Web Worker sebelum hasil dikirim ke halaman, supaya yang berpindah hanya angka
// yang dipakai (±520 angka per frame) dan titik wajah mentah tidak pernah keluar dari worker.
import type {
  Classifications,
  FaceLandmarkerResult,
  HandLandmarkerResult,
  HolisticLandmarkerResult,
  Landmark,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { PERGELANGAN_TANGAN } from "./handIndex";
import { POSE } from "./poseIndex";
import { BLENDSHAPE_DIPAKAI, type BlendshapeWajah, type HasilDeteksi, type Titik } from "./types";

/**
 * Visibility hanya bermakna untuk titik pose. Model tangan tidak menghasilkan visibility,
 * jadi nilainya dibuang supaya tidak terbaca sebagai "titik tidak terlihat".
 */
function keTitik(titik: ReadonlyArray<NormalizedLandmark | Landmark> | undefined, pakaiVisibility: boolean): Titik[] | null {
  if (!titik || titik.length === 0) return null;
  return titik.map((t) =>
    pakaiVisibility ? { x: t.x, y: t.y, z: t.z, visibility: t.visibility } : { x: t.x, y: t.y, z: t.z },
  );
}

function keBlendshape(klasifikasi: Classifications | undefined): BlendshapeWajah | null {
  if (!klasifikasi) return null;
  const skor = new Map(klasifikasi.categories.map((k) => [k.categoryName, k.score]));
  const hasil: Partial<BlendshapeWajah> = {};
  for (const nama of BLENDSHAPE_DIPAKAI) {
    const nilai = skor.get(nama);
    if (nilai === undefined) return null; // set blendshape tidak lengkap: anggap wajah tidak terbaca
    hasil[nama] = nilai;
  }
  return hasil as BlendshapeWajah;
}

/** Hanya orang pertama yang dipakai; Holistic memang melacak satu orang. */
export function ubahHasilHolistic(hasil: HolisticLandmarkerResult, waktuMs: number, rasioGambar: number): HasilDeteksi {
  return {
    waktuMs,
    rasioGambar,
    pose: keTitik(hasil.poseLandmarks?.[0], true),
    poseDunia: keTitik(hasil.poseWorldLandmarks?.[0], true),
    tanganKiri: keTitik(hasil.leftHandLandmarks?.[0], false),
    tanganKanan: keTitik(hasil.rightHandLandmarks?.[0], false),
    tanganKiriDunia: keTitik(hasil.leftHandWorldLandmarks?.[0], false),
    tanganKananDunia: keTitik(hasil.rightHandWorldLandmarks?.[0], false),
    wajah: keBlendshape(hasil.faceBlendshapes?.[0]),
  };
}

export type SisiTangan = "kiri" | "kanan";

const jarak2 = (a: { x: number; y: number }, b: { x: number; y: number }, rasio: number) =>
  ((a.x - b.x) * rasio) ** 2 + (a.y - b.y) ** 2;

/**
 * Jalur cadangan (docs/04 bagian 2): menentukan tangan kiri/kanan dengan memasangkan pergelangan
 * tiap tangan ke pergelangan pose terdekat, supaya tangan dan tubuh berasal dari orang yang sama.
 * Label model tangan hanya dipakai bila pose tidak ada.
 */
export function pasangkanTangan(
  pose: Titik[] | null,
  tangan: ReadonlyArray<{ pergelangan: Titik; label: string | undefined }>,
  rasioGambar: number,
): SisiTangan[] {
  const kiri = pose?.[POSE.PERGELANGAN_KIRI];
  const kanan = pose?.[POSE.PERGELANGAN_KANAN];
  if (!kiri || !kanan) return tangan.map((t) => (t.label === "Left" ? "kiri" : "kanan"));

  const pilihan = tangan.map((t) =>
    jarak2(t.pergelangan, kiri, rasioGambar) <= jarak2(t.pergelangan, kanan, rasioGambar) ? "kiri" : "kanan",
  ) as SisiTangan[];
  // Dua tangan berebut sisi yang sama: yang lebih dekat menang, yang lain ke sisi sebaliknya.
  if (tangan.length === 2 && pilihan[0] === pilihan[1]) {
    const sisi = pilihan[0] === "kiri" ? kiri : kanan;
    const [a, b] = tangan;
    if (a && b) {
      const aLebihDekat = jarak2(a.pergelangan, sisi, rasioGambar) <= jarak2(b.pergelangan, sisi, rasioGambar);
      const lawan: SisiTangan = pilihan[0] === "kiri" ? "kanan" : "kiri";
      return aLebihDekat ? [pilihan[0]!, lawan] : [lawan, pilihan[0]!];
    }
  }
  return pilihan;
}

type HasilPose = { landmarks: NormalizedLandmark[][]; worldLandmarks: Landmark[][] };

/** Menggabungkan hasil tiga model terpisah (pose, tangan, wajah) menjadi satu HasilDeteksi. */
export function ubahHasilTerpisah(
  pose: HasilPose,
  tangan: Pick<HandLandmarkerResult, "landmarks" | "worldLandmarks" | "handedness">,
  wajah: Pick<FaceLandmarkerResult, "faceBlendshapes">,
  waktuMs: number,
  rasioGambar: number,
): HasilDeteksi {
  const titikPose = keTitik(pose.landmarks?.[0], true);
  const daftarTangan = (tangan.landmarks ?? []).slice(0, 2).map((titik, i) => ({
    titik,
    dunia: tangan.worldLandmarks?.[i],
    pergelangan: titik[PERGELANGAN_TANGAN] ?? { x: 0, y: 0, z: 0 },
    label: tangan.handedness?.[i]?.[0]?.categoryName,
  }));
  const sisi = pasangkanTangan(titikPose, daftarTangan, rasioGambar);
  const ambil = (s: SisiTangan) => daftarTangan.find((_, i) => sisi[i] === s);
  const tKiri = ambil("kiri");
  const tKanan = ambil("kanan");

  return {
    waktuMs,
    rasioGambar,
    pose: titikPose,
    poseDunia: keTitik(pose.worldLandmarks?.[0], true),
    tanganKiri: keTitik(tKiri?.titik, false),
    tanganKanan: keTitik(tKanan?.titik, false),
    tanganKiriDunia: keTitik(tKiri?.dunia, false),
    tanganKananDunia: keTitik(tKanan?.dunia, false),
    wajah: keBlendshape(wajah.faceBlendshapes?.[0]),
  };
}
