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
    // Tambahan untuk cabang tanjung pandan ke JKT dan sekitarnya
    JKT: "JKT",
    TGT: "TGR",
    BKS: "BKS",
    DPK: "DPK",
    BGR: "BGR",
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
          <div className="address-box">
            <div className="sender-info">
              <div>Pengirim: {data.nama_pengirim || 'Nama pengirim'}</div>
              <div>No. Pengirim: {data.nomor_pengirim || 'no pengirim'}</div>
              <div>Isi Barang: {data.isi_barang || '-'}</div>
            </div>
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

        .airport-code {
          font-size: 20px;
          font-weight: bold;
          text-align: right;
          margin-right: 2mm;
          margin-top: -3mm;
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
        }
      `}</style>
    </div>
  )
}