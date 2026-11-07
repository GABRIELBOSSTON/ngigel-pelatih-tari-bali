import { useEffect, useRef, useState } from "react";
import { hitungDeretFitur, type FrameFitur } from "../scoring/fitur";
import { nilaiLatihan } from "../scoring/penilaian";
import { keSegmen, labelSegmen, type JenisSegmen } from "../scoring/segmentasi";
import {
  barisSkenario,
  getaranSiku,
  porsiSegmen,
  sebaranKecepatan,
  skenarioTerkendali,
  statistikDeteksi,
  ujiCermin,
  type BarisSkenario,
} from "../uji/analisis";
import { ekstrakDariVideo, type HasilEkstrak } from "../vision/ekstrakVideo";
import type { OpsiPendeteksi } from "../vision/landmarkers";
import type { JalurAi } from "../vision/types";
import { KlienVisi } from "../vision/visionClient";

// Alat uji pengembang (docs/06 bagian 2 dan docs/09): menjalankan AI Ngigel pada berkas video,
// lalu mengukur deteksi, kiri–kanan, segmentasi, dan penilaian. Tidak ditautkan dari navigasi.

export type KonfigUji = {
  fps: number;
  /** Nama berkas yang juga diuji dengan gambar dibalik (uji cermin). */
  cermin: string[];
  /** Nama berkas yang juga diuji dengan jalur tiga model terpisah. */
  terpisah: string[];
  /** Potongan waktu per berkas: [mulaiDetik, lamaDetik]. */
  potong: Record<string, [number, number]>;
  /** Pasangan guru–murid antarvideo: [guru, murid, opsi cermin]. */
  pasangan: Array<[string, string, boolean?]>;
  /** Varian percobaan pendeteksi untuk berkas tertentu (mis. GPU tanpa blendshape). */
  varian: Array<{ label: string; berkas: string[]; jalur: JalurAi; opsi?: OpsiPendeteksi }>;
  /** Sertakan deret fitur dan label segmen di hasil, untuk kalibrasi tanpa mengulang deteksi. */
  simpanDeret: boolean;
};

type Lari = { jalur: JalurAi; balik: boolean; label?: string; keterangan: string; lamaMemuatMs: number; ekstrak: HasilEkstrak };

type HasilVideo = {
  berkas: string;
  durasiDetik: number;
  ukuran: string;
  lari: Array<Omit<Lari, "ekstrak"> & { statistik: ReturnType<typeof statistikDeteksi> }>;
  segmen: ReturnType<typeof porsiSegmen>;
  jumlahSegmen: number;
  kecepatan: ReturnType<typeof sebaranKecepatan>;
  getaranSikuDerajat: number | null;
  cermin: ReturnType<typeof ujiCermin> | null;
  skenario: BarisSkenario[];
  deret?: FrameFitur[];
  label?: JenisSegmen[];
  deretBalik?: FrameFitur[];
};

export type HasilUji = {
  selesai: boolean;
  konfig: KonfigUji;
  lingkungan: { userAgent: string; jumlahInti: number };
  video: HasilVideo[];
  pasangan: BarisSkenario[];
  galat: string[];
};

declare global {
  interface Window {
    jalankanUji?: (konfig: Partial<KonfigUji>) => Promise<void>;
    __hasilUji?: HasilUji;
  }
}

function muatVideo(berkas: File): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = URL.createObjectURL(berkas);
  return new Promise((selesai, gagal) => {
    video.addEventListener("loadeddata", () => selesai(video), { once: true });
    video.addEventListener("error", () => gagal(new Error(`Video ${berkas.name} tidak bisa dibuka.`)), { once: true });
  });
}

export default function UjiVideo() {
  const masukanRef = useRef<HTMLInputElement>(null);
  const [kemajuan, setKemajuan] = useState("");
  const [hasil, setHasil] = useState<HasilUji | null>(null);

  useEffect(() => {
    window.jalankanUji = async (sebagian) => {
      const konfig: KonfigUji = { fps: 15, cermin: [], terpisah: [], potong: {}, pasangan: [], varian: [], simpanDeret: false, ...sebagian };
      const keluaran: HasilUji = {
        selesai: false,
        konfig,
        lingkungan: { userAgent: navigator.userAgent, jumlahInti: navigator.hardwareConcurrency },
        video: [],
        pasangan: [],
        galat: [],
      };
      window.__hasilUji = keluaran;
      const deretPerBerkas = new Map<string, { deret: FrameFitur[]; label: JenisSegmen[] }>();

      for (const berkas of Array.from(masukanRef.current?.files ?? [])) {
        try {
          const video = await muatVideo(berkas);
          const [mulaiDetik, lamaDetik] = konfig.potong[berkas.name] ?? [0, Number.POSITIVE_INFINITY];
          const daftar: Array<{ jalur: JalurAi; balik: boolean; opsi?: OpsiPendeteksi; label?: string }> = [{ jalur: "holistic", balik: false }];
          if (konfig.cermin.includes(berkas.name)) daftar.push({ jalur: "holistic", balik: true });
          if (konfig.terpisah.includes(berkas.name)) daftar.push({ jalur: "terpisah", balik: false });
          for (const v of konfig.varian) {
            if (v.berkas.includes(berkas.name)) daftar.push({ jalur: v.jalur, balik: false, label: v.label, ...(v.opsi ? { opsi: v.opsi } : {}) });
          }

          const lari: Lari[] = [];
          for (const { jalur, balik, opsi, label } of daftar) {
            // Worker baru untuk setiap lari: cap waktu MediaPipe harus selalu naik dalam satu sesi.
            const klien = new KlienVisi();
            try {
              const { keterangan, lamaMemuatMs } = await klien.mulai(jalur, opsi);
              const ekstrak = await ekstrakDariVideo(video, klien, {
                fps: konfig.fps,
                mulaiDetik,
                lamaDetik,
                balikGambar: balik,
                saatKemajuan: (n, total) => setKemajuan(`${berkas.name} · ${keterangan}${balik ? " · dibalik" : ""}: ${n}/${total}`),
              });
              lari.push({ jalur, balik, keterangan, lamaMemuatMs, ekstrak, ...(label ? { label } : {}) });
            } finally {
              klien.tutup();
            }
          }

          const utama = lari[0]!;
          const deret = hitungDeretFitur(utama.ekstrak.frame);
          const label = labelSegmen(deret);
          deretPerBerkas.set(berkas.name, { deret, label });
          const larianBalik = lari.find((l) => l.balik);
          keluaran.video.push({
            berkas: berkas.name,
            durasiDetik: Math.round(video.duration * 10) / 10,
            ukuran: `${video.videoWidth}×${video.videoHeight}`,
            lari: lari.map(({ ekstrak, ...l }) => ({ ...l, statistik: statistikDeteksi(ekstrak.frame, ekstrak.lamaProsesMs) })),
            segmen: porsiSegmen(label),
            jumlahSegmen: keSegmen(deret, label).length,
            kecepatan: sebaranKecepatan(deret),
            getaranSikuDerajat: getaranSiku(deret, label),
            cermin: larianBalik ? ujiCermin(utama.ekstrak.frame, larianBalik.ekstrak.frame) : null,
            skenario: skenarioTerkendali(deret, label, larianBalik ? hitungDeretFitur(larianBalik.ekstrak.frame) : undefined),
            ...(konfig.simpanDeret
              ? { deret, label, ...(larianBalik ? { deretBalik: hitungDeretFitur(larianBalik.ekstrak.frame) } : {}) }
              : {}),
          });
          URL.revokeObjectURL(video.src);
        } catch (galat) {
          keluaran.galat.push(`${berkas.name}: ${String(galat)}`);
        }
        setHasil({ ...keluaran });
      }

      for (const [guru, murid, cermin] of konfig.pasangan) {
        const g = deretPerBerkas.get(guru);
        const m = deretPerBerkas.get(murid);
        if (!g || !m) continue;
        const nama = `${guru} → ${murid}${cermin ? " (opsi cermin)" : ""}`;
        keluaran.pasangan.push(barisSkenario(nama, "", nilaiLatihan(g.deret, g.label, m.deret, { guruMemperagakanCermin: !!cermin })));
      }
      keluaran.selesai = true;
      setKemajuan("Selesai.");
      setHasil({ ...keluaran });
    };
    return () => {
      delete window.jalankanUji;
    };
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-emas">Alat uji pengembang</p>
        <h1 className="text-2xl font-bold">Uji AI dengan video</h1>
        <p className="text-stone-600">
          Video diproses di perangkat ini dan tidak dikirim ke mana pun. Hasil lengkap ada di <code>window.__hasilUji</code>.
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <input ref={masukanRef} type="file" accept="video/*" multiple aria-label="Pilih video uji" />
        <button
          type="button"
          onClick={() => void window.jalankanUji?.({})}
          className="rounded-lg bg-merah-bata px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Jalankan uji
        </button>
        <p role="status" className="text-sm text-stone-600">
          {kemajuan}
        </p>
      </div>
      {hasil && (
        <div className="space-y-4 text-sm">
          {hasil.video.map((v) => (
            <article key={v.berkas} className="rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="font-semibold">{v.berkas}</h2>
              <ul className="list-disc pl-5 text-stone-700">
                {v.lari.map((l) => (
                  <li key={l.keterangan + l.balik}>
                    {l.keterangan}
                    {l.balik ? " (dibalik)" : ""}: tubuh {l.statistik.tubuhPersen}%, tangan {l.statistik.tanganKiriPersen}/
                    {l.statistik.tanganKananPersen}%, wajah {l.statistik.wajahPersen}%, {l.statistik.prosesRataMs} ms/frame
                  </li>
                ))}
              </ul>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr>
                    <th>Skenario</th>
                    <th>Total</th>
                    <th>Agem</th>
                    <th>Tandang</th>
                    <th>Tangkis</th>
                    <th>Tangkep</th>
                  </tr>
                </thead>
                <tbody>
                  {v.skenario.map((s) => (
                    <tr key={s.skenario}>
                      <td>{s.skenario}</td>
                      <td>{s.total ?? "—"}</td>
                      <td>{s.agem ?? "—"}</td>
                      <td>{s.tandang ?? "—"}</td>
                      <td>{s.tangkis ?? "—"}</td>
                      <td>{s.tangkep ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
          {hasil.galat.length > 0 && <pre className="text-merah-bata">{hasil.galat.join("\n")}</pre>}
        </div>
      )}
    </section>
  );
}
