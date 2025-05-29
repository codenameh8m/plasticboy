// Service Worker для кеширования статических ресурсов PlasticBoy
const CACHE_NAME = 'plasticboy-v1.0';
const urlsToCache = [
  '/',
  '/style.css',
  '/script.js',
  '/admin.js',
  '/index.html',
  '/admin.html',
  '/collect.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Установка Service Worker
self.addEventListener('install', function(event) {
  console.log('PlasticBoy SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('PlasticBoy SW: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.error('PlasticBoy SW: Cache failed', error);
      })
  );
});

// Обработка запросов
self.addEventListener('fetch', function(event) {
  // Кешируем только GET запросы
  if (event.request.method !== 'GET') {
    return;
  }

  // Не кешируем API запросы (они должны быть свежими)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Если есть в кеше - возвращаем кешированную версию
        if (response) {
          console.log('PlasticBoy SW: Serving from cache:', event.request.url);
          return response;
        }

        // Иначе загружаем из сети
        return fetch(event.request).then(
          function(response) {
            // Проверяем корректность ответа
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Клонируем ответ для кеширования
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(function(error) {
          console.error('PlasticBoy SW: Fetch failed:', error);
          // Возвращаем кешированную версию если сеть недоступна
          return caches.match(event.request);
        });
      })
    );
});

// Обновление кеша (удаляем старые версии)
self.addEventListener('activate', function(event) {
  console.log('PlasticBoy SW: Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('PlasticBoy SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
