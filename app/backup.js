/**
 * backup.js - Manajemen Cadangan JSON (Ekspor & Impor)
 * Validasi ketat, pengingat halus, dan persistensi browser.
 */

import {
    exportAllData,
    validateImportPayload,
    importAllData,
    getMetadata,
    updateMetadata,
    requestStoragePersistence,
    listReceipts
} from './storage.js';

/**
 * Memicu pengunduhan file JSON cadangan ke perangkat pengguna
 */
export async function downloadBackupFile() {
    const jsonString = await exportAllData();
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `cadangan-kertasstruk-${yyyy}${mm}${dd}.json`;

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    return true;
}

/**
 * Membaca dan memvalidasi file cadangan yang diunggah
 */
export async function readAndValidateBackupFile(file) {
    if (!file) {
        throw new Error('Pilih file cadangan JSON terlebih dahulu.');
    }

    if (!file.name.endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
        throw new Error('Format file tidak didukung. Harap pilih file berformat .json.');
    }

    const text = await file.text();
    return validateImportPayload(text);
}

/**
 * Menjalankan impor setelah pengguna mengonfirmasi ringkasan data
 */
export async function runImport(validPayload) {
    return await importAllData(validPayload);
}

/**
 * Cek apakah perlu menampilkan pengingat cadangan
 * Aturan: jika ada >= 10 struk dan belum pernah cadangkan, atau sudah lama tidak dicadangkan
 */
export async function checkBackupNeed() {
    const metadata = await getMetadata();
    const receipts = await listReceipts(true);
    const totalReceipts = receipts.length;

    // Jika belum pernah cadangkan dan ada minimal 10 struk
    if (!metadata.lastBackupAt && totalReceipts >= 10 && metadata.promptDismissedForCount < totalReceipts) {
        return {
            shouldPrompt: true,
            reason: `Kamu sudah membuat ${totalReceipts} struk. Sebaiknya cadangkan data sekarang agar aman dari pembersihan browser.`
        };
    }

    return {
        shouldPrompt: false,
        lastBackupAt: metadata.lastBackupAt
    };
}

/**
 * Mengabaikan pengingat cadangan sementara sampai ada struk baru
 */
export async function dismissBackupReminder() {
    const receipts = await listReceipts(true);
    await updateMetadata({
        promptDismissedForCount: receipts.length + 10 // Ingatkan lagi setelah 10 struk berikutnya
    });
}

/**
 * Inisialisasi proteksi penyimpanan jangka panjang
 */
export async function initStorageProtection() {
    return await requestStoragePersistence();
}
