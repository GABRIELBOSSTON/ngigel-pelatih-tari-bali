import { hitungLirikan, hitungSenyum } from "../scoring/wajah";
import type { HasilDeteksi } from "../vision/types";
import { arahLirikan, lenganLebihTinggi, tanganLebihTinggi, type SisiTubuh } from "../vision/ujiArah";
import type { StatusVisi } from "../vision/useVisi";

export type CuplikanUji = {
  hasil: HasilDeteksi;
  fps: number;
  lamaProsesMs: number;
};

type Props = {
  cuplikan: CuplikanUji | null;
  statusVisi: StatusVisi;
};

const teksSisi = (s: SisiTubuh | null) => (s === null ? "—" : s === "sejajar" ? "sejajar" : s.toUpperCase());
const tanda = (ada: boolean) => (ada ? "✓ terdeteksi" : "✗ tidak terdeteksi");

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-100 py-1.5 last:border-0">
      <dt className="text-stone-600">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{nilai}</dd>
    </div>
  );
}

// Panel uji tahap 1 (docs/06 bagian 2): memastikan kiri–kanan, lirikan, dan kecepatan AI
// sebelum mesin penilaian dibangun. Angkanya dibaca langsung dari hasil deteksi.
export default function PanelUjiAi({ cuplikan, statusVisi }: Props) {
  const h = cuplikan?.hasil ?? null;
  const lirikan = h?.wajah ? hitungLirikan(h.wajah) : null;
  const senyum = h?.wajah ? hitungSenyum(h.wajah) : null;

  return (
    <aside className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 text-sm">
      <section>
        <h2 className="mb-1 font-semibold">Kinerja AI</h2>
        <dl>
          <Baris label="Model" nilai={statusVisi.tahap === "siap" ? statusVisi.keterangan : statusVisi.tahap} />
          <Baris label="Deteksi per detik" nilai={cuplikan ? cuplikan.fps.toFixed(1) : "—"} />
          <Baris label="Waktu proses per frame" nilai={cuplikan ? `${cuplikan.lamaProsesMs.toFixed(0)} ms` : "—"} />
        </dl>
      </section>

      <section>
        <h2 className="mb-1 font-semibold">Yang terbaca</h2>
        <dl>
          <Baris label="Tubuh" nilai={tanda(!!h?.pose)} />
          <Baris label="Tangan kiri" nilai={tanda(!!h?.tanganKiri)} />
          <Baris label="Tangan kanan" nilai={tanda(!!h?.tanganKanan)} />
          <Baris label="Wajah" nilai={tanda(!!h?.wajah)} />
        </dl>
      </section>

      <section>
        <h2 className="mb-1 font-semibold">Uji arah</h2>
        <dl>
          <Baris label="Lengan lebih tinggi (tubuh)" nilai={teksSisi(lenganLebihTinggi(h?.pose ?? null))} />
          <Baris label="Tangan lebih tinggi (model tangan)" nilai={teksSisi(tanganLebihTinggi(h?.tanganKiri ?? null, h?.tanganKanan ?? null))} />
          <Baris
            label="Lirikan"
            nilai={lirikan === null ? "—" : `${lirikan.toFixed(2)} (${arahLirikan(lirikan) === "lurus" ? "lurus" : `ke ${arahLirikan(lirikan).toUpperCase()}`})`}
          />
          <Baris label="Senyum" nilai={senyum === null ? "—" : senyum.toFixed(2)} />
        </dl>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-stone-700">
          <li>Angkat lengan <strong>kanan</strong> Anda: kedua baris "lebih tinggi" harus menunjukkan KANAN.</li>
          <li>Lirik ke <strong>kanan</strong> Anda: lirikan harus positif ("ke KANAN").</li>
          <li>Catat hasilnya di docs/06 bagian 2. Bila terbalik, rumus di docs/04 harus ditukar.</li>
        </ol>
      </section>
    </aside>
  );
}
