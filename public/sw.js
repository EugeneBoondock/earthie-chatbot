// Define page content for instant splash screen display
const SPLASH_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Earthie</title>
  <style>
    body, html {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .splash-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      width: 100vw;
    }
    .logo-container {
      position: relative;
      width: 128px;
      height: 128px;
      margin-bottom: 16px;
      animation: pulse 2s infinite alternate;
    }
    .logo {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-image: url('/images/optimized/earthie_logo_optimized.png');
      background-size: 90% 90%;
      background-position: center;
      background-repeat: no-repeat;
      box-shadow: 0 0 30px 8px rgba(80, 227, 193, 0.5);
    }
    .logo-bg {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background-color: rgba(80, 227, 193, 0.3);
      filter: blur(8px);
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      100% { transform: scale(1.05); }
    }
    .text-gradient {
      background: linear-gradient(to right, #50E3C1, #38bdf8);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 10px rgba(80, 227, 193, 0.3);
      letter-spacing: 0.2em;
      font-weight: bold;
      font-size: 24px;
      margin-top: 16px;
    }
    .text-gradient-subtle {
      background: linear-gradient(to right, #50E3C1, #818cf8);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: 0.15em;
      font-size: 14px;
      font-weight: 500;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="splash-container">
    <div class="logo-container">
      <div class="logo-bg"></div>
      <div class="logo"></div>
    </div>
    <div class="text-gradient">EARTHIE</div>
    <div class="text-gradient-subtle">Your Earth2 AI Companion</div>
  </div>
</body>
</html>
`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first strategy for most requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // If this is the start URL or root path, serve our custom splash screen
  if (event.request.mode === 'navigate' && 
     (url.pathname === '/' || url.pathname === '/index.html')) {
    // Check if this is a standalone PWA launch
    const isStandalone = event.request.headers.get('sec-fetch-mode') === 'navigate';
    
    if (isStandalone) {
      event.respondWith(
        new Response(SPLASH_HTML, {
          headers: { 'Content-Type': 'text/html' }
        })
      );
      return;
    }
  }
  
  // For all other requests, use network-first strategy
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
}); 