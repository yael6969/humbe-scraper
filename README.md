# HUMBE SCRAPER

Web scraper ringan untuk data siswa & guru Kelas Humabetang.  
Berjalan sepenuhnya di perangkat via Node.js — tidak perlu framework tambahan.

---

## Quickstart di Termux

### 1. Install dependensi Termux (sekali saja)

```bash
pkg update && pkg upgrade -y
pkg install nodejs -y
```

> Node.js sudah include `npm`. Tidak ada package npm yang perlu diinstall — proyek ini **zero dependencies**.

---

### 2. Siapkan file proyek

Pindahkan semua file ke satu folder, misalnya `~/humbe-scraper`:

```
humbe-scraper/
├── index.html
├── style.css
├── script.js
├── server.js
├── teacher.json     ← sudah tersedia, isi dengan data guru
└── .env             ← wajib dikonfigurasi
```

---

### 3. Konfigurasi `.env`

Buka `.env` dan isi token:

```bash
nano .env
```

Ubah baris ini:

```
API_TOKEN=your_token_here
```

Ganti `your_token_here` dengan token Bearer yang valid. Simpan dengan `Ctrl+O`, lalu `Ctrl+X`.

---

### 4. Isi `teacher.json`

Format file:

```json
[
  { "name": "Nama Guru Lengkap", "id": "EMP001" },
  { "name": "Guru Lainnya",      "id": "EMP002" }
]
```

Edit sesuai data guru yang tersedia di sistem.

---

### 5. Jalankan server

```bash
cd ~/humbe-scraper
node server.js
```

Output yang muncul:

```
  HUMBE SCRAPER — running on http://localhost:3000
```

---

### 6. Buka di browser

Di Termux, buka browser HP dan akses:

```
http://localhost:3000
```

Atau dari perangkat lain di jaringan yang sama (ganti IP sesuai IP HP):

```
http://192.168.x.x:3000
```

> Cek IP HP kamu dengan perintah: `ifconfig` atau `ip addr`

---

## Cara Pakai

1. Pilih kategori **Siswa** atau **Guru** pada tab di atas.
2. Ketik nama (boleh sebagian) di kolom pencarian.
3. Tekan **Cari** atau Enter.
4. Hasil akan muncul sebagai card terpisah per orang.

Pencarian menggunakan **fuzzy search** — tidak perlu ingat nama lengkap.

---

## Troubleshooting

| Masalah | Solusi |
|--------|--------|
| `Error: ENOENT teacher.json` | Pastikan `teacher.json` ada di folder yang sama dengan `server.js` |
| `401 Unauthorized` | Token di `.env` salah atau expired — perbarui `API_TOKEN` |
| `ECONNREFUSED` | Cek koneksi internet Termux (aktifkan WiFi/data) |
| Port 3000 sudah dipakai | Ubah `PORT=3001` di `.env` dan restart |

---

## Menghentikan server

Tekan `Ctrl + C` di terminal Termux.

---

## Catatan Keamanan

- File `.env` berisi token sensitif — **jangan dibagikan**.
- Server hanya menerima koneksi lokal (bisa dibuka dari LAN jika diperlukan).
- Password guru ditampilkan di output — gunakan dengan bijak.
