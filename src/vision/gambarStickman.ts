// Menggambar stickman di atas kamera. Kanvas dicerminkan lewat CSS bersama videonya, jadi di sini
// titik digambar pada koordinat asli (docs/04 bagian 3).
import { VISIBILITY_MIN } from "../config";
import { garisPose, garisTangan, type BagianGambar, type Garis } from "./garis";
import { POSE } from "./poseIndex";
import type { HasilDeteksi } from "./types";

/** Warna per bagian. Tahap 3 mengisinya dengan hijau/kuning/merah sesuai kemiripan dengan guru. */
export type WarnaBagian = Partial<Record<BagianGambar, string>>;

const WARNA_TUBUH = "#ffffff";
const WARNA_TANGAN = "#f5c542";

const adalahTangan = (g: Garis) => g.bagian === "tanganKiri" || g.bagian === "tanganKanan";

export function gambarStickman(ctx: CanvasRenderingContext2D, hasil: HasilDeteksi, warna: WarnaBagian = {}): void {
  const { width: lebar, height: tinggi } = ctx.canvas;
  ctx.clearRect(0, 0, lebar, tinggi);

  const garis: Garis[] = [
    ...(hasil.pose ? garisPose(hasil.pose) : []),
    ...(hasil.tanganKiri ? garisTangan(hasil.tanganKiri, "tanganKiri") : []),
    ...(hasil.tanganKanan ? garisTangan(hasil.tanganKanan, "tanganKanan") : []),
  ];

  const tebal = Math.max(2, lebar / 160);
  ctx.save();
  ctx.lineCap = "round";
  // Bayangan gelap supaya garis tetap terlihat di latar terang maupun gelap.
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 4;

  for (const g of garis) {
    const tangan = adalahTangan(g);
    ctx.strokeStyle = warna[g.bagian] ?? (tangan ? WARNA_TANGAN : WARNA_TUBUH);
    ctx.lineWidth = tangan ? tebal * 0.5 : tebal;
    ctx.beginPath();
    ctx.moveTo(g.dari.x * lebar, g.dari.y * tinggi);
    ctx.lineTo(g.ke.x * lebar, g.ke.y * tinggi);
    ctx.stroke();
  }

  // Sendi tubuh sebagai titik kecil.
  ctx.fillStyle = WARNA_TUBUH;
  for (const g of garis) {
    if (adalahTangan(g)) continue;
    for (const t of [g.dari, g.ke]) {
      ctx.beginPath();
      ctx.arc(t.x * lebar, t.y * tinggi, tebal * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Penanda kepala di hidung: arah kepala ikut dinilai pada seledet.
  const hidung = hasil.pose?.[POSE.HIDUNG];
  if (hidung && (hidung.visibility ?? 1) >= VISIBILITY_MIN) {
    ctx.beginPath();
    ctx.arc(hidung.x * lebar, hidung.y * tinggi, tebal * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
