"use client" // Penting: Ini adalah Client Component di Next.js App Router

import { useState, useEffect } from "react"
// Import useRouter dari next/navigation untuk App Router (Next.js 13+)
// Gunakan 'next/router' jika Anda menggunakan Pages Router (di dalam folder 'pages')
import { useRouter } from "next/navigation"
import Link from "next/link"

// Import komponen UI yang sudah ada
import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero" // Asumsikan komponen ini ada dan berisi form input AWB
import CekOngkir from '@/components/cek-ongkir'
import { Footer } from "@/components/footer"
import { QRScanner } from "@/components/qr-scanner"
import gsap from "gsap"

// ID untuk elemen div tempat scanner akan dirender di dalam QRScanner.tsx
// Pastikan ID ini sama dengan yang digunakan di komponen QRScanner Anda
// const QR_SCANNER_ELEMENT_ID = "qr-reader"; // Biasanya didefinisikan di dalam QRScanner.tsx

export default function Home() {
  const router = useRouter()
  // State untuk mengontrol apakah komponen QRScanner ditampilkan
  const [showScanner, setShowScanner] = useState(false)
  // State opsional untuk menampilkan error scan di level halaman jika perlu
  // const [scanError, setScanError] = useState<string | null>(null);

  // Fungsi ini dipanggil oleh komponen QRScanner saat berhasil memindai QR code
  const handleScanSuccess = (scannedAWB: string) => {
    // Sembunyikan tampilan scanner setelah berhasil scan
    setShowScanner(false) // Ini akan memicu cleanup di komponen QRScanner

    // Arahkan pengguna ke halaman tracking untuk AWB yang dipindai
    if (scannedAWB) {
      // Opsional: Tambahkan validasi dasar untuk memastikan hasil scan terlihat seperti AWB
      // if (/^[A-Z0-9]+$/.test(scannedAWB)) { // Contoh validasi AWB alphanumeric
      router.push(`/track/${scannedAWB}`)
      // } else {
      //    console.warn("Scanned data does not look like an AWB:", scannedAWB);
      //    // Opsional: Tampilkan pesan ke user bahwa data tidak valid
      //    // setScanError("Scanned data is not a valid AWB format.");
      //    // Atau tampilkan kembali form input manual
      //    // setShowScanner(false);
      // }
    } else {
      // Opsional: Tampilkan pesan jika data scan kosong
      // Removed console statement from line 45
    }
  }

  // Fungsi ini dipanggil oleh komponen QRScanner saat tombol close diklik
  const handleCloseScanner = () => {
    // Sembunyikan tampilan scanner
    setShowScanner(false)
    // Jika ada state error yang dihandle di sini, reset saat ditutup
    // setScanError(null);
  }

  // Lifecycle useEffect untuk menginisialisasi/membersihkan scanner tidak diperlukan di sini
  // karena logika tersebut sepenuhnya di dalam komponen QRScanner Anda.
  // useEffect(() => { /* ... */ return () => { /* ... */ }; }, []);

  useEffect(() => {
    if (showScanner) {
      gsap.fromTo(
        ".qr-scanner-container",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
      )
    } else {
      gsap.to(
        ".qr-scanner-container",
        { opacity: 0, y: 20, duration: 0.4, ease: "power3.in", onComplete: () => { /* Optional: remove element from DOM */ } }
      )
    }
  }, [showScanner]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar /> {/* Komponen Navbar */}
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        {/* Hero Section in a large card */}
        {!showScanner && (
          <div className="w-full mx-auto bg-card rounded-2xl shadow-xl p-10 flex flex-col items-center gap-6">
            <Hero onScanClickAction={() => setShowScanner(true)} />
          </div>
        )}
        {/* Scanner Section in a separate card */}
        {showScanner && (
          <div className="qr-scanner-container w-full mx-auto bg-card p-8 rounded-2xl shadow-2xl mt-8">
            <QRScanner onScan={handleScanSuccess} onClose={handleCloseScanner} />
          </div>
        )}
      </main>

      {/* Cek Ongkir Section - standalone card under Track */}
      <section className="py-6">
        <div className="container mx-auto px-4">
          <div className="w-full max-w-xl mx-auto">
            <CekOngkir />
          </div>
        </div>
      </section>


      {/* Kombinasi Bagian Konten Tambahan (Total Pengiriman, Pickup, Siap Kirim) */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          {/* Wrap grid in a card-like container */}
          <div className="w-full mx-auto bg-card rounded-2xl shadow-xl p-8 mt-0">
            {/* Gunakan Grid untuk tata letak 3 kolom di desktop, tumpuk di mobile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">

              {/* Konten Total Pengiriman Sukses */}
              <div className="text-center py-0">
                <h2 className="text-2xl font-bold text-foreground mb-2">Total Pengiriman Sukses</h2>
                <p className="text-4xl font-extrabold text-primary">+1.000.000</p> {/* Angka placeholder */}
                <p className="text-sm text-muted-foreground mt-1">Paket telah kami antarkan dengan aman.</p>
              </div>

              {/* Konten Request Pickup */}
              <div className="text-center py-0">
                <h2 className="text-2xl font-bold text-foreground mb-4">Butuh Pickup Paket?</h2>
                <p className="text-base text-muted-foreground mb-6">Kami siap menjemput paket Anda. Hubungi kami sekarang melalui WhatsApp.</p>
                <a
                  href="https://wa.me/6282114097704?text=Halo%2C%20saya%20ingin%20request%20pickup%20paket."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-green-500 text-white font-bold py-2 px-6 rounded-lg text-md shadow hover:bg-green-600 transition-colors"
                >
                  Hubungi via WhatsApp
                </a>
              </div>

              {/* Konten Siap Kirim? */}
              <div className="text-center py-0">
                <h2 className="text-2xl font-bold text-foreground mb-4">Siap Kirim Barang Anda?</h2>
                <p className="text-base text-muted-foreground mb-6">Jelajahi berbagai layanan pengiriman kami yang sesuai dengan kebutuhan bisnis atau pribadi Anda.</p>
                <Link href="/services" className="inline-block bg-secondary text-secondary-foreground font-bold py-2 px-6 rounded-lg text-md shadow hover:bg-secondary/80 transition-colors">
                  Lihat Layanan Kami
                </Link>
              </div>

            </div>
          </div>
        </div>
      </section>

      <Footer /> {/* Komponen Footer */}
    </div>
  )
}
