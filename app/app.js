/**
 * app.js - Orchestrator Utama Aplikasi KertasStruk
 * Mengendalikan UI, alur kerja transaksi, navigasi tab, dan modal interaktif.
 */

import {
    getSettings,
    saveSettings,
    requestStoragePersistence,
    voidReceipt
} from './storage.js';

import {
    loadCatalog,
    addCatalogItem,
    updateCatalogItem,
    removeCatalogItem,
    filterCatalog,
    formatRupiah
} from './catalog.js';

import {
    createCart,
    formatReceiptDate
} from './receipt.js';

import {
    getTodaySummary,
    loadGroupedHistory,
    setupDayChangeListener
} from './report.js';

import {
    downloadBackupFile,
    readAndValidateBackupFile,
    runImport,
    checkBackupNeed,
    dismissBackupReminder
} from './backup.js';

import {
    createWhatsAppShareUrl
} from './whatsapp.js';

import {
    downloadReceiptPng,
    shareReceiptPng,
    printReceipt
} from './export.js';

// ============================================================================
// State Global Aplikasi
// ============================================================================
const cart = createCart();
let cachedSettings = {};
let cachedCatalog = [];
let activeViewingReceipt = null;

// ============================================================================
// Helper Sanitasi & DOM Safe Helpers
// ============================================================================
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

// ============================================================================
// Inisialisasi Service Worker & PWA
// ============================================================================
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('../sw.js', { scope: '../' })
                .catch(() => {
                    // Berjalan diam bila offline atau protokol lokal tanpa service worker
                });
        });
    }
}

// ============================================================================
// 1. Rekap Harian & Header
// ============================================================================
async function updateDailySummaryUI() {
    const summary = await getTodaySummary();
    const totalEl = document.getElementById('rekap-total');
    const countEl = document.getElementById('rekap-count');

    if (totalEl) {
        totalEl.textContent = formatRupiah(summary.totalAmount);
    }
    if (countEl) {
        countEl.textContent = `${summary.receiptCount} struk`;
    }
}

// ============================================================================
// 2. Navigasi Tab
// ============================================================================
function setupNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');
    const bottomBar = document.getElementById('bottom-bar-create');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabBtns.forEach(b => {
                const isActive = b === btn;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            panels.forEach(panel => {
                const isTarget = panel.id === `panel-${targetTab}`;
                panel.classList.toggle('active', isTarget);
            });

            // Bottom bar hanya menempel saat berada di tab "Buat Struk"
            if (bottomBar) {
                bottomBar.style.display = targetTab === 'create' ? 'block' : 'none';
            }

            // Refresh data saat berpindah tab
            if (targetTab === 'history') {
                renderHistoryTab();
            } else if (targetTab === 'catalog') {
                renderCatalogTab();
            } else if (targetTab === 'settings') {
                renderSettingsTab();
            }
        });
    });
}

// ============================================================================
// 3. Tab Buat Struk - Chip Katalog & Keranjang
// ============================================================================
async function renderQuickCatalogChips(filterKeyword = '') {
    const container = document.getElementById('quick-catalog-chips');
    const searchWrap = document.getElementById('quick-search-container');
    const countLabel = document.getElementById('quick-catalog-count');
    if (!container) return;

    cachedCatalog = await loadCatalog();
    const filtered = filterCatalog(cachedCatalog, filterKeyword);

    // Tampilkan search box hanya jika barang di katalog lebih dari 8
    if (searchWrap) {
        searchWrap.style.display = cachedCatalog.length > 8 ? 'block' : 'none';
    }

    if (countLabel) {
        countLabel.textContent = `${cachedCatalog.length} menu`;
    }

    container.innerHTML = '';

    if (cachedCatalog.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'rekap-count-note';
        empty.style.padding = '0.5rem 0';
        empty.textContent = 'Katalog masih kosong. Tambah barang pertamamu lewat tombol manual di bawah atau tab Katalog.';
        container.appendChild(empty);
        return;
    }

    if (filtered.length === 0) {
        const noMatch = document.createElement('p');
        noMatch.className = 'rekap-count-note';
        noMatch.style.padding = '0.5rem 0';
        noMatch.textContent = `Tidak ada barang yang cocok dengan "${escapeHtml(filterKeyword)}"`;
        container.appendChild(noMatch);
        return;
    }

    filtered.forEach(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip-btn';
        chip.setAttribute('aria-label', `Tambah ${item.name} ke struk seharga ${formatRupiah(item.price)}`);

        chip.innerHTML = `
            <span>+ ${escapeHtml(item.name)}</span>
            <span class="chip-price-badge">${formatRupiah(item.price)}</span>
        `;

        chip.addEventListener('click', () => {
            cart.addItem(item);
            renderCartUI();
        });

        container.appendChild(chip);
    });
}

function renderCartUI() {
    const listContainer = document.getElementById('cart-list-items');
    const bottomQty = document.getElementById('bottom-bar-qty');
    const bottomTotal = document.getElementById('bottom-bar-total');
    if (!listContainer) return;

    const items = cart.getItems();
    const calc = cart.calculate();

    listContainer.innerHTML = '';

    if (items.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'cart-empty-state';
        emptyLi.textContent = 'Belum ada barang dipilih. Ketuk barang di atas untuk menambahkan ke struk.';
        listContainer.appendChild(emptyLi);
    } else {
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'cart-item';

            const subtotalFormatted = formatRupiah(item.price * item.qty);

            li.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(item.name)}</div>
                    <div class="cart-item-unit-price">${formatRupiah(item.price)} x ${item.qty} = <strong>${subtotalFormatted}</strong></div>
                </div>
                <div class="cart-item-actions">
                    <div class="qty-control" role="group" aria-label="Jumlah pesanan">
                        <button type="button" class="btn-qty btn-qty-dec" aria-label="Kurangi 1 ${escapeHtml(item.name)}">−</button>
                        <span class="qty-display">${item.qty}</span>
                        <button type="button" class="btn-qty btn-qty-inc" aria-label="Tambah 1 ${escapeHtml(item.name)}">+</button>
                    </div>
                    <button type="button" class="btn-remove-item" aria-label="Hapus ${escapeHtml(item.name)} dari struk">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;

            // Event controls
            li.querySelector('.btn-qty-dec').addEventListener('click', () => {
                cart.decrementQty(item.id);
                renderCartUI();
            });

            li.querySelector('.btn-qty-inc').addEventListener('click', () => {
                cart.incrementQty(item.id);
                renderCartUI();
            });

            li.querySelector('.btn-remove-item').addEventListener('click', () => {
                cart.removeItem(item.id);
                renderCartUI();
            });

            listContainer.appendChild(li);
        });
    }

    if (bottomQty) bottomQty.textContent = calc.totalQty;
    if (bottomTotal) bottomTotal.textContent = formatRupiah(calc.total);
}

function setupCreateTabEvents() {
    // Search input cepat
    const quickSearchInput = document.getElementById('quick-search-input');
    if (quickSearchInput) {
        quickSearchInput.addEventListener('input', (e) => {
            renderQuickCatalogChips(e.target.value);
        });
    }

    // Toggle Item Manual Form
    const toggleBtn = document.getElementById('btn-toggle-manual');
    const manualForm = document.getElementById('manual-item-form');
    if (toggleBtn && manualForm) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = manualForm.style.display === 'none';
            manualForm.style.display = isHidden ? 'grid' : 'none';
            toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
            if (isHidden) {
                document.getElementById('manual-name-input').focus();
            }
        });

        manualForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('manual-name-input');
            const priceInput = document.getElementById('manual-price-input');

            try {
                cart.addManualItem(nameInput.value, priceInput.value);
                nameInput.value = '';
                priceInput.value = '';
                renderCartUI();
                showToast('Barang manual ditambahkan.');
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // Clear cart button
    const clearBtn = document.getElementById('btn-clear-cart');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (cart.getItems().length === 0) return;
            if (confirm('Kosongkan semua daftar belanjaan di struk ini?')) {
                cart.clear();
                document.getElementById('input-customer-name').value = '';
                document.getElementById('input-discount').value = '';
                document.getElementById('input-note').value = '';
                renderCartUI();
            }
        });
    }

    // Detail inputs
    const discInput = document.getElementById('input-discount');
    if (discInput) {
        discInput.addEventListener('input', (e) => {
            cart.setDiscount(e.target.value);
            renderCartUI();
        });
    }

    const custInput = document.getElementById('input-customer-name');
    if (custInput) {
        custInput.addEventListener('input', (e) => {
            cart.setCustomerName(e.target.value);
        });
    }

    const noteInput = document.getElementById('input-note');
    if (noteInput) {
        noteInput.addEventListener('input', (e) => {
            cart.setNote(e.target.value);
        });
    }

    const payRadios = document.querySelectorAll('input[name="payment-method"]');
    payRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                cart.setPaymentMethod(e.target.value);
            }
        });
    });

    // Tombol Simpan & Preview
    const btnSave = document.getElementById('btn-save-and-preview');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            try {
                if (cart.getItems().length === 0) {
                    alert('Keranjang masih kosong. Pilih minimal 1 barang jualan.');
                    return;
                }

                btnSave.disabled = true;
                const savedReceipt = await cart.finalize();

                // Perbarui rekap pemasukan harian segera
                await updateDailySummaryUI();

                // Kosongkan form transaksi untuk berikutnya
                cart.clear();
                if (discInput) discInput.value = '';
                if (custInput) custInput.value = '';
                if (noteInput) noteInput.value = '';
                renderCartUI();

                // Buka modal pratinjau struk untuk dikirim atau diunduh
                openReceiptModal(savedReceipt);
                showToast(`Struk ${savedReceipt.receiptNo} berhasil disimpan!`);

                // Cek apakah perlu mengingatkan cadangan
                checkAndTriggerBackupReminder();
            } catch (err) {
                alert('Gagal menyimpan struk: ' + err.message);
            } finally {
                btnSave.disabled = false;
            }
        });
    }
}

// ============================================================================
// 4. Tab Riwayat Struk
// ============================================================================
async function renderHistoryTab() {
    const container = document.getElementById('history-container');
    if (!container) return;

    container.innerHTML = '';
    const groups = await loadGroupedHistory();

    if (groups.length === 0) {
        container.innerHTML = `
            <div class="card-box" style="text-align: center; padding: 2rem 1rem; color: var(--color-ink-light);">
                <p>Belum ada riwayat struk penjualan.</p>
                <p style="font-size: 0.8125rem; margin-top: 0.5rem;">Struk yang kamu simpan akan tercatat di sini.</p>
            </div>
        `;
        return;
    }

    groups.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'history-date-group';

        const title = document.createElement('div');
        title.className = 'history-group-title';
        title.textContent = group.header;
        groupEl.appendChild(title);

        group.receipts.forEach(receipt => {
            const card = document.createElement('div');
            card.className = `history-card ${receipt.isVoid ? 'is-void' : ''}`;
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Lihat struk nomor ${receipt.receiptNo}`);

            const timeStr = formatReceiptDate(receipt.createdAt);
            const itemsSummary = receipt.items.map(i => `${i.qty}x ${i.name}`).join(', ');

            card.innerHTML = `
                <div class="history-card-header">
                    <span>
                        <strong>${escapeHtml(receipt.receiptNo)}</strong> · ${escapeHtml(timeStr)}
                        ${receipt.isVoid ? '<span class="badge-void">BATAL</span>' : ''}
                    </span>
                    <span>${escapeHtml(receipt.paymentMethod)}</span>
                </div>
                <div class="history-card-body">
                    <div class="history-card-items-preview">
                        ${receipt.customerName ? `<strong>${escapeHtml(receipt.customerName)}</strong>: ` : ''}
                        ${escapeHtml(itemsSummary)}
                    </div>
                    <div class="history-card-total">${formatRupiah(receipt.total)}</div>
                </div>
            `;

            const triggerOpen = () => openReceiptModal(receipt);
            card.addEventListener('click', triggerOpen);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerOpen();
                }
            });

            groupEl.appendChild(card);
        });

        container.appendChild(groupEl);
    });
}

// ============================================================================
// 5. Tab Katalog (CRUD)
// ============================================================================
async function renderCatalogTab(filterKeyword = '') {
    const container = document.getElementById('catalog-list-container');
    const searchWrap = document.getElementById('catalog-tab-search-wrap');
    if (!container) return;

    cachedCatalog = await loadCatalog();
    const filtered = filterCatalog(cachedCatalog, filterKeyword);

    if (searchWrap) {
        searchWrap.style.display = cachedCatalog.length > 8 ? 'block' : 'none';
    }

    container.innerHTML = '';

    if (cachedCatalog.length === 0) {
        container.innerHTML = `
            <div class="card-box" style="text-align: center; padding: 2rem 1rem;">
                <p>Katalog jualanmu masih kosong.</p>
                <p style="font-size: 0.8125rem; color: var(--color-ink-light); margin: 0.5rem 0 1rem;">
                    Daftarkan menu atau barang agar bisa dipilih dengan 1 ketukan saat ada pembeli.
                </p>
                <button type="button" class="btn btn-primary" id="btn-add-first-catalog">
                    + Tambah Barang Pertama
                </button>
            </div>
        `;
        const addFirstBtn = container.querySelector('#btn-add-first-catalog');
        if (addFirstBtn) {
            addFirstBtn.addEventListener('click', () => openCatalogEditorModal());
        }
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="card-box" style="text-align: center; padding: 1.5rem 1rem; color: var(--color-ink-light);">
                Tidak ada barang dengan kata kunci "${escapeHtml(filterKeyword)}".
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const row = document.createElement('div');
        row.className = 'catalog-item-row';

        row.innerHTML = `
            <div class="catalog-item-info">
                <div class="catalog-item-name">${escapeHtml(item.name)}</div>
                <div class="catalog-item-price">${formatRupiah(item.price)}</div>
            </div>
            <div class="catalog-actions">
                <button type="button" class="btn-icon btn-edit-catalog" aria-label="Ubah ${escapeHtml(item.name)}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </button>
                <button type="button" class="btn-icon btn-delete-catalog" style="color: var(--color-void);" aria-label="Hapus ${escapeHtml(item.name)}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;

        row.querySelector('.btn-edit-catalog').addEventListener('click', () => {
            openCatalogEditorModal(item);
        });

        row.querySelector('.btn-delete-catalog').addEventListener('click', async () => {
            if (confirm(`Yakin ingin menghapus "${item.name}" dari katalog?`)) {
                await removeCatalogItem(item.id);
                showToast(`Barang "${item.name}" dihapus.`);
                await renderCatalogTab();
                await renderQuickCatalogChips();
            }
        });

        container.appendChild(row);
    });
}

function openCatalogEditorModal(item = null) {
    const modal = document.getElementById('catalog-modal');
    const title = document.getElementById('modal-catalog-title');
    const idInput = document.getElementById('catalog-edit-id');
    const nameInput = document.getElementById('catalog-edit-name');
    const priceInput = document.getElementById('catalog-edit-price');

    if (!modal) return;

    if (item) {
        title.textContent = 'Ubah Barang Katalog';
        idInput.value = item.id;
        nameInput.value = item.name;
        priceInput.value = item.price;
    } else {
        title.textContent = 'Tambah Barang Baru';
        idInput.value = '';
        nameInput.value = '';
        priceInput.value = '';
    }

    modal.classList.add('open');
    nameInput.focus();
}

function closeCatalogEditorModal() {
    const modal = document.getElementById('catalog-modal');
    if (modal) modal.classList.remove('open');
}

function setupCatalogTabEvents() {
    const openAddBtn = document.getElementById('btn-open-add-catalog');
    if (openAddBtn) {
        openAddBtn.addEventListener('click', () => openCatalogEditorModal());
    }

    const closeBtn = document.getElementById('btn-close-catalog-modal');
    const cancelBtn = document.getElementById('btn-cancel-catalog-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeCatalogEditorModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeCatalogEditorModal);

    const form = document.getElementById('catalog-editor-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('catalog-edit-id').value;
            const name = document.getElementById('catalog-edit-name').value;
            const price = document.getElementById('catalog-edit-price').value;

            try {
                if (id) {
                    await updateCatalogItem(id, name, price);
                    showToast('Barang berhasil diperbarui.');
                } else {
                    await addCatalogItem(name, price);
                    showToast('Barang baru ditambahkan ke katalog.');
                }
                closeCatalogEditorModal();
                await renderCatalogTab();
                await renderQuickCatalogChips();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderCatalogTab(e.target.value);
        });
    }
}

// ============================================================================
// 6. Tab Pengaturan & Cadangan Data
// ============================================================================
function compressLogoImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(new Error('Format berkas harus berupa gambar (PNG, JPG, atau WebP).'));
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 240;
                let w = img.width;
                let h = img.height;

                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const dataUrl = canvas.toDataURL('image/png', 0.9);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error('Gagal memproses gambar logo.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas logo.'));
        reader.readAsDataURL(file);
    });
}

async function renderSettingsTab() {
    cachedSettings = await getSettings();
    const nameInput = document.getElementById('setting-store-name');
    const addrInput = document.getElementById('setting-store-address');
    const phoneInput = document.getElementById('setting-store-phone');
    const closingInput = document.getElementById('setting-closing-message');
    const backupLabel = document.getElementById('backup-status-label');

    const previewBox = document.getElementById('setting-logo-preview-box');
    const previewImg = document.getElementById('setting-logo-preview-img');
    const logoInputHidden = document.getElementById('setting-logo-base64');
    const logoModeGroup = document.getElementById('logo-display-mode-group');

    if (nameInput) nameInput.value = cachedSettings.storeName || '';
    if (addrInput) addrInput.value = cachedSettings.address || '';
    if (phoneInput) phoneInput.value = cachedSettings.phone || '';
    if (closingInput) closingInput.value = cachedSettings.closingMessage || '';

    if (cachedSettings.logo) {
        if (previewBox) previewBox.style.display = 'flex';
        if (previewImg) previewImg.src = cachedSettings.logo;
        if (logoInputHidden) logoInputHidden.value = cachedSettings.logo;
        if (logoModeGroup) logoModeGroup.style.display = 'block';
    } else {
        if (previewBox) previewBox.style.display = 'none';
        if (previewImg) previewImg.src = '';
        if (logoInputHidden) logoInputHidden.value = '';
        if (logoModeGroup) logoModeGroup.style.display = 'none';
    }

    const selectedMode = cachedSettings.logoMode || 'header';
    const modeRadio = document.querySelector(`input[name="logo-mode"][value="${selectedMode}"]`);
    if (modeRadio) modeRadio.checked = true;

    const backupInfo = await checkBackupNeed();
    if (backupLabel) {
        if (backupInfo.lastBackupAt) {
            backupLabel.textContent = `Terakhir dicadangkan: ${formatReceiptDate(backupInfo.lastBackupAt)}`;
        } else {
            backupLabel.textContent = 'Terakhir dicadangkan: Belum pernah';
        }
    }
}

function setupSettingsTabEvents() {
    // Unggah dan Hapus Logo
    const logoFileInput = document.getElementById('input-logo-file');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const base64 = await compressLogoImage(file);
                const previewBox = document.getElementById('setting-logo-preview-box');
                const previewImg = document.getElementById('setting-logo-preview-img');
                const logoInputHidden = document.getElementById('setting-logo-base64');
                const logoModeGroup = document.getElementById('logo-display-mode-group');

                if (previewBox) previewBox.style.display = 'flex';
                if (previewImg) previewImg.src = base64;
                if (logoInputHidden) logoInputHidden.value = base64;
                if (logoModeGroup) logoModeGroup.style.display = 'block';
                showToast('Logo berhasil dimuat. Jangan lupa klik Simpan Pengaturan.');
            } catch (err) {
                alert(err.message);
            } finally {
                logoFileInput.value = '';
            }
        });
    }

    const removeLogoBtn = document.getElementById('btn-remove-logo');
    if (removeLogoBtn) {
        removeLogoBtn.addEventListener('click', () => {
            const previewBox = document.getElementById('setting-logo-preview-box');
            const previewImg = document.getElementById('setting-logo-preview-img');
            const logoInputHidden = document.getElementById('setting-logo-base64');
            const logoModeGroup = document.getElementById('logo-display-mode-group');

            if (previewBox) previewBox.style.display = 'none';
            if (previewImg) previewImg.src = '';
            if (logoInputHidden) logoInputHidden.value = '';
            if (logoModeGroup) logoModeGroup.style.display = 'none';
            showToast('Logo dihapus. Klik Simpan Pengaturan untuk menerapkan.');
        });
    }

    const form = document.getElementById('settings-store-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const storeName = document.getElementById('setting-store-name').value;
            const address = document.getElementById('setting-store-address').value;
            const phone = document.getElementById('setting-store-phone').value;
            const closingMessage = document.getElementById('setting-closing-message').value;
            const logo = document.getElementById('setting-logo-base64').value || null;
            const logoMode = document.querySelector('input[name="logo-mode"]:checked')?.value || 'header';

            try {
                cachedSettings = await saveSettings({
                    storeName,
                    address,
                    phone,
                    closingMessage,
                    logo,
                    logoMode
                });
                showToast('Profil & logo toko berhasil disimpan!');
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // Ekspor Cadangan JSON
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                await downloadBackupFile();
                showToast('Cadangan berhasil diunduh ke file JSON.');
                renderSettingsTab();
            } catch (err) {
                alert('Gagal mengekspor: ' + err.message);
            }
        });
    }

    // Impor Cadangan JSON
    const importInput = document.getElementById('input-import-file');
    if (importInput) {
        importInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const validation = await readAndValidateBackupFile(file);
                const confirmMsg = 
                    `Ringkasan file cadangan:\n` +
                    `- Nama Toko: ${validation.summary.storeName}\n` +
                    `- Jumlah Barang Katalog: ${validation.summary.catalogCount}\n` +
                    `- Jumlah Riwayat Struk: ${validation.summary.receiptsCount}\n\n` +
                    `Perhatian: Memulihkan cadangan akan menimpa seluruh data yang ada saat ini di HP. Lanjutkan?`;

                if (confirm(confirmMsg)) {
                    await runImport(validation.payload);
                    showToast('Data berhasil dipulihkan!');
                    importInput.value = '';
                    await initializeApp();
                }
            } catch (err) {
                alert('Gagal memulihkan cadangan: ' + err.message);
                importInput.value = '';
            }
        });
    }

    // Persist Storage
    const persistBtn = document.getElementById('btn-persist-storage');
    if (persistBtn) {
        persistBtn.addEventListener('click', async () => {
            const ok = await requestStoragePersistence();
            if (ok) {
                alert('Penyimpanan browser berhasil dikunci permanen. Browser tidak akan menghapus data jualanmu secara otomatis saat memori minim.');
            } else {
                alert('Browser tidak mendukung atau belum mengizinkan penguncian otomatis. Disarankan untuk rutin mengunduh cadangan JSON.');
            }
        });
    }
}

// ============================================================================
// 7. Modal Pratinjau Struk (WYSIWYG & Aksi)
// ============================================================================
function openReceiptModal(receipt) {
    activeViewingReceipt = receipt;
    const modal = document.getElementById('receipt-modal');
    const container = document.getElementById('rendered-receipt-paper');
    const waInput = document.getElementById('input-wa-target');
    const voidBox = document.getElementById('modal-void-container');
    const shareBtn = document.getElementById('btn-modal-share-png');

    if (!modal || !container) return;

    if (waInput) {
        waInput.value = '';
    }

    // Cek ketersediaan navigator.canShare untuk tombol Bagikan Foto
    if (shareBtn) {
        shareBtn.style.display = (navigator.canShare && typeof navigator.share === 'function') ? 'inline-flex' : 'none';
    }

    // Render Tampilan Fisik Kertas Termal WYSIWYG
    const storeName = (cachedSettings.storeName || 'KertasStruk').toUpperCase();
    const dateStr = formatReceiptDate(receipt.createdAt);
    const logoMode = cachedSettings.logoMode || 'header';

    let html = '';

    // Watermark samar di latar belakang struk
    if (cachedSettings.logo && (logoMode === 'watermark' || logoMode === 'both')) {
        html += `<img src="${cachedSettings.logo}" class="receipt-watermark-overlay" alt="" aria-hidden="true">`;
    }

    // Logo di atas nama toko
    if (cachedSettings.logo && (logoMode === 'header' || logoMode === 'both')) {
        html += `<div class="receipt-logo-header-wrap"><img src="${cachedSettings.logo}" class="receipt-logo-header" alt="Logo ${escapeHtml(storeName)}"></div>`;
    }

    html += `
        <div class="receipt-store-title">${escapeHtml(storeName)}</div>
    `;

    if (cachedSettings.address) {
        html += `<div class="receipt-meta-center">${escapeHtml(cachedSettings.address)}</div>`;
    }
    if (cachedSettings.phone) {
        html += `<div class="receipt-meta-center">WA: ${escapeHtml(cachedSettings.phone)}</div>`;
    }

    html += `
        <div class="receipt-meta-center">${escapeHtml(receipt.receiptNo)} · ${escapeHtml(dateStr)}</div>
    `;

    if (receipt.customerName) {
        html += `<div class="receipt-meta-center" style="font-weight:700;">Pelanggan: ${escapeHtml(receipt.customerName)}</div>`;
    }

    if (receipt.isVoid) {
        html += `<div class="receipt-meta-center" style="margin-top:0.5rem;"><span class="badge-void" style="font-size:0.875rem;">STRUK DIBATALKAN (VOID)</span></div>`;
    }

    html += `<div class="receipt-divider"></div>`;

    // Baris Belanjaan
    receipt.items.forEach(item => {
        const lineTotal = formatRupiah(item.price * item.qty);
        html += `
            <div class="receipt-row">
                <span style="max-width: 65%; word-break: break-word;">${item.qty}x ${escapeHtml(item.name)}</span>
                <span style="font-weight:700;">${lineTotal}</span>
            </div>
        `;
    });

    html += `<div class="receipt-divider"></div>`;

    if (receipt.discount > 0) {
        html += `
            <div class="receipt-row" style="color: var(--color-ink-light);">
                <span>Subtotal</span>
                <span>${formatRupiah(receipt.subtotal)}</span>
            </div>
            <div class="receipt-row" style="color: var(--color-ink-light);">
                <span>Diskon</span>
                <span>-${formatRupiah(receipt.discount)}</span>
            </div>
        `;
    }

    html += `
        <div class="receipt-row-bold">
            <span>TOTAL</span>
            <span>${formatRupiah(receipt.total)}</span>
        </div>
        <div class="receipt-row" style="margin-top: 0.5rem; color: var(--color-ink-light);">
            <span>Bayar: ${escapeHtml(receipt.paymentMethod || 'Tunai')}</span>
        </div>
    `;

    if (receipt.note) {
        html += `
            <div class="receipt-row" style="color: var(--color-ink-light);">
                <span>Catatan: ${escapeHtml(receipt.note)}</span>
            </div>
        `;
    }

    if (cachedSettings.closingMessage) {
        html += `
            <div class="receipt-divider"></div>
            <div class="receipt-closing-text">${escapeHtml(cachedSettings.closingMessage)}</div>
        `;
    }

    container.innerHTML = html;

    // Tombol Void: Hanya muncul jika struk belum dibatalkan
    if (voidBox) {
        voidBox.classList.toggle('is-void', Boolean(receipt.isVoid));
        voidBox.style.removeProperty('display');
    }

    modal.classList.add('open');
}

function closeReceiptModal() {
    const modal = document.getElementById('receipt-modal');
    if (modal) modal.classList.remove('open');
    activeViewingReceipt = null;
}

function setupReceiptModalEvents() {
    const closeBtn = document.getElementById('btn-close-receipt-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeReceiptModal);

    // Kirim via WhatsApp
    const sendWaBtn = document.getElementById('btn-modal-send-wa');
    if (sendWaBtn) {
        sendWaBtn.addEventListener('click', () => {
            if (!activeViewingReceipt) return;
            const phoneInput = document.getElementById('input-wa-target');
            const rawPhone = phoneInput ? phoneInput.value : '';

            try {
                const url = createWhatsAppShareUrl(activeViewingReceipt, cachedSettings, rawPhone);
                window.open(url, '_blank');
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // Unduh Foto PNG (Canvas 2D)
    const downloadPngBtn = document.getElementById('btn-modal-download-png');
    if (downloadPngBtn) {
        downloadPngBtn.addEventListener('click', async () => {
            if (!activeViewingReceipt) return;
            try {
                downloadPngBtn.disabled = true;
                await downloadReceiptPng(activeViewingReceipt, cachedSettings);
                showToast('Foto struk berhasil diunduh!');
            } catch (err) {
                alert('Gagal membuat gambar: ' + err.message);
            } finally {
                downloadPngBtn.disabled = false;
            }
        });
    }

    // Bagikan Foto PNG (Web Share API)
    const sharePngBtn = document.getElementById('btn-modal-share-png');
    if (sharePngBtn) {
        sharePngBtn.addEventListener('click', async () => {
            if (!activeViewingReceipt) return;
            try {
                sharePngBtn.disabled = true;
                await shareReceiptPng(activeViewingReceipt, cachedSettings);
            } catch (err) {
                alert('Gagal membagikan gambar: ' + err.message);
            } finally {
                sharePngBtn.disabled = false;
            }
        });
    }

    // Cetak / Simpan PDF
    const printPdfBtn = document.getElementById('btn-modal-print-pdf');
    if (printPdfBtn) {
        printPdfBtn.addEventListener('click', () => {
            printReceipt();
        });
    }

    // Batalkan Struk (Void)
    const voidBtn = document.getElementById('btn-modal-void-receipt');
    if (voidBtn) {
        voidBtn.addEventListener('click', async () => {
            if (!activeViewingReceipt) return;
            const confirmVoid = confirm(
                `Yakin ingin membatalkan struk ${activeViewingReceipt.receiptNo}?\n\n` +
                `Struk yang dibatalkan tidak akan dihitung ke pemasukan hari ini.`
            );

            if (confirmVoid) {
                try {
                    const voided = await voidReceipt(activeViewingReceipt.id);
                    activeViewingReceipt = voided;
                    showToast(`Struk ${voided.receiptNo} dibatalkan (void).`);
                    await updateDailySummaryUI();
                    await renderHistoryTab();
                    openReceiptModal(voided);
                } catch (err) {
                    alert(err.message);
                }
            }
        });
    }
}

// ============================================================================
// 8. Pengecekan Pengingat Cadangan Data
// ============================================================================
async function checkAndTriggerBackupReminder() {
    const need = await checkBackupNeed();
    if (need.shouldPrompt) {
        setTimeout(async () => {
            const doBackup = confirm(need.reason + '\n\nApakah kamu mau mengunduh file cadangan sekarang?');
            if (doBackup) {
                await downloadBackupFile();
                showToast('Cadangan berhasil diunduh.');
            } else {
                await dismissBackupReminder();
            }
        }, 800);
    }
}

// ============================================================================
// Inisialisasi Aplikasi Saat DOM Siap
// ============================================================================
async function initializeApp() {
    initServiceWorker();
    cachedSettings = await getSettings();

    setupNavigation();
    setupCreateTabEvents();
    setupCatalogTabEvents();
    setupSettingsTabEvents();
    setupReceiptModalEvents();

    await updateDailySummaryUI();
    await renderQuickCatalogChips();
    renderCartUI();

    // Deteksi pergantian hari lokal agar omzet reset saat lewat tengah malam
    setupDayChangeListener(async () => {
        await updateDailySummaryUI();
        await renderHistoryTab();
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);
