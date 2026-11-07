import { useRef, useState } from "react";
import { Link } from "react-router";
import IlustrasiPose from "./IlustrasiPose";
import { formatDurasi, KATEGORI, namaKategori, type KelasTari } from "./katalog";

/** Detik video yang dipakai sebagai gambar sampul dan awal pratinjau. */
const DETIK_SAMPUL = 30;

const alamat = (jalur: string) => `${import.meta.env.BASE_URL}${jalur}`;

/** Sampul: cuplikan video asli bila kelas punya video (pratinjau tanpa suara saat disorot), selain itu ilustrasi pose. */
function Sampul({ kelas }: { kelas: KelasTari }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoGagal, setVideoGagal] = useState(false);
  const pakaiVideo = kelas.materi !== null && !videoGagal;

  const putar = () => {
    const v = videoRef.current;
    if (v) void v.play().catch(() => {});
  };
  const henti = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = DETIK_SAMPUL;
  };

  return (
    <div className="absolute inset-0" onMouseEnter={pakaiVideo ? putar : undefined} onMouseLeave={pakaiVideo ? henti : undefined}>
      <div className="kubah" />
      {pakaiVideo ? (
        <video
          ref={videoRef}
          src={`${alamat(kelas.materi!.video)}#t=${DETIK_SAMPUL}`}
          muted
          playsInline
          loop
          preload="metadata"
          onError={() => setVideoGagal(true)}
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
      ) : (
        <IlustrasiPose pose={kelas.pose} kamen={kelas.kamen} className="absolute inset-x-0 bottom-1 mx-auto h-[86%] transition duration-300 group-hover:scale-105" />
      )}
    </div>
  );
}

const LABEL_UNSUR = { agem: "Agem", tandang: "Tandang", tangkis: "Tangkis", tangkep: "Tangkep" } as const;

export default function KartuKelas({ kelas }: { kelas: KelasTari }) {
  const latar = KATEGORI.find((k) => k.id === kelas.kategori)?.latar ?? "bg-kat-dasar";
  const ke = `/latihan/${kelas.id}`;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:ring-stone-300">
      <Link to={ke} className={`relative block aspect-[4/3] overflow-hidden ${latar}`} aria-label={`Latih ${kelas.nama}`}>
        <Sampul kelas={kelas} />
        <span
          className={`absolute left-0 top-0 rounded-br-xl px-2.5 py-1 text-[11px] font-bold ${kelas.materi ? "bg-prada text-tinta" : "bg-white/90 text-stone-700"}`}
        >
          {kelas.materi ? "Video guru" : "Video contoh"}
        </span>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {kelas.materi ? formatDurasi(kelas.materi.durasiDetik) : "Segera"}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-emas">{namaKategori(kelas.kategori)}</p>
        <h3 className="mt-0.5 font-bold leading-snug">
          <Link to={ke} className="hover:text-merah-tua">
            {kelas.nama}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-stone-600">{kelas.ringkas}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          {kelas.unsur.slice(0, 3).map((u) => (
            <span key={u} className="rounded-full bg-pasir px-2 py-0.5 text-[10px] font-semibold text-stone-700">
              {LABEL_UNSUR[u]}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-stone-600">
            {kelas.tingkat} · {kelas.penari}
          </span>
          <Link
            to={ke}
            className="rounded-full bg-hutan px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-hutan-muda focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hutan"
          >
            Latih
          </Link>
        </div>
      </div>
    </article>
  );
}
