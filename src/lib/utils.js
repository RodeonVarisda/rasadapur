export function rupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
}

export function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '-';
  }
}

export function placeholder(name) {
  const safe = String(name || 'Produk').replace(/[&<>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440"><rect width="640" height="440" fill="#efe1d5"/><circle cx="320" cy="200" r="120" fill="#e2c8a8"/><text x="320" y="225" text-anchor="middle" font-size="104">🍽️</text><text x="320" y="375" text-anchor="middle" font-family="Arial" font-size="27" fill="#713b32">${safe.slice(0, 30)}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

export function imgFor(p) {
  return p && p.imageUrl && /^(data:image\/|\.{0,2}\/|https?:\/\/)/.test(p.imageUrl) ? p.imageUrl : placeholder(p?.nama);
}

export function roleLabel(r) {
  return { admin: 'Admin', seller: 'Penjual', buyer: 'Pembeli' }[r] || r;
}

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
