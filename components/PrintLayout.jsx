"use client"

import { useEffect, useState, useRef, useLayoutEffect } from "react"
import JsBarcode from "jsbarcode"
import QRCode from "qrcode"
import { areaCodes as areaCodesLib, airportCodes as airportCodesLib } from '@/lib/area-codes';

export default function PrintLayout({ data }) {
  const barcodeRef = useRef(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null); 
  const addressRef = useRef(null);
  const addressContainerRef = useRef(null);
  const senderNameRef = useRef(null);
  const senderPhoneRef = useRef(null);
  const barangRef = useRef(null);
  const receiverNameRef = useRef(null);
  const receiverPhoneRef = useRef(null);

  // Local airport codes specific to this layout; merge with centralized mappings
  const localAirportCodes = {
    "Pangkal Pinang": "PGK",
    "Sungailiat": "SLT",
    "Belinyu": "BLY",
    "Jebus": "JBS",
    "Koba": "KBA",
    "Toboali": "TBL",
    "Mentok": "MNT",
    "Pontianak": "PNK",
    "Singkawang": "SKW",
    "Sungai Pinyuh": "SPY",
    "Tj Pandan": "TJQ",
    "Denpasar": "DPS",
    JKT: "JKT",
    TGT: "TGR",
    BKS: "BKS",
    DPK: "DPK",
    BGR: "BGR"
  };

  const airportCodes = { ...airportCodesLib, ...localAirportCodes };
  const areaCodes = areaCodesLib;

  // Mapping kecamatan or kota to special area codes (from centralized lib)

  // Get the area code based on kota_tujuan or kecamatan
  const getAreaCode = (kota, kec) => {
    // Convert both kecamatan and kota to uppercase for consistent matching
    const kecamatanKey = (kec || "").toUpperCase();
    const kotaKey = (kota || "").toUpperCase();
    
    // Try to find match in kecamatan first, then kota
    return areaCodes[kecamatanKey] || areaCodes[kotaKey] || "";
  };

  // Get the airport code based on the wilayah
  const getAirportCode = (wilayah) => {
    return airportCodes[wilayah] || wilayah || "N/A";
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
    if (barcodeRef.current && data?.awb_no) {
      try {
        JsBarcode(barcodeRef.current, data.awb_no, {
          format: "CODE128",
          width: 2.5,
          height: 50,
          displayValue: false,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000",
          valid: (valid) => {
            if (!valid) {
              // Pernyataan console dihapus
            }
          }
        })
      } catch (error) {
        // Error handling tanpa console
      }
    }

    if (data?.awb_no) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      
      if (context) {
        try {
          QRCode.toCanvas(
            canvas,
            data.awb_no,
            {
              width: 120, // Size of QR code
              margin: 1, // Margin around QR code
              color: {
                dark: "#000000", // QR code color
                light: "#ffffff", // Background color
              },
            },
            function (error) {
              if (!error) {
                const tempCanvas = document.createElement("canvas");
                const tempContext = tempCanvas.getContext("2d");
                
                if (tempContext) {
                  tempCanvas.width = canvas.width;
                  tempCanvas.height = canvas.height;
                  tempContext.fillStyle = "#FFFFFF";
                  tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                  tempContext.drawImage(canvas, 0, 0);
                  
                  try {
                    const dataURL = tempCanvas.toDataURL("image/png");
                    setQrCodeDataUrl(dataURL);
                  } catch (err) {
                    // Error handling tanpa console
                  }
                } else {
                  // Error handling tanpa console
                }
              }
            }
          );
        } catch (err) {
          // Error handling tanpa console
        }
      }
    } else {
      // No AWB number provided
    }
  }, [data])

  const generateAbbreviation = (agentName) => {
    if (!agentName) return ""
    const words = agentName.trim().split(/\s+/)
    
    if (words.length === 1 && words[0].length <= 4) {
      return words[0].toUpperCase()
    }
    
    const nameWithoutSpaces = agentName.replace(/\s+/g, '')
    if (nameWithoutSpaces.length <= 4) {
      return nameWithoutSpaces.toUpperCase()
    }
    
    let abbr = words.map(word => word[0].toUpperCase()).join('')
    
    if (abbr.length < 4) {
      const firstWord = words[0].toUpperCase()
      let index = 1
      while (abbr.length < 4 && index < firstWord.length) {
        abbr += firstWord[index]
        index++
      }
    }
    
    if (abbr.length < 4 && words.length > 1) {
      const secondWord = words[1].toUpperCase()
      let index = 1
      while (abbr.length < 4 && index < secondWord.length) {
        abbr += secondWord[index]
        index++
      }
    }
    
    return abbr.slice(0, 4)
  };

  // Fungsi untuk mengkonversi metode pembayaran ke format singkat
  const getPaymentMethodCode = (method) => {
    if (!method) return ''
    const methodUpper = method.toUpperCase()
    if (methodUpper === 'CASH') return 'CASH'
    if (methodUpper === 'TRANSFER') return 'TRF'
    if (methodUpper === 'COD') return 'COD'
    return methodUpper
  };

  // Fungsi untuk menyesuaikan ukuran font berdasarkan panjang teks
  const adjustFontSize = (element, text, baseSize = 11) => {
    if (!element || !text) return;
    
    // Reset ukuran font
    element.style.fontSize = `${baseSize}px`;
    
    const contentLength = text.length;
    
    // Menyesuaikan ukuran font berdasarkan panjang teks
    if (contentLength > 25) element.style.fontSize = `${baseSize - 1}px`;
    if (contentLength > 35) element.style.fontSize = `${baseSize - 2}px`;
    if (contentLength > 45) element.style.fontSize = `${baseSize - 3}px`;
    if (contentLength > 55) element.style.fontSize = `${baseSize - 4}px`;
    
    // Tambahkan font smoothing untuk ukuran font kecil
    if (contentLength > 35) {
      element.style.webkitFontSmoothing = 'antialiased';
      element.style.mozOsxFontSmoothing = 'grayscale';
    }
  };
  
  // Efek untuk menyesuaikan ukuran font untuk semua field
  useLayoutEffect(() => {
    // Menyesuaikan ukuran font untuk semua field
    if (senderNameRef.current) adjustFontSize(senderNameRef.current, data?.nama_pengirim);
    if (senderPhoneRef.current) adjustFontSize(senderPhoneRef.current, data?.nomor_pengirim);
    if (barangRef.current) adjustFontSize(barangRef.current, data?.isi_barang);
    if (receiverNameRef.current) adjustFontSize(receiverNameRef.current, data?.nama_penerima);
    if (receiverPhoneRef.current) adjustFontSize(receiverPhoneRef.current, data?.nomor_penerima);
  }, [data]);

  // Fungsi untuk mengecilkan font alamat berdasarkan panjang teks dan overflow
  useLayoutEffect(() => {
    if (addressRef.current && addressContainerRef.current && data?.alamat_penerima) {
      const addressElement = addressRef.current;
      const containerElement = addressContainerRef.current;
      const contentLength = data.alamat_penerima.length;
      
      // Reset font size dulu
      addressElement.style.fontSize = '11px';
      
      // Fungsi untuk memeriksa apakah teks overflow
      const checkOverflow = () => {
        // Hitung tinggi maksimal yang tersedia (dari parent)
        const availableHeight = containerElement.clientHeight;
        // Hitung tinggi content saat ini
        const currentHeight = addressElement.scrollHeight;
        
        return currentHeight > availableHeight;
      };
      
      // Cek jika teks terlalu panjang, sesuaikan ukuran font dengan peningkatan lebih halus
      if (contentLength > 70) {
        addressElement.style.fontSize = '10px';
      }
      if (contentLength > 90) {
        addressElement.style.fontSize = '9.5px';
      }
      if (contentLength > 110) {
        addressElement.style.fontSize = '9px';
      }
      if (contentLength > 130) {
        addressElement.style.fontSize = '8.5px';
      }
      if (contentLength > 150) {
        addressElement.style.fontSize = '8px';
      }
      if (contentLength > 170) {
        addressElement.style.fontSize = '7.5px';
      }
      if (contentLength > 190) {
        addressElement.style.fontSize = '7px';
      }
      if (contentLength > 210) {
        addressElement.style.fontSize = '6.5px';
      }
      if (contentLength > 230) {
        addressElement.style.fontSize = '6px';
      }
      if (contentLength > 250) {
        addressElement.style.fontSize = '5.5px';
      }
      if (contentLength > 270) {
        addressElement.style.fontSize = '5px';
      }
      
      // Lakukan penyesuaian ukuran font tambahan jika masih overflow
      let currentSize = parseFloat(window.getComputedStyle(addressElement).fontSize);
      let steps = 0;
      
      // Kurangi ukuran font secara bertahap jika masih overflow
      while (checkOverflow() && currentSize > 4 && steps < 10) {
        currentSize -= 0.5;
        addressElement.style.fontSize = `${currentSize}px`;
        steps++;
      }
      
      // Tambahkan efek font smoothing untuk ukuran kecil agar tetap terbaca
      if (currentSize < 8) {
        addressElement.style.webkitFontSmoothing = 'antialiased';
        addressElement.style.mozOsxFontSmoothing = 'grayscale';
        addressElement.style.textRendering = 'optimizeLegibility';
      }
    }
  }, [data?.alamat_penerima]);

  if (!data) return null

  return (
    <div className="print-only">
      <div className="shipping-label">
        <div className="top-header-container">
          <div className="top-header-left">
            {data.usePlainText ? (
              <div className="header-text">BCE EXPRESS</div>
            ) : (
              <img src="/images/bce-logo.png" alt="BCE Express" className="header-logo" />
            )}
          </div>
          <div className="top-header-right">
            <div className="airport-code">
               {(() => {
                 const ar = getAreaCode(data.kota_tujuan, data.kecamatan);
                 // Prefer showing kecamatan name when available (e.g. "Penjaringan/KMY")
                 const leftLabel = (data.kecamatan && String(data.kecamatan).trim()) || (data.wilayah && String(data.wilayah).trim()) || (data.kota_tujuan && String(data.kota_tujuan).trim()) || "";
                 if (ar && leftLabel) return `${leftLabel}/${ar}`;
                 // Fallback to airport code (e.g. JKT) or whatever leftLabel is available
                 const ac = data.wilayah ? getAirportCode(data.wilayah) : (data.kota_tujuan ? getAirportCode(data.kota_tujuan) : "");
                 return ac || leftLabel || "";
               })()}
            </div>
          </div>
        </div>

        <div className="barcode-container">
          <div className="agent-code-box">
            {data.agent_customer && (
              <div className="agent-abbr-left">
                {generateAbbreviation(data.agent_customer)}
              </div>
            )}
          </div>
          <div className="barcode-section">
            <svg ref={barcodeRef}></svg>
            <div className="awb-number">{data.awb_no}</div>
          </div>
        </div>

        <div className="shipping-details">
          <div>coli : {data.coli || 1}</div>
          <div>berat : {data.berat_kg || 1} kg</div>
          <div>biaya lain: {formatCurrency((Number(data.biaya_admin) || 0) + (Number(data.biaya_packaging) || 0) + (Number(data.biaya_transit) || 0))}</div>
          <div className="total-bold">total : {formatCurrency(data.total || 0)}</div>
          <div>{data.awb_date}</div>
        </div>

        <div className="content-section">
          <div className="address-box" ref={addressContainerRef}>
            <div className="sender-info">
              <div ref={senderNameRef}>Pengirim: {data.nama_pengirim || 'Nama pengirim'}</div>
              <div ref={senderPhoneRef}>No. Pengirim: {data.nomor_pengirim || 'no pengirim'}</div>
              <div ref={barangRef}>Isi Barang: {data.isi_barang || '-'}</div>
            </div>
            <div className="recipient-info">
              <div ref={receiverNameRef}>Penerima: {data.nama_penerima || 'nama penerima'}</div>
              <div ref={receiverPhoneRef}>No. Penerima: {data.nomor_penerima || 'no penerima'}</div>
              <div ref={addressRef} className="address-content">Alamat: {data.alamat_penerima || 'alamat'}</div>
            </div>
          </div>

          <div className="logo-qr">
            {qrCodeDataUrl && (
              <>
                <img src={qrCodeDataUrl} alt="QR Code" className="qr-code" />
                {/* Metode pembayaran dipindah ke posisi agent */}
                <div className="payment-method-code">
                  {getPaymentMethodCode(data.metode_pembayaran)}
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
              <svg className="whatsapp-icon" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'black' }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              085117766429
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
          overflow: hidden;
        }

        .top-header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding-bottom: 0mm;
        }

        .top-header-left {
          flex: 0 0 auto;
        }

        .top-header-center {
          flex: 1;
          text-align: center;
        }

        .top-header-right {
          flex: 0 0 auto;
          display: flex;
          align-items: flex-end;
          gap: 1mm;
        }

        .cod-text {
          font-size: 14px;
          font-weight: bold;
        }

        .header-logo {
          width: 20mm;
          height: auto;
          display: block;
          box-sizing: border-box;
        }

        .header-text {
          font-size: 16px;
          font-weight: bold;
          color: #000;
        }

        .barcode-container {
          display: flex;
          align-items: center;
          margin-top: -2mm;
          margin-bottom: 1mm;
          flex-shrink: 0;
          gap: 2mm;
        }

        .agent-code-box {
          border: 2px solid #000;
          padding: 2mm;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 20mm;
          height: 20mm;
          flex-shrink: 0;
          background-color: #000;
        }

        .agent-abbr-left {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          color: #fff;
        }

        .barcode-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 2px solid #000;
          padding: 1mm;
          flex: 1;
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
          flex-direction: row;
          align-items: baseline;
          gap: 8mm;
          margin-bottom: 1mm;
          font-size: 12px;
          padding-left: 2mm;
          flex-shrink: 0;
        }

        .total-bold {
          font-weight: bold;
        }

        .content-section {
          display: flex;
          flex: 1;
          margin-bottom: 0mm;
          overflow: hidden;
        }

        .address-box {
          flex: 1;
          border: 1px solid #000;
          padding: 1mm;
          margin-right: 3mm;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          font-size: 11px;
          font-weight: bold;
          height: 40mm;
          overflow-y: auto;
          ::-webkit-scrollbar {
            display: none;
          }
          -ms-overflow-style: none;
          scrollbar-width: none;
          flex-shrink: 0;
        }

        .address-box .sender-info > div,
        .address-box .recipient-info > div {
          border-bottom: 1px dotted #999;
          padding-bottom: 0.6mm;
          margin-bottom: 0mm;
          line-height: 1.4;
          white-space: normal;
          word-wrap: break-word;
          word-break: break-word;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .address-box .recipient-info > div:last-child {
          border-bottom: none;
        }

        .address-box .sender-info {
          margin-bottom: 2mm;
        }

        .logo-qr {
          width: 30mm;
          height: 45mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 1mm;
          flex-shrink: 0;
          min-height: 35mm;
          overflow: visible;
        }

        .qr-code {
          width: 30mm !important;
          height: 30mm !important;
          display: block !important;
          box-sizing: border-box;
        }

        .payment-method-code {
          font-size: 15px;
          font-weight: bold;
          width: 100%;
          text-align: center;
          margin-top: 1mm;
          display: block;
        }

        .footer-container {
          width: 100%;
          margin-top: auto;
          flex-shrink: 0;
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
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: black;
        }

        .whatsapp-icon {
          width: 10px;
          height: 10px;
          margin-right: 1mm;
          display: inline-block;
          vertical-align: middle;
        }

        .airport-code {
          font-size: 20px;
          font-weight: bold;
          text-align: right;
          margin-right: 2mm;
          margin-top: -3mm;
        }
        .area-code {
          font-size: 14px;
          font-weight: bold;
          text-align: right;
          margin-right: 2mm;
          margin-top: -1mm;
        }

        .address-box .recipient-info > div.address-content {
          border-bottom: none;
          word-wrap: break-word;
          word-break: break-word;
          hyphens: auto;
          white-space: normal;
          overflow-wrap: break-word;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 10; /* Naikkan batas baris */
          -webkit-box-orient: vertical;
          overflow: hidden;
          max-height: 18mm; /* Tambahkan max-height */
        }

        @media print {
          @page {
            size: 100mm 100mm;
            margin: 0;
          }

          body {
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100mm;
            height: 100mm;
            margin: 0;
            padding: 0;
            background-color: #fff !important;
          }

          body > *:not(.print-only) {
            display: none !important;
            visibility: hidden !important;
          }

          .print-only,
          .print-only * {
            visibility: visible !important;
          }

          .shipping-label {
             width: 100%;
             height: 100%;
             box-sizing: border-box;
             display: flex;
             flex-direction: column;
             overflow: hidden;
          }

          .top-header-container, .barcode-container, .shipping-details, .footer-container {
              flex-shrink: 0;
          }

          .content-section {
              flex: 1;
              display: flex;
              flex-direction: row;
              overflow: hidden;
          }

          .address-box {
              flex: 1;
              padding: 1mm;
              margin-right: 3mm;
              overflow-y: auto;
              font-size: 11px;
              font-weight: bold;
              border: 1px solid #000;
              display: flex;
              flex-direction: column;
              flex-shrink: 0;
          }

          .logo-qr {
              width: 30mm;
              height: 45mm;
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              padding-top: 1mm;
              min-height: 35mm;
              overflow: visible;
          }

          .address-box .sender-info > div,
          .address-box .recipient-info > div {
            border-bottom: 1px dotted #999;
            padding-bottom: 0.6mm;
            margin-bottom: 0mm;
            line-height: 1.4;
          }
          .address-box .recipient-info > div:last-child {
            border-bottom: none;
          }

          .address-box .sender-info {
            margin-bottom: 2mm;
          }

          .barcode-container {
            display: flex;
            align-items: center;
            margin-top: -2mm;
            margin-bottom: 1mm;
            flex-shrink: 0;
            gap: 2mm;
          }

          .agent-code-box {
            border: 2px solid #000;
            padding: 2mm;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 20mm;
            height: 20mm;
            flex-shrink: 0;
            background-color: #000;
          }

          .agent-abbr-left {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            color: #fff;
          }

          .payment-method-code {
          font-size: 15px;
          font-weight: bold;
          width: 100%;
          text-align: center;
          margin-top: 0mm;
          position: relative;
          top: 1mm;
          }

          .total-bold {
            font-weight: bold;
          }

          .address-box .recipient-info > div.address-content {
            border-bottom: none;
            word-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
            white-space: normal;
            overflow-wrap: break-word;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 10; /* Naikkan batas baris */
            -webkit-box-orient: vertical;
            overflow: hidden;
            max-height: 18mm; /* Tambahkan max-height */
          }
        }
      `}</style>
    </div>
  )
}