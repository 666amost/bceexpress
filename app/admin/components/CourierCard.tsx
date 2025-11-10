import React from 'react';
import { UserMultiple as UserMultipleIcon, Box as BoxIcon, WarningFilled as WarningIcon, CheckmarkFilled as CheckmarkIcon } from '@carbon/icons-react';

interface CourierCardProps {
  courier: {
    id: string;
    name: string;
    email: string;
  };
  stats: {
    total: number;
    pending: number;
    completed: number;
  };
  isSelected: boolean;
  isHighPriority: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export function CourierCard({ courier, stats, isSelected, isHighPriority, onClick, onDoubleClick }: CourierCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-4 transition-all duration-300 cursor-pointer hover:shadow-xl ${
        isSelected 
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400" 
          : isHighPriority
          ? "border-red-300 dark:border-red-500"
          : "border-blue-100 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500"
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-full ${
          isHighPriority
          ? 'bg-red-100 dark:bg-red-900/30'
          : 'bg-blue-100 dark:bg-blue-900/30'
        } flex items-center justify-center`}>
          <UserMultipleIcon className={`h-6 w-6 ${
            isHighPriority
            ? 'text-red-600 dark:text-red-400'
            : 'text-blue-600 dark:text-blue-400'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-blue-900 dark:text-white truncate">
            {courier.name}
            {isHighPriority && (
              <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200">
                Priority
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{courier.email}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2">
          <BoxIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
          <span className="text-base font-bold text-blue-900 dark:text-blue-100 block">{stats.total}</span>
          <span className="text-xs text-gray-600 dark:text-gray-300">Total</span>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-2">
          <WarningIcon className="h-4 w-4 text-red-600 dark:text-red-400 mx-auto mb-1" />
          <span className="text-base font-bold text-red-600 dark:text-red-100 block">{stats.pending}</span>
          <span className="text-xs text-gray-600 dark:text-gray-300">Pending</span>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2">
          <CheckmarkIcon className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
          <span className="text-base font-bold text-green-600 dark:text-green-100 block">{stats.completed}</span>
          <span className="text-xs text-gray-600 dark:text-gray-300">Done</span>
        </div>
      </div>
    </div>
  );
}
