// ============================================================
// 🦚 PEACOCK CAFÉ - Server (Node.js + Express + Socket.io)
// ============================================================
// This is the main backend server that handles:
// 1. Serving static frontend files
// 2. API routes for menu and orders
// 3. Real-time communication via WebSockets (Socket.io)
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// --- Create Express App & HTTP Server ---
const app = express();
const server = http.createServer(app);

// --- Setup Socket.io for real-time communication ---
const io = new Server(server, {
  cors: { origin: '*' }
});

// --- Middleware ---
app.use(cors());
app.use(express.json()); // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend files

// ============================================================
// 📋 MENU DATA
// ============================================================
// In a production app, this would come from a database.
// For simplicity, we define it here.
const menuItems = [
  // ☕ BEVERAGES
  {
    id: 1, name: 'Cold Coffee', price: 40, category: 'Beverages',
    emoji: '🧊', image: 'https://static.vecteezy.com/system/resources/thumbnails/046/993/301/small/tall-glass-of-cold-foam-coffee-photo.jpeg', description: 'Refreshing cold coffee',
    tags: []
  },
  {
    id: 2, name: 'Hot Coffee', price: 30, category: 'Beverages',
    emoji: '☕', image: 'https://thumbs.dreamstime.com/b/cup-hot-coffee-foam-sharp-focus-foam-coffee-beans-scattered-background-burlap-background-beautiful-light-photo-345328512.jpg', description: 'Classic hot brewed coffee',
    tags: []
  },
  {
    id: 3, name: 'Tea', price: 15, category: 'Beverages',
    emoji: '🍵', image: 'https://cdn2.foodviva.com/static-content/food-images/tea-recipes/milk-tea-recipe/milk-tea-recipe.jpg', description: 'Freshly brewed and aromatic tea',
    tags: []
  },
  {
    id: 4, name: 'Bournvita', price: 20, category: 'Beverages',
    emoji: '🥛', image: 'https://static.toiimg.com/thumb/57809429.cms?imgsize=374164&width=800&height=800', description: 'Hot milk with Bournvita',
    tags: ['⭐ Signature Special'],
    isSpecial: true
  },

  // 🥐 SNACKS
  {
    id: 5, name: 'French Fries', price: 70, category: 'Snacks',
    emoji: '🍟', image: 'https://img.freepik.com/premium-photo/french-fries-with-sauce-plate-dark-background_210632-2322.jpg', description: 'Crispy golden potato fries',
    tags: []
  },
  {
    id: 6, name: 'Sandwich', price: 40, category: 'Snacks',
    emoji: '🥪', image: 'https://thumbs.dreamstime.com/b/veg-grilled-sandwich-served-ketchup-isolated-over-rustic-wooden-background-selective-focus-224440470.jpg', description: 'Classic vegetable sandwich',
    tags: []
  },
  {
    id: 7, name: 'Cheese Sandwich', price: 50, category: 'Snacks',
    emoji: '🧀', image: 'https://orderfood.cafebeats.in/wp-content/uploads/2022/05/Cheese-Bombay-Grill.png', description: 'Grilled sandwich loaded with melted cheese',
    tags: []
  },
  {
    id: 8, name: 'Maggi', price: 30, category: 'Snacks',
    emoji: '🍜', image: 'https://t3.ftcdn.net/jpg/16/90/94/76/360_F_1690947676_f3nJRDbZ4XgXE9bVZHRQidLeFE1p2Eqw.jpg', description: 'Classic instant masala noodles',
    tags: []
  },
  {
    id: 9, name: 'Cheese Maggi', price: 40, category: 'Snacks',
    emoji: '🍜', image: 'https://static.india.com/wp-content/uploads/2024/08/FEATURE-IMAGE-6-1.jpg?impolicy=Medium_Widthonly&w=350&h=263', description: 'Masala noodles topped with grated cheese',
    tags: []
  }
];

// ============================================================
// 📦 ORDERS STORAGE
// ============================================================
// In-memory storage with file backup for persistence
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Default zones configuration
const DEFAULT_ZONES = [
  { id: 'main', name: 'Main Hall', emoji: '🏛️', active: true },
  { id: 'terrace', name: 'Outdoor Terrace', emoji: '🌿', active: true },
  { id: 'garden', name: 'Garden Area', emoji: '🌸', active: true },
  { id: 'ac', name: 'AC Cabin', emoji: '❄️', active: true }
];

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing orders from file (if any)
let orders = [];
try {
  if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
  }
} catch (err) {
  console.log('No existing orders found, starting fresh.');
  orders = [];
}

// Save orders to file (called after every change)
function saveOrders() {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('Error saving orders:', err);
  }
}

// Settings management
let settings = { zones: DEFAULT_ZONES };
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } else {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  }
} catch (err) {
  console.log('Error loading settings, using defaults.');
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// Generate a short, friendly order ID like "ORD-A3X7"
function generateOrderId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ORD-';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (orders.find(o => o.orderId === id)) {
    return generateOrderId();
  }
  return id;
}

// ============================================================
// 🔌 API ROUTES
// ============================================================

// GET /api/menu - Returns all menu items
app.get('/api/menu', (req, res) => {
  res.json({
    success: true,
    data: menuItems
  });
});

// GET /api/settings - Returns current settings
app.get('/api/settings', (req, res) => {
  res.json({
    success: true,
    data: settings
  });
});

// PATCH /api/settings/zones - Update zone status
app.patch('/api/settings/zones', (req, res) => {
  const { zoneId, active } = req.body;
  const zone = settings.zones.find(z => z.id === zoneId);
  
  if (!zone) {
    return res.status(404).json({ success: false, message: 'Zone not found' });
  }

  zone.active = active;
  saveSettings();

  // Notify all connected clients of settings change
  io.emit('settings-updated', settings);

  res.json({ success: true, data: settings });
});

// POST /api/orders - Place a new order
app.post('/api/orders', (req, res) => {
  const { items, customerName, tableNumber, mobileNumber } = req.body;

  // Validate request
  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }
  if (!customerName) {
    return res.status(400).json({ success: false, message: 'Customer name is required' });
  }

  // Calculate total price
  let totalPrice = 0;
  const orderItems = items.map(item => {
    const menuItem = menuItems.find(m => m.id === item.id);
    if (!menuItem) return null;
    const subtotal = menuItem.price * item.quantity;
    totalPrice += subtotal;
    return {
      id: menuItem.id,
      name: menuItem.name,
      emoji: menuItem.emoji,
      price: menuItem.price,
      quantity: item.quantity,
      subtotal
    };
  }).filter(Boolean);

  // Create order object
  const order = {
    orderId: generateOrderId(),
    items: orderItems,
    totalPrice,
    customerName,
    tableNumber: tableNumber || 'N/A',
    mobileNumber: mobileNumber || 'N/A',
    zone: req.body.zone || 'Main Hall', // Default to Main Hall if not provided
    status: 'Pending',       // Pending → Preparing → Ready
    timestamp: new Date().toISOString(),
    createdAt: Date.now()
  };

  // Store the order
  orders.unshift(order); // Add to beginning (newest first)
  saveOrders();

  // 🔴 REAL-TIME: Notify kitchen dashboard
  io.emit('new-order', order);

  console.log(`✅ New order: ${order.orderId} by ${customerName}`);

  res.json({
    success: true,
    data: order,
    message: 'Order placed successfully!'
  });
});

// GET /api/orders - Get all orders (for kitchen dashboard)
app.get('/api/orders', (req, res) => {
  res.json({
    success: true,
    data: orders
  });
});

// PATCH /api/orders/:orderId - Update order status
app.patch('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = ['Pending', 'Preparing', 'Ready', 'Completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  // Find and update the order
  const order = orders.find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  saveOrders();

  // 🔴 REAL-TIME: Notify all clients of status change
  io.emit('order-updated', { orderId, status });

  console.log(`📋 Order ${orderId} → ${status}`);

  res.json({
    success: true,
    data: order,
    message: `Order ${orderId} updated to ${status}`
  });
});

// DELETE /api/orders/:orderId - Delete/clear a completed order
app.delete('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const index = orders.findIndex(o => o.orderId === orderId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  orders.splice(index, 1);
  saveOrders();

  io.emit('order-deleted', { orderId });

  res.json({ success: true, message: `Order ${orderId} deleted` });
});

// ============================================================
// 🔌 SOCKET.IO - Real-time Connection
// ============================================================
io.on('connection', (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // Send current orders to newly connected kitchen dashboard
  socket.emit('init-orders', orders);

  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// ============================================================
// 🚀 START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║                                          ║');
  console.log('  ║     🦚 PEACOCK CAFÉ SERVER RUNNING       ║');
  console.log('  ║                                          ║');
  console.log(`  ║   📱 Menu:     http://localhost:${PORT}       ║`);
  console.log(`  ║   👨‍🍳 Kitchen:  http://localhost:${PORT}/kitchen.html  ║`);
  console.log('  ║                                          ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
