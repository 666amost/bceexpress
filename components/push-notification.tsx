"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseClient } from "@/lib/auth";
import { Bell, X } from 'lucide-react';

interface NotificationData {
  id: string;
  awb_number: string;
  message: string;
  courier_id: string;
  created_at: string;
  is_read: boolean;
}

interface PushNotificationProps {
  userId: string;
}

export function PushNotification({ userId }: PushNotificationProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await supabaseClient
        .from('courier_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      // Remove from state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  useEffect(() => {
    // Setup realtime subscription untuk notifications
    const channel = supabaseClient
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'courier_notifications',
          filter: `courier_id=eq.${userId}`
        },
        (payload) => {
          const newNotification = payload.new as NotificationData;
          
          // Tambahkan notifikasi baru ke state
          setNotifications(prev => [newNotification, ...prev]);
          
          // Show notification slide in
          setIsVisible(true);
          
          // Auto hide after 8 seconds
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            
            // Mark as read after hiding
            setTimeout(() => {
              markAsRead(newNotification.id);
            }, 500);
          }, 6000); // Ubah dari 8000ms ke 6000ms (6 detik)
        }
      )
      .subscribe();

    // Load existing unread notifications
    const loadUnreadNotifications = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('courier_notifications')
          .select('*')
          .eq('courier_id', userId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setNotifications(data);
          if (data.length > 0) {
            setIsVisible(true);
            
            // Auto hide the latest notification after 8 seconds
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = setTimeout(() => {
              setIsVisible(false);
              // Mark latest as read
              setTimeout(() => {
                if (data[0]) {
                  markAsRead(data[0].id);
                }
              }, 500);
            }, 6000); // Ubah dari 8000ms ke 6000ms (6 detik)
          }
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadUnreadNotifications();

    return () => {
      supabaseClient.removeChannel(channel);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userId, markAsRead]);

  const loadUnreadNotifications = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('courier_notifications')
        .select('*')
        .eq('courier_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
        if (data.length > 0) {
          setIsVisible(true);
          
          // Auto hide the latest notification after 8 seconds
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            // Mark latest as read
            setTimeout(() => {
              if (data[0]) {
                markAsRead(data[0].id);
              }
            }, 500);
          }, 8000);
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    
    // Mark the current visible notification as read
    setTimeout(() => {
      if (notifications.length > 0) {
        markAsRead(notifications[0].id);
      }
    }, 500);
  };

  // Don't render if no notifications
  if (notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[0];

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 transform transition-transform duration-500 ease-out ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg border-b-4 border-red-800">
        <div className="px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="bg-white/20 rounded-full p-1.5 sm:p-2 flex-shrink-0">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs sm:text-sm text-red-200">
                  URGENT
                </div>
                <div className="text-white/90 text-xs sm:text-sm truncate">
                   RESI {currentNotification.awb_number} Minta segera diantar
                </div>
              </div>
            </div>
            
            <button
              onClick={handleDismiss}
              className="bg-white/20 hover:bg-white/30 rounded-full p-1 sm:p-1.5 transition-colors flex-shrink-0 ml-2"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
            </button>
          </div>
          
          {/* Progress bar untuk auto-dismiss - Mobile optimized */}
          <div className="mt-1.5 sm:mt-2 w-full bg-white/20 rounded-full h-0.5 sm:h-1 overflow-hidden">
            <div 
              className="h-full bg-white transition-all ease-linear"
              style={{
                width: isVisible ? '0%' : '100%',
                transform: isVisible ? 'translateX(-100%)' : 'translateX(0%)',
                transitionDuration: '6000ms'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
