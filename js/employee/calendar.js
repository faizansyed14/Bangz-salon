// Employee / Manager calendar (stylists: own data only)

const user = requireAuth(['employee', 'manager']);
if (!user) {
    throw new Error('Unauthorized');
}


const isStylistOnly = user.role === 'employee';

if (isStylistOnly && !user.employee_id) {
    console.warn('Stylist account missing employee_id:', user.email);
}

let currentDate = getGSTNoon();
let selectedDate = null;
let transactionCounts = {};

function applyEmployeeScope(query) {
    if (!isStylistOnly) return query;
    if (!user.employee_id) return query.limit(0);
    return query.eq('employee_id', user.employee_id);
}

function buildStylistTransactionRows(transactions) {
    if (!transactions.length) {
        return '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions</td></tr>';
    }
    return transactions
        .map((transaction) => {
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
            const sub = parseFloat(transaction.subtotal || 0);
            return `
            <tr>
                <td>${formatTime(transaction.transaction_date)}</td>
                <td>${serviceNames}</td>
                <td><strong>${formatCurrency(sub)}</strong></td>
                <td>${paymentBadge}</td>
                <td>${tipsDisplay}</td>
                <td><strong>${formatCurrency(transaction.total)}</strong></td>
            </tr>`;
        })
        .join('');
}

function buildStylistDayDetailsHtml(transactions) {
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

    return `
        <div class="summary-grid" style="margin-bottom: 24px;">
            <div class="summary-card">
                <div class="summary-card-label">Your sales (excl. tips)</div>
                <div class="summary-card-value">${formatCurrency(totalSales)}</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-label">Your tips</div>
                <div class="summary-card-value">${formatCurrency(tipsTotal)}</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-label">Cash</div>
                <div class="summary-card-value">${formatCurrency(cashTotal)}</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-label">Card</div>
                <div class="summary-card-value">${formatCurrency(cardTotal)}</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-label">Customers</div>
                <div class="summary-card-value">${transactions.length}</div>
            </div>
        </div>
        <h3 style="margin-bottom: 16px;">Your sales by transaction</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Services</th>
                        <th>Service sales</th>
                        <th>Payment</th>
                        <th>Tips</th>
                        <th>Bill total</th>
                    </tr>
                </thead>
                <tbody>${buildStylistTransactionRows(transactions)}</tbody>
            </table>
        </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
    setupStaffNavForRole(user);
    loadTransactionCounts();
    renderCalendar();
});

async function loadTransactionCounts() {
    try {
        const gstCursor = getGSTParts(currentDate);
        const year = gstCursor.year;
        const monthIndex = gstCursor.month - 1;

        const monthStartGST = getStartOfMonth(year, monthIndex);
        const monthEndGST = getEndOfMonth(year, monthIndex);

        const startISO = monthStartGST.toISOString();
        const endISO = monthEndGST.toISOString();

        const pageSize = 1000;
        const transactions = [];
        for (let from = 0; ; from += pageSize) {
            let q = window.supabaseClient
                .from('transactions')
                .select('transaction_date')
                .gte('transaction_date', startISO)
                .lte('transaction_date', endISO)
                .range(from, from + pageSize - 1);
            q = applyEmployeeScope(q);
            const { data: page, error } = await q;
            if (error) {
                console.error('Error loading transaction counts:', error);
                throw error;
            }
            if (page && page.length) transactions.push(...page);
            if (!page || page.length < pageSize) break;
        }

        transactionCounts = {};
        if (transactions && transactions.length > 0) {
            transactions.forEach((transaction) => {
                const dateKey = gstDateKey(new Date(transaction.transaction_date));
                transactionCounts[dateKey] = (transactionCounts[dateKey] || 0) + 1;
            });
        }

        renderCalendar();
    } catch (error) {
        console.error('Error loading transaction counts:', error);
        showToast('Error loading calendar data', 'error');
    }
}

function renderCalendar() {
    const gstCursor = getGSTParts(currentDate);
    const year = gstCursor.year;
    const monthIndex = gstCursor.month - 1;

    const headerEl = document.getElementById('calendarMonthYear');
    if (headerEl) {
        headerEl.textContent = `${getMonthName(monthIndex)} ${year}${isStylistOnly ? ' (your activity)' : ''}`;
    }

    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach((day) => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });

    const firstDay = getFirstDayOfMonth(year, monthIndex);
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const todayGST = getGSTParts(new Date());
    const isCurrentMonth = todayGST.year === year && (todayGST.month - 1) === monthIndex;

    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendarGrid.appendChild(emptyDay);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';

        const dateKey = `${year}-${monthIndex}-${day}`;
        const isToday = isCurrentMonth && day === todayGST.day;
        const hasTransactions = transactionCounts[dateKey] > 0;

        if (isToday) {
            dayElement.classList.add('today');
        }

        dayElement.innerHTML = `
            <div class="calendar-day-number">${day}</div>
            ${hasTransactions ? '<div class="calendar-day-badge"></div>' : ''}
        `;

        dayElement.addEventListener('click', () => {
            const clickedDate = dateAtGST(year, monthIndex, day, 12, 0, 0, 0);
            document.querySelectorAll('.calendar-day.selected').forEach((d) => d.classList.remove('selected'));
            dayElement.classList.add('selected');
            selectDate(clickedDate);
        });

        calendarGrid.appendChild(dayElement);
    }
}

async function selectDate(date) {
    selectedDate = date;
    await loadDateDetails(date);
    document.getElementById('dateDetailsSection').style.display = 'block';
    document.getElementById('dateDetailsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadDateDetails(date) {
    try {
        const dayStartGST = getStartOfDay(date);
        const dayEndGST = getEndOfDay(date);

        const startISO = dayStartGST.toISOString();
        const endISO = dayEndGST.toISOString();

        const dateStr = formatDate(date);
        document.getElementById('dateDetailsTitle').textContent = `Date: ${dateStr}`;

        let q = window.supabaseClient
            .from('transactions')
            .select(
                `
                *,
                employees(name),
                transaction_items(service_name, price, quantity)
            `
            )
            .gte('transaction_date', startISO)
            .lte('transaction_date', endISO)
            .order('transaction_date', { ascending: false });

        q = applyEmployeeScope(q);

        const { data: transactions, error } = await q;

        if (error) {
            console.error('Employee calendar - Error fetching transactions:', error);
            throw error;
        }

        if (isStylistOnly) {
            document.getElementById('dateDetails').innerHTML = buildStylistDayDetailsHtml(transactions || []);
            return;
        }

        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        const employeeStats = {};

        transactions.forEach((transaction) => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);

            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }

            const employeeName = transaction.employees?.name || 'Unknown';
            if (!employeeStats[employeeName]) {
                employeeStats[employeeName] = {
                    transactions: 0,
                    cashTotal: 0,
                    cardTotal: 0,
                    tips: 0
                };
            }

            employeeStats[employeeName].transactions++;
            if (transaction.payment_method === 'cash') {
                employeeStats[employeeName].cashTotal += parseFloat(transaction.subtotal);
            } else {
                employeeStats[employeeName].cardTotal += parseFloat(transaction.subtotal);
            }
            employeeStats[employeeName].tips += parseFloat(transaction.tips || 0);
        });

        const detailsHTML = `
            <div class="summary-grid" style="margin-bottom: 24px;">
                <div class="summary-card">
                    <div class="summary-card-label">Total Sales (excl. tips)</div>
                    <div class="summary-card-value">${formatCurrency(totalSales)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Employee Tips</div>
                    <div class="summary-card-value">${formatCurrency(tipsTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Cash Total</div>
                    <div class="summary-card-value">${formatCurrency(cashTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Card Total</div>
                    <div class="summary-card-value">${formatCurrency(cardTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Transactions</div>
                    <div class="summary-card-value">${transactions.length}</div>
                </div>
            </div>

            <h3 style="margin-bottom: 16px;">Employee Performance</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Employee Name</th>
                            <th>Transactions</th>
                            <th>Cash Total</th>
                            <th>Card Total</th>
                            <th>Tips</th>
                            <th>Total Sales (excl. tips)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(employeeStats)
                            .map(([name, stats]) => {
                                const rowSales = stats.cashTotal + stats.cardTotal;
                                return `
                            <tr>
                                <td><strong>${name}</strong></td>
                                <td>${stats.transactions}</td>
                                <td>${formatCurrency(stats.cashTotal)}</td>
                                <td>${formatCurrency(stats.cardTotal)}</td>
                                <td>
                                    <div style="font-weight: 600;">${formatCurrency(stats.tips)}</div>
                                </td>
                                <td><strong>${formatCurrency(rowSales)}</strong></td>
                            </tr>
                        `;
                            })
                            .join('')}
                        ${
                            Object.keys(employeeStats).length === 0
                                ? '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions on this date</td></tr>'
                                : ''
                        }
                    </tbody>
                </table>
            </div>
        `;

        const expenseRowsDay = await fetchExpensesInRange(startISO, endISO);
        document.getElementById('dateDetails').innerHTML =
            detailsHTML + calendarExpensesSectionHtml(expenseRowsDay);
    } catch (error) {
        console.error('Error loading date details:', error);
        showToast('Error loading date details: ' + error.message, 'error');
    }
}

async function showMonthlyView() {
    if (!selectedDate) return;

    try {
        const gstSelected = getGSTParts(selectedDate);
        const year = gstSelected.year;
        const monthIndex = gstSelected.month - 1;

        const monthStartGST = getStartOfMonth(year, monthIndex);
        const monthEndGST = getEndOfMonth(year, monthIndex);

        const startISO = monthStartGST.toISOString();
        const endISO = monthEndGST.toISOString();

        const pageSize = 1000;
        const transactions = [];
        for (let from = 0; ; from += pageSize) {
            let q = window.supabaseClient
                .from('transactions')
                .select(
                    `
                *,
                employees(name),
                transaction_items(service_name, price, quantity)
            `
                )
                .gte('transaction_date', startISO)
                .lte('transaction_date', endISO)
                .order('transaction_date', { ascending: false })
                .range(from, from + pageSize - 1);
            q = applyEmployeeScope(q);
            const { data: page, error } = await q;
            if (error) throw error;
            if (page && page.length) transactions.push(...page);
            if (!page || page.length < pageSize) break;
        }

        document.getElementById('dateDetailsTitle').textContent = `Month: ${getMonthName(monthIndex)} ${year}`;

        if (isStylistOnly) {
            document.getElementById('dateDetails').innerHTML = buildStylistDayDetailsHtml(transactions || []);
            return;
        }

        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        const employeeStats = {};

        transactions.forEach((transaction) => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);

            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }

            const employeeName = transaction.employees?.name || 'Unknown';
            if (!employeeStats[employeeName]) {
                employeeStats[employeeName] = {
                    transactions: 0,
                    cashTotal: 0,
                    cardTotal: 0,
                    tips: 0
                };
            }

            employeeStats[employeeName].transactions++;
            if (transaction.payment_method === 'cash') {
                employeeStats[employeeName].cashTotal += parseFloat(transaction.subtotal);
            } else {
                employeeStats[employeeName].cardTotal += parseFloat(transaction.subtotal);
            }
            employeeStats[employeeName].tips += parseFloat(transaction.tips || 0);
        });

        const detailsHTML = `
            <div class="summary-grid" style="margin-bottom: 24px;">
                <div class="summary-card">
                    <div class="summary-card-label">Total Sales (excl. tips)</div>
                    <div class="summary-card-value">${formatCurrency(totalSales)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Employee Tips</div>
                    <div class="summary-card-value">${formatCurrency(tipsTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Cash Total</div>
                    <div class="summary-card-value">${formatCurrency(cashTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Card Total</div>
                    <div class="summary-card-value">${formatCurrency(cardTotal)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-label">Transactions</div>
                    <div class="summary-card-value">${transactions.length}</div>
                </div>
            </div>

            <h3 style="margin-bottom: 16px;">Employee Performance</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Employee Name</th>
                            <th>Transactions</th>
                            <th>Cash Total</th>
                            <th>Card Total</th>
                            <th>Tips</th>
                            <th>Total Sales (excl. tips)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(employeeStats)
                            .map(([name, stats]) => {
                                const rowSales = stats.cashTotal + stats.cardTotal;
                                return `
                            <tr>
                                <td><strong>${name}</strong></td>
                                <td>${stats.transactions}</td>
                                <td>${formatCurrency(stats.cashTotal)}</td>
                                <td>${formatCurrency(stats.cardTotal)}</td>
                                <td>
                                    <div style="font-weight: 600;">${formatCurrency(stats.tips)}</div>
                                </td>
                                <td><strong>${formatCurrency(rowSales)}</strong></td>
                            </tr>
                        `;
                            })
                            .join('')}
                        ${
                            Object.keys(employeeStats).length === 0
                                ? '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions this month</td></tr>'
                                : ''
                        }
                    </tbody>
                </table>
            </div>
        `;

        const expenseRowsMonth = await fetchExpensesInRange(startISO, endISO);
        document.getElementById('dateDetails').innerHTML =
            detailsHTML + calendarExpensesSectionHtml(expenseRowsMonth);
    } catch (error) {
        console.error('Error loading monthly view:', error);
        showToast('Error loading monthly view: ' + error.message, 'error');
    }
}

function previousMonth() {
    currentDate = shiftGSTMonth(currentDate, -1);
    loadTransactionCounts();
}

function nextMonth() {
    currentDate = shiftGSTMonth(currentDate, 1);
    loadTransactionCounts();
}

function goToToday() {
    currentDate = getGSTNoon();
    loadTransactionCounts();
}

function clearDateSelection() {
    document.getElementById('dateDetailsSection').style.display = 'none';
    selectedDate = null;
    document.querySelectorAll('.calendar-day.selected').forEach((day) => {
        day.classList.remove('selected');
    });
}
