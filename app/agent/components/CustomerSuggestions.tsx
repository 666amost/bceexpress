"use client"

import React, { useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FaUser, FaPhone, FaMapMarkerAlt, FaClock } from 'react-icons/fa';

interface CustomerHistory {
  nama_pengirim: string;
  nomor_pengirim: string;
  nama_penerima: string;
  nomor_penerima: string;
  alamat_penerima: string;
  kota_tujuan: string;
  kecamatan: string;
  isi_barang: string;
  lastUsed: string;
  frequency: number;
}

interface CustomerSuggestionsProps {
  suggestions: CustomerHistory[];
  onSelect: (customer: CustomerHistory) => void;
  onClose: () => void;
}

export const CustomerSuggestions: React.FC<CustomerSuggestionsProps> = ({
  suggestions,
  onSelect,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (suggestions.length === 0) return null;

  const formatLastUsed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  return (
    <div ref={containerRef} className="absolute top-full left-0 right-0 z-50 mt-1">
      <Card className="shadow-lg border-2 border-blue-200">
        <CardContent className="p-0">
          <div className="max-h-60 overflow-y-auto">
            {suggestions.map((customer, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start p-4 h-auto border-b border-gray-100 hover:bg-blue-50"
                onClick={() => onSelect(customer)}
              >
                <div className="flex flex-col space-y-2 text-left w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FaUser className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-gray-900">
                        {customer.nama_pengirim}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <FaClock className="h-3 w-3" />
                      {formatLastUsed(customer.lastUsed)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FaPhone className="h-3 w-3" />
                    {customer.nomor_pengirim}
                  </div>
                  
                  {customer.nama_penerima && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Last sent to:</span> {customer.nama_penerima}
                    </div>
                  )}
                  
                  {customer.kota_tujuan && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FaMapMarkerAlt className="h-3 w-3" />
                      {customer.kota_tujuan}
                      {customer.kecamatan && `, ${customer.kecamatan}`}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    {customer.isi_barang && (
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">
                        {customer.isi_barang}
                      </div>
                    )}
                    
                    <div className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                      Used {customer.frequency} time{customer.frequency > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
          
          <div className="p-3 border-t bg-gray-50">
            <div className="text-xs text-gray-500 text-center">
              Click on a customer to auto-fill the form
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
