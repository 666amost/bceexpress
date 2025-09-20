"use client"

import React, { useState, useEffect } from 'react'

type Result = {
  harga_per_kg: number
  berat: number
  subtotal: number
  adminFee: number
  total: number
}

type Origin = { code: string; label: string }
type Destination = { code: string; label: string; pricePerKg: number }
type DestinationGroup = { name: string; items: Destination[] }

type CekOngkirProps = {
  variant?: 'card' | 'embedded'
}

export function CekOngkir({ variant = 'card' }: CekOngkirProps) {
  const [open, setOpen] = useState(false)
  const [origins, setOrigins] = useState<Origin[]>([])
  const [destinationsByOrigin, setDestinationsByOrigin] = useState<Record<string, Destination[]>>({})
  const [groupsByOrigin, setGroupsByOrigin] = useState<Record<string, DestinationGroup[]>>({})
  const [origin, setOrigin] = useState<string>('')
  const [destination, setDestination] = useState<string>('')
  const [transitsByDestination, setTransitsByDestination] = useState<Record<string, { code: string; label: string; fee: number }[]>>({})
  const [transitCode, setTransitCode] = useState<string>('')
  const [berat, setBerat] = useState<number>(1)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/rates').then(r => r.json()).then(j => {
      if (j.success) {
        setOrigins(j.data.origins)
        setDestinationsByOrigin(j.data.destinations)
        setGroupsByOrigin(j.data.groups)
        setTransitsByDestination(j.data.transits)
      }
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setResult(null); setLoading(true)
    try {
  const payload = { origin, destinationCode: destination, berat_kg: berat, transitCode: transitCode || undefined }
      const res = await fetch('/api/cek-ongkir', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!json.success) setError(json.error || 'Unknown error')
      else setResult(json.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally { setLoading(false) }
  }

  const destinationGroups = origin ? (groupsByOrigin[origin] || []) : []

  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    variant === 'embedded' ? (
      <div className="w-full">{children}</div>
    ) : (
      <div className="w-full mx-auto bg-card rounded-lg shadow p-4 md:p-6">{children}</div>
    )
  )

  return (
    <Container>
      <button className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xl md:text-2xl font-semibold">Cek Ongkos Kirim</div>
            <div className="text-sm md:text-base text-muted-foreground">Estimasi Biaya Pengiriman</div>
          </div>
          <div className="text-2xl md:text-3xl">{open ? '−' : '›'}</div>
        </div>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-sm md:text-base font-medium mb-1">Dari *</label>
              <select 
                value={origin} 
                onChange={e => { setOrigin(e.target.value); setDestination(''); }} 
                className="w-full p-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                required
              >
                <option value="">Tolong Pilih</option>
                {origins.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm md:text-base font-medium mb-1">Ke *</label>
              <select 
                value={destination} 
                onChange={e => setDestination(e.target.value)} 
                className="w-full p-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                required 
                disabled={!origin}
              >
                <option value="">Tolong Pilih</option>
                {destinationGroups.map(group => (
                  <optgroup key={group.name} label={group.name}>
                    {group.items.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Transit (optional) appears if destination has transit options */}
          {destination && (transitsByDestination[destination]?.length || 0) > 0 && (
            <div className="flex flex-col">
              <label className="text-sm md:text-base font-medium mb-1">Transit (opsional)</label>
              <select 
                value={transitCode} 
                onChange={e => setTransitCode(e.target.value)} 
                className="w-full p-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="">Tidak ada transit</option>
                {transitsByDestination[destination].map(t => (
                  <option key={t.code} value={t.code}>{t.label} (+Rp {t.fee.toLocaleString('id-ID')})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-sm md:text-base font-medium mb-1">Berat Paket (kg) *</label>
            <input 
              type="number" 
              min={0.1} 
              step={0.1} 
              value={String(berat)} 
              onChange={e => setBerat(Number(e.target.value))} 
              className="w-full p-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
            />
          </div>

          <div className="flex justify-end mt-2">
            <button 
              disabled={loading} 
              className="bg-primary text-white py-3 px-6 rounded-lg font-semibold text-base md:text-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-70"
            >
              {loading ? 'Menghitung...' : 'Kalkulasi'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="mt-4 text-sm md:text-base text-red-600 p-3 bg-red-50 rounded-lg">{error}</div>}

      {result && (
        <div className="mt-4 bg-muted p-4 md:p-5 rounded-lg shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            <div className="text-sm md:text-base">Harga / kg: <span className="font-medium">Rp {result.harga_per_kg.toLocaleString('id-ID')}</span></div>
            <div className="text-sm md:text-base">Berat (kg): <span className="font-medium">{result.berat}</span></div>
            <div className="text-sm md:text-base">Subtotal: <span className="font-medium">Rp {result.subtotal.toLocaleString('id-ID')}</span></div>
            <div className="text-sm md:text-base">Admin Fee: <span className="font-medium">Rp {result.adminFee.toLocaleString('id-ID')}</span></div>
            <div className="col-span-1 md:col-span-2 text-base md:text-lg font-bold mt-2 pt-2 border-t">
              Total: Rp {result.total.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

export default CekOngkir
