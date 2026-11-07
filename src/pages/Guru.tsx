import { useState, type FormEvent } from "react";
import { bacaGerakDariBerkas, type GerakDariVideo } from "../lessons/bacaVideoGuru";
import { susunPelajaran } from "../lessons/susunPelajaran";
import type { Pelajaran, SumberVideo } from "../lessons/schema";

// Mode guru (docs/03 bagian F): video gerak → titik → segmen → JSON pelajaran.
// Video diproses di perangkat; yang disimpan hanya angka gerak.

const FPS_PELAJARAN = 15;
const VERSI_MODEL = "tasks-vision 1.1.1 · holistic_landmarker float16/1";
const WARNA_SEGMEN = { pokok: "bg-emerald-600", peralihan: "bg-amber-500", perpindahan: "bg-sky-600" } as const;
const NAMA_SEGMEN = { pokok: "sikap pokok (agem)", peralihan: "peralihan (tangkis)", perpindahan: "perpindahan (tandang)" } as const;

type Hasil = { pelajaran: Pelajaran; ringkas: GerakDariVideo["ringkas"] } | { galat: string };

function unduhJson(pelajaran: Pelajaran) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(pelajaran)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pelajaran.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const kelasMasukan = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 focus:border-merah-tua focus:outline-none focus:ring-2 focus:ring-merah-tua/20";

export default function Guru() {
  const [kemajuan, setKemajuan] = useState<string | null>(null);
  const [hasil, setHasil] = useState<Hasil | null>(null);

  async function buat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const berkas = form.get("video");
    if (!(berkas instanceof File) || berkas.size === 0) return;
    setHasil(null);
    try {
      const gerak = await bacaGerakDariBerkas(berkas, { fps: FPS_PELAJARAN, saatKemajuan: (teks) => setKemajuan(teks) });
      const sumberVideo: SumberVideo = {
        jenis: "unggahan",
        lisensi: form.get("lisensi") as SumberVideo["lisensi"],
        kredit: String(form.get("kredit")),
      };
      const hasilSusun = susunPelajaran(
        {
          judul: String(form.get("judul")),
          namaGerak: String(form.get("gerak")),
          guru: { nama: String(form.get("guru")), ...(form.get("sanggar") ? { sanggar: String(form.get("sanggar")) } : {}) },
          sumberVideo,
          guruMemperagakanCermin: form.get("cermin") === "on",
          modelVersi: VERSI_MODEL,
          fps: FPS_PELAJARAN,
        },
        gerak.deret,
        gerak.label,
      );
      setHasil(
        hasilSusun.success
          ? { pelajaran: hasilSusun.data, ringkas: gerak.ringkas }
          : { galat: hasilSusun.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      );
    } catch (galat) {
      setHasil({ galat: String(galat) });
    } finally {
      setKemajuan(null);
    }
  }

  const gerak = hasil && "pelajaran" in hasil ? hasil.pelajaran.gerak[0] : undefined;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold text-emas">Mode guru</p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Untuk Guru Sanggar</h1>
        <p className="text-stone-600">
          Rekam gerak sekali, murid berlatih kapan saja. Video diproses di perangkat ini; yang disimpan hanya angka gerak.
        </p>
      </header>

      <form onSubmit={(e) => void buat(e)} className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="font-medium">Video gerak</span>
          <input name="video" type="file" accept="video/*" required className="block" />
          <span className="block text-sm text-stone-600">Satu penari, menghadap kamera, seluruh tubuh terlihat, kamera diam.</span>
        </label>
        <label className="space-y-1">
          <span className="font-medium">Judul pelajaran</span>
          <input name="judul" required className={kelasMasukan} placeholder="Gerak dasar putri" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Nama gerak</span>
          <input name="gerak" required className={kelasMasukan} placeholder="Agem kanan" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Nama guru atau penari</span>
          <input name="guru" required className={kelasMasukan} />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Sanggar (bila ada)</span>
          <input name="sanggar" className={kelasMasukan} />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Lisensi atau izin video</span>
          <select name="lisensi" className={kelasMasukan} defaultValue="milik-guru">
            <option value="milik-guru">Rekaman milik guru sendiri</option>
            <option value="izin-tertulis">Izin tertulis pemilik video</option>
            <option value="CC-BY">CC BY</option>
            <option value="CC-BY-SA">CC BY-SA</option>
            <option value="domain-publik">Domain publik</option>
            <option value="izin-diminta">Izin pemilik sedang diminta (tulis pemilik di kredit)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-medium">Kredit yang ditampilkan</span>
          <input name="kredit" required className={kelasMasukan} placeholder="Penari, sanggar, sumber video" />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input name="cermin" type="checkbox" />
          <span>Saya memperagakan secara cermin (kanan saya = kanan murid yang berhadapan)</span>
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={kemajuan !== null}
            className="rounded-xl bg-kunyit px-5 py-2.5 font-bold text-white hover:bg-kunyit-gelap disabled:opacity-60"
          >
            Buat pelajaran
          </button>
          {kemajuan && (
            <p role="status" className="text-sm text-stone-600">
              {kemajuan}
            </p>
          )}
        </div>
      </form>

      {hasil && "galat" in hasil && (
        <p role="alert" className="rounded-lg border border-merah-bata bg-white p-4 text-merah-bata">
          Pelajaran belum bisa dibuat: {hasil.galat}
        </p>
      )}

      {hasil && "pelajaran" in hasil && gerak && (
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-semibold">
            {hasil.pelajaran.judul}: {gerak.nama}
          </h2>
          <p className="text-sm text-stone-700">
            {gerak.frame.length} frame ({gerak.selesaiDetik.toFixed(1)} detik). Tubuh terbaca di {hasil.ringkas.tubuhPersen}% frame,
            tangan kiri/kanan {hasil.ringkas.tanganKiriPersen}%/{hasil.ringkas.tanganKananPersen}%, wajah {hasil.ringkas.wajahPersen}%.
            Unsur yang dinilai: {gerak.unsurUtama.join(", ")}.
          </p>
          <div>
            <p className="mb-1 text-sm font-medium">Bagian gerak (bisa dibetulkan di versi berikutnya):</p>
            <div className="flex h-5 w-full overflow-hidden rounded" aria-label="Garis waktu segmen gerak">
              {(gerak.segmen ?? []).map((s) => (
                <div
                  key={s.mulaiDetik}
                  className={WARNA_SEGMEN[s.jenis]}
                  style={{ width: `${(100 * (s.selesaiDetik - s.mulaiDetik)) / gerak.selesaiDetik}%` }}
                  title={`${NAMA_SEGMEN[s.jenis]}: ${s.mulaiDetik.toFixed(1)}–${s.selesaiDetik.toFixed(1)} detik`}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-4 text-sm text-stone-700">
              {(Object.keys(NAMA_SEGMEN) as Array<keyof typeof NAMA_SEGMEN>).map((j) => (
                <li key={j} className="flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-3 rounded-sm ${WARNA_SEGMEN[j]}`} aria-hidden="true" />
                  {NAMA_SEGMEN[j]}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => unduhJson(hasil.pelajaran)}
            className="rounded-xl border border-merah-bata px-4 py-2 font-bold text-merah-bata hover:bg-krem"
          >
            Unduh pelajaran (JSON)
          </button>
        </div>
      )}
    </section>
  );
}
