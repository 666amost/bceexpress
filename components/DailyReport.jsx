"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabaseClient } from "../lib/auth"
import { createStyledExcelWithHTML } from "../lib/excel-utils"
import { getEnhancedAgentList, doesAgentMatch, getAllAgentIdentifiers } from "../lib/agent-mapping"
import { baseAgentListBangka, baseAgentListTanjungPandan, baseAgentListCentral } from "../lib/agents"
import { areaCodeData, areaCodes, normalizeKecamatan } from '@/lib/area-codes';

// Simplified utility function for total verification
const calculateTotalBreakdown = (data) => {
  const totalCash = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cash')
    .reduce((sum, item) => sum + (item.total || 0), 0);
  const totalTransfer = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'transfer')
    .reduce((sum, item) => sum + (item.total || 0), 0);
  const totalCOD = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cod')
    .reduce((sum, item) => sum + (item.total || 0), 0);
  const grandTotal = data.reduce((sum, item) => sum + (item.total || 0), 0);
  
  // Check if there's a discrepancy between payment methods sum and grand total
  const paymentSum = totalCash + totalTransfer + totalCOD;
  const hasMismatch = Math.abs(paymentSum - grandTotal) > 0.01;
  
  return {
    totalCash,
    totalTransfer,
    totalCOD,
    grandTotal,
    paymentSum,
    difference: Math.abs(grandTotal - paymentSum),
    hasMismatch
  };
};

export default function DailyReport({ userRole, branchOrigin }) {
  // ================== BRANCH / ROLE SWITCH ==================
  const BRANCH_USING_CABANG_TABLE = ["bangka", "tanjung_pandan"]; // tambah branch lain bila perlu
  // normalize branchOrigin for consistent comparisons / DB queries
  const normalizedBranchOrigin = (branchOrigin || '').toString().toLowerCase().trim();
  const isBranchMode =
    (userRole === "cabang" && BRANCH_USING_CABANG_TABLE.includes(normalizedBranchOrigin)) ||
    (userRole === "admin" && BRANCH_USING_CABANG_TABLE.includes(normalizedBranchOrigin));
  // ===========================================================

  const [data, setData] = useState([])  // State untuk menyimpan data laporan
  const [unfiltered, setUnfiltered] = useState([]) // State untuk menyimpan data tanpa filter (untuk verifikasi)
  const [selectedDateFrom, setSelectedDateFrom] = useState("") // State baru untuk filter tanggal Dari
  const [selectedDateTo, setSelectedDateTo] = useState("") // State baru untuk filter tanggal Sampai
  const [tempDateFrom, setTempDateFrom] = useState("") // Temporary state untuk input tanggal Dari
  const [tempDateTo, setTempDateTo] = useState("") // Temporary state untuk input tanggal Sampai
  const [selectedKirimVia, setSelectedKirimVia] = useState("")  // State untuk filter kirim via
  const [selectedAgentCustomer, setSelectedAgentCustomer] = useState("")  // State untuk filter Agent/Customer
  const [selectedKotaTujuan, setSelectedKotaTujuan] = useState("")  // State baru untuk filter kota tujuan
  const [selectedWilayah, setSelectedWilayah] = useState("")
  const [selectedAreaCode, setSelectedAreaCode] = useState("")  // State baru untuk filter area code (GLC/KMY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isDefaultView, setIsDefaultView] = useState(true) // State untuk mendeteksi apakah menggunakan view default atau filtered
  
  // ================== VERIFICATION STATES ==================
  const [verificationActive, setVerificationActive] = useState(false) // Toggle untuk verifikasi data
  const [isVerifying, setIsVerifying] = useState(false) // Status sedang memverifikasi
  const [paymentBreakdown, setPaymentBreakdown] = useState(null) // Payment breakdown and difference check
  const [awbVerification, setAwbVerification] = useState(null) // AWB verification across area codes
  const [showMissingAwb, setShowMissingAwb] = useState(false) // toggle detail list of missing AWB
  const [highlightedAwbs, setHighlightedAwbs] = useState(new Set()) // AWBs to highlight in table

  // ================== LISTS ==================

  // ...existing code...

  // Helper: map a row to an area code using normalized kecamatan/wilayah, with fallback to kota_tujuan
  const getAreaCode = useCallback((item) => {
    if (!item) return undefined;
    const raw = (item.kecamatan || item.wilayah || "").trim();
    const norm = normalizeKecamatan(raw);
    let code = norm ? areaCodes[norm] : undefined;
    if (code === 'GLC' || code === 'KMY') return code;
    const kt = (item.kota_tujuan || '').trim();
    if (kt) {
      const ktNorm = normalizeKecamatan(kt);
      const byKota = ktNorm ? areaCodes[ktNorm] : undefined;
      if (byKota === 'GLC' || byKota === 'KMY') return byKota;
    }
    // additional loose fallback for common variants
    const up = raw.toUpperCase();
    if (up.includes('TELUK NAGA') || up === 'TELUKNAGA') return 'GLC';
    return undefined;
  }, []);

  // Helper: compute AWB verification (GLC + KMY vs total) from an unfiltered dataset
  const computeAwbVerification = useCallback((rows) => {
    if (!rows || rows.length === 0) return { total: 0, glc: 0, kmy: 0, unknownCount: 0, unknownList: [], diff: 0, ok: true };

    // de-duplicate by awb_no (prefer latest awb_date)
    const byAwb = new Map();
    rows.forEach((item) => {
      if (!item) return;
      const key = item.awb_no || JSON.stringify(item);
      const existing = byAwb.get(key);
      if (!existing) byAwb.set(key, item);
      else {
        const existingDate = new Date(existing.awb_date || 0);
        const itemDate = new Date(item.awb_date || 0);
        if (itemDate > existingDate) byAwb.set(key, item);
      }
    });

    let glc = 0;
    let kmy = 0;
    const unknownList = [];

    for (const item of byAwb.values()) {
      const raw = (item.kecamatan || item.wilayah || '').trim();
      const code = getAreaCode(item); // 'GLC' | 'KMY' | undefined
      if (code === 'GLC') glc += 1;
      else if (code === 'KMY') kmy += 1;
      else unknownList.push({ awb_no: item.awb_no, wilayah: raw });
    }

    const total = byAwb.size;
    const classified = glc + kmy;
    const diff = total - classified;
    return { total, glc, kmy, unknownCount: unknownList.length, unknownList, diff, ok: diff === 0 };
  }, [getAreaCode]);

  // Fetch function must be defined after all dependencies
  const fetchDailyReport = useCallback(async () => {
    setLoading(true)
    setError("")
    // Reset verification results when fetching new data
    setPaymentBreakdown(null)
    setAwbVerification(null)
    
    // Check if any filter is applied
    const hasFilters = selectedDateFrom || selectedDateTo || selectedKirimVia || 
                      selectedAgentCustomer || selectedKotaTujuan || selectedWilayah || selectedAreaCode;
    
    setIsDefaultView(!hasFilters);
    
    try {
      // builder to create main query; includeAreaCode: whether to apply area code filter
      const createQuery = (includeAreaCode = true) => {
        let q;
        if (isBranchMode) {
          q = supabaseClient
            .from("manifest_cabang")
            .select("*")
            .eq('origin_branch', normalizedBranchOrigin)
            .order("awb_date", { ascending: false })
        } else {
          q = supabaseClient
            .from("manifest")
            .select("*")
            .order("awb_date", { ascending: false })
        }

        // If no filters are applied, only show last 1 day for performance
        if (!hasFilters) {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayIso = yesterday.toISOString().split('T')[0] // YYYY-MM-DD
          q = q.gte("awb_date", yesterdayIso)
        } else {
          // Apply date range filter only if filters are applied
          if (selectedDateFrom && selectedDateTo) {
            q = q.gte("awb_date", selectedDateFrom).lte("awb_date", selectedDateTo)
          } else if (selectedDateFrom) {
            q = q.gte("awb_date", selectedDateFrom)
          } else if (selectedDateTo) {
            q = q.lte("awb_date", selectedDateTo)
          }
        }

        if (selectedKirimVia) q = q.ilike("kirim_via", selectedKirimVia)
        if (selectedKotaTujuan) q = q.eq("kota_tujuan", selectedKotaTujuan)
        if (selectedWilayah) {
          if (isBranchMode) {
            q = q.or(`kecamatan.eq.${selectedWilayah},wilayah.eq.${selectedWilayah}`)
          } else {
            q = q.eq("wilayah", selectedWilayah)
          }
        }
        if (includeAreaCode && selectedAreaCode && isBranchMode) {
          const areaWilayahList = areaCodeData[selectedAreaCode] || []
          if (areaWilayahList.length > 0) {
            const orConditions = []
            for (const area of areaWilayahList) {
              orConditions.push(`kecamatan.ilike.%${area}%`)
              orConditions.push(`wilayah.ilike.%${area}%`)
            }
            if (orConditions.length > 0) q = q.or(orConditions.join(','))
          }
        }
        return q
      }

      // decide if we need an unfiltered (no area code) dataset for AWB verification
      const needUnfiltered = isBranchMode && (verificationActive || !!selectedAreaCode)

      if (selectedAgentCustomer) {
        // Build a base query factory for agent filter. Toggle area code inclusion via param.
        const buildBaseQuery = (includeAreaCode = true) => createQuery(includeAreaCode)

        // Get identifiers from mapping util (agent name + mapped emails)
        const agentIdentifiers = getAllAgentIdentifiers(selectedAgentCustomer || "")
        const emailsOnly = agentIdentifiers.filter(id => id && id.includes("@"));

        // Run targeted queries: one for emails (exact match via .in) and one for name partial match (.ilike)
        const promises = [];
        const promisesNoArea = [];

        if (emailsOnly.length > 0) {
          // Use .in which accepts an array
          const qEmail = buildBaseQuery(true).in('agent_customer', emailsOnly)
          promises.push(qEmail)
          if (needUnfiltered) {
            const qEmailNoArea = buildBaseQuery(false).in('agent_customer', emailsOnly)
            promisesNoArea.push(qEmailNoArea)
          }
        }

        // Name-based partial match
        const qName = buildBaseQuery(true).ilike('agent_customer', `%${selectedAgentCustomer}%`)
        promises.push(qName)
        if (needUnfiltered) {
          const qNameNoArea = buildBaseQuery(false).ilike('agent_customer', `%${selectedAgentCustomer}%`)
          promisesNoArea.push(qNameNoArea)
        }

        // Execute all queries and merge deduplicated results
        const results = await Promise.all(promises.map(p => p))
        const resultsNoArea = needUnfiltered ? await Promise.all(promisesNoArea.map(p => p)) : []
        // results are objects like { data, error } when awaited via supabase client
        const combined = []
        for (const r of results) {
          if (r && r.data) combined.push(...r.data)
        }
        const combinedNoArea = []
        for (const r of resultsNoArea) {
          if (r && r.data) combinedNoArea.push(...r.data)
        }

        // Deduplicate by awb_no (prefer latest by awb_date)
        const byAwb = new Map()
        combined.forEach(item => {
          if (!item) return
          const key = item.awb_no || JSON.stringify(item)
          const existing = byAwb.get(key)
          if (!existing) byAwb.set(key, item)
          else {
            // keep the one with later awb_date
            const existingDate = new Date(existing.awb_date || 0)
            const itemDate = new Date(item.awb_date || 0)
            if (itemDate > existingDate) byAwb.set(key, item)
          }
        })
        const byAwbNoArea = new Map()
        combinedNoArea.forEach(item => {
          if (!item) return
          const key = item.awb_no || JSON.stringify(item)
          const existing = byAwbNoArea.get(key)
          if (!existing) byAwbNoArea.set(key, item)
          else {
            const existingDate = new Date(existing.awb_date || 0)
            const itemDate = new Date(item.awb_date || 0)
            if (itemDate > existingDate) byAwbNoArea.set(key, item)
          }
        })

        // Convert back to array and sort by awb_date desc
        const merged = Array.from(byAwb.values()).sort((a, b) => new Date(b.awb_date) - new Date(a.awb_date))
        const mergedNoArea = Array.from(byAwbNoArea.values()).sort((a, b) => new Date(b.awb_date) - new Date(a.awb_date))

        // When Area Code is selected, apply the same client-side classification
        let finalRows = merged || []
        if (isBranchMode && selectedAreaCode) {
          const target = selectedAreaCode === 'BCE GLC' ? 'GLC' : 'KMY'
          const base = [
            ...(Array.isArray(mergedNoArea) ? mergedNoArea : []),
            ...(Array.isArray(merged) ? merged : [])
          ]
          const filtered = base.filter((item) => getAreaCode(item) === target)
          const by = new Map()
          for (const item of filtered) {
            const key = item.awb_no || JSON.stringify(item)
            const ex = by.get(key)
            if (!ex) by.set(key, item)
            else {
              const exd = new Date(ex.awb_date || 0)
              const it = new Date(item.awb_date || 0)
              if (it > exd) by.set(key, item)
            }
          }
          finalRows = Array.from(by.values()).sort((a, b) => new Date(b.awb_date) - new Date(a.awb_date))
        }

        // Set data and skip the normal single-query path below
        setData(finalRows)
        if (needUnfiltered) setUnfiltered(mergedNoArea || [])
        if (needUnfiltered && isBranchMode) setAwbVerification(computeAwbVerification(mergedNoArea || []))
        // Payment breakdown should reflect the table rows
        setPaymentBreakdown(calculateTotalBreakdown(finalRows))
        setLoading(false)
        return
      }
      // Run main query and (optionally) unfiltered query in parallel
      const mainQ = createQuery(true)
      const noAreaQ = needUnfiltered ? createQuery(false) : null
      const [mainRes, noAreaRes] = await Promise.all([
        mainQ,
        noAreaQ ? noAreaQ : Promise.resolve({ data: null, error: null })
      ])
      const fetchedData = mainRes?.data
      const fetchError = mainRes?.error
      const unfilteredData = noAreaRes?.data || null

      if (fetchError) {
        setError(`Error fetching data: ${fetchError.message}`)
      } else {
        // If user selected Area Code, align the table strictly with client-side classification
        if (isBranchMode && selectedAreaCode) {
          // Merge both datasets to avoid miss from server filtering differences
          const base = [
            ...(Array.isArray(unfilteredData) ? unfilteredData : []),
            ...(Array.isArray(fetchedData) ? fetchedData : [])
          ]
          const target = selectedAreaCode === 'BCE GLC' ? 'GLC' : 'KMY'
          // filter by normalized kecamatan/wilayah mapping
          const filtered = base.filter((item) => getAreaCode(item) === target)
          // de-duplicate by awb_no and keep latest by awb_date
          const byAwb = new Map()
          filtered.forEach((item) => {
            const key = item.awb_no || JSON.stringify(item)
            const existing = byAwb.get(key)
            if (!existing) byAwb.set(key, item)
            else {
              const existingDate = new Date(existing.awb_date || 0)
              const itemDate = new Date(item.awb_date || 0)
              if (itemDate > existingDate) byAwb.set(key, item)
            }
          })
          const finalRows = Array.from(byAwb.values()).sort((a, b) => new Date(b.awb_date) - new Date(a.awb_date))
          setData(finalRows)
        } else {
          setData(fetchedData || [])
        }
        if (needUnfiltered) setUnfiltered(unfilteredData || [])
        
        // Always calculate payment breakdown for display
        const breakdown = calculateTotalBreakdown((isBranchMode && selectedAreaCode)
          ? ([
              ...(Array.isArray(unfilteredData) ? unfilteredData : []),
              ...(Array.isArray(fetchedData) ? fetchedData : [])
            ].filter((item) => getAreaCode(item) === (selectedAreaCode === 'BCE GLC' ? 'GLC' : 'KMY')))
          : (fetchedData || []));
        setPaymentBreakdown(breakdown);
        if (needUnfiltered && isBranchMode) {
          setAwbVerification(computeAwbVerification(unfilteredData || []))
        }
        
        // Additional verification steps if needed
        if (verificationActive && isBranchMode && normalizedBranchOrigin === 'bangka') {
          setIsVerifying(true)
          // Any additional verification logic can go here
          setIsVerifying(false)
        }
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [isBranchMode, normalizedBranchOrigin, selectedDateFrom, selectedDateTo, selectedKirimVia, selectedAgentCustomer, selectedKotaTujuan, selectedWilayah, selectedAreaCode, verificationActive, computeAwbVerification]);

  // Use centralized agent lists
  const agentList = isBranchMode
    ? (normalizedBranchOrigin === 'bangka'
        ? getEnhancedAgentList(baseAgentListBangka)
        : getEnhancedAgentList(baseAgentListTanjungPandan))
  : getEnhancedAgentList(baseAgentListCentral);

  const kotaTujuan = isBranchMode
    ? (normalizedBranchOrigin === 'bangka'
        ? ["JAKARTA BARAT", "JAKARTA PUSAT", "JAKARTA SELATAN", "JAKARTA TIMUR", "JAKARTA UTARA", "TANGERANG", "TANGERANG SELATAN", "TANGERANG KABUPATEN", "BEKASI KOTA", "BEKASI KABUPATEN", "DEPOK", "BOGOR KOTA", "BOGOR KABUPATEN"]
        : ["jakarta", "tangerang", "bekasi", "depok", "bogor"])
    : ["bangka", "kalimantan barat", "belitung", "bali"];

  const kotaWilayah = useMemo(() => {
    return isBranchMode
      ? (normalizedBranchOrigin === 'bangka'
          ? {
              "JAKARTA BARAT": ["Cengkareng", "Grogol", "Kebon jeruk", "Kali deres", "Pal merah", "Kembangan", "Taman sari", "Tambora"],
              "JAKARTA PUSAT": ["Cempaka putih", "Gambir", "Johar baru", "Kemayoran", "Menteng", "Sawah besar", "Senen", "Tanah abang"],
              "JAKARTA SELATAN": ["Cilandak", "Jagakarsa", "Kebayoran baru", "Kebayoran lama", "Mampang prapatan", "Pasar minggu", "Pesanggrahan", "Pancoran", "Setiabudi", "Tebet"],
              "JAKARTA TIMUR": ["Cakung", "Cipayung", "Ciracas", "Duren sawit", "Jatinegara", "Kramat jati", "Makasar", "Matraman", "Pasar rebo", "Pulo gadung"],
              "JAKARTA UTARA": ["Penjaringan", "Cilincing", "Kelapa gading", "Koja", "Pademangan", "Tanjung priok", "Kebon Bawang", "Papanggo", "Sungai Bambu", "Tj Priok", "Warakas", "Sunter Jaya", "Sunter Agung"],
              "TANGERANG": ["Batuceper", "Benda", "Cibodas", "Ciledug", "Cipondoh", "Jatiuwung", "Karangtengah", "Karawaci", "Larangan", "Neglasari", "Periuk", "Pinang", "Tangerang"],
              "TANGERANG SELATAN": ["Ciputat", "Ciputat Timur", "Pamulang", "Pondok Aren", "Serpong", "Serpong Utara"],
              "TANGERANG KABUPATEN": ["Kelapa Dua", "Curug", "Kosambi", "Legok", "Pagedangan", "Pasar Kemis", "Teluknaga", "Balaraja", "Cikupa", "Cisauk", "Pakuhaji", "Panongan", "Rajeg", "Sepatan", "Sepatan Timur", "Sindang Jaya", "Solear", "Tigaraksa"],
              "BEKASI KOTA": ["Bantargebang", "Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara", "Jatiasih", "Jatisampurna", "Medan Satria", "Mustikajaya", "pondokgede", "pondokmelati", "Rawalumbu"],
              "BEKASI KABUPATEN": ["Tarumajaya", "Babelan", "Cibarusah", "Cibitung", "Cikarang Barat", "Cikarang Pusat", "Cikarang Selatan", "Cikarang Timur", "Cikarang Utara", "Karangbahagia", "Kedungwaringin", "Serang Baru", "Setu", "Tambun Selatan", "Tambun Utara"],
              "DEPOK": ["Beji", "Bojongsari", "Cilodong", "Cimanggis", "Cinere", "Cipayung", "Limo", "Pancoran Mas", "Sawangan", "Sukmajaya", "Tapos"],
              "BOGOR KOTA": ["Bogor Barat", "Bogor Selatan", "Bogor Tengah", "Bogor Timur", "Bogor Utara", "Tanah Sereal"],
              "BOGOR KABUPATEN": ["Babakan Madang", "Bojonggede", "Cibinong", "Cileungsi", "Gunung Putri", "Gunung Sindur", "Citeureup", "Jonggol", "Ciomas", "Ciseeng", "Tajurhalang", "Caringin", "Dramaga", "Cariu", "Klapanunggal", "Rumpin", "Ciawi", "Tamansari"]
            }
          : {
              jakarta: ["JKT"],
              tangerang: ["TGT"],
              bekasi: ["BKS"],
              depok: ["DPK"],
              bogor: ["BGR"]
            })
      : {
          bangka: ["Pangkal Pinang", "Sungailiat", "Belinyu", "Jebus", "Koba", "Toboali", "Mentok"],
          "kalimantan barat": ["Pontianak", "Singkawang", "Sungai Pinyuh"],
          belitung: ["Tj Pandan"],
          bali: ["Denpasar"]
        };
  }, [isBranchMode, normalizedBranchOrigin]);

  const wilayahOptions = useMemo(() => {
    // Jika kedua filter dipilih: area code dan kota tujuan
    if (isBranchMode && selectedAreaCode && selectedKotaTujuan && kotaWilayah[selectedKotaTujuan]) {
      const kecamatanList = kotaWilayah[selectedKotaTujuan];
      const targetCode = selectedAreaCode === 'BCE GLC' ? 'GLC' : 'KMY';
      return kecamatanList.filter(kec => {
        const normalized = normalizeKecamatan(kec);
        return normalized && areaCodes[normalized] === targetCode;
      });
    }
    // Jika hanya area code dipilih
    if (isBranchMode && selectedAreaCode && areaCodeData[selectedAreaCode]) {
      return areaCodeData[selectedAreaCode];
    }
    // Jika hanya kota tujuan dipilih
    if (selectedKotaTujuan && kotaWilayah[selectedKotaTujuan]) {
      return kotaWilayah[selectedKotaTujuan];
    }
    // Default untuk branch mode tanpa filter area code dan kota tujuan
    if (isBranchMode && !selectedAreaCode && !selectedKotaTujuan) {
      const allAreaOptions = [...areaCodeData["BCE GLC"], ...areaCodeData["BCE KMY"]];
      return [...new Set(allAreaOptions)]; // Remove duplicates
    }
    // Default: kosong
    return [];
  }, [selectedKotaTujuan, selectedAreaCode, kotaWilayah, isBranchMode]);

  // Flag rows that contribute to payment mismatch: total > 0 but metode_pembayaran is empty/unknown
  const flaggedPaymentKeys = useMemo(() => {
    const s = new Set();
    if (!verificationActive) return s;
    const valid = new Set(['cash','transfer','cod']);
    for (const item of data) {
      const total = Number(item?.total || 0);
      const method = String(item?.metode_pembayaran || '').trim().toLowerCase();
      if (total > 0 && !valid.has(method)) {
        const key = item.awb_no || JSON.stringify(item);
        s.add(key);
      }
    }
    return s;
  }, [verificationActive, data]);

  const problematicAwbList = useMemo(() => {
    if (!verificationActive) return [];
    return data.filter((item) => {
      const key = item.awb_no || JSON.stringify(item);
      return flaggedPaymentKeys.has(key);
    }).map(item => ({
      awb_no: item.awb_no,
      awb_date: item.awb_date,
      total: item.total,
      metode_pembayaran: item.metode_pembayaran
    }));
  }, [verificationActive, data, flaggedPaymentKeys]);

  const handleHighlightProblematicAwbs = () => {
    const awbSet = new Set(problematicAwbList.map(item => item.awb_no || JSON.stringify(item)));
    setHighlightedAwbs(awbSet);
    
    if (problematicAwbList.length > 0) {
      setTimeout(() => {
        const firstAwb = problematicAwbList[0];
        const element = document.getElementById(`awb-row-${firstAwb.awb_no}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  // useEffect hook to fetch data on component mount and when filters change
  useEffect(() => {
    fetchDailyReport();
  }, [fetchDailyReport]);

  // Sync temp dates with selected dates when they change externally (like clear filters)
  useEffect(() => {
    setTempDateFrom(selectedDateFrom);
    setTempDateTo(selectedDateTo);
  }, [selectedDateFrom, selectedDateTo]);

  // Function to apply date filters
  const handleApplyDateFilter = () => {
    setSelectedDateFrom(tempDateFrom);
    setSelectedDateTo(tempDateTo);
  };

  // Function to clear all filters
  const handleClearAllFilters = () => {
    setSelectedDateFrom("");
    setSelectedDateTo("");
    setTempDateFrom("");
    setTempDateTo("");
    setSelectedKirimVia("");
    setSelectedAgentCustomer("");
    setSelectedKotaTujuan("");
    setSelectedWilayah("");
    setSelectedAreaCode("");
  };

  // Reset area code untuk central mode (non-branch)
  useEffect(() => {
    if (!isBranchMode && selectedAreaCode) {
      setSelectedAreaCode("");
    }
  }, [isBranchMode, selectedAreaCode]);

  // Reset wilayah when area code changes (hanya untuk branch mode)
  useEffect(() => {
    if (isBranchMode && selectedAreaCode) {
      setSelectedWilayah("");
      setSelectedKotaTujuan(""); // Reset kota tujuan ketika area code dipilih
    }
  }, [selectedAreaCode, isBranchMode]);

  // Reset area code when kota tujuan changes (hanya untuk branch mode)
  useEffect(() => {
    if (isBranchMode && selectedKotaTujuan) {
      setSelectedAreaCode("");
    }
  }, [selectedKotaTujuan, isBranchMode]);

  // Function to download Excel file
  const downloadXLSX = useCallback(() => {
    if (data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = [
      'AWB Number',
      'Date',
      'Sender',
      'Recipient', 
      'Coli',
      'Weight (Kg)',
      'Rate/Ongkir',
      'Admin Fee',
      'Packaging',
      'Transit',
      'Cash',
      'Transfer', 
      'COD',
      'Wilayah'
    ];

    // Format data as objects with key-value pairs matching headers
    const excelData = data.map((item) => ({
      'AWB Number': item.awb_no,
      'Date': new Date(item.awb_date).toLocaleDateString('en-GB'),
      'Sender': item.nama_pengirim,
      'Recipient': item.nama_penerima,
      'Coli': item.coli,
      'Weight (Kg)': item.berat_kg || 0,
      'Rate/Ongkir': item.harga_per_kg || item.ongkir || 0,
      'Admin Fee': item.biaya_admin || item.admin || 0,
      'Packaging': item.biaya_packaging || 0,
      'Transit': item.biaya_transit || 0,
      'Cash': (item.metode_pembayaran || '').toLowerCase() === 'cash' ? (item.total || 0) : 0,
      'Transfer': (item.metode_pembayaran || '').toLowerCase() === 'transfer' ? (item.total || 0) : 0,
      'COD': (item.metode_pembayaran || '').toLowerCase() === 'cod' ? (item.total || 0) : 0,
  // prefer kecamatan (branch mode) but fall back to wilayah
  'Wilayah': item.kecamatan || item.wilayah
    }));

    let dateRangeText = '';
    if (selectedDateFrom && selectedDateTo) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-');
      const toFormatted = selectedDateTo.split('-').reverse().join('-');
      dateRangeText = `${fromFormatted} s/d ${toFormatted}`;
    } else if (selectedDateFrom) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-');
      dateRangeText = `Dari ${fromFormatted}`;
    } else if (selectedDateTo) {
      const toFormatted = selectedDateTo.split('-').reverse().join('-');
      dateRangeText = `Sampai ${toFormatted}`;
    } else {
      dateRangeText = 'Semua Periode';
    }

    const filename = `DailyReport_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xls`;

    createStyledExcelWithHTML({
      title: 'Daily Report',
      headers,
      data: excelData,
      fileName: filename,
      currency: 'Rp',
      currencyColumns: [6, 7, 8, 9, 10, 11, 12], // Rate, Admin, Packaging, Transit, Cash, Transfer, COD columns
      numberColumns: [4, 5], // Coli and Weight columns
      dateRange: dateRangeText
    });
  }, [data, selectedDateFrom, selectedDateTo]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup diblokir. Mohon izinkan popup di browser Anda.')
      return
    }

    const totalKg = data.reduce((sum, item) => sum + (item.berat_kg || 0), 0)
    const totalAdmin = data.reduce((sum, item) => sum + (item.biaya_admin || item.admin || 0), 0)
    const totalTransit = data.reduce((sum, item) => sum + (item.biaya_transit || 0), 0)
    const totalCash = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cash').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalTransfer = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalCOD = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cod').reduce((sum, item) => sum + (item.total || 0), 0)
    const grandTotal = data.reduce((sum, item) => sum + (item.total || 0), 0)

    let dateRangeText = ''
    if (selectedDateFrom && selectedDateTo) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
      const toFormatted = selectedDateTo.split('-').reverse().join('-')
      dateRangeText = `${fromFormatted} s/d ${toFormatted}`
    } else if (selectedDateFrom) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
      dateRangeText = `Dari ${fromFormatted}`
    } else if (selectedDateTo) {
      const toFormatted = selectedDateTo.split('-').reverse().join('-')
      dateRangeText = `Sampai ${toFormatted}`
    }

    const htmlContent = generateReportHTML({
      totalKg,
      totalAdmin,
      totalTransit,
      totalCash,
      totalTransfer,
      totalCOD,
      grandTotal,
      dateRangeText,
      data,
      selectedKirimVia,
      selectedAgentCustomer,
      selectedKotaTujuan,
      selectedWilayah
    })

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.print()
  }

  const handleDownloadPDF = async () => {
    if (data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    // Dynamically import html2pdf
    const html2pdf = (await import('html2pdf.js')).default;

    const totalKg = data.reduce((sum, item) => sum + (item.berat_kg || 0), 0)
    const totalAdmin = data.reduce((sum, item) => sum + (item.biaya_admin || item.admin || 0), 0)
    const totalTransit = data.reduce((sum, item) => sum + (item.biaya_transit || 0), 0)
    const totalCash = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cash').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalTransfer = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0)
    const totalCOD = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cod').reduce((sum, item) => sum + (item.total || 0), 0)
    const grandTotal = data.reduce((sum, item) => sum + (item.total || 0), 0)

    let dateRangeText = ''
    if (selectedDateFrom && selectedDateTo) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
      const toFormatted = selectedDateTo.split('-').reverse().join('-')
      dateRangeText = `${fromFormatted} s/d ${toFormatted}`
    } else if (selectedDateFrom) {
      const fromFormatted = selectedDateFrom.split('-').reverse().join('-')
      dateRangeText = `Dari ${fromFormatted}`
    } else if (selectedDateTo) {
      const toFormatted = selectedDateTo.split('-').reverse().join('-')
      dateRangeText = `Sampai ${toFormatted}`
    } else {
      dateRangeText = 'Semua Periode'
    }

    // Create temporary element for PDF generation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = generateReportHTML({
      totalKg,
      totalAdmin,
      totalTransit,
      totalCash,
      totalTransfer,
      totalCOD,
      grandTotal,
      dateRangeText,
      data,
      selectedKirimVia,
      selectedAgentCustomer,
      selectedKotaTujuan,
      selectedWilayah
    });

    // Configure PDF options
    const opt = {
      margin: 10,
      filename: `DailyReport_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
        allowTaint: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      }
    };

    try {
      await html2pdf().set(opt).from(tempDiv).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
      document.body.removeChild(tempDiv);
    }
  }

  const generateReportHTML = ({ totalKg, totalAdmin, totalTransit, totalCash, totalTransfer, totalCOD, grandTotal, dateRangeText, data, selectedKirimVia, selectedAgentCustomer, selectedKotaTujuan, selectedWilayah }) => {
    return `
      <html>
        <head>
          <title>Daily Report</title>
          <style>
            @page { margin: 20mm; size: A4; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #1f2937; background: #ffffff; font-weight: 400; }
            .document-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 32px; }
            .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
            .company-info { display: block; }
            .company-name { display: block; font-size: 28px; font-weight: 700; color: #1e40af; letter-spacing: -0.5px; margin-bottom: 2px; }
            .company-tagline { display: block; font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; margin-top: 0; }
            .document-meta { text-align: right; color: #4b5563; font-size: 9px; line-height: 1.4; }
            .report-title-section { text-align: center; margin: 24px 0; }
            .report-title { font-size: 22px; font-weight: 600; color: #111827; margin-bottom: 8px; letter-spacing: -0.3px; }
            .report-subtitle { font-size: 12px; color: #6b7280; font-weight: 500; }
            .report-parameters { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; }
            .param-group { display: flex; gap: 24px; }
            .param-item { font-size: 10px; }
            .param-label { color: #6b7280; font-weight: 500; margin-right: 6px; }
            .param-value { color: #1f2937; font-weight: 600; }
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; background: #ffffff; border: 1px solid #e5e7eb; }
            .data-table thead th { background: #1e40af; color: #ffffff; font-weight: 600; padding: 14px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #1d4ed8; }
            .data-table thead th.text-right { text-align: right; }
            .data-table tbody td { padding: 12px 10px; border-bottom: 1px solid #f3f4f6; font-size: 9px; color: #374151; }
            .data-table tbody tr:nth-child(even) { background: #f9fafb; }
            .data-table tbody tr:hover { background: #f3f4f6; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
            .awb-number { font-weight: 600; color: #1e40af; }
            .currency { font-weight: 500; color: #374151; }
            .total-currency { font-weight: 600; color: #1e40af; }
            .summary-section { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #cbd5e1; padding: 24px; margin-top: 32px; page-break-inside: avoid; break-inside: avoid; }
            .summary-title { font-size: 14px; font-weight: 600; color: #1e40af; margin-bottom: 20px; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px; }
            .summary-item { background: #ffffff; padding: 16px; border: 1px solid #e5e7eb; text-align: center; }
            .summary-label { font-size: 9px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
            .summary-value { font-size: 12px; font-weight: 600; color: #1f2937; }
            .grand-total-section { background: #1e40af; color: #ffffff; padding: 20px; text-align: center; margin-top: 16px; }
            .grand-total-label { font-size: 11px; font-weight: 500; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; color: #bfdbfe; }
            .grand-total-value { font-size: 18px; font-weight: 700; color: #ffffff; }
            .document-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #9ca3af; }
            .footer-left { font-weight: 500; }
            .footer-right { text-align: right; }
            @media print { body { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; } .no-print { display: none !important; } .summary-section { page-break-inside: avoid !important; break-inside: avoid !important; } }
          </style>
        </head>
        <body>
          <div class="document-header">
            <div class="header-top">
              <div class="company-info">
                <div class="company-name">BCE EXPRESS</div>
                <div class="company-tagline">BETTER CARGO EXPERIENCE</div>
              </div>
              <div class="document-meta">
                <div><strong>Document ID:</strong> DR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
                <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            <div class="report-title-section">
              <div class="report-title">DAILY REPORT</div>
              <div class="report-subtitle">Laporan Pengiriman Harian</div>
            </div>
          </div>

          <div class="report-parameters">
            <div class="param-group">
              <div class="param-item"><span class="param-label">REPORTING PERIOD:</span><span class="param-value">${dateRangeText || 'ALL PERIODS'}</span></div>
              ${selectedKirimVia ? `<div class="param-item"><span class="param-label">KIRIM VIA:</span><span class="param-value">${selectedKirimVia.toUpperCase()}</span></div>` : ''}
              ${selectedAgentCustomer ? `<div class="param-item"><span class="param-label">AGENT/CUSTOMER:</span><span class="param-value">${selectedAgentCustomer.toUpperCase()}</span></div>` : ''}
              ${selectedKotaTujuan ? `<div class="param-item"><span class="param-label">KOTA TUJUAN:</span><span class="param-value">${selectedKotaTujuan.toUpperCase()}</span></div>` : ''}
              ${selectedWilayah ? `<div class="param-item"><span class="param-label">WILAYAH:</span><span class="param-value">${selectedWilayah.toUpperCase()}</span></div>` : ''}
            </div>
            <div class="param-item"><span class="param-label">TOTAL RECORDS:</span><span class="param-value">${data.length}</span></div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 3%;">#</th>
                <th style="width: 10%;">AWB NUMBER</th>
                <th style="width: 8%;">DATE</th>
                <th style="width: 12%;">SENDER</th>
                <th style="width: 12%;">RECIPIENT</th>
                <th style="width: 5%;">COLI</th>
                <th style="width: 6%;">KG</th>
                <th class="text-right" style="width: 8%;">BASE RATE</th>
                <th class="text-right" style="width: 6%;">ADMIN</th>
                <th class="text-right" style="width: 6%;">PACKAGING</th>
                <th class="text-right" style="width: 6%;">TRANSIT</th>
                <th class="text-right" style="width: 7%;">CASH</th>
                <th class="text-right" style="width: 7%;">TRANSFER</th>
                <th class="text-right" style="width: 7%;">COD</th>
                <th style="width: 6%;">WILAYAH</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr>
                  <td class="text-center font-medium">${index + 1}</td>
                  <td class="awb-number">${item.awb_no}</td>
                  <td class="font-medium">${new Date(item.awb_date).toLocaleDateString('en-GB')}</td>
                  <td>${item.nama_pengirim}</td>
                  <td>${item.nama_penerima}</td>
                  <td class="text-center font-medium">${item.coli}</td>
                  <td class="text-right font-medium">${(item.berat_kg || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.harga_per_kg || item.ongkir || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.biaya_admin || item.admin || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.biaya_packaging || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right currency">${(item.biaya_transit || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right total-currency">${(item.metode_pembayaran || '').toLowerCase() === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="text-right total-currency">${(item.metode_pembayaran || '').toLowerCase() === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="text-right total-currency">${(item.metode_pembayaran || '').toLowerCase() === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('id-ID')}` : '-'}</td>
                  <td class="font-medium">${item.kecamatan || item.wilayah}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary-section">
            <div class="summary-title">SUMMARY REPORT</div>
            <div class="summary-grid">
              <div class="summary-item"><div class="summary-label">Total Shipments</div><div class="summary-value">${data.length} AWB</div></div>
              <div class="summary-item"><div class="summary-label">Total Coli</div><div class="summary-value">${data.reduce((s,i)=>s+(i.coli||0),0).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Weight</div><div class="summary-value">${totalKg.toLocaleString('id-ID')} kg</div></div>
              <div class="summary-item"><div class="summary-label">Admin Fees</div><div class="summary-value">Rp ${(totalAdmin).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Packaging</div><div class="summary-value">Rp ${(data.reduce((s,i)=>s+(i.biaya_packaging||0),0)).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Transit Fees</div><div class="summary-value">Rp ${(totalTransit).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Cash</div><div class="summary-value">Rp ${(totalCash).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Transfer</div><div class="summary-value">Rp ${(totalTransfer).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total COD</div><div class="summary-value">Rp ${(totalCOD).toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Total Revenue</div><div class="summary-value">Rp ${grandTotal.toLocaleString('id-ID')}</div></div>
              <div class="summary-item"><div class="summary-label">Avg. per AWB</div><div class="summary-value">Rp ${data.length>0? Math.round(grandTotal/data.length).toLocaleString('id-ID'):'0'}</div></div>
              <div class="summary-item"><div class="summary-label">Processing Date</div><div class="summary-value">${new Date().toLocaleDateString('en-GB')}</div></div>
            </div>
          </div>

          <div class="document-footer">
            <div class="footer-left">
              <div>BCE EXPRESS - BUSINESS DOCUMENT</div>
              <div>This report contains business information</div>
            </div>
            <div class="footer-right">
              <div>Page 1 of 1</div>
              <div>Generated by BCE Management System v2.0</div>
            </div>
          </div>
        </body>
      </html>
    `
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">Daily Report</h2>
      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Date From:</label>
        <input 
          type="date" 
          value={tempDateFrom} 
          onChange={(e) => setTempDateFrom(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleApplyDateFilter()}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400" 
        />
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Date To:</label>
        <input 
          type="date" 
          value={tempDateTo} 
          onChange={(e) => setTempDateTo(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleApplyDateFilter()}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400" 
        />
        <button 
          onClick={handleApplyDateFilter}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Cari'}
        </button>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kirim Via:</label>
        <select value={selectedKirimVia} onChange={(e) => setSelectedKirimVia(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          <option value="udara">Udara</option>
          <option value="darat">Darat</option>
        </select>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Agent/Customer:</label>
        <input list="agent-options" value={selectedAgentCustomer} onChange={(e) => setSelectedAgentCustomer(e.target.value)} placeholder="Ketik untuk mencari agent" className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400" />
        <datalist id="agent-options">
          <option value="">Semua</option>
          {agentList.map(agent => (<option key={agent} value={agent}>{agent}</option>))}
        </datalist>
        {/* Area Code filter hanya untuk branch mode (manifest_cabang) */}
        {isBranchMode && (
          <>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Area Code:</label>
            <select value={selectedAreaCode} onChange={(e) => setSelectedAreaCode(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
              <option value="">Semua</option>
              <option value="BCE GLC">BCE GLC</option>
              <option value="BCE KMY">BCE KMY</option>
            </select>
          </>
        )}
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Kota Tujuan:</label>
        <select value={selectedKotaTujuan} onChange={(e) => setSelectedKotaTujuan(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          {kotaTujuan.map(kota => (<option key={kota} value={kota}>{kota.toUpperCase()}</option>))}
        </select>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Wilayah:</label>
        <select value={selectedWilayah} onChange={(e) => setSelectedWilayah(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400">
          <option value="">Semua</option>
          {wilayahOptions.map((w, index) => (<option key={`${w}-${index}`} value={w}>{w.toUpperCase()}</option>))}
        </select>
      </div>
      
      {/* Verifikasi Data Toggle khusus Bangka branch - Simplified */}
      {normalizedBranchOrigin === 'bangka' && isBranchMode && (
        <div className="mb-4 no-print">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={verificationActive}
              onChange={() => setVerificationActive(!verificationActive)}
              className="form-checkbox h-5 w-5 text-blue-600 dark:text-blue-400"
            />
            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Aktifkan Verifikasi (Dana & AWB)
            </span>
          </label>
          {verificationActive && (
            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
              (Memeriksa selisih total vs sumber dana)
            </span>
          )}
  </div>
      )}
      
      {/* Loading indicator untuk verifikasi */}
      {isVerifying && (
        <div className="mb-4 p-2 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded text-sm text-blue-800 dark:text-blue-300 animate-pulse no-print">
          Sedang memverifikasi data... Mohon tunggu
        </div>
      )}

      {/* Status Indicator */}
      <div className="mb-4 flex items-center gap-2 no-print">
        {loading && (
          <span className="text-blue-600 dark:text-blue-400 text-xs">Loading...</span>
        )}
        {!loading && isDefaultView && (
          <span className="text-gray-500 dark:text-gray-400 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            Showing last 1 day • Use filters to search all data
          </span>
        )}
        {!loading && !isDefaultView && (
          <span className="text-green-600 dark:text-green-400 text-xs bg-green-100 dark:bg-green-800 px-2 py-1 rounded">
            Filtering all data • Clear filters to view recent data
          </span>
        )}
      </div>

      {/* Clear Filters Button */}
      {!isDefaultView && (
        <div className="mb-4 no-print">
          <button 
            onClick={() => {
              setSelectedDateFrom("");
              setSelectedDateTo("");
              setTempDateFrom("");
              setTempDateTo("");
              setSelectedKirimVia("");
              setSelectedAgentCustomer("");
              setSelectedKotaTujuan("");
              setSelectedWilayah("");
              setSelectedAreaCode("");
              setPaymentBreakdown(null);
              setAwbVerification(null);
            }}
            className="px-3 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 text-sm transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {data.length > 0 && (
        <div className="mb-4 flex justify-end no-print">
          <button onClick={downloadXLSX} className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 mr-2 transition-colors">Download XLSX</button>
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-800 mr-2 transition-colors">Download PDF</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800 transition-colors">Print</button>
        </div>
      )}

      {error && <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">{error}</div>}
      {loading ? (
        <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto w-full bg-white dark:bg-gray-800 rounded shadow sm:overflow-visible border border-gray-200 dark:border-gray-700">
            {verificationActive && paymentBreakdown && paymentBreakdown.hasMismatch && (
              <div className="mb-2 p-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded flex justify-between items-center">
                <span>
                  Baris yang ditandai menandakan total &gt; 0 namun metode pembayaran kosong/unknown. Perbaiki metode pembayaran pada baris tersebut.
                </span>
                {highlightedAwbs.size > 0 && (
                  <button
                    onClick={() => setHighlightedAwbs(new Set())}
                    className="ml-2 px-2 py-1 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-800 text-xs transition-colors"
                  >
                    Hapus Highlight
                  </button>
                )}
              </div>
            )}
            <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-blue-50 dark:bg-blue-900/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">No</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">AWB (No Resi)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Pengirim</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Penerima</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Coli</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Kg</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Harga(Ongkir)</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Admin</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Packaging</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Transit</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Cash</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">Transfer</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">COD</th>
                  <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">Wilayah</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => {
                  const rowKey = item.awb_no || `item-${index}`;
                  const isFlagged = flaggedPaymentKeys.has(item.awb_no || JSON.stringify(item));
                  const isHighlighted = highlightedAwbs.has(item.awb_no || JSON.stringify(item));
                  return (
                  <tr 
                    key={rowKey} 
                    id={`awb-row-${item.awb_no}`}
                    className={`
                      ${isFlagged ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'even:bg-gray-50 dark:even:bg-gray-700'} 
                      ${isHighlighted ? 'ring-2 ring-red-500 dark:ring-red-400' : ''}
                      hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors
                    `}
                  >
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{index + 1}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                      {item.awb_no}
                      {isFlagged && (
                        <span className="ml-2 inline-block text-[10px] px-2 py-0.5 rounded bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100 align-middle">Belum isi metode</span>
                      )}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.nama_pengirim}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.nama_penerima}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.coli}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.berat_kg}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.harga_per_kg || item.ongkir}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_admin || item.admin || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_packaging || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.biaya_transit || 0}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{(item.metode_pembayaran || '').toLowerCase() === 'cash' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{(item.metode_pembayaran || '').toLowerCase() === 'transfer' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100">{(item.metode_pembayaran || '').toLowerCase() === 'cod' ? `Rp. ${(item.total || 0).toLocaleString('en-US')}` : 'Rp. 0'}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{item.kecamatan || item.wilayah}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {data.length > 0 && (
            <div className={`mt-4 p-4 rounded border ${
              paymentBreakdown && paymentBreakdown.hasMismatch && verificationActive
              ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800" 
              : "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800"
            }`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Total Keseluruhan:
                  {verificationActive && paymentBreakdown && !paymentBreakdown.hasMismatch && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded">
                      ✓ Terverifikasi
                    </span>
                  )}
                </h3>
              </div>
              <p className="text-gray-800 dark:text-gray-200">Total Kg: {data.reduce((sum, item) => sum + (item.berat_kg || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Admin: Rp. {data.reduce((sum, item) => sum + (item.biaya_admin || item.admin || 0), 0).toLocaleString('en-US')}</p>
              <p className="text-gray-800 dark:text-gray-200">Total Transit: Rp. {data.reduce((sum, item) => sum + (item.biaya_transit || 0), 0).toLocaleString('en-US')}</p>
              
              {/* Payment method totals */}
              {/* Always show sumber dana */}
              <div className="mb-2">
                <div className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Sumber Dana:</div>
                <div className="pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                  <p className="text-gray-800 dark:text-gray-200">
                    Total Cash: Rp. {data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cash').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}
                  </p>
                  <p className="text-gray-800 dark:text-gray-200">
                    Total Transfer: Rp. {data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'transfer').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}
                  </p>
                  <p className="text-gray-800 dark:text-gray-200">
                    Total COD: Rp. {data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cod').reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}
                  </p>
                </div>
              </div>
              
              {/* Display total with explanation of where it comes from */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className={`font-semibold ${
                  paymentBreakdown && paymentBreakdown.hasMismatch && verificationActive
                  ? "text-red-800 dark:text-red-300" 
                  : "text-gray-900 dark:text-gray-100"
                }`}>
                  Total Semua: Rp. {data.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('en-US')}
                </p>
                
                {/* Tampilkan selisih hanya saat verifikasi aktif */}
                {verificationActive && (() => {
                  const totalCash = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cash')
                    .reduce((sum, item) => sum + (item.total || 0), 0);
                  const totalTransfer = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'transfer')
                    .reduce((sum, item) => sum + (item.total || 0), 0);
                  const totalCOD = data.filter(item => (item.metode_pembayaran || '').toLowerCase() === 'cod')
                    .reduce((sum, item) => sum + (item.total || 0), 0);
                  const sumPayments = totalCash + totalTransfer + totalCOD;
                  const grandTotal = data.reduce((sum, item) => sum + (item.total || 0), 0);
                  const difference = Math.abs(grandTotal - sumPayments);
                  
                  if (difference > 0.01) {
                    return (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                        <p className="text-yellow-800 dark:text-yellow-300 font-medium">
                          {grandTotal > sumPayments 
                            ? `Ada Rp. ${difference.toLocaleString('en-US')} yang tidak tercatat di sumber dana (Cash/Transfer/COD).` 
                            : `Sumber dana (Cash+Transfer+COD) melebihi total sebesar Rp. ${difference.toLocaleString('en-US')}.`
                          }
                          {problematicAwbList.length > 0 && (
                            <span className="ml-2">
                              ({problematicAwbList.length} AWB bermasalah)
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-gray-600 dark:text-gray-400">
                          Mohon periksa pembayaran yang tercatat untuk memastikan semua transaksi memiliki metode pembayaran yang benar.
                        </p>
                        {problematicAwbList.length > 0 && (
                          <button
                            onClick={handleHighlightProblematicAwbs}
                            className="mt-2 px-3 py-1 bg-yellow-600 dark:bg-yellow-700 text-white rounded hover:bg-yellow-700 dark:hover:bg-yellow-800 text-xs transition-colors"
                          >
                            Tampilkan AWB Bermasalah di Tabel
                          </button>
                        )}
                      </div>
                    )
                  }
                  return null;
                })()}
                {/* AWB Verification (GLC+KMY should equal total). Uses unfiltered dataset without area code restriction. */}
                {isBranchMode && verificationActive && awbVerification && (
                  <div className={`mt-3 p-3 rounded border ${awbVerification.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'}`}>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Verifikasi AWB per Area Code:</span>
                      <span className="text-gray-800 dark:text-gray-200">Total (tanpa filter Area): {awbVerification.total} AWB</span>
                      <span className="text-blue-800 dark:text-blue-300">GLC: {awbVerification.glc}</span>
                      <span className="text-purple-800 dark:text-purple-300">KMY: {awbVerification.kmy}</span>
                      {!awbVerification.ok && (
                        <span className="text-red-800 dark:text-red-300 font-medium">Selisih: {awbVerification.diff} AWB tidak terklasifikasi</span>
                      )}
                      {awbVerification.ok && (
                        <span className="text-green-700 dark:text-green-300 font-medium">✓ Konsisten</span>
                      )}
                    </div>
                    {!awbVerification.ok && (
                      <div className="mt-2">
                        <button
                          onClick={() => setShowMissingAwb(v => !v)}
                          className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700"
                        >
                          {showMissingAwb ? 'Sembunyikan daftar AWB hilang' : 'Tampilkan AWB hilang'}
                        </button>
                        {showMissingAwb && (
                          <div className="mt-2 max-h-40 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                            <table className="min-w-full text-xs">
                              <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                  <th className="px-2 py-1 text-left border border-gray-200 dark:border-gray-600">AWB</th>
                                  <th className="px-2 py-1 text-left border border-gray-200 dark:border-gray-600">Wilayah/Kecamatan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {awbVerification.unknownList.map((u, idx) => (
                                  <tr key={`${u.awb_no}-${idx}`} className="even:bg-gray-50 dark:even:bg-gray-700">
                                    <td className="px-2 py-1 border border-gray-200 dark:border-gray-600">{u.awb_no}</td>
                                    <td className="px-2 py-1 border border-gray-200 dark:border-gray-600">{u.wilayah || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          Catatan: AWB di atas tidak muncul saat filter "BCE GLC" atau "BCE KMY" karena wilayah/kecamatan belum terpetakan ke Area Code. Tambahkan mapping di file area-codes.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
