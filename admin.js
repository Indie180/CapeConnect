// Admin Portal - dual bus mode (Golden Arrow / MyCiTi)
let currentAdminBus = 'ga';
let adminBusLocked = false;

const BUS_META = {
  ga: {
    label: 'Golden Arrow',
    routeType: 'informal',
    activityHint: 'Golden Arrow ops'
  },
  myciti: {
    label: 'MyCiTi',
    routeType: 'formal',
    activityHint: 'MyCiTi ops'
  }
};

// Check Auth on Load
window.addEventListener('DOMContentLoaded', function () {
  checkAdminAuth();
  initBusMode();
  bindBusSwitch();
  bindTimetableImport();
  bindRouteSearch();
  loadDashboardStats();
  loadRoutes();
});

function checkAdminAuth() {
  const user = JSON.parse(localStorage.getItem('capeConnectUser'));
  if (!user || user.role !== 'admin') {
    alert('Access Denied. Admins only.');
    window.location.href = 'index.html';
    return;
  }
  const el = document.getElementById('admin-name');
  if (el) el.textContent = user.name || 'Admin';
}

function normalizeBus(value) {
  if (!value && value !== 0) return '';
  const s = String(value).trim().toLowerCase().replace(/^['"]+|['"]+$/g, '');
  if (s === 'ga' || s === 'goldenarrow' || s === 'golden-arrow') return 'ga';
  if (s === 'myciti' || s === 'mycitii') return 'myciti';
  return '';
}

function initBusMode() {
  const params = new URLSearchParams(window.location.search);
  const forcedBus = normalizeBus(params.get('bus'));
  const lockFromQuery = params.get('lockBus') === '1';
  const lockFromBody = document.body?.dataset?.adminLockBus === '1';
  const bodyBus = normalizeBus(document.body?.dataset?.adminBus || '');
  const stored = normalizeBus(localStorage.getItem('adminSelectedBus')) || normalizeBus(localStorage.getItem('selectedBus'));

  currentAdminBus = forcedBus || bodyBus || stored || 'ga';
  adminBusLocked = lockFromQuery || lockFromBody;
  localStorage.setItem('adminSelectedBus', currentAdminBus);
  applyBusMode();
}

function bindBusSwitch() {
  if (adminBusLocked) return;
  document.getElementById('bus-ga-btn')?.addEventListener('click', function () {
    setAdminBus('ga');
  });
  document.getElementById('bus-myciti-btn')?.addEventListener('click', function () {
    setAdminBus('myciti');
  });
}

function setAdminBus(bus) {
  if (adminBusLocked) return;
  const normalized = normalizeBus(bus);
  if (!normalized || normalized === currentAdminBus) return;
  currentAdminBus = normalized;
  localStorage.setItem('adminSelectedBus', currentAdminBus);
  applyBusMode();
  loadDashboardStats();
  loadRoutes();
  loadUsers();
}

function applyBusMode() {
  const gaBtn = document.getElementById('bus-ga-btn');
  const mycitiBtn = document.getElementById('bus-myciti-btn');
  gaBtn?.classList.toggle('active', currentAdminBus === 'ga');
  mycitiBtn?.classList.toggle('active', currentAdminBus === 'myciti');

  const title = document.getElementById('page-title');
  if (title && document.getElementById('dashboard')?.classList.contains('active')) {
    title.textContent = `${BUS_META[currentAdminBus].label} Dashboard Overview`;
  }

  const routesLabel = document.getElementById('stats-routes-label');
  if (routesLabel) routesLabel.textContent = `${BUS_META[currentAdminBus].label} Routes`;

  const bookingsLabel = document.getElementById('stats-bookings-label');
  if (bookingsLabel) bookingsLabel.textContent = `${BUS_META[currentAdminBus].label} Bookings Today`;

  const revenueLabel = document.getElementById('stats-revenue-label');
  if (revenueLabel) revenueLabel.textContent = `${BUS_META[currentAdminBus].label} Revenue (Today)`;

  const importSelect = document.getElementById('admin-import-service');
  if (importSelect) {
    importSelect.value = currentAdminBus;
    importSelect.disabled = true;
  }

  const switchWrap = gaBtn?.closest('.admin-bus-switch');
  if (switchWrap) {
    switchWrap.style.display = adminBusLocked ? 'none' : 'inline-flex';
  }
}

// Navigation Logic
function showSection(sectionId) {
  document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));

  document.getElementById(sectionId)?.classList.add('active');

  const activeLink = Array.from(document.querySelectorAll('.sidebar-menu a')).find(el =>
    el.getAttribute('onclick')?.includes(sectionId)
  );
  if (activeLink) activeLink.classList.add('active');

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    const sectionMap = {
      dashboard: `${BUS_META[currentAdminBus].label} Dashboard Overview`,
      routes: `${BUS_META[currentAdminBus].label} Route Management`,
      users: `${BUS_META[currentAdminBus].label} User Management`,
      settings: 'System Settings'
    };
    pageTitle.textContent = sectionMap[sectionId] || 'Admin Portal';
  }

  if (sectionId === 'routes') loadRoutes();
  if (sectionId === 'users') loadUsers();
  if (sectionId === 'dashboard') loadDashboardStats();
}

function busRouteKey(bus) {
  return bus === 'myciti' ? 'routeDatabase_myciti' : 'routeDatabase_ga';
}

function getAllRoutesLegacy() {
  return JSON.parse(localStorage.getItem('routeDatabase')) || [];
}

function saveAllRoutesLegacy(routes) {
  localStorage.setItem('routeDatabase', JSON.stringify(routes));
}

function getRoutesForBus(bus = currentAdminBus) {
  const byBus = JSON.parse(localStorage.getItem(busRouteKey(bus))) || [];
  if (Array.isArray(byBus) && byBus.length) return byBus;

  // Fallback to legacy mixed table with route.type mapping.
  const legacy = getAllRoutesLegacy();
  return legacy.filter(r => {
    const routeBus = normalizeBus(r.bus);
    if (routeBus) return routeBus === bus;
    if (bus === 'myciti') return String(r.type).toLowerCase() === 'formal';
    return String(r.type).toLowerCase() !== 'formal';
  });
}

function saveRoutesForBus(routes, bus = currentAdminBus) {
  const normalized = (Array.isArray(routes) ? routes : []).map(r => ({ ...r, bus }));
  localStorage.setItem(busRouteKey(bus), JSON.stringify(normalized));

  // Keep legacy aggregate key in sync for backwards compatibility.
  const ga = getRoutesForBus('ga');
  const my = getRoutesForBus('myciti');
  saveAllRoutesLegacy([...ga, ...my]);
}

function getTickets() {
  const cc = JSON.parse(localStorage.getItem('ccTickets_v1')) || [];
  const gaDemo = JSON.parse(localStorage.getItem('goldenArrowTicketsDemo_v1')) || [];
  const myDemo = JSON.parse(localStorage.getItem('mycitiTicketsDemo_v1')) || [];
  return [...cc, ...gaDemo, ...myDemo];
}

function isTicketForCurrentBus(ticket) {
  const raw = `${ticket?.operator || ''} ${ticket?.service || ''} ${ticket?.route || ''} ${ticket?.title || ''}`.toLowerCase();
  if (currentAdminBus === 'ga') return raw.includes('golden arrow') || raw.includes('goldenarrow') || raw.includes('ga');
  return raw.includes('myciti') || raw.includes('myciti');
}

function toAmount(ticket) {
  if (typeof ticket?.amountCents === 'number') return ticket.amountCents / 100;
  const total = String(ticket?.total || '').replace(/[^\d.\-]/g, '');
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

function isTodayISO(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

// Dashboard Logic
function loadDashboardStats() {
  const routes = getRoutesForBus(currentAdminBus);
  const userDatabase = JSON.parse(localStorage.getItem('userDatabase')) || [];
  const filteredUsers = filterUsersByBus(userDatabase, currentAdminBus);

  const tickets = getTickets().filter(isTicketForCurrentBus);
  const todays = tickets.filter(t => isTodayISO(t.purchasedAt || t.createdAt || t.date));
  const revenue = todays.reduce((sum, t) => sum + toAmount(t), 0);

  const usersEl = document.getElementById('stats-users');
  const routesEl = document.getElementById('stats-routes');
  const bookingsEl = document.getElementById('stats-bookings');
  const revenueEl = document.getElementById('stats-revenue');

  if (usersEl) usersEl.textContent = filteredUsers.length;
  if (routesEl) routesEl.textContent = routes.length;
  if (bookingsEl) bookingsEl.textContent = todays.length;
  if (revenueEl) revenueEl.textContent = `R ${revenue.toFixed(2)}`;

  const activityLog = document.getElementById('activity-log');
  if (activityLog) {
    activityLog.innerHTML = `
      <p style="color: var(--text-light); padding: 10px 0; border-bottom: 1px solid var(--border-light);">
        <i class="fas fa-check-circle" style="color: var(--success-color); margin-right: 10px;"></i>
        ${BUS_META[currentAdminBus].label} system health check passed.
      </p>
      <p style="color: var(--text-light); padding: 10px 0; border-bottom: 1px solid var(--border-light);">
        <i class="fas fa-ticket-alt" style="color: var(--primary-blue); margin-right: 10px;"></i>
        ${todays.length} ${BUS_META[currentAdminBus].activityHint} bookings today.
      </p>
      <p style="color: var(--text-light); padding: 10px 0;">
        <i class="fas fa-route" style="color: var(--dark-yellow); margin-right: 10px;"></i>
        ${routes.length} active routes loaded for ${BUS_META[currentAdminBus].label}.
      </p>
    `;
  }
}

function userBus(user) {
  return normalizeBus(user?.selectedBus || user?.preferredBus || user?.bus || '');
}

function filterUsersByBus(users, bus) {
  return (users || []).filter(u => {
    const ub = userBus(u);
    if (!ub) return true; // keep legacy users visible
    return ub === bus;
  });
}

// User Management Logic
function loadUsers() {
  const userDatabase = JSON.parse(localStorage.getItem('userDatabase')) || [];
  const tbody = document.querySelector('#users tbody');
  if (!tbody) return;

  const scoped = filterUsersByBus(userDatabase, currentAdminBus);
  tbody.innerHTML = '';

  scoped.forEach(user => {
    const row = document.createElement('tr');

    let statusBadge = '';
    switch (user.status) {
      case 'active': statusBadge = '<span style="background: #e6f7ee; color: #10b981; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Active</span>'; break;
      case 'blocked': statusBadge = '<span style="background: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Blocked</span>'; break;
      case 'deactivated': statusBadge = '<span style="background: #f3f4f6; color: #6b7280; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Deactivated</span>'; break;
      case 'blacklisted': statusBadge = '<span style="background: #1f2937; color: #f87171; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Blacklisted</span>'; break;
      default: statusBadge = '<span style="background: #f3f4f6; color: #6b7280; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Unknown</span>';
    }

    const uBus = userBus(user);
    const busLabel = uBus ? BUS_META[uBus]?.label || uBus : 'Unassigned';

    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td><span class="bus-chip">${busLabel}</span></td>
      <td>${user.role}</td>
      <td>${statusBadge}</td>
      <td>R ${(user.walletBalance || 0).toFixed(2)}</td>
      <td>
        <div style="display: flex; gap: 5px;">
          ${user.status !== 'blocked'
            ? `<button class="btn btn-outline btn-small" onclick="updateUserStatus('${user.email}', 'blocked')" title="Block" style="color: #ef4444; border-color: #ef4444;"><i class="fas fa-ban"></i></button>`
            : `<button class="btn btn-outline btn-small" onclick="updateUserStatus('${user.email}', 'active')" title="Unblock" style="color: #10b981; border-color: #10b981;"><i class="fas fa-check"></i></button>`}
          ${user.status !== 'blacklisted'
            ? `<button class="btn btn-outline btn-small" onclick="updateUserStatus('${user.email}', 'blacklisted')" title="Blacklist" style="color: black; border-color: black;"><i class="fas fa-skull"></i></button>`
            : `<button class="btn btn-outline btn-small" onclick="updateUserStatus('${user.email}', 'active')" title="Remove Blacklist" style="color: #10b981; border-color: #10b981;"><i class="fas fa-check"></i></button>`}
          ${user.status !== 'deactivated'
            ? `<button class="btn btn-outline btn-small" onclick="updateUserStatus('${user.email}', 'deactivated')" title="Deactivate" style="color: #6b7280; border-color: #6b7280;"><i class="fas fa-power-off"></i></button>`
            : `<button class="btn btn-outline btn-small" onclick="updateUserStatus('${user.email}', 'active')" title="Activate" style="color: #10b981; border-color: #10b981;"><i class="fas fa-power-off"></i></button>`}
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function updateUserStatus(email, status) {
  const userDatabase = JSON.parse(localStorage.getItem('userDatabase')) || [];
  const userIndex = userDatabase.findIndex(u => u.email === email);

  if (userIndex !== -1) {
    if (!confirm(`Are you sure you want to change status to ${status.toUpperCase()}?`)) return;

    userDatabase[userIndex].status = status;
    localStorage.setItem('userDatabase', JSON.stringify(userDatabase));
    loadUsers();
  }
}

// Route Management Logic
function loadRoutes() {
  const routes = getRoutesForBus(currentAdminBus);
  const tbody = document.getElementById('admin-route-list');
  if (!tbody) return;

  const searchInput = document.getElementById('admin-route-search');
  const searchTerm = (searchInput?.value || '').toLowerCase();

  tbody.innerHTML = '';

  const filteredRoutes = routes.filter(r =>
    String(r.name || '').toLowerCase().includes(searchTerm) ||
    String(r.origin || '').toLowerCase().includes(searchTerm) ||
    String(r.destination || '').toLowerCase().includes(searchTerm)
  );

  filteredRoutes.forEach(route => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span style="font-family: monospace; color: var(--text-light);">${route.id}</span></td>
      <td><strong>${route.name}</strong></td>
      <td>${route.origin}</td>
      <td>${route.destination}</td>
      <td><span class="${route.type === 'formal' ? 'status-active' : 'status-delayed'}" style="color: ${route.type === 'formal' ? '#10b981' : '#f59e0b'}; background: ${route.type === 'formal' ? '#e6f7ee' : '#fef3c7'};">${route.type}</span></td>
      <td>R${parseFloat(route.cost).toFixed(2)}</td>
      <td>
        <button class="btn btn-outline btn-small" style="color: var(--primary-blue); border-color: var(--border-light); margin-right: 5px;" onclick="openEditRouteModal('${route.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-outline btn-small" style="color: var(--error-color); border-color: var(--border-light);" onclick="deleteRoute('${route.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function bindRouteSearch() {
  document.getElementById('admin-route-search')?.addEventListener('input', loadRoutes);
}

function parseTimetables(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const route = lines[i];
    const next = lines[i + 1] || '';
    const m = next.match(/^Timetable\s*Number\s*-\s*([0-9.]+)\s*$/i);
    if (!m) continue;
    items.push({ route: route.toUpperCase(), timetable: m[1].trim() });
    i++;
  }
  return items;
}

function bindTimetableImport() {
  const rawInput = document.getElementById('admin-raw-input');
  const applyBtn = document.getElementById('admin-apply-import');
  const loadSample = document.getElementById('admin-load-sample');
  const fileInput = document.getElementById('admin-file-input');
  const serviceSelect = document.getElementById('admin-import-service');
  const statusEl = document.getElementById('admin-import-status');

  if (!rawInput || !applyBtn || !loadSample || !fileInput) return;

  const SAMPLE_GA = `AIRPORT IND-BELLVILLE\nTimetable Number - 004401\n\nAIRPORT IND-BLUEDOWNS\nTimetable Number - 012901\n`;
  const SAMPLE_MYCITI = `CIVIC CENTRE - TABLE VIEW\nTimetable Number - 010101\n\nCAPE TOWN STATION - AIRPORT\nTimetable Number - 010202\n`;

  function updateStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  applyBtn.addEventListener('click', () => {
    const raw = rawInput.value;
    if (!raw || !raw.trim()) {
      alert('Paste your routes into the textarea.');
      return;
    }
    const items = parseTimetables(raw);
    if (!items.length) {
      alert('No valid routes found. Check the format.');
      return;
    }

    const service = serviceSelect ? normalizeBus(serviceSelect.value) : currentAdminBus;
    const key = service === 'myciti' ? 'timetablesRaw_myciti' : 'timetablesRaw_ga';
    localStorage.setItem(key, raw);
    updateStatus(`Imported ${items.length} routes for ${BUS_META[service].label}.`);
  });

  loadSample.addEventListener('click', () => {
    rawInput.value = currentAdminBus === 'myciti' ? SAMPLE_MYCITI : SAMPLE_GA;
    updateStatus('Sample loaded.');
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      rawInput.value = String(reader.result || '');
      updateStatus('File loaded. Click Import to save.');
    };
    reader.readAsText(f);
  });
}

// Add Route
function openAddRouteModal() {
  const defaultType = currentAdminBus === 'myciti' ? 'formal' : 'informal';
  const typeInput = document.getElementById('new-route-type');
  if (typeInput) typeInput.value = defaultType;
  const modal = document.getElementById('add-route-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAddRouteModal() {
  const modal = document.getElementById('add-route-modal');
  if (modal) modal.style.display = 'none';
}

document.getElementById('add-route-form')?.addEventListener('submit', function (e) {
  e.preventDefault();
  const routes = getRoutesForBus(currentAdminBus);

  const newRoute = {
    id: `${currentAdminBus.toUpperCase()}-${Date.now().toString().slice(-6)}`,
    name: document.getElementById('new-route-name').value,
    origin: document.getElementById('new-route-origin').value,
    destination: document.getElementById('new-route-dest').value,
    type: document.getElementById('new-route-type').value,
    cost: parseFloat(document.getElementById('new-route-cost').value),
    time: document.getElementById('new-route-time').value,
    bus: currentAdminBus
  };

  routes.push(newRoute);
  saveRoutesForBus(routes, currentAdminBus);

  closeAddRouteModal();
  e.target.reset();
  loadRoutes();
  loadDashboardStats();
  alert(`${BUS_META[currentAdminBus].label} route added successfully.`);
});

// Edit Route
function openEditRouteModal(id) {
  const routes = getRoutesForBus(currentAdminBus);
  const route = routes.find(r => r.id === id);
  if (!route) return;

  document.getElementById('edit-route-id').value = route.id;
  document.getElementById('edit-route-name').value = route.name;
  document.getElementById('edit-route-origin').value = route.origin;
  document.getElementById('edit-route-dest').value = route.destination;
  document.getElementById('edit-route-type').value = route.type;
  document.getElementById('edit-route-cost').value = route.cost;
  document.getElementById('edit-route-time').value = route.time;

  document.getElementById('edit-route-modal').style.display = 'flex';
}

function closeEditRouteModal() {
  document.getElementById('edit-route-modal').style.display = 'none';
}

document.getElementById('edit-route-form')?.addEventListener('submit', function (e) {
  e.preventDefault();
  const routes = getRoutesForBus(currentAdminBus);
  const id = document.getElementById('edit-route-id').value;
  const index = routes.findIndex(r => r.id === id);

  if (index !== -1) {
    routes[index] = {
      id: id,
      name: document.getElementById('edit-route-name').value,
      origin: document.getElementById('edit-route-origin').value,
      destination: document.getElementById('edit-route-dest').value,
      type: document.getElementById('edit-route-type').value,
      cost: parseFloat(document.getElementById('edit-route-cost').value),
      time: document.getElementById('edit-route-time').value,
      bus: currentAdminBus
    };
    saveRoutesForBus(routes, currentAdminBus);
    closeEditRouteModal();
    loadRoutes();
    loadDashboardStats();
    alert(`${BUS_META[currentAdminBus].label} route updated successfully.`);
  }
});

function deleteRoute(id) {
  if (!confirm('Delete this route?')) return;
  let routes = getRoutesForBus(currentAdminBus);
  routes = routes.filter(r => r.id !== id);
  saveRoutesForBus(routes, currentAdminBus);
  loadRoutes();
  loadDashboardStats();
}
