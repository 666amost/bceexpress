/**
 * Hook untuk handle external URLs di web browser.
 */

export const useExternalLinks = () => {
  const openExternalLink = async (url: string) => {
    try {
      window.open(url, "_blank", 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening external link:', error);
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
