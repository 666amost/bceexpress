import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from 'react-barcode';

export default function PrintLayout({ data }) {
  return (
    <div className="print-container" style={{ width: '100mm', height: '50mm', boxSizing: 'border-box', border: '2px solid #000', padding: 0, position: 'relative' }}>
      <style>
        {`
          @media print {
            @page {
              size: 100mm 50mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .print-container {
              width: 100mm;
              height: 50mm;
              box-sizing: border-box;
              border: 2px solid #000;
              padding: 0;
              position: relative;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
      <div style={{ display: 'flex', height: '100%' }}>
        {/* KIRI */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Kotak Barcode */}
          <div style={{ border: '2px solid #000', padding: '2mm', minHeight: '18mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <Barcode value={data.awb_no} width={2} height={40} displayValue={false} margin={0} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1mm' }}>
              <span style={{ fontWeight: 'bold', fontSize: '3.2mm' }}>{data.awb_no}</span>
              <span style={{ fontSize: '2.8mm' }}>admin 0812-9056-8532</span>
            </div>
          </div>
          {/* Kotak Info */}
          <div style={{ border: '2px solid #000', borderTop: 'none', borderBottom: 'none', padding: '2mm', fontSize: '3mm', fontWeight: 500 }}>
            C : {data.coli}   Kg : {data.berat_kg}   total : {data.total}
          </div>
          {/* Kotak Alamat */}
          <div style={{ border: '2px solid #000', flex: 1, padding: '2mm', fontSize: '3mm', fontWeight: 'bold', wordBreak: 'break-word', overflow: 'hidden', background: '#fff', borderRadius: 0 }}>
            {data.nama_pengirim},<br />
            {data.nama_penerima} {data.nomor_penerima}<br />
            {data.alamat_penerima}
          </div>
        </div>
        {/* KANAN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', height: '100%' }}>
          <img
            src="/images/bce-logo.png"
            alt="BCE Express"
            style={{ width: '22mm', height: 'auto', margin: '0 auto', display: 'block' }}
          />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <QRCodeCanvas value={data.awb_no} size={80} />
          </div>
        </div>
      </div>
    </div>
  );
} 