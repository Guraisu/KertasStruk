/**
 * Interaksi Demo Struk di Halaman Utama (Hero Section).
 * Menggunakan Vanilla JS, tanpa library eksternal.
 * Hanya untuk mensimulasikan fungsionalitas bagi pengunjung.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi State dan Formatter
    let demoCart = [];
    
    const rupiahFormatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    });

    // 2. Ambil Elemen DOM
    const chipsContainer = document.querySelector('.chip-group');
    const receiptList = document.getElementById('demo-items');
    const receiptTotal = document.getElementById('demo-total');
    const btnReset = document.getElementById('demo-reset');
    const dateLabel = document.getElementById('demo-date');

    // 3. Set Waktu Real-Time di Struk Demo
    if (dateLabel) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        dateLabel.textContent = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    }

    // 4. Fungsi Render Struk
    function renderReceipt() {
        if (!receiptList || !receiptTotal) return;

        receiptList.innerHTML = '';

        if (demoCart.length === 0) {
            receiptList.innerHTML = '<li class="empty-state">Belum ada pesanan masuk</li>';
            receiptTotal.textContent = 'Rp 0';
            return;
        }

        let totalAmount = 0;

        demoCart.forEach(item => {
            totalAmount += item.price;

            const li = document.createElement('li');
            li.className = 'receipt-item-row';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            
            const priceSpan = document.createElement('span');
            // Format tanpa simbol Rp untuk di baris detail
            priceSpan.textContent = rupiahFormatter.format(item.price).replace('Rp', '').trim();

            li.appendChild(nameSpan);
            li.appendChild(priceSpan);
            receiptList.appendChild(li);
        });

        receiptTotal.textContent = rupiahFormatter.format(totalAmount);
    }

    // 5. Event Listeners
    
    // Memakai Event Delegation untuk chip menu
    if (chipsContainer) {
        chipsContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;

            const name = chip.getAttribute('data-name');
            const price = parseInt(chip.getAttribute('data-price'), 10);

            if (name && !isNaN(price)) {
                demoCart.push({ name, price });
                renderReceipt();
            }
        });
    }

    // Tombol Reset Struk
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            demoCart = [];
            renderReceipt();
        });
    }
});