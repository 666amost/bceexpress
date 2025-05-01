import { Button } from "@/components/ui/button"
import Image from "next/image"

export function GoogleMapsButton() {
  return (
    <Button 
      variant="outline" 
      onClick={() => window.open('https://www.google.com/maps', '_blank')} 
      className="flex items-center"
    >
      <Image 
        src="/images/gmap-icon.ico" 
        alt="Google Maps" 
        width={20} 
        height={20} 
        className="mr-2"
      />
      Gmaps
    </Button>
  )
} 