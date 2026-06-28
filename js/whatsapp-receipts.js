// WhatsApp Receipts page (manager-only sending)
// Lists today's transactions that have a linked customer, and lets a
// manager/admin send the text receipt on WhatsApp. Once sent, the button is
// permanently disabled (persisted via transactions.receipt_sent_at).
// Employees (stylists) see the list read-only and cannot send.

const user = requireAuth(['admin', 'manager', 'employee']);
if (!user) {
    throw new Error('Unauthorized');
}

// Only managers and admins are allowed to send receipts.
const canSend = user.role === 'manager' || user.role === 'admin';

let refreshInterval;
const receiptTransactionMap = {};

async function loadReceiptData() {
    try {
        const startOfDay = getStartOfDay(new Date());
        const endOfDay = getEndOfDay(new Date());

        const { data: transactions, error } = await window.supabaseClient
            .from('transactions')
            .select(`
                *,
                employees(name),
                transaction_items(service_name, price, quantity),
                customers(id, name, whatsapp_number)
            `)
            .gte('transaction_date', startOfDay.toISOString())
            .lte('transaction_date', endOfDay.toISOString())
            .order('transaction_date', { ascending: false });

        if (error) throw error;

        // Only transactions that actually have a customer + WhatsApp number
        // can have a receipt sent.
        const withCustomer = (transactions || []).filter(
            (t) => t.customers && t.customers.whatsapp_number
        );

        renderReceiptTable(withCustomer);

        const now = new Date();
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) lastUpdate.textContent = `Last updated: ${formatTime(now)}`;
    } catch (error) {
        console.error('Error loading WhatsApp receipts:', error);
        showToast('Error loading data: ' + error.message, 'error');
    }
}

function renderReceiptTable(transactions) {
    const tbody = document.getElementById('receiptsTable');
    if (!tbody) return;

    Object.keys(receiptTransactionMap).forEach((k) => delete receiptTransactionMap[k]);
    transactions.forEach((tx) => {
        receiptTransactionMap[tx.id] = tx;
    });

    if (transactions.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No customer receipts to send today</td></tr>';
        return;
    }

    tbody.innerHTML = transactions
        .map((transaction) => {
            const customer = transaction.customers;
            const serviceNames =
                transaction.transaction_items
                    ?.map((item) => `${item.service_name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`)
                    .join(', ') || 'N/A';

            const alreadySent = !!transaction.receipt_sent_at;

            let actionCell;
            if (alreadySent) {
                const sentTime = formatTime(transaction.receipt_sent_at);
                actionCell = `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.6; cursor:not-allowed;">Sent ✓ ${sentTime}</button>`;
            } else if (canSend) {
                actionCell = `<button id="sendBtn-${transaction.id}" class="btn btn-primary btn-sm" onclick="sendReceipt('${transaction.id}')" style="background:#25d366; border-color:#25d366;">📱 Send Receipt</button>`;
            } else {
                actionCell = `<span style="color: var(--text-secondary); font-size: 13px;">Pending (manager)</span>`;
            }

            return `
            <tr>
                <td>${formatTime(transaction.transaction_date)}</td>
                <td>${customer.name || '-'}</td>
                <td style="white-space:nowrap;">${customer.whatsapp_number || '-'}</td>
                <td>${serviceNames}</td>
                <td><strong>${formatCurrency(transaction.total)}</strong></td>
                <td>${actionCell}</td>
            </tr>`;
        })
        .join('');
}

async function sendReceipt(txId) {
    if (!canSend) {
        showToast('Only managers can send receipts.', 'error');
        return;
    }

    const tx = receiptTransactionMap[txId];
    if (!tx || !tx.customers?.whatsapp_number) {
        showToast('No customer WhatsApp number found for this transaction.', 'error');
        return;
    }

    const customer = tx.customers;
    const employeeName = tx.employees?.name || 'Staff';
    const receiptText = buildWhatsAppReceipt({
        customerName: customer.name,
        employeeName,
        transactionDate: tx.transaction_date,
        items: tx.transaction_items || [],
        subtotal: tx.subtotal,
        tips: tx.tips,
        total: tx.total,
        paymentMethod: tx.payment_method
    });

    // Open WhatsApp with the pre-filled text receipt.
    const url = `https://wa.me/${customer.whatsapp_number}?text=${encodeURIComponent(receiptText)}`;
    window.open(url, '_blank');

    // Mark as sent so the button is permanently disabled.
    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .update({ receipt_sent_at: new Date().toISOString() })
            .eq('id', txId);

        if (error) throw error;

        // Update local state + button immediately (no full reload needed).
        tx.receipt_sent_at = new Date().toISOString();
        const btn = document.getElementById(`sendBtn-${txId}`);
        if (btn) {
            btn.outerHTML = `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.6; cursor:not-allowed;">Sent ✓ ${formatTime(tx.receipt_sent_at)}</button>`;
        }
        showToast('Receipt opened in WhatsApp and marked as sent.', 'success');
    } catch (error) {
        console.error('Error marking receipt as sent:', error);
        showToast('Receipt opened, but could not save "sent" status: ' + error.message, 'error');
    }
}

window.sendReceipt = sendReceipt;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof setupStaffNavForRole === 'function') {
        setupStaffNavForRole(user);
    }

    // Tell employees (read-only) why they can't send.
    if (!canSend) {
        const note = document.getElementById('readOnlyNote');
        if (note) note.style.display = 'block';
    }

    loadReceiptData();
    refreshInterval = setInterval(loadReceiptData, 30000);
});

window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
});
