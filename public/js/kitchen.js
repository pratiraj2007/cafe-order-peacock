// ============================================================
// 🦚 PEACOCK CAFÉ - Kitchen Dashboard JavaScript
// ============================================================
// Handles: Real-time order display, status management,
// sound notifications, filtering, and stats counting
// ============================================================

// --- Connect to Socket.io ---
const socket = io();

// --- State ---
let orders = [];              // All orders
let settings = null;           // App settings (zones, etc.)
let activeFilter = 'All';     // Current filter
let soundEnabled = true;      // Sound notification toggle

// ============================================================
// 🚀 INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  fetchOrders();              // Load existing orders
  fetchSettings();            // Load app settings
  setupEventListeners();      // Bind event listeners
  setupSocketListeners();     // Setup real-time listeners
});

// ============================================================
// 📦 FETCH EXISTING ORDERS
// ============================================================
async function fetchOrders() {
  try {
    const response = await fetch('/api/orders');
    const data = await response.json();

    if (data.success) {
      orders = data.data;
      renderOrders();
      updateStats();
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
  }
}

// ============================================================
// ⚙️ SETTINGS MANAGEMENT (OPEN/CLOSED)
// ============================================================
async function fetchSettings() {
  try {
    const response = await fetch('/api/settings');
    const data = await response.json();
    if (data.success) {
      settings = data.data;
      updateStatusUI();
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
  }
}

function updateStatusUI() {
  const btn = document.getElementById('statusToggleBtn');
  if (!btn || !settings) return;

  if (settings.isOpen) {
    btn.textContent = '🏪 Café: Open';
    btn.className = 'status-toggle-btn open';
  } else {
    btn.textContent = '🔒 Café: Closed';
    btn.className = 'status-toggle-btn closed';
  }
}

async function toggleCafeStatus() {
  if (!settings) return;
  const newStatus = !settings.isOpen;

  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen: newStatus })
    });
    
    const data = await response.json();
    if (data.success) {
      settings = data.data;
      updateStatusUI();
    }
  } catch (error) {
    console.error('Error toggling status:', error);
  }
}

// ============================================================
// 🔌 SOCKET.IO - Real-time Listeners
// ============================================================
function setupSocketListeners() {
  // Receive initial orders on connect
  socket.on('init-orders', (data) => {
    orders = data;
    renderOrders();
    updateStats();
  });

  // New order placed by customer
  socket.on('new-order', (order) => {
    // Add to the beginning of orders array
    orders.unshift(order);
    renderOrders();
    updateStats();

    // Play notification sound
    if (soundEnabled) {
      playNotificationSound();
    }

    // Flash the new order card
    setTimeout(() => {
      const card = document.querySelector(`[data-order-id="${order.orderId}"]`);
      if (card) {
        card.classList.add('new-order');
        setTimeout(() => card.classList.remove('new-order'), 2000);
      }
    }, 100);
  });

  // Order status updated
  socket.on('order-updated', (data) => {
    const order = orders.find(o => o.orderId === data.orderId);
    if (order) {
      order.status = data.status;
      renderOrders();
      updateStats();
    }
  });

  // Order deleted
  socket.on('order-deleted', (data) => {
    orders = orders.filter(o => o.orderId !== data.orderId);
    renderOrders();
    updateStats();
  });
}

// ============================================================
// 🎨 RENDER ORDERS
// ============================================================
function renderOrders() {
  const grid = document.getElementById('ordersGrid');
  const noOrders = document.getElementById('noOrders');

  // Filter orders based on active filter
  const filtered = activeFilter === 'All'
    ? orders
    : orders.filter(o => o.status === activeFilter);

  if (filtered.length === 0) {
    noOrders.style.display = 'block';
    // Remove all order cards but keep the no-orders element
    const cards = grid.querySelectorAll('.order-card');
    cards.forEach(card => card.remove());
    return;
  }

  noOrders.style.display = 'none';

  grid.innerHTML = filtered.map(order => createOrderCardHTML(order)).join('')
    + '<div class="no-orders" id="noOrders" style="display:none;"><div class="no-orders-icon">📋</div><h3>No orders yet</h3><p>New orders will appear here in real-time</p></div>';
}

function createOrderCardHTML(order) {
  const statusClass = order.status.toLowerCase();
  const timeStr = formatTime(order.timestamp);

  // Determine action buttons based on status
  let actionsHTML = '';
  switch (order.status) {
    case 'Pending':
      actionsHTML = `
        <button class="order-action-btn btn-accept" onclick="updateOrderStatus('${order.orderId}', 'Preparing')">
          🔥 Accept & Prepare
        </button>
      `;
      break;
    case 'Preparing':
      actionsHTML = `
        <button class="order-action-btn btn-ready" onclick="updateOrderStatus('${order.orderId}', 'Ready')">
          ✅ Mark Ready
        </button>
      `;
      break;
    case 'Ready':
      actionsHTML = `
        <button class="order-action-btn btn-complete" onclick="updateOrderStatus('${order.orderId}', 'Completed')">
          ✔️ Complete
        </button>
      `;
      break;
    case 'Completed':
      actionsHTML = `
        <button class="order-action-btn btn-delete" onclick="deleteOrder('${order.orderId}')">
          🗑️
        </button>
      `;
      break;
  }

  return `
    <div class="order-card" data-order-id="${order.orderId}">
      <div class="order-card-header">
        <span class="order-id">${order.orderId}</span>
        <span class="order-status-badge ${statusClass}">${order.status}</span>
      </div>

      <div class="order-customer">
        <div class="customer-detail">
          <span class="icon">👤</span>
          <div>
            <div class="label">Customer</div>
            <div class="value">${order.customerName}</div>
          </div>
        </div>
        <div class="customer-detail">
          <span class="icon">${order.tableNumber !== 'N/A' ? '🪑' : '📱'}</span>
          <div>
            <div class="label">${order.tableNumber !== 'N/A' ? 'Table' : 'Mobile'}</div>
            <div class="value">${order.tableNumber !== 'N/A' ? order.tableNumber : order.mobileNumber}</div>
          </div>
        </div>
        <div class="customer-detail">
          <span class="icon">📍</span>
          <div>
            <div class="label">Zone</div>
            <div class="value">${order.zone || 'Main Hall'}</div>
          </div>
        </div>
      </div>

      <div class="order-items">
        ${order.items.map(item => `
          <div class="order-item-row">
            <div class="order-item-left">
              <span class="order-item-emoji">${item.emoji}</span>
              <span class="order-item-name">${item.name}</span>
            </div>
            <span class="order-item-qty">× ${item.quantity}</span>
          </div>
        `).join('')}
      </div>

      <div class="order-total-row">
        <span class="order-total-label">Total</span>
        <span class="order-total-price">₹${order.totalPrice}</span>
      </div>

      <div class="order-time">
        🕐 ${timeStr}
      </div>

      <div class="order-actions">
        ${actionsHTML}
      </div>
    </div>
  `;
}

// ============================================================
// 📊 UPDATE STATS
// ============================================================
function updateStats() {
  const pending = orders.filter(o => o.status === 'Pending').length;
  const preparing = orders.filter(o => o.status === 'Preparing').length;
  const ready = orders.filter(o => o.status === 'Ready').length;
  const total = orders.length;

  document.getElementById('statPending').textContent = pending;
  document.getElementById('statPreparing').textContent = preparing;
  document.getElementById('statReady').textContent = ready;
  document.getElementById('statTotal').textContent = total;
}

// ============================================================
// 🔄 UPDATE ORDER STATUS
// ============================================================
async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await response.json();

    if (data.success) {
      // Update local state
      const order = orders.find(o => o.orderId === orderId);
      if (order) {
        order.status = newStatus;
        renderOrders();
        updateStats();
      }
    }
  } catch (error) {
    console.error('Error updating order:', error);
  }
}

// ============================================================
// 🗑️ DELETE ORDER
// ============================================================
async function deleteOrder(orderId) {
  if (!confirm(`Delete order ${orderId}?`)) return;

  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      orders = orders.filter(o => o.orderId !== orderId);
      renderOrders();
      updateStats();
    }
  } catch (error) {
    console.error('Error deleting order:', error);
  }
}

// ============================================================
// 🔔 SOUND NOTIFICATION
// ============================================================
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Create a pleasant two-tone chime
    const frequencies = [830, 1050, 830];
    const durations = [0.1, 0.1, 0.15];
    let startTime = audioCtx.currentTime;

    frequencies.forEach((freq, i) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i] + 0.1);

      oscillator.start(startTime);
      oscillator.stop(startTime + durations[i] + 0.15);

      startTime += durations[i];
    });
  } catch (e) {
    console.log('Sound notification not supported');
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('soundToggle');
  btn.textContent = soundEnabled ? '🔔' : '🔕';
  btn.classList.toggle('active', soundEnabled);
}

// ============================================================
// 🏷️ FILTER TABS
// ============================================================
function setFilter(filter) {
  activeFilter = filter;

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });

  renderOrders();
}

// ============================================================
// ⏰ TIME FORMATTING
// ============================================================
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  // Format as time
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// ============================================================
// 🎯 EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Sound toggle
  document.getElementById('soundToggle').addEventListener('click', toggleSound);

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });

  // Café Status Toggle
  document.getElementById('statusToggleBtn').addEventListener('click', toggleCafeStatus);
}
