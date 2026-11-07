import type { Segmen } from "../lessons/schema";
import { formatDurasi } from "../katalog/katalog";
import type { Rentang } from "./sesi";

export const WARNA_SEGMEN = { pokok: "bg-emerald-600", peralihan: "bg-amber-500", perpindahan: "bg-sky-600" } as const;
export const NAMA_SEGMEN = { pokok: "Sikap pokok (agem)", peralihan: "Peralihan (tangkis)", perpindahan: "Perpindahan (tandang)" } as const;

/** Warna kemiripan per detik; sama dengan ambang skor (≥ 70 hijau, ≥ 50 kuning). */
export const warnaKemiripan = (v: number) => (v >= 70 ? "#16a34a" : v >= 50 ? "#eab308" : "#dc2626");

type Props = {
  segmen: readonly Segmen[];
  rentang: Rentang;
  /** Kemiripan rata-rata per detik sejak rentang.mulai. */
  garis: readonly (number | null)[];
  waktu: number;
  /** Rentang yang disorot (mis. bagian tersulit). */
  sorot?: Rentang | null;
  /** Penanda kejadian di atas garis (mis. seledet), dengan warna dan keterangan. */
  penanda?: readonly { t: number; warna: string; label: string }[];
  terang?: boolean;
};

/** Garis waktu rentang latihan: segmen guru, kemiripan per detik, dan posisi video saat ini. */
export default function GarisWaktuLatihan({ segmen, rentang, garis, waktu, sorot, penanda = [], terang = false }: Props) {
  const lama = Math.max(0.001, rentang.akhir - rentang.mulai);
  const persen = (t: number) => `${(100 * Math.min(Math.max(t - rentang.mulai, 0), lama)) / lama}%`;
  const terlihat = segmen.filter((s) => s.selesaiDetik > rentang.mulai && s.mulaiDetik < rentang.akhir);
  const posisi = Math.min(Math.max(waktu, rentang.mulai), rentang.akhir);

  return (
    <div className="w-full">
      <div className={`relative h-9 ${penanda.length > 0 ? "mt-3" : ""}`}>
        {penanda
          .filter((p) => p.t >= rentang.mulai && p.t <= rentang.akhir)
          .map((p) => (
            <span
              key={`${p.t}-${p.label}`}
              title={`${p.label} · ${formatDurasi(p.t)}`}
              className="absolute -top-3 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent"
              style={{ left: persen(p.t), borderTopColor: p.warna }}
            />
          ))}
        {/* Kemiripan per detik */}
        <div className="absolute inset-x-0 top-0 flex h-4 gap-px overflow-hidden rounded-md" aria-hidden="true">
          {garis.length > 0
            ? garis.map((v, i) => <span key={i} className="h-full flex-1" style={{ backgroundColor: v === null ? (terang ? "rgb(255 255 255 / 0.12)" : "#e7e5e4") : warnaKemiripan(v) }} />)
            : <span className={`h-full flex-1 ${terang ? "bg-white/10" : "bg-stone-200"}`} />}
        </div>
        {/* Segmen gerak guru */}
        <div className="absolute inset-x-0 bottom-0 h-3 overflow-hidden rounded-md bg-stone-300/60" aria-label="Segmen gerak guru">
          {terlihat.map((s) => {
            const kiri = Math.max(s.mulaiDetik, rentang.mulai);
            const kanan = Math.min(s.selesaiDetik, rentang.akhir);
            return (
              <span
                key={`${s.mulaiDetik}-${s.jenis}`}
                className={`absolute inset-y-0 ${WARNA_SEGMEN[s.jenis]}`}
                style={{ left: persen(kiri), width: `${(100 * (kanan - kiri)) / lama}%` }}
                title={`${NAMA_SEGMEN[s.jenis]}: ${formatDurasi(s.mulaiDetik)}–${formatDurasi(s.selesaiDetik)}`}
              />
            );
          })}
        </div>
        {sorot && (
          <span
            className="absolute -inset-y-1 rounded-md ring-2 ring-kunyit"
            style={{ left: persen(sorot.mulai), width: `${(100 * (Math.min(sorot.akhir, rentang.akhir) - Math.max(sorot.mulai, rentang.mulai))) / lama}%` }}
            aria-hidden="true"
          />
        )}
        <span className={`absolute -top-1 -bottom-1 w-0.5 rounded ${terang ? "bg-white" : "bg-tinta"}`} style={{ left: persen(posisi) }} aria-hidden="true" />
      </div>
      <div className={`mt-1.5 flex justify-between text-[11px] font-semibold tabular-nums ${terang ? "text-white/70" : "text-stone-500"}`}>
        <span>{formatDurasi(rentang.mulai)}</span>
        <span>{formatDurasi(rentang.akhir)}</span>
      </div>
    </div>
  );
}
