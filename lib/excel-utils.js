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
 */
export const createStyledExcelWithHTML = ({
  title,
  headers,
  data,
  fileName,
  currency = 'Rp',
  currencyColumns = [],
  numberColumns = [],
  dateRange = ''
}) => {
  // Format date range to dd-mm-yyyy if it contains dates
  const formatDateRange = (range) => {
    if (!range) return ''
    
    // Convert YYYY-MM-DD format to DD-MM-YYYY
    return range.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3-$2-$1')
  }

  const formattedDateRange = formatDateRange(dateRange)

  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: Arial, sans-serif;
            border: 2px solid #000;
          }
          .title { 
            background-color: #1F4E79; 
            color: white; 
            font-weight: bold; 
            font-size: 14px; 
            text-align: center; 
            padding: 8px; 
            border: 2px solid #000;
          }
          .date { 
            background-color: #D9E2F3; 
            font-weight: bold; 
            text-align: center; 
            padding: 6px; 
            border: 2px solid #000;
          }
          .header { 
            background-color: #4472C4; 
            color: white; 
            font-weight: bold; 
            text-align: center; 
            padding: 6px; 
            border: 2px solid #000;
          }
          .data { 
            border: 1px solid #000; 
            padding: 4px; 
            text-align: left;
          }
          .data.number { 
            text-align: right;
            border: 1px solid #000;
          }
          .data.currency { 
            text-align: right;
            border: 1px solid #000;
          }
          .total { 
            background-color: #FFE699; 
            font-weight: bold; 
            border: 2px solid #000; 
            padding: 4px;
            text-align: center;
          }
          .total.number { 
            text-align: right;
            border: 2px solid #000;
          }
          .total.currency { 
            text-align: right;
            border: 2px solid #000;
          }
          .alt-row { 
            background-color: #F2F2F2;
          }
          /* Ensure all td and th elements have borders */
          td, th {
            border: 1px solid #000 !important;
          }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="${headers.length + 1}" class="title">${title.toUpperCase()}</td></tr>
          ${formattedDateRange ? `<tr><td colspan="${headers.length + 1}" class="date">${formattedDateRange}</td></tr>` : ''}
          <tr><td colspan="${headers.length + 1}" style="border: 1px solid #000; padding: 2px;"></td></tr>
          <tr>
            <td class="header">NO</td>
            ${headers.map(h => `<td class="header">${h.toUpperCase()}</td>`).join('')}
          </tr>
  `

  data.forEach((row, index) => {
    const isAlt = (index + 4) % 2 === 0 // Offset by 4 because of title, date, empty, header rows
    html += `<tr>`
    html += `<td class="data${isAlt ? ' alt-row' : ''}" style="text-align: center; border: 1px solid #000;">${index + 1}</td>`
    
    headers.forEach((header, colIndex) => {
      const value = row[header] !== undefined ? row[header] : ''
      const isNumber = numberColumns.includes(colIndex)
      const isCurrency = currencyColumns.includes(colIndex)
      
      let formattedValue = value
      if (isCurrency && typeof value === 'number') {
        formattedValue = `${currency} ${value.toLocaleString()}`
      }
      
      const cellClass = `data${isAlt ? ' alt-row' : ''}${isNumber ? ' number' : ''}${isCurrency ? ' currency' : ''}`
      html += `<td class="${cellClass}" style="border: 1px solid #000;">${formattedValue}</td>`
    })
    
    html += `</tr>`
  })

  // Add total row
  html += `<tr>`
  html += `<td class="total" style="border: 2px solid #000;">TOTAL</td>`
  
  headers.forEach((header, index) => {
    if (currencyColumns.includes(index) || numberColumns.includes(index)) {
      const sum = data.reduce((acc, row) => {
        const value = parseFloat(row[header]) || 0
        return acc + value
      }, 0)
      const formattedSum = currencyColumns.includes(index) ? `${currency} ${sum.toLocaleString()}` : sum.toLocaleString()
      const cellClass = currencyColumns.includes(index) ? 'total currency' : 'total number'
      html += `<td class="${cellClass}" style="border: 2px solid #000;">${formattedSum}</td>`
    } else {
      html += `<td class="total" style="border: 2px solid #000;"></td>`
    }
  })
  
  html += `</tr>`
  html += `</table></body></html>`

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