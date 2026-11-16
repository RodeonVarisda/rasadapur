(function () {
  'use strict';
  const S = window.RDStorage;
  const A = window.RDAuth;
  S.ensureSeed();

  const state = {
    route: 'catalog',
    cart: S.read('rasadapur.cart.v1', []),
    catalog: { q: '', cat: '', sort: 'featured' },
    authTab: 'login',
    editingProductId: null
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const main = () => $('#appMain');

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function rupiah(n) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0)); }
  function fmtDate(ts) { try { return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return '-'; } }

  function placeholder(name) {
    const safe = String(name || 'Produk').replace(/[&<>]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440"><rect width="640" height="440" fill="#efe1d5"/><circle cx="320" cy="200" r="120" fill="#e2c8a8"/><text x="320" y="225" text-anchor="middle" font-size="104">🍽️</text><text x="320" y="375" text-anchor="middle" font-family="Arial" font-size="27" fill="#713b32">${safe.slice(0, 30)}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }
  function imgFor(p) { return p && p.imageUrl && /^(data:image\/|\.{0,2}\/|https?:\/\/)/.test(p.imageUrl) ? p.imageUrl : placeholder(p?.nama); }

  function saveCart() { S.write('rasadapur.cart.v1', state.cart); }
  function cartCount() { return state.cart.reduce((s, i) => s + Number(i.qty || 0), 0); }

  function navigate(route) { state.route = route; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function renderNav() {
    const user = A.currentUser();
    const nav = $('#navActions');
    if (!nav) return;
    let html = '';
    html += `<button class="btn ${state.route === 'catalog' ? 'primary' : 'soft'}" data-nav="catalog">Katalog</button>`;
    if (user && user.role === 'buyer') {
      html += `<button class="btn ${state.route === 'cart' ? 'primary' : 'soft'}" data-nav="cart">Keranjang (${cartCount()})</button>`;
      html += `<button class="btn ${state.route === 'buyerOrders' ? 'primary' : 'soft'}" data-nav="buyerOrders">Pesanan Saya</button>`;
    }
    if (user && (user.role === 'seller' || user.role === 'admin')) {
      html += `<button class="btn ${state.route === 'dashboard' ? 'primary' : 'soft'}" data-nav="dashboard">Dashboard</button>`;
    }
    if (user) {
      html += `<span class="user-chip"><strong>${esc(user.name)}</strong> · ${roleLabel(user.role)}</span>`;
      html += `<button class="btn" data-action="logout">Keluar</button>`;
    } else {
      html += `<button class="btn ${state.route === 'auth' ? 'primary' : ''}" data-nav="auth">Masuk</button>`;
    }
    nav.innerHTML = html;
    $$('[data-nav]', nav).forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)));
    const lo = $('[data-action="logout"]', nav);
    if (lo) lo.addEventListener('click', () => { A.logout(); state.cart = []; saveCart(); toast('Anda telah keluar.'); navigate('catalog'); });
  }

  function roleLabel(r) { return ({ admin: 'Admin', seller: 'Penjual', buyer: 'Pembeli' }[r] || r); }
  function statusBadge(s) {
    const map = { menunggu: ['warn', 'Menunggu'], diproses: ['warn', 'Diproses'], dikirim: ['ok', 'Dikirim'], selesai: ['ok', 'Selesai'], dibatalkan: ['danger', 'Dibatalkan'] };
    const m = map[s] || ['muted', s];
    return `<span class="badge ${m[0]}">${esc(m[1])}</span>`;
  }

  function render() {
    const user = A.currentUser();
    // guard routes
    if (['dashboard'].includes(state.route) && (!user || (user.role !== 'admin' && user.role !== 'seller'))) state.route = 'catalog';
    if (['cart', 'buyerOrders'].includes(state.route) && (!user || user.role !== 'buyer')) state.route = user ? 'catalog' : 'auth';
    if (state.route === 'auth' && user) state.route = user.role === 'buyer' ? 'catalog' : 'dashboard';
    renderNav();
    const routes = {
      catalog: renderCatalog,
      auth: renderAuth,
      cart: renderCart,
      buyerOrders: renderBuyerOrders,
      dashboard: renderDashboard
    };
    (routes[state.route] || renderCatalog)();
  }

  function getSellerName(id) {
    const u = S.getUsers().find(x => x.id === id);
    return u ? (u.storeName || u.name) : 'Toko';
  }

  function renderCatalog() {
    const products = S.getProducts().filter(p => p.aktif !== false && Number(p.stok) >= 0);
    const cats = [...new Set(products.map(p => p.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    const q = (state.catalog.q || '').trim().toLocaleLowerCase('id');
    const cat = state.catalog.cat || '';
    const sort = state.catalog.sort || 'featured';
    let list = products.filter(p => (!cat || p.kategori === cat) && (!q || (p.nama + ' ' + (p.deskripsi || '') + ' ' + getSellerName(p.sellerId)).toLocaleLowerCase('id').includes(q)));
    list.sort((a, b) => {
      if (sort === 'name') return a.nama.localeCompare(b.nama, 'id');
      if (sort === 'priceAsc') return a.harga - b.harga;
      if (sort === 'priceDesc') return b.harga - a.harga;
      if (sort === 'stockDesc') return b.stok - a.stok;
      return Number(b.unggulan) - Number(a.unggulan) || a.nama.localeCompare(b.nama, 'id');
    });
    const user = A.currentUser();
    main().innerHTML = `
      <section class="view active">
        <div class="hero">
          <div>
            <div class="eyebrow">ꦧꦚꦸꦮꦔꦶ · Tanah Osing</div>
            <h1>Warisan rasa<br>Bumi Blambangan.</h1>
            <p>Jelajahi kuliner tradisional Banyuwangi dari penjual lokal. Belanja mudah, kelola pesanan, dan dukung UMKM dalam satu aplikasi.</p>
          </div>
          <div class="hero-art"><div class="hero-emoji">🍘</div><div class="hero-note">Produk lokal pilihan</div></div>
        </div>
        <div class="section-head"><div><h2>Katalog produk</h2><p>Ragam rasa untuk menemani harimu.</p></div><div class="count">${list.length} produk</div></div>
        <div class="toolbar">
          <input class="control search" id="searchInput" type="search" placeholder="Cari produk, deskripsi, atau toko…" value="${esc(state.catalog.q)}">
          <select class="control" id="categoryFilter"><option value="">Semua kategori</option>${cats.map(c => `<option value="${esc(c)}" ${c===cat?'selected':''}>${esc(c)}</option>`).join('')}</select>
          <select class="control" id="sortSelect">
            <option value="featured" ${sort==='featured'?'selected':''}>Unggulan dahulu</option>
            <option value="name" ${sort==='name'?'selected':''}>Nama A–Z</option>
            <option value="priceAsc" ${sort==='priceAsc'?'selected':''}>Harga terendah</option>
            <option value="priceDesc" ${sort==='priceDesc'?'selected':''}>Harga tertinggi</option>
            <option value="stockDesc" ${sort==='stockDesc'?'selected':''}>Stok terbanyak</option>
          </select>
        </div>
        <div class="grid" id="productGrid">
          ${list.length ? list.map(p => `
            <article class="product">
              <img src="${esc(imgFor(p))}" alt="${esc(p.nama)}">
              <div class="product-body">
                <div class="meta"><span class="tag">${esc(p.kategori || 'Umum')}</span>${p.unggulan ? '<span class="star">★ Unggulan</span>' : ''}</div>
                <h3>${esc(p.nama)}</h3>
                <div class="seller-name">Toko: ${esc(getSellerName(p.sellerId))}</div>
                <p class="desc">${esc(p.deskripsi || 'Produk pilihan UMKM Banyuwangi.')}</p>
                <div class="price-row"><span class="price">${rupiah(p.harga)}</span><span class="stock">Stok: ${p.stok}</span></div>
                <div class="actions-row">
                  ${user && user.role === 'buyer' ? `<button class="btn primary" data-add-cart="${esc(p.id)}" ${p.stok<=0?'disabled':''}>${p.stok<=0?'Stok habis':'Tambah ke keranjang'}</button>` : `<button class="btn" data-view-login>Masuk untuk membeli</button>`}
                </div>
              </div>
            </article>`).join('') : `<div class="empty">Produk tidak ditemukan. Coba kata kunci atau kategori lain.</div>`}
        </div>
      </section>`;
    $('#searchInput').addEventListener('input', e => { state.catalog.q = e.target.value; renderCatalog(); const i = $('#searchInput'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length);} });
    $('#categoryFilter').addEventListener('change', e => { state.catalog.cat = e.target.value; renderCatalog(); });
    $('#sortSelect').addEventListener('change', e => { state.catalog.sort = e.target.value; renderCatalog(); });
    $$('[data-add-cart]').forEach(b => b.addEventListener('click', () => addToCart(b.dataset.addCart)));
    $$('[data-view-login]').forEach(b => b.addEventListener('click', () => { if (A.currentUser()) toast('Fitur keranjang tersedia untuk pembeli.'); else navigate('auth'); }));
  }

  function addToCart(productId) {
    const user = A.currentUser();
    if (!user || user.role !== 'buyer') { navigate('auth'); return; }
    const p = S.getProducts().find(x => x.id === productId);
    if (!p || p.aktif === false) { toast('Produk tidak tersedia.'); return; }
    if (p.stok <= 0) { toast('Stok produk habis.'); return; }
    const item = state.cart.find(i => i.productId === productId);
    if (item) {
      if (item.qty + 1 > p.stok) { toast('Jumlah melebihi stok tersedia.'); return; }
      item.qty += 1;
    } else {
      state.cart.push({ productId: p.id, qty: 1 });
    }
    saveCart();
    toast('Produk ditambahkan ke keranjang.');
    renderNav();
  }

  function renderAuth() {
    const tab = state.authTab || 'login';
    main().innerHTML = `
      <div class="auth-wrap">
        <div class="panel">
          <div class="tabs">
            <button class="btn tab ${tab==='login'?'primary':''}" data-auth-tab="login">Masuk</button>
            <button class="btn tab ${tab==='register'?'primary':''}" data-auth-tab="register">Daftar Pembeli</button>
          </div>
          ${tab === 'login' ? `
            <form id="loginForm">
              <div class="form-grid" style="grid-template-columns:1fr">
                <div class="field"><label for="loginUsername">Username</label><input id="loginUsername" required autocomplete="username"></div>
                <div class="field"><label for="loginPassword">Kata sandi</label><input id="loginPassword" type="password" required autocomplete="current-password"></div>
              </div>
              <div class="form-actions"><button class="btn primary block" type="submit">Masuk</button></div>
            </form>
            <div class="hint-box" style="margin-top:14px">
              <strong>Akun demo:</strong><br>
              Admin: <code>admin / admin123</code><br>
              Penjual: <code>seller1 / seller123</code>, <code>seller2 / seller123</code><br>
              Pembeli: <code>pembeli1 / pembeli123</code>, <code>pembeli2 / pembeli123</code>
            </div>
          ` : `
            <form id="registerForm">
              <div class="form-grid" style="grid-template-columns:1fr">
                <div class="field"><label for="regName">Nama lengkap *</label><input id="regName" required></div>
                <div class="field"><label for="regUsername">Username *</label><input id="regUsername" required minlength="3"></div>
                <div class="field"><label for="regPassword">Kata sandi * (min. 6)</label><input id="regPassword" type="password" required minlength="6"></div>
                <div class="field"><label for="regPhone">No. telepon</label><input id="regPhone"></div>
                <div class="field"><label for="regAddress">Alamat</label><textarea id="regAddress"></textarea></div>
              </div>
              <div class="form-actions"><button class="btn primary block" type="submit">Buat akun pembeli</button></div>
            </form>
          `}
        </div>
      </div>`;
    $$('[data-auth-tab]').forEach(b => b.addEventListener('click', () => { state.authTab = b.dataset.authTab; renderAuth(); }));
    const lf = $('#loginForm');
    if (lf) lf.addEventListener('submit', e => {
      e.preventDefault();
      const res = A.login($('#loginUsername').value, $('#loginPassword').value);
      if (!res.ok) { toast(res.message); return; }
      toast('Berhasil masuk.');
      navigate(res.user.role === 'buyer' ? 'catalog' : 'dashboard');
    });
    const rf = $('#registerForm');
    if (rf) rf.addEventListener('submit', e => {
      e.preventDefault();
      const res = A.registerBuyer({ name: $('#regName').value, username: $('#regUsername').value, password: $('#regPassword').value, phone: $('#regPhone').value, address: $('#regAddress').value });
      if (!res.ok) { toast(res.message); return; }
      toast('Akun pembeli berhasil dibuat.');
      navigate('catalog');
    });
  }

  function renderCart() {
    const user = A.currentUser();
    const products = S.getProducts();
    const items = state.cart.map(ci => ({ ...ci, product: products.find(p => p.id === ci.productId) })).filter(x => x.product);
    // clean invalid
    if (items.length !== state.cart.length) { state.cart = items.map(i => ({ productId: i.productId, qty: Math.min(i.qty, i.product.stok || 1) })); saveCart(); }
    const total = items.reduce((s, i) => s + i.product.harga * i.qty, 0);
    main().innerHTML = `
      <section class="view active">
        <div class="section-head"><div><h2>Keranjang Belanja</h2><p>Periksa item sebelum melakukan pemesanan.</p></div></div>
        <div class="cart-layout">
          <div class="panel">
            ${items.length ? items.map(i => `
              <div class="cart-item" data-cart-item="${esc(i.productId)}">
                <img src="${esc(imgFor(i.product))}" alt="${esc(i.product.nama)}">
                <div>
                  <strong>${esc(i.product.nama)}</strong><div class="muted">${esc(getSellerName(i.product.sellerId))} · ${rupiah(i.product.harga)}</div>
                  <div class="qty" style="margin-top:6px">
                    <button class="btn small" data-qty-dec="${esc(i.productId)}">−</button>
                    <input type="number" min="1" max="${i.product.stok}" value="${i.qty}" data-qty-input="${esc(i.productId)}">
                    <button class="btn small" data-qty-inc="${esc(i.productId)}">+</button>
                    <button class="btn small danger" data-remove="${esc(i.productId)}">Hapus</button>
                  </div>
                  <div class="muted" style="margin-top:4px">Stok tersedia: ${i.product.stok}</div>
                </div>
                <div><strong>${rupiah(i.product.harga * i.qty)}</strong></div>
              </div>`).join('') : `<div class="empty">Keranjang masih kosong.</div>`}
          </div>
          <div class="panel">
            <h2>Ringkasan & Checkout</h2>
            <div class="total-row"><span>Total</span><span>${rupiah(total)}</span></div>
            <form id="checkoutForm" style="margin-top:14px">
              <div class="field"><label for="coAddress">Alamat pengiriman *</label><textarea id="coAddress" required>${esc(user?.address || '')}</textarea></div>
              <div class="field" style="margin-top:10px"><label for="coNote">Catatan</label><textarea id="coNote" placeholder="Contoh: kirim sore hari"></textarea></div>
              <div class="form-actions"><button class="btn primary block" type="submit" ${items.length?'' :'disabled'}>Buat Pesanan</button></div>
            </form>
            <p class="notice">Pesanan akan diteruskan ke penjual terkait dan dapat dipantau di menu Pesanan Saya.</p>
          </div>
        </div>
      </section>`;
    $$('[data-qty-dec]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyDec, -1)));
    $$('[data-qty-inc]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyInc, 1)));
    $$('[data-remove]').forEach(b => b.addEventListener('click', () => { state.cart = state.cart.filter(i => i.productId !== b.dataset.remove); saveCart(); render(); }));
    $$('[data-qty-input]').forEach(inp => inp.addEventListener('change', () => setQty(inp.dataset.qtyInput, Number(inp.value))));
    const cf = $('#checkoutForm');
    if (cf) cf.addEventListener('submit', e => {
      e.preventDefault();
      checkout($('#coAddress').value, $('#coNote').value);
    });
  }

  function updateQty(pid, delta) {
    const item = state.cart.find(i => i.productId === pid); if (!item) return;
    const p = S.getProducts().find(x => x.id === pid); if (!p) return;
    item.qty = Math.max(1, Math.min(p.stok, item.qty + delta));
    saveCart(); render();
  }
  function setQty(pid, val) {
    const item = state.cart.find(i => i.productId === pid); if (!item) return;
    const p = S.getProducts().find(x => x.id === pid); if (!p) return;
    item.qty = Math.max(1, Math.min(p.stok, Number(val) || 1));
    saveCart(); render();
  }

  function checkout(address, note) {
    const user = A.currentUser(); if (!user) return;
    const products = S.getProducts();
    const items = state.cart.map(ci => ({ ci, p: products.find(p => p.id === ci.productId) })).filter(x => x.p);
    if (!items.length) { toast('Keranjang kosong.'); return; }
    for (const { ci, p } of items) {
      if (p.stok < ci.qty) { toast(`Stok ${p.nama} tidak mencukupi.`); render(); return; }
    }
    // group by seller into separate orders? simpler: one order can include multiple sellers but store sellerIds
    const orderItems = items.map(({ ci, p }) => ({ productId: p.id, nama: p.nama, harga: p.harga, qty: ci.qty, sellerId: p.sellerId }));
    const total = orderItems.reduce((s, i) => s + i.harga * i.qty, 0);
    const now = Date.now();
    const order = {
      id: S.uid('o'), buyerId: user.id, sellerIds: [...new Set(orderItems.map(i => i.sellerId))],
      items: orderItems, total, status: 'menunggu', note: String(note || '').trim(),
      address: String(address || '').trim(), createdAt: now, updatedAt: now
    };
    // reduce stock
    const newProducts = products.map(p => {
      const it = items.find(x => x.p.id === p.id);
      if (!it) return p;
      return { ...p, stok: p.stok - it.ci.qty };
    });
    const orders = S.getOrders();
    orders.unshift(order);
    S.setProducts(newProducts); S.setOrders(orders);
    state.cart = []; saveCart();
    toast('Pesanan berhasil dibuat.');
    navigate('buyerOrders');
  }

  function renderBuyerOrders() {
    const user = A.currentUser(); if (!user) return;
    const orders = S.getOrders().filter(o => o.buyerId === user.id).sort((a,b)=>b.createdAt-a.createdAt);
    main().innerHTML = `
      <section class="view active">
        <div class="section-head"><div><h2>Pesanan Saya</h2><p>Riwayat dan status pesanan Anda.</p></div></div>
        <div class="panel">
          ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Tanggal</th><th>Item</th><th>Total</th><th>Status</th><th>Alamat</th></tr></thead><tbody>
            ${orders.map(o => `<tr>
              <td><strong>${esc(o.id)}</strong></td>
              <td>${esc(fmtDate(o.createdAt))}</td>
              <td>${o.items.map(i=>`${esc(i.nama)} x${i.qty}`).join('<br>')}</td>
              <td>${rupiah(o.total)}</td>
              <td>${statusBadge(o.status)}</td>
              <td>${esc(o.address || '-')}</td>
            </tr>`).join('')}
          </tbody></table></div>` : `<div class="empty">Belum ada pesanan.</div>`}
        </div>
      </section>`;
  }

  function renderDashboard() {
    const user = A.currentUser(); if (!user) return;
    if (user.role === 'admin') renderAdmin(); else renderSeller();
  }

  function renderSeller() {
    const user = A.currentUser();
    const products = S.getProducts().filter(p => p.sellerId === user.id);
    const orders = S.getOrders().filter(o => o.items.some(i => i.sellerId === user.id)).sort((a,b)=>b.createdAt-a.createdAt);
    const revenue = orders.filter(o => o.status !== 'dibatalkan').reduce((sum, o) => sum + o.items.filter(i=>i.sellerId===user.id).reduce((s,i)=>s+i.harga*i.qty,0), 0);
    const editing = state.editingProductId ? products.find(p=>p.id===state.editingProductId) : null;
    main().innerHTML = `
      <section class="view active">
        <div class="section-head"><div><div class="eyebrow">Dashboard Penjual</div><h2>${esc(user.storeName || user.name)}</h2><p>Kelola produk dan pesanan toko Anda.</p></div></div>
        <div class="stats">
          <div class="stat"><span>Total produk</span><strong>${products.length}</strong></div>
          <div class="stat"><span>Total stok</span><strong>${products.reduce((s,p)=>s+Number(p.stok||0),0)}</strong></div>
          <div class="stat"><span>Pesanan terkait</span><strong>${orders.length}</strong></div>
          <div class="stat"><span>Omzet (non-batal)</span><strong style="font-size:20px">${rupiah(revenue)}</strong></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Produk Saya</h2><button class="btn primary" id="addProductBtn">＋ Tambah produk</button></div>
          <div class="table-wrap"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Label</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
            ${products.length ? products.map(p=>`<tr>
              <td><strong>${esc(p.nama)}</strong></td><td>${esc(p.kategori)}</td><td>${rupiah(p.harga)}</td><td>${p.stok}</td>
              <td>${p.unggulan ? '★ Unggulan' : '—'}</td><td>${p.aktif!==false?'<span class="badge ok">Aktif</span>':'<span class="badge muted">Nonaktif</span>'}</td>
              <td><div class="actions"><button class="btn small" data-edit-product="${esc(p.id)}">Edit</button><button class="btn small danger" data-delete-product="${esc(p.id)}">Hapus</button></div></td>
            </tr>`).join('') : `<tr><td colspan="7">Belum ada produk.</td></tr>`}
          </tbody></table></div>
        </div>
        ${renderProductForm(editing, user)}
        <div class="panel">
          <div class="panel-head"><h2>Pesanan Masuk</h2></div>
          ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Pesanan</th><th>Pembeli</th><th>Item (toko)</th><th>Total toko</th><th>Status</th><th>Ubah status</th></tr></thead><tbody>
            ${orders.map(o => {
              const buyer = S.getUsers().find(u=>u.id===o.buyerId);
              const myItems = o.items.filter(i=>i.sellerId===user.id);
              const myTotal = myItems.reduce((s,i)=>s+i.harga*i.qty,0);
              return `<tr>
                <td><strong>${esc(o.id)}</strong><br><span class="muted">${esc(fmtDate(o.createdAt))}</span></td>
                <td>${esc(buyer?.name||o.buyerId)}<br><span class="muted">${esc(o.address||'-')}</span></td>
                <td>${myItems.map(i=>`${esc(i.nama)} x${i.qty}`).join('<br>')}</td>
                <td>${rupiah(myTotal)}</td>
                <td>${statusBadge(o.status)}</td>
                <td><select class="control" data-order-status="${esc(o.id)}" style="min-width:140px;padding:6px 8px">
                  ${['menunggu','diproses','dikirim','selesai','dibatalkan'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
                </select></td>
              </tr>`;
            }).join('')}
          </tbody></table></div>` : `<div class="empty">Belum ada pesanan untuk toko Anda.</div>`}
        </div>
      </section>`;
    bindDashboardEvents(user);
  }

  function renderAdmin() {
    const user = A.currentUser();
    const users = S.getUsers();
    const products = S.getProducts();
    const orders = S.getOrders().sort((a,b)=>b.createdAt-a.createdAt);
    const omzet = orders.filter(o=>o.status!=='dibatalkan').reduce((s,o)=>s+o.total,0);
    const editing = state.editingProductId ? products.find(p=>p.id===state.editingProductId) : null;
    main().innerHTML = `
      <section class="view active">
        <div class="section-head"><div><div class="eyebrow">Dashboard Admin</div><h2>Panel Administrasi</h2><p>Kelola pengguna, produk, dan pesanan seluruh sistem.</p></div>
          <button class="btn danger" id="resetDataBtn">Reset data dummy</button></div>
        <div class="stats">
          <div class="stat"><span>Pengguna</span><strong>${users.length}</strong></div>
          <div class="stat"><span>Produk</span><strong>${products.length}</strong></div>
          <div class="stat"><span>Pesanan</span><strong>${orders.length}</strong></div>
          <div class="stat"><span>Omzet (non-batal)</span><strong style="font-size:20px">${rupiah(omzet)}</strong></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Manajemen Pengguna</h2></div>
          <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Info</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
            ${users.map(u=>`<tr>
              <td><strong>${esc(u.name)}</strong></td><td>${esc(u.username)}</td><td>${esc(roleLabel(u.role))}</td>
              <td>${esc(u.storeName || u.address || u.phone || '-')}</td>
              <td>${u.disabled?'<span class="badge danger">Nonaktif</span>':'<span class="badge ok">Aktif</span>'}</td>
              <td>${u.id===user.id?'<span class="muted">Akun ini</span>':`<button class="btn small" data-toggle-user="${esc(u.id)}">${u.disabled?'Aktifkan':'Nonaktifkan'}</button>`}</td>
            </tr>`).join('')}
          </tbody></table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Semua Produk</h2><button class="btn primary" id="addProductBtn">＋ Tambah produk</button></div>
          <div class="table-wrap"><table><thead><tr><th>Produk</th><th>Penjual</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Label</th><th>Aksi</th></tr></thead><tbody>
            ${products.length ? products.map(p=>`<tr>
              <td><strong>${esc(p.nama)}</strong></td><td>${esc(getSellerName(p.sellerId))}</td><td>${esc(p.kategori)}</td><td>${rupiah(p.harga)}</td><td>${p.stok}</td>
              <td>${p.unggulan ? '★ Unggulan' : '—'}</td>
              <td><div class="actions"><button class="btn small" data-edit-product="${esc(p.id)}">Edit</button><button class="btn small danger" data-delete-product="${esc(p.id)}">Hapus</button></div></td>
            </tr>`).join('') : `<tr><td colspan="7">Belum ada produk.</td></tr>`}
          </tbody></table></div>
        </div>
        ${renderProductForm(editing, user)}
        <div class="panel">
          <div class="panel-head"><h2>Semua Pesanan</h2></div>
          ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Pesanan</th><th>Pembeli</th><th>Item</th><th>Total</th><th>Status</th><th>Ubah status</th></tr></thead><tbody>
            ${orders.map(o => {
              const buyer = S.getUsers().find(u=>u.id===o.buyerId);
              return `<tr>
                <td><strong>${esc(o.id)}</strong><br><span class="muted">${esc(fmtDate(o.createdAt))}</span></td>
                <td>${esc(buyer?.name||o.buyerId)}</td>
                <td>${o.items.map(i=>`${esc(i.nama)} x${i.qty} <span class="muted">(${esc(getSellerName(i.sellerId))})</span>`).join('<br>')}</td>
                <td>${rupiah(o.total)}</td>
                <td>${statusBadge(o.status)}</td>
                <td><select class="control" data-order-status="${esc(o.id)}" style="min-width:140px;padding:6px 8px">
                  ${['menunggu','diproses','dikirim','selesai','dibatalkan'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
                </select></td>
              </tr>`;
            }).join('')}
          </tbody></table></div>` : `<div class="empty">Belum ada pesanan.</div>`}
        </div>
      </section>`;
    bindDashboardEvents(user);
  }

  function renderProductForm(product, user) {
    const sellers = S.getUsers().filter(u => u.role === 'seller' && !u.disabled);
    const isAdmin = user.role === 'admin';
    const formOpen = state.editingProductId !== null || state.showNewProductForm;
    const p = product || null;
    const sellerValue = p?.sellerId || (isAdmin ? (sellers[0]?.id || '') : user.id);
    return `
      <div class="panel" id="productEditorPanel" ${formOpen ? '' : 'style="display:none"'}>
        <div class="panel-head"><h2 id="formTitle">${p ? 'Ubah produk' : 'Tambah produk'}</h2><button class="btn small" id="closeProductForm">Tutup</button></div>
        <form id="productForm">
          <input type="hidden" id="editId" value="${esc(p?.id || '')}">
          <div class="form-grid">
            ${isAdmin ? `<div class="field"><label for="sellerInput">Penjual *</label><select id="sellerInput" required>${sellers.map(s=>`<option value="${esc(s.id)}" ${s.id===sellerValue?'selected':''}>${esc(s.storeName||s.name)}</option>`).join('')}</select></div>` : `<input type="hidden" id="sellerInput" value="${esc(user.id)}">`}
            <div class="field"><label for="nameInput">Nama produk *</label><input id="nameInput" required maxlength="70" value="${esc(p?.nama||'')}"></div>
            <div class="field"><label for="catInput">Kategori *</label><input id="catInput" required maxlength="40" list="categoryOptions" value="${esc(p?.kategori||'')}"><datalist id="categoryOptions">${[...new Set(S.getProducts().map(x=>x.kategori).filter(Boolean))].sort().map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
            <div class="field"><label for="priceInput">Harga (Rupiah) *</label><input id="priceInput" type="number" min="0" step="1" required value="${p?esc(p.harga):''}"></div>
            <div class="field"><label for="stockInput">Stok (pcs) *</label><input id="stockInput" type="number" min="0" step="1" required value="${p?esc(p.stok):''}"></div>
            <div class="field full"><label for="descInput">Deskripsi</label><textarea id="descInput" maxlength="220">${esc(p?.deskripsi||'')}</textarea></div>
            <div class="field full"><label for="imageFile">Upload foto produk</label><input id="imageFile" type="file" accept="image/*">
              <div class="upload-preview"><img id="imagePreview" alt="Pratinjau foto produk" src="${esc(p?.imageUrl || placeholder(p?.nama || 'Pratinjau'))}"><span class="upload-help" id="uploadStatus">${p?.imageUrl?'Foto produk tersimpan. Pilih file baru untuk menggantinya.':'Pilih foto dari perangkat. Placeholder akan digunakan bila kosong.'}</span></div>
              <input id="imageInput" type="hidden" value="${esc(p?.imageUrl||'')}">
            </div>
            <div class="field full">
              <div class="featured-option">
                <input id="featuredInput" type="checkbox" aria-describedby="featuredHelp featuredStatus" ${p?.unggulan ? 'checked' : ''}>
                <div class="featured-copy">
                  <label for="featuredInput">Jadikan produk unggulan</label>
                  <small id="featuredHelp">Produk unggulan akan diberi tanda ★ dan ditampilkan lebih dahulu pada katalog.</small>
                  <span class="featured-state ${p?.unggulan ? 'is-active' : ''}" id="featuredStatus" aria-live="polite">
                    <span class="state-dot" aria-hidden="true"></span>
                    <span>${p?.unggulan ? 'Ditandai sebagai produk unggulan' : 'Belum ditandai sebagai unggulan'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="form-actions"><button type="button" class="btn" id="cancelProductForm">Batal</button><button class="btn primary" type="submit">Simpan produk</button></div>
          <p class="notice">Harga harus angka ≥ 0 dan stok harus bilangan bulat ≥ 0. Status unggulan disimpan sebagai boolean di localStorage.</p>
        </form>
      </div>`;
  }

  function bindDashboardEvents(user) {
    const addBtn = $('#addProductBtn');
    if (addBtn) addBtn.addEventListener('click', () => { state.editingProductId = null; state.showNewProductForm = true; render(); setTimeout(()=>$('#nameInput')?.focus(), 0); });
    $$('#closeProductForm, #cancelProductForm').forEach(b => b && b.addEventListener('click', () => { state.editingProductId = null; state.showNewProductForm = false; render(); }));
    $$('[data-edit-product]').forEach(b => b.addEventListener('click', () => { state.editingProductId = b.dataset.editProduct; state.showNewProductForm = true; render(); setTimeout(()=>$('#nameInput')?.focus(), 0); }));
    $$('[data-delete-product]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.deleteProduct, user)));
    $$('[data-order-status]').forEach(sel => sel.addEventListener('change', () => updateOrderStatus(sel.dataset.orderStatus, sel.value)));
    $$('[data-toggle-user]').forEach(b => b.addEventListener('click', () => toggleUser(b.dataset.toggleUser)));
    const resetBtn = $('#resetDataBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (!confirm('Reset semua data ke data dummy awal? Sesi login akan keluar.')) return;
      S.resetAll(); state.cart = []; saveCart(); toast('Data dummy berhasil dipulihkan.'); navigate('auth');
    });
    bindProductForm(user);
  }

  function updateFeaturedStatus() {
    const checkbox = $('#featuredInput'); const status = $('#featuredStatus');
    if (!checkbox || !status) return;
    const active = checkbox.checked === true;
    status.classList.toggle('is-active', active);
    const text = status.querySelector('span:last-child');
    if (text) text.textContent = active ? 'Ditandai sebagai produk unggulan' : 'Belum ditandai sebagai unggulan';
  }

  function bindProductForm(user) {
    const form = $('#productForm'); if (!form) return;
    const featured = $('#featuredInput');
    if (featured) featured.addEventListener('change', updateFeaturedStatus);
    updateFeaturedStatus();
    const file = $('#imageFile');
    if (file) file.addEventListener('change', async e => {
      const f = e.target.files?.[0]; if (!f) return;
      if (!f.type.startsWith('image/')) { toast('Pilih file gambar yang valid.'); e.target.value=''; return; }
      if (f.size > 8 * 1024 * 1024) { toast('Ukuran foto maksimal 8 MB.'); e.target.value=''; return; }
      try {
        const data = await compressImage(f);
        $('#imageInput').value = data; $('#imagePreview').src = data; $('#uploadStatus').textContent = `${f.name} siap disimpan (gambar dioptimalkan).`;
      } catch { toast('Foto gagal diproses.'); }
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      saveProduct(user);
    });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const max = 900, scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveProduct(user) {
    const isAdmin = user.role === 'admin';
    const id = ($('#editId')?.value || '').trim();
    const sellerId = isAdmin ? ($('#sellerInput')?.value || '') : user.id;
    const nama = ($('#nameInput')?.value || '').trim();
    const kategori = ($('#catInput')?.value || '').trim();
    const harga = Number($('#priceInput')?.value);
    const stok = Number($('#stockInput')?.value);
    const deskripsi = ($('#descInput')?.value || '').trim();
    const imageUrl = ($('#imageInput')?.value || '').trim();
    const unggulan = $('#featuredInput')?.checked === true; // boolean
    if (!nama || !kategori) { toast('Nama dan kategori wajib diisi.'); return; }
    if (!sellerId) { toast('Penjual wajib dipilih.'); return; }
    if (!Number.isFinite(harga) || harga < 0 || !Number.isInteger(harga)) { toast('Harga harus angka bulat ≥ 0.'); return; }
    if (!Number.isInteger(stok) || stok < 0) { toast('Stok harus bilangan bulat ≥ 0.'); return; }
    let products = S.getProducts();
    if (id) {
      const existing = products.find(p => p.id === id);
      if (!existing) { toast('Produk tidak ditemukan.'); return; }
      if (!isAdmin && existing.sellerId !== user.id) { toast('Tidak memiliki akses.'); return; }
      products = products.map(p => p.id === id ? { ...p, sellerId, nama, kategori, harga, stok, deskripsi, imageUrl, unggulan } : p);
      toast('Produk berhasil diperbarui.');
    } else {
      products.push({ id: S.uid('p'), sellerId, nama, kategori, harga, stok, deskripsi, imageUrl, unggulan, aktif: true });
      toast('Produk berhasil ditambahkan.');
    }
    S.setProducts(products);
    state.editingProductId = null; state.showNewProductForm = false;
    render();
  }

  function deleteProduct(id, user) {
    let products = S.getProducts();
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (user.role !== 'admin' && p.sellerId !== user.id) { toast('Tidak memiliki akses.'); return; }
    if (!confirm(`Hapus produk "${p.nama}"?`)) return;
    products = products.filter(x => x.id !== id);
    S.setProducts(products);
    // remove from carts
    state.cart = state.cart.filter(i => i.productId !== id); saveCart();
    toast('Produk berhasil dihapus.');
    render();
  }

  function updateOrderStatus(orderId, status) {
    const orders = S.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx < 0) return;
    orders[idx] = { ...orders[idx], status, updatedAt: Date.now() };
    S.setOrders(orders);
    toast('Status pesanan diperbarui.');
    render();
  }

  function toggleUser(userId) {
    const me = A.currentUser(); if (me && me.id === userId) return;
    const users = S.getUsers().map(u => u.id === userId ? { ...u, disabled: !u.disabled } : u);
    S.setUsers(users);
    toast('Status pengguna diperbarui.');
    render();
  }

  // init
  $('#brandHome').addEventListener('click', () => navigate('catalog'));
  $('#brandHome').addEventListener('keydown', e => { if (e.key === 'Enter') navigate('catalog'); });
  // start route
  const current = A.currentUser();
  state.route = current ? (current.role === 'buyer' ? 'catalog' : 'dashboard') : 'catalog';
  render();
})();