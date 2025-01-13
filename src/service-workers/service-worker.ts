/// <reference lib="WebWorker" />

// export empty type because of tsc --isolatedModules flag
export type {};
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', (e: ExtendableEvent) => {
  console.log('service worker installed'); 
  
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (e: ExtendableEvent) => {
  console.log('service worker activated');
  
  e.waitUntil(self.clients.claim())
})

self.addEventListener('message', (e: ExtendableMessageEvent) => {
  try {
    console.debug('received a message', e.data, e)
  } catch (err) {
    console.error('error processing message', e.data, err)
  }
})

self.addEventListener('fetch', (e: FetchEvent) => {
  console.log('fetch event', e.request.url);
  
  try {
    const url = new URL(e.request.url)

    if (url.pathname === '/sw/ping') {
      return e.respondWith(textResponse('pong'))
    }

    // NOTE: if we forget to proxy then all is lost
    return e.respondWith(fetch(e.request))
  } catch (e) {
    console.error('error capturing fetch', e)
  }
})

function textResponse (text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain'
    }
  })
}