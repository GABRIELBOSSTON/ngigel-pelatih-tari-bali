import { useMemo, useState } from "react";
import { Link } from "react-router";
import { formatDurasi } from "../katalog/katalog";
import CincinSkor from "../latihan/CincinSkor";
import GarisKemajuan from "../latihan/GarisKemajuan";
import { bacaRiwayat, hapusRiwayat, kemajuanPerKelas, MAKS_SESI } from "../latihan/riwayat";
import { predikat } from "../latihan/sesi";

// Riwayat latihan di peramban ini (docs/05 bagian 2). Bisa dihapus kapan saja oleh pengguna.
export default function Riwayat() {
  const [riwayat, setRiwayat] = useState(bacaRiwayat);
  const kemajuan = useMemo(() => kemajuanPerKelas(riwayat), [riwayat]);

  const hapus = () => {
    if (!window.confirm("Hapus semua riwayat latihan di peramban ini? Tindakan ini tidak bisa dibatalkan.")) return;
    hapusRiwayat();
    setRiwayat([]);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emas">Tersimpan di peramban ini saja</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Riwayat latihan</h1>
          <p className="mt-1 text-sm text-stone-600">
            Yang disimpan hanya nilai dan koreksi, tanpa video atau gambar. Maksimal {MAKS_SESI} latihan terakhir.
          </p>
        </div>
        {riwayat.length > 0 && (
          <button type="button" onClick={hapus} className="rounded-xl px-4 py-2 text-sm font-bold text-merah-bata ring-1 ring-merah-bata/40 hover:bg-merah-bata/5">
            Hapus semua riwayat
          </button>
        )}
      </header>

      {riwayat.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="font-bold">Belum ada latihan.</p>
          <p className="mt-1 text-sm text-stone-600">Pilih kelas di etalase, menari bersama guru, dan nilainya akan muncul di sini.</p>
          <Link to="/" className="mt-5 inline-block rounded-xl bg-kunyit px-5 py-2.5 text-sm font-bold text-white hover:bg-kunyit-gelap">
            Ke etalase
          </Link>
        </div>
      ) : (
        <>
        {kemajuan.length > 0 && (
          <section aria-labelledby="judul-kemajuan" className="mt-6">
            <h2 id="judul-kemajuan" className="text-lg font-extrabold">
              Kemajuan per kelas
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kemajuan.map((k) => (
                <li key={k.kelasId} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <p className="truncate font-extrabold">{k.namaKelas}</p>
                    <Link to={`/latihan/${k.kelasId}`} className="shrink-0 text-xs font-bold text-kunyit hover:underline">
                      Latih lagi
                    </Link>
                  </div>
                  <GarisKemajuan data={k.data} judul={k.namaKelas} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <h2 className="mt-8 text-lg font-extrabold">Semua latihan</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {riwayat.map((s) => (
            <li key={s.id}>
              <Link to={`/hasil/${s.id}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200 transition hover:shadow-md hover:ring-stone-300">
                <CincinSkor skor={s.skorTotal} ukuran={64} tebal={6} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-extrabold">{s.namaKelas}</p>
                  <p className="text-xs text-stone-600">
                    {new Date(s.dibuat).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} · {formatDurasi(s.mulai)}–{formatDurasi(s.akhir)}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-stone-700">
                    {predikat(s.skorTotal)}
                    {s.penyimpangan[0] ? ` · ${s.penyimpangan[0].bagian} ${s.penyimpangan[0].jenis}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
