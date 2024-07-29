self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
      event.respondWith((async () => {
        try {
          // First, try to use the navigation preload response if it's supported.
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }
  
          // Otherwise, use the network.
          const response = await fetch(event.request);
          return response;
        } catch (error) {
          // If both fail, show an offline page.
          return caches.match('offline.html');
        }
      })());
    }
  });