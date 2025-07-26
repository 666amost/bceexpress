"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

interface AgentNavbarProps {
  selectedMenu: string
  selectedSubMenu: string
  onMenuChange: (menu: string, submenu?: string) => void
}

export default function AgentNavbar({ selectedMenu, selectedSubMenu, onMenuChange }: AgentNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isBookingSubmenuOpen, setIsBookingSubmenuOpen] = useState(false)
  const [isHistorySubmenuOpen, setIsHistorySubmenuOpen] = useState(false)
  const [isDesktopBookingOpen, setIsDesktopBookingOpen] = useState(false)
  const [isDesktopHistoryOpen, setIsDesktopHistoryOpen] = useState(false)
  const router = useRouter()
  const bookingRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  // Close desktop submenu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bookingRef.current && !bookingRef.current.contains(event.target as Node)) {
        setIsDesktopBookingOpen(false)
      }
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setIsDesktopHistoryOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    const { supabaseClient } = await import("@/lib/auth")
    await supabaseClient.auth.signOut()
    router.push("/agent/login")
  }

  const handleMenuClick = (menu: string, submenu: string) => {
    onMenuChange(menu, submenu)
    setIsDesktopBookingOpen(false)
    setIsDesktopHistoryOpen(false)
    // Close mobile menu only after selecting a submenu
    if (submenu) {
      setIsMenuOpen(false)
    }
  }

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <div className="flex items-center">
                  {/* Logo hitam untuk light mode */}
                  <Image
                    src="/images/bce-logo.png"
                    alt="BCE EXPRESS"
                    width={150}
                    height={48}
                    className="h-10 w-auto block dark:hidden"
                    priority
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      const nextElement = e.currentTarget.nextSibling as HTMLElement
                      nextElement?.classList.remove("hidden")
                    }}
                  />
                  {/* Logo putih untuk dark mode */}
                  <Image
                    src="/images/bce-logo-white.png"
                    alt="BCE EXPRESS"
                    width={150}
                    height={48}
                    className="h-10 w-auto hidden dark:block"
                    priority
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      const nextElement = e.currentTarget.nextSibling as HTMLElement
                      nextElement?.classList.remove("hidden")
                    }}
                  />
                  <span className="text-xl font-bold text-green-600 dark:text-green-400 hidden">BCE EXPRESS AGENT</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
            {/* Booking Menu */}
            <div className="relative" ref={bookingRef}>
              <button
                onClick={() => setIsDesktopBookingOpen(!isDesktopBookingOpen)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  selectedMenu === "booking"
                    ? "bg-green-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400"
                }`}
              >
                Booking Pengiriman
              </button>
              {isDesktopBookingOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
                  <button
                    onClick={() => handleMenuClick("booking", "input_booking")}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                      selectedSubMenu === "input_booking"
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    Input Booking
                  </button>
                  <button
                    onClick={() => handleMenuClick("booking", "print_awb")}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                      selectedSubMenu === "print_awb"
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    Print AWB Booking
                  </button>
                </div>
              )}
            </div>

            {/* History Menu */}
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setIsDesktopHistoryOpen(!isDesktopHistoryOpen)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  selectedMenu === "history"
                    ? "bg-green-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400"
                }`}
              >
                History & Status
              </button>
              {isDesktopHistoryOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
                  <button
                    onClick={() => handleMenuClick("history", "booking_status")}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                      selectedSubMenu === "booking_status"
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    Status Booking
                  </button>
                  <button
                    onClick={() => handleMenuClick("history", "payment_status")}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                      selectedSubMenu === "payment_status"
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    Status Pembayaran
                  </button>
                </div>
              )}
            </div>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
            >
              Logout
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <ThemeToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="ml-2 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
            >
              <span className="sr-only">Open main menu</span>
              {!isMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            {/* Booking Mobile Menu */}
            <div>
              <button
                onClick={() => setIsBookingSubmenuOpen(!isBookingSubmenuOpen)}
                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Booking Pengiriman
              </button>
              {isBookingSubmenuOpen && (
                <div className="pl-4">
                  <button
                    onClick={() => handleMenuClick("booking", "input_booking")}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                  >
                    Input Booking
                  </button>
                  <button
                    onClick={() => handleMenuClick("booking", "print_awb")}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                  >
                    Print AWB Booking
                  </button>
                </div>
              )}
            </div>

            {/* History Mobile Menu */}
            <div>
              <button
                onClick={() => setIsHistorySubmenuOpen(!isHistorySubmenuOpen)}
                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                History & Status
              </button>
              {isHistorySubmenuOpen && (
                <div className="pl-4">
                  <button
                    onClick={() => handleMenuClick("history", "booking_status")}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                  >
                    Status Booking
                  </button>
                  <button
                    onClick={() => handleMenuClick("history", "payment_status")}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                  >
                    Status Pembayaran
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
