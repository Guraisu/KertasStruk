/**
 * receipt.js - Manajemen Transaksi & Keranjang Struk
 * Menghitung subtotal, diskon, grand total, dan validasi item keranjang.
 */

import { saveReceipt } from './storage.js';

export function createCart() {
    let items = []; // { id, name, price, qty, isManual }
    let discount = 0;
    let paymentMethod = 'Tunai';
    let customerName = '';
    let note = '';

    return {
        getItems() {
            return [...items];
        },
        addItem(catalogItem) {
            const existing = items.find(i => !i.isManual && i.id === catalogItem.id);
            if (existing) {
                existing.qty += 1;
            } else {
                items.push({
                    id: catalogItem.id,
                    name: catalogItem.name,
                    price: Math.round(Number(catalogItem.price) || 0),
                    qty: 1,
                    isManual: false
                });
            }
        },
        addManualItem(name, price) {
            const trimmed = (name || '').trim();
            const parsedPrice = parseInt(price, 10);
            if (!trimmed) {
                throw new Error('Nama item manual tidak boleh kosong.');
            }
            if (isNaN(parsedPrice) || parsedPrice < 0) {
                throw new Error('Harga item manual minimal Rp 0.');
            }

            items.push({
                id: 'manual_' + crypto.randomUUID(),
                name: trimmed,
                price: parsedPrice,
                qty: 1,
                isManual: true
            });
        },
        updateQty(id, newQty) {
            const target = items.find(i => i.id === id);
            if (!target) return;
            const parsed = parseInt(newQty, 10);
            if (isNaN(parsed) || parsed <= 0) {
                this.removeItem(id);
            } else {
                target.qty = parsed;
            }
        },
        incrementQty(id) {
            const target = items.find(i => i.id === id);
            if (target) {
                target.qty += 1;
            }
        },
        decrementQty(id) {
            const target = items.find(i => i.id === id);
            if (target) {
                if (target.qty > 1) {
                    target.qty -= 1;
                } else {
                    this.removeItem(id);
                }
            }
        },
        removeItem(id) {
            items = items.filter(i => i.id !== id);
        },
        setDiscount(val) {
            const parsed = parseInt(val, 10);
            discount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
        },
        getDiscount() {
            return discount;
        },
        setPaymentMethod(method) {
            paymentMethod = method || 'Tunai';
        },
        getPaymentMethod() {
            return paymentMethod;
        },
        setCustomerName(name) {
            customerName = (name || '').trim();
        },
        getCustomerName() {
            return customerName;
        },
        setNote(text) {
            note = (text || '').trim();
        },
        getNote() {
            return note;
        },
        calculate() {
            let subtotal = 0;
            let totalQty = 0;
            items.forEach(i => {
                subtotal += (i.price * i.qty);
                totalQty += i.qty;
            });

            // Diskon tidak boleh melebihi subtotal
            const effectiveDiscount = Math.min(discount, subtotal);
            const total = Math.max(0, subtotal - effectiveDiscount);

            return {
                subtotal,
                discount: effectiveDiscount,
                rawDiscount: discount,
                total,
                totalQty,
                itemCount: items.length
            };
        },
        clear() {
            items = [];
            discount = 0;
            paymentMethod = 'Tunai';
            customerName = '';
            note = '';
        },
        async finalize() {
            const calc = this.calculate();
            if (items.length === 0) {
                throw new Error('Belum ada barang di dalam struk.');
            }

            const receiptData = {
                items: items.map(i => ({
                    id: i.id,
                    name: i.name,
                    price: i.price,
                    qty: i.qty
                })),
                discount: calc.discount,
                paymentMethod,
                customerName,
                note,
                date: new Date()
            };

            const saved = await saveReceipt(receiptData);
            return saved;
        }
    };
}

/**
 * Format tanggal dan waktu untuk tampilan struk
 * Contoh: "28 Okt 2026, 14:05"
 */
export function formatReceiptDate(dateStringOrObj) {
    const d = typeof dateStringOrObj === 'string' ? new Date(dateStringOrObj) : dateStringOrObj;
    if (!(d instanceof Date) || isNaN(d)) return '';

    return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(/\./g, ':');
}
