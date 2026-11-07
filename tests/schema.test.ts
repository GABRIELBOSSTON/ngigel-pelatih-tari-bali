import { describe, expect, it } from "vitest";
import { PelajaranSchema } from "../src/lessons/schema";

const pelajaranValid = {
  id: "gerak-dasar-contoh",
  judul: "Gerak Dasar Tari Bali (contoh uji)",
  guru: { nama: "Guru Contoh", sanggar: "Sanggar Contoh" },
  sumberVideo: {
    jenis: "youtube",
    youtubeId: "abc123XYZ",
    lisensi: "CC-BY",
    kredit: "Penari Contoh — kanal Contoh (CC BY)",
  },
  modelVersi: "@mediapipe/tasks-vision 1.1.1 + holistic_landmarker float16/1",
  fps: 30,
  gerak: [
    {
      id: "agem-kanan",
      nama: "Agem Kanan",
      unsurUtama: ["agem"],
      mulaiDetik: 2,
      selesaiDetik: 8.5,
      segmen: [
        { jenis: "peralihan", mulaiDetik: 2, selesaiDetik: 4 },
        { jenis: "pokok", mulaiDetik: 4, selesaiDetik: 8.5 },
      ],
      frame: [
        { t: 0, nilai: { lutut_kanan: 2.1, lirikan: null } },
        { t: 0.033, nilai: { lutut_kanan: 2.08, lirikan: null } },
      ],
    },
  ],
};

describe("PelajaranSchema", () => {
  it("menerima pelajaran yang lengkap", () => {
    expect(PelajaranSchema.safeParse(pelajaranValid).success).toBe(true);
  });

  it("mengisi guruMemperagakanCermin = false bila tidak disebut", () => {
    const hasil = PelajaranSchema.parse(pelajaranValid);
    expect(hasil.guruMemperagakanCermin).toBe(false);
  });

  it("menolak video YouTube tanpa youtubeId", () => {
    const rusak = structuredClone(pelajaranValid);
    delete (rusak.sumberVideo as { youtubeId?: string }).youtubeId;
    expect(PelajaranSchema.safeParse(rusak).success).toBe(false);
  });

  it("menolak lisensi di luar daftar yang diizinkan", () => {
    const rusak = structuredClone(pelajaranValid);
    rusak.sumberVideo.lisensi = "tidak-jelas";
    expect(PelajaranSchema.safeParse(rusak).success).toBe(false);
  });

  it("menolak gerak yang selesai sebelum mulai", () => {
    const rusak = structuredClone(pelajaranValid);
    rusak.gerak[0]!.selesaiDetik = 1;
    expect(PelajaranSchema.safeParse(rusak).success).toBe(false);
  });

  it("menolak unsur yang bukan agem/tandang/tangkis/tangkep", () => {
    const rusak = structuredClone(pelajaranValid);
    rusak.gerak[0]!.unsurUtama = ["salsa"];
    expect(PelajaranSchema.safeParse(rusak).success).toBe(false);
  });

  it("menolak segmen yang keluar dari rentang gerak", () => {
    const rusak = structuredClone(pelajaranValid);
    rusak.gerak[0]!.segmen![1]!.selesaiDetik = 9.5;
    expect(PelajaranSchema.safeParse(rusak).success).toBe(false);
  });

  it("menolak jenis segmen yang tidak dikenal", () => {
    const rusak = structuredClone(pelajaranValid);
    rusak.gerak[0]!.segmen![0]!.jenis = "lompat";
    expect(PelajaranSchema.safeParse(rusak).success).toBe(false);
  });
});
