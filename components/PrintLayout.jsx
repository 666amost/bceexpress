"use client"

import { useEffect, useState, useRef } from "react"
import JsBarcode from "jsbarcode"
import QRCode from "qrcode"

export default function PrintLayout({ data }) {
  const barcodeRef = useRef(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null); 

  useEffect(() => {
    console.log("PrintLayout - Data received:", data);
    console.log("PrintLayout - AWB Number for QR:", data?.awb_no);

    if (barcodeRef.current && data?.awb_no) {
      JsBarcode(barcodeRef.current, data.awb_no, {
        format: "CODE128",
        width: 2,
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

  if (!data) return null

  return (
    <div className="print-only">
      <div className="shipping-label">
        <div className="barcode-section">
          <svg ref={barcodeRef}></svg>
          <div className="awb-number">{data.awb_no}</div>
        </div>

        <div className="shipping-details">
          <div>coli : {data.coli || 1}</div>
          <div>berat : {data.berat_kg || 1} kg</div>
          <div>total : {data.total || 0}</div>
        </div>

        <div className="content-section">
          <div className="address-box">
            <div className="sender-info">
              {data.nama_pengirim ? `${data.nama_pengirim},` : 'Nama pengirim,'}
              <br />
              {data.nomor_pengirim || 'no pengirim'}
            </div>
            <div style={{ height: '5mm' }}></div>
            <div className="recipient-info">
              {data.nama_penerima || 'nama penerima'}
              <br />
              {data.nomor_penerima || 'no penerima'}
              <br />
              {data.alamat_penerima || 'alamat'}
            </div>
          </div>

          <div className="logo-qr">
            {/* QR code first, then text for vertical stacking order */}
            {qrCodeDataUrl && (
              <img src={qrCodeDataUrl} alt="QR Code" className="qr-code" />
            )}
            <img src="/images/bce-logo.png" alt="BCE Express" className="logo" />
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
            <div className="admin-contact">admin 0812-9056-8532</div>
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
          padding: 3mm; 
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .barcode-section {
          display: flex;
          flex-direction: column;
          align-items: center;
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
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5mm;
          margin-bottom: 1mm;
          font-size: 12px;
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
        }

        .address-box .sender-info {
          margin-bottom: 5mm;
        }

        .logo-qr {
          width: 30mm;
          height: 40mm;
          display: flex;
          flex-direction: column;
          align-items: center; /* Center items horizontally */
          justify-content: space-between; /* Pushes QR to top, text to bottom */
        }

        .logo { /* Now styling for text */
          width: 25mm !important;
          height: auto !important; /* Will adapt to text height */
          max-width: 100% !important;
          display: block !important;
          box-sizing: border-box !important;
          text-align: center; /* Center the text inside the div */
          font-weight: bold; /* Make it bold */
          font-size: 14px; /* Adjust font size as needed */
          white-space: nowrap; /* Prevent text from wrapping if it fits */
        }

        .qr-code {
          width: 25mm !important;
          height: 25mm !important;
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