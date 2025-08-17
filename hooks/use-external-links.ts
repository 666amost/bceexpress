/**
 * Hook untuk handle external URLs dengan Capacitor InAppBrowser
 * Fallback ke window.open jika tidak di environment Capacitor
 */
import { InAppBrowser } from '@capacitor/inappbrowser';
import { Capacitor } from '@capacitor/core';

export const useExternalLinks = () => {
  const openExternalLink = async (url: string) => {
    try {
      // Check if running in Capacitor (native app)
      if (Capacitor.isNativePlatform()) {
        // Use InAppBrowser for Capacitor apps - opens in external browser
        await InAppBrowser.openInExternalBrowser({ url });
      } else {
        // Fallback for web browsers
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error('Error opening external link:', error);
      // Fallback to window.open if InAppBrowser fails
      window.open(url, "_blank");
    }
  };

  const openWhatsApp = async (phoneNumber: string, message: string) => {
    const formattedNumber = formatPhoneForWhatsApp(phoneNumber);
    const whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
    await openExternalLink(whatsappUrl);
  };

  const openMaps = async (address: string) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    await openExternalLink(mapsUrl);
  };

  return { openExternalLink, openWhatsApp, openMaps };
};

// Function to format phone number for WhatsApp
const formatPhoneForWhatsApp = (phoneNumber: string): string => {
  if (!phoneNumber) return "";
  
  // Remove all non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, "");
  
  // If number starts with 0, replace with 62
  if (cleanNumber.startsWith("0")) {
    return "62" + cleanNumber.slice(1);
  }
  
  // If number already starts with 62, return as is
  if (cleanNumber.startsWith("62")) {
    return cleanNumber;
  }
  
  // If number starts with +62, remove the +
  if (cleanNumber.startsWith("62")) {
    return cleanNumber;
  }
  
  // Otherwise assume it's an Indonesian number and add 62
  return "62" + cleanNumber;
};
