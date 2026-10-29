/**
 * storage.js - Local-first Storage Abstraction untuk KertasStruk
 * Menyediakan antarmuka async lengkap untuk localStorage dengan dukungan schema version,
 * UUID, timestamp ISO, soft-delete, dan penanganan kuota penyimpanan.
 */

const STORAGE_KEY = 'kertasstruk_db_v1';
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Data awal standar saat aplikasi pertama kali digunakan.
 */
function getDefaultData() {
    const now = new Date().toISOString();
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: {
            id: 'settings_default',
            storeName: 'Nama Toko Kamu',
            closingMessage: 'Terima kasih sudah berbelanja!\nHubungi kami jika ada kendala.',
            phone: '',
            address: '',
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        },
        catalog: [
            {
                id: crypto.randomUUID(),
                name: 'Kue Sus Cokelat',
                price: 15000,
                createdAt: now,
                updatedAt: now,
                deletedAt: null
            },
            {
                id: crypto.randomUUID(),
                name: 'Brownies Panggang',
                price: 45000,
                createdAt: now,
                updatedAt: now,
                deletedAt: null
            },
            {
                id: crypto.randomUUID(),
                name: 'Kopi Susu Gula Aren',
                price: 18000,
                createdAt: now,
                updatedAt: now,
                deletedAt: null
            }
        ],
        receipts: [],
        metadata: {
            lastBackupAt: null,
            promptDismissedForCount: 0
        }
    };
}

/**
 * Membaca raw data dari localStorage dan menjalankan migrasi skema bila diperlukan.
 */
function readDatabase() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            const initial = getDefaultData();
            writeDatabase(initial);
            return initial;
        }

        const data = JSON.parse(raw);
        return migrateSchema(data);
    } catch (err) {
        console.error('[storage] Gagal membaca storage, menggunakan fallback default', err);
        return getDefaultData();
    }
}

/**
 * Menulis data utuh ke localStorage dengan proteksi kuota.
 */
function writeDatabase(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (err) {
        if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
            throw new Error('Memori penyimpanan browser penuh. Harap cadangkan dan bersihkan data struk lama.');
        }
        throw new Error('Gagal menyimpan ke penyimpanan lokal: ' + (err.message || 'Error tidak diketahui'));
    }
}

/**
 * Fungsi migrasi skema untuk kompatibilitas ke depan.
 */
function migrateSchema(data) {
    if (!data || typeof data !== 'object') {
        return getDefaultData();
    }

    if (!data.schemaVersion || data.schemaVersion < CURRENT_SCHEMA_VERSION) {
        // Contoh placeholder migrasi di masa depan
        data.schemaVersion = CURRENT_SCHEMA_VERSION;
    }

    if (!Array.isArray(data.catalog)) data.catalog = [];
    if (!Array.isArray(data.receipts)) data.receipts = [];
    if (!data.settings) data.settings = getDefaultData().settings;
    if (!data.metadata) data.metadata = getDefaultData().metadata;

    return data;
}

// ============================================================================
// API Publik (Async untuk kesiapan migrasi Supabase di Tahap B)
// ============================================================================

export async function getSettings() {
    const db = readDatabase();
    return structuredClone(db.settings);
}

export async function saveSettings(patch) {
    const db = readDatabase();
    const now = new Date().toISOString();
    
    db.settings = {
        ...db.settings,
        ...patch,
        updatedAt: now
    };
    
    writeDatabase(db);
    return structuredClone(db.settings);
}

export async function getCatalog(includeDeleted = false) {
    const db = readDatabase();
    const list = includeDeleted 
        ? db.catalog 
        : db.catalog.filter(item => item.deletedAt === null);
    
    // Urutkan alfabetis berdasarkan nama
    return structuredClone(list.sort((a, b) => a.name.localeCompare(b.name, 'id')));
}

export async function saveCatalogItem({ id, name, price }) {
    const trimmedName = (name || '').trim();
    const parsedPrice = parseInt(price, 10);

    if (!trimmedName) {
        throw new Error('Nama barang tidak boleh kosong.');
    }
    if (isNaN(parsedPrice) || parsedPrice < 0) {
        throw new Error('Harga harus berupa nominal Rupiah bulat minimal 0.');
    }

    const db = readDatabase();
    const now = new Date().toISOString();

    // Cek duplikasi nama (abaikan item yang sedang diubah dan item yang sudah dihapus)
    const duplicate = db.catalog.find(item => 
        item.deletedAt === null &&
        item.name.toLowerCase() === trimmedName.toLowerCase() &&
        item.id !== id
    );

    if (duplicate) {
        throw new Error(`Barang dengan nama "${trimmedName}" sudah ada di katalog.`);
    }

    let savedItem;
    if (id) {
        // Update item
        const index = db.catalog.findIndex(i => i.id === id);
        if (index === -1) {
            throw new Error('Barang tidak ditemukan di katalog.');
        }
        db.catalog[index] = {
            ...db.catalog[index],
            name: trimmedName,
            price: parsedPrice,
            updatedAt: now
        };
        savedItem = db.catalog[index];
    } else {
        // Buat item baru
        savedItem = {
            id: crypto.randomUUID(),
            name: trimmedName,
            price: parsedPrice,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        };
        db.catalog.push(savedItem);
    }

    writeDatabase(db);
    return structuredClone(savedItem);
}

export async function deleteCatalogItem(id) {
    const db = readDatabase();
    const index = db.catalog.findIndex(i => i.id === id);
    if (index === -1) {
        throw new Error('Barang tidak ditemukan.');
    }

    // Soft delete
    db.catalog[index].deletedAt = new Date().toISOString();
    db.catalog[index].updatedAt = new Date().toISOString();

    writeDatabase(db);
    return true;
}

export async function listReceipts(includeVoid = true) {
    const db = readDatabase();
    let receipts = db.receipts.filter(r => r.deletedAt === null);
    if (!includeVoid) {
        receipts = receipts.filter(r => !r.isVoid);
    }
    
    // Urutkan dari yang terbaru (createdAt descending)
    return structuredClone(receipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}

export async function getReceiptById(id) {
    const db = readDatabase();
    const receipt = db.receipts.find(r => r.id === id && r.deletedAt === null);
    if (!receipt) return null;
    return structuredClone(receipt);
}

/**
 * Menghasilkan nomor struk unik berurutan per hari: STR-YYYYMMDD-001
 */
export async function generateNextReceiptNo(date = new Date()) {
    const db = readDatabase();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const prefix = `STR-${yyyy}${mm}${dd}-`;

    const todaysReceipts = db.receipts.filter(r => r.receiptNo && r.receiptNo.startsWith(prefix));
    let maxSequence = 0;

    todaysReceipts.forEach(r => {
        const seqStr = r.receiptNo.replace(prefix, '');
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSequence) {
            maxSequence = seqNum;
        }
    });

    const nextSeq = String(maxSequence + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
}

/**
 * Menyimpan struk baru ke dalam riwayat.
 * Menyimpan salinan beku nama, harga, diskon, dan kalkulasi total.
 */
export async function saveReceipt({
    items,
    discount = 0,
    paymentMethod = 'Tunai',
    customerName = '',
    note = '',
    date = new Date()
}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Struk harus berisi setidaknya 1 barang belanjaan.');
    }

    const receiptNo = await generateNextReceiptNo(date);
    const nowIso = date.toISOString();

    // Validasi dan bekukan items
    let calculatedSubtotal = 0;
    const frozenItems = items.map((item, index) => {
        const name = (item.name || '').trim();
        const price = Math.round(Number(item.price) || 0);
        const qty = Math.max(1, Math.round(Number(item.qty) || 1));
        const subtotal = price * qty;

        if (!name) {
            throw new Error(`Nama barang pada baris #${index + 1} tidak boleh kosong.`);
        }
        if (price < 0) {
            throw new Error(`Harga barang "${name}" tidak boleh negatif.`);
        }

        calculatedSubtotal += subtotal;

        return {
            id: item.id || crypto.randomUUID(),
            name,
            price,
            qty,
            subtotal
        };
    });

    const discountAmount = Math.max(0, Math.round(Number(discount) || 0));
    const grandTotal = Math.max(0, calculatedSubtotal - discountAmount);

    const newReceipt = {
        id: crypto.randomUUID(),
        receiptNo,
        items: frozenItems,
        subtotal: calculatedSubtotal,
        discount: discountAmount,
        total: grandTotal,
        paymentMethod: paymentMethod || 'Tunai',
        customerName: (customerName || '').trim(),
        note: (note || '').trim(),
        isVoid: false,
        voidedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null
    };

    const db = readDatabase();
    db.receipts.push(newReceipt);
    writeDatabase(db);

    return structuredClone(newReceipt);
}

/**
 * Membatalkan (void) struk penjualan.
 * Struk tidak dihapus, tetapi ditandai isVoid = true sehingga tidak dihitung dalam omzet.
 */
export async function voidReceipt(id) {
    const db = readDatabase();
    const index = db.receipts.findIndex(r => r.id === id && r.deletedAt === null);
    if (index === -1) {
        throw new Error('Struk tidak ditemukan.');
    }

    if (db.receipts[index].isVoid) {
        throw new Error('Struk ini sudah berstatus batal (void).');
    }

    const now = new Date().toISOString();
    db.receipts[index].isVoid = true;
    db.receipts[index].voidedAt = now;
    db.receipts[index].updatedAt = now;

    writeDatabase(db);
    return structuredClone(db.receipts[index]);
}

/**
 * Menghitung rekap pemasukan harian berdasarkan struk aktif (non-void) hari ini.
 * Dihitung langsung dari data transaksi untuk menghindari ketidaksinkronan angka.
 */
export async function getDailySummary(targetDate = new Date()) {
    const db = readDatabase();
    const targetY = targetDate.getFullYear();
    const targetM = targetDate.getMonth();
    const targetD = targetDate.getDate();

    let totalAmount = 0;
    let receiptCount = 0;
    let voidCount = 0;

    db.receipts.forEach(r => {
        if (r.deletedAt !== null) return;
        const rDate = new Date(r.createdAt);
        if (
            rDate.getFullYear() === targetY &&
            rDate.getMonth() === targetM &&
            rDate.getDate() === targetD
        ) {
            if (r.isVoid) {
                voidCount++;
            } else {
                totalAmount += r.total;
                receiptCount++;
            }
        }
    });

    return {
        date: targetDate,
        totalAmount,
        receiptCount,
        voidCount
    };
}

/**
 * Mengambil metadata penyimpanan (backup status, dll)
 */
export async function getMetadata() {
    const db = readDatabase();
    return structuredClone(db.metadata);
}

export async function updateMetadata(patch) {
    const db = readDatabase();
    db.metadata = {
        ...db.metadata,
        ...patch
    };
    writeDatabase(db);
    return structuredClone(db.metadata);
}

/**
 * Ekspor seluruh data lokal ke objek JSON berversi
 */
export async function exportAllData() {
    const db = readDatabase();
    const now = new Date().toISOString();

    // Catat waktu ekspor terakhir
    db.metadata.lastBackupAt = now;
    writeDatabase(db);

    const exportPayload = {
        app: 'KertasStruk',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: now,
        data: {
            settings: db.settings,
            catalog: db.catalog,
            receipts: db.receipts
        }
    };

    return JSON.stringify(exportPayload, null, 2);
}

/**
 * Validasi ketat file cadangan JSON sebelum impor
 */
export function validateImportPayload(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        throw new Error('Data cadangan kosong atau tidak valid.');
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch {
        throw new Error('Format file bukan JSON yang valid. Pastikan memilih file cadangan yang benar.');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Format cadangan rusak.');
    }

    if (!parsed.schemaVersion) {
        throw new Error('File cadangan tidak memiliki versi skema (schemaVersion).');
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
        throw new Error('Struktur file cadangan tidak memiliki bagian data transaksi.');
    }

    const { catalog, receipts, settings } = parsed.data;

    if (!Array.isArray(catalog)) {
        throw new Error('Data katalog di dalam cadangan tidak berbentuk daftar.');
    }
    if (!Array.isArray(receipts)) {
        throw new Error('Data riwayat struk di dalam cadangan tidak berbentuk daftar.');
    }
    if (!settings || typeof settings !== 'object') {
        throw new Error('Data profil toko tidak ditemukan di dalam cadangan.');
    }

    const activeCatalogCount = catalog.filter(i => !i.deletedAt).length;
    const activeReceiptsCount = receipts.filter(r => !r.deletedAt && !r.isVoid).length;
    const voidReceiptsCount = receipts.filter(r => !r.deletedAt && r.isVoid).length;

    return {
        isValid: true,
        summary: {
            catalogCount: activeCatalogCount,
            receiptsCount: activeReceiptsCount,
            voidReceiptsCount,
            storeName: settings.storeName || 'Tanpa Nama',
            exportedAt: parsed.exportedAt || 'Tidak diketahui'
        },
        payload: parsed.data
    };
}

/**
 * Menimpa data lokal dengan data cadangan yang sudah tervalidasi
 */
export async function importAllData(validPayload) {
    const now = new Date().toISOString();
    const newDb = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: {
            ...validPayload.settings,
            updatedAt: now
        },
        catalog: validPayload.catalog,
        receipts: validPayload.receipts,
        metadata: {
            lastBackupAt: now,
            promptDismissedForCount: 0
        }
    };

    writeDatabase(newDb);
    return true;
}

/**
 * Meminta browser agar data tidak dihapus otomatis saat memori penuh
 */
export async function requestStoragePersistence() {
    if (navigator.storage && navigator.storage.persist) {
        try {
            const isPersisted = await navigator.storage.persist();
            return isPersisted;
        } catch {
            return false;
        }
    }
    return false;
}
