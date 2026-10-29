/**
 * whatsapp.js - Normalisasi Nomor Telepon & Pembuat Teks Struk WhatsApp
 * Mengubah data struk menjadi format pesan chat rapi dan aman encode URL.
 */

import { formatRupiah } from './catalog.js';
import { formatReceiptDate } from './receipt.js';

/**
 * Normalisasi nomor HP Indonesia
 * Mengubah "0812-3456-789" atau "+62 812..." menjadi "62812..."
 * Melemparkan error yang ramah jika format tidak valid.
 */
export function normalizeIndonesianPhone(input) {
    if (!input || !input.trim()) {
        return '';
    }

    // Bersihkan karakter selain angka
    let cleaned = input.replace(/[^\d]/g, '');

    if (!cleaned) {
        return '';
    }

    // Ubah awalan
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.slice(1);
    } else if (cleaned.startsWith('8')) {
        cleaned = '62' + cleaned;
    }

    // Validasi panjang dan awalan nomor Indonesia
    if (!cleaned.startsWith('628') || cleaned.length < 10 || cleaned.length > 15) {
        throw new Error('Nomor WhatsApp harus nomor seluler Indonesia yang valid (contoh: 0812xxxxxxxx atau 62812xxxxxxxx).');
    }

    return cleaned;
}

/**
 * Membuat teks struk WhatsApp yang bersih dan nyaman dibaca di chat
 */
export function formatReceiptWhatsAppText(receipt, storeSettings = {}) {
    const storeName = (storeSettings.storeName || 'KertasStruk').trim().toUpperCase();
    const storeAddress = (storeSettings.address || '').trim();
    const dateFormatted = formatReceiptDate(receipt.createdAt);
    const divider = '--------------------------------';

    const lines = [];

    // Header Toko
    lines.push(`*${storeName}*`);
    if (storeAddress) {
        lines.push(storeAddress);
    }
    lines.push(`${receipt.receiptNo} · ${dateFormatted}`);

    if (receipt.customerName) {
        lines.push(`Pelanggan: ${receipt.customerName}`);
    }

    lines.push(divider);

    // Daftar Barang
    receipt.items.forEach(item => {
        const itemLine = `${item.qty}x ${item.name}`;
        const itemSubtotal = formatRupiah(item.price * item.qty);
        lines.push(`${itemLine}  ${itemSubtotal}`);
    });

    lines.push(divider);

    // Subtotal & Diskon (jika ada diskon)
    if (receipt.discount > 0) {
        lines.push(`Subtotal: ${formatRupiah(receipt.subtotal)}`);
        lines.push(`Diskon: -${formatRupiah(receipt.discount)}`);
    }

    // Total
    lines.push(`*TOTAL: ${formatRupiah(receipt.total)}*`);
    lines.push(`Bayar: ${receipt.paymentMethod || 'Tunai'}`);

    if (receipt.note) {
        lines.push(`Catatan: ${receipt.note}`);
    }

    // Pesan Penutup / Sosmed
    const closing = (storeSettings.closingMessage || '').trim();
    if (closing) {
        lines.push(divider);
        lines.push(closing);
    }

    return lines.join('\n');
}

/**
 * Membuat tautan wa.me dengan teks struk yang ter-encode aman
 */
export function createWhatsAppShareUrl(receipt, storeSettings = {}, phoneInput = '') {
    const text = formatReceiptWhatsAppText(receipt, storeSettings);
    const encodedText = encodeURIComponent(text);
    const normalizedPhone = normalizeIndonesianPhone(phoneInput);

    if (normalizedPhone) {
        return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
    }

    // Jika nomor tidak diisi, buka wa.me/?text= agar pengguna memilih kontak di aplikasi WA
    return `https://wa.me/?text=${encodedText}`;
}
