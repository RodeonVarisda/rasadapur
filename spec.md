# RasaDapur — Spesifikasi Perbaikan Produk Unggulan

## 1. Ringkasan

Dokumen ini menjelaskan perbaikan fitur penandaan **Produk Unggulan** pada prototipe web RasaDapur. Perubahan berfokus pada kontrol checkbox di formulir tambah/edit produk, konsistensi penyimpanan status, dan kejelasan umpan balik visual.

## 2. Cakupan perubahan

- Memperjelas label dan keterangan checkbox Produk Unggulan.
- Menampilkan status langsung: aktif atau belum ditandai.
- Menyinkronkan status saat checkbox diklik, formulir dibuka untuk tambah produk, dan formulir dibuka untuk mengedit produk.
- Menyimpan status sebagai nilai boolean (`true` atau `false`).
- Menormalisasi data lama dari `localStorage` agar hanya nilai boolean `true`, angka `1`, atau string `"true"` yang dianggap aktif.
- Mempertahankan indikator `★ Unggulan` pada katalog dan dashboard.
- Mempertahankan pengurutan katalog yang menempatkan produk unggulan lebih dahulu pada opsi **Unggulan dahulu**.

## 3. Aturan fungsional

| ID | Kebutuhan | Perilaku yang diharapkan |
|---|---|---|
| F-01 | Tandai produk unggulan | Checkbox dicentang berarti `unggulan = true`. |
| F-02 | Batalkan tanda unggulan | Checkbox tidak dicentang berarti `unggulan = false`. |
| F-03 | Tambah produk | Nilai checkbox saat penyimpanan menjadi status awal produk. |
| F-04 | Edit produk | Checkbox menampilkan status unggulan produk yang sedang diedit. |
| F-05 | Umpan balik | Teks status berubah seketika mengikuti kondisi checkbox. |
| F-06 | Persistensi | Status disimpan bersama data produk di `localStorage`. |
| F-07 | Katalog | Produk dengan status unggulan menampilkan label bintang. |
| F-08 | Dashboard | Kolom Label menampilkan `★ Unggulan` atau `—`. |
| F-09 | Data lama | Nilai unggulan dari penyimpanan lama dinormalisasi menjadi boolean. |

## 4. Antarmuka pengguna

Elemen checkbox memiliki:
- ID: `featuredInput`
- Label terhubung melalui atribut `for`.
- Deskripsi bantuan: `featuredHelp`.
- Status aksesibel yang diumumkan pembaca layar: `featuredStatus` dengan `aria-live="polite"`.
- Warna aksen mengikuti warna utama RasaDapur.

## 5. Penyimpanan data

Kunci penyimpanan produk tetap:

```text
rasadapur.products.v1
```

Bentuk data produk tetap kompatibel dengan struktur sebelumnya:

```json
{
  "id": "p1",
  "nama": "Kue Bagiak",
  "kategori": "Kue Tradisional",
  "harga": 28000,
  "stok": 24,
  "deskripsi": "Kue kering khas Banyuwangi.",
  "imageUrl": "",
  "unggulan": true
}
```

Properti `unggulan` disimpan sebagai boolean, bukan teks.

## 6. Kriteria penerimaan / checklist pengujian

- [ ] Checkbox dapat dicentang dan dilepas.
- [ ] Teks status berubah sesuai kondisi checkbox.
- [ ] Produk baru yang disimpan dalam keadaan dicentang tampil sebagai unggulan.
- [ ] Produk baru yang disimpan tanpa centang tidak tampil sebagai unggulan.
- [ ] Saat mengedit produk unggulan, checkbox kembali dalam keadaan dicentang.
- [ ] Saat tanda unggulan dibatalkan dan disimpan, indikator bintang hilang dari katalog dan dashboard.
- [ ] Setelah halaman dimuat ulang, status unggulan tetap tersimpan.
- [ ] Nilai lama `"false"` tidak dianggap sebagai status unggulan aktif.
- [ ] Filter/pengurutan katalog dan fitur lain tetap berjalan.

## 7. Batasan prototipe

- Data disimpan secara lokal pada browser/perangkat melalui `localStorage`; belum menggunakan backend atau sinkronisasi antarperangkat.
- Pengujian lintas browser dan perangkat perlu dilakukan pada lingkungan pengguna.
- Perubahan ini tidak mengubah struktur katalog, data contoh, alur WhatsApp, atau fitur unggah foto.
