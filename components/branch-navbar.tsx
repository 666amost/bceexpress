"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

interface BranchNavbarProps {
  selectedMenu: string
  selectedSubMenu: string
  onMenuChange: (menu: string, submenu?: string) => void
}

export default function BranchNavbar({ selectedMenu, selectedSubMenu, onMenuChange }: BranchNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isTransactionSubmenuOpen, setIsTransactionSubmenuOpen] = useState(false)
  const [isReportSubmenuOpen, setIsReportSubmenuOpen] = useState(false)
  const [isDesktopTransactionOpen, setIsDesktopTransactionOpen] = useState(false)
  const [isDesktopReportOpen, setIsDesktopReportOpen] = useState(false)
  const router = useRouter()
  const transactionRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  // Close desktop submenu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (transactionRef.current && !transactionRef.current.contains(event.target as Node)) {
        setIsDesktopTransactionOpen(false)
      }
      if (reportRef.current && !reportRef.current.contains(event.target as Node)) {
        setIsDesktopReportOpen(false)
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
    router.push("/branch/login")
  }

  const handleMenuClick = (menu: string, submenu: string) => {
    onMenuChange(menu, submenu)
    setIsDesktopTransactionOpen(false)
    setIsDesktopReportOpen(false)
    // Close mobile menu only after selecting a submenu
    if (submenu) {
      setIsMenuOpen(false)
    }
  }

  return (
    <nav className="bg-white shadow-md fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <div className="flex items-center">
                  <Image
                    src="/images/bce-logo.png"
                    alt="BCE EXPRESS"
                    width={150}
                    height={48}
                    className="h-10 w-auto"
                    priority
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      e.currentTarget.nextSibling?.classList.remove("hidden")
                    }}
                  />
                  <span className="text-xl font-bold text-blue-600 hidden">BCE EXPRESS</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
            {/* Transaction Menu */}
            <div className="relative" ref={transactionRef}>
              <button
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  selectedMenu === "transaction" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setIsDesktopTransactionOpen(!isDesktopTransactionOpen)
                  setIsDesktopReportOpen(false)
                  onMenuChange("transaction")
                }}
              >
                Transaction
                <svg
                  className={`w-4 h-4 ml-1 transform ${isDesktopTransactionOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {isDesktopTransactionOpen && (
                <div className="absolute left-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <button
                    className={`block px-4 py-2 text-sm w-full text-left ${
                      selectedSubMenu === "input_resi" ? "bg-gray-100 text-gray-900" : "text-gray-700"
                    } hover:bg-gray-100`}
                    onClick={() => handleMenuClick("transaction", "input_resi")}
                  >
                    Input Resi
                  </button>
                  <button
                    className={`block px-4 py-2 text-sm w-full text-left ${
                      selectedSubMenu === "search_manifest" ? "bg-gray-100 text-gray-900" : "text-gray-700"
                    } hover:bg-gray-100`}
                    onClick={() => handleMenuClick("transaction", "search_manifest")}
                  >
                    Search Manifest
                  </button>
                  <button
                    className={`block px-4 py-2 text-sm w-full text-left ${
                      selectedSubMenu === "pelunasan" ? "bg-gray-100 text-gray-900" : "text-gray-700"
                    } hover:bg-gray-100`}
                    onClick={() => handleMenuClick("transaction", "pelunasan")}
                  >
                    Pelunasan Resi
                  </button>
                </div>
              )}
            </div>

            {/* Report Menu */}
            <div className="relative" ref={reportRef}>
              <button
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  selectedMenu === "report" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setIsDesktopReportOpen(!isDesktopReportOpen)
                  setIsDesktopTransactionOpen(false)
                  onMenuChange("report")
                }}
              >
                Report
                <svg
                  className={`w-4 h-4 ml-1 transform ${isDesktopReportOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {isDesktopReportOpen && (
                <div className="absolute left-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <button
                    className={`block px-4 py-2 text-sm w-full text-left ${
                      selectedSubMenu === "daily_report" ? "bg-gray-100 text-gray-900" : "text-gray-700"
                    } hover:bg-gray-100`}
                    onClick={() => handleMenuClick("report", "daily_report")}
                  >
                    Daily Report
                  </button>
                  <button
                    className={`block px-4 py-2 text-sm w-full text-left ${
                      selectedSubMenu === "recap" ? "bg-gray-100 text-gray-900" : "text-gray-700"
                    } hover:bg-gray-100`}
                    onClick={() => handleMenuClick("report", "recap")}
                  >
                    Recap Manifest
                  </button>
                  <button
                    className={`block px-4 py-2 text-sm w-full text-left ${
                      selectedSubMenu === "outstanding" ? "bg-gray-100 text-gray-900" : "text-gray-700"
                    } hover:bg-gray-100`}
                    onClick={() => handleMenuClick("report", "outstanding")}
                  >
                    Outstanding
                  </button>
                  <button
                    className={`block px-4 py-2 text-sm w-full text-left ${
                      selectedSubMenu === "sale" ? "bg-gray-100 text-gray-900" : "text-gray-700"
                    } hover:bg-gray-100`}
                    onClick={() => handleMenuClick("report", "sale")}
                  >
                    Sale
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>

          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <div className="space-y-1">
              <button
                className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium ${
                  selectedMenu === "transaction" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => {
                  onMenuChange("transaction")
                  setIsTransactionSubmenuOpen(!isTransactionSubmenuOpen)
                  setIsReportSubmenuOpen(false)
                }}
              >
                Transaction
                <svg
                  className={`inline-block w-4 h-4 ml-1 transform ${isTransactionSubmenuOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {isTransactionSubmenuOpen && (
                <div className="pl-4 space-y-1">
                  <button
                    className={`w-full text-left block px-3 py-2 rounded-md text-sm ${
                      selectedSubMenu === "input_resi" ? "bg-gray-100 font-medium" : "text-gray-600"
                    }`}
                    onClick={() => handleMenuClick("transaction", "input_resi")}
                  >
                    Input Resi
                  </button>
                  <button
                    className={`w-full text-left block px-3 py-2 rounded-md text-sm ${
                      selectedSubMenu === "search_manifest" ? "bg-gray-100 font-medium" : "text-gray-600"
                    }`}
                    onClick={() => handleMenuClick("transaction", "search_manifest")}
                  >
                    Search Manifest
                  </button>
                  <button
                    className={`w-full text-left block px-3 py-2 rounded-md text-sm ${
                      selectedSubMenu === "pelunasan" ? "bg-gray-100 font-medium" : "text-gray-600"
                    }`}
                    onClick={() => handleMenuClick("transaction", "pelunasan")}
                  >
                    Pelunasan Resi
                  </button>
                </div>
              )}

              <button
                className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium ${
                  selectedMenu === "report" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => {
                  onMenuChange("report")
                  setIsReportSubmenuOpen(!isReportSubmenuOpen)
                  setIsTransactionSubmenuOpen(false)
                }}
              >
                Report
                <svg
                  className={`inline-block w-4 h-4 ml-1 transform ${isReportSubmenuOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {isReportSubmenuOpen && (
                <div className="pl-4 space-y-1">
                  <button
                    className={`w-full text-left block px-3 py-2 rounded-md text-sm ${
                      selectedSubMenu === "daily_report" ? "bg-gray-100 font-medium" : "text-gray-600"
                    }`}
                    onClick={() => handleMenuClick("report", "daily_report")}
                  >
                    Daily Report
                  </button>
                  <button
                    className={`w-full text-left block px-3 py-2 rounded-md text-sm ${
                      selectedSubMenu === "recap" ? "bg-gray-100 font-medium" : "text-gray-600"
                    }`}
                    onClick={() => handleMenuClick("report", "recap")}
                  >
                    Recap Manifest
                  </button>
                  <button
                    className={`w-full text-left block px-3 py-2 rounded-md text-sm ${
                      selectedSubMenu === "outstanding" ? "bg-gray-100 font-medium" : "text-gray-600"
                    }`}
                    onClick={() => handleMenuClick("report", "outstanding")}
                  >
                    Outstanding
                  </button>
                  <button
                    className={`w-full text-left block px-3 py-2 rounded-md text-sm ${
                      selectedSubMenu === "sale" ? "bg-gray-100 font-medium" : "text-gray-600"
                    }`}
                    onClick={() => handleMenuClick("report", "sale")}
                  >
                    Sale
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  handleLogout()
                  setIsMenuOpen(false)
                }}
                className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
