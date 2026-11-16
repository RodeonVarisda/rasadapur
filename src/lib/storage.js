const KEYS = {
  users: 'rasadapur.users.v1',
  products: 'rasadapur.products.v1',
  orders: 'rasadapur.orders.v1',
  session: 'rasadapur.session.v1',
  settings: 'rasadapur.settings.v1',
  cart: 'rasadapur.cart.v1',
};

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Gagal membaca storage', key, e);
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('Gagal menulis storage', key, e);
    return false;
  }
}

export function normalizeFeatured(value) {
  return value === true || value === 1 || value === 'true';
}

function seedUsers() {
  return [
    { id: 'u_admin', name: 'Admin RasaDapur', username: 'admin', password: 'admin123', role: 'admin', phone: '6281111111111' },
    { id: 'u_seller1', name: 'Bu Sari', username: 'seller1', password: 'seller123', role: 'seller', storeName: 'Dapur Bu Sari', phone: '6281222222222' },
    { id: 'u_seller2', name: 'Pak Hadi', username: 'seller2', password: 'seller123', role: 'seller', storeName: 'Osing Jaya', phone: '6281333333333' },
    { id: 'u_buyer1', name: 'Rina Pembeli', username: 'pembeli1', password: 'pembeli123', role: 'buyer', phone: '6281444444444', address: 'Jl. Mawar No. 10, Banyuwangi' },
    { id: 'u_buyer2', name: 'Andi Pembeli', username: 'pembeli2', password: 'pembeli123', role: 'buyer', phone: '6281555555555', address: 'Jl. Melati No. 5, Banyuwangi' },
  ];
}

function seedProducts() {
  return [
    { id: 'p1', sellerId: 'u_seller1', nama: 'Kue Bagiak', kategori: 'Kue Tradisional', harga: 28000, stok: 24, deskripsi: 'Kue kering khas Banyuwangi dengan tekstur renyah dan aroma kelapa.', imageUrl: '', unggulan: true, aktif: true },
    { id: 'p2', sellerId: 'u_seller1', nama: 'Sale Pisang', kategori: 'Camilan', harga: 18000, stok: 32, deskripsi: 'Olahan pisang manis yang cocok untuk teman minum teh.', imageUrl: '', unggulan: true, aktif: true },
    { id: 'p3', sellerId: 'u_seller2', nama: 'Kopi Osing', kategori: 'Minuman', harga: 35000, stok: 15, deskripsi: 'Kopi lokal bercita rasa khas untuk dinikmati kapan saja.', imageUrl: '', unggulan: false, aktif: true },
    { id: 'p4', sellerId: 'u_seller1', nama: 'Kue Klemben', kategori: 'Kue Tradisional', harga: 22000, stok: 18, deskripsi: 'Kue tradisional berbentuk khas dengan rasa sederhana dan akrab.', imageUrl: '', unggulan: false, aktif: true },
    { id: 'p5', sellerId: 'u_seller2', nama: 'Kerupuk Cumi', kategori: 'Camilan', harga: 25000, stok: 20, deskripsi: 'Camilan gurih untuk pelengkap hidangan keluarga.', imageUrl: '', unggulan: false, aktif: true },
    { id: 'p6', sellerId: 'u_seller2', nama: 'Pia Banyuwangi', kategori: 'Oleh-oleh', harga: 30000, stok: 12, deskripsi: 'Pia dengan isian manis, pilihan buah tangan dari Banyuwangi.', imageUrl: '', unggulan: true, aktif: true },
    { id: 'p7', sellerId: 'u_seller1', nama: 'Sambal Khas Osing', kategori: 'Oleh-oleh', harga: 16000, stok: 27, deskripsi: 'Sambal rumahan dengan karakter rasa pedas dan gurih.', imageUrl: '', unggulan: false, aktif: true },
    { id: 'p8', sellerId: 'u_seller2', nama: 'Jenang Waluh', kategori: 'Kue Tradisional', harga: 20000, stok: 14, deskripsi: 'Olahan waluh bertekstur lembut dengan rasa manis.', imageUrl: '', unggulan: false, aktif: true },
  ];
}

function seedOrders() {
  const now = Date.now();
  return [
    {
      id: 'o1', buyerId: 'u_buyer1', sellerIds: ['u_seller1'],
      items: [
        { productId: 'p1', nama: 'Kue Bagiak', harga: 28000, qty: 2, sellerId: 'u_seller1' },
        { productId: 'p2', nama: 'Sale Pisang', harga: 18000, qty: 1, sellerId: 'u_seller1' },
      ],
      total: 74000, status: 'selesai', paymentMethod: 'Transfer Bank', note: 'Tolong dibungkus rapi', address: 'Jl. Mawar No. 10, Banyuwangi',
      createdAt: now - 86400000 * 3, updatedAt: now - 86400000 * 2,
    },
    {
      id: 'o2', buyerId: 'u_buyer2', sellerIds: ['u_seller2'],
      items: [{ productId: 'p3', nama: 'Kopi Osing', harga: 35000, qty: 1, sellerId: 'u_seller2' }],
      total: 35000, status: 'diproses', paymentMethod: 'COD (Bayar di Tempat)', note: '', address: 'Jl. Melati No. 5, Banyuwangi',
      createdAt: now - 86400000, updatedAt: now - 43200000,
    },
    {
      id: 'o3', buyerId: 'u_buyer1', sellerIds: ['u_seller2'],
      items: [{ productId: 'p6', nama: 'Pia Banyuwangi', harga: 30000, qty: 2, sellerId: 'u_seller2' }],
      total: 60000, status: 'menunggu', paymentMethod: 'E-Wallet', note: 'Kirim sore', address: 'Jl. Mawar No. 10, Banyuwangi',
      createdAt: now - 3600000, updatedAt: now - 3600000,
    },
  ];
}

function seedSettings() {
  return { appName: 'RasaDapur', whatsappNumber: '6281234567890' };
}

export function ensureSeed() {
  if (!localStorage.getItem(KEYS.users)) write(KEYS.users, seedUsers());
  if (!localStorage.getItem(KEYS.products)) {
    write(KEYS.products, seedProducts());
  } else {
    const products = read(KEYS.products, []).map((p) => ({
      aktif: p.aktif !== false,
      sellerId: p.sellerId || 'u_seller1',
      ...p,
      unggulan: normalizeFeatured(p.unggulan),
    }));
    write(KEYS.products, products);
  }
  if (!localStorage.getItem(KEYS.orders)) {
    write(KEYS.orders, seedOrders());
  } else {
    const orders = read(KEYS.orders, []).map((o) => ({ paymentMethod: o.paymentMethod || 'Belum dipilih', ...o }));
    write(KEYS.orders, orders);
  }
  if (!localStorage.getItem(KEYS.settings)) write(KEYS.settings, seedSettings());
}

export function getUsers() { return read(KEYS.users, seedUsers()); }
export function setUsers(v) { return write(KEYS.users, v); }
export function getProducts() {
  return read(KEYS.products, seedProducts()).map((p) => ({
    aktif: p.aktif !== false,
    sellerId: p.sellerId || 'u_seller1',
    ...p,
    unggulan: normalizeFeatured(p.unggulan),
  }));
}
export function setProducts(v) { return write(KEYS.products, v); }
export function getOrders() { return read(KEYS.orders, seedOrders()); }
export function setOrders(v) { return write(KEYS.orders, v); }
export function getSession() { return read(KEYS.session, null); }
export function setSession(v) { return v ? write(KEYS.session, v) : localStorage.removeItem(KEYS.session); }
export function clearSession() { localStorage.removeItem(KEYS.session); }
export function getSettings() { return read(KEYS.settings, seedSettings()); }
export function setSettings(v) { return write(KEYS.settings, v); }
export function getCart() { return read(KEYS.cart, []); }
export function setCart(v) { return write(KEYS.cart, v); }

export function resetAll() {
  write(KEYS.users, seedUsers());
  write(KEYS.products, seedProducts());
  write(KEYS.orders, seedOrders());
  write(KEYS.settings, seedSettings());
  clearSession();
  write(KEYS.cart, []);
}

export { KEYS };
