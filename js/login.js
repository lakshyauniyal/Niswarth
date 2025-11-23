import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// === Firebase Config ===
const firebaseConfig = {
  apiKey: "AIzaSyCdUHRuTiX1T6pG7WjFIhZX38lg8Rjv7so",
  authDomain: "niswarth-b9dfb.firebaseapp.com",
  databaseURL: "https://niswarth-b9dfb-default-rtdb.firebaseio.com",
  projectId: "niswarth-b9dfb",
  storageBucket: "niswarth-b9dfb.firebasestorage.app",
  messagingSenderId: "294445429579",
  appId: "1:294445429579:web:8f4fe08910bfeebe102ece"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// === DOM ===
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const flipCard = document.querySelector('.flip-card');

// === Helpers ===
const showError = (input, msg) => {
  const error = input.parentElement.querySelector('.error-msg');
  error.textContent = msg;
  input.style.borderColor = '#e74c3c';
};
const clearError = (input) => {
  const error = input.parentElement.querySelector('.error-msg');
  error.textContent = '';
  input.style.borderColor = '#ddd';
};

// === Flip Card ===
document.querySelectorAll('.flip-trigger').forEach(t => {
  t.addEventListener('click', e => {
    e.preventDefault();
    flipCard.classList.toggle('flipped', t.dataset.side === 'back');
  });
});

// === Password Toggle ===
document.querySelectorAll('.toggle-password').forEach(icon => {
  icon.addEventListener('click', () => {
    const input = document.getElementById(icon.dataset.target);
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  });
});

// === AUTO-REDIRECT IF ALREADY LOGGED IN ===
onAuthStateChanged(auth, async (user) => {
  if (user && window.location.pathname.includes('login.html')) {
    const snap = await get(ref(db, 'ngos/' + user.uid));
    if (snap.exists()) {
      window.location.replace('dashboard.html');
    }
  }
});

// === LOGIN ===
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  [document.getElementById('loginEmail'), document.getElementById('loginPassword')].forEach(clearError);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Check if NGO profile exists
    const snap = await get(ref(db, 'ngos/' + user.uid));
    if (!snap.exists()) {
      showError(document.getElementById('loginEmail'), 'NGO profile not found. Please sign up first.');
      return; // Do NOT sign out – let user try signup
    }

    window.location.replace('dashboard.html');

  } catch (err) {
    console.error(err);
    if (['auth/user-not-found', 'auth/wrong-password'].includes(err.code)) {
      showError(document.getElementById('loginEmail'), 'Invalid email or password');
    } else if (err.code === 'auth/invalid-email') {
      showError(document.getElementById('loginEmail'), 'Invalid email format');
    } else {
      showError(document.getElementById('loginPassword'), err.message);
    }
  }
});

// === SIGNUP ===
signupForm.addEventListener('submit', async e => {
  e.preventDefault();

  const ngoName = document.getElementById('ngoName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const regId = document.getElementById('registrationId').value.trim();

  // Clear errors
  ['ngoName', 'signupEmail', 'phone', 'signupPassword', 'registrationId'].forEach(id =>
    clearError(document.getElementById(id))
  );

  // Validate
  let valid = true;
  if (!ngoName) { showError(document.getElementById('ngoName'), 'Required'); valid = false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(document.getElementById('signupEmail'), 'Valid email'); valid = false; }
  if (!/^[6-9]\d{9}$/.test(phone)) { showError(document.getElementById('phone'), '10-digit phone'); valid = false; }
  if (password.length < 6) { showError(document.getElementById('signupPassword'), '6+ chars'); valid = false; }
  if (!regId) { showError(document.getElementById('registrationId'), 'Required'); valid = false; }

  if (!valid) return;

  try {
    // 1. Create Auth User
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 2. Create NGO Profile (this guarantees it exists on login)
    await set(ref(db, 'ngos/' + user.uid), {
      name: ngoName,
      email,
      phone,
      regId,
      createdAt: new Date().toISOString(),
      totalDonated: 0,
      donors: 0,
      livesImpacted: 0,
      activeEvents: 0
    });

    window.location.replace('dashboard.html');

  } catch (err) {
    console.error(err);
    if (err.code === 'auth/email-already-in-use') {
      showError(document.getElementById('signupEmail'), 'Email already registered');
    } else {
      alert('Signup failed: ' + err.message);
    }
  }
});