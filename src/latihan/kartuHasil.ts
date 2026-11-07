// Kartu hasil (PNG 1080 × 1350) untuk dibagikan murid. Isinya hanya angka dan nama kelas, tanpa
// gambar kamera. Digambar di kanvas peramban; tidak ada yang dikirim ke server.
import { formatDurasi } from "../katalog/katalog";
import { DAFTAR_UNSUR } from "../scoring/types";
import { warnaSkor } from "./CincinSkor";
import type { SesiTersimpan } from "./riwayat";
import { predikat } from "./sesi";

const LEBAR = 1080;
const TINGGI = 1350;
const HURUF = '"Plus Jakarta Sans Variable", system-ui, sans-serif';
const NAMA_UNSUR = { agem: "Agem", tandang: "Tandang", tangkis: "Tangkis", tangkep: "Tangkep" } as const;

function persegiBulat(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, t: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, l, t, r);
}

export async function buatKartuHasil(sesi: SesiTersimpan): Promise<Blob | null> {
  // Huruf aplikasi dimuat dulu supaya kartu tidak jatuh ke huruf bawaan.
  await Promise.all(["800 96px", "700 40px", "500 30px"].map((h) => document.fonts.load(`${h} ${HURUF}`).catch(() => [])));
  const kanvas = document.createElement("canvas");
  kanvas.width = LEBAR;
  kanvas.height = TINGGI;
  const ctx = kanvas.getContext("2d");
  if (!ctx) return null;

  // Latar merah bata dengan cahaya lembut, garis poleng di atas dan bawah.
  const latar = ctx.createRadialGradient(220, 260, 40, 220, 260, 1100);
  latar.addColorStop(0, "#a02022");
  latar.addColorStop(0.55, "#7a1416");
  latar.addColorStop(1, "#5e0d0f");
  ctx.fillStyle = latar;
  ctx.fillRect(0, 0, LEBAR, TINGGI);
  for (const y of [0, TINGGI - 24]) {
    for (let x = 0; x < LEBAR; x += 24) {
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = (x / 24 + k) % 2 === 0 ? "#1c1917" : "#faf6ee";
        ctx.fillRect(x, y + k * 12, 24, 12);
      }
    }
  }

  ctx.fillStyle = "#faf6ee";
  ctx.font = `800 52px ${HURUF}`;
  ctx.fillText("Ngigel", 80, 130);
  ctx.fillStyle = "#f6c453";
  ctx.font = `700 28px ${HURUF}`;
  ctx.fillText("Pelatih tari Bali berbasis AI", 80, 175);

  ctx.fillStyle = "#faf6ee";
  ctx.font = `800 64px ${HURUF}`;
  ctx.fillText(sesi.namaKelas, 80, 290, LEBAR - 160);
  ctx.fillStyle = "rgb(255 255 255 / 0.78)";
  ctx.font = `500 30px ${HURUF}`;
  const tanggal = new Date(sesi.dibuat).toLocaleDateString("id-ID", { dateStyle: "long" });
  ctx.fillText(`${tanggal} · rentang ${formatDurasi(sesi.mulai)}–${formatDurasi(sesi.akhir)}`, 80, 340, LEBAR - 160);

  // Cincin nilai total.
  const cx = LEBAR / 2;
  const cy = 600;
  const r = 170;
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgb(255 255 255 / 0.18)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (sesi.skorTotal !== null) {
    ctx.strokeStyle = warnaSkor(sesi.skorTotal);
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(0, Math.min(100, sesi.skorTotal))) / 100);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 140px ${HURUF}`;
  ctx.fillText(sesi.skorTotal === null ? "–" : String(sesi.skorTotal), cx, cy + 48);
  ctx.fillStyle = "#f6c453";
  ctx.font = `800 44px ${HURUF}`;
  ctx.fillText(predikat(sesi.skorTotal), cx, cy + r + 90);
  ctx.textAlign = "left";

  // Empat unsur sebagai batang.
  DAFTAR_UNSUR.forEach((u, i) => {
    const y = 950 + i * 78;
    const skor = sesi.skor[u];
    ctx.fillStyle = "#faf6ee";
    ctx.font = `700 34px ${HURUF}`;
    ctx.fillText(NAMA_UNSUR[u], 80, y + 26);
    persegiBulat(ctx, 310, y, 560, 28, 14);
    ctx.fillStyle = "rgb(255 255 255 / 0.18)";
    ctx.fill();
    if (skor !== null) {
      persegiBulat(ctx, 310, y, Math.max(28, (560 * skor) / 100), 28, 14);
      ctx.fillStyle = warnaSkor(skor);
      ctx.fill();
    }
    ctx.fillStyle = "#faf6ee";
    ctx.textAlign = "right";
    ctx.fillText(skor === null ? "–" : String(skor), LEBAR - 80, y + 26);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = "rgb(255 255 255 / 0.7)";
  ctx.font = `500 24px ${HURUF}`;
  ctx.fillText("Kamera diproses di perangkat. Kartu ini hanya berisi nilai, tanpa gambar.", 80, TINGGI - 60, LEBAR - 160);

  return new Promise((selesai) => kanvas.toBlob((b) => selesai(b), "image/png"));
}
