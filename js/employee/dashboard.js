// Employee / Manager dashboard (stylists: own transactions only; managers: full salon)

const user = requireAuth(['employee', 'manager']);
if (!user) {
    throw new Error('Unauthorized');
}


const isStylistOnly = user.role === 'employee';

if (isStylistOnly && !user.employee_id) {
    console.warn('Stylist account missing employee_id:', user.email);
}

let refreshInterval;

function applyEmployeeScope(query) {
    if (!isStylistOnly) return query;
    if (!user.employee_id) return query.limit(0);
    return query.eq('employee_id', user.employee_id);
}

async function fetchPerPersonTargetAed() {
    if (!isStylistOnly || !user.employee_id) return 30;
    try {
        const { data, error } = await window.supabaseClient
            .from('employees')
            .select('per_person_target_aed')
            .eq('id', user.employee_id)
            .single();
        if (error) throw error;
        const v = parseFloat(data?.per_person_target_aed);
        return Number.isFinite(v) && v >= 0 ? v : 30;
    } catch (e) {
        console.warn('Using default target; could not load per_person_target_aed:', e);
        return 30;
    }
}

function updateStylistTargetUI(transactions, targetPerPerson) {
    const card = document.getElementById('stylistTargetCard');
    if (!card) return;

    if (!isStylistOnly) {
        card.style.display = 'none';
        return;
    }

    card.style.display = '';

    const people = transactions.length;
    const actualSubtotal = transactions.reduce((sum, t) => sum + parseFloat(t.subtotal || 0), 0);
    const targetRevenue = people * targetPerPerson;

    const metaEl = document.getElementById('stylistTargetMeta');
    const pctEl = document.getElementById('targetProgressPct');
    const statusEl = document.getElementById('targetProgressStatus');
    const detailEl = document.getElementById('stylistTargetDetail');
    const fillEl = document.getElementById('targetProgressFill');
    const trackEl = document.getElementById('targetProgressTrack');

    if (metaEl) {
        metaEl.textContent = `Goal: ${formatCurrency(targetPerPerson)} service sales per customer (subtotal, tips not counted).`;
    }

    let pct = 0;
    if (statusEl) {
        statusEl.classList.remove('target-progress-status--ok', 'target-progress-status--pending');
    }

    if (people === 0) {
        if (detailEl) {
            detailEl.textContent =
                'No customers yet today. Progress starts once you have transactions attributed to you.';
        }
        if (statusEl) statusEl.textContent = '';
        if (pctEl) pctEl.textContent = '0%';
    } else {
        pct = targetRevenue > 0 ? Math.min(100, Math.round((actualSubtotal / targetRevenue) * 1000) / 10) : 0;
        const reached = actualSubtotal + 0.005 >= targetRevenue;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (statusEl) {
            statusEl.textContent = reached ? 'Target reached' : 'Below target';
            statusEl.classList.toggle('target-progress-status--ok', reached);
            statusEl.classList.toggle('target-progress-status--pending', !reached);
        }
        if (detailEl) {
            detailEl.textContent = `${people} customer${people === 1 ? '' : 's'} today · Service sales ${formatCurrency(
                actualSubtotal
            )} · Goal ${formatCurrency(targetRevenue)} (${people} × ${formatCurrency(targetPerPerson)})`;
        }
    }

    if (fillEl) {
        fillEl.style.width = `${pct}%`;
        fillEl.classList.toggle('target-progress-fill--complete', people > 0 && pct >= 100);
    }
    if (trackEl) {
        trackEl.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
}

// Load today's data
async function loadTodayData() {
    try {
        const startOfDay = getStartOfDay(new Date());
        const endOfDay = getEndOfDay(new Date());

        const targetPerPerson = await fetchPerPersonTargetAed();

        // Fetch ALL transactions for today to determine the salon winner
        // (RLS currently allows this, and Top Employee is a shared achievement)
        let query = window.supabaseClient
            .from('transactions')
            .select(
                `
                *,
                employees(name),
                transaction_items(service_name, price, quantity)
            `
            )
            .gte('transaction_date', startOfDay.toISOString())
            .lte('transaction_date', endOfDay.toISOString())
            .order('transaction_date', { ascending: false });

        const { data: allTransactions, error } = await query;

        if (error) throw error;

        // Calculate Top Employee (excluding tips) from all salon transactions
        const salonDailySales = {};
        allTransactions.forEach(tx => {
            const empName = tx.employees?.name;
            if (empName) {
                salonDailySales[empName] = (salonDailySales[empName] || 0) + parseFloat(tx.subtotal || 0);
            }
        });

        let topEmpName = null;
        let maxSales = 0;
        for (const [name, sales] of Object.entries(salonDailySales)) {
            if (sales > maxSales) {
                maxSales = sales;
                topEmpName = name;
            }
        }

        const topEmpContainer = document.getElementById('topEmployeeContainer');
        const topEmpNameEl = document.getElementById('topEmployeeName');
        const rankingsEl = document.getElementById('employeeRankings');

        if (topEmpContainer && topEmpNameEl && rankingsEl) {
            const sortedRankings = Object.entries(salonDailySales)
                .sort(([, a], [, b]) => b - a);

            if (sortedRankings.length > 0) {
                const [[winnerName], ...others] = sortedRankings;
                
                // Show name directly without animation
                topEmpNameEl.textContent = winnerName;
                topEmpContainer.style.display = 'block';
                createCelebrationElements(topEmpContainer.querySelector('.top-employee-card'));

                // Update rankings for others
                if (others.length > 0) {
                    rankingsEl.innerHTML = others.map(([name], index) => `
                        <div class="ranking-item">
                            <span class="ranking-number">#${index + 2}</span>
                            <span class="ranking-name">${name}</span>
                        </div>
                    `).join('');
                    rankingsEl.style.display = 'flex';
                } else {
                    rankingsEl.style.display = 'none';
                }
            } else {
                topEmpContainer.style.display = 'none';
            }
        }

        // Filter transactions for personal dashboard views if stylist
        const transactions = isStylistOnly 
            ? allTransactions.filter(t => t.employee_id === user.employee_id)
            : allTransactions;

        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;

        transactions.forEach((transaction) => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);

            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }
        });

        const employeeTips = tipsTotal;

        document.getElementById('totalSales').textContent = formatCurrency(totalSales);
        document.getElementById('cashTotal').textContent = formatCurrency(cashTotal);
        document.getElementById('cardTotal').textContent = formatCurrency(cardTotal);
        document.getElementById('transactionCount').textContent = transactions.length;
        const tipsEl = document.getElementById('employeeTipsTotal') || document.getElementById('tipsTotal');
        if (tipsEl) tipsEl.textContent = formatCurrency(employeeTips);

        updateTransactionsTable(transactions);
        updateStylistTargetUI(transactions, targetPerPerson);

        const now = new Date();
        const gstTime = formatTime(now);
        document.getElementById('lastUpdate').textContent = `Last updated: ${gstTime}`;
    } catch (error) {
        console.error('Error loading today data:', error);
        showToast('Error loading data: ' + error.message, 'error');
    }
}

// Update transactions table
function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTable');
    const showEmployeeCol = !isStylistOnly;
    // Base cols: Time, Service, Payment, Tips, ExclVAT, VAT, Total = 7
    // +1 for Employee col (managers), +1 for Actions col (managers)
    const colCount = showEmployeeCol ? 9 : 7;

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions today</td></tr>`;
        return;
    }

    tbody.innerHTML = transactions
        .map((transaction) => {
            const employeeName = transaction.employees?.name || 'Unknown';
            const serviceNames =
                transaction.transaction_items
                    ?.map((item) => `${item.service_name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`)
                    .join(', ') || 'N/A';
            const paymentBadge =
                transaction.payment_method === 'cash'
                    ? '<span class="badge badge-cash">Cash</span>'
                    : '<span class="badge badge-card">Card</span>';
            const transactionTips = parseFloat(transaction.tips || 0);
            const tipsDisplay =
                transactionTips > 0
                    ? `<div style="color: var(--success); font-weight: 600;">${formatCurrency(transactionTips)}</div>`
                    : '-';
            const { subtotalExclVat, vatAmount } = computeVAT(transaction.subtotal);

            const employeeCell = showEmployeeCol ? `<td>${employeeName}</td>` : '';

            const actionsCell = !isStylistOnly ? `
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="deleteTransaction('${transaction.id}')" style="background-color: #ef4444; color: white; border: none;">Delete</button>
                </td>` : '';

            return `
            <tr>
                <td>${formatTime(transaction.transaction_date)}</td>
                <td>${serviceNames}</td>
                ${employeeCell}
                <td>${paymentBadge}</td>
                <td>${tipsDisplay}</td>
                <td style="color: var(--text-secondary); font-size: 13px;">${formatCurrency(subtotalExclVat)}</td>
                <td style="color: var(--text-secondary); font-size: 13px;">${formatCurrency(vatAmount)}</td>
                <td><strong>${formatCurrency(transaction.total)}</strong></td>
                ${actionsCell}
            </tr>
        `;
        })
        .join('');
}

// Delete transaction
async function deleteTransaction(transactionId) {
    if (!confirm('Are you sure you want to delete this transaction? This will also remove associated service items.')) {
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', transactionId);
            
        if (error) throw error;
        
        showToast('Transaction deleted successfully', 'success');
        
        // Refresh data
        loadTodayData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

// Make deleteTransaction available globally
window.deleteTransaction = deleteTransaction;

document.addEventListener('DOMContentLoaded', () => {
    setupStaffNavForRole(user);
    const title = document.querySelector('.card-title');
    if (title && title.textContent.includes("Today's Summary")) {
        title.textContent = isStylistOnly ? "Today's Summary (your sales)" : "Today's Summary";
    }

    const recentTitle = Array.from(document.querySelectorAll('.card-title')).find((t) =>
        t.textContent.includes('Recent Transactions')
    );
    if (recentTitle) {
        recentTitle.textContent = isStylistOnly ? 'Your transactions today' : 'Recent Transactions';
    }

    const txLabel = document.getElementById('summaryTransactionLabel');
    if (txLabel && isStylistOnly) {
        txLabel.textContent = 'Customers today';
    }

    if (isStylistOnly) {
        const actionsHeader = document.getElementById('actionsHeader');
        if (actionsHeader) actionsHeader.remove();
        
        const theadRow = document.querySelector('.table-container thead tr');
        if (theadRow) {
            const ths = theadRow.querySelectorAll('th');
            if (ths.length >= 6 && ths[2].textContent.includes('Employee')) {
                ths[2].remove();
            }
        }
    }

    if (!isStylistOnly) {
        const targetCard = document.getElementById('stylistTargetCard');
        if (targetCard) targetCard.style.display = 'none';
    }

    loadTodayData();
    refreshInterval = setInterval(loadTodayData, 30000);
});

window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
