import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  set,
  remove,
  limitToLast,
  query,
  get
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// -------------------------------------------------------------------
// 1. Firebase Config
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

// -------------------------------------------------------------------
// 2. AUTH GUARD
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace('login.html');
  } else {
    loadNGOData(user.uid);
  }
});

// -------------------------------------------------------------------
// 3. LOAD NGO DATA 
function loadNGOData(uid) {
  const ngoRef = ref(db, `ngos/${uid}`);
  onValue(ngoRef, snap => {
    const data = snap.val() || {};

    document.getElementById('ngoName').textContent = data.name || 'NGO';
    document.getElementById('profileName').value  = data.name  || '';
    document.getElementById('profileEmail').value = data.email || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileUpiId').value = data.upiId || ''; // UPI ID

    updateCounter('[data-target="1970000"]', data.totalDonated || 0);
    updateCounter('[data-target="1250"]',    data.donors       || 0);
    updateCounter('[data-target="5000"]',    data.livesImpacted || 0);
    updateCounter('[data-target="3"]',       data.activeEvents  || 0);

    loadDonations(uid);
    loadEvents(uid);
    loadCampaigns(uid);
  });
}

// -------------------------------------------------------------------
// 4. COUNTER
function updateCounter(selector, target) {
  const el = document.querySelector(selector);
  if (!el) return;
  let count = 0;
  const inc = target / 100;
  const timer = setInterval(() => {
    count += inc;
    if (count >= target) {
      el.textContent = formatNumber(target);
      clearInterval(timer);
    } else {
      el.textContent = formatNumber(Math.floor(count));
    }
  }, 15);
}

function formatNumber(num) {
  if (num >= 1_000_000) return '₹' + (num/1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return '₹' + (num/1_000).toFixed(1) + 'K';
  return '₹' + num;
}

// -------------------------------------------------------------------
// 5. DONATIONS 
function loadDonations(uid) {
  const tbody = document.getElementById('donationsBody');
  if (!tbody) return;
  const q = query(ref(db, `donations/${uid}`), limitToLast(10));
  onValue(q, snap => {
    tbody.innerHTML = '';
    snap.forEach(child => {
      const d = child.val();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${d.donor || 'Anonymous'}</td>
        <td>₹${Number(d.amount || 0).toLocaleString()}</td>
        <td>${d.date ? new Date(d.date).toLocaleDateString() : 'N/A'}</td>
        <td><code>${d.txId || '—'}</code></td>
        <td><span class="status ${d.status || 'pending'}">${d.status || 'pending'}</span></td>
        <td>
          ${d.status === 'pending' ? `
            <button class="btn-approve" data-id="${child.key}">Approve</button>
            <button class="btn-reject" data-id="${child.key}">Reject</button>
          ` : ''}
        </td>
      `;
      tbody.appendChild(row);
    });

    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.onclick = () => handleDonationAction(uid, btn.dataset.id, 'approved');
    });
    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.onclick = () => handleDonationAction(uid, btn.dataset.id, 'rejected');
    });
  });
}

async function handleDonationAction(uid, donationId, status) {
  if (!confirm(`Are you sure you want to ${status} this donation?`)) return;

  const donationRef = ref(db, `donations/${uid}/${donationId}`);
  const snap = await get(donationRef);
  const donation = snap.val();

  if (!donation) return alert('Donation not found');

  try {
    if (status === 'approved') {
      const ngoRef = ref(db, `ngos/${uid}`);
      const ngoSnap = await get(ngoRef);
      const ngoData = ngoSnap.val() || {};

      await update(ngoRef, {
        totalDonated: (ngoData.totalDonated || 0) + donation.amount,
        donors: (ngoData.donors || 0) + 1
      });

      if (donation.eventId) {
        const eventRef = ref(db, `events/${uid}/${donation.eventId}`);
        const eventSnap = await get(eventRef);
        const event = eventSnap.val();
        if (event) {
          const newRaised = (event.raised || 0) + donation.amount;
          await update(eventRef, { raised: newRaised });
          await update(ref(db, `publicEvents/${donation.eventId}`), { raised: newRaised });
        }
      }
    }

    await update(donationRef, { status });
    alert(`Donation ${status}!`);
  } catch (err) {
    alert('Failed: ' + err.message);
  }
}

// -------------------------------------------------------------------
// 6. EVENTS
let currentEvents = [];

function loadEvents(uid) {
  const grid = document.getElementById('eventsGrid');
  if (!grid) return;

  onValue(ref(db, `events/${uid}`), snap => {
    grid.innerHTML = '';
    currentEvents = [];

    if (!snap.exists()) {
      grid.innerHTML = '<p class="no-data">No events yet. Create your first!</p>';
      return;
    }

    snap.forEach(child => {
      const e = child.val();
      e.id = child.key;
      currentEvents.push(e);
    });

    currentEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    currentEvents.forEach(e => {
      const pct = e.goal > 0 ? (e.raised / e.goal) * 100 : 0;
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-actions">
          <button class="icon-btn edit-btn" data-id="${e.id}">Edit</button>
          <button class="icon-btn delete-btn" data-id="${e.id}">Delete</button>
        </div>
        <h3>${e.title || 'Untitled'}</h3>
        <p><strong>Date:</strong> ${formatDate(e.date)}</p>
        <p><strong>Location:</strong> ${e.location || 'N/A'}</p>
        <p><strong>Goal:</strong> ₹${Number(e.goal || 0).toLocaleString()}</p>
        <p><strong>Raised:</strong> ₹${Number(e.raised || 0).toLocaleString()}</p>
        <div class="progress"><div style="width:${pct}%"></div></div>
      `;
      grid.appendChild(card);
    });
  });
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// -------------------------------------------------------------------
// 7. CAMPAIGNS 
let currentCampaigns = [];

function loadCampaigns(uid) {
  const grid = document.getElementById('campaignsGrid');
  if (!grid) return;

  onValue(ref(db, `campaigns/${uid}`), snap => {
    grid.innerHTML = '';
    currentCampaigns = [];

    if (!snap.exists()) {
      grid.innerHTML = '<p class="no-data">No campaigns yet. Create your first!</p>';
      return;
    }

    snap.forEach(child => {
      const c = child.val();
      c.id = child.key;
      currentCampaigns.push(c);
    });

    currentCampaigns.forEach(c => {
      const statusClass = c.status || 'active';
      const card = document.createElement('div');
      card.className = 'campaign-card';
      card.innerHTML = `
        <div class="event-actions">
          <button class="icon-btn edit-campaign-btn" data-id="${c.id}">Edit</button>
          <button class="icon-btn delete-campaign-btn" data-id="${c.id}">Delete</button>
        </div>
        <h3>${c.title || 'Untitled'}</h3>
        <p>${c.description || 'No description'}</p>
        <p><span class="status ${statusClass}">${(c.status || 'active').charAt(0).toUpperCase() + (c.status || 'active').slice(1)}</span></p>
      `;
      grid.appendChild(card);
    });
  });
}


// DELEGATED: Events & Campaigns
document.getElementById('eventsGrid')?.addEventListener('click', e => {
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');

  if (editBtn) {
    const event = currentEvents.find(ev => ev.id === editBtn.dataset.id);
    if (event) openEditEventCard(event);
  }

  if (deleteBtn) {
    deleteEvent(auth.currentUser.uid, deleteBtn.dataset.id);
  }
});

document.getElementById('campaignsGrid')?.addEventListener('click', e => {
  const editBtn = e.target.closest('.edit-campaign-btn');
  const deleteBtn = e.target.closest('.delete-campaign-btn');

  if (editBtn) {
    const campaign = currentCampaigns.find(c => c.id === editBtn.dataset.id);
    if (campaign) openEditCampaignCard(campaign);
  }

  if (deleteBtn) {
    deleteCampaign(auth.currentUser.uid, deleteBtn.dataset.id);
  }
});


// CREATE EVENT
function showCreateEventCard() {
  document.getElementById('createEventCard').style.display = 'block';
  document.getElementById('eventsGrid').style.marginTop = '2rem';
}

function hideCreateEventCard() {
  document.getElementById('createEventCard').style.display = 'none';
  document.getElementById('eventsGrid').style.marginTop = '0';
}

document.getElementById('quickNewEventBtn')?.addEventListener('click', showCreateEventCard);
document.getElementById('addEventBtn')?.addEventListener('click', showCreateEventCard);
document.getElementById('cancelCreateBtn')?.addEventListener('click', hideCreateEventCard);

document.getElementById('createEventForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert('Not logged in');

  const eventData = {
    title: document.getElementById('eventTitle').value.trim(),
    description: document.getElementById('eventDesc').value.trim(),
    date: document.getElementById('eventDate').value,
    location: document.getElementById('eventLocation').value.trim(),
    goal: Number(document.getElementById('eventGoal').value) || 0,
    raised: 0,
    createdAt: new Date().toISOString(),
    ngoId: user.uid
  };

  try {
    const eventId = Date.now().toString();
    await set(ref(db, `events/${user.uid}/${eventId}`), eventData);
    await set(ref(db, `publicEvents/${eventId}`), { ...eventData, eventId, ngoId: user.uid });
    alert('Event created!');
    document.getElementById('createEventForm').reset();
    hideCreateEventCard();
  } catch (err) {
    alert('Failed: ' + err.message);
  }
});

// EDIT EVENT
function openEditEventCard(event) {
  document.getElementById('editEventId').value = event.id;
  document.getElementById('editEventTitle').value = event.title || '';
  document.getElementById('editEventDesc').value = event.description || '';
  document.getElementById('editEventDate').value = event.date || '';
  document.getElementById('editEventLocation').value = event.location || '';
  document.getElementById('editEventGoal').value = event.goal || 0;

  document.getElementById('editEventCard').style.display = 'block';
  document.getElementById('eventsGrid').style.marginTop = '2rem';
}

function hideEditEventCard() {
  document.getElementById('editEventCard').style.display = 'none';
  document.getElementById('eventsGrid').style.marginTop = '0';
}

document.getElementById('cancelEditBtn')?.addEventListener('click', hideEditEventCard);

document.getElementById('editEventForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  const eventId = document.getElementById('editEventId').value;

  const updates = {
    title: document.getElementById('editEventTitle').value.trim(),
    description: document.getElementById('editEventDesc').value.trim(),
    date: document.getElementById('editEventDate').value,
    location: document.getElementById('editEventLocation').value.trim(),
    goal: Number(document.getElementById('editEventGoal').value) || 0
  };

  try {
    await update(ref(db, `events/${user.uid}/${eventId}`), updates);
    await update(ref(db, `publicEvents/${eventId}`), updates);
    alert('Event updated!');
    hideEditEventCard();
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
});

async function deleteEvent(uid, eventId) {
  if (!confirm('Delete this event permanently?')) return;
  try {
    await remove(ref(db, `events/${uid}/${eventId}`));
    await remove(ref(db, `publicEvents/${eventId}`));
    alert('Event deleted.');
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}


// CREATE CAMPAIGN
function showCreateCampaignCard() {
  document.getElementById('createCampaignCard').style.display = 'block';
  document.getElementById('campaignsGrid').style.marginTop = '2rem';
}

function hideCreateCampaignCard() {
  document.getElementById('createCampaignCard').style.display = 'none';
  document.getElementById('campaignsGrid').style.marginTop = '0';
}

document.getElementById('quickNewCampaignBtn')?.addEventListener('click', showCreateCampaignCard);
document.getElementById('addCampaignBtn')?.addEventListener('click', showCreateCampaignCard);
document.getElementById('cancelCreateCampaignBtn')?.addEventListener('click', hideCreateCampaignCard);

document.getElementById('createCampaignForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert('Not logged in');

  const campaignData = {
    title: document.getElementById('campaignTitle').value.trim(),
    description: document.getElementById('campaignDesc').value.trim(),
    status: document.getElementById('campaignStatus').value,
    createdAt: new Date().toISOString(),
    ngoId: user.uid
  };

  try {
    const campaignId = Date.now().toString();
    await set(ref(db, `campaigns/${user.uid}/${campaignId}`), campaignData);
    alert('Campaign created!');
    document.getElementById('createCampaignForm').reset();
    hideCreateCampaignCard();
  } catch (err) {
    alert('Failed: ' + err.message);
  }
});

// EDIT CAMPAIGN
function openEditCampaignCard(campaign) {
  document.getElementById('editCampaignId').value = campaign.id;
  document.getElementById('editCampaignTitle').value = campaign.title || '';
  document.getElementById('editCampaignDesc').value = campaign.description || '';
  document.getElementById('editCampaignStatus').value = campaign.status || 'active';

  document.getElementById('editCampaignCard').style.display = 'block';
  document.getElementById('campaignsGrid').style.marginTop = '2rem';
}

function hideEditCampaignCard() {
  document.getElementById('editCampaignCard').style.display = 'none';
  document.getElementById('campaignsGrid').style.marginTop = '0';
}

document.getElementById('cancelEditCampaignBtn')?.addEventListener('click', hideEditCampaignCard);

document.getElementById('editCampaignForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  const campaignId = document.getElementById('editCampaignId').value;

  const updates = {
    title: document.getElementById('editCampaignTitle').value.trim(),
    description: document.getElementById('editCampaignDesc').value.trim(),
    status: document.getElementById('editCampaignStatus').value
  };

  try {
    await update(ref(db, `campaigns/${user.uid}/${campaignId}`), updates);
    alert('Campaign updated!');
    hideEditCampaignCard();
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
});

async function deleteCampaign(uid, campaignId) {
  if (!confirm('Delete this campaign permanently?')) return;
  try {
    await remove(ref(db, `campaigns/${uid}/${campaignId}`));
    alert('Campaign deleted.');
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}


// NAVIGATION 
document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = link.getAttribute('href').substring(1);
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(target);
    if (section) section.classList.add('active');
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
  });
});

document.querySelector('.menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});

document.getElementById('darkModeToggle')?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  signOut(auth).then(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
  }).catch(err => alert('Logout failed: ' + err.message));
});

setInterval(() => {
  const el = document.getElementById('currentTime');
  if (el) el.textContent = new Date().toLocaleString();
}, 1000);


// PROFILE UPDATE 
document.getElementById('profileForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert('Not logged in');

  const updates = {
    name: document.getElementById('profileName').value.trim(),
    email: document.getElementById('profileEmail').value.trim(),
    phone: document.getElementById('profilePhone').value.trim(),
    upiId: document.getElementById('profileUpiId').value.trim()
  };

  try {
    await update(ref(db, `ngos/${user.uid}`), updates);
    alert('Profile updated successfully!');
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
});