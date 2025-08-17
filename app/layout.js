import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Aplikasi Kurir</title>
      </head>
      <body>
        {children}
        
        {/* Version Checker Script - untuk auto update detection */}
        <Script 
          src="/js/version-checker.js" 
          strategy="afterInteractive"
        />
        {/* Optional: force SW update jika versi cache berubah */}
        <Script id="force-sw-update" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
              regs.forEach(reg => {
                if (reg.active) {
                  // Trigger update check
                  reg.update();
                }
              });
            });
          }
        `}</Script>
      </body>
    </html>
  )
}