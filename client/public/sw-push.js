// client/public/sw-push.js
// Custom Service Worker handlers for Web Push Notifications & Clicks

self.addEventListener('push', (event) => {
    let payload = {
        title: 'Mason Badminton Connect',
        body: 'You have a new update.',
        url: '/'
    };

    if (event.data) {
        try {
            const parsed = event.data.json();
            payload = { ...payload, ...parsed };
        } catch {
            payload.body = event.data.text() || payload.body;
        }
    }

    const title = payload.title || 'Mason Badminton Connect';
    const options = {
        body: payload.body,
        icon: payload.icon || '/favicon.svg',
        badge: payload.badge || '/favicon.svg',
        data: {
            url: payload.url || '/'
        },
        vibrate: [100, 50, 100],
        tag: payload.tag || 'badminton-notification',
        renotify: true
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If an existing client window is already at this URL or on the site, focus it
            for (const client of windowClients) {
                if ('focus' in client) {
                    if (client.url.includes(targetUrl) || targetUrl === '/') {
                        return client.focus();
                    }
                }
            }
            // Otherwise open a new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
