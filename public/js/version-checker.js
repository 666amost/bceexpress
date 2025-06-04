/**
 * Version Checker untuk Auto Update Aplikasi Median
 * Mengecek versi setiap 2 hari sekali
 */

// Konfigurasi
const VERSION_CHECK_CONFIG = {
  // Interval check: 2 hari = 2 * 24 * 60 * 60 * 1000 ms
  CHECK_INTERVAL: 2 * 24 * 60 * 60 * 1000, // 172800000 ms (2 hari)
  
  // Storage keys
  STORAGE_KEYS: {
    CURRENT_VERSION: 'app_current_version',
    LAST_CHECK_TIME: 'app_last_check_time',
    UPDATE_AVAILABLE: 'app_update_available'
  },
  
  // API endpoint
  VERSION_API: '/api/version'
};

class VersionChecker {
  constructor() {
    this.currentVersion = localStorage.getItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.CURRENT_VERSION);
    this.lastCheckTime = localStorage.getItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.LAST_CHECK_TIME);
    this.updateAvailable = localStorage.getItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.UPDATE_AVAILABLE) === 'true';
    
    this.init();
  }
  
  init() {
    console.log('Version Checker initialized');
    
    // Cek apakah sudah waktunya untuk check version
    if (this.shouldCheckVersion()) {
      this.checkVersion();
    }
    
    // Set interval untuk check berkala setiap 2 hari
    setInterval(() => {
      this.checkVersion();
    }, VERSION_CHECK_CONFIG.CHECK_INTERVAL);
    
    // Jika ada update yang pending, tampilkan notifikasi
    if (this.updateAvailable) {
      this.showUpdateNotification();
    }
  }
  
  shouldCheckVersion() {
    if (!this.lastCheckTime) {
      return true; // Belum pernah check
    }
    
    const now = Date.now();
    const lastCheck = parseInt(this.lastCheckTime);
    const timeDiff = now - lastCheck;
    
    // Check jika sudah lebih dari 2 hari sejak check terakhir
    return timeDiff >= VERSION_CHECK_CONFIG.CHECK_INTERVAL;
  }
  
  async checkVersion() {
    try {
      console.log('Checking for app updates...');
      
      const response = await fetch(VERSION_CHECK_CONFIG.VERSION_API, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const latestVersion = data.version;
      
      // Update last check time
      localStorage.setItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.LAST_CHECK_TIME, Date.now().toString());
      
      if (!this.currentVersion) {
        // Pertama kali, simpan versi saat ini
        this.currentVersion = latestVersion;
        localStorage.setItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.CURRENT_VERSION, latestVersion);
        console.log('App version initialized:', this.currentVersion);
        return;
      }
      
      if (latestVersion !== this.currentVersion) {
        console.log(`New app version detected! Current: ${this.currentVersion}, Latest: ${latestVersion}`);
        
        // Tandai bahwa ada update tersedia
        this.updateAvailable = true;
        localStorage.setItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.UPDATE_AVAILABLE, 'true');
        
        // Tampilkan notifikasi update
        this.showUpdateNotification();
        
      } else {
        console.log('App is up to date:', this.currentVersion);
        // Reset flag update jika tidak ada update
        this.updateAvailable = false;
        localStorage.setItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.UPDATE_AVAILABLE, 'false');
      }
      
    } catch (error) {
      console.error('Failed to check app version:', error);
    }
  }
  
  showUpdateNotification() {
    // Cek apakah notifikasi sudah ditampilkan
    if (document.getElementById('app-update-notification')) {
      return; // Sudah ada notifikasi
    }
    
    const notification = document.createElement('div');
    notification.id = 'app-update-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 10000;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 90%;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
      ">
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 16px;">
          🚀 Update Tersedia!
        </div>
        <div style="font-size: 14px; margin-bottom: 15px; opacity: 0.9;">
          Versi terbaru aplikasi sudah tersedia dengan fitur-fitur baru
        </div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="update-now-btn" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
             onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            Update Sekarang
          </button>
          <button id="update-later-btn" style="
            background: transparent;
            color: rgba(255,255,255,0.8);
            border: 1px solid rgba(255,255,255,0.3);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s ease;
          " onmouseover="this.style.color='white'; this.style.borderColor='rgba(255,255,255,0.5)'" 
             onmouseout="this.style.color='rgba(255,255,255,0.8)'; this.style.borderColor='rgba(255,255,255,0.3)'">
            Nanti Saja
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Event listeners untuk tombol
    document.getElementById('update-now-btn').addEventListener('click', () => {
      this.performUpdate();
    });
    
    document.getElementById('update-later-btn').addEventListener('click', () => {
      this.dismissNotification();
    });
    
    // Auto dismiss setelah 30 detik jika tidak ada aksi
    setTimeout(() => {
      this.dismissNotification();
    }, 30000);
  }
  
  async performUpdate() {
    try {
      // Tampilkan loading
      this.showLoadingUpdate();
      
      // 1. Clear cache Median webview jika tersedia
      if (window.median && window.median.webview && typeof window.median.webview.clearCache === 'function') {
        console.log('Clearing Median webview cache...');
        window.median.webview.clearCache();
      }
      
      // 2. Update versi di localStorage
      const response = await fetch(VERSION_CHECK_CONFIG.VERSION_API);
      const data = await response.json();
      const latestVersion = data.version;
      
      localStorage.setItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.CURRENT_VERSION, latestVersion);
      localStorage.setItem(VERSION_CHECK_CONFIG.STORAGE_KEYS.UPDATE_AVAILABLE, 'false');
      
      // 3. Reload aplikasi
      setTimeout(() => {
        window.location.reload(true);
      }, 1000);
      
    } catch (error) {
      console.error('Error performing update:', error);
      alert('Gagal melakukan update. Silakan coba lagi.');
      this.dismissNotification();
    }
  }
  
  showLoadingUpdate() {
    const notification = document.getElementById('app-update-notification');
    if (notification) {
      notification.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px 30px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          z-index: 10000;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        ">
          <div style="font-weight: 600; margin-bottom: 10px; font-size: 16px;">
            🔄 Memperbarui Aplikasi...
          </div>
          <div style="font-size: 14px; opacity: 0.9;">
            Mohon tunggu sebentar
          </div>
        </div>
      `;
    }
  }
  
  dismissNotification() {
    const notification = document.getElementById('app-update-notification');
    if (notification) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';
      notification.style.transition = 'all 0.3s ease';
      
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }
  
  // Method untuk force check (bisa dipanggil manual jika diperlukan)
  forceCheck() {
    console.log('Force checking for updates...');
    this.checkVersion();
  }
}

// Initialize version checker ketika DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Pastikan hanya berjalan di dalam Median app atau browser
  if (typeof window !== 'undefined') {
    window.versionChecker = new VersionChecker();
    
    // Expose method untuk debugging
    window.checkAppVersion = () => {
      window.versionChecker.forceCheck();
    };
  }
});

// Export untuk penggunaan sebagai module jika diperlukan
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VersionChecker;
} 