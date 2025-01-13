var CACHE_NAME = 'my-site-cache-v1';

self.addEventListener('install', function(event) {
    console.log('Service worker installing...');
    
  });

self.addEventListener('fetch', function(event) {
    console.log('Fetch event for ', event.request.url);
    
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          // Cache hit - return response
          if (response) {
            return response;
          }
          return fetch(event.request);
        }
      )
    );
  });
  