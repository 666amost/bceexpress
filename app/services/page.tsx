"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlane, faShip, faBolt, faClock, faShieldAlt, faMapMarkerAlt, faStar, faCheckCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import Link from "next/link"
// Import TextPlugin from GSAP
import { TextPlugin } from 'gsap/TextPlugin';

// Add the imported icons to the FontAwesome library
library.add(faPlane, faShip, faBolt, faClock, faShieldAlt, faMapMarkerAlt, faStar, faCheckCircle, faTimes);

// Register GSAP plugins
gsap.registerPlugin(TextPlugin);

export default function ServicesPage() {
  const services = [
    {
      title: "One Day",
      subtitle: "Pengiriman Super Cepat via Udara",
      description: "Layanan pengiriman tercepat kami dengan jaminan sampai dalam 1 hari",
      icon: faPlane,
      color: "bg-blue-500",
      features: [
        "Pengiriman 1 hari ke seluruh Indonesia",
        "Real-time tracking",
        "Asuransi gratis",
        "Priority handling",
        "Customer service 24/7"
      ],
      coverage: "JAKARTA, KALIMANTAN, BANGKA - BELITUNG dan BALI",
      delivery: "1 Hari",
      weight: "Hingga 50kg",
      pricelist: "Pricelist untuk OneDay BCE EXPRESS"
    },
    {
      title: "Sea Cargo",
      subtitle: "Pengiriman Ekonomis via Laut", 
      description: "Solusi pengiriman hemat untuk barang besar dan cargo dengan keamanan terjamin",
      icon: faShip,
      color: "bg-teal-500",
      features: [
        "Biaya pengiriman ekonomis",
        "Cocok untuk barang besar & berat",
        "Packaging profesional",
        "Door to door service",
        "Asuransi cargo"
      ],
      coverage: "JAKARTA - BANGKA / sebaliknya",
      delivery: "3-7 Hari", 
      weight: "Tanpa Batas",
      pricelist: "Pricelist untuk Sea Cargo..."
    },
    {
      title: "SANGKILAT",
      subtitle: "Lightning Fast Local Delivery",
      description: "Layanan kilat khusus area Jabodetabek dengan waktu pengiriman super cepat dan akurat",
      icon: "/images/LOGO-SK.png",
      color: "bg-yellow-500",
      features: [
        "Same day delivery",
        "Real-time GPS tracking",
        "Instant notification",
        "Multiple pickup points",
        "Express handling"
      ],
      coverage: "Jabodetabek (JAKARTA, TANGERANG, DEPOK, BEKASI, BOGOR)",
      delivery: "3-12 Jam",
      weight: "Hingga 25kg",
      pricelist: "Pricelist untuk SANGKILAT Jabodetabek..."
    }
  ]

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{title: string, pricelist: string} | null>(null);

  const airIconRef = useRef<HTMLDivElement>(null);
  const otherIconsRef = useRef<(HTMLDivElement | null)[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null); // Ref for the main heading

  // Texts for typing animation
  const rotatingTexts = [
    "Layanan Pengiriman Terbaik",
    "Spesialist Pengiriman Makanan",
    "Jaminan 1 hari sampai tujuan"
  ];

  useEffect(() => {
    // Animate Plane icon - fly in from left
    if (airIconRef.current) {
      gsap.from(airIconRef.current, {
        duration: 1.5,
        x: -100,
        opacity: 0,
        ease: "power3.out"
      });
    }

    // Animate other icons (Ship, SANGKILAT) - fade in/up
    otherIconsRef.current.forEach(icon => {
      if(icon) {
        gsap.from(icon, {
          duration: 1,
          opacity: 0,
          y: 20,
          delay: 0.5, // Add a slight delay after plane starts
          ease: "power3.out"
        });
      }
    });

    // Typing animation for heading
    if (headingRef.current) {
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1 });

      rotatingTexts.forEach(text => {
        timeline.to(headingRef.current, { duration: 1, text: "" }); // Clear text
        timeline.to(headingRef.current, { duration: 1.5, text: text, delay: 0.5 }); // Type new text
        timeline.to(headingRef.current, { duration: 1, delay: 2 }); // Pause before next text
      });
    }

  }, []);

  const openModal = (service: typeof services[0]) => {
    setModalContent({ title: `Informasi Ongkir ${service.title}`, pricelist: service.pricelist });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-6xl mx-auto">
            
            <h1 
              ref={headingRef}
              className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent min-h-32 flex items-center justify-center"
            >
              {/* Initial Text */}
              Layanan Pengiriman Terbaik
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Kami menyediakan berbagai solusi pengiriman yang cepat, aman, dan terpercaya 
              untuk memenuhi kebutuhan bisnis dan personal Anda
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faShieldAlt} className="h-5 w-5 text-green-500" />
                <span>100% Aman</span>
              </div>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faClock} className="h-5 w-5 text-blue-500" />
                <span>Tepat Waktu</span>
              </div>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faStar} className="h-5 w-5 text-yellow-500" />
                <span>Rating 4.9/5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const IconComponent = service.icon
              return (
                <Card key={index} className="group hover:shadow-xl transition-all duration-300 hover:scale-105 border-0 shadow-lg overflow-hidden">
                  <div className={`h-2 ${service.color}`}></div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div 
                        ref={service.title === "OneDay BCE EXPRESS" ? airIconRef : (el) => {otherIconsRef.current[index -1] = el;}} 
                        className={`p-3 rounded-full ${service.color} bg-opacity-10 flex items-center justify-center service-icon-wrapper`}
                      >
                        {typeof IconComponent === 'string' ? (
                           <Image
                            src={IconComponent}
                            alt={`${service.title} Icon`}
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain"
                           />
                        ) : (
                          <FontAwesomeIcon icon={IconComponent} className={`h-8 w-8 text-white`} style={{color: service.color.replace('bg-', '').replace('-500', '')}} />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">
                          {service.title}
                        </CardTitle>
                        <CardDescription className="text-sm font-medium text-muted-foreground">
                          {service.subtitle}
                        </CardDescription>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {service.description}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Quick Info */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">{service.delivery}</div>
                        <div className="text-xs text-muted-foreground">Waktu</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">{service.weight}</div>
                        <div className="text-xs text-muted-foreground">Berat</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">
                          <FontAwesomeIcon icon={faMapMarkerAlt} className="h-4 w-4 mx-auto" />
                        </div>
                        <div className="text-xs text-muted-foreground">{service.coverage}</div>
                      </div>
                    </div>

                    {/* Features */}
                    <div>
                      <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Keunggulan:</h4>
                      <ul className="space-y-2">
                        {service.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-center gap-2 text-sm">
                            <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button className="w-full group-hover:bg-primary/90 transition-colors" onClick={() => openModal(service)}>
                      Informasi Ongkir
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Additional Info Section */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Mengapa Memilih Layanan Kami?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="text-center">
                <div className="bg-primary/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <FontAwesomeIcon icon={faShieldAlt} className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Keamanan Terjamin</h3>
                <p className="text-sm text-muted-foreground">
                  Setiap pengiriman diasuransikan dan ditangani dengan standar keamanan tertinggi
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <FontAwesomeIcon icon={faClock} className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Selalu Tepat Waktu</h3>
                <p className="text-sm text-muted-foreground">
                  Komitmen kami untuk selalu mengantarkan paket Anda sesuai jadwal yang dijanjikan
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <FontAwesomeIcon icon={faStar} className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Pelayanan Terbaik</h3>
                <p className="text-sm text-muted-foreground">
                  Tim customer service yang responsif dan berpengalaman siap membantu 24/7
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Siap Mengirim Paket Anda?</h2>
          <p className="text-xl opacity-90 mb-8">
            Pilih layanan yang sesuai dengan kebutuhan Anda dan nikmati pengalaman pengiriman terbaik
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/" 
              passHref 
              className="inline-flex items-center justify-center rounded-md text-lg px-8 h-12 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors duration-200"
            >
              Lacak Pengiriman
            </Link>
            <Link 
              href="https://wa.me/6282114097704" 
              passHref 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-lg px-8 h-12 border border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary transition-colors duration-200"
            >
              Hubungi Kami
            </Link>
          </div>
        </div>
      </section>

      <Footer />

      {/* Pricelist Modal */}
      {isModalOpen && modalContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{modalContent.title}</h3>
              <Button variant="ghost" size="icon" onClick={closeModal}>
                <FontAwesomeIcon icon={faTimes} className="h-5 w-5" />
                <span className="sr-only">Close modal</span>
              </Button>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <p>{modalContent.pricelist}</p>
              {/* Add actual pricelist content here */}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 