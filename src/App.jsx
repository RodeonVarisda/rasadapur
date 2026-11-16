import { useEffect, useMemo, useState } from 'react';
import './App.css';
import * as storage from './lib/storage';
import * as auth from './lib/auth';
import { rupiah, fmtDate, imgFor, placeholder, roleLabel, compressImage, waLink, formatPhone } from './lib/utils';

storage.ensureSeed();

function Toast({ message }) {
  return <div className={`toast ${message ? 'show' : ''}`} role="status" aria-live="polite">{message}</div>;
}

function StatusBadge({ status }) {
  const map = { menunggu: ['warn', 'Menunggu'], diproses: ['warn', 'Diproses'], dikirim: ['ok', 'Dikirim'], selesai: ['ok', 'Selesai'], dibatalkan: ['danger', 'Dibatalkan'] };
  const m = map[status] || ['muted', status];
  return <span className={`badge ${m[0]}`}>{m[1]}</span>;
}

const emptyProduct = { nama: '', kategori: '', harga: '', stok: '', deskripsi: '', imageUrl: '', unggulan: false, sellerId: '' };

export default function App() {
  const [user, setUser] = useState(() => auth.currentUser());
  const [route, setRoute] = useState(() => (auth.currentUser()?.role === 'buyer' ? 'catalog' : auth.currentUser() ? 'dashboard' : 'catalog'));
  const [toast, setToast] = useState('');
  const [cart, setCart] = useState(() => storage.getCart());
  const [dataTick, setDataTick] = useState(0);

  const users = useMemo(() => storage.getUsers(), [dataTick]);
  const products = useMemo(() => storage.getProducts(), [dataTick]);
  const orders = useMemo(() => storage.getOrders(), [dataTick]);

  function notify(msg) {
    setToast(msg);
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(''), 2600);
  }

  function refresh() { setDataTick((t) => t + 1); }
  function saveCartState(next) { setCart(next); storage.setCart(next); }
  function navigate(next) { setRoute(next); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  useEffect(() => {
    // route guards
    if (['dashboard'].includes(route) && (!user || (user.role !== 'admin' && user.role !== 'seller'))) setRoute('catalog');
    if (['cart', 'buyerOrders'].includes(route) && (!user || user.role !== 'buyer')) setRoute(user ? 'catalog' : 'auth');
    if (route === 'auth' && user) setRoute(user.role === 'buyer' ? 'catalog' : 'dashboard');
  }, [route, user]);

  function doLogin(username, password) {
    const res = auth.login(username, password);
    if (!res.ok) { notify(res.message); return; }
    setUser(res.user);
    notify('Berhasil masuk.');
    navigate(res.user.role === 'buyer' ? 'catalog' : 'dashboard');
  }
  function doLogout() {
    auth.logout();
    setUser(null);
    saveCartState([]);
    notify('Anda telah keluar.');
    navigate('catalog');
  }
  function doRegisterBuyer(payload) {
    const res = auth.registerBuyer(payload);
    if (!res.ok) { notify(res.message); return; }
    setUser(res.user);
    notify('Akun pembeli berhasil dibuat.');
    navigate('catalog');
  }

  const getSeller = (id) => users.find((x) => x.id === id);
  const getSellerName = (id) => {
    const u = getSeller(id);
    return u ? (u.storeName || u.name) : 'Toko';
  };

  function addToCart(productId) {
    if (!user || user.role !== 'buyer') { navigate('auth'); return; }
    const p = storage.getProducts().find((x) => x.id === productId);
    if (!p || p.aktif === false) { notify('Produk tidak tersedia.'); return; }
    if (p.stok <= 0) { notify('Stok produk habis.'); return; }
    const next = [...storage.getCart()];
    const item = next.find((i) => i.productId === productId);
    if (item) {
      if (item.qty + 1 > p.stok) { notify('Jumlah melebihi stok tersedia.'); return; }
      item.qty += 1;
    } else {
      next.push({ productId: p.id, qty: 1 });
    }
    saveCartState(next);
    notify('Produk ditambahkan ke keranjang.');
  }

  function updateCartQty(pid, qty) {
    const p = storage.getProducts().find((x) => x.id === pid);
    if (!p) return;
    const next = storage.getCart().map((i) => i.productId === pid ? { ...i, qty: Math.max(1, Math.min(p.stok, Number(qty) || 1)) } : i);
    saveCartState(next);
  }
  function removeCartItem(pid) { saveCartState(storage.getCart().filter((i) => i.productId !== pid)); }

  function checkout(address, note, paymentMethod) {
    if (!user) return;
    const allProducts = storage.getProducts();
    const items = storage.getCart().map((ci) => ({ ci, p: allProducts.find((p) => p.id === ci.productId) })).filter((x) => x.p);
    if (!items.length) { notify('Keranjang kosong.'); return; }
    for (const { ci, p } of items) {
      if (p.stok < ci.qty) { notify(`Stok ${p.nama} tidak mencukupi.`); refresh(); return; }
    }
    const method = String(paymentMethod || '').trim();
    if (!method) { notify('Pilih metode pembayaran.'); return; }
    const orderItems = items.map(({ ci, p }) => ({ productId: p.id, nama: p.nama, harga: p.harga, qty: ci.qty, sellerId: p.sellerId }));
    const total = orderItems.reduce((s, i) => s + i.harga * i.qty, 0);
    const now = Date.now();
    const order = {
      id: storage.uid('o'), buyerId: user.id, sellerIds: [...new Set(orderItems.map((i) => i.sellerId))],
      items: orderItems, total, status: 'menunggu', paymentMethod: method, note: String(note || '').trim(), address: String(address || '').trim(),
      createdAt: now, updatedAt: now,
    };
    const newProducts = allProducts.map((p) => {
      const it = items.find((x) => x.p.id === p.id);
      if (!it) return p;
      return { ...p, stok: p.stok - it.ci.qty };
    });
    const allOrders = storage.getOrders();
    allOrders.unshift(order);
    storage.setProducts(newProducts);
    storage.setOrders(allOrders);
    saveCartState([]);
    notify('Pesanan berhasil dibuat.');
    refresh();
    navigate('buyerOrders');
  }

  function saveProduct(payload, editingId) {
    const isAdmin = user?.role === 'admin';
    let all = storage.getProducts();
    const { sellerId, nama, kategori, harga, stok, deskripsi, imageUrl, unggulan } = payload;
    if (!nama || !kategori) { notify('Nama dan kategori wajib diisi.'); return; }
    if (!sellerId) { notify('Penjual wajib dipilih.'); return; }
    if (!Number.isFinite(harga) || harga < 0 || !Number.isInteger(harga)) { notify('Harga harus angka bulat ≥ 0.'); return; }
    if (!Number.isInteger(stok) || stok < 0) { notify('Stok harus bilangan bulat ≥ 0.'); return; }
    if (editingId) {
      const existing = all.find((p) => p.id === editingId);
      if (!existing) { notify('Produk tidak ditemukan.'); return; }
      if (!isAdmin && existing.sellerId !== user.id) { notify('Tidak memiliki akses.'); return; }
      all = all.map((p) => p.id === editingId ? { ...p, sellerId, nama, kategori, harga, stok, deskripsi, imageUrl, unggulan } : p);
      notify('Produk berhasil diperbarui.');
    } else {
      all.push({ id: storage.uid('p'), sellerId, nama, kategori, harga, stok, deskripsi, imageUrl, unggulan, aktif: true });
      notify('Produk berhasil ditambahkan.');
    }
    storage.setProducts(all);
    refresh();
  }

  function deleteProduct(id) {
    let all = storage.getProducts();
    const p = all.find((x) => x.id === id);
    if (!p) return;
    if (user?.role !== 'admin' && p.sellerId !== user?.id) { notify('Tidak memiliki akses.'); return; }
    if (!window.confirm(`Hapus produk "${p.nama}"?`)) return;
    storage.setProducts(all.filter((x) => x.id !== id));
    saveCartState(storage.getCart().filter((i) => i.productId !== id));
    notify('Produk berhasil dihapus.');
    refresh();
  }

  function updateOrderStatus(orderId, status) {
    const all = storage.getOrders().map((o) => o.id === orderId ? { ...o, status, updatedAt: Date.now() } : o);
    storage.setOrders(all);
    notify('Status pesanan diperbarui.');
    refresh();
  }

  function toggleUser(userId) {
    if (user && user.id === userId) return;
    const next = storage.getUsers().map((u) => u.id === userId ? { ...u, disabled: !u.disabled } : u);
    storage.setUsers(next);
    notify('Status pengguna diperbarui.');
    refresh();
  }

  function resetAllData() {
    if (!window.confirm('Reset semua data ke data dummy awal? Sesi login akan keluar.')) return;
    storage.resetAll();
    auth.logout();
    setUser(null);
    saveCartState([]);
    notify('Data dummy berhasil dipulihkan.');
    refresh();
    navigate('auth');
  }

  const cartCount = cart.reduce((s, i) => s + Number(i.qty || 0), 0);

  return (
    <>
      <header className="top">
        <div className="wrap nav">
          <div className="brand" onClick={() => navigate('catalog')} onKeyDown={(e)=>e.key==='Enter'&&navigate('catalog')} role="button" tabIndex={0}>
            <div className="brand-mark">🍃</div>
            <div>RasaDapur<small>RASA TRADISI BANYUWANGI</small></div>
          </div>
          <div className="nav-actions">
            <button className={`btn ${route === 'catalog' ? 'primary' : 'soft'}`} onClick={() => navigate('catalog')}>Katalog</button>
            {user && user.role === 'buyer' && (
              <>
                <button className={`btn ${route === 'cart' ? 'primary' : 'soft'}`} onClick={() => navigate('cart')}>Keranjang ({cartCount})</button>
                <button className={`btn ${route === 'buyerOrders' ? 'primary' : 'soft'}`} onClick={() => navigate('buyerOrders')}>Pesanan Saya</button>
              </>
            )}
            {user && (user.role === 'seller' || user.role === 'admin') && (
              <button className={`btn ${route === 'dashboard' ? 'primary' : 'soft'}`} onClick={() => navigate('dashboard')}>Dashboard</button>
            )}
            {user ? (
              <>
                <span className="user-chip"><strong>{user.name}</strong> · {roleLabel(user.role)}</span>
                <button className="btn" onClick={doLogout}>Keluar</button>
              </>
            ) : (
              <button className={`btn ${route === 'auth' ? 'primary' : ''}`} onClick={() => navigate('auth')}>Masuk</button>
            )}
          </div>
        </div>
      </header>

      <main className="wrap">
        {route === 'catalog' && <CatalogPage user={user} products={products} users={users} getSeller={getSeller} getSellerName={getSellerName} onAdd={addToCart} onNeedLogin={() => navigate('auth')} />}
        {route === 'auth' && !user && <AuthPage onLogin={doLogin} onRegister={doRegisterBuyer} />}
        {route === 'cart' && user?.role === 'buyer' && <CartPage user={user} cart={cart} products={products} users={users} getSeller={getSeller} getSellerName={getSellerName} onQty={updateCartQty} onRemove={removeCartItem} onCheckout={checkout} />}
        {route === 'buyerOrders' && user?.role === 'buyer' && <BuyerOrdersPage user={user} orders={orders} users={users} getSeller={getSeller} getSellerName={getSellerName} />}
        {route === 'dashboard' && user?.role === 'seller' && (
          <SellerDashboard user={user} users={users} products={products} orders={orders} getSellerName={getSellerName}
            onSaveProduct={saveProduct} onDeleteProduct={deleteProduct} onUpdateOrder={updateOrderStatus} />
        )}
        {route === 'dashboard' && user?.role === 'admin' && (
          <AdminDashboard user={user} users={users} products={products} orders={orders} getSellerName={getSellerName}
            onSaveProduct={saveProduct} onDeleteProduct={deleteProduct} onUpdateOrder={updateOrderStatus} onToggleUser={toggleUser} onReset={resetAllData} />
        )}
      </main>

      <footer className="footer"><div className="wrap">© 2026 RasaDapur · Aplikasi React + Vite (3 role: Admin, Seller, Pembeli) · Data tersimpan di localStorage browser.</div></footer>
      <Toast message={toast} />
    </>
  );
}

function CatalogPage({ user, products, users, getSeller, getSellerName, onAdd, onNeedLogin }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('featured');
  const active = products.filter((p) => p.aktif !== false);
  const cats = [...new Set(active.map((p) => p.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
  const list = useMemo(() => {
    const ql = q.trim().toLocaleLowerCase('id');
    let arr = active.filter((p) => (!cat || p.kategori === cat) && (!ql || (p.nama + ' ' + (p.deskripsi || '') + ' ' + getSellerName(p.sellerId)).toLocaleLowerCase('id').includes(ql)));
    arr = [...arr].sort((a, b) => {
      if (sort === 'name') return a.nama.localeCompare(b.nama, 'id');
      if (sort === 'priceAsc') return a.harga - b.harga;
      if (sort === 'priceDesc') return b.harga - a.harga;
      if (sort === 'stockDesc') return b.stok - a.stok;
      return Number(b.unggulan) - Number(a.unggulan) || a.nama.localeCompare(b.nama, 'id');
    });
    return arr;
  }, [active, q, cat, sort, users]);

  return (
    <section className="view active">
      <div className="hero">
        <div>
          <div className="eyebrow">ꦧꦚꦸꦮꦔꦶ · Tanah Osing</div>
          <h1>Warisan rasa<br />Bumi Blambangan.</h1>
          <p>Jelajahi kuliner tradisional Banyuwangi dari penjual lokal. Belanja mudah, kelola pesanan, dan dukung UMKM dalam satu aplikasi.</p>
        </div>
        <div className="hero-art"><div className="hero-emoji">🍘</div><div className="hero-note">Produk lokal pilihan</div></div>
      </div>
      <div className="section-head"><div><h2>Katalog produk</h2><p>Ragam rasa untuk menemani harimu.</p></div><div className="count">{list.length} produk</div></div>
      <div className="toolbar">
        <input className="control search" type="search" placeholder="Cari produk, deskripsi, atau toko…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="control" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Semua kategori</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className="control" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="featured">Unggulan dahulu</option>
          <option value="name">Nama A–Z</option>
          <option value="priceAsc">Harga terendah</option>
          <option value="priceDesc">Harga tertinggi</option>
          <option value="stockDesc">Stok terbanyak</option>
        </select>
      </div>
      <div className="grid">
        {list.length ? list.map((p) => {
          const seller = getSeller(p.sellerId);
          const wa = waLink(seller?.phone, `Halo ${seller?.storeName || seller?.name || ''}, saya ingin bertanya tentang produk ${p.nama}. Apakah masih tersedia?`);
          return (
          <article className="product" key={p.id}>
            <img src={imgFor(p)} alt={p.nama} />
            <div className="product-body">
              <div className="meta"><span className="tag">{p.kategori || 'Umum'}</span>{p.unggulan ? <span className="star">★ Unggulan</span> : null}</div>
              <h3>{p.nama}</h3>
              <div className="seller-name">Toko: {getSellerName(p.sellerId)}</div>
              {seller?.phone ? (
                <div className="seller-name">WhatsApp: <a href={wa} target="_blank" rel="noopener noreferrer">{formatPhone(seller.phone)}</a></div>
              ) : <div className="seller-name muted">WhatsApp penjual belum tersedia</div>}
              <p className="desc">{p.deskripsi || 'Produk pilihan UMKM Banyuwangi.'}</p>
              <div className="price-row"><span className="price">{rupiah(p.harga)}</span><span className="stock">Stok: {p.stok}</span></div>
              <div className="actions-row">
                {user && user.role === 'buyer'
                  ? <button className="btn primary" onClick={() => onAdd(p.id)} disabled={p.stok <= 0}>{p.stok <= 0 ? 'Stok habis' : 'Tambah ke keranjang'}</button>
                  : <button className="btn" onClick={onNeedLogin}>{user ? 'Fitur khusus pembeli' : 'Masuk untuk membeli'}</button>}
              </div>
              {wa && <div className="actions-row" style={{ marginTop: 8 }}><a className="btn soft" href={wa} target="_blank" rel="noopener noreferrer">Tanya via WhatsApp</a></div>}
            </div>
          </article>
        );}) : <div className="empty">Produk tidak ditemukan. Coba kata kunci atau kategori lain.</div>}
      </div>
    </section>
  );
}

function AuthPage({ onLogin, onRegister }) {
  const [tab, setTab] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [reg, setReg] = useState({ name: '', username: '', password: '', phone: '', address: '' });
  return (
    <div className="auth-wrap">
      <div className="panel">
        <div className="tabs">
          <button className={`btn tab ${tab === 'login' ? 'primary' : ''}`} onClick={() => setTab('login')}>Masuk</button>
          <button className={`btn tab ${tab === 'register' ? 'primary' : ''}`} onClick={() => setTab('register')}>Daftar Pembeli</button>
        </div>
        {tab === 'login' ? (
          <>
            <form onSubmit={(e) => { e.preventDefault(); onLogin(loginForm.username, loginForm.password); }}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="field"><label htmlFor="loginUsername">Username</label><input id="loginUsername" required value={loginForm.username} onChange={(e)=>setLoginForm(v=>({...v,username:e.target.value}))} autoComplete="username" /></div>
                <div className="field"><label htmlFor="loginPassword">Kata sandi</label><input id="loginPassword" type="password" required value={loginForm.password} onChange={(e)=>setLoginForm(v=>({...v,password:e.target.value}))} autoComplete="current-password" /></div>
              </div>
              <div className="form-actions"><button className="btn primary block" type="submit">Masuk</button></div>
            </form>
            <div className="hint-box" style={{ marginTop: 14 }}>
              <strong>Akun demo:</strong><br />
              Admin: <code>admin / admin123</code><br />
              Penjual: <code>seller1 / seller123</code>, <code>seller2 / seller123</code><br />
              Pembeli: <code>pembeli1 / pembeli123</code>, <code>pembeli2 / pembeli123</code>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); onRegister(reg); }}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field"><label htmlFor="regName">Nama lengkap *</label><input id="regName" required value={reg.name} onChange={(e)=>setReg(v=>({...v,name:e.target.value}))} /></div>
              <div className="field"><label htmlFor="regUsername">Username *</label><input id="regUsername" required minLength={3} value={reg.username} onChange={(e)=>setReg(v=>({...v,username:e.target.value}))} /></div>
              <div className="field"><label htmlFor="regPassword">Kata sandi * (min. 6)</label><input id="regPassword" type="password" required minLength={6} value={reg.password} onChange={(e)=>setReg(v=>({...v,password:e.target.value}))} /></div>
              <div className="field"><label htmlFor="regPhone">No. telepon</label><input id="regPhone" value={reg.phone} onChange={(e)=>setReg(v=>({...v,phone:e.target.value}))} /></div>
              <div className="field"><label htmlFor="regAddress">Alamat</label><textarea id="regAddress" value={reg.address} onChange={(e)=>setReg(v=>({...v,address:e.target.value}))} /></div>
            </div>
            <div className="form-actions"><button className="btn primary block" type="submit">Buat akun pembeli</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

function CartPage({ user, cart, products, users, getSeller, getSellerName, onQty, onRemove, onCheckout }) {
  const [address, setAddress] = useState(user?.address || '');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const items = cart.map((ci) => ({ ...ci, product: products.find((p) => p.id === ci.productId) })).filter((x) => x.product);
  const total = items.reduce((s, i) => s + i.product.harga * i.qty, 0);
  const sellerIds = [...new Set(items.map((i) => i.product.sellerId))];
  const paymentOptions = ['Transfer Bank', 'COD (Bayar di Tempat)', 'E-Wallet (Dana/OVO/GoPay/ShopeePay)', 'QRIS (konfirmasi manual)'];
  return (
    <section className="view active">
      <div className="section-head"><div><h2>Keranjang Belanja</h2><p>Periksa item, pilih metode pembayaran, lalu buat pesanan.</p></div></div>
      <div className="cart-layout">
        <div className="panel">
          {items.length ? items.map((i) => {
            const seller = getSeller(i.product.sellerId);
            const wa = waLink(seller?.phone, `Halo ${seller?.storeName || seller?.name || ''}, saya ingin bertanya tentang produk ${i.product.nama}.`);
            return (
            <div className="cart-item" key={i.productId}>
              <img src={imgFor(i.product)} alt={i.product.nama} />
              <div>
                <strong>{i.product.nama}</strong><div className="muted">{getSellerName(i.product.sellerId)} · {rupiah(i.product.harga)}</div>
                {seller?.phone && <div className="muted">WA penjual: <a href={wa} target="_blank" rel="noopener noreferrer">{formatPhone(seller.phone)}</a></div>}
                <div className="qty" style={{ marginTop: 6 }}>
                  <button className="btn small" onClick={() => onQty(i.productId, i.qty - 1)}>−</button>
                  <input type="number" min={1} max={i.product.stok} value={i.qty} onChange={(e) => onQty(i.productId, e.target.value)} />
                  <button className="btn small" onClick={() => onQty(i.productId, i.qty + 1)}>+</button>
                  <button className="btn small danger" onClick={() => onRemove(i.productId)}>Hapus</button>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>Stok tersedia: {i.product.stok}</div>
              </div>
              <div><strong>{rupiah(i.product.harga * i.qty)}</strong></div>
            </div>
          );}) : <div className="empty">Keranjang masih kosong.</div>}
        </div>
        <div className="panel">
          <h2>Ringkasan & Checkout</h2>
          <div className="total-row"><span>Total</span><span>{rupiah(total)}</span></div>
          {sellerIds.length > 1 && <p className="notice">Pesanan ini berisi produk dari {sellerIds.length} penjual. Konfirmasi pembayaran/pengiriman dapat dilakukan ke masing-masing penjual via WhatsApp.</p>}
          <form style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); if (!String(address).trim()) return; onCheckout(address, note, paymentMethod); }}>
            <div className="field"><label htmlFor="coPayment">Metode pembayaran *</label>
              <select id="coPayment" required value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value)}>
                <option value="">Pilih metode pembayaran</option>
                {paymentOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <p className="notice">Tanpa payment gateway. Setelah pesanan dibuat, silakan konfirmasi pembayaran ke penjual melalui WhatsApp sesuai metode yang dipilih.</p>
            </div>
            <div className="field" style={{ marginTop: 10 }}><label htmlFor="coAddress">Alamat pengiriman *</label><textarea id="coAddress" required value={address} onChange={(e)=>setAddress(e.target.value)} /></div>
            <div className="field" style={{ marginTop: 10 }}><label htmlFor="coNote">Catatan</label><textarea id="coNote" placeholder="Contoh: kirim sore hari, konfirmasi via WA" value={note} onChange={(e)=>setNote(e.target.value)} /></div>
            <div className="form-actions"><button className="btn primary block" type="submit" disabled={!items.length}>Buat Pesanan</button></div>
          </form>
        </div>
      </div>
    </section>
  );
}

function BuyerOrdersPage({ user, orders, users, getSeller, getSellerName }) {
  const mine = orders.filter((o) => o.buyerId === user.id).sort((a,b)=>b.createdAt-a.createdAt);
  return (
    <section className="view active">
      <div className="section-head"><div><h2>Pesanan Saya</h2><p>Riwayat pesanan, metode pembayaran, dan kontak penjual.</p></div></div>
      <div className="panel">
        {mine.length ? (
          <div className="table-wrap"><table><thead><tr><th>ID & Tanggal</th><th>Item & Penjual</th><th>Total</th><th>Pembayaran</th><th>Status</th><th>Alamat & Kontak</th></tr></thead><tbody>
            {mine.map(o => {
              const sellerIds = [...new Set(o.items.map(i => i.sellerId))];
              const contacts = sellerIds.map((sid) => {
                const s = getSeller(sid);
                const wa = waLink(s?.phone, `Halo ${s?.storeName || s?.name || ''}, saya ingin konfirmasi pesanan ${o.id}.`);
                return <div key={sid} style={{ marginBottom: 4 }}>{getSellerName(sid)}: {s?.phone ? <a href={wa} target="_blank" rel="noopener noreferrer">{formatPhone(s.phone)}</a> : <span className="muted">-</span>}</div>;
              });
              return (
              <tr key={o.id}>
                <td><strong>{o.id}</strong><br /><span className="muted">{fmtDate(o.createdAt)}</span></td>
                <td>{o.items.map(i => <div key={i.productId+String(i.qty)}>{i.nama} x{i.qty} <span className="muted">({getSellerName(i.sellerId)})</span></div>)}</td>
                <td>{rupiah(o.total)}</td>
                <td><strong>{o.paymentMethod || 'Belum dipilih'}</strong><br /><span className="muted">Konfirmasi manual ke penjual</span></td>
                <td><StatusBadge status={o.status} /></td>
                <td>{o.address || '-'}<div style={{ marginTop: 6 }}>{contacts}</div>{o.note ? <div className="muted" style={{ marginTop: 4 }}>Catatan: {o.note}</div> : null}</td>
              </tr>
            );})}
          </tbody></table></div>
        ) : <div className="empty">Belum ada pesanan.</div>}
      </div>
    </section>
  );
}

function ProductForm({ user, users, products, editing, onSave, onCancel }) {
  const isAdmin = user.role === 'admin';
  const sellers = users.filter((u) => u.role === 'seller' && !u.disabled);
  const [form, setForm] = useState(() => ({
    ...emptyProduct,
    sellerId: isAdmin ? (sellers[0]?.id || '') : user.id,
  }));
  const [uploadStatus, setUploadStatus] = useState('Pilih foto dari perangkat. Placeholder akan digunakan bila kosong.');

  useEffect(() => {
    if (editing) {
      setForm({
        sellerId: editing.sellerId || (isAdmin ? sellers[0]?.id || '' : user.id),
        nama: editing.nama || '',
        kategori: editing.kategori || '',
        harga: editing.harga ?? '',
        stok: editing.stok ?? '',
        deskripsi: editing.deskripsi || '',
        imageUrl: editing.imageUrl || '',
        unggulan: editing.unggulan === true, // boolean
      });
      setUploadStatus(editing.imageUrl ? 'Foto produk tersimpan. Pilih file baru untuk menggantinya.' : 'Pilih foto dari perangkat. Placeholder akan digunakan bila kosong.');
    } else {
      setForm({ ...emptyProduct, sellerId: isAdmin ? (sellers[0]?.id || '') : user.id });
      setUploadStatus('Pilih foto dari perangkat. Placeholder akan digunakan bila kosong.');
    }
  }, [editing?.id, user.id, isAdmin]);

  const categories = [...new Set(products.map((x) => x.kategori).filter(Boolean))].sort();
  const featuredActive = form.unggulan === true;

  async function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith('image/')) { alert('Pilih file gambar yang valid.'); e.target.value = ''; return; }
    if (f.size > 8 * 1024 * 1024) { alert('Ukuran foto maksimal 8 MB.'); e.target.value = ''; return; }
    try {
      const data = await compressImage(f);
      setForm((v) => ({ ...v, imageUrl: data }));
      setUploadStatus(`${f.name} siap disimpan (gambar dioptimalkan).`);
    } catch {
      alert('Foto gagal diproses.');
    }
  }

  function submit(e) {
    e.preventDefault();
    onSave({
      sellerId: isAdmin ? form.sellerId : user.id,
      nama: String(form.nama).trim(),
      kategori: String(form.kategori).trim(),
      harga: Number(form.harga),
      stok: Number(form.stok),
      deskripsi: String(form.deskripsi || '').trim(),
      imageUrl: String(form.imageUrl || '').trim(),
      unggulan: form.unggulan === true,
    }, editing?.id || null);
  }

  return (
    <div className="panel" id="productEditorPanel">
      <div className="panel-head"><h2 id="formTitle">{editing ? 'Ubah produk' : 'Tambah produk'}</h2><button className="btn small" type="button" onClick={onCancel}>Tutup</button></div>
      <form id="productForm" onSubmit={submit}>
        <input type="hidden" id="editId" value={editing?.id || ''} />
        <div className="form-grid">
          {isAdmin ? (
            <div className="field"><label htmlFor="sellerInput">Penjual *</label>
              <select id="sellerInput" required value={form.sellerId} onChange={(e)=>setForm(v=>({...v,sellerId:e.target.value}))}>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.storeName || s.name}</option>)}
              </select>
            </div>
          ) : <input type="hidden" id="sellerInput" value={user.id} />}
          <div className="field"><label htmlFor="nameInput">Nama produk *</label><input id="nameInput" required maxLength={70} value={form.nama} onChange={(e)=>setForm(v=>({...v,nama:e.target.value}))} /></div>
          <div className="field"><label htmlFor="catInput">Kategori *</label><input id="catInput" required maxLength={40} list="categoryOptions" value={form.kategori} onChange={(e)=>setForm(v=>({...v,kategori:e.target.value}))} /><datalist id="categoryOptions">{categories.map(c=><option key={c} value={c} />)}</datalist></div>
          <div className="field"><label htmlFor="priceInput">Harga (Rupiah) *</label><input id="priceInput" type="number" min={0} step={1} required value={form.harga} onChange={(e)=>setForm(v=>({...v,harga:e.target.value}))} /></div>
          <div className="field"><label htmlFor="stockInput">Stok (pcs) *</label><input id="stockInput" type="number" min={0} step={1} required value={form.stok} onChange={(e)=>setForm(v=>({...v,stok:e.target.value}))} /></div>
          <div className="field full"><label htmlFor="descInput">Deskripsi</label><textarea id="descInput" maxLength={220} value={form.deskripsi} onChange={(e)=>setForm(v=>({...v,deskripsi:e.target.value}))} /></div>
          <div className="field full"><label htmlFor="imageFile">Upload foto produk</label><input id="imageFile" type="file" accept="image/*" onChange={onFile} />
            <div className="upload-preview"><img id="imagePreview" alt="Pratinjau foto produk" src={form.imageUrl || placeholder(form.nama || 'Pratinjau')} /><span className="upload-help" id="uploadStatus">{uploadStatus}</span></div>
            <input id="imageInput" type="hidden" value={form.imageUrl} readOnly />
          </div>
          <div className="field full">
            <div className="featured-option">
              <input id="featuredInput" type="checkbox" aria-describedby="featuredHelp featuredStatus" checked={featuredActive} onChange={(e)=>setForm(v=>({...v,unggulan:e.target.checked}))} />
              <div className="featured-copy">
                <label htmlFor="featuredInput">Jadikan produk unggulan</label>
                <small id="featuredHelp">Produk unggulan akan diberi tanda ★ dan ditampilkan lebih dahulu pada katalog.</small>
                <span className={`featured-state ${featuredActive ? 'is-active' : ''}`} id="featuredStatus" aria-live="polite">
                  <span className="state-dot" aria-hidden="true"></span>
                  <span>{featuredActive ? 'Ditandai sebagai produk unggulan' : 'Belum ditandai sebagai unggulan'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="form-actions"><button type="button" className="btn" onClick={onCancel}>Batal</button><button className="btn primary" type="submit">Simpan produk</button></div>
        <p className="notice">Harga harus angka ≥ 0 dan stok harus bilangan bulat ≥ 0. Status unggulan disimpan sebagai boolean di localStorage.</p>
      </form>
    </div>
  );
}

function SellerDashboard({ user, users, products, orders, getSellerName, onSaveProduct, onDeleteProduct, onUpdateOrder }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const mineProducts = products.filter((p) => p.sellerId === user.id);
  const mineOrders = orders.filter((o) => o.items.some((i) => i.sellerId === user.id)).sort((a,b)=>b.createdAt-a.createdAt);
  const revenue = mineOrders.filter(o => o.status !== 'dibatalkan').reduce((sum, o) => sum + o.items.filter(i=>i.sellerId===user.id).reduce((s,i)=>s+i.harga*i.qty,0), 0);

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(p) { setEditing(p); setShowForm(true); }
  function close() { setEditing(null); setShowForm(false); }
  function save(payload, id) { onSaveProduct(payload, id); close(); }

  return (
    <section className="view active">
      <div className="section-head"><div><div className="eyebrow">Dashboard Penjual</div><h2>{user.storeName || user.name}</h2><p>Kelola produk dan pesanan toko Anda.</p></div></div>
      <div className="stats">
        <div className="stat"><span>Total produk</span><strong>{mineProducts.length}</strong></div>
        <div className="stat"><span>Total stok</span><strong>{mineProducts.reduce((s,p)=>s+Number(p.stok||0),0)}</strong></div>
        <div className="stat"><span>Pesanan terkait</span><strong>{mineOrders.length}</strong></div>
        <div className="stat"><span>Omzet (non-batal)</span><strong style={{fontSize:20}}>{rupiah(revenue)}</strong></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>Produk Saya</h2><button className="btn primary" onClick={openNew}>＋ Tambah produk</button></div>
        <div className="table-wrap"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Label</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          {mineProducts.length ? mineProducts.map(p => (
            <tr key={p.id}>
              <td><strong>{p.nama}</strong></td><td>{p.kategori}</td><td>{rupiah(p.harga)}</td><td>{p.stok}</td>
              <td>{p.unggulan ? '★ Unggulan' : '—'}</td><td>{p.aktif!==false?<span className="badge ok">Aktif</span>:<span className="badge muted">Nonaktif</span>}</td>
              <td><div className="actions"><button className="btn small" onClick={()=>openEdit(p)}>Edit</button><button className="btn small danger" onClick={()=>onDeleteProduct(p.id)}>Hapus</button></div></td>
            </tr>
          )) : <tr><td colSpan={7}>Belum ada produk.</td></tr>}
        </tbody></table></div>
      </div>
      {showForm && <ProductForm user={user} users={users} products={products} editing={editing} onSave={save} onCancel={close} />}
      <div className="panel">
        <div className="panel-head"><h2>Pesanan Masuk</h2></div>
        {mineOrders.length ? (
          <div className="table-wrap"><table><thead><tr><th>Pesanan</th><th>Pembeli</th><th>Item (toko)</th><th>Total & Pembayaran</th><th>Status</th><th>Ubah status</th></tr></thead><tbody>
            {mineOrders.map(o => {
              const buyer = users.find(u=>u.id===o.buyerId);
              const myItems = o.items.filter(i=>i.sellerId===user.id);
              const myTotal = myItems.reduce((s,i)=>s+i.harga*i.qty,0);
              const buyerWa = waLink(buyer?.phone, `Halo ${buyer?.name || ''}, terkait pesanan ${o.id} di RasaDapur.`);
              return (
                <tr key={o.id}>
                  <td><strong>{o.id}</strong><br /><span className="muted">{fmtDate(o.createdAt)}</span></td>
                  <td>{buyer?.name||o.buyerId}<br /><span className="muted">{o.address||'-'}</span>{buyer?.phone ? <div><a href={buyerWa} target="_blank" rel="noopener noreferrer">{formatPhone(buyer.phone)}</a></div> : null}</td>
                  <td>{myItems.map(i=><div key={i.productId}>{i.nama} x{i.qty}</div>)}</td>
                  <td>{rupiah(myTotal)}<br /><span className="muted">{o.paymentMethod || 'Belum dipilih'}</span></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><select className="control" style={{minWidth:140,padding:'6px 8px'}} value={o.status} onChange={(e)=>onUpdateOrder(o.id,e.target.value)}>
                    {['menunggu','diproses','dikirim','selesai','dibatalkan'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select></td>
                </tr>
              );
            })}
          </tbody></table></div>
        ) : <div className="empty">Belum ada pesanan untuk toko Anda.</div>}
      </div>
    </section>
  );
}

function AdminDashboard({ user, users, products, orders, getSellerName, onSaveProduct, onDeleteProduct, onUpdateOrder, onToggleUser, onReset }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const sortedOrders = [...orders].sort((a,b)=>b.createdAt-a.createdAt);
  const omzet = orders.filter(o=>o.status!=='dibatalkan').reduce((s,o)=>s+o.total,0);
  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(p) { setEditing(p); setShowForm(true); }
  function close() { setEditing(null); setShowForm(false); }
  function save(payload, id) { onSaveProduct(payload, id); close(); }

  return (
    <section className="view active">
      <div className="section-head"><div><div className="eyebrow">Dashboard Admin</div><h2>Panel Administrasi</h2><p>Kelola pengguna, produk, dan pesanan seluruh sistem.</p></div>
        <button className="btn danger" onClick={onReset}>Reset data dummy</button></div>
      <div className="stats">
        <div className="stat"><span>Pengguna</span><strong>{users.length}</strong></div>
        <div className="stat"><span>Produk</span><strong>{products.length}</strong></div>
        <div className="stat"><span>Pesanan</span><strong>{orders.length}</strong></div>
        <div className="stat"><span>Omzet (non-batal)</span><strong style={{fontSize:20}}>{rupiah(omzet)}</strong></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>Manajemen Pengguna</h2></div>
        <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Info</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td><strong>{u.name}</strong></td><td>{u.username}</td><td>{roleLabel(u.role)}</td>
              <td>{u.storeName || u.address || u.phone || '-'}</td>
              <td>{u.disabled ? <span className="badge danger">Nonaktif</span> : <span className="badge ok">Aktif</span>}</td>
              <td>{u.id===user.id ? <span className="muted">Akun ini</span> : <button className="btn small" onClick={()=>onToggleUser(u.id)}>{u.disabled?'Aktifkan':'Nonaktifkan'}</button>}</td>
            </tr>
          ))}
        </tbody></table></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>Semua Produk</h2><button className="btn primary" onClick={openNew}>＋ Tambah produk</button></div>
        <div className="table-wrap"><table><thead><tr><th>Produk</th><th>Penjual</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Label</th><th>Aksi</th></tr></thead><tbody>
          {products.length ? products.map(p => (
            <tr key={p.id}>
              <td><strong>{p.nama}</strong></td><td>{getSellerName(p.sellerId)}</td><td>{p.kategori}</td><td>{rupiah(p.harga)}</td><td>{p.stok}</td>
              <td>{p.unggulan ? '★ Unggulan' : '—'}</td>
              <td><div className="actions"><button className="btn small" onClick={()=>openEdit(p)}>Edit</button><button className="btn small danger" onClick={()=>onDeleteProduct(p.id)}>Hapus</button></div></td>
            </tr>
          )) : <tr><td colSpan={7}>Belum ada produk.</td></tr>}
        </tbody></table></div>
      </div>
      {showForm && <ProductForm user={user} users={users} products={products} editing={editing} onSave={save} onCancel={close} />}
      <div className="panel">
        <div className="panel-head"><h2>Semua Pesanan</h2></div>
        {sortedOrders.length ? (
          <div className="table-wrap"><table><thead><tr><th>Pesanan</th><th>Pembeli</th><th>Item</th><th>Total & Pembayaran</th><th>Status</th><th>Ubah status</th></tr></thead><tbody>
            {sortedOrders.map(o => {
              const buyer = users.find(u=>u.id===o.buyerId);
              return (
                <tr key={o.id}>
                  <td><strong>{o.id}</strong><br /><span className="muted">{fmtDate(o.createdAt)}</span></td>
                  <td>{buyer?.name||o.buyerId}{buyer?.phone ? <div><a href={waLink(buyer.phone)} target="_blank" rel="noopener noreferrer">{formatPhone(buyer.phone)}</a></div> : null}</td>
                  <td>{o.items.map(i=><div key={i.productId+String(i.qty)}>{i.nama} x{i.qty} <span className="muted">({getSellerName(i.sellerId)})</span></div>)}</td>
                  <td>{rupiah(o.total)}<br /><span className="muted">{o.paymentMethod || 'Belum dipilih'}</span></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><select className="control" style={{minWidth:140,padding:'6px 8px'}} value={o.status} onChange={(e)=>onUpdateOrder(o.id,e.target.value)}>
                    {['menunggu','diproses','dikirim','selesai','dibatalkan'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select></td>
                </tr>
              );
            })}
          </tbody></table></div>
        ) : <div className="empty">Belum ada pesanan.</div>}
      </div>
    </section>
  );
}
