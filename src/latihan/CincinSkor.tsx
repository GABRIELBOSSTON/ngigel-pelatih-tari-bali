import { BATAS_PREDIKAT } from "./sesi";

/** Warna skor mengikuti batas predikat: hijau ≥ "bagus", kuning ≥ "cukup", merah di bawahnya; abu-abu bila belum ada nilai. */
export function warnaSkor(skor: number | null): string {
  if (skor === null) return "#a8a29e";
  if (skor >= BATAS_PREDIKAT.bagus) return "#16a34a";
  if (skor >= BATAS_PREDIKAT.cukup) return "#eab308";
  return "#dc2626";
}

type Props = { skor: number | null; ukuran?: number; tebal?: number; label?: string; terang?: boolean };

/** Cincin skor 0–100 dengan angka di tengah. */
export default function CincinSkor({ skor, ukuran = 64, tebal = 6, label, terang = false }: Props) {
  const r = (ukuran - tebal) / 2;
  const keliling = 2 * Math.PI * r;
  const isi = skor === null ? 0 : Math.max(0, Math.min(100, skor)) / 100;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: ukuran, height: ukuran }} role="img" aria-label={label ?? (skor === null ? "Belum ada nilai" : `Nilai ${skor} dari 100`)}>
      <svg width={ukuran} height={ukuran} className="-rotate-90" aria-hidden="true">
        <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" stroke={terang ? "rgb(255 255 255 / 0.2)" : "#e7e5e4"} strokeWidth={tebal} />
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          stroke={warnaSkor(skor)}
          strokeWidth={tebal}
          strokeLinecap="round"
          strokeDasharray={keliling}
          strokeDashoffset={keliling * (1 - isi)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className={`absolute font-extrabold tabular-nums ${terang ? "text-white" : "text-tinta"}`} style={{ fontSize: ukuran * 0.32 }} aria-hidden="true">
        {skor ?? "–"}
      </span>
    </span>
  );
}
