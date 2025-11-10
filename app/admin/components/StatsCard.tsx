import React from 'react';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  onClick?: () => void;
}

export function StatsCard({ title, value, subtitle, icon: Icon, gradient, onClick }: StatsCardProps) {
  return (
    <div 
      className={`${gradient} rounded-xl sm:rounded-2xl shadow-lg border p-3 sm:p-4 lg:p-6 text-center hover:shadow-xl transition-all duration-300 hover:scale-105 aspect-square flex flex-col justify-center ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-white" />
      </div>
      <span className="text-xs sm:text-sm font-bold text-white block mb-1">{title}</span>
      <span className="text-xl sm:text-2xl lg:text-4xl font-black text-white">{value}</span>
      {subtitle && <span className="text-xs text-white/80 block mt-1">{subtitle}</span>}
    </div>
  );
}
