import { describe, expect, it } from "vitest";
import { bacaKodeSesi, kodekanSesi, tautanBagikan } from "../src/latihan/bagikan";
import { pilihSuaraIndonesia } from "../src/latihan/pelatihSuara";
import type { SesiTersimpan } from "../src/latihan/riwayat";
import { nilaiSeledet, petaWaktuMurid, tanganDiAtasKepala } from "../src/latihan/sesi";
import type { FrameFitur } from "../src/scoring/fitur";
import { batasCepatDetik, cariSeledet, cocokkanSeledet } from "../src/scoring/seledet";
import { ketajaman, rataKecerahan } from "../src/vision/kecerahan";
import { POSE } from "../src/vision/poseIndex";
import type { Titik } from "../src/vision/types";

/**
 * Deret lirikan 15 fps dengan bias netral −0,2 (seperti penari Janger) dan seledet cepat di detik-detik
 * tertentu: lirikan naik ke ±0,6 relatif dalam dua frame, ditahan 0,4 detik, lalu kembali.
 */
function deretLirikan(detik: number, seledet: { t: number; arah: 1 | -1 }[], fps = 15, netral = -0.2): FrameFitur[] {
  return Array.from({ length: Math.round(detik * fps) }, (_, i) => {
    const t = i / fps;
    const aktif = seledet.find((s) => t >= s.t && t < s.t + 0.4);
    return { t, nilai: { lirikan: aktif ? netral + 0.6 * aktif.arah : netral } };
  });
}

describe("seledet sebagai kejadian", () => {
  it("menemukan lirikan cepat relatif terhadap netral penari, beserta arahnya", () => {
    const k = cariSeledet(deretLirikan(10, [{ t: 2, arah: 1 }, { t: 5, arah: -1 }, { t: 8, arah: 1 }]));
    expect(k.map((x) => x.arah)).toEqual([1, -1, 1]);
    expect(k[0]!.t).toBeCloseTo(2, 1);
    expect(k[1]!.t).toBeCloseTo(5, 1);
  });

  it("bias netral tidak dihitung sebagai seledet", () => {
    expect(cariSeledet(deretLirikan(10, [], 15, -0.5))).toEqual([]);
  });

  it("lirikan yang bergeser pelan (lebih dari 0,3 detik) bukan seledet", () => {
    const pelan: FrameFitur[] = Array.from({ length: 60 }, (_, i) => ({ t: i / 15, nilai: { lirikan: Math.min(0.6, i * 0.02) } }));
    expect(cariSeledet(pelan)).toEqual([]);
  });

  it("di perangkat lambat (5 fps), kenaikan yang terbagi ke dua frame tetap seledet; yang pelan tidak", () => {
    // Netral −0,2. Satu seledet setiap 2 detik: setengah jalan di frame ke-3, lewat ambang di frame ke-4.
    const cepat: FrameFitur[] = Array.from({ length: 50 }, (_, i) => {
      const k = i % 10;
      return { t: i / 5, nilai: { lirikan: k === 3 ? 0.05 : k === 4 || k === 5 ? 0.4 : -0.2 } };
    });
    expect(batasCepatDetik(cepat.map((f) => f.t))).toBeCloseTo(0.567, 2);
    expect(cariSeledet(cepat)).toHaveLength(5);
    // Naik bertahap selama 0,8 detik: tetap bukan seledet, meski batasnya dilonggarkan.
    const pelan: FrameFitur[] = Array.from({ length: 50 }, (_, i) => {
      const r = [0, 0.2, 0.25, 0.3, 0.6, 0, 0, 0, 0, 0][i % 10]!;
      return { t: i / 5, nilai: { lirikan: -0.2 + r } };
    });
    expect(cariSeledet(pelan)).toEqual([]);
  });

  it("batas cepat tetap 0,3 detik pada 15 fps dan tidak lebih dari 0,6 detik", () => {
    expect(batasCepatDetik(Array.from({ length: 30 }, (_, i) => i / 15))).toBeCloseTo(0.3, 5);
    expect(batasCepatDetik(Array.from({ length: 30 }, (_, i) => i / 30))).toBeCloseTo(0.3, 5);
    expect(batasCepatDetik(Array.from({ length: 30 }, (_, i) => i / 2))).toBe(0.6);
  });

  it("frame tanpa lirikan dilewati, bukan dianggap netral", () => {
    const d = deretLirikan(6, [{ t: 3, arah: 1 }]).map((f, i) => (i % 3 === 1 ? { t: f.t, nilai: { lirikan: null } } : f));
    expect(cariSeledet(d)).toHaveLength(1);
  });

  it("murid yang menirukan dengan terlambat tetap dihitung tepat bila waktunya dipetakan", () => {
    const guru = [{ t: 2, arah: 1 as const }, { t: 5, arah: -1 as const }, { t: 8, arah: 1 as const }];
    const murid = [{ t: 2.6, arah: 1 as const }, { t: 5.7, arah: 1 as const }];
    const h = cocokkanSeledet(guru, murid, (t) => t + 0.6);
    expect(h).toMatchObject({ jumlahGuru: 3, tepat: 1, arahSalah: 1 });
    expect(h.kejadian.map((k) => k.status)).toEqual(["tepat", "arah-salah", "terlewat"]);
  });

  it("satu kejadian murid tidak dipakai untuk dua kejadian guru", () => {
    const guru = [{ t: 2, arah: 1 as const }, { t: 2.4, arah: 1 as const }];
    const h = cocokkanSeledet(guru, [{ t: 2.2, arah: 1 as const }], (t) => t);
    expect(h.tepat).toBe(1);
    expect(h.kejadian.filter((k) => k.status === "terlewat")).toHaveLength(1);
  });

  it("nilai seledet sesi: murid identik semua tepat; tanpa lirikan murid → tidak terbaca", () => {
    const guru = deretLirikan(10, [{ t: 2, arah: 1 }, { t: 6, arah: -1 }]);
    const jalur = guru.map((_, i) => [i, i] as [number, number]);
    expect(nilaiSeledet(guru, guru, jalur, false)).toMatchObject({ jumlahGuru: 2, tepat: 2 });
    const tanpaWajah = guru.map((f) => ({ t: f.t, nilai: { lirikan: null } }));
    expect(nilaiSeledet(guru, tanpaWajah, jalur, false)).toEqual({ tidakTerbaca: true, jumlahGuru: 2 });
    expect(nilaiSeledet(deretLirikan(5, []), guru, jalur, false)).toBeNull();
  });

  it("guru yang memperagakan cermin: arah lirikan guru dibalik sebelum dibandingkan", () => {
    const guru = deretLirikan(6, [{ t: 2, arah: 1 }]);
    const murid = deretLirikan(6, [{ t: 2, arah: -1 }]);
    const jalur = guru.map((_, i) => [i, i] as [number, number]);
    expect(nilaiSeledet(guru, murid, jalur, false)).toMatchObject({ tepat: 0, arahSalah: 1 });
    expect(nilaiSeledet(guru, murid, jalur, true)).toMatchObject({ tepat: 1, arahSalah: 0 });
  });

  it("peta waktu guru → murid mengikuti jalur DTW", () => {
    const guru: FrameFitur[] = [0, 1, 2, 3].map((t) => ({ t, nilai: {} }));
    const murid: FrameFitur[] = [0.5, 1.5, 2.5, 3.5].map((t) => ({ t, nilai: {} }));
    const peta = petaWaktuMurid(guru, murid, [[0, 0], [1, 1], [2, 2], [3, 3]]);
    expect(peta(2)).toBe(2.5);
    expect(peta(2.2)).toBe(2.5);
  });
});

describe("gestur, kecerahan, dan suara", () => {
  const pose = (yTangan: number): Titik[] =>
    Array.from({ length: 33 }, (_, i) =>
      i === POSE.PERGELANGAN_KIRI || i === POSE.PERGELANGAN_KANAN ? { x: 0.5, y: yTangan, z: 0, visibility: 0.9 } : { x: 0.5, y: i === POSE.HIDUNG ? 0.3 : 0.6, z: 0, visibility: 0.9 },
    );

  it("gestur mulai: kedua pergelangan jelas di atas hidung", () => {
    expect(tanganDiAtasKepala(pose(0.15))).toBe(true);
    expect(tanganDiAtasKepala(pose(0.28))).toBe(false); // hanya sedikit di atas hidung
    expect(tanganDiAtasKepala(pose(0.5))).toBe(false);
    expect(tanganDiAtasKepala(null)).toBe(false);
    const ragu = pose(0.15).map((t, i) => (i === POSE.PERGELANGAN_KIRI ? { ...t, visibility: 0.2 } : t));
    expect(tanganDiAtasKepala(ragu)).toBe(false);
  });

  it("kecerahan rata-rata dari data RGBA", () => {
    expect(rataKecerahan([255, 255, 255, 255, 0, 0, 0, 255])).toBeCloseTo(127.5);
    expect(rataKecerahan([])).toBeNull();
  });

  it("ketajaman: pola tajam tinggi, versi buram jauh lebih rendah, gambar rata tidak dinilai; tidak bergantung terang", () => {
    const L = 40;
    // Garis tegak hitam-putih selebar 4 piksel; versi buram = rata-rata 5 piksel mendatar.
    const nilai = (x: number) => (Math.floor(x / 4) % 2 === 0 ? 220 : 30);
    const rgba = (f: (x: number) => number, skala = 1) =>
      Array.from({ length: L * L }, (_, i) => f(i % L) * skala).flatMap((v) => [v, v, v, 255]);
    const buram = (x: number) => [-2, -1, 0, 1, 2].reduce((a, d) => a + nilai(Math.min(L - 1, Math.max(0, x + d))), 0) / 5;
    const tajam = ketajaman(rgba(nilai), L, L)!;
    const kabur = ketajaman(rgba(buram), L, L)!;
    expect(kabur).toBeLessThan(tajam / 4);
    // Lebih gelap 70%: ketajaman (dibagi kontras) tetap sama.
    expect(ketajaman(rgba(nilai, 0.3), L, L)).toBeCloseTo(tajam, 5);
    // Gambar rata (mis. hitam) tidak bisa dinilai.
    expect(ketajaman(rgba(() => 0), L, L)).toBeNull();
  });

  it("pelatih suara memilih suara bahasa Indonesia, mendahulukan yang lokal", () => {
    const suara = [
      { lang: "en-US", localService: true, name: "A" },
      { lang: "id-ID", localService: false, name: "Google Bahasa Indonesia" },
      { lang: "id_ID", localService: true, name: "Lokal" },
    ];
    expect(pilihSuaraIndonesia(suara)?.name).toBe("Lokal");
    expect(pilihSuaraIndonesia([{ lang: "en-GB", localService: true }])).toBeNull();
  });
});

describe("bagikan hasil lewat tautan", () => {
  const sesi: SesiTersimpan = {
    id: "abc-1234", kelasId: "tari-kreasi-janger", namaKelas: "Tari Kreasi Janger", memakaiContoh: false, videoDariBerkas: false,
    dibuat: "2026-11-03T02:00:00.000Z", mulai: 40, akhir: 70, skorTotal: 76,
    skor: { agem: 84, tandang: 72, tangkis: 74, tangkep: 68 }, alasan: {},
    penyimpangan: [{ unsur: "tangkep", fitur: "lirikan", bagian: "mata", jenis: "melirik (seledet) ke arah yang berbeda dari guru", selisihToleransi: 1.2, waktuDetik: 69 }],
    terlambatDetik: 0.75, tubuhTerbacaPersen: 100, garisWaktu: Array.from({ length: 30 }, (_, i) => 80 + (i % 7)),
    segmen: [{ jenis: "peralihan", mulaiDetik: 40, selesaiDetik: 70 }], fpsRata: 4.2, modeAi: "Holistic · CPU", kecepatanPutar: 1,
    seledet: { jumlahGuru: 6, tepat: 4, arahSalah: 1, kejadian: [{ t: 45, status: "tepat" }] },
  };

  it("kode tautan bisa dibaca kembali utuh dan cukup pendek untuk chat", async () => {
    const kode = await kodekanSesi(sesi);
    expect(kode.startsWith("1.")).toBe(true);
    expect(kode).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(kode.length).toBeLessThan(2000);
    expect(await bacaKodeSesi(kode)).toEqual(sesi);
    expect(tautanBagikan("https://ngigel.contoh", "/", kode)).toBe(`https://ngigel.contoh/hasil/bagikan#d=${kode}`);
  });

  it("kode rusak, terpotong, atau berversi lain ditolak tanpa galat", async () => {
    const kode = await kodekanSesi(sesi);
    expect(await bacaKodeSesi(kode.slice(0, kode.length / 2))).toBeNull();
    expect(await bacaKodeSesi("2." + kode.slice(2))).toBeNull();
    expect(await bacaKodeSesi("1.bukan-base64-yang-benar!!")).toBeNull();
  });
});
