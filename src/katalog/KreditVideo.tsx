// Kredit dan keterangan hak cipta tepat di bawah video guru. Huruf 14 px dan kontras tinggi, supaya
// terbaca di HP maupun laptop (keputusan ketua 7 Nov: pemilik video harus jelas terlihat).
import { keteranganHakCipta, type MateriKelas } from "./katalog";

export default function KreditVideo({ materi, gelap = false }: { materi: MateriKelas; gelap?: boolean }) {
  return (
    <div
      className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-sm leading-snug ${
        gelap ? "bg-white/10 text-white/90" : "bg-white text-stone-700 ring-1 ring-stone-200"
      }`}
    >
      <span aria-hidden="true" className="mt-0.5 flex h-5 w-7 shrink-0 items-center justify-center rounded-md bg-red-600 text-[10px] text-white">
        ▶
      </span>
      <p>
        <strong className={gelap ? "text-white" : "text-tinta"}>
          Video guru: &ldquo;{materi.judulAsli}&rdquo; oleh {materi.kanal} ({materi.platform})
        </strong>
        {materi.tautanAsli && (
          <>
            {" · "}
            <a href={materi.tautanAsli} target="_blank" rel="noreferrer" className={`font-bold underline ${gelap ? "text-prada" : "text-kunyit"}`}>
              lihat video asli
            </a>
          </>
        )}
        <br />
        {keteranganHakCipta(materi)}
      </p>
    </div>
  );
}
