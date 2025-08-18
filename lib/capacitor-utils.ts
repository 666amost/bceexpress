/**
 * Capacitor Utils - lib/capacitor-utils.ts
 * Utility untuk handle Capacitor iframe context
 */

// Type definitions for Capacitor
interface CapacitorWindow extends Window {
  Capacitor?: object;
}

interface MessageData {
  type: string;
  reason?: string;
  error?: string;
  [key: string]: unknown;
}

// Detect if running inside Capacitor webview
export function isInCapacitor(): boolean {
  try {
    // Check if we're in an iframe and parent has Capacitor
    return !!(
      typeof window !== 'undefined' &&
      window.parent !== window && 
      (window.parent as CapacitorWindow).Capacitor
    );
  } catch (e) {
    return false;
  }
}

// Send message to parent Capacitor container
export function sendMessageToCapacitor(type: string, data?: Partial<MessageData>): void {
  if (isInCapacitor()) {
    console.warn('Sending message to Capacitor:', type, data);
    try {
      window.parent.postMessage({
        type,
        ...data
      } as MessageData, '*');
    } catch (e) {
      console.error('Failed to send message to Capacitor:', e);
    }
  }
}

// Handle logout for Capacitor context
export async function handleCapacitorLogout(signOutFn: () => Promise<unknown>): Promise<void> {
  try {
    console.warn('Handling Capacitor logout...');
    
    // Perform actual logout
    await signOutFn();
    
    // Clear local storage immediately
    localStorage.removeItem('courierCredentials');
    localStorage.removeItem('cachedSession');
    
    // Clear all Supabase auth data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('supabase.auth.') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });
    
    // Send logout message to parent
    sendMessageToCapacitor('COURIER_LOGOUT', {
      reason: 'user_action'
    });
    
    console.warn('Capacitor logout completed');
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if logout fails, notify parent and clear storage
    localStorage.removeItem('courierCredentials');
    localStorage.removeItem('cachedSession');
    
    sendMessageToCapacitor('COURIER_LOGOUT', {
      reason: 'logout_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle login success for Capacitor context  
export function handleCapacitorLoginSuccess(): void {
  if (isInCapacitor()) {
    console.warn('Handling Capacitor login success...');
    
    // Save session indicator
    localStorage.setItem('cachedSession', 'true');
    
    // Notify parent of successful login
    sendMessageToCapacitor('COURIER_LOGIN_SUCCESS');
  }
}
