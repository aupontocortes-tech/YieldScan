/* YieldScan — service worker v4.7 (pass-through + lembretes afazeres) */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

self.addEventListener('notificationclick', (event) => {
  const data = event.notification?.data || {}
  const url = typeof data.url === 'string' ? data.url : '/news/gestao-financeira?tab=afazeres'
  event.notification?.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'GF_OPEN_AFAZERES' })
          return
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

/** Mantém cópia dos afazeres — reservado para checks futuros no SW. */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GF_TODOS_SYNC') {
    /* dados recebidos do cliente; checks principais correm na página aberta */
  }
})
