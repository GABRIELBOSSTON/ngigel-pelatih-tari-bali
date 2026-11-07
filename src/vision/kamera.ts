// Status kamera dan pesannya untuk pengguna (docs/03 bagian G). Fungsi murni.

export type StatusKamera =
  | "meminta"
  | "aktif"
  | "ditolak"
  | "tidak-ditemukan"
  | "sedang-dipakai"
  | "tidak-aman"
  | "galat";

export const PESAN_KAMERA: Record<StatusKamera, string> = {
  meminta: "Meminta izin kamera…",
  aktif: "",
  ditolak:
    "Izin kamera ditolak. Klik ikon gembok di bilah alamat, izinkan kamera, lalu muat ulang halaman.",
  "tidak-ditemukan": "Kamera tidak ditemukan. Pastikan laptop atau HP Anda memiliki kamera yang menyala.",
  "sedang-dipakai": "Kamera sedang dipakai aplikasi lain (mis. Zoom atau Meet). Tutup aplikasinya, lalu muat ulang.",
  "tidak-aman": "Kamera hanya bisa dipakai lewat alamat https atau localhost.",
  galat: "Kamera tidak bisa dinyalakan. Muat ulang halaman atau coba peramban lain.",
};

/** Memetakan galat getUserMedia (DOMException) ke status yang bisa dijelaskan ke pengguna. */
export function jenisGalatKamera(galat: unknown): StatusKamera {
  const nama = typeof galat === "object" && galat !== null && "name" in galat ? String(galat.name) : "";
  switch (nama) {
    case "NotAllowedError":
    case "SecurityError":
      return "ditolak";
    case "NotFoundError":
    case "OverconstrainedError":
      return "tidak-ditemukan";
    case "NotReadableError":
      return "sedang-dipakai";
    default:
      return "galat";
  }
}
