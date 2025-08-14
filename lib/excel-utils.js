import * as XLSX from 'xlsx'

// Enhanced XLSX export using buffer approach for better styling compatibility
export const createReliableXLSXExport = ({
  title,
  headers,
  data,
  sheetName = 'Report',
  fileName,
  currency = 'Rp',
  currencyColumns = [],
  numberColumns = [],
  includeTotal = true
}) => {
  // Create workbook
  const workbook = XLSX.utils.book_new()
  
  // Prepare data
  const today = new Date().toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  }).toUpperCase()

  const worksheetData = []
  
  // Add title and headers
  worksheetData.push([title.toUpperCase()])
  worksheetData.push([today])
  worksheetData.push([]) // Empty row
  worksheetData.push(['NO', ...headers.map(h => h.toUpperCase())])
  
  // Add data rows
  data.forEach((row, index) => {
    const formattedRow = headers.map((header) => {
      const value = row[header] !== undefined ? row[header] : ''
      // Format currency values
      if (currencyColumns.includes(headers.indexOf(header)) && typeof value === 'number') {
        return value
      }
      return value
    })
    worksheetData.push([index + 1, ...formattedRow])
  })

  // Add total row
  if (includeTotal && data.length > 0) {
    const totalRow = ['TOTAL']
    headers.forEach((header, index) => {
      if (currencyColumns.includes(index) || numberColumns.includes(index)) {
        const sum = data.reduce((acc, row) => {
          const value = parseFloat(row[header]) || 0
          return acc + value
        }, 0)
        totalRow.push(sum)
      } else {
        totalRow.push('')
      }
    })
    worksheetData.push(totalRow)
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 }, // No column
    ...headers.map(() => ({ wch: 12 })) // Default width for all columns
  ]

  // Apply minimal but compatible styling
  const range = XLSX.utils.decode_range(worksheet['!ref'])
  
  // Only apply basic styling that's widely supported
  for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum })
      if (!worksheet[cellAddress]) continue

      // Basic cell structure
      if (!worksheet[cellAddress].s) {
        worksheet[cellAddress].s = {}
      }

      // Apply basic borders to all cells
      worksheet[cellAddress].s.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }

      // Style header row (row 3) with blue background
      if (rowNum === 3) {
        worksheet[cellAddress].s.fill = {
          patternType: "solid",
          fgColor: { rgb: "366092" } // Darker blue for compatibility
        }
        worksheet[cellAddress].s.font = { 
          bold: true,
          color: { rgb: "FFFFFF" }
        }
      }
      
      // Currency formatting
      if (colNum > 0 && currencyColumns.includes(colNum - 1) && typeof worksheet[cellAddress].v === 'number') {
        worksheet[cellAddress].z = `"${currency}" #,##0`
      }
    }
  }

  // Merge title and date rows
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: range.e.c } }
  ]

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  // Write file with specific options for better compatibility
  XLSX.writeFile(workbook, fileName || `${sheetName.replace(/\s+/g, '_')}.xlsx`, {
    bookType: 'xlsx',
    type: 'binary'
  })
  
  return workbook
}

// Utility function to create styled Excel workbook with professional formatting
export const createStyledExcelWorkbook = ({
  title,
  headers,
  data,
  sheetName = 'Report',
  fileName,
  currency = 'Rp',
  currencyColumns = [],
  numberColumns = [],
  includeTotal = true
}) => {
  // Create date string for header
  const today = new Date().toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  }).toUpperCase()

  // Prepare data for worksheet
  const worksheetData = []
  
  // Add title and date rows
  worksheetData.push([title.toUpperCase()])
  worksheetData.push([`${today}`])
  worksheetData.push([]) // Empty row for spacing
  
  // Add headers with No column
  worksheetData.push(['NO', ...headers.map(h => h.toUpperCase())])
  
  // Add data rows with row numbers
  data.forEach((row, index) => {
    const formattedRow = headers.map((header) => {
      const value = row[header] !== undefined ? row[header] : ''
      return value
    })
    
    worksheetData.push([index + 1, ...formattedRow])
  })

  // Add total row if requested
  if (includeTotal && data.length > 0) {
    const totalRow = ['TOTAL']
    
    headers.forEach((header, index) => {
      if (currencyColumns.includes(index) || numberColumns.includes(index)) {
        // Calculate sum for numeric columns
        const sum = data.reduce((acc, row) => {
          const value = parseFloat(row[header]) || 0
          return acc + value
        }, 0)
        totalRow.push(sum)
      } else {
        totalRow.push('')
      }
    })
    
    worksheetData.push(totalRow)
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
  
  // Set column widths
  const colWidths = [
    { wch: 5 }, // No column
    ...headers.map((header) => {
      if (header.toLowerCase().includes('tanggal') || header.toLowerCase().includes('date')) return { wch: 12 }
      if (header.toLowerCase().includes('nama') || header.toLowerCase().includes('pengirim') || header.toLowerCase().includes('penerima')) return { wch: 15 }
      if (header.toLowerCase().includes('awb') || header.toLowerCase().includes('no')) return { wch: 15 }
      if (header.toLowerCase().includes('kota') || header.toLowerCase().includes('tujuan')) return { wch: 12 }
      if (header.toLowerCase().includes('ongkir') || header.toLowerCase().includes('total') || header.toLowerCase().includes('biaya')) return { wch: 12 }
      return { wch: 10 }
    })
  ]
  worksheet['!cols'] = colWidths

  // Apply styling - Using more compatible XLSX styling approach
  const range = XLSX.utils.decode_range(worksheet['!ref'])
  const totalRowIndex = includeTotal ? range.e.r : -1
  
  for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum })
      if (!worksheet[cellAddress]) continue

      // Ensure cell has proper structure
      if (!worksheet[cellAddress].s) {
        worksheet[cellAddress].s = {}
      }

      // Base style with borders for ALL cells
      worksheet[cellAddress].s = {
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" }
        },
        alignment: { 
          horizontal: "center",
          vertical: "center",
          wrapText: true
        }
      }

      // Style title row (row 0)
      if (rowNum === 0) {
        worksheet[cellAddress].s.font = { 
          bold: true, 
          sz: 14,
          color: { rgb: "FFFFFF" }
        }
        worksheet[cellAddress].s.fill = {
          patternType: "solid",
          fgColor: { rgb: "1F4E79" }
        }
      }
      
      // Style date row (row 1) 
      else if (rowNum === 1) {
        worksheet[cellAddress].s.font = { 
          bold: true,
          sz: 11
        }
        worksheet[cellAddress].s.fill = {
          patternType: "solid",
          fgColor: { rgb: "D9E2F3" }
        }
      }
      
      // Style header row (row 3) - THIS IS THE MAIN HEADER ROW
      else if (rowNum === 3) {
        worksheet[cellAddress].s.font = { 
          bold: true,
          color: { rgb: "FFFFFF" }
        }
        worksheet[cellAddress].s.fill = {
          patternType: "solid",
          fgColor: { rgb: "4472C4" } // Blue header background
        }
        worksheet[cellAddress].s.border = {
          top: { style: "medium" },
          bottom: { style: "medium" },
          left: { style: "medium" },
          right: { style: "medium" }
        }
      }
      
      // Style total row
      else if (rowNum === totalRowIndex) {
        worksheet[cellAddress].s.font = { 
          bold: true
        }
        worksheet[cellAddress].s.fill = {
          patternType: "solid",
          fgColor: { rgb: "FFE699" }
        }
        
        // Right align numbers in total row
        if (colNum > 0 && (currencyColumns.includes(colNum - 1) || numberColumns.includes(colNum - 1))) {
          worksheet[cellAddress].s.alignment = { 
            horizontal: "right",
            vertical: "center"
          }
          
          if (currencyColumns.includes(colNum - 1) && typeof worksheet[cellAddress].v === 'number') {
            worksheet[cellAddress].z = `"${currency}" #,##0`
          }
        }
      }
      
      // Style data rows
      else if (rowNum > 3 && rowNum !== totalRowIndex) {
        // Alternate row colors
        if (rowNum % 2 === 0) {
          worksheet[cellAddress].s.fill = {
            patternType: "solid",
            fgColor: { rgb: "F2F2F2" }
          }
        } else {
          worksheet[cellAddress].s.fill = {
            patternType: "solid",
            fgColor: { rgb: "FFFFFF" }
          }
        }
        
        // Right align numbers and currency (skip first column which is row number)
        if (colNum > 0 && (currencyColumns.includes(colNum - 1) || numberColumns.includes(colNum - 1))) {
          worksheet[cellAddress].s.alignment = { 
            horizontal: "right",
            vertical: "center"
          }
          
          // Format currency
          if (currencyColumns.includes(colNum - 1) && typeof worksheet[cellAddress].v === 'number') {
            worksheet[cellAddress].z = `"${currency}" #,##0`
          }
        }
        
        // Left align text
        else if (colNum > 0) {
          worksheet[cellAddress].s.alignment = { 
            horizontal: "left",
            vertical: "center"
          }
        }
      }
    }
  }

  // Merge title cells
  if (range.e.c > 0) {
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }, // Title row
      { s: { r: 1, c: 0 }, e: { r: 1, c: range.e.c } }  // Date row
    ]
  }

  // Create workbook and add worksheet
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  // Set workbook properties for better Excel compatibility
  workbook.Props = {
    Title: title,
    Subject: 'Export Report',
    Author: 'Branch System',
    CreatedDate: new Date()
  }
  
  // Use writeFileXLSX for better styling support
  try {
    XLSX.writeFileXLSX(workbook, fileName || `${sheetName.toLowerCase().replace(/\s+/g, '_')}.xlsx`)
  } catch (error) {
    // Fallback to regular writeFile if writeFileXLSX is not available
    console.warn('writeFileXLSX failed, falling back to writeFile:', error);
    XLSX.writeFile(workbook, fileName || `${sheetName.toLowerCase().replace(/\s+/g, '_')}.xlsx`)
  }
  
  return workbook
}

// Enhanced helper function for OTTY OFFICIAL export (matching the screenshot exactly)
export const createOttyOfficialExport = (data, dateRange = '') => {
  const headers = [
    'NO AWB',
    'TANGGAL', 
    'KOTA TUJUAN',
    'PENGIRIM',
    'PENERIMA',
    'ONGKIR',
    'KG',
    'BIAYA LAIN LAIN',
    'TOTAL ONGKIR'
  ]

  const formattedData = data.map(item => ({
    'NO AWB': item.awb_no || '',
    'TANGGAL': item.tanggal || item.awb_date || '',
    'KOTA TUJUAN': item.kota_tujuan || '',
    'PENGIRIM': item.nama_pengirim || item.pengirim || '',
    'PENERIMA': item.nama_penerima || item.penerima || '',
    'ONGKIR': item.ongkir || item.harga_per_kg || item.biaya_ongkir || 0,
    'KG': item.berat_kg || item.kg || 0,
    'BIAYA LAIN LAIN': (item.biaya_admin || 0) + (item.biaya_packaging || 0),
    'TOTAL ONGKIR': item.total || 0
  }))

  // Use specific date range in title if provided
  const title = dateRange ? `OTTY OFFICIAL - ${dateRange}` : 'OTTY OFFICIAL'

  return createStyledExcelWorkbook({
    title,
    headers,
    data: formattedData,
    sheetName: 'OTTY OFFICIAL',
    fileName: `OTTY_OFFICIAL_${dateRange || new Date().toISOString().split('T')[0]}.xlsx`,
    currency: 'Rp',
    currencyColumns: [5, 7, 8], // ONGKIR, BIAYA LAIN LAIN, TOTAL ONGKIR
    numberColumns: [6], // KG
    includeTotal: true
  })
}

/**
 * Create styled Excel with HTML approach for guaranteed styling
 * @param {Object} options - Export options
 * @param {string} options.title - Report title
 * @param {string[]} options.headers - Column headers
 * @param {Object[]} options.data - Data array
 * @param {string} options.fileName - Output filename
 * @param {string} options.currency - Currency symbol
 * @param {number[]} options.currencyColumns - Currency column indices
 * @param {number[]} options.numberColumns - Number column indices  
 * @param {string} options.dateRange - Date range string
 * @param {boolean} options.hideSummary - When true, omit RINGKASAN LAPORAN section
 */
export const createStyledExcelWithHTML = ({
  title,
  headers,
  data,
  fileName,
  currency = 'Rp',
  currencyColumns = [],
  numberColumns = [],
  dateRange = '',
  hideSummary = false // when true, omit the RINGKASAN LAPORAN and total-revenue footer
}) => {
  // Format date range to dd-mm-yyyy if it contains dates
  const formatDateRange = (range) => {
    if (!range) return ''
    
    // Convert YYYY-MM-DD format to DD-MM-YYYY
    return range.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3-$2-$1')
  }

  const formattedDateRange = formatDateRange(dateRange)

  // Calculate summary data for premium display
  const totalRecords = data.length
  const totalColi = data.reduce((sum, item) => sum + (parseInt(item['Coli']) || 0), 0)
  const totalKg = data.reduce((sum, item) => sum + (parseFloat(item['Weight (Kg)']) || parseFloat(item['Kg']) || 0), 0)
  const totalTransit = data.reduce((sum, item) => sum + (parseFloat(item['Transit']) || 0), 0)
  const totalCash = data.reduce((sum, item) => sum + (parseFloat(item['Cash']) || 0), 0)
  const totalTransfer = data.reduce((sum, item) => sum + (parseFloat(item['Transfer']) || 0), 0)
  const totalCOD = data.reduce((sum, item) => sum + (parseFloat(item['COD']) || 0), 0)
  
  // For Outstanding Report - calculate additional totals
  const totalOngkir = data.reduce((sum, item) => sum + (parseFloat(item['Rate/Ongkir']) || parseFloat(item['Harga (Ongkir)']) || 0), 0)
  const totalAdmin = data.reduce((sum, item) => sum + (parseFloat(item['Admin Fee']) || parseFloat(item['Admin']) || 0), 0)
  const totalPacking = data.reduce((sum, item) => sum + (parseFloat(item['Packaging']) || 0), 0)
  const totalOngkirTotal = data.reduce((sum, item) => sum + (parseFloat(item['Total Ongkir']) || parseFloat(item['Total']) || 0), 0)
  
  const grandTotal = totalCash + totalTransfer + totalCOD + totalOngkirTotal
  const avgPerAWB = totalRecords > 0 ? Math.round(grandTotal / totalRecords) : 0

  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: Arial, sans-serif;
            border: 3px solid #000;
          }
          .company-header { 
            background-color: #1e40af; 
            color: white; 
            font-weight: bold; 
            font-size: 16px; 
            text-align: left; 
            padding: 10px; 
            border: 2px solid #000;
          }
          .company-tagline { 
            background-color: #dbeafe; 
            font-weight: bold; 
            font-size: 10px;
            text-align: left; 
            padding: 6px 10px; 
            border: 2px solid #000;
            color: #1e40af;
          }
          .document-info { 
            background-color: #f8fafc; 
            font-size: 9px;
            text-align: right; 
            padding: 6px 10px; 
            border: 1px solid #000;
            color: #475569;
          }
          .title { 
            background-color: #1e40af; 
            color: white; 
            font-weight: bold; 
            font-size: 14px; 
            text-align: center; 
            padding: 8px; 
            border: 2px solid #000;
          }
          .date-range { 
            background-color: #dbeafe; 
            font-weight: bold; 
            text-align: center; 
            padding: 6px; 
            border: 2px solid #000;
            color: #1e40af;
          }
          .header { 
            background-color: #3b82f6; 
            color: white; 
            font-weight: bold; 
            text-align: center; 
            padding: 8px 4px; 
            border: 2px solid #000;
            font-size: 8px;
          }
          .data { 
            border: 1px solid #000; 
            padding: 6px 4px; 
            text-align: left;
            font-size: 8px;
          }
          .data.number { 
            text-align: right;
            border: 1px solid #000;
          }
          .data.currency { 
            text-align: right;
            border: 1px solid #000;
          }
          .data.center { 
            text-align: center;
            border: 1px solid #000;
          }
          .awb-cell {
            background-color: #eff6ff;
            font-weight: bold;
            color: #1e40af;
            border: 1px solid #3b82f6;
          }
          .alt-row { 
            background-color: #f8fafc;
          }
          .summary-title { 
            background-color: #1e40af; 
            color: white; 
            font-weight: bold; 
            font-size: 12px; 
            text-align: center; 
            padding: 8px; 
            border: 2px solid #000;
          }
          .summary-item { 
            background-color: #eff6ff; 
            font-weight: bold; 
            font-size: 9px;
            text-align: center; 
            padding: 6px; 
            border: 1px solid #000;
            color: #1e40af;
          }
          .summary-value { 
            background-color: #ffffff; 
            font-weight: bold; 
            font-size: 9px;
            text-align: center; 
            padding: 6px; 
            border: 1px solid #000;
            color: #1f2937;
          }
          .total-row { 
            background-color: #fef3c7; 
            font-weight: bold; 
            border: 2px solid #000; 
            padding: 6px 4px;
            text-align: center;
            font-size: 9px;
            color: #92400e;
          }
          .total-row.number { 
            text-align: right;
            border: 2px solid #000;
          }
          .total-row.currency { 
            text-align: right;
            border: 2px solid #000;
          }
          /* Ensure all td and th elements have borders */
          td, th {
            border: 1px solid #000 !important;
          }
        </style>
      </head>
      <body>
        <table>
          <!-- Company Header -->
          <tr><td colspan="${headers.length + 1}" class="company-header">BCE EXPRESS</td></tr>
          <tr><td colspan="${headers.length + 1}" class="company-tagline">BETTER CARGO EXPERIENCE</td></tr>
          <tr><td colspan="${headers.length + 1}" class="document-info">Document ID: DR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()} | Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td></tr>
          
          <!-- Title and Date Range -->
          <tr><td colspan="${headers.length + 1}" class="title">${title.toUpperCase()}</td></tr>
          ${formattedDateRange ? `<tr><td colspan="${headers.length + 1}" class="date-range">PERIODE: ${formattedDateRange}</td></tr>` : ''}
          <tr><td colspan="${headers.length + 1}" style="border: 1px solid #000; padding: 3px; background: #f9f9f9;"></td></tr>
          
          <!-- Data Table Headers -->
          <tr>
            <td class="header">NO</td>
            ${headers.map(h => `<td class="header">${h.toUpperCase()}</td>`).join('')}
          </tr>
  `

  data.forEach((row, index) => {
    const isAlt = (index + 1) % 2 === 0
    html += `<tr>`
    html += `<td class="data center${isAlt ? ' alt-row' : ''}" style="border: 1px solid #000;">${index + 1}</td>`
    
    headers.forEach((header, colIndex) => {
      const value = row[header] !== undefined ? row[header] : ''
      const isNumber = numberColumns.includes(colIndex)
      const isCurrency = currencyColumns.includes(colIndex)
      
      let formattedValue = value
      let cellClass = `data${isAlt ? ' alt-row' : ''}`
      
      if (header === 'AWB Number') {
        cellClass += ' awb-cell center'
      } else if (header === 'Date') {
        cellClass += ' center'
      } else if (isCurrency && typeof value === 'number' && value > 0) {
        formattedValue = `${currency} ${value.toLocaleString('id-ID')}`
        cellClass += ' currency'
      } else if (isNumber) {
        cellClass += ' number'
        formattedValue = typeof value === 'number' ? value.toLocaleString('id-ID') : value
      }
      
      html += `<td class="${cellClass}" style="border: 1px solid #000;">${formattedValue || '-'}</td>`
    })
    
    html += `</tr>`
  })

  // Add total row
  html += `<tr>`
  html += `<td class="total-row" style="border: 2px solid #000;">TOTAL</td>`
  
  headers.forEach((header, index) => {
    if (currencyColumns.includes(index) || numberColumns.includes(index)) {
      const sum = data.reduce((acc, row) => {
        const value = parseFloat(row[header]) || 0
        return acc + value
      }, 0)
      const formattedSum = currencyColumns.includes(index) ? `${currency} ${sum.toLocaleString('id-ID')}` : sum.toLocaleString('id-ID')
      const cellClass = currencyColumns.includes(index) ? 'total-row currency' : 'total-row number'
      html += `<td class="${cellClass}" style="border: 2px solid #000;">${formattedSum}</td>`
    } else {
      html += `<td class="total-row" style="border: 2px solid #000;"></td>`
    }
  })
  
  html += `</tr>`
  
  // Add summary section and total-revenue footer unless caller requested it hidden
  if (!hideSummary) {
    // Detect report type based on headers
    const isOutstandingReport = headers.includes('Total Ongkir') && headers.includes('Rate/Ongkir')
    const isRecapManifest = headers.includes('Total Payment') && headers.includes('Total AWB')
    const isSalesReport = headers.includes('Harga (Ongkir)') && headers.includes('AWB (awb_no)')

    html += `
          <tr><td colspan="${headers.length + 1}" style="border: 1px solid #000; padding: 8px; background: #f9f9f9;"></td></tr>
          <tr><td colspan="${headers.length + 1}" class="summary-title">RINGKASAN LAPORAN</td></tr>`

    if (isOutstandingReport) {
      // Outstanding Report Summary
      html += `
          <tr>
            <td class="summary-item">Total Shipments</td>
            <td class="summary-value">${totalRecords} AWB</td>
            <td class="summary-item">Total Weight</td>
            <td class="summary-value">${totalKg.toLocaleString('id-ID')} kg</td>
            <td class="summary-item">Total Rate/Ongkir</td>
            <td class="summary-value">Rp ${totalOngkir.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Admin</td>
            <td class="summary-value">Rp ${totalAdmin.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Packing</td>
            <td class="summary-value">Rp ${totalPacking.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Transit</td>
          </tr>
          <tr>
            <td class="summary-value">Rp ${totalTransit.toLocaleString('id-ID')}</td>
            <td class="summary-item">Grand Total</td>
            <td class="summary-value">Rp ${totalOngkirTotal.toLocaleString('id-ID')}</td>
            <td colspan="${headers.length - 2}"></td>
          </tr>`
    } else if (isRecapManifest) {
      // Recap Manifest Summary
      html += `
          <tr>
            <td class="summary-item">Total Records</td>
            <td class="summary-value">${totalRecords} Days</td>
            <td class="summary-item">Total Coli</td>
            <td class="summary-value">${totalColi.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Weight</td>
            <td class="summary-value">${totalKg.toLocaleString('id-ID')} kg</td>
            <td class="summary-item">Total Cash</td>
            <td class="summary-value">Rp ${totalCash.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td class="summary-item">Total Transfer</td>
            <td class="summary-value">Rp ${totalTransfer.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total COD</td>
            <td class="summary-value">Rp ${totalCOD.toLocaleString('id-ID')}</td>
            <td class="summary-item">Grand Total</td>
            <td class="summary-value">Rp ${grandTotal.toLocaleString('id-ID')}</td>
            <td colspan="${headers.length - 5}"></td>
          </tr>`
    } else if (isSalesReport) {
      // Sales Report Summary
      html += `
          <tr>
            <td class="summary-item">Total Shipments</td>
            <td class="summary-value">${totalRecords} AWB</td>
            <td class="summary-item">Total Weight</td>
            <td class="summary-value">${totalKg.toLocaleString('id-ID')} kg</td>
            <td class="summary-item">Total Ongkir</td>
            <td class="summary-value">Rp ${totalOngkir.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Admin</td>
            <td class="summary-value">Rp ${totalAdmin.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Packaging</td>
            <td class="summary-value">Rp ${totalPacking.toLocaleString('id-ID')}</td>
            <td class="summary-item">Grand Total</td>
          </tr>
          <tr>
            <td class="summary-value">Rp ${totalOngkirTotal.toLocaleString('id-ID')}</td>
            <td colspan="${headers.length}"></td>
          </tr>`
    } else {
      // Daily Report Summary
      html += `
          <tr>
            <td class="summary-item">Total Shipments</td>
            <td class="summary-value">${totalRecords} AWB</td>
            <td class="summary-item">Total Coli</td>
            <td class="summary-value">${totalColi.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Weight</td>
            <td class="summary-value">${totalKg.toLocaleString('id-ID')} kg</td>
            <td class="summary-item">Total Transit</td>
            <td class="summary-value">Rp ${totalTransit.toLocaleString('id-ID')}</td>
            ${headers.length > 8 ? `<td class="summary-item">Total Cash</td><td class="summary-value">Rp ${totalCash.toLocaleString('id-ID')}</td>` : ''}
            ${headers.length > 10 ? `<td class="summary-item">Total Transfer</td><td class="summary-value">Rp ${totalTransfer.toLocaleString('id-ID')}</td>` : ''}
            ${headers.length > 12 ? `<td class="summary-item">Total COD</td><td class="summary-value">Rp ${totalCOD.toLocaleString('id-ID')}</td>` : ''}
            ${headers.length > 14 ? `<td class="summary-item">Avg/AWB</td><td class="summary-value">Rp ${avgPerAWB.toLocaleString('id-ID')}</td>` : ''}
          </tr>
          ${headers.length <= 8 ? `
          <tr>
            <td class="summary-item">Total Cash</td>
            <td class="summary-value">Rp ${totalCash.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total Transfer</td>
            <td class="summary-value">Rp ${totalTransfer.toLocaleString('id-ID')}</td>
            <td class="summary-item">Total COD</td>
            <td class="summary-value">Rp ${totalCOD.toLocaleString('id-ID')}</td>
            <td class="summary-item">Avg/AWB</td>
            <td class="summary-value">Rp ${avgPerAWB.toLocaleString('id-ID')}</td>
          </tr>
          ` : ''}
          `
    }

    // Total Revenue section
    let displayTotal = grandTotal
    let totalLabel = "TOTAL REVENUE"

    if (isOutstandingReport) {
      displayTotal = totalOngkirTotal
      totalLabel = "TOTAL OUTSTANDING"
    } else if (isRecapManifest) {
      displayTotal = grandTotal // Already calculated as totalCash + totalTransfer + totalCOD
      totalLabel = "TOTAL REVENUE"
    } else if (isSalesReport) {
      displayTotal = totalOngkirTotal // For sales report, use the total from all individual totals
      totalLabel = "TOTAL SALES"
    }

    html += `<tr><td colspan="${headers.length + 1}" class="summary-title" style="background: #1e40af; font-size: 14px;">${totalLabel}: Rp ${displayTotal.toLocaleString('id-ID')}</td></tr>
        </table>
      </body>
    </html>`
  } else {
    // Caller requested no summary: just close the table/html
    html += `
        </table>
      </body>
    </html>`
  }
  
  // Create blob and download
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'export.xls'
  a.click()
  URL.revokeObjectURL(url)
  
  return html
} 