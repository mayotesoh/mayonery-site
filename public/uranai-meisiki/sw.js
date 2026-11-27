// オフライン用。一度開いたら電波がなくても動く。
// 開くたびに裏で新しい版を取りに行き、次に開いたときから新しい版になる（stale-while-revalidate）。
// 3751626a94 は tools/build_web.py が中身のハッシュに置き換える。版が変わると古いキャッシュは消える。
const CACHE = 'uranai-meishiki-3751626a94';   // 2026-11-27 URL を uranai-meisiki に移したので名前も分けた（旧URLの片付けと混ざらないように）
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './tarot/c01.jpg', './tarot/c02.jpg', './tarot/c03.jpg', './tarot/c04.jpg', './tarot/c05.jpg', './tarot/c06.jpg', './tarot/c07.jpg', './tarot/c08.jpg', './tarot/c09.jpg', './tarot/c10.jpg', './tarot/c11.jpg', './tarot/c12.jpg', './tarot/c13.jpg', './tarot/c14.jpg', './tarot/m00.jpg', './tarot/m01.jpg', './tarot/m02.jpg', './tarot/m03.jpg', './tarot/m04.jpg', './tarot/m05.jpg', './tarot/m06.jpg', './tarot/m07.jpg', './tarot/m08.jpg', './tarot/m09.jpg', './tarot/m10.jpg', './tarot/m11.jpg', './tarot/m12.jpg', './tarot/m13.jpg', './tarot/m14.jpg', './tarot/m15.jpg', './tarot/m16.jpg', './tarot/m17.jpg', './tarot/m18.jpg', './tarot/m19.jpg', './tarot/m20.jpg', './tarot/m21.jpg', './tarot/p01.jpg', './tarot/p02.jpg', './tarot/p03.jpg', './tarot/p04.jpg', './tarot/p05.jpg', './tarot/p06.jpg', './tarot/p07.jpg', './tarot/p08.jpg', './tarot/p09.jpg', './tarot/p10.jpg', './tarot/p11.jpg', './tarot/p12.jpg', './tarot/p13.jpg', './tarot/p14.jpg', './tarot/s01.jpg', './tarot/s02.jpg', './tarot/s03.jpg', './tarot/s04.jpg', './tarot/s05.jpg', './tarot/s06.jpg', './tarot/s07.jpg', './tarot/s08.jpg', './tarot/s09.jpg', './tarot/s10.jpg', './tarot/s11.jpg', './tarot/s12.jpg', './tarot/s13.jpg', './tarot/s14.jpg', './tarot/w01.jpg', './tarot/w02.jpg', './tarot/w03.jpg', './tarot/w04.jpg', './tarot/w05.jpg', './tarot/w06.jpg', './tarot/w07.jpg', './tarot/w08.jpg', './tarot/w09.jpg', './tarot/w10.jpg', './tarot/w11.jpg', './tarot/w12.jpg', './tarot/w13.jpg', './tarot/w14.jpg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('uranai-meishiki-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
