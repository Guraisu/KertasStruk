/**
 * catalog.js - Manajemen Produk & Harga untuk KertasStruk
 * Menyediakan interaksi katalog, validasi input, pencarian, dan format harga.
 */

import { getCatalog, saveCatalogItem, deleteCatalogItem } from './storage.js';

export const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
});

/**
 * Format angka bulat Rupiah menjadi teks mata uang rapi
 * Contoh: 45000 -> "Rp 45.000"
 */
export function formatRupiah(amount) {
    const val = Math.round(Number(amount) || 0);
    return rupiahFormatter.format(val).replace(/\u00A0/g, ' ');
}

/**
 * Mengambil semua barang aktif di katalog
 */
export async function loadCatalog() {
    return await getCatalog(false);
}

/**
 * Menyaring barang katalog berdasarkan kata kunci pencarian
 */
export function filterCatalog(items, keyword = '') {
    if (!keyword || !keyword.trim()) return items;
    const q = keyword.toLowerCase().trim();
    return items.filter(item => item.name.toLowerCase().includes(q));
}

/**
 * Tambah barang baru ke katalog
 */
export async function addCatalogItem(name, price) {
    return await saveCatalogItem({ name, price });
}

/**
 * Perbarui barang yang sudah ada
 */
export async function updateCatalogItem(id, name, price) {
    return await saveCatalogItem({ id, name, price });
}

/**
 * Hapus barang dari katalog (soft-delete di storage)
 */
export async function removeCatalogItem(id) {
    return await deleteCatalogItem(id);
}
