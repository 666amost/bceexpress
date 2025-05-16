"use client"

import { useEffect, useState, useRef } from "react"
import JsBarcode from "jsbarcode"
import QRCode from "qrcode" // Menggunakan library qrcode
import { Phone } from 'lucide-react' // Import ikon Phone

export default function PrintLayout({ data }) {
  const barcodeRef = useRef(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null); 

  // Add a mapping for wilayah to airport codes
  const airportCodes = {
    "Pangkal Pinang": "PGK",  // Example as per your query
    "Sungailiat": "SLT",      // Example; you can add more based on your needs
    "Belinyu": "BLY",         // Example
    "Jebus": "JBS",           // Example
    "Koba": "KBA",            // Example
    "Toboali": "TBL",         // Example
    "Mentok": "MNT",          // Example
    "Pontianak": "PNK",       // Added new entry
    "Singkawang": "SKW",       // Added new entry
    "Sungai Pinyuh": "SPY",
    "Tj Pandan": "TJQ",
    "Denpasar": "DPS",
    // Add more as needed, e.g., "Pontianak": "PNK"
  };

  // Get the airport code based on the wilayah
  const getAirportCode = (wilayah) => {
    return airportCodes[wilayah] || "N/A";  // Default to "N/A" if not found
  };

  // Fungsi untuk memformat mata uang
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    console.log("PrintLayout - Data received:", data);
    console.log("PrintLayout - AWB Number for QR:", data?.awb_no);

    if (barcodeRef.current && data?.awb_no) {
      JsBarcode(barcodeRef.current, data.awb_no, {
        format: "CODE128",
        width: 2.5,
        height: 50,
        displayValue: false,
        margin: 0,
      })
    }

    if (data?.awb_no) {
      console.log("Attempting to draw QR Code on an off-screen canvas for DataURL conversion.");
      
      const canvas = document.createElement('canvas');
      canvas.width = 100; 
      canvas.height = 100;

      const context = canvas.getContext('2d');
      if (!context) {
        console.error("Failed to get 2D context for temporary canvas.");
        setQrCodeDataUrl(null);
        return;
      }

      QRCode.toCanvas(canvas, data.awb_no, {
        width: 100,
        margin: 0,
        color: {
          dark: '#000000ff',
          light: '#ffffffff'
        }
      })
        .then(() => {
          console.log("QR Code drawing successful on temporary canvas!");
          const dataUrl = canvas.toDataURL("image/png");
          setQrCodeDataUrl(dataUrl);
          console.log("QR Code Data URL generated.");
        })
        .catch(err => {
          console.error("Error drawing QR Code to temporary canvas:", err);
          alert("Error generating QR Code. Check browser console for details.");
          setQrCodeDataUrl(null);
        });
    } else {
      console.warn("QR Code not generated: data.awb_no is missing/empty.", {
        awbNo: data?.awb_no
      });
      setQrCodeDataUrl(null);
    }
  }, [data])

  const generateAbbreviation = (agentName) => {
    const words = agentName.trim().split(/\s+/);
    let abbr = words.map(word => word[0].toUpperCase()).join('');
    if (abbr.length > 3) {
      abbr = abbr.slice(0, 3);
    } else if (abbr.length < 3) {
      const firstWord = words[0].toUpperCase();
      while (abbr.length < 3 && firstWord.length > abbr.length) {
        abbr += firstWord[abbr.length];
      }
      abbr = abbr.slice(0, 3);
    }
    return abbr;
  };

  if (!data) return null

  return (
    <div className="print-only">
      <div className="shipping-label">
        <div className="top-header-container">
          <div className="top-header-left">
            <img src="/images/bce-logo.png" alt="BCE Express" className="header-logo" />
          </div>
          <div className="top-header-right">
            <div className="airport-code">
              {data.wilayah && getAirportCode(data.wilayah)}
            </div>
          </div>
        </div>

        <div className="barcode-section">
          <svg ref={barcodeRef}></svg>
          <div className="awb-number">{data.awb_no}</div>
        </div>

        <div className="shipping-details">
          <div>coli : {data.coli || 1}</div>
          <div>berat : {data.berat_kg || 1} kg</div>
          <div>total : {formatCurrency(data.total || 0)}</div>
          <div>Metode: {data.metode_pembayaran?.toUpperCase()}</div>
        </div>

        <div className="content-section">
          <div className="address-box">
            <div className="sender-info">
              <div>Pengirim: {data.nama_pengirim || 'Nama pengirim'}</div>
              <div>No. Pengirim: {data.nomor_pengirim || 'no pengirim'}</div>
            </div>
            <div style={{ height: '5mm' }}></div>
            <div className="recipient-info">
              <div>Penerima: {data.nama_penerima || 'nama penerima'}</div>
              <div>No. Penerima: {data.nomor_penerima || 'no penerima'}</div>
              <div>Alamat: {data.alamat_penerima || 'alamat'}</div>
            </div>
          </div>

          <div className="logo-qr">
            {qrCodeDataUrl && (
              <>
                <img src={qrCodeDataUrl} alt="QR Code" className="qr-code" />
                <div className="agent-abbr text-center text-xs mt-5">
                  {data.agent_customer && (
                    <span>{generateAbbreviation(data.agent_customer)}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="footer-container">
          <div className="dotted-line"></div>
          <div className="footer">
            <div className="terms-text">
              *Syarat dan ketentuan pengiriman
              <br />
              sesuai dengan kebijakan BCE Express
            </div>
            <div className="admin-contact">
              <Phone className="h-[10px] w-[10px] mr-1" style={{ color: 'black' }} />
              0812-9056-8532
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .print-only {
          display: block;
          width: 100mm;
          height: 100mm;
          padding: 0;
          margin: 0 auto;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
          font-size: 10px;
        }

        .shipping-label {
          width: 100%;
          height: 100%;
          border: 1px solid #000;
          padding: 0mm 3mm 3mm 3mm; 
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .top-header-container {
          display: flex;
          justify-content: space-between;  /* Distributes items across the container */
          align-items: center;
          width: 100%;
          padding-bottom: 0mm;
        }

        .top-header-left {
          flex: 0 0 auto;  /* Prevents growth, keeps it on the left */
        }

        .top-header-center {
          flex: 1;  /* Allows it to take up available space and center content */
          text-align: center;  /* Centers the text within this div */
        }

        .top-header-right {
          flex: 0 0 auto;  /* Prevents growth, keeps it on the right */
        }

        .cod-text {
          font-size: 14px;
          font-weight: bold;
          /* Removed margin for now to let flex handle spacing */
        }

        .header-logo {
          width: 20mm;
          height: auto;
          display: block;
          box-sizing: border-box;
        }

        .barcode-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: -4mm;
          margin-bottom: 1mm;
          border: 2px solid #000;
          padding: 1mm;
        }

        .barcode-section svg {
          width: 100%;
          height: 15mm;
        }

        .awb-number {
          font-weight: bold;
          font-size: 14px;
          margin-top: 1mm;
        }

        .shipping-details {
          display: flex;
          flex-direction: row;  // Updated to make elements horizontal
          align-items: flex-start;
          gap: 2mm;
          margin-bottom: 1mm;
          font-size: 12px;
          padding-left: 2mm;
        }

        .content-section {
          display: flex;
          flex: 1;
          margin-bottom: 1mm;
        }

        .address-box {
          flex: 1;
          border: 1px solid #000;
          padding: 2mm;
          margin-right: 3mm;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          font-size: 11px;
          font-weight: bold;
        }

        /* Styles for underlines - Ensuring this is clean and targeted */
        .address-box .sender-info > div,
        .address-box .recipient-info > div {
          border-bottom: 1px dotted #999;  /* Added underline for each div */
          padding-bottom: 0.6mm;
          margin-bottom: 0.5mm;
          line-height: 1.4;
          font-size: 11px;  /* Enlarge font size */
          font-weight: bold;  /* Make text bold */
        }
        .address-box .recipient-info > div:last-child {
          border-bottom: none;  /* Remove underline from the last item */
        }

        .address-box .sender-info {
          margin-bottom: 5mm; /* Jarak antara informasi pengirim dan penerima */
        }

        .logo-qr {
          width: 30mm;
          height: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 7mm;
        }

        .qr-code {
          width: 30mm !important;
          height: 30mm !important;
          display: block !important;
          box-sizing: border-box;
        }

        .footer-container {
          width: 100%;
          margin-top: auto; 
        }

        .dotted-line {
          border-top: 1px dotted #000;
          margin-bottom: 2mm;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 8px;
          font-style: italic;
          padding-top: 0;
        }

        .terms-text {
          flex: 1;
          text-align: left;
          line-height: 1.3;
        }

        .admin-contact {
          text-align: right;
          white-space: nowrap;
          display: flex; /* Menjadikan flex container untuk menyelaraskan ikon */
          align-items: center; /* Menyelaraskan ikon dan teks secara vertikal */
          justify-content: flex-end; /* Menempatkan konten ke kanan */
          color: black; /* Memastikan warna teks dan ikon (jika menggunakan currentColor) terlihat */
        }

        .airport-code {
          font-size: 20px;
          font-weight: bold;
          text-align: right;
          margin-right: 2mm;
          margin-top: -3mm;
        }

        .agent-abbr {
          font-size: 15px;
          font-weight: bold;
          width: 100%;
          text-align: center;
          margin-top: 0mm;
          position: relative;
          top: 2mm;
        }

        @media print {
          @page {
            size: 100mm 100mm;
            margin: 0;
          }

          body * {
            visibility: hidden;
          }

          .print-only,
          .print-only * {
            visibility: visible;
          }

          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100mm;
            height: 100mm;
          }
        }
      `}</style>
    </div>
  )
}