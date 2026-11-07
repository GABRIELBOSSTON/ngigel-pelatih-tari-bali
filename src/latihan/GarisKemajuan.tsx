import { BATAS_PREDIKAT } from "./sesi";

// Garis kemajuan nilai satu kelas (small multiple): sumbu y tetap 0–100 supaya antarkelas bisa
// dibandingkan, sumbu x = urutan latihan. Hanya titik terakhir (bulat penuh) dan terbaik (cincin)
// yang ditandai; titik lain bisa disorot untuk melihat angkanya.

type Titik = { waktu: string; skor: number | null };

const LEBAR = 260;
const TINGGI = 72;
const TEPI = { kiri: 6, kanan: 30, atas: 8, bawah: 8 };
const WARNA_GARIS = "#0e3b2e"; // hutan
const WARNA_SURFACE = "#ffffff";

const waktuSingkat = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function GarisKemajuan({ data, judul }: { data: readonly Titik[]; judul: string }) {
  const lebarPlot = LEBAR - TEPI.kiri - TEPI.kanan;
  const tinggiPlot = TINGGI - TEPI.atas - TEPI.bawah;
  const x = (i: number) => TEPI.kiri + (data.length > 1 ? (lebarPlot * i) / (data.length - 1) : lebarPlot / 2);
  const y = (skor: number) => TEPI.atas + tinggiPlot * (1 - skor / 100);
  const ada = data.map((d, i) => ({ ...d, i })).filter((d): d is { waktu: string; skor: number; i: number } => d.skor !== null);
  if (ada.length === 0) return null;

  const terakhir = ada[ada.length - 1]!;
  const terbaik = ada.reduce((a, b) => (b.skor > a.skor ? b : a));
  // Garis putus di latihan tanpa nilai: setiap potongan berurutan digambar sendiri.
  const potongan: (typeof ada)[] = [];
  data.forEach((d, i) => {
    if (d.skor === null) return;
    const akhir = potongan[potongan.length - 1];
    if (akhir && akhir[akhir.length - 1]!.i === i - 1) akhir.push({ ...d, skor: d.skor, i });
    else potongan.push([{ ...d, skor: d.skor, i }]);
  });
  const ringkasan = `${judul}: ${ada.length} latihan bernilai, terbaik ${terbaik.skor}, terakhir ${terakhir.skor}.`;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${LEBAR} ${TINGGI}`} className="h-auto w-full" role="img" aria-label={ringkasan}>
        {/* Garis bantu batas "Luar biasa", resesif */}
        <line x1={TEPI.kiri} x2={LEBAR - TEPI.kanan} y1={y(BATAS_PREDIKAT.luarBiasa)} y2={y(BATAS_PREDIKAT.luarBiasa)} stroke="#d6d3d1" strokeWidth={1} strokeDasharray="3 3" />
        <text x={LEBAR - 2} y={y(BATAS_PREDIKAT.luarBiasa) + 3} fontSize={9} fill="#78716c" textAnchor="end">
          {BATAS_PREDIKAT.luarBiasa}
        </text>
        {potongan.map((p) =>
          p.length > 1 ? (
            <polyline
              key={p[0]!.i}
              points={p.map((d) => `${x(d.i)},${y(d.skor)}`).join(" ")}
              fill="none"
              stroke={WARNA_GARIS}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {/* Titik terbaik (cincin) dan terakhir (bulat), dengan cincin permukaan 2 px */}
        <circle cx={x(terbaik.i)} cy={y(terbaik.skor)} r={5} fill={WARNA_SURFACE} stroke={WARNA_GARIS} strokeWidth={2} />
        <circle cx={x(terakhir.i)} cy={y(terakhir.skor)} r={5} fill={WARNA_GARIS} stroke={WARNA_SURFACE} strokeWidth={2} />
        {/* Lapisan sorot: target lebih besar dari tandanya */}
        {ada.map((d) => (
          <circle key={d.i} cx={x(d.i)} cy={y(d.skor)} r={10} fill="transparent" className="cursor-default">
            <title>{`Latihan ke-${d.i + 1} · ${waktuSingkat(d.waktu)} · nilai ${d.skor}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-hutan" aria-hidden="true" /> Terakhir <strong className="text-tinta">{terakhir.skor}</strong>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-hutan bg-white" aria-hidden="true" /> Terbaik <strong className="text-tinta">{terbaik.skor}</strong>
        </span>
        <span>{data.length} latihan</span>
      </figcaption>
    </figure>
  );
}
