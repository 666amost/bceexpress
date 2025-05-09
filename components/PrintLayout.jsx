"use client"

import { useRef, useEffect } from "react"
import JsBarcode from "jsbarcode"
import QRCode from "qrcode"

export default function PrintLayout({ data }) {
  const barcodeRef = useRef(null)
  const qrCodeRef = useRef(null)

  useEffect(() => {
    if (barcodeRef.current && data?.awb_no) {
      JsBarcode(barcodeRef.current, data.awb_no, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: false,
        margin: 0,
      })
    }

    if (qrCodeRef.current && data?.awb_no) {
      QRCode.toCanvas(qrCodeRef.current, data.awb_no, {
        width: 100,
        margin: 0,
      })
    }
  }, [data])

  if (!data) return null

  return (
    <div className="print-only">
      {/* This is the actual content that will be printed */}
      <div className="shipping-label">
        <div className="barcode-section">
          <svg ref={barcodeRef}></svg>
          <div className="awb-number">{data.awb_no}</div>
        </div>

        <div className="shipping-details">
          <span>coli: {data.coli}</span>
          <span>berat: {data.berat_kg} kg</span>
          <span>total: {data.total}</span>
        </div>

        <div className="content-section">
          <div className="address-box">
            <div className="sender">
              <strong>{data.nama_pengirim}</strong>
              <div>{data.nomor_pengirim}</div>
            </div>
            <div className="recipient">
              <strong>{data.nama_penerima}</strong>
              <div>{data.nomor_penerima}</div>
              <div>{data.alamat_penerima}</div>
            </div>
          </div>

          <div className="logo-qr">
            <img src="/images/bce-logo.png" alt="BCE Express" className="logo" />
            <canvas ref={qrCodeRef}></canvas>
          </div>
        </div>

        <div className="footer">
          <div className="terms">*Syarat dan ketentuan pengiriman sesuai dengan kebijakan BCE Express</div>
          <div className="admin">admin 0812-9056-8532</div>
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
          padding: 5mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        
        .barcode-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 3mm;
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
          justify-content: flex-start;
          gap: 10mm;
          margin-bottom: 3mm;
          font-size: 12px;
        }
        
        .content-section {
          display: flex;
          flex: 1;
          margin-bottom: 3mm;
        }
        
        .address-box {
          flex: 1;
          border: 1px solid #000;
          padding: 2mm;
          margin-right: 3mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        .sender {
          margin-bottom: 3mm;
        }
        
        .logo-qr {
          width: 30mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
        }
        
        .logo {
          width: 25mm;
          height: auto;
          margin-bottom: 2mm;
        }
        
        canvas {
          width: 25mm !important;
          height: 25mm !important;
        }
        
        .footer {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          font-style: italic;
        }
        
        @media print {
          @page {
            size: 100mm 100mm;
            margin: 0;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print-only, .print-only * {
            visibility: visible;
          }
          
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100mm;
            height: 100mm;
          }
          
          .shipping-label {
            border: none;
          }
        }
      `}</style>
    </div>
  )
}
