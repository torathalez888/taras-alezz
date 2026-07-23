/**
 * ============================================================
 *  sw.js — Service Worker لنظام "تراث العز"
 * ============================================================
 *  🔧 يحل مشكلة "لازم أحذف الكاش يدوياً بعد كل تحديث":
 *  - كل نشر جديد للموقع، غيّر رقم CACHE_VERSION بالأسفل (أي تغيير بسيط، مثلاً v3 → v4)
 *    حتى يجبر المتصفح ينشئ كاش جديد بالكامل ويتجاهل القديم تلقائياً.
 *  - عند التفعيل، يمسح تلقائياً أي كاش قديم بنفس الموقع (اسمه ما يطابق النسخة الحالية).
 *  - يدعم أمر "SKIP_WAITING" من الصفحة نفسها، فيتفعّل فوراً بدون انتظار إغلاق كل التبويبات.
 *  - استراتيجية "الشبكة أولاً" لصفحة index.html نفسها (عشان تصل دايماً آخر نسخة لو فيه
 *    إنترنت)، و"الكاش أولاً" للملفات الثابتة (خطوط، أيقونات) لتسريع التحميل بدون إنترنت.
 * ============================================================
 */

const CACHE_VERSION = 'trath-alezz-v3'; // ⚠️ غيّر هذا الرقم مع كل تحديث تنشره
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// يسمح للصفحة تطلب من الـ Service Worker يتفعّل فوراً بدل ما ينتظر إغلاق كل التبويبات
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');

  if (isHTML) {
    // الشبكة أولاً لصفحة الموقع نفسها — يضمن دايماً آخر تحديث لو فيه إنترنت،
    // ويرجع لآخر نسخة محفوظة بالكاش فقط لو ما فيه إنترنت إطلاقاً
    event.respondWith(
      fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // الكاش أولاً للملفات الثابتة (خطوط، أيقونات...) مع تحديث بالخلفية
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
