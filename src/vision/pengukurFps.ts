// Mengukur berapa frame per detik yang selesai dideteksi (target docs/04: ±15 fps).

export class PengukurFps {
  private readonly jendelaMs: number;
  private readonly cap: number[] = [];

  constructor(jendelaMs = 1000) {
    this.jendelaMs = jendelaMs;
  }

  catat(waktuMs: number): void {
    this.cap.push(waktuMs);
    while (this.cap.length > 0 && (this.cap[0] ?? waktuMs) < waktuMs - this.jendelaMs) this.cap.shift();
  }

  /** Rata-rata fps dalam jendela terakhir; 0 bila datanya belum cukup. */
  fps(): number {
    const pertama = this.cap[0];
    const terakhir = this.cap[this.cap.length - 1];
    if (pertama === undefined || terakhir === undefined || terakhir === pertama) return 0;
    return ((this.cap.length - 1) * 1000) / (terakhir - pertama);
  }
}
