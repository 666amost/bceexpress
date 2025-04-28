"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-background border-b shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            {/* Logo hitam untuk light mode */}
            <Image
              src="/images/bce-logo.png"
              alt="BCE EXPRESS"
              width={200}
              height={64}
              className="h-12 sm:h-16 w-auto block dark:hidden"
              priority
            />
            {/* Logo putih untuk dark mode */}
            <Image
              src="/images/bce-logo-white.png"
              alt="BCE EXPRESS"
              width={200}
              height={64}
              className="h-12 sm:h-16 w-auto hidden dark:block"
              priority
            />
          </Link>
        </div>
        <div className="hidden md:flex items-center space-x-6 text-sm lg:text-base">
          <Link href="/" className="hover:text-primary transition-colors duration-200">
            Track Shipment
          </Link>
          <Link href="#services" className="hover:text-primary transition-colors duration-200">
            Services
          </Link>
          <Link href="#about" className="hover:text-primary transition-colors duration-200">
            About Us
          </Link>
          <Link href="#contact" className="hover:text-primary transition-colors duration-200">
            Contact
          </Link>
          <Link 
            href="/courier" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            Courier Login
          </Link>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="hover:bg-gray-100 dark:hover:bg-gray-800">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px]">
              <SheetTitle className="sr-only">Main Menu</SheetTitle>
              <div className="flex justify-center mb-6 mt-4">
                {/* Logo hitam untuk light mode */}
                <Image
                  src="/images/bce-logo.png"
                  alt="BCE EXPRESS"
                  width={160}
                  height={53}
                  className="h-auto block dark:hidden"
                  priority
                />
                {/* Logo putih untuk dark mode */}
                <Image
                  src="/images/bce-logo-white.png"
                  alt="BCE EXPRESS"
                  width={160}
                  height={53}
                  className="h-auto hidden dark:block"
                  priority
                />
              </div>
              <div className="flex flex-col space-y-4 mt-8">
                <Link 
                  href="/" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                >
                  Track Shipment
                </Link>
                <Link 
                  href="#services" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                >
                  Services
                </Link>
                <Link 
                  href="#about" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                >
                  About Us
                </Link>
                <Link 
                  href="#contact" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                >
                  Contact
                </Link>
                <Link 
                  href="/courier" 
                  onClick={() => setIsOpen(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-center"
                >
                  Courier Login
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
