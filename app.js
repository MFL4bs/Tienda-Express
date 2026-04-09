// ─── GUARD DE SESIÓN ─────────────────────────────────────────────────────────
(function() {
  const role = sessionStorage.getItem('te_role');
  console.log('[GUARD] role en sessionStorage:', role);
  if (!role) {
    window.location.replace('login.html');
  }
})();

history.pushState(null, '', location.href);
window.addEventListener('popstate', () => history.pushState(null, '', location.href));

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function doLogout() {
  sessionStorage.removeItem('te_role');
  sessionStorage.removeItem('te_user');
  window.location.replace('login.html');
}

// ─── HELPERS PEDIDOS ──────────────────────────────────────────────────────────
function getOrders() {
  return JSON.parse(localStorage.getItem('te_orders') || '[]');
}
function saveOrders(orders) {
  localStorage.setItem('te_orders', JSON.stringify(orders));
}

// ─── HELPERS PRODUCTOS ────────────────────────────────────────────────────────
function getCustomProducts() {
  return JSON.parse(localStorage.getItem('te_products') || '[]');
}
function saveCustomProducts() {
  const products = [];
  document.querySelectorAll('#productsGrid .product-card[data-custom]').forEach(card => {
    products.push({
      name:  card.querySelector('h3').textContent,
      desc:  card.querySelector('p').textContent,
      price: parseInt(card.querySelector('.price').textContent.replace(/[^0-9]/g, '')),
      emoji: card.querySelector('.product-img').textContent.trim(),
      cat:   card.dataset.cat,
    });
  });
  localStorage.setItem('te_products', JSON.stringify(products));
}
function loadCustomProducts() {
  // Ocultar productos base eliminados por admin
  const removed = JSON.parse(localStorage.getItem('te_products_removed') || '[]');
  document.querySelectorAll('#productsGrid .product-card:not([data-custom])').forEach(card => {
    const name = card.querySelector('h3').textContent;
    if (removed.includes(name)) card.remove();
  });
  // Cargar productos custom guardados
  getCustomProducts().forEach(p => insertProductCard(p));
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const role = sessionStorage.getItem('te_role');
  const user = sessionStorage.getItem('te_user');

  const headerUser = document.getElementById('headerUser');
  if (headerUser) {
    const icons = { admin: '🛠️', driver: '🚴', user: '👤' };
    headerUser.textContent = (icons[role] || '👤') + ' ' + user;
  }

  loadCustomProducts();

  if (role === 'admin') {
    document.getElementById('navAdmin').classList.remove('hidden');
    document.getElementById('navCartDesktop').classList.add('hidden');
    document.getElementById('navCartMobile').classList.add('hidden');
    document.getElementById('cartBar').classList.add('hidden');
    renderAdminList();
    showSection('admin');

  } else if (role === 'driver') {
    const navDriver = document.getElementById('navDriver');
    const navCartD  = document.getElementById('navCartDesktop');
    const navCartM  = document.getElementById('navCartMobile');
    const cartBar   = document.getElementById('cartBar');
    if (navDriver) navDriver.classList.remove('hidden');
    if (navCartD)  navCartD.classList.add('hidden');
    if (navCartM)  navCartM.classList.add('hidden');
    if (cartBar)   cartBar.classList.add('hidden');
    document.querySelectorAll('#mainNav > a').forEach(a => a.classList.add('hidden'));
    document.getElementById('navGroupAccount')?.classList.remove('hidden');

    console.log('[Driver] Panel iniciando...');
    console.log('[Driver] Pedidos en localStorage:', getOrders());

    renderDriverPanel();
    showSection('driver');

    window.addEventListener('storage', e => {
      if (e.key === 'te_orders') {
        console.log('[Driver] storage event recibido, actualizando...');
        renderDriverPanel();
      }
    });
    setInterval(() => {
      console.log('[Driver] polling tick, pedidos:', getOrders().length);
      renderDriverPanel();
    }, 2000);

  } else {
    showSection('catalog');
    startOrderPolling();
    renderMyOrders();
  }
});

// ─── TOASTS ───────────────────────────────────────────────────────────────────
function toast(type, title, msg, duration = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-close" onclick="dismissToast(this.parentElement)">✕</button>
    <div class="toast-progress" style="animation-duration:${duration}ms"></div>
  `;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => dismissToast(el), duration);
}

function dismissToast(el) {
  if (!el || el.classList.contains('hide')) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 300);
}

// ─── MODAL PEDIDO CONFIRMADO ──────────────────────────────────────────────────
function showOrderModal(orderId, itemCount, total) {
  const overlay = document.createElement('div');
  overlay.className = 'order-modal-overlay';
  overlay.innerHTML = `
    <div class="order-modal">
      <div class="order-modal-icon">🎉</div>
      <h2>¡Pedido confirmado!</h2>
      <p>Tu pedido ha sido recibido y está siendo preparado</p>
      <div class="order-modal-id">${orderId}</div>
      <p style="font-size:0.82rem;margin-bottom:16px">
        ${itemCount} producto${itemCount !== 1 ? 's' : ''} · <strong style="color:var(--primary)">${total}</strong>
      </p>
      <div class="order-modal-steps">
        <div class="order-step done"><div class="order-step-dot">✅</div><span>Confirmado</span></div>
        <div class="order-step-line"></div>
        <div class="order-step active"><div class="order-step-dot">👨‍🍳</div><span>Preparando</span></div>
        <div class="order-step-line"></div>
        <div class="order-step"><div class="order-step-dot">🚴</div><span>En camino</span></div>
        <div class="order-step-line"></div>
        <div class="order-step"><div class="order-step-dot">📦</div><span>Entregado</span></div>
      </div>
      <button class="btn-modal-track" onclick="closeOrderModal(this); showSection('tracking')">
        📍 Rastrear pedido
      </button>
      <button class="btn-modal-close" onclick="closeOrderModal(this)">Seguir comprando</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOrderModal(overlay.querySelector('.btn-modal-close'));
  });
}

function closeOrderModal(btn) {
  const overlay = btn.closest('.order-modal-overlay');
  overlay.style.animation = 'fadeIn 0.2s ease reverse';
  setTimeout(() => overlay.remove(), 180);
}

// ─── MENÚ MÓVIL ───────────────────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('mainNav').classList.toggle('open');
  document.querySelector('.menu-btn').classList.toggle('active');
}
function closeMenu() {
  document.getElementById('mainNav').classList.remove('open');
  document.querySelector('.menu-btn').classList.remove('active');
  closeNavGroups();
}

// ─── DROPDOWN NAV ─────────────────────────────────────────────────────────────
function toggleNavGroup(id) {
  const group = document.getElementById(id);
  const isOpen = group.classList.contains('open');
  closeNavGroups();
  if (!isOpen) group.classList.add('open');
}
function closeNavGroups() {
  document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-group')) closeNavGroups();
});

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
const cart = [];
let lastOrderId = '';

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('main').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-' + name).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'cart') renderCart();
}

// ─── CATÁLOGO ─────────────────────────────────────────────────────────────────
function filterCat(cat, btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.product-card').forEach(card => {
    card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
  });
}

// ─── CARRITO ──────────────────────────────────────────────────────────────────
function addToCart(name, price) {
  const existing = cart.find(i => i.name === name);
  existing ? existing.qty++ : cart.push({ name, price, qty: 1 });
  updateCartBadge();
  showCartBar();
  toast('success', 'Agregado al carrito', name);
}

function updateCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(el => el.textContent = total);
}

function showCartBar() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const qty   = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartBarText').textContent =
    `${qty} producto${qty !== 1 ? 's' : ''} · $${total.toLocaleString('es-CO')}`;
  document.getElementById('cartBar').classList.remove('hidden');
}

function renderCart() {
  const ul    = document.getElementById('cartItems');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (cart.length === 0) {
    ul.innerHTML = '<li class="empty-cart">Aún no has agregado productos</li>';
    document.getElementById('cartTotal').textContent = '$0';
    return;
  }
  ul.innerHTML = cart.map((item, idx) => `
    <li>
      <span>${item.name}</span>
      <div class="qty-controls">
        <button onclick="changeQty(${idx}, -1)">−</button>
        <span>${item.qty}</span>
        <button onclick="changeQty(${idx}, 1)">+</button>
        <span class="item-price">$${(item.price * item.qty).toLocaleString('es-CO')}</span>
      </div>
    </li>
  `).join('');
  document.getElementById('cartTotal').textContent = '$' + total.toLocaleString('es-CO');
}

function changeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartBadge();
  renderCart();
  cart.length === 0
    ? document.getElementById('cartBar').classList.add('hidden')
    : showCartBar();
}

// ─── CONFIRMAR PEDIDO ─────────────────────────────────────────────────────────
function placeOrder(e) {
  e.preventDefault();
  if (cart.length === 0) {
    toast('warning', 'Carrito vacío', 'Agrega productos antes de confirmar.');
    return;
  }
  const name     = document.getElementById('custName').value;
  const address  = document.getElementById('custAddress').value;
  const phone    = document.getElementById('custPhone').value;

  lastOrderId    = '#ORD-' + Math.floor(10000 + Math.random() * 90000);
  const snapshot = [...cart];
  const total    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  // Guardar en localStorage → dispara storage event en la pestaña del driver
  const orders = getOrders();
  orders.push({ id: lastOrderId, name, address, phone, items: snapshot, total, status: 'preparing', ts: Date.now(), username: sessionStorage.getItem('te_user') });
  saveOrders(orders);

  cart.length = 0;
  updateCartBadge();
  document.getElementById('cartBar').classList.add('hidden');
  document.getElementById('checkoutForm').reset();

  showOrderConfirm(lastOrderId, name, address, phone, snapshot, total);
  showOrderModal(lastOrderId, itemCount, '$' + total.toLocaleString('es-CO'));
}

function showOrderConfirm(orderId, name, address, phone, items, total) {
  document.getElementById('orderId').textContent = orderId;
  document.getElementById('trackingItems').innerHTML = items.map(i =>
    `<li><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toLocaleString('es-CO')}</span></li>`
  ).join('');
  document.getElementById('trackingTotal').textContent = '$' + total.toLocaleString('es-CO');

  const msg = encodeURIComponent(`Hola, soy ${name}. Pedido ${orderId} para ${address}. Tel: ${phone}`);
  document.getElementById('waLink').href = `https://wa.me/573001234567?text=${msg}`;

  // Resetear timeline y badge al estado inicial
  const badge = document.getElementById('orderStatus');
  badge.textContent   = '👨‍🍳 Preparando';
  badge.style.background   = 'rgba(255,200,0,0.15)';
  badge.style.color        = '#ffd600';
  badge.style.borderColor  = 'rgba(255,200,0,0.3)';
  document.querySelectorAll('.timeline li').forEach(li => {
    li.classList.remove('done', 'active');
  });
  const tl = document.querySelectorAll('.timeline li');
  if (tl[0]) tl[0].classList.add('done');
  if (tl[1]) tl[1].classList.add('active');

  document.getElementById('orderPanel').classList.remove('hidden');
  showSection('tracking');
  renderMyOrders();

  if (typeof google !== 'undefined' && google.maps) {
    setTimeout(() => { initMap(); google.maps.event.trigger(map, 'resize'); }, 300);
  }
}

// ─── RASTREO MANUAL ───────────────────────────────────────────────────────────
function trackOrder() {
  const input = document.getElementById('orderInput').value.trim();
  if (!input) { toast('warning', 'Campo vacío', 'Ingresa un número de pedido.'); return; }

  const orders = getOrders();
  const order  = orders.find(o => o.id === input);

  document.getElementById('orderId').textContent = input;

  if (order) {
    document.getElementById('trackingItems').innerHTML = order.items.map(i =>
      `<li><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toLocaleString('es-CO')}</span></li>`
    ).join('');
    document.getElementById('trackingTotal').textContent = '$' + order.total.toLocaleString('es-CO');
    lastOrderId = order.id;
    applyOrderStatusUI(order.status);
  } else {
    document.getElementById('trackingItems').innerHTML =
      '<li><span>Hamburguesa Clásica x2</span><span>$18.000</span></li>' +
      '<li><span>Papas Fritas x1</span><span>$6.500</span></li>';
    document.getElementById('trackingTotal').textContent = '$24.500';
  }

  document.getElementById('orderPanel').classList.remove('hidden');
  document.getElementById('orderPanel').scrollIntoView({ behavior: 'smooth' });

  if (typeof google !== 'undefined' && google.maps) {
    setTimeout(() => { initMap(); google.maps.event.trigger(map, 'resize'); }, 300);
  }
}

// ─── MIS PEDIDOS (usuario) ────────────────────────────────────────────────────────────
const STATUS_USER = {
  preparing: { text: '👨🍳 Preparando', color: '#ffd600' },
  onway:     { text: '🚴 En camino',   color: '#ddd'    },
  delivered: { text: '✅ Entregado',    color: 'var(--green)' },
};

function renderMyOrders() {
  const list = document.getElementById('myOrdersList');
  if (!list) return;
  const username = sessionStorage.getItem('te_user');
  const orders   = getOrders().filter(o => o.username === username).reverse();

  if (!orders.length) {
    list.innerHTML = '<li class="empty-cart">No tienes pedidos aún</li>';
    return;
  }

  list.innerHTML = orders.map(o => {
    const st = STATUS_USER[o.status] || STATUS_USER.preparing;
    const date = new Date(o.ts).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    return `
      <li class="my-order-item ${o.status === 'delivered' ? 'mo-delivered' : ''}" onclick="openOrder('${o.id}')">
        <div class="mo-header">
          <strong>${o.id}</strong>
          <span class="mo-status" style="color:${st.color}">${st.text}</span>
        </div>
        <div class="mo-meta">
          <span>📍 ${o.address}</span>
          <span>🕒 ${date}</span>
        </div>
        <div class="mo-items">${o.items.map(i => `${i.name} x${i.qty}`).join(' · ')}</div>
        <div class="mo-footer">
          <span class="mo-total">$${o.total.toLocaleString('es-CO')}</span>
          <span class="mo-action">${o.status !== 'delivered' ? '📍 Ver en mapa →' : '📦 Ver recibo →'}</span>
        </div>
      </li>
    `;
  }).join('');
}

function openOrder(orderId) {
  const orders = getOrders();
  const order  = orders.find(o => o.id === orderId);
  if (!order) return;

  lastOrderId     = orderId;
  lastKnownStatus = '';

  document.getElementById('orderId').textContent = orderId;
  document.getElementById('trackingItems').innerHTML = order.items.map(i =>
    `<li><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toLocaleString('es-CO')}</span></li>`
  ).join('');
  document.getElementById('trackingTotal').textContent = '$' + order.total.toLocaleString('es-CO');

  const msg = encodeURIComponent(`Hola, soy ${order.name}. Pedido ${orderId} para ${order.address}.`);
  document.getElementById('waLink').href = `https://wa.me/573001234567?text=${msg}`;

  applyOrderStatusUI(order.status);

  document.getElementById('orderPanel').classList.remove('hidden');
  document.getElementById('orderPanel').scrollIntoView({ behavior: 'smooth' });

  if (typeof google !== 'undefined' && google.maps) {
    setTimeout(() => { initMap(); google.maps.event.trigger(map, 'resize'); }, 300);
  }
}

// ─── POLLING ESTADO PEDIDO (usuario) ─────────────────────────────────────────
function startOrderPolling() {
  // También escuchar storage event para respuesta inmediata
  window.addEventListener('storage', e => {
    if (e.key === 'te_orders' && lastOrderId) checkOrderStatus();
  });
  // Polling de respaldo cada 2 segundos
  setInterval(() => { if (lastOrderId) checkOrderStatus(); }, 2000);
}

let lastKnownStatus = '';

function checkOrderStatus() {
  const orders = getOrders();
  const order  = orders.find(o => o.id === lastOrderId);
  if (!order || order.status === lastKnownStatus) return;
  lastKnownStatus = order.status;
  applyOrderStatusUI(order.status);
  renderMyOrders(); // refrescar lista
}

function applyOrderStatusUI(status) {
  const badge    = document.getElementById('orderStatus');
  const timeline = document.querySelectorAll('.timeline li');
  if (!badge) return;

  if (status === 'preparing') {
    badge.textContent        = '👨‍🍳 Preparando';
    badge.style.background   = 'rgba(255,200,0,0.15)';
    badge.style.color        = '#ffd600';
    badge.style.borderColor  = 'rgba(255,200,0,0.3)';
    timeline.forEach(li => li.classList.remove('done', 'active'));
    if (timeline[0]) timeline[0].classList.add('done');
    if (timeline[1]) timeline[1].classList.add('active');
  }

  if (status === 'onway') {
    badge.textContent        = '🚴 En camino';
    badge.style.background   = 'rgba(255,255,255,0.08)';
    badge.style.color        = '#ddd';
    badge.style.borderColor  = 'rgba(255,255,255,0.2)';
    timeline.forEach(li => li.classList.remove('done', 'active'));
    if (timeline[0]) timeline[0].classList.add('done');
    if (timeline[1]) timeline[1].classList.add('done');
    if (timeline[2]) timeline[2].classList.add('active');
    toast('info', '🚴 Tu pedido está en camino', 'El domiciliario ya salió con tu pedido', 5000);
    if (map && driverMarker) startMapMovement();
  }

  if (status === 'delivered') {
    badge.textContent        = '✅ Entregado';
    badge.style.background   = 'rgba(0,230,118,0.15)';
    badge.style.color        = 'var(--green)';
    badge.style.borderColor  = 'rgba(0,230,118,0.3)';
    timeline.forEach(li => li.classList.add('done'));
    if (moveInterval) clearInterval(moveInterval);
    toast('success', '✅ ¡Pedido entregado!', '¡Tu pedido ha llegado. Buen provecho! 🎉', 8000);
  }
}

// ─── GOOGLE MAPS ──────────────────────────────────────────────────────────────
const STORE_LOCATION    = { lat: 4.6097, lng: -74.0817 };
const CUSTOMER_LOCATION = { lat: 4.6250, lng: -74.0640 };
let   driverLocation    = { lat: 4.6150, lng: -74.0730 };
let map, driverMarker, directionsRenderer, moveInterval;

function initMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv || typeof google === 'undefined') return;

  driverLocation = { lat: 4.6150, lng: -74.0730 };
  if (moveInterval) clearInterval(moveInterval);

  map = new google.maps.Map(mapDiv, {
    center: driverLocation,
    zoom: 18,
    mapTypeId: 'hybrid',
    tilt: 45,
    mapTypeControl: true,
    mapTypeControlOptions: { mapTypeIds: ['hybrid', 'satellite', 'roadmap'] },
  });

  new google.maps.Marker({ position: STORE_LOCATION, map, title: 'Tienda',
    icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' });
  new google.maps.Marker({ position: CUSTOMER_LOCATION, map, title: 'Tu dirección',
    icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' });
  driverMarker = new google.maps.Marker({ position: driverLocation, map, title: 'Repartidor',
    icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' });

  drawRoute();
}

function drawRoute() {
  const svc = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map, suppressMarkers: true,
    polylineOptions: { strokeColor: '#e94560', strokeWeight: 4 },
  });
  svc.route({
    origin: STORE_LOCATION,
    destination: CUSTOMER_LOCATION,
    travelMode: google.maps.TravelMode.DRIVING,
  }, (result, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(result);
      const eta = document.getElementById('eta');
      if (eta) eta.textContent = result.routes[0].legs[0].duration.text;
    }
  });
}

// Pin se mueve solo cuando el driver marca "en camino"
function startMapMovement() {
  if (!driverMarker) return;
  if (moveInterval) clearInterval(moveInterval);
  const steps = 40;
  let step = 0;
  const latStep = (CUSTOMER_LOCATION.lat - driverLocation.lat) / steps;
  const lngStep = (CUSTOMER_LOCATION.lng - driverLocation.lng) / steps;
  moveInterval = setInterval(() => {
    if (step >= steps) { clearInterval(moveInterval); return; }
    driverLocation = { lat: driverLocation.lat + latStep, lng: driverLocation.lng + lngStep };
    driverMarker.setPosition(driverLocation);
    map.panTo(driverLocation);
    step++;
  }, 3000);
}

// ─── PANEL DRIVER ─────────────────────────────────────────────────────────────
const STATUS_LABEL = {
  preparing: { text: '👨‍🍳 Preparando', cls: 'badge-preparing' },
  onway:     { text: '🚴 En camino',   cls: 'badge-onway'     },
  delivered: { text: '✅ Entregado',    cls: 'badge-delivered' },
};

function renderDriverPanel() {
  const orders    = getOrders();
  const active    = orders.filter(o => o.status !== 'delivered');
  const history   = orders.filter(o => o.status === 'delivered');
  const activeEl  = document.getElementById('driverOrders');
  const historyEl = document.getElementById('driverHistory');

  console.log('[renderDriverPanel] total pedidos:', orders.length, '| activos:', active.length);

  if (!activeEl) {
    console.error('[renderDriverPanel] ERROR: #driverOrders no encontrado en el DOM');
    return;
  }

  activeEl.innerHTML = active.length ? active.map(o => `
    <li class="driver-order-item">
      <div class="doi-header">
        <strong>${o.id}</strong>
        <span class="badge ${STATUS_LABEL[o.status].cls}">${STATUS_LABEL[o.status].text}</span>
      </div>
      <div class="doi-info">
        <span>👤 ${o.name}</span>
        <span>📍 ${o.address}</span>
        <span>📞 ${o.phone}</span>
      </div>
      <div class="doi-items">${o.items.map(i => `${i.name} x${i.qty}`).join(' · ')}</div>
      <div class="doi-total">Total: <strong>$${o.total.toLocaleString('es-CO')}</strong></div>
      <div class="doi-actions">
        ${o.status === 'preparing' ? `<button onclick="updateOrderStatus('${o.id}','onway')">🚴 Salir a entregar</button>` : ''}
        ${o.status === 'onway'     ? `<button class="btn-deliver" onclick="updateOrderStatus('${o.id}','delivered')">✅ Marcar entregado</button>` : ''}
      </div>
    </li>
  `).join('') : '<li class="empty-cart">No hay pedidos activos</li>';

  historyEl.innerHTML = history.length ? history.map(o => `
    <li class="driver-order-item delivered">
      <div class="doi-header">
        <strong>${o.id}</strong>
        <span class="badge badge-delivered">✅ Entregado</span>
      </div>
      <div class="doi-info"><span>👤 ${o.name}</span><span>📍 ${o.address}</span></div>
      <div class="doi-total">$${o.total.toLocaleString('es-CO')}</div>
    </li>
  `).join('') : '<li class="empty-cart">Sin entregas completadas</li>';
}

function updateOrderStatus(orderId, newStatus) {
  const orders = getOrders();
  const order  = orders.find(o => o.id === orderId);
  if (!order) return;
  order.status = newStatus;
  saveOrders(orders); // Esto dispara storage event en la pestaña del usuario
  renderDriverPanel();
  toast('success',
    newStatus === 'onway' ? '🚴 En camino' : '✅ Entregado',
    newStatus === 'onway' ? `Pedido ${orderId} en ruta` : `${orderId} marcado como entregado`
  );
}

// ─── PANEL ADMIN ──────────────────────────────────────────────────────────────
const CATEGORY_LABELS = { burger: '🍔 Hamburguesas', side: '🍟 Acompañamientos', drink: '🥤 Bebidas', other: '⭐ Otros' };

function insertProductCard({ name, desc, price, emoji, cat }) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.cat = cat;
  card.dataset.custom = '1';
  card.innerHTML = `
    <div class="product-img">${emoji}</div>
    <div class="product-body">
      <h3>${name}</h3>
      <p>${desc}</p>
      <div class="product-footer">
        <span class="price">$${price.toLocaleString('es-CO')}</span>
        <button onclick="addToCart('${name}', ${price})">+ Agregar</button>
      </div>
    </div>
  `;
  document.getElementById('productsGrid').appendChild(card);
}

function addProduct(e) {
  e.preventDefault();
  const p = {
    name:  document.getElementById('pName').value.trim(),
    desc:  document.getElementById('pDesc').value.trim(),
    price: parseInt(document.getElementById('pPrice').value),
    emoji: document.getElementById('pEmoji').value.trim(),
    cat:   document.getElementById('pCat').value,
  };
  insertProductCard(p);
  saveCustomProducts();
  renderAdminList();
  document.getElementById('adminForm').reset();
  toast('success', 'Producto agregado', `${p.name} ya está disponible en el menú.`);
  const btn = e.target.querySelector('button[type=submit]');
  btn.textContent = '✅ Agregado';
  setTimeout(() => btn.textContent = '+ Agregar al menú', 1800);
}

function removeProduct(btn) {
  const item = btn.closest('.admin-product-item');
  const name = item.dataset.name;
  document.querySelectorAll('#productsGrid .product-card').forEach(c => {
    if (c.querySelector('h3')?.textContent === name) {
      // Si es producto base, guardarlo en la lista de eliminados
      if (!c.dataset.custom) {
        const removed = JSON.parse(localStorage.getItem('te_products_removed') || '[]');
        if (!removed.includes(name)) removed.push(name);
        localStorage.setItem('te_products_removed', JSON.stringify(removed));
      }
      c.remove();
    }
  });
  item.remove();
  saveCustomProducts();
  toast('info', 'Producto eliminado', `${name} fue removido del menú.`);
}

function renderAdminList() {
  const list = document.getElementById('adminProductList');
  if (!list) return;
  list.innerHTML = '';
  document.querySelectorAll('#productsGrid .product-card').forEach(card => {
    const name  = card.querySelector('h3').textContent;
    const price = card.querySelector('.price').textContent;
    const emoji = card.querySelector('.product-img').textContent.trim();
    const cat   = card.dataset.cat;
    const li = document.createElement('li');
    li.className = 'admin-product-item';
    li.dataset.name = name;
    li.innerHTML = `
      <span class="ap-emoji">${emoji}</span>
      <span class="ap-info"><strong>${name}</strong><small>${CATEGORY_LABELS[cat] || cat}</small></span>
      <span class="ap-price">${price}</span>
      <button class="ap-remove" onclick="removeProduct(this)">✕</button>
    `;
    list.appendChild(li);
  });
  if (!list.children.length) list.innerHTML = '<li class="empty-cart">No hay productos aún</li>';
}
