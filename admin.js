```javascript
// Firebase configuration (same as script.js)
const firebaseConfig = {
  apiKey: "AIzaSyDa5zzgazYSLOz__nQi4SzIgPQ57H4gYEE",
  authDomain: "nurul-islam-web.firebaseapp.com",
  projectId: "nurul-islam-web",
  storageBucket: "nurul-islam-web.firebasestorage.app",
  messagingSenderId: "169510958216",
  appId: "1:169510958216:web:fc45e40977a02572d2db3d",
  measurementId: "G-1GD3MTZM4J"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM elements
const loginForm = document.getElementById('loginForm');
const adminDashboard = document.getElementById('adminDashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginMessage = document.getElementById('loginMessage');
const postForm = document.getElementById('postForm');
const messageDiv = document.getElementById('message');

// Check if user is already logged in
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        loginForm.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
    } else {
        // No user is signed in
        loginForm.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
    }
});

// Login
loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginMessage.style.color = '#4caf50';
        loginMessage.innerText = 'Login successful!';
    } catch (error) {
        loginMessage.style.color = '#f44336';
        loginMessage.innerText = 'Error: ' + error.message;
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
});

// Publish post to Firestore
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const category = document.getElementById('postCategory').value;
    const type = document.getElementById('postType').value;
    const url = document.getElementById('postUrl').value;

    const newPost = {
        title,
        content,
        category,
        type,
        url,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('posts').add(newPost);
        messageDiv.style.color = '#4caf50';
        messageDiv.innerHTML = '✅ Post published successfully!';
        postForm.reset();
    } catch (error) {
        messageDiv.style.color = '#f44336';
        messageDiv.innerHTML = '❌ Error: ' + error.message;
    }
});
```
