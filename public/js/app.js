// ============================================================
// 🦚 PEACOCK CAFÉ - Customer App JavaScript
// ============================================================
// Handles: Menu rendering, Cart management, Checkout flow,
// Dark mode, QR code, Socket.io real-time, Animations
// ============================================================

// --- Connect to Socket.io server ---
const socket = io();

// --- State ---
let menuItems = [];       // All menu items from the API
let cart = [];             // Cart items: [{ id, name, emoji, price, category, quantity }]
let activeCategory = 'All';

// ============================================================
// 🚀 INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadCart();              // Load cart from localStorage
  fetchMenu();             // Fetch menu from API
  fetchSettings();         // Fetch app settings (like active zones)
  setupEventListeners();   // Bind all event listeners
  loadTheme();             // Apply saved theme
  generateQRCode();        // Generate QR code
  setupScrollEffects();    // Header scroll effect
});

// ============================================================
// 📋 FETCH MENU FROM API
// ============================================================
async function fetchMenu() {
  try {
    const response = await fetch('/api/menu');
    const data = await response.json();

    if (data.success) {
      menuItems = data.data;
      renderMenu();
    }
  } catch (error) {
    console.error('Error fetching menu:', error);
    showToast('Failed to load menu. Please refresh.');
  }
}

// --- Fetch app settings (like café status) ---
async function fetchSettings() {
  try {
    const response = await fetch('/api/settings');
    const data = await response.json();

    if (data.success) {
      updateCafeStatusUI(data.data.isOpen);
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
  }
}

// --- Update UI based on café status ---
function updateCafeStatusUI(isOpen) {
  const overlay = document.getElementById('closedOverlay');
  if (isOpen) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    closeCart(); // Close cart if they were ordering
  }
}

// ============================================================
// 🍽️ RENDER MENU ITEMS
// ============================================================
function renderMenu() {
  const grid = document.getElementById('menuGrid');
  
  // Filter items by active category
  const filtered = activeCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === activeCategory);

  // Build HTML for each menu item
  grid.innerHTML = filtered.map(item => {
    const categoryClass = item.category.toLowerCase();
    const cartItem = cart.find(c => c.id === item.id);
    const inCart = cartItem ? true : false;

    return `
      <div class="menu-card ${item.isSpecial ? 'special-item' : ''}" data-id="${item.id}">
        <div class="menu-card-image ${categoryClass}">
          ${item.image 
            ? `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" />` 
            : `<span class="menu-card-emoji">${item.emoji}</span>`
          }
          ${item.tags.length > 0 ? `
            <div class="menu-card-tags">
              ${item.tags.map(tag => `<span class="menu-tag">${tag}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="menu-card-body">
          <h3 class="menu-card-name">${item.name}</h3>
          <p class="menu-card-desc">${item.description}</p>
          <div class="menu-card-footer">
            <div class="menu-card-price"><span>₹</span>${item.price}</div>
            <button class="add-to-cart-btn ${inCart ? 'added' : ''}" 
                    onclick="addToCart(${item.id})"
                    id="add-btn-${item.id}">
              <span class="btn-icon">${inCart ? '✓' : '+'}</span>
              <span class="btn-label">${inCart ? 'Added' : 'Add'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// 🛒 CART MANAGEMENT
// ============================================================

// Add item to cart
function addToCart(itemId) {
  const menuItem = menuItems.find(m => m.id === itemId);
  if (!menuItem) return;

  const existingItem = cart.find(c => c.id === itemId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: menuItem.id,
      name: menuItem.name,
      emoji: menuItem.emoji,
      image: menuItem.image,
      price: menuItem.price,
      category: menuItem.category,
      quantity: 1
    });
  }

  saveCart();
  updateCartUI();
  animateAddButton(itemId);
  showToast(`${menuItem.emoji} ${menuItem.name} added to cart!`);
}

// Remove item from cart
function removeFromCart(itemId) {
  cart = cart.filter(c => c.id !== itemId);
  saveCart();
  updateCartUI();
  renderMenu(); // Update "Added" state on menu cards
}

// Update item quantity
function updateQuantity(itemId, delta) {
  const item = cart.find(c => c.id === itemId);
  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    removeFromCart(itemId);
    return;
  }

  saveCart();
  updateCartUI();
}

// Calculate total price
function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Get total item count
function getCartCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// Save cart to localStorage
function saveCart() {
  localStorage.setItem('peacock_cart', JSON.stringify(cart));
}

// Load cart from localStorage
function loadCart() {
  try {
    const saved = localStorage.getItem('peacock_cart');
    if (saved) {
      cart = JSON.parse(saved);
    }
  } catch (e) {
    cart = [];
  }
}

// ============================================================
// 🎨 UPDATE CART UI
// ============================================================
function updateCartUI() {
  const count = getCartCount();
  const total = getCartTotal();

  // Update header cart count badge
  const countEl = document.getElementById('cartCount');
  const floatCountEl = document.getElementById('floatCount');

  if (count > 0) {
    countEl.textContent = count;
    countEl.classList.remove('hidden');
    countEl.classList.add('bump');
    setTimeout(() => countEl.classList.remove('bump'), 400);

    floatCountEl.textContent = count;
    floatCountEl.style.display = 'flex';
  } else {
    countEl.classList.add('hidden');
    floatCountEl.style.display = 'none';
  }

  // Render cart items in drawer
  renderCartItems();

  // Show/hide footer
  const footer = document.getElementById('cartFooter');
  if (cart.length > 0) {
    footer.style.display = 'block';
    document.getElementById('cartTotalPrice').textContent = `₹${total}`;
  } else {
    footer.style.display = 'none';
  }
}

function renderCartItems() {
  const container = document.getElementById('cartItems');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Browse our menu and add your favorites!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = cart.map(item => {
    const categoryClass = item.category.toLowerCase();
    return `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-emoji ${categoryClass}">
          ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md);">` : item.emoji}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${item.price} each</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn ${item.quantity <= 1 ? 'remove' : ''}" 
                  onclick="updateQuantity(${item.id}, -1)">
            ${item.quantity <= 1 ? '🗑️' : '−'}
          </button>
          <span class="cart-item-qty">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
        </div>
        <div class="cart-item-subtotal">₹${item.price * item.quantity}</div>
      </div>
    `;
  }).join('');
}

// Animate the "Add" button on menu card
function animateAddButton(itemId) {
  const btn = document.getElementById(`add-btn-${itemId}`);
  if (!btn) return;

  btn.classList.add('added');
  btn.querySelector('.btn-icon').textContent = '✓';
  btn.querySelector('.btn-label').textContent = 'Added';

  setTimeout(() => {
    btn.classList.remove('added');
    const cartItem = cart.find(c => c.id === itemId);
    if (!cartItem) {
      btn.querySelector('.btn-icon').textContent = '+';
      btn.querySelector('.btn-label').textContent = 'Add';
    }
  }, 1500);
}

// ============================================================
// 🛒 CART DRAWER (Open / Close)
// ============================================================
function openCart() {
  document.getElementById('cartOverlay').classList.add('active');
  document.getElementById('cartDrawer').classList.add('active');
  document.body.style.overflow = 'hidden';
  updateCartUI();

  // Always show cart view first
  document.getElementById('cartView').classList.remove('hidden');
  document.getElementById('checkoutView').classList.remove('active');
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('active');
  document.getElementById('cartDrawer').classList.remove('active');
  document.body.style.overflow = '';

  // Reset to cart view
  document.getElementById('cartView').classList.remove('hidden');
  document.getElementById('checkoutView').classList.remove('active');
}

// ============================================================
// 📋 CHECKOUT FLOW
// ============================================================
function showCheckout() {
  if (cart.length === 0) return;

  // Hide cart view, show checkout view
  document.getElementById('cartView').classList.add('hidden');
  document.getElementById('checkoutView').classList.add('active');

  // Populate checkout summary
  renderCheckoutSummary();
}

function hideCheckout() {
  document.getElementById('cartView').classList.remove('hidden');
  document.getElementById('checkoutView').classList.remove('active');
}

function renderCheckoutSummary() {
  const summaryEl = document.getElementById('checkoutSummary');
  const total = getCartTotal();

  let rows = cart.map(item => `
    <div class="checkout-summary-row">
      <span>${item.emoji} ${item.name} × ${item.quantity}</span>
      <span>₹${item.price * item.quantity}</span>
    </div>
  `).join('');

  rows += `
    <div class="checkout-summary-row total">
      <span>Total</span>
      <span>₹${total}</span>
    </div>
  `;

  summaryEl.innerHTML = rows;
}

// ============================================================
// 🚀 PLACE ORDER
// ============================================================
async function placeOrder() {
  const customerName = document.getElementById('customerName').value.trim();
  const tableNumber = document.getElementById('tableNumber').value.trim();
  const mobileNumber = document.getElementById('mobileNumber').value.trim();

  const socketId = socket.id; // Get current socket ID for targeted notifications

  // Validation
  if (!customerName) {
    showToast('⚠️ Please enter your name');
    document.getElementById('customerName').focus();
    return;
  }

  if (tableNumber) {
    const tableNum = parseInt(tableNumber, 10);
    if (isNaN(tableNum) || tableNum < 1 || tableNum > 10) {
      showToast('⚠️ Table number must be between 1 and 10');
      document.getElementById('tableNumber').focus();
      return;
    }
  }

  if (mobileNumber && !/^[0-9]{10}$/.test(mobileNumber)) {
    showToast('⚠️ Mobile number must be 10 digits');
    document.getElementById('mobileNumber').focus();
    return;
  }

  if (!tableNumber && !mobileNumber) {
    showToast('⚠️ Please enter table number or mobile');
    document.getElementById('tableNumber').focus();
    return;
  }

  // Disable button and show loading
  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true;
  btn.classList.add('loading');

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(item => ({ id: item.id, quantity: item.quantity })),
        customerName,
        tableNumber: tableNumber || undefined,
        mobileNumber: mobileNumber || undefined,
        socketId: socketId
      })
    });

    const data = await response.json();

    if (data.success) {
      // Show success modal
      showSuccessModal(data.data.orderId);

      // Clear cart
      cart = [];
      saveCart();
      updateCartUI();
      renderMenu();

      // Close cart drawer
      closeCart();

      // Clear form
      document.getElementById('customerName').value = '';
      document.getElementById('tableNumber').value = '';
      document.getElementById('mobileNumber').value = '';
    } else {
      showToast(`❌ ${data.message}`);
    }
  } catch (error) {
    console.error('Error placing order:', error);
    showToast('❌ Failed to place order. Try again.');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

// ============================================================
// ✅ SUCCESS MODAL
// ============================================================
function showSuccessModal(orderId) {
  document.getElementById('successOrderId').textContent = orderId;
  const overlay = document.getElementById('successOverlay');
  overlay.classList.add('active');

  // Add confetti particles
  createConfetti();
}

function closeSuccessModal() {
  document.getElementById('successOverlay').classList.remove('active');
}

function createConfetti() {
  const modal = document.getElementById('successModal');
  const colors = ['#D4A574', '#B85C38', '#5C3D2E', '#4CAF50', '#FF9800', '#E8C39E'];

  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.top = '-10px';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.width = (Math.random() * 8 + 4) + 'px';
    confetti.style.height = (Math.random() * 8 + 4) + 'px';
    modal.appendChild(confetti);

    // Remove after animation
    setTimeout(() => confetti.remove(), 2000);
  }
}

// ============================================================
// 🏷️ CATEGORY FILTERING
// ============================================================
function setCategory(category) {
  activeCategory = category;

  // Update active tab
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });

  // Re-render menu with animation
  renderMenu();
}

// ============================================================
// 🌙 DARK MODE TOGGLE
// ============================================================
function toggleTheme() {
  const body = document.body;
  const isDark = body.getAttribute('data-theme') === 'dark';

  if (isDark) {
    body.removeAttribute('data-theme');
    document.getElementById('themeToggle').textContent = '🌙';
    localStorage.setItem('peacock_theme', 'light');
  } else {
    body.setAttribute('data-theme', 'dark');
    document.getElementById('themeToggle').textContent = '☀️';
    localStorage.setItem('peacock_theme', 'dark');
  }
}

function loadTheme() {
  const saved = localStorage.getItem('peacock_theme');
  if (saved === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('themeToggle').textContent = '☀️';
  }
}

// ============================================================
// 📱 QR CODE GENERATION
// ============================================================
function generateQRCode() {
  const container = document.getElementById('qr-code-container');
  if (!container) return;

  // Use the current URL for the QR code
  const url = window.location.href;

  // Check if QRCode library is loaded
  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(url, {
      width: 180,
      margin: 2,
      color: { dark: '#5C3D2E', light: '#FDF6EC' }
    }, (err, canvas) => {
      if (err) {
        console.error('QR generation error:', err);
        container.innerHTML = '<p style="color: var(--text-muted);">QR code unavailable</p>';
        return;
      }
      canvas.style.borderRadius = '12px';
      container.appendChild(canvas);
    });
  }
}

// ============================================================
// 🍞 TOAST NOTIFICATIONS
// ============================================================
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  // Auto-remove after animation
  setTimeout(() => toast.remove(), 2500);
}

// ============================================================
// 📜 SCROLL EFFECTS
// ============================================================
function setupScrollEffects() {
  const header = document.getElementById('header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  });
}

// ============================================================
// 🔌 SOCKET.IO - Real-time Updates
// ============================================================
// Listen for order status updates (optional: show customer their order status)
socket.on('order-updated', (data) => {
  console.log('Order updated:', data);
});

// Listen for settings updates (like café being opened/closed)
socket.on('settings-updated', (data) => {
  console.log('Settings updated:', data);
  if (typeof data.isOpen === 'boolean') {
    updateCafeStatusUI(data.isOpen);
    showToast(`🏪 Café is now ${data.isOpen ? 'Open' : 'Closed'}`);
  }
});

// Listen for specific "Order Ready" notification
socket.on('order-ready', (order) => {
  console.log('🎉 Your order is ready!', order);
  showReadyModal(order);
  playNotificationSound();
});

// ============================================================
// 🔔 NOTIFICATION UTILS
// ============================================================
function showReadyModal(order) {
  const overlay = document.getElementById('readyOverlay');
  const displayId = document.getElementById('readyOrderIdDisplay');
  
  if (displayId) displayId.textContent = `ORDER #${order.orderId}`;
  if (overlay) overlay.classList.add('active');
  
  // Confetti effect could be added here if desired
}

function closeReadyModal() {
  const overlay = document.getElementById('readyOverlay');
  if (overlay) overlay.classList.remove('active');
}

function playNotificationSound() {
  const audio = document.getElementById('notificationSound');
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(err => console.log('Audio play failed:', err));
  }
}

// ============================================================
// 🎯 EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Cart buttons
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('floatingCart').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  // Checkout flow
  document.getElementById('checkoutBtn').addEventListener('click', showCheckout);
  document.getElementById('backToCart').addEventListener('click', hideCheckout);
  document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);

  // Success modal
  document.getElementById('successCloseBtn').addEventListener('click', closeSuccessModal);
  document.getElementById('successOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('successOverlay')) closeSuccessModal();
  });

  // Category tabs
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => setCategory(tab.dataset.category));
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Ready Modal close
  document.getElementById('readyCloseBtn').addEventListener('click', closeReadyModal);

  // Close cart with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      closeSuccessModal();
      closeReadyModal();
    }
  });
}
