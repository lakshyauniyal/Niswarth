import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

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
const db = getDatabase(app);

// Elements
const eventsGrid = document.getElementById('eventsGrid');
const noEvents = document.getElementById('noEvents');
const campaignsGrid = document.getElementById('campaignsGrid');
const noCampaigns = document.getElementById('noCampaigns');
const modal = document.getElementById('donateModal');
const modalTitle = document.getElementById('modalTitle');
const qrImage = document.getElementById('qrImage');
const upiIdSpan = document.getElementById('upiId');
const donateForm = document.getElementById('donateForm');
const successMsg = document.getElementById('successMsg');

// Current donation context
let currentDonation = { type: '', id: '', ngoId: '' };

// Format date
function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Open Modal
window.openDonateModal = function(type, id, ngoId, title) {
  currentDonation = { type, id, ngoId };
  modalTitle.textContent = `Donate to ${title}`;
  modal.style.display = 'flex';

  // Load NGO UPI
  onValue(ref(db, `ngos/${ngoId}`), snap => {
    const ngo = snap.val();
    const upi = ngo?.upiId || 'example@upi';
    const amount = document.getElementById('donateAmount').value || 100;
    upiIdSpan.textContent = upi;
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${upi}&am=${amount}&cu=INR&tn=${encodeURIComponent(title)}`;
  }, { onlyOnce: true });
};

// Close Modal
window.closeDonateModal = function() {
  modal.style.display = 'none';
  donateForm.reset();
  successMsg.style.display = 'none';
};

// Update QR when amount changes
document.getElementById('donateAmount')?.addEventListener('input', () => {
  const amount = document.getElementById('donateAmount').value || 100;
  const upi = upiIdSpan.textContent;
  const title = modalTitle.textContent.replace('Donate to ', '');
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${upi}&am=${amount}&cu=INR&tn=${encodeURIComponent(title)}`;
});

// Submit Donation
donateForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('donorName').value.trim();
  const amount = Number(document.getElementById('donateAmount').value);
  const txId = document.getElementById('txId').value.trim();
  const message = document.getElementById('donorMessage').value.trim();

  if (!name || !amount || !txId) return alert('Please fill all required fields.');

  try {
    const donationRef = push(ref(db, `donations/${currentDonation.ngoId}`));
    await set(donationRef, {
      donor: name,
      amount,
      txId,
      message: message || null,
      status: 'pending',
      date: new Date().toISOString(),
      [currentDonation.type + 'Id']: currentDonation.id
    });

    successMsg.style.display = 'block';
    setTimeout(() => closeDonateModal(), 2000);
  } catch (err) {
    alert('Donation failed: ' + err.message);
  }
});

// === EVENTS ===
onValue(ref(db, 'publicEvents'), snap => {
  eventsGrid.innerHTML = '';
  if (!snap.exists()) {
    noEvents.style.display = 'block';
    return;
  }

  noEvents.style.display = 'none';
  const events = [];
  snap.forEach(child => {
    const e = child.val();
    e.id = child.key;
    events.push(e);
  });

  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  events.forEach(e => {
    const pct = e.goal > 0 ? (e.raised / e.goal) * 100 : 0;

    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="event-img" style="background-image:url('https://via.placeholder.com/400x200?text=${encodeURIComponent(e.title)}')"></div>
      <div class="event-content">
        <h3 class="event-title">${e.title}</h3>
        <div class="event-meta">
          <p><i class="fas fa-calendar"></i> ${formatDate(e.date)}</p>
          <p><i class="fas fa-map-marker-alt"></i> ${e.location || 'N/A'}</p>
        </div>
        <p><strong>Goal:</strong> ₹${Number(e.goal || 0).toLocaleString()} | <strong>Raised:</strong> ₹${Number(e.raised || 0).toLocaleString()}</p>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        <button onclick="openDonateModal('event', '${e.id}', '${e.ngoId}', '${e.title}')" class="donate-btn">Donate Now</button>
      </div>
    `;
    eventsGrid.appendChild(card);
  });
});

// === CAMPAIGNS ===
onValue(ref(db, 'campaigns'), snap => {
  campaignsGrid.innerHTML = '';
  const campaigns = [];

  snap.forEach(ngoSnap => {
    const ngoId = ngoSnap.key;
    ngoSnap.forEach(campSnap => {
      const c = campSnap.val();
      c.id = campSnap.key;
      c.ngoId = ngoId;
      if (c.status === 'active' || c.status === 'planning') {
        campaigns.push(c);
      }
    });
  });

  if (campaigns.length === 0) {
    noCampaigns.style.display = 'block';
    return;
  }

  noCampaigns.style.display = 'none';
  campaigns.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  campaigns.forEach(c => {
    const statusText = (c.status || 'active').charAt(0).toUpperCase() + (c.status || 'active').slice(1);

    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="event-img" style="background-image:url('https://via.placeholder.com/400x200?text=${encodeURIComponent(c.title)}')"></div>
      <div class="event-content">
        <h3 class="event-title">${c.title}</h3>
        <p class="campaign-desc">${c.description || 'No description available.'}</p>
        <p><span class="status ${c.status || 'active'}">${statusText}</span></p>
        <button onclick="openDonateModal('campaign', '${c.id}', '${c.ngoId}', '${c.title}')" class="donate-btn">Support Campaign</button>
      </div>
    `;
    campaignsGrid.appendChild(card);
  });
});