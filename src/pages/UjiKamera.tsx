import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import KameraView from "../components/KameraView";
import PanelUjiAi, { type CuplikanUji } from "../components/PanelUjiAi";
import type { HasilDeteksi } from "../vision/types";
import { PengukurFps } from "../vision/pengukurFps";
import type { StatusVisi } from "../vision/useVisi";

// Uji kamera dan AI tahap 1 (docs/06 bagian 2): kecepatan, bagian yang terbaca, kiri–kanan, lirikan.
// Dulu halaman Latihan; sejak 3 Nov 2026 latihan bersama video guru ada di /latihan/:kelasId.
export default function UjiKamera() {
  const [mulai, setMulai] = useState(false);
  const [statusVisi, setStatusVisi] = useState<StatusVisi>({ tahap: "memuat" });
  const [cuplikan, setCuplikan] = useState<CuplikanUji | null>(null);
  const [pengukur] = useState(() => new PengukurFps());
  const terakhir = useRef<{ hasil: HasilDeteksi; lamaProsesMs: number } | null>(null);

  // Stickman digambar setiap frame oleh KameraView; panel cukup diperbarui 5× per detik.
  const saatHasil = useCallback(
    (hasil: HasilDeteksi, lamaProsesMs: number) => {
      terakhir.current = { hasil, lamaProsesMs };
      pengukur.catat(performance.now());
    },
    [pengukur],
  );

  useEffect(() => {
    if (!mulai) return;
    const id = window.setInterval(() => {
      const t = terakhir.current;
      if (t) setCuplikan({ ...t, fps: pengukur.fps() });
    }, 200);
    return () => window.clearInterval(id);
  }, [mulai, pengukur]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold text-emas">Alat uji · docs/06 bagian 2</p>
        <h1 className="text-2xl font-extrabold">Uji kamera dan AI</h1>
        <p className="text-stone-600">
          Memeriksa kecepatan AI, bagian tubuh yang terbaca, kiri–kanan, dan arah lirikan. Untuk berlatih bersama video guru, pilih kelas di{" "}
          <Link to="/" className="font-semibold text-merah-bata underline">
            etalase
          </Link>
          .
        </p>
      </header>

      {mulai ? (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <KameraView saatHasil={saatHasil} saatStatusVisi={setStatusVisi} />
          <PanelUjiAi cuplikan={cuplikan} statusVisi={statusVisi} />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-stone-700">
            Uji ini menyalakan kamera dan AI <strong>langsung di perangkat Anda</strong>. Video kamera tidak dikirim ke mana pun. Berdirilah 2–3
            langkah dari kamera supaya seluruh tubuh terlihat.
          </p>
          <button
            type="button"
            onClick={() => setMulai(true)}
            className="rounded-xl bg-kunyit px-5 py-2.5 font-semibold text-white hover:bg-kunyit-gelap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kunyit"
          >
            Nyalakan kamera dan AI
          </button>
        </div>
      )}
    </section>
  );
}
