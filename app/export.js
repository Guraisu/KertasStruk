/**
 * export.js - Pembuat Gambar Struk PNG (Canvas 2D) & Cetak PDF (@media print)
 * Murni Vanilla JS tanpa library eksternal, tajam di layar Retina/HP, dan aman offline.
 */

import { formatRupiah } from './catalog.js';
import { formatReceiptDate } from './receipt.js';

/**
 * Memecah teks panjang menjadi beberapa baris sesuai batas lebar canvas
 */
function wrapText(ctx, text, maxWidth) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

function loadLogoImage(src) {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/**
 * Merender struk langsung ke elemen HTML5 Canvas dengan resolusi tinggi (min 2x)
 */
export async function renderReceiptToCanvas(receipt, storeSettings = {}) {
    const scale = Math.max(2, window.devicePixelRatio || 2);
    const baseWidth = 440; // Lebar virtual dalam piksel (serupa kertas 58mm/80mm)
    const paddingX = 24;
    const contentWidth = baseWidth - (paddingX * 2);

    const logoImg = await loadLogoImage(storeSettings.logo);
    const logoMode = storeSettings.logoMode || 'header';
    const hasHeaderLogo = logoImg && (logoMode === 'header' || logoMode === 'both');
    const hasWatermark = logoImg && (logoMode === 'watermark' || logoMode === 'both');

    // Kanvas dummy untuk mengukur tinggi total yang dibutuhkan terlebih dahulu
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    mctx.font = '14px "Space Mono", monospace, monospace';

    // Hitung perkiraan tinggi dinamis
    let estimatedHeight = 140; // Header, nomor, tanggal, divider
    if (hasHeaderLogo) {
        let hlW = logoImg.width;
        let hlH = logoImg.height;
        if (hlW > 140 || hlH > 60) {
            const ratio = Math.min(140 / hlW, 60 / hlH);
            hlH = Math.round(hlH * ratio);
        }
        estimatedHeight += hlH + 14;
    }
    if (receipt.customerName) estimatedHeight += 24;

    // Items
    receipt.items.forEach(item => {
        const availableNameWidth = contentWidth - 110;
        const nameLines = wrapText(mctx, `${item.qty}x ${item.name}`, availableNameWidth);
        estimatedHeight += Math.max(1, nameLines.length) * 22 + 4;
    });

    estimatedHeight += 110; // Divider, subtotal, diskon, total, bayar
    if (receipt.note) estimatedHeight += 30;

    // Pesan penutup
    const closing = (storeSettings.closingMessage || '').trim();
    if (closing) {
        const closingLines = closing.split('\n');
        closingLines.forEach(line => {
            const wrapped = wrapText(mctx, line, contentWidth);
            estimatedHeight += Math.max(1, wrapped.length) * 20;
        });
        estimatedHeight += 40;
    }
    estimatedHeight += 40; // Ruang nafas bawah

    // Buat kanvas utama
    const canvas = document.createElement('canvas');
    canvas.width = baseWidth * scale;
    canvas.height = estimatedHeight * scale;

    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Latar kertas termal
    ctx.fillStyle = '#F9F6F0';
    ctx.fillRect(0, 0, baseWidth, estimatedHeight);

    // Render Watermark Samar di latar belakang jika aktif
    if (hasWatermark) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        const maxWm = 180;
        let wmW = logoImg.width;
        let wmH = logoImg.height;
        const wmRatio = Math.min(maxWm / wmW, maxWm / wmH);
        wmW = Math.round(wmW * wmRatio);
        wmH = Math.round(wmH * wmRatio);
        const wmX = Math.round((baseWidth - wmW) / 2);
        const wmY = Math.round((estimatedHeight - wmH) / 2);
        ctx.drawImage(logoImg, wmX, wmY, wmW, wmH);
        ctx.restore();
    }

    // Garis tepi kiri & kanan samar (khas gulungan kertas)
    ctx.strokeStyle = '#EBE6DC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(1, estimatedHeight);
    ctx.moveTo(baseWidth - 1, 0);
    ctx.lineTo(baseWidth - 1, estimatedHeight);
    ctx.stroke();

    // Style teks
    const colorInk = '#1A1E24';
    const colorMuted = '#5A6578';
    let y = 36;

    // Gambar Logo Header di atas nama toko jika aktif
    if (hasHeaderLogo) {
        let hlW = logoImg.width;
        let hlH = logoImg.height;
        if (hlW > 140 || hlH > 60) {
            const ratio = Math.min(140 / hlW, 60 / hlH);
            hlW = Math.round(hlW * ratio);
            hlH = Math.round(hlH * ratio);
        }
        const hlX = Math.round((baseWidth - hlW) / 2);
        ctx.drawImage(logoImg, hlX, y, hlW, hlH);
        y += hlH + 14;
    }

    // 1. Nama Toko
    const storeName = (storeSettings.storeName || 'KertasStruk').trim().toUpperCase();
    ctx.fillStyle = colorInk;
    ctx.font = 'bold 20px "Space Mono", monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(storeName, baseWidth / 2, y);
    y += 20;

    // 2. Alamat / No Telp Toko
    const address = (storeSettings.address || '').trim();
    const phone = (storeSettings.phone || '').trim();
    if (address || phone) {
        ctx.font = '12px "Space Mono", monospace, monospace';
        ctx.fillStyle = colorMuted;
        if (address) {
            ctx.fillText(address, baseWidth / 2, y);
            y += 18;
        }
        if (phone) {
            ctx.fillText('WA: ' + phone, baseWidth / 2, y);
            y += 18;
        }
    }

    // 3. Nomor Struk & Tanggal
    y += 4;
    ctx.font = '12px "Space Mono", monospace, monospace';
    ctx.fillStyle = colorMuted;
    ctx.fillText(`${receipt.receiptNo} · ${formatReceiptDate(receipt.createdAt)}`, baseWidth / 2, y);
    y += 18;

    if (receipt.customerName) {
        ctx.font = '12px "Space Mono", monospace, monospace';
        ctx.fillStyle = colorInk;
        ctx.fillText(`Pelanggan: ${receipt.customerName}`, baseWidth / 2, y);
        y += 18;
    }

    // Garis Putus-putus
    function drawDashedLine(currentY) {
        ctx.strokeStyle = colorInk;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(paddingX, currentY);
        ctx.lineTo(baseWidth - paddingX, currentY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset
    }

    y += 6;
    drawDashedLine(y);
    y += 20;

    // 4. Daftar Barang
    ctx.fillStyle = colorInk;
    ctx.font = '13px "Space Mono", monospace, monospace';

    receipt.items.forEach(item => {
        const itemSubtotal = formatRupiah(item.price * item.qty);
        const availableNameWidth = contentWidth - 110;
        const nameLines = wrapText(ctx, `${item.qty}x ${item.name}`, availableNameWidth);

        // Cetak nama (bisa multi-baris jika panjang)
        ctx.textAlign = 'left';
        nameLines.forEach((line, idx) => {
            ctx.fillText(line, paddingX, y + (idx * 20));
        });

        // Cetak subtotal di baris pertama
        ctx.textAlign = 'right';
        ctx.fillText(itemSubtotal, baseWidth - paddingX, y);

        y += Math.max(1, nameLines.length) * 20 + 4;
    });

    y += 4;
    drawDashedLine(y);
    y += 20;

    // 5. Rincian Diskon & Total
    if (receipt.discount > 0) {
        ctx.font = '12px "Space Mono", monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = colorMuted;
        ctx.fillText('Subtotal', paddingX, y);
        ctx.textAlign = 'right';
        ctx.fillText(formatRupiah(receipt.subtotal), baseWidth - paddingX, y);
        y += 20;

        ctx.textAlign = 'left';
        ctx.fillText('Diskon', paddingX, y);
        ctx.textAlign = 'right';
        ctx.fillText('-' + formatRupiah(receipt.discount), baseWidth - paddingX, y);
        y += 20;
    }

    // Total Besar
    ctx.font = 'bold 16px "Space Mono", monospace, monospace';
    ctx.fillStyle = colorInk;
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', paddingX, y);
    ctx.textAlign = 'right';
    ctx.fillText(formatRupiah(receipt.total), baseWidth - paddingX, y);
    y += 24;

    // Metode Bayar
    ctx.font = '12px "Space Mono", monospace, monospace';
    ctx.fillStyle = colorMuted;
    ctx.textAlign = 'left';
    ctx.fillText(`Bayar: ${receipt.paymentMethod || 'Tunai'}`, paddingX, y);
    y += 18;

    if (receipt.note) {
        ctx.fillText(`Catatan: ${receipt.note}`, paddingX, y);
        y += 18;
    }

    // 6. Pesan Penutup
    if (closing) {
        y += 6;
        drawDashedLine(y);
        y += 20;

        ctx.font = 'italic 12px "Space Mono", monospace, monospace';
        ctx.fillStyle = colorInk;
        ctx.textAlign = 'center';

        const rawLines = closing.split('\n');
        rawLines.forEach(rLine => {
            const wrapped = wrapText(ctx, rLine, contentWidth);
            wrapped.forEach(wLine => {
                ctx.fillText(wLine, baseWidth / 2, y);
                y += 18;
            });
        });
    }

    // Footer Stempel Kecil
    y += 12;
    ctx.font = '10px "Space Mono", monospace, monospace';
    ctx.fillStyle = colorMuted;
    ctx.textAlign = 'center';
    ctx.fillText('• KertasStruk •', baseWidth / 2, y);

    return canvas;
}

/**
 * Mengubah Canvas menjadi Blob gambar PNG
 */
export async function getReceiptPngBlob(receipt, storeSettings = {}) {
    const canvas = await renderReceiptToCanvas(receipt, storeSettings);
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Gagal memproses gambar struk.'));
            }
        }, 'image/png');
    });
}

/**
 * Unduh struk sebagai file PNG
 */
export async function downloadReceiptPng(receipt, storeSettings = {}) {
    const blob = await getReceiptPngBlob(receipt, storeSettings);
    const url = URL.createObjectURL(blob);
    const filename = `struk-${receipt.receiptNo.toLowerCase()}.png`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

/**
 * Bagikan gambar PNG melalui native Web Share API bila didukung oleh browser/HP
 */
export async function shareReceiptPng(receipt, storeSettings = {}) {
    const blob = await getReceiptPngBlob(receipt, storeSettings);
    const filename = `struk-${receipt.receiptNo.toLowerCase()}.png`;
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: `Struk ${receipt.receiptNo}`,
                text: `Struk pembelian dari ${storeSettings.storeName || 'KertasStruk'}`
            });
            return { shared: true };
        } catch (err) {
            if (err.name === 'AbortError') {
                return { shared: false, aborted: true };
            }
            throw err;
        }
    }

    // Jika Web Share tidak mendukung share file, fallback ke download
    await downloadReceiptPng(receipt, storeSettings);
    return { shared: false, fallbackDownload: true };
}

/**
 * Mencetak struk ke printer thermal atau Simpan sebagai PDF via window.print()
 * Menyembunyikan seluruh tombol UI & void container secara native
 */
export function printReceipt() {
    const voidBox = document.getElementById('modal-void-container');
    if (voidBox) {
        voidBox.setAttribute('hidden', '');
        voidBox.style.setProperty('display', 'none');
    }

    document.body.classList.add('is-printing-receipt');

    window.print();

    // Pulihkan status tampilan setelah proses cetak selesai
    setTimeout(() => {
        document.body.classList.remove('is-printing-receipt');
        if (voidBox) {
            voidBox.removeAttribute('hidden');
            voidBox.style.removeProperty('display');
        }
    }, 500);
}

// Pasang listener global beforeprint & afterprint untuk menangani jika user cetak lewat Ctrl+P / browser menu
if (typeof window !== 'undefined') {
    window.addEventListener('beforeprint', () => {
        document.body.classList.add('is-printing-receipt');
        const voidBox = document.getElementById('modal-void-container');
        if (voidBox) {
            voidBox.setAttribute('hidden', '');
            voidBox.style.setProperty('display', 'none');
        }
    });

    window.addEventListener('afterprint', () => {
        document.body.classList.remove('is-printing-receipt');
        const voidBox = document.getElementById('modal-void-container');
        if (voidBox) {
            voidBox.removeAttribute('hidden');
            voidBox.style.removeProperty('display');
        }
    });
}
