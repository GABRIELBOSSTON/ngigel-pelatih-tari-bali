// Fitur wajah untuk unsur tangkep (docs/04 bagian 6). Fungsi murni.
import type { BlendshapeWajah } from "../vision/types";

/**
 * Arah lirikan, −1 sampai 1; positif = melirik ke kanan PENARI.
 * Blendshape Left/Right mengacu pada wajah subjek (vision.d.ts). Mata kanan melirik ke luar
 * dan mata kiri melirik ke dalam sama-sama berarti melihat ke kanan penari.
 */
export function hitungLirikan(b: BlendshapeWajah): number {
  return (b.eyeLookOutRight + b.eyeLookInLeft - (b.eyeLookInRight + b.eyeLookOutLeft)) / 2;
}

/** Senyum (kenyung manis), 0–1: rata-rata kedua sudut bibir. */
export function hitungSenyum(b: BlendshapeWajah): number {
  return (b.mouthSmileLeft + b.mouthSmileRight) / 2;
}
