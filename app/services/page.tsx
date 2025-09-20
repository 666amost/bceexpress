"use client"

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
  Plane as PlaneIcon,
  DeliveryParcel as BoatIcon,
  Flash as FlashIcon,
  Time as TimeIcon,
  CheckmarkFilled as ShieldIcon,
  Location as LocationIcon,
  Star as StarIcon,
  Checkmark as CheckmarkIcon,
  Close as CloseIcon,
  Package as PackageIcon,
  Delivery as DeliveryIcon,
  Phone as PhoneIcon,
  Chat as ChatIcon,
} from '@carbon/icons-react'
import Link from "next/link"
import { Oval as LoadingIcon } from 'react-loading-icons'
import Image from "next/image"
import gsap from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'
import { Power3 } from 'gsap'

export default function ServicesPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalContent, setModalContent] = useState<{title: string, pricelist: string} | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)

  const rotatingTexts = useMemo(() => [
    "Layanan Pengiriman Terbaik",
    "Spesialist Pengiriman Makanan",
    "Jaminan 1 hari sampai tujuan"
  ], []);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, []); // Effect runs once on mount for loading simulation

  useEffect(() => {
    if (!isLoading) {
      const headingElement = headingRef.current; // Capture the current ref value
      if (!headingElement) return; // Exit if ref is null

      const texts = rotatingTexts;
      let currentIndex = 0;

      const animateText = () => {
        const currentText = texts[currentIndex];
        gsap.to(headingElement, { // Use the captured element
          duration: 0.5,
          opacity: 0,
          y: -10,
          ease: Power3.easeOut,
          onComplete: () => {
            if (headingElement) { // Use the captured element
              headingElement.textContent = currentText;
              gsap.to(headingElement, {
                duration: 0.5,
                opacity: 1,
                y: 0,
                ease: Power3.easeOut
              });
            }
          }
        });
        currentIndex = (currentIndex + 1) % texts.length;
      };

      // Initial animation
      animateText();

      // Set interval for continuous animation
      const interval = setInterval(animateText, 3000); // Change text every 3 seconds

      // Cleanup GSAP animation on unmount or when dependencies change
      return () => {
        clearInterval(interval);
        if (headingElement) { // Use the captured element
          gsap.killTweensOf(headingElement);
        }
      };
    }
  }, [isLoading, rotatingTexts, headingRef]); // Remove headingRef.current, keep headingRef

  const services = [
    {
      id: "oneday",
      title: "One Day",
      subtitle: "Pengiriman Super Cepat via Udara",
      description: "Layanan pengiriman tercepat kami dengan jaminan sampai dalam 1 hari ke seluruh Indonesia",
      icon: PlaneIcon,
      color: "bg-blue-500",
      borderColor: "border-blue-200 dark:border-blue-700",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      features: [
        "Pengiriman 1 hari ke seluruh Indonesia",
        "Real-time tracking GPS",
        "Asuransi gratis hingga 10 juta",
        "Priority handling & packaging",
        "Customer service 24/7"
      ],
      coverage: "JAKARTA, KALIMANTAN, BANGKA - BELITUNG dan BALI",
      delivery: "1 Hari",
      weight: "Hingga 50kg",
      price: "Mulai dari Rp 25.000",
      pricelist: "Informasi lengkap ongkir One Day tersedia melalui customer service kami. Hubungi untuk mendapatkan penawaran terbaik."
    },
    {
      id: "seacargo",
      title: "Sea Cargo",
      subtitle: "Pengiriman Ekonomis via Laut", 
      description: "Solusi pengiriman hemat untuk barang besar dan cargo dengan keamanan terjamin dan handling profesional",
      icon: BoatIcon,
      color: "bg-teal-500",
      borderColor: "border-teal-200 dark:border-teal-700",
      bgColor: "bg-teal-50 dark:bg-teal-900/20",
      features: [
        "Biaya pengiriman paling ekonomis",
        "Cocok untuk barang besar & berat",
        "Packaging profesional & aman",
        "Door to door service",
        "Asuransi cargo lengkap"
      ],
      coverage: "JAKARTA - BANGKA / sebaliknya",
      delivery: "3-7 Hari", 
      weight: "Tanpa Batas",
      price: "Mulai dari Rp 8.000",
      pricelist: "Tarif Sea Cargo dihitung berdasarkan volume dan berat. Konsultasi gratis untuk mendapatkan harga terbaik."
    },
    {
      id: "sangkilat",
      title: "SANGKILAT",
      subtitle: "Lightning Fast Local Delivery",
      description: "Layanan kilat khusus area Jabodetabek dengan waktu pengiriman super cepat dan tracking real-time",
      icon: "/images/LOGO-SK.png",
      color: "bg-white-500",
      borderColor: "border-white-200 dark:border-white-700",
      bgColor: "bg-white-50 dark:bg-white-900/20",
      features: [
        "Same day delivery guarantee",
        "Real-time GPS tracking",
        "Instant notification update",
        "Multiple pickup points",
        "Express handling priority"
      ],
      coverage: "Jabodetabek (JAKARTA, TANGERANG, DEPOK, BEKASI, BOGOR)",
      delivery: "3-12 Jam",
      weight: "Hingga 25kg",
      price: "Mulai dari Rp 15.000",
      pricelist: "Layanan SANGKILAT khusus Jabodetabek dengan tarif kompetitif. Hubungi untuk informasi detail dan booking."
    }
  ]

  const openModal = (service: typeof services[0]) => {
    setModalContent({ 
      title: `Informasi Ongkir ${service.title}`, 
      pricelist: service.pricelist 
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalContent(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900 flex justify-center items-center">
        <div className="text-center">
          <LoadingIcon className="h-16 w-16 animate-spin mx-auto mb-4" style={{ color: '#4a5568', fontWeight: 'bold' }} />
          <p className="text-gray-600 dark:text-gray-400 font-semibold animate-pulse">Loading Services...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white dark:from-black dark:to-gray-900">
      <Navbar />
      
      {/* Header Section */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 ref={headingRef} className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {isLoading ? rotatingTexts[0] : ''}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Solusi pengiriman terpercaya untuk semua kebutuhan Anda
              </p>
            </div>
            <div className="flex gap-4 items-center">
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <div className="bg-white dark:bg-card rounded-full p-2 sm:p-3">
                <PlaneIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary dark:text-primary-foreground" style={{ fontWeight: 'bold' }} />
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">One Day</span>
            <span className="text-2xl sm:text-4xl font-black text-blue-600 dark:text-blue-400">1</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">hari sampai</span>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-secondary-50 dark:bg-secondary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <div className="bg-white dark:bg-card rounded-full p-2 sm:p-3">
                <BoatIcon className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-foreground dark:text-secondary-foreground" style={{ fontWeight: 'bold' }} />
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Sea Cargo</span>
            <span className="text-2xl sm:text-4xl font-black text-teal-600 dark:text-teal-400">∞</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">berat maksimal</span>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-accent-50 dark:bg-accent-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <div className="bg-white dark:bg-card rounded-full p-2 sm:p-3">
                <FlashIcon className="h-5 w-5 sm:h-6 sm:w-6 text-accent-foreground dark:text-accent-foreground" style={{ fontWeight: 'bold' }} />
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">SANGKILAT</span>
            <span className="text-2xl sm:text-4xl font-black text-yellow-600 dark:text-yellow-400">3</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">jam terkilat</span>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-green-200 dark:border-green-700 p-4 sm:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-destructive-50 dark:bg-destructive-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <div className="bg-white dark:bg-card rounded-full p-2 sm:p-3">
                <ShieldIcon className="h-5 w-5 sm:h-6 sm:w-6 text-destructive dark:text-destructive-foreground" style={{ fontWeight: 'bold' }} />
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Asuransi</span>
            <span className="text-2xl sm:text-4xl font-black text-green-600 dark:text-green-400">100%</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">terjamin</span>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {services.map((service) => {
            const IconComponent = service.icon
            return (
              <div
                key={service.id}
                className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl border-2 ${service.borderColor} p-6 transition-all duration-300 hover:shadow-2xl`}
              >
                {/* Service Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-16 h-16 ${service.bgColor} rounded-2xl flex items-center justify-center`}>
                    {typeof IconComponent === 'string' ? (
                      <Image
                        src={IconComponent}
                        alt={`${service.title} Icon`}
                        width={32}
                        height={32}
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <IconComponent className="h-8 w-8 text-gray-700 dark:text-gray-300" style={{ fontWeight: 'bold' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">{service.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{service.subtitle}</p>
                  </div>
                </div>

                {/* Service Description */}
                <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                  {service.description}
                </p>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                    <TimeIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 mx-auto mb-1" style={{ fontWeight: 'bold' }} />
                    <span className="text-sm font-bold text-gray-900 dark:text-white block">{service.delivery}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Waktu</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                    <PackageIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 mx-auto mb-1" style={{ fontWeight: 'bold' }} />
                    <span className="text-sm font-bold text-gray-900 dark:text-white block">{service.weight}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Berat</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                    <DeliveryIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 mx-auto mb-1" style={{ fontWeight: 'bold' }} />
                    <span className="text-sm font-bold text-gray-900 dark:text-white block">{service.price}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Harga</span>
                  </div>
                </div>

                {/* Coverage Area */}
                <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <LocationIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" style={{ fontWeight: 'bold' }} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Area Layanan:</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{service.coverage}</p>
                </div>

                {/* Features */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">Keunggulan:</h4>
                  <ul className="space-y-2">
                    {service.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2 text-sm">
                        <CheckmarkIcon className="h-4 w-4 text-green-500 flex-shrink-0" style={{ fontWeight: 'bold' }} />
                        <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <Button 
                  onClick={() => openModal(service)}
                  className="w-full bg-gray-700 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold text-white"
                >
                  Informasi Ongkir
                </Button>
              </div>
            )
          })}
        </div>

        {/* Why Choose Us Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Mengapa Memilih BCE Express?
          </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8 text-primary dark:text-primary-foreground" aria-hidden="true" fill="none">
                  <path d="M12 2l6 3v5c0 5-3.8 9.8-6 11-2.2-1.2-6-6-6-11V5l6-3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9.5 12.5l1.75 1.75L15 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Keamanan Terjamin</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Setiap pengiriman diasuransikan dan ditangani dengan standar keamanan tertinggi
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8 text-primary dark:text-primary-foreground" aria-hidden="true" fill="none">
                  <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Selalu Tepat Waktu</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Komitmen kami untuk selalu mengantarkan paket Anda sesuai jadwal yang dijanjikan
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-8 w-8 text-primary dark:text-primary-foreground" aria-hidden="true" fill="currentColor">
                  <path d="M12 17.3l6.18 3.7-1.64-7.03L21 9.24l-7.19-.61L12 2 10.19 8.63 3 9.24l4.46 4.73L5.82 21z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Pelayanan Terbaik</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tim customer service yang responsif dan berpengalaman siap membantu 24/7
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-700 dark:to-gray-600 rounded-2xl shadow-xl p-6 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Siap Mengirim Paket Anda?</h2>
          <p className="text-lg opacity-90 mb-6">
            Pilih layanan yang sesuai dengan kebutuhan Anda dan nikmati pengalaman pengiriman terbaik
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/" 
              className="inline-flex items-center justify-center rounded-lg text-lg px-8 h-12 bg-white text-gray-800 hover:bg-gray-100 transition-colors duration-200 font-bold"
            >
              <PackageIcon className="h-5 w-5 mr-2" style={{ fontWeight: 'bold' }} />
              Lacak Pengiriman
            </Link>
            <Link 
              href="https://wa.me/6282114097704" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg text-lg px-8 h-12 border-2 border-white text-white hover:bg-white hover:text-gray-800 transition-colors duration-200 font-bold"
            >
              <ChatIcon className="h-5 w-5 mr-2" style={{ fontWeight: 'bold' }} />
              Hubungi Kami
            </Link>
          </div>
        </div>
      </div>

      <Footer />

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md sm:max-w-lg dark:bg-gray-800 dark:border-gray-600">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white font-bold flex items-center gap-2">
              <PackageIcon className="h-5 w-5" style={{ fontWeight: 'bold' }} />
              {modalContent?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {modalContent?.pricelist}
            </p>
            <div className="mt-6 flex gap-3">
              <Button 
                onClick={closeModal}
                variant="outline"
                className="flex-1"
              >
                Tutup
              </Button>
              <Link 
                href="https://wa.me/6282114097704" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <PhoneIcon className="h-4 w-4 mr-2" style={{ fontWeight: 'bold' }} />
                  Hubungi CS
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 