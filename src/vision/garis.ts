// Menentukan garis stickman yang layak digambar. Fungsi murni, supaya bisa diuji tanpa kanvas.
import { VISIBILITY_MIN } from "../config";
import { SAMBUNGAN_TANGAN } from "./handIndex";
import { BAGIAN_TUBUH, type BagianTubuh } from "./poseIndex";
import type { Titik } from "./types";

export type BagianGambar = BagianTubuh | "tanganKiri" | "tanganKanan";

export type Garis = {
  bagian: BagianGambar;
  dari: Titik;
  ke: Titik;
};

const terlihat = (t: Titik | undefined, ambang: number): t is Titik =>
  t !== undefined && (t.visibility ?? 1) >= ambang;

/** Garis tubuh yang kedua ujungnya cukup terlihat; titik ragu-ragu tidak digambar. */
export function garisPose(pose: Titik[], ambang: number = VISIBILITY_MIN): Garis[] {
  const garis: Garis[] = [];
  for (const [bagian, pasangan] of Object.entries(BAGIAN_TUBUH) as [BagianTubuh, ReadonlyArray<readonly [number, number]>][]) {
    for (const [a, b] of pasangan) {
      const dari = pose[a];
      const ke = pose[b];
      if (terlihat(dari, ambang) && terlihat(ke, ambang)) garis.push({ bagian, dari, ke });
    }
  }
  return garis;
}

/** Garis tangan (21 sambungan resmi). Titik tangan tidak punya visibility, jadi semuanya dipakai. */
export function garisTangan(tangan: Titik[], bagian: "tanganKiri" | "tanganKanan"): Garis[] {
  const garis: Garis[] = [];
  for (const [a, b] of SAMBUNGAN_TANGAN) {
    const dari = tangan[a];
    const ke = tangan[b];
    if (dari && ke) garis.push({ bagian, dari, ke });
  }
  return garis;
}
