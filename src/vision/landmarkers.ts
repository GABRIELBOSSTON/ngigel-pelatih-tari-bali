// AI: membuat pendeteksi MediaPipe (docs/04 bagian 2). Dipanggil di dalam Web Worker.
// Jalur utama: Holistic Landmarker. Cadangan: Pose + Hand + Face Landmarker terpisah.
import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  HolisticLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { DELEGASI_HOLISTIC, OPSI_HOLISTIC } from "../config";
import type { Delegasi, HasilDeteksi, JalurAi } from "./types";
import { ubahHasilHolistic, ubahHasilTerpisah } from "./ubahHasil";

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
type GambarMasukan = ImageBitmap | ImageData;

export type AlamatModel = { holistic: string; pose: string; tangan: string; wajah: string };

/** Pilihan untuk percobaan benchmark (docs/09); aplikasi memakai nilai bawaan dari config. */
export type OpsiPendeteksi = { delegasi?: Delegasi; blendshape?: boolean };

/** Antarmuka bersama kedua jalur, supaya worker dan pengujian tidak perlu tahu jalurnya. */
export type Pendeteksi = {
  keterangan: string;
  deteksi(gambar: GambarMasukan, waktuMs: number): HasilDeteksi;
  tutup(): void;
};

type TugasVideo = {
  detectForVideo(gambar: GambarMasukan, waktuMs: number): unknown;
  close(): void;
};

/**
 * Pemuat WASM versi modul hanya dijalankan sekali oleh import(), padahal ia yang memasang
 * ModuleFactory untuk setiap tugas. Alamat yang sedikit berbeda memaksa pemuat dijalankan ulang,
 * sehingga beberapa tugas (atau percobaan ulang dengan CPU) bisa dibuat di worker yang sama.
 */
let nomorPemuat = 0;
const filesetBaru = (fileset: WasmFileset): WasmFileset =>
  nomorPemuat++ === 0 ? fileset : { ...fileset, wasmLoaderPath: `${fileset.wasmLoaderPath}?tugas=${nomorPemuat}` };

/** GPU di dalam worker membutuhkan WebGL2 lewat OffscreenCanvas. */
function adaWebGl2(): boolean {
  try {
    return typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/**
 * Membuat satu tugas lalu menjalankannya sekali pada gambar kosong. Sebagian galat (mis. operasi
 * yang tidak didukung GPU) baru muncul saat graf pertama kali berjalan, bukan saat tugas dibuat.
 * Bila GPU diminta tetapi gagal, tugas dibuat ulang dengan CPU.
 */
async function buatTugas<T extends TugasVideo>(
  nama: string,
  fileset: WasmFileset,
  delegasiDiminta: Delegasi,
  buat: (fileset: WasmFileset, delegasi: Delegasi) => Promise<T>,
): Promise<{ tugas: T; delegasi: Delegasi }> {
  const urutan: Delegasi[] = delegasiDiminta === "GPU" && adaWebGl2() ? ["GPU", "CPU"] : ["CPU"];
  let galatTerakhir: unknown;
  for (const delegasi of urutan) {
    let tugas: T | undefined;
    try {
      tugas = await buat(filesetBaru(fileset), delegasi);
      tugas.detectForVideo(new ImageData(64, 64), 0);
      return { tugas, delegasi };
    } catch (galat) {
      tugas?.close();
      galatTerakhir = galat;
      console.warn(`${nama} dengan ${delegasi} tidak bisa dijalankan.`, galat);
    }
  }
  throw galatTerakhir;
}

async function buatHolistic(fileset: WasmFileset, model: AlamatModel, opsi: OpsiPendeteksi): Promise<Pendeteksi> {
  const blendshape = opsi.blendshape ?? true;
  const { tugas, delegasi } = await buatTugas("Holistic", fileset, opsi.delegasi ?? DELEGASI_HOLISTIC, (f, d) =>
    HolisticLandmarker.createFromOptions(f, {
      baseOptions: { modelAssetPath: model.holistic, delegate: d },
      runningMode: "VIDEO",
      outputFaceBlendshapes: blendshape,
      outputPoseSegmentationMasks: false,
      ...OPSI_HOLISTIC,
    }),
  );
  return {
    keterangan: `Holistic · ${delegasi}${blendshape ? "" : " · tanpa blendshape"}`,
    deteksi: (gambar, t) => ubahHasilHolistic(tugas.detectForVideo(gambar, t), t, gambar.width / gambar.height),
    tutup: () => tugas.close(),
  };
}

async function buatTerpisah(fileset: WasmFileset, model: AlamatModel): Promise<Pendeteksi> {
  const keyakinan = OPSI_HOLISTIC.minPoseDetectionConfidence;
  const pose = await buatTugas("Pose", fileset, "GPU", (f, d) =>
    PoseLandmarker.createFromOptions(f, {
      baseOptions: { modelAssetPath: model.pose, delegate: d },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: keyakinan,
      minPosePresenceConfidence: OPSI_HOLISTIC.minPosePresenceConfidence,
    }),
  );
  const tangan = await buatTugas("Tangan", fileset, "GPU", (f, d) =>
    HandLandmarker.createFromOptions(f, {
      baseOptions: { modelAssetPath: model.tangan, delegate: d },
      runningMode: "VIDEO",
      numHands: 2,
      minHandPresenceConfidence: OPSI_HOLISTIC.minHandLandmarksConfidence,
    }),
  );
  const wajah = await buatTugas("Wajah", fileset, "GPU", (f, d) =>
    FaceLandmarker.createFromOptions(f, {
      baseOptions: { modelAssetPath: model.wajah, delegate: d },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: OPSI_HOLISTIC.minFaceDetectionConfidence,
      minFacePresenceConfidence: OPSI_HOLISTIC.minFacePresenceConfidence,
    }),
  );
  return {
    keterangan: `Terpisah · pose ${pose.delegasi}, tangan ${tangan.delegasi}, wajah ${wajah.delegasi}`,
    deteksi: (gambar, t) =>
      ubahHasilTerpisah(
        pose.tugas.detectForVideo(gambar, t),
        tangan.tugas.detectForVideo(gambar, t),
        wajah.tugas.detectForVideo(gambar, t),
        t,
        gambar.width / gambar.height,
      ),
    tutup: () => {
      pose.tugas.close();
      tangan.tugas.close();
      wajah.tugas.close();
    },
  };
}

/** useModule = true karena worker berjenis modul tidak bisa memakai importScripts. */
export async function buatPendeteksi(
  jalur: JalurAi,
  dasarWasm: string,
  model: AlamatModel,
  opsi: OpsiPendeteksi = {},
): Promise<Pendeteksi> {
  const fileset = await FilesetResolver.forVisionTasks(dasarWasm, true);
  return jalur === "holistic" ? buatHolistic(fileset, model, opsi) : buatTerpisah(fileset, model);
}
