# 🤖 Soal Scanner AI Extension

Extension Chrome yang bisa scan soal dari screenshot dan dijawab pakai Gemini AI dengan overlay jawaban langsung di halaman web.

## 🚀 Fitur

- ✅ Screenshot otomatis halaman web dengan kompresi optimal
- 🤖 AI-powered question answering dengan Gemini 2.0 Flash
- 📸 Kompresi dan optimasi gambar untuk respon lebih cepat
- 💬 Prompting yang dioptimasi untuk jawaban singkat dan akurat
- ⚙️ Settings page yang user-friendly dengan validasi API key
- 🔄 Real-time feedback dan status update
- 📱 UI yang modern dan responsive
- 🎯 **Overlay jawaban langsung di halaman web** - jawaban muncul sebagai popup di halaman, bukan di extension popup
- 📐 **Snipping tool** untuk pilih area soal spesifik
- 📋 **Copy jawaban** dengan satu klik langsung dari overlay

## 🆕 Fitur Overlay Baru

### Overlay Jawaban di Halaman Web
- **Jawaban muncul langsung di halaman** sebagai overlay yang cantik dan modern
- **Auto-close** setelah 30 detik atau bisa ditutup manual
- **Copy button** untuk salin jawaban dengan sekali klik
- **Loading indicator** dengan spinner saat AI memproses
- **Error overlay** untuk notifikasi error yang jelas
- **Responsive design** yang works di semua ukuran layar

### Pengalaman User yang Lebih Baik
- Tidak perlu buka-tutup popup extension berulang kali
- Jawaban tetap terlihat sambil scroll halaman
- Copy jawaban langsung tanpa select manual
- Visual feedback yang lebih jelas dan menarik

## 🎯 Optimasi Terbaru

### Kompresi Gambar
- Auto resize gambar ke maksimal 1200px width
- Kompresi JPEG dengan kualitas 80% untuk balance antara size dan clarity
- Reduksi ukuran file hingga 70% tanpa mengurangi keterbacaan teks

### Prompting AI
- Prompt dioptimasi untuk jawaban langsung tanpa penjelasan panjang
- Fokus pada ekstraksi informasi penting dari soal
- Temperature rendah (0.2) untuk konsistensi jawaban
- Max tokens 300 untuk respon yang ringkas

### UI/UX Enhancement
- Overlay dengan animasi smooth fade-in dan scale
- Modern gradient header untuk overlay
- Responsive button actions
- Clear visual hierarchy dengan icon dan warna

## 📋 Cara Install

### 1. Download & Setup
```bash
# Clone atau download project ini
git clone [repository-url]
cd ai-soal
```

### 2. Install ke Chrome
1. Buka Chrome dan pergi ke `chrome://extensions/`
2. Aktifkan "Developer mode" (toggle di kanan atas)
3. Klik "Load unpacked" 
4. Pilih folder project ini
5. Extension akan muncul di toolbar Chrome

### 3. Setup API Key
1. Klik icon extension di toolbar
2. Klik tombol "Settings API Key"
3. Dapatkan API key dari [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Paste API key dan klik "Simpan API Key"
5. Extension akan test validitas API key secara otomatis

## 📖 Cara Pakai

### Quick Start dengan Overlay
1. **Buka halaman** dengan soal yang ingin dijawab
2. **Klik icon extension** di toolbar
3. **Pilih mode scan:**
   - **"📐 Pilih Area Soal"** - untuk scan area tertentu (recommended)
   - **"📸 Scan Seluruh Halaman"** - untuk scan seluruh halaman
4. **Tunggu loading** - overlay loading akan muncul di halaman
5. **Lihat jawaban** - overlay jawaban akan muncul langsung di halaman web
6. **Copy jawaban** dengan klik tombol "Copy Jawaban" jika perlu
7. **Tutup overlay** dengan klik tombol "×" atau "Tutup"

### Fitur Overlay Jawaban
- 🎨 **Modern UI** dengan gradient header dan smooth animation
- 📋 **Copy Button** - salin jawaban ke clipboard dengan sekali klik
- ⏰ **Auto Close** - overlay tutup otomatis setelah 30 detik
- ❌ **Manual Close** - klik tombol × atau "Tutup" kapan saja
- 📱 **Responsive** - works sempurna di desktop dan mobile view
- 🚀 **Fast Access** - tidak perlu bolak-balik ke popup extension

### Tips untuk Hasil Optimal
- 📸 **Screenshot area spesifik** yang berisi soal saja (gunakan snipping tool)
- 🔍 **Pastikan teks terlihat jelas** dan tidak blur atau terpotong
- 📏 **Gunakan "Pilih Area Soal"** untuk fokus ke bagian soal saja
- ⚡ **Soal pilihan ganda** akan menampilkan huruf dan penjelasan singkat
- 🧮 **Soal perhitungan** akan menampilkan langkah dan hasil akhir
- 🌟 **Hindari screenshot dengan banyak elemen** yang tidak relevan
- 📝 **Untuk soal essay**, pastikan pertanyaan lengkap terlihat

### Meningkatkan Akurasi AI
- 🎯 **Screenshot hanya soal** - jangan include header, footer, atau menu
- 📐 **Pastikan orientasi benar** - soal tidak miring atau terbalik
- 🔆 **Cek pencahayaan** - avoid shadow atau refleksi yang menghalangi teks
- 📱 **Zoom jika perlu** sebelum screenshot untuk teks yang lebih besar
- 🔄 **Coba ulang** jika jawaban tidak akurat dengan screenshot yang lebih baik

## 🛠️ Troubleshooting

### "API Key belum diset"
- Masuk ke Settings dan paste API key yang valid
- Pastikan API key dari Google AI Studio, bukan Google Cloud

### "Gagal menguji API Key"
- Cek koneksi internet
- Pastikan API key valid dan active
- Restart extension jika perlu

### "AI tidak dapat memberikan jawaban"
- Coba screenshot area yang lebih fokus ke soal
- Pastikan teks soal terlihat jelas dan tidak terpotong
- Hindari screenshot area yang terlalu ramai/banyak elemen

### "Overlay tidak muncul"
- Pastikan halaman bukan chrome:// atau extension page
- Refresh halaman dan coba lagi
- Check console browser untuk error message
- Pastikan extension permissions sudah granted

### "Jawaban AI sering salah"
- 📷 **Kualitas screenshot**: Pastikan gambar tidak blur dan teks terbaca jelas
- 🎯 **Focus area**: Screenshot hanya bagian soal, hindari elemen lain
- 🔍 **Resolusi**: Zoom halaman jika teks terlalu kecil sebelum screenshot
- 📝 **Kelengkapan soal**: Pastikan pertanyaan dan pilihan jawaban tidak terpotong
- 🔄 **Coba lagi**: AI akan lebih akurat dengan input gambar yang berkualitas
- 📐 **Orientasi**: Pastikan gambar tidak miring atau terbalik

### "Soal tidak terbaca dengan baik"
- Increase brightness halaman sebelum screenshot
- Pastikan kontras antara teks dan background cukup
- Hindari screenshot dengan watermark atau overlay yang menutupi teks
- Gunakan mode desktop jika dari mobile untuk teks yang lebih besar

## 🔧 Technical Details

### API Endpoint
- Menggunakan Gemini 2.0 Flash model
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`

### Performance
- Kompresi gambar: ~70% size reduction
- Response time: 2-5 detik average
- Akurasi: Optimized untuk soal akademik Indonesia
- Overlay render: < 300ms dengan smooth animation

### Browser Support
- Chrome 88+
- Microsoft Edge 88+
- Browser berbasis Chromium lainnya

### Overlay Features
- Pure CSS3 animations dengan hardware acceleration
- Z-index management untuk avoid conflicts
- Auto-cleanup untuk prevent memory leaks
- Cross-browser compatibility

## 📝 Changelog

### v2.0 - Overlay Update
- ✅ **Overlay jawaban** langsung di halaman web
- ✅ **Loading indicator** dengan spinner animation
- ✅ **Copy button** untuk salin jawaban
- ✅ **Auto close** dan manual close options
- ✅ **Error overlay** untuk feedback yang jelas
- ✅ **Modern UI** dengan gradient dan animations
- ✅ **Responsive design** untuk semua device

### v1.0
- ✅ Initial release dengan basic screenshot + AI
- ✅ Options page untuk API key management
- ✅ Kompresi gambar otomatis
- ✅ Prompting yang dioptimasi untuk jawaban singkat
- ✅ Real-time status feedback
- ✅ Error handling yang comprehensive

## 🤝 Kontribusi

Feel free untuk kontribusi! Silakan buat issue atau pull request untuk:
- Bug fixes
- Feature requests  
- Performance improvements
- UI/UX enhancements
- Accessibility improvements

## 📄 License

MIT License - silakan gunakan dan modifikasi sesuai kebutuhan.

---

**Happy Learning! 🎓** Semoga extension ini membantu proses belajar kamu jadi lebih efisien dengan pengalaman overlay yang seamless!

## ✅ **Hasil yang Diharapkan:**

- **Pilihan ganda**: `B. Kucing`
- **Perhitungan**: `25`
- **True/False**: `True`
- **Essay**: `Jakarta adalah ibu kota Indonesia` 