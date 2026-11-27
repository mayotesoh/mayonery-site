// 旧URL（/sanmeigaku-meisiki/）の片付け。2026-11-27 に /uranai-meisiki/ へ移転。
// 古いオフライン用キャッシュ（meishiki-…）を消して自分を外し、開いている画面を新しいURLへ移す。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('meishiki-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach(c => { try { const u = new URL(c.url); c.navigate('/uranai-meisiki/' + u.hash); } catch (err) {} });
  })());
});
