// Memuat materi latihan: JSON pelajaran (deret fitur guru) dan video guru.
// Bila keduanya tidak ada di server (mis. video yang izinnya belum ada tidak di-deploy), pengguna
// bisa memilih berkas video sendiri; gerak gurunya dibaca di perangkat, tidak disimpan.
import { useCallback, useEffect, useRef, useState } from "react";
import type { MateriKelas } from "../katalog/katalog";
import { bacaGerakDariBerkas } from "../lessons/bacaVideoGuru";
import { PelajaranSchema, type Segmen } from "../lessons/schema";
import { tukarSisi, type FrameFitur } from "../scoring/fitur";
import { keSegmen } from "../scoring/segmentasi";

export type MateriSiap = {
  judul: string;
  kredit: string;
  guruMemperagakanCermin: boolean;
  /** Deret guru apa adanya (penilaian akhir menukar sisi sendiri lewat opsi). */
  frame: FrameFitur[];
  /** Deret guru untuk umpan balik saat menari: sudah ditukar sisinya bila guru memperagakan cermin. */
  frameBanding: FrameFitur[];
  segmen: Segmen[];
  urlVideo: string;
  dariBerkas: boolean;
};

export type StatusMateri =
  | { tahap: "memuat" }
  | { tahap: "siap"; data: MateriSiap }
  | { tahap: "tidak-ada"; alasan: string }
  | { tahap: "menyiapkan"; teks: string; porsi: number }
  | { tahap: "galat"; pesan: string };

/** Laju baca video pilihan pengguna: lebih rendah dari 15 fps halaman guru supaya tidak terlalu lama. */
export const FPS_BERKAS_PENGGUNA = 10;

const alamat = (jalur: string) => `${import.meta.env.BASE_URL}${jalur}`;

/** Server pengembang dan Vercel mengembalikan index.html untuk berkas yang tidak ada; jenisnya dicek. */
async function adaBerkas(url: string, jenis: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok && (r.headers.get("content-type") ?? "").includes(jenis);
  } catch {
    return false;
  }
}

function siapkanBanding(frame: FrameFitur[], cermin: boolean): FrameFitur[] {
  return cermin ? frame.map((f) => ({ t: f.t, nilai: tukarSisi(f.nilai) })) : frame;
}

export function useMateri(materi: MateriKelas) {
  const [status, setStatus] = useState<StatusMateri>({ tahap: "memuat" });
  const urlBerkasRef = useRef<string | null>(null);

  useEffect(() => {
    let batal = false;
    setStatus({ tahap: "memuat" });
    (async () => {
      const [adaVideo, respon] = await Promise.all([adaBerkas(alamat(materi.video), "video"), fetch(alamat(materi.pelajaran)).catch(() => null)]);
      const json = respon?.ok && (respon.headers.get("content-type") ?? "").includes("json") ? ((await respon.json()) as unknown) : null;
      if (batal) return;
      if (!adaVideo || json === null) {
        setStatus({ tahap: "tidak-ada", alasan: !adaVideo ? "video guru" : "data gerak guru" });
        return;
      }
      const hasil = PelajaranSchema.safeParse(json);
      const gerak = hasil.success ? hasil.data.gerak[0] : undefined;
      if (!hasil.success || !gerak) {
        setStatus({ tahap: "galat", pesan: hasil.success ? "pelajaran tidak punya gerak" : hasil.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        return;
      }
      const frame = gerak.frame as FrameFitur[];
      setStatus({
        tahap: "siap",
        data: {
          judul: hasil.data.judul,
          kredit: hasil.data.sumberVideo.kredit,
          guruMemperagakanCermin: hasil.data.guruMemperagakanCermin,
          frame,
          frameBanding: siapkanBanding(frame, hasil.data.guruMemperagakanCermin),
          segmen: gerak.segmen ?? [],
          urlVideo: alamat(materi.video),
          dariBerkas: false,
        },
      });
    })().catch((g: unknown) => {
      if (!batal) setStatus({ tahap: "galat", pesan: String(g) });
    });
    return () => {
      batal = true;
    };
  }, [materi.video, materi.pelajaran]);

  useEffect(
    () => () => {
      if (urlBerkasRef.current) URL.revokeObjectURL(urlBerkasRef.current);
    },
    [],
  );

  /** Membaca gerak guru dari berkas video pilihan pengguna (cadangan). */
  const siapkanDariBerkas = useCallback(async (berkas: File, guruMemperagakanCermin: boolean) => {
    setStatus({ tahap: "menyiapkan", teks: "Memuat model AI…", porsi: 0 });
    try {
      const gerak = await bacaGerakDariBerkas(berkas, { fps: FPS_BERKAS_PENGGUNA, saatKemajuan: (teks, porsi) => setStatus({ tahap: "menyiapkan", teks, porsi }) });
      if (urlBerkasRef.current) URL.revokeObjectURL(urlBerkasRef.current);
      urlBerkasRef.current = URL.createObjectURL(berkas);
      setStatus({
        tahap: "siap",
        data: {
          judul: berkas.name,
          kredit: "Berkas dari perangkat Anda. Hanya dibaca di peramban ini; tidak disimpan dan tidak dikirim.",
          guruMemperagakanCermin,
          frame: gerak.deret,
          frameBanding: siapkanBanding(gerak.deret, guruMemperagakanCermin),
          segmen: keSegmen(gerak.deret, gerak.label),
          urlVideo: urlBerkasRef.current,
          dariBerkas: true,
        },
      });
    } catch (g) {
      setStatus({ tahap: "galat", pesan: g instanceof Error ? g.message : String(g) });
    }
  }, []);

  return { status, siapkanDariBerkas };
}
