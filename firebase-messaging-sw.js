
```javascript
// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDa5zzgazYSLOz__nQi4SzIgPQ57H4gYEE",
  authDomain: "nurul-islam-web.firebaseapp.com",
  projectId: "nurul-islam-web",
  storageBucket: "nurul-islam-web.firebasestorage.app",
  messagingSenderId: "169510958216",
  appId: "1:169510958216:web:fc45e40977a02572d2db3d",
  measurementId: "G-1GD3MTZM4J"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.jpg',
    image: payload.notification.image,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(urlToOpen));
});
```
