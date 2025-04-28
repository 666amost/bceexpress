"use client" // Penting: Ini adalah Client Component di Next.js App Router

import { useState } from "react"
// Import useRouter dari next/navigation untuk App Router (Next.js 13+)
// Gunakan 'next/router' jika Anda menggunakan Pages Router (di dalam folder 'pages')
import { useRouter } from "next/navigation"

// Import komponen UI yang sudah ada
import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero" // Asumsikan komponen ini ada dan berisi form input AWB
import { Footer } from "@/components/footer"
import { QRScannerQuagga } from "@/components/qr-scanner-quagga"

// Import ikon dari lucide-react
import { QrCode } from "lucide-react" // Menggunakan ikon QrCode

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
    console.log("Scan Success, AWB:", scannedAWB)
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
      console.warn("Scanned QR code is empty.")
      // setScanError("Failed to read QR code data."); // Jika Anda ingin menampilkan error di sini
    }
  }

  // Fungsi ini dipanggil oleh komponen QRScanner saat tombol close diklik
  const handleCloseScanner = () => {
    console.log("Closing scanner")
    // Sembunyikan tampilan scanner
    setShowScanner(false)
    // Jika ada state error yang dihandle di sini, reset saat ditutup
    // setScanError(null);
  }

  // Lifecycle useEffect untuk menginisialisasi/membersihkan scanner tidak diperlukan di sini
  // karena logika tersebut sepenuhnya di dalam komponen QRScanner Anda.
  // useEffect(() => { /* ... */ return () => { /* ... */ }; }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar /> {/* Komponen Navbar */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl mx-auto">
          {!showScanner ? (
            <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10">
              <Hero />
              <div className="mt-8 text-center">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white dark:bg-zinc-900 px-4 text-sm text-muted-foreground">or</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  className="mt-6 w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200 space-x-2"
                >
                  <QrCode className="h-5 w-5" />
                  <span>Scan QR Code Instead</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6">
              <QRScannerQuagga onScan={handleScanSuccess} onClose={handleCloseScanner} />
            </div>
          )}
        </div>
      </main>
      <Footer /> {/* Komponen Footer */}
    </div>
  )
}
