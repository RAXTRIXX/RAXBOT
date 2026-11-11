# RAXBOT — WhatsApp bot untuk Termux

RAXBOT adalah project bot command-based untuk akun WhatsApp milik sendiri, dibuat dengan Node.js dan Baileys. Baileys adalah library komunitas/tidak resmi, bukan produk WhatsApp/Meta.

## Fitur
- Pairing code saat pertama kali dijalankan; sesi disimpan lokal.
- `.menu all`, `.menu sticker`, `.menu game`, `.menu anime`, `.menu grup`, `.menu owner`, `.ping`, `.botinfo`, `.time`, `.date`, `.quote`, `.calc`, `.coin`, `.dice`.
- `.owner`, `.runtime`, `.addmod`, `.delmod` (add/del moderator hanya owner).
- Grup: `.groupinfo`, `.tagall`, `.hidetag`.
- Pengaturan grup: `.welcome on/off`, `.antilink on/off`.
- Stiker gambar dengan `.sticker`, game tebak angka `.tebakangka` dan `.jawab`, rekomendasi anime `.anime`.\n- Sapaan otomatis untuk pesan "hai", "halo", "hello", "assalamualaikum".
- Welcome anggota baru dan filter tautan undangan grup (perlu bot menjadi admin untuk menghapus pesan).

## Persyaratan
- Android dengan Termux yang terpasang dari sumber tepercaya.
- Koneksi internet stabil.
- Node.js 20 atau lebih baru.
- Akun WhatsApp milik sendiri. Pairing dilakukan dari menu Perangkat tertaut.

## Instalasi di Termux
Jalankan satu per satu:

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts git nano -y
```

Pindahkan folder `RAXBOT` ke penyimpanan Termux, lalu masuk ke foldernya. Jika ZIP ada di folder Download:

```bash
termux-setup-storage
cd ~/storage/downloads
unzip RAXBOT-Termux.zip
cd RAXBOT
```

Jika perintah `unzip` belum tersedia:

```bash
pkg install unzip -y
```

Install dependency:

```bash
npm install
```

Buat konfigurasi:

```bash
cp .env.example .env
nano .env
```

Isi `OWNER_NUMBER` dengan nomor owner dalam format kode negara dan angka saja. Contoh format Indonesia: `62812xxxxxxx`. Simpan di nano dengan `CTRL+O`, Enter, lalu `CTRL+X`.

Jalankan:

```bash
npm start
```

Saat diminta, masukkan nomor WhatsApp yang akan dipakai sebagai akun bot, format angka saja dan kode negara, misalnya `62812xxxxxxx`. RAXBOT akan menampilkan kode pairing. Di WhatsApp pada akun tersebut:
1. Buka **Setelan**.
2. Pilih **Perangkat tertaut**.
3. Pilih **Tautkan dengan nomor telepon** (jika tersedia).
4. Masukkan kode pairing yang tampil di Termux.

Setelah terhubung, coba kirim `.menu all` ke chat akun bot dari akun lain atau chat yang sesuai.

## Menjalankan kembali
```bash
cd ~/RAXBOT
npm start
```
Sesi disimpan di folder `auth_info`, jadi biasanya tidak perlu pairing ulang.

## Menghentikan bot
Tekan `CTRL+C` di Termux.

## Mengatur bot
File `.env`:
- `OWNER_NUMBER`: nomor owner (format internasional angka saja).
- `BOT_NAME`: nama bot.
- `PREFIX`: awalan command, default `.`.\n- `MODERATOR_NUMBERS`: nomor moderator dipisahkan koma; moderator juga dapat ditambahkan/dihapus oleh owner dengan `.addmod` dan `.delmod`.

Contoh command:
- `.calc 12*(4+2)`
- `.welcome on`
- `.antilink on`

## Catatan penting
- Jangan pernah membagikan kode pairing, folder `auth_info`, atau file `.env`. Siapa pun yang mendapatkannya bisa mengambil alih sesi bot.
- Jangan commit atau upload `auth_info` ke GitHub. Folder ini dikecualikan oleh `.gitignore`.
- Gunakan bot hanya untuk percakapan yang diharapkan dan grup yang mengizinkan. Hindari spam, pesan massal, scraping, atau mengganggu pengguna.
- `!tagall` dan `!hidetag` dibatasi untuk admin grup atau owner yang dikonfigurasi.
- Fitur `!antilink` hanya menghapus tautan undangan grup WhatsApp dan hanya efektif jika bot memiliki izin admin. Uji dengan hati-hati bersama admin grup.
- Baileys bukan API resmi WhatsApp dan perubahan WhatsApp dapat menyebabkan koneksi rusak atau akun dibatasi. Untuk penggunaan bisnis/produksi, pertimbangkan WhatsApp Business Platform resmi.
- Jika pairing gagal, periksa koneksi internet, format nomor, versi Node.js (`node -v`), lalu coba lagi. Jangan kirim kode pairing ke orang lain.

## Troubleshooting
**`node: command not found`**
```bash
pkg install nodejs-lts -y
```

**Dependensi gagal terpasang**
```bash
pkg update
pkg upgrade -y
npm cache clean --force
npm install
```

**Pairing/session bermasalah**
Hentikan bot. Jika ingin memasangkan ulang, hapus sesi lokal (ini akan memutus sesi bot):
```bash
rm -rf auth_info
npm start
```

## Sumber
- Baileys repository & dokumentasi: https://github.com/WhiskeySockets/Baileys
- Baileys docs: https://baileys.wiki/
