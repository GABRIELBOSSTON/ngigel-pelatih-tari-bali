// Gambar sampul kelas: penari bergaya stickman (cara AI Ngigel "melihat" tubuh), digambar sendiri
// dengan SVG supaya tidak memakai foto orang tanpa izin. Koordinat dalam kotak 120 × 140;
// sisi "a" = kiri layar, "b" = kanan layar.
import type { IdPose } from "./katalog";

type Xy = readonly [number, number];

type Sosok = {
  kepala: Xy;
  leher: Xy;
  bahuA: Xy;
  bahuB: Xy;
  sikuA: Xy;
  sikuB: Xy;
  tanganA: Xy;
  tanganB: Xy;
  pinggulA: Xy;
  pinggulB: Xy;
  lututA: Xy;
  lututB: Xy;
  kakiA: Xy;
  kakiB: Xy;
  mahkota?: "gelungan" | "udeng";
};

/** Sikap berdiri mendak (lutut ditekuk), dasar sebagian besar pose. */
const DASAR: Sosok = {
  kepala: [60, 24],
  leher: [60, 34],
  bahuA: [49, 39],
  bahuB: [71, 39],
  sikuA: [38, 52],
  sikuB: [82, 52],
  tanganA: [44, 64],
  tanganB: [76, 64],
  pinggulA: [53, 70],
  pinggulB: [67, 70],
  lututA: [46, 95],
  lututB: [74, 95],
  kakiA: [50, 121],
  kakiB: [70, 121],
  mahkota: "gelungan",
};

const pose = (ubah: Partial<Sosok>): Sosok => ({ ...DASAR, ...ubah });

type Hiasan = "bokor" | "kipas" | "nada" | "mata" | "laju" | "naikTurun" | "sayap" | "bunga" | "cakar";

const POSE: Record<IdPose, { sosok: Sosok[]; hiasan?: Hiasan[] }> = {
  agem: { sosok: [pose({ kepala: [58, 24], leher: [59, 34], sikuA: [33, 45], tanganA: [36, 29], sikuB: [86, 48], tanganB: [75, 56], lututA: [45, 94], lututB: [75, 93], kakiA: [49, 121], kakiB: [71, 121] })] },
  miles: { sosok: [pose({ sikuA: [34, 40], tanganA: [22, 33], sikuB: [86, 40], tanganB: [98, 33] })] },
  ngumbang: {
    sosok: [pose({ kepala: [62, 24], leher: [61, 34], sikuA: [38, 51], tanganA: [30, 61], sikuB: [84, 45], tanganB: [95, 38], lututA: [49, 96], kakiA: [42, 121], lututB: [72, 92], kakiB: [82, 117] })],
    hiasan: ["laju"],
  },
  nyeregseg: {
    sosok: [pose({ kepala: [64, 24], leher: [63, 34], bahuA: [52, 39], bahuB: [74, 39], sikuA: [37, 40], tanganA: [23, 45], sikuB: [84, 48], tanganB: [72, 55], lututA: [54, 96], kakiA: [52, 120], lututB: [68, 96], kakiB: [67, 120] })],
    hiasan: ["laju"],
  },
  seledet: { sosok: [pose({ kepala: [61, 24], sikuA: [34, 47], tanganA: [40, 33], sikuB: [84, 50], tanganB: [72, 57] })], hiasan: ["mata"] },
  nerudut: {
    sosok: [pose({ leher: [60, 37], kepala: [60, 27], bahuA: [49, 42], bahuB: [71, 42], sikuA: [39, 58], tanganA: [33, 71], sikuB: [81, 58], tanganB: [87, 71], pinggulA: [53, 74], pinggulB: [67, 74], lututA: [43, 99], lututB: [77, 99] })],
    hiasan: ["naikTurun"],
  },
  bokor: { sosok: [pose({ sikuA: [41, 57], tanganA: [53, 51], sikuB: [86, 40], tanganB: [93, 26] })], hiasan: ["bokor", "bunga"] },
  anjali: { sosok: [pose({ sikuA: [45, 56], tanganA: [58, 47], sikuB: [75, 56], tanganB: [62, 47] })], hiasan: ["bunga"] },
  kipas: { sosok: [pose({ sikuA: [34, 38], tanganA: [31, 23], sikuB: [85, 52], tanganB: [74, 60] })], hiasan: ["kipas"] },
  goyang: {
    sosok: [pose({ kepala: [65, 24], leher: [63, 34], bahuA: [52, 39], bahuB: [74, 40], sikuA: [38, 45], tanganA: [30, 33], sikuB: [86, 49], tanganB: [96, 59], pinggulA: [50, 70], pinggulB: [64, 71], lututA: [43, 95], lututB: [71, 96] })],
    hiasan: ["kipas"],
  },
  prajurit: {
    sosok: [pose({ bahuA: [46, 39], bahuB: [74, 39], sikuA: [30, 36], tanganA: [29, 20], sikuB: [90, 37], tanganB: [97, 49], pinggulA: [52, 70], pinggulB: [68, 70], lututA: [39, 92], kakiA: [35, 121], lututB: [81, 92], kakiB: [85, 121], mahkota: "udeng" })],
  },
  duduk: {
    sosok: [pose({ kepala: [60, 50], leher: [60, 60], bahuA: [49, 65], bahuB: [71, 65], sikuA: [35, 64], tanganA: [26, 52], sikuB: [85, 70], tanganB: [97, 64], pinggulA: [53, 96], pinggulB: [67, 96], lututA: [38, 106], lututB: [82, 106], kakiA: [50, 121], kakiB: [70, 121], mahkota: "udeng" })],
    hiasan: ["kipas"],
  },
  gagah: {
    sosok: [pose({ kepala: [57, 27], leher: [58, 37], bahuA: [46, 42], bahuB: [70, 41], sikuA: [33, 50], tanganA: [24, 63], sikuB: [84, 39], tanganB: [95, 29], pinggulA: [51, 74], pinggulB: [67, 74], lututA: [38, 97], lututB: [80, 96], kakiA: [42, 121], kakiB: [78, 121] })],
    hiasan: ["cakar"],
  },
  sayap: { sosok: [pose({ sikuA: [32, 40], tanganA: [16, 34], sikuB: [88, 40], tanganB: [104, 34] })], hiasan: ["sayap"] },
  janger: { sosok: [pose({ sikuA: [40, 47], tanganA: [50, 34], sikuB: [82, 47], tanganB: [72, 34] })], hiasan: ["nada"] },
  berpasangan: {
    sosok: [
      geser(pose({ kepala: [63, 24], leher: [62, 34], sikuA: [36, 44], tanganA: [30, 30], sikuB: [84, 50], tanganB: [92, 58] }), -24, 0.78),
      geser(pose({ kepala: [57, 24], leher: [58, 34], sikuA: [36, 50], tanganA: [28, 58], sikuB: [84, 44], tanganB: [90, 30], mahkota: "udeng" }), 24, 0.78),
    ],
    hiasan: ["bunga"],
  },
};

/** Memindah dan mengecilkan sosok (untuk pose berpasangan), berpusat di dasar kaki. */
function geser(s: Sosok, dx: number, skala: number): Sosok {
  const ubah = ([x, y]: Xy): Xy => [60 + (x - 60) * skala + dx, 128 - (128 - y) * skala];
  const hasil = { ...s };
  for (const k of Object.keys(s) as (keyof Sosok)[]) {
    const v = s[k];
    if (Array.isArray(v)) (hasil as Record<string, unknown>)[k] = ubah(v as Xy);
  }
  return hasil;
}

const titik = (p: Xy) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

/** Tiga jari terbuka khas tari Bali, searah lengan bawah. */
function jari(siku: Xy, tangan: Xy, panjang: number): string {
  const sudut = Math.atan2(tangan[1] - siku[1], tangan[0] - siku[0]);
  return [-0.55, 0, 0.55]
    .map((d) => {
      const ujung: Xy = [tangan[0] + Math.cos(sudut + d) * panjang, tangan[1] + Math.sin(sudut + d) * panjang];
      return `M${titik(tangan)} L${titik(ujung)}`;
    })
    .join(" ");
}

export type WarnaSosok = Partial<Record<"lenganA" | "lenganB" | "tungkaiA" | "tungkaiB" | "badan", string>>;

function SosokSvg({ s, warna, warnaBagian = {}, kamen, tebal, sendi }: { s: Sosok; warna: string; warnaBagian?: WarnaSosok; kamen: boolean; tebal: number; sendi: boolean }) {
  const tengahPinggul: Xy = [(s.pinggulA[0] + s.pinggulB[0]) / 2, (s.pinggulA[1] + s.pinggulB[1]) / 2];
  const garis = (titikTitik: Xy[]) => `M${titikTitik.map(titik).join(" L")}`;
  const skala = Math.hypot(s.leher[0] - tengahPinggul[0], s.leher[1] - tengahPinggul[1]) / 36;
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      {kamen && (
        <path
          d={`M${titik([s.pinggulA[0] - 3, s.pinggulA[1] - 2])} L${titik([s.pinggulB[0] + 3, s.pinggulB[1] - 2])} L${titik([s.lututB[0] + 5, s.lututB[1] + 9])} L${titik([s.lututA[0] - 5, s.lututA[1] + 9])} Z`}
          fill={warna}
          opacity={0.22}
          stroke="none"
        />
      )}
      <path d={garis([s.leher, tengahPinggul])} stroke={warnaBagian.badan ?? warna} strokeWidth={tebal} />
      <path d={garis([s.bahuA, s.bahuB])} stroke={warnaBagian.badan ?? warna} strokeWidth={tebal} />
      <path d={garis([s.pinggulA, s.pinggulB])} stroke={warnaBagian.badan ?? warna} strokeWidth={tebal} />
      <path d={garis([s.bahuA, s.sikuA, s.tanganA])} stroke={warnaBagian.lenganA ?? warna} strokeWidth={tebal} />
      <path d={garis([s.bahuB, s.sikuB, s.tanganB])} stroke={warnaBagian.lenganB ?? warna} strokeWidth={tebal} />
      <path d={jari(s.sikuA, s.tanganA, 5.5 * skala)} stroke={warnaBagian.lenganA ?? warna} strokeWidth={tebal * 0.45} />
      <path d={jari(s.sikuB, s.tanganB, 5.5 * skala)} stroke={warnaBagian.lenganB ?? warna} strokeWidth={tebal * 0.45} />
      <path d={garis([s.pinggulA, s.lututA, s.kakiA])} stroke={warnaBagian.tungkaiA ?? warna} strokeWidth={tebal} />
      <path d={garis([s.pinggulB, s.lututB, s.kakiB])} stroke={warnaBagian.tungkaiB ?? warna} strokeWidth={tebal} />
      <path d={`M${titik([s.kakiA[0] - 5 * skala, s.kakiA[1]])} L${titik([s.kakiA[0] + 2 * skala, s.kakiA[1]])}`} stroke={warnaBagian.tungkaiA ?? warna} strokeWidth={tebal * 0.8} />
      <path d={`M${titik([s.kakiB[0] - 2 * skala, s.kakiB[1]])} L${titik([s.kakiB[0] + 5 * skala, s.kakiB[1]])}`} stroke={warnaBagian.tungkaiB ?? warna} strokeWidth={tebal * 0.8} />
      <circle cx={s.kepala[0]} cy={s.kepala[1]} r={7.5 * skala} fill={warna} stroke="none" />
      {s.mahkota === "gelungan" && (
        <path
          d={`M${titik([s.kepala[0] - 9 * skala, s.kepala[1] - 4 * skala])} L${titik([s.kepala[0] - 5 * skala, s.kepala[1] - 15 * skala])} L${titik([s.kepala[0] - 1.5 * skala, s.kepala[1] - 8 * skala])} L${titik([s.kepala[0], s.kepala[1] - 18 * skala])} L${titik([s.kepala[0] + 1.5 * skala, s.kepala[1] - 8 * skala])} L${titik([s.kepala[0] + 5 * skala, s.kepala[1] - 15 * skala])} L${titik([s.kepala[0] + 9 * skala, s.kepala[1] - 4 * skala])} Z`}
          fill={warna}
          stroke="none"
        />
      )}
      {s.mahkota === "udeng" && (
        <path
          d={`M${titik([s.kepala[0] - 8 * skala, s.kepala[1] - 3 * skala])} Q${titik([s.kepala[0], s.kepala[1] - 14 * skala])} ${titik([s.kepala[0] + 8 * skala, s.kepala[1] - 3 * skala])} L${titik([s.kepala[0] + 3 * skala, s.kepala[1] - 18 * skala])} Z`}
          fill={warna}
          stroke="none"
        />
      )}
      {sendi &&
        [s.bahuA, s.bahuB, s.sikuA, s.sikuB, s.tanganA, s.tanganB, s.pinggulA, s.pinggulB, s.lututA, s.lututB, s.kakiA, s.kakiB].map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={tebal * 0.42} fill="#ffffff" stroke="none" />
        ))}
    </g>
  );
}

function GambarHiasan({ jenis, s, warna }: { jenis: Hiasan; s: Sosok; warna: string }) {
  switch (jenis) {
    case "bokor":
      return (
        <g>
          <path d={`M${s.tanganA[0] - 2},${s.tanganA[1] - 4} q9,12 18,0 z`} fill={warna} />
          {[0, 5, 10, 15].map((dx) => (
            <circle key={dx} cx={s.tanganA[0] + dx} cy={s.tanganA[1] - 6} r={2.2} fill="#ffffff" opacity={0.9} />
          ))}
        </g>
      );
    case "bunga":
      return (
        <g fill="#ffffff" opacity={0.85}>
          {[
            [100, 18],
            [108, 34],
            [94, 46],
            [18, 22],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx={0} cy={-2.6} rx={1.5} ry={2.6} transform={`rotate(${a})`} />
              ))}
            </g>
          ))}
        </g>
      );
    case "kipas": {
      const [x, y] = s.tanganA;
      return <path d={`M${x},${y} l-14,-10 a17,17 0 0 1 20,-9 z`} fill={warna} opacity={0.9} />;
    }
    case "nada":
      return (
        <g fill={warna} stroke={warna} strokeWidth={1.6}>
          <circle cx={92} cy={30} r={3} />
          <path d="M95,30 V16 l6,2" fill="none" />
          <circle cx={100} cy={46} r={2.4} />
          <path d="M102.4,46 V35" fill="none" />
        </g>
      );
    case "mata":
      return (
        <g stroke={warna} strokeWidth={2} fill="none" strokeLinecap="round">
          <path d={`M${s.kepala[0] + 12},${s.kepala[1] - 2} q8,-6 16,0 q-8,6 -16,0`} />
          <circle cx={s.kepala[0] + 24} cy={s.kepala[1] - 2} r={2} fill={warna} />
          <path d={`M${s.kepala[0] + 31},${s.kepala[1] - 7} l5,-3 M${s.kepala[0] + 32},${s.kepala[1] - 1} l6,0`} />
        </g>
      );
    case "laju":
      return (
        <g stroke={warna} strokeWidth={2} strokeLinecap="round" opacity={0.7}>
          <path d="M14,104 h14 M10,112 h20 M16,120 h12" />
        </g>
      );
    case "naikTurun":
      return (
        <g stroke={warna} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8}>
          <path d="M104,62 v20 m-4,-16 l4,-4 l4,4 m-8,12 l4,4 l4,-4" />
        </g>
      );
    case "sayap":
      return (
        <g fill={warna} opacity={0.25}>
          <path d={`M${s.tanganA[0]},${s.tanganA[1]} Q${s.tanganA[0] + 6},${s.tanganA[1] + 34} ${s.pinggulA[0]},${s.pinggulA[1]} L${s.bahuA[0]},${s.bahuA[1]} Z`} />
          <path d={`M${s.tanganB[0]},${s.tanganB[1]} Q${s.tanganB[0] - 6},${s.tanganB[1] + 34} ${s.pinggulB[0]},${s.pinggulB[1]} L${s.bahuB[0]},${s.bahuB[1]} Z`} />
        </g>
      );
    case "cakar":
      return (
        <g stroke={warna} strokeWidth={1.8} strokeLinecap="round" opacity={0.8}>
          <path d={`M${s.tanganA[0] - 4},${s.tanganA[1] + 6} l-4,5 M${s.tanganA[0]},${s.tanganA[1] + 7} l-2,6 M${s.tanganA[0] + 4},${s.tanganA[1] + 6} l0,6`} />
        </g>
      );
  }
}

type Props = {
  pose: IdPose;
  kamen?: boolean;
  warna?: string;
  /** Warna per bagian (dipakai hero untuk meniru umpan balik hijau/kuning/merah). */
  warnaBagian?: WarnaSosok;
  /** Titik sendi putih seperti hasil deteksi AI. */
  sendi?: boolean;
  tebal?: number;
  className?: string;
};

export default function IlustrasiPose({ pose: id, kamen = true, warna = "#f6c453", warnaBagian, sendi = true, tebal = 4.2, className }: Props) {
  const p = POSE[id];
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden="true" focusable="false">
      {p.sosok.map((s, i) => (
        <SosokSvg key={i} s={s} warna={warna} warnaBagian={warnaBagian} kamen={kamen} tebal={tebal} sendi={sendi} />
      ))}
      {p.hiasan?.map((h) => <GambarHiasan key={h} jenis={h} s={p.sosok[0]!} warna={warna} />)}
    </svg>
  );
}
