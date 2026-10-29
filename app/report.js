/**
 * report.js - Rekap Pemasukan Harian & Pengelompokan Riwayat Struk
 * Menghitung omzet harian secara deterministik dari riwayat struk aktif.
 */

import { getDailySummary, listReceipts } from './storage.js';

/**
 * Format tanggal untuk heading pengelompokan riwayat
 * Menghasilkan: "Hari Ini, 28 Okt 2026", "Kemarin, 27 Okt 2026", atau "26 Okt 2026"
 */
export function formatHistoryGroupHeader(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const dateFormatted = dateObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    if (dateKey === todayKey) {
        return `Hari Ini · ${dateFormatted}`;
    } else if (dateKey === yesterdayKey) {
        return `Kemarin · ${dateFormatted}`;
    } else {
        return dateFormatted;
    }
}

/**
 * Mengelompokkan riwayat struk berdasarkan tanggal kalender lokal perangkat
 */
export function groupReceiptsByDate(receipts) {
    const groups = {}; // { 'YYYY-MM-DD': [receipt, ...] }

    receipts.forEach(receipt => {
        const d = new Date(receipt.createdAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;

        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(receipt);
    });

    // Mengubah objek menjadi array yang diurutkan dari tanggal paling baru
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedKeys.map(dateKey => ({
        dateKey,
        header: formatHistoryGroupHeader(dateKey),
        receipts: groups[dateKey]
    }));
}

/**
 * Mengambil ringkasan hari ini
 */
export async function getTodaySummary() {
    return await getDailySummary(new Date());
}

/**
 * Memuat riwayat dan mengelompokkannya
 */
export async function loadGroupedHistory() {
    const all = await listReceipts(true);
    return groupReceiptsByDate(all);
}

/**
 * Menyiapkan listener pergantian tengah malam
 * Memanggil callback ketika tanggal lokal perangkat berganti hari
 */
export function setupDayChangeListener(onDayChange) {
    let lastDateString = new Date().toDateString();

    const checkDate = () => {
        const currentDateString = new Date().toDateString();
        if (currentDateString !== lastDateString) {
            lastDateString = currentDateString;
            if (typeof onDayChange === 'function') {
                onDayChange();
            }
        }
    };

    // Cek setiap 30 detik
    const timer = setInterval(checkDate, 30000);

    // Cek juga saat tab browser dibuka kembali
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkDate();
        }
    });

    window.addEventListener('focus', checkDate);

    return () => {
        clearInterval(timer);
    };
}
