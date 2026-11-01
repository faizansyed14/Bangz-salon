// Admin Calendar Logic
// Updated: Fixed date filtering and removed duplicate declarations

// Check authentication
const user = requireAuth('admin');
if (!user) {
    throw new Error('Unauthorized');
}

let currentDate = getGSTNoon();
let selectedDate = null;
let transactionCounts = {};

// Initialize calendar
document.addEventListener('DOMContentLoaded', () => {
    loadTransactionCounts();
    renderCalendar();
});

// Load transaction counts for the current month
async function loadTransactionCounts() {
    try {
        const gstCursor = getGSTParts(currentDate);
        const year = gstCursor.year;
        const monthIndex = gstCursor.month - 1;

        const monthStartGST = getStartOfMonth(year, monthIndex);
        const monthEndGST = getEndOfMonth(year, monthIndex);
        
        const startISO = monthStartGST.toISOString();
        const endISO = monthEndGST.toISOString();
        
        console.log('Loading transactions for month:', getMonthName(monthIndex), year);
        console.log('Month range (UTC):', startISO, 'to', endISO);
        
        // Fetch ALL transactions for the month using pagination (Supabase limit is 1000)
        const pageSize = 1000;
        const allMonthTransactions = [];
        for (let from = 0; ; from += pageSize) {
            const { data: page, error } = await window.supabaseClient
                .from('transactions')
                .select('transaction_date')
                .gte('transaction_date', startISO)
                .lte('transaction_date', endISO)
                .range(from, from + pageSize - 1);
            
            if (error) throw error;
            if (page && page.length > 0) {
                allMonthTransactions.push(...page);
            }
            if (!page || page.length < pageSize) break;
        }
        
        console.log('Total transactions found for month:', allMonthTransactions.length);
        
        // Count transactions per day (using GST timezone)
        transactionCounts = {};
        allMonthTransactions.forEach(transaction => {
            // Convert UTC timestamp to GST date
            const dateKey = gstDateKey(new Date(transaction.transaction_date));
            transactionCounts[dateKey] = (transactionCounts[dateKey] || 0) + 1;
        });

        console.log('Populated transactionCounts keys:', Object.keys(transactionCounts).length);
        
        renderCalendar();
    } catch (error) {
        console.error('Error loading transaction counts:', error);
        showToast('Error loading calendar data', 'error');
    }
}

// Render calendar
function renderCalendar() {
    const gstCursor = getGSTParts(currentDate);
    const year = gstCursor.year;
    const monthIndex = gstCursor.month - 1;
    
    // Update month/year header
    document.getElementById('calendarMonthYear').textContent = `${getMonthName(monthIndex)} ${year}`;
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Get first day of month and days in month
    const firstDay = getFirstDayOfMonth(year, monthIndex);
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const todayGST = getGSTParts(new Date());
    const isCurrentMonth = todayGST.year === year && (todayGST.month - 1) === monthIndex;
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        // Create date key matching the format used in loadTransactionCounts
        // Note: monthIndex is 0-indexed in JavaScript
        const dateKey = `${year}-${monthIndex}-${day}`;
        const isToday = isCurrentMonth && day === todayGST.day;
        const hasTransactions = transactionCounts[dateKey] > 0;
        
        // Debug log for first few days
        if (day <= 3) {
            console.log(`Day ${day}: dateKey = ${dateKey}, hasTransactions = ${hasTransactions}, transactionCounts =`, transactionCounts);
        }
        
        if (isToday) {
            dayElement.classList.add('today');
        }
        
        dayElement.innerHTML = `
            <div class="calendar-day-number">${day}</div>
            ${hasTransactions ? '<div class="calendar-day-badge"></div>' : ''}
        `;
        
        dayElement.addEventListener('click', () => {
            const clickedDate = dateAtGST(year, monthIndex, day, 12, 0, 0, 0);
            // Remove selected class from all days
            document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
            // Add selected class to clicked day
            dayElement.classList.add('selected');
            selectDate(clickedDate);
        });
        
        calendarGrid.appendChild(dayElement);
    }
}

// Select date and show details
async function selectDate(date) {
    selectedDate = date;
    await loadDateDetails(date);
    document.getElementById('dateDetailsSection').style.display = 'block';
    // Scroll to details section
    document.getElementById('dateDetailsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Load date details
async function loadDateDetails(date) {
    try {
        const startOfDay = getStartOfDay(date);
        const endOfDay = getEndOfDay(date);
        
        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        
        // Update details title
        const dateStr = formatDate(date);
        document.getElementById('dateDetailsTitle').textContent = `Date: ${dateStr}`;
        
        console.log('Loading date details for:', dateStr);
        console.log('Date range (UTC):', startISO, 'to', endISO);
        
        // Fetch transactions for the day
        const { data: transactions, error } = await window.supabaseClient
            .from('transactions')
            .select(`
                *,
                employees(name),
                transaction_items(service_name, price, quantity)
            `)
            .gte('transaction_date', startISO)
            .lte('transaction_date', endISO)
            .order('transaction_date', { ascending: false });
        
        if (error) {
            console.error('Error fetching transactions:', error);
            throw error;
        }
        
        console.log('Date details transactions:', transactions); // Debug log
        
        // Calculate totals
        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        const employeeStats = {};
        
        transactions.forEach(transaction => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);
            
            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }
            
            // Employee stats
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
        
        // Display details
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

            <h3 style="margin-bottom: 16px;">Detailed Transactions</h3>
            <div class="table-container" style="margin-bottom: 24px; max-height: 420px; overflow: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Transaction ID</th>
                            <th>Employee Name</th>
                            <th>Payment Method</th>
                            <th>Services/Products</th>
                            <th>Subtotal</th>
                            <th>Tips</th>
                            <th>Total</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            transactions.map(transaction => {
                                const gstDate = getGSTDate(new Date(transaction.transaction_date));
                                const dateStr = formatDate(gstDate);
                                const timeStr = formatTime(gstDate);
                                const employeeName = transaction.employees?.name || 'Unknown';
                                const tips = parseFloat(transaction.tips || 0);
                                const items = transaction.transaction_items || [];
                                const paymentMethod = (transaction.payment_method || '').toUpperCase();
                                const servicesText = items.length
                                    ? items.map(item => {
                                        const qty = parseFloat(item.quantity || 1);
                                        const qtyLabel = qty > 1 ? ` (x${qty})` : '';
                                        return `${item.service_name || 'Item'}${qtyLabel}`;
                                    }).join('; ')
                                    : 'N/A';
                                const subtotalDisplay = formatCurrencyForCSV(transaction.subtotal);
                                const tipsDisplay = formatCurrencyForCSV(tips);
                                const totalDisplay = formatCurrencyForCSV(transaction.total);

                                return `
                                    <tr>
                                        <td>${dateStr}</td>
                                        <td>${timeStr}</td>
                                        <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${transaction.id}">${transaction.id}</td>
                                        <td><strong>${employeeName}</strong></td>
                                        <td>${paymentMethod || 'N/A'}</td>
                                        <td style="min-width: 280px; white-space: normal; word-break: break-word;">${servicesText}</td>
                                        <td>${subtotalDisplay}</td>
                                        <td>${tipsDisplay}</td>
                                        <td><strong>${totalDisplay}</strong></td>
                                        <td>
                                            <button
                                                class="btn btn-secondary btn-sm"
                                                onclick="deleteTransaction('${transaction.id}')"
                                                style="background-color: #ef4444; color: white; border: none;"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')
                            || '<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions on this date</td></tr>'
                        }
                    </tbody>
                </table>
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
                        ${Object.entries(employeeStats).map(([name, stats]) => {
                            const totalSales = stats.cashTotal + stats.cardTotal;
                            return `
                            <tr>
                                <td><strong>${name}</strong></td>
                                <td>${stats.transactions}</td>
                                <td>${formatCurrency(stats.cashTotal)}</td>
                                <td>${formatCurrency(stats.cardTotal)}</td>
                                <td>
                                    <div style="font-weight: 600;">${formatCurrency(stats.tips)}</div>
                                </td>
                                <td><strong>${formatCurrency(totalSales)}</strong></td>
                            </tr>
                        `;
                        }).join('')}
                        ${Object.keys(employeeStats).length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions on this date</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;

        const expenseRowsDay = await fetchExpensesInRange(startISO, endISO);
        document.getElementById('dateDetails').innerHTML =
            detailsHTML + calendarExpensesSectionHtml(expenseRowsDay);

        // Hide download button for daily view (only show for monthly view)
        document.getElementById('downloadMonthlyReportBtn').style.display = 'none';
    } catch (error) {
        console.error('Error loading date details:', error);
        showToast('Error loading date details: ' + error.message, 'error');
    }
}

// Delete transaction (calendar)
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
        
        // Refresh calendar + current selection
        await loadTransactionCounts();
        if (selectedDate) {
            await loadDateDetails(selectedDate);
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

window.deleteTransaction = deleteTransaction;

// Show monthly view
async function showMonthlyView() {
    if (!selectedDate) return;
    
    try {
        const gstSelected = getGSTParts(selectedDate);
        const year = gstSelected.year;
        const monthIndex = gstSelected.month - 1;

        const monthStart = getStartOfMonth(year, monthIndex);
        const monthEnd = getEndOfMonth(year, monthIndex);
        
        const startISO = monthStart.toISOString();
        const endISO = monthEnd.toISOString();
        
        console.log('Loading monthly view for:', getMonthName(monthIndex), year);
        console.log('Month range (UTC):', startISO, 'to', endISO);
        
        // Fetch all transactions for the month.
        // Supabase REST default max page size is 1000 rows; paginate to avoid silent truncation.
        const pageSize = 1000;
        const transactions = [];
        for (let from = 0; ; from += pageSize) {
            const { data: page, error } = await window.supabaseClient
                .from('transactions')
                .select(`
                    *,
                    employees(name)
                `)
                .gte('transaction_date', startISO)
                .lte('transaction_date', endISO)
                .order('transaction_date', { ascending: true })
                .range(from, from + pageSize - 1);
            
            if (error) {
                console.error('Error fetching monthly transactions:', error);
                throw error;
            }
            
            if (page && page.length) transactions.push(...page);
            if (!page || page.length < pageSize) break;
        }
        
        console.log('Monthly transactions:', transactions); // Debug log
        
        // Calculate totals
        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        const employeeStats = {};
        
        transactions.forEach(transaction => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);
            
            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }
            
            // Employee stats
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
        
        // Update details title
        document.getElementById('dateDetailsTitle').textContent = `Month: ${getMonthName(monthIndex)} ${year}`;
        
        // Display monthly details
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
                        ${Object.entries(employeeStats).map(([name, stats]) => {
                            const totalSales = stats.cashTotal + stats.cardTotal;
                            return `
                            <tr>
                                <td><strong>${name}</strong></td>
                                <td>${stats.transactions}</td>
                                <td>${formatCurrency(stats.cashTotal)}</td>
                                <td>${formatCurrency(stats.cardTotal)}</td>
                                <td>
                                    <div style="font-weight: 600;">${formatCurrency(stats.tips)}</div>
                                </td>
                                <td><strong>${formatCurrency(totalSales)}</strong></td>
                            </tr>
                        `;
                        }).join('')}
                        ${Object.keys(employeeStats).length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions this month</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;

        const expenseRowsMonth = await fetchExpensesInRange(startISO, endISO);
        const expensesMonthTotal = expenseRowsMonth.reduce(
            (s, r) => s + parseFloat(r.amount || 0),
            0
        );
        document.getElementById('dateDetails').innerHTML =
            detailsHTML + calendarExpensesSectionHtml(expenseRowsMonth);

        // Show download button for monthly view
        document.getElementById('downloadMonthlyReportBtn').style.display = 'inline-block';

        // Store monthly data for download
        window.monthlyReportData = {
            year: year,
            monthIndex: monthIndex,
            monthName: getMonthName(monthIndex),
            transactions: transactions,
            totalSales: totalSales,
            cashTotal: cashTotal,
            cardTotal: cardTotal,
            tipsTotal: tipsTotal,
            employeeTips: tipsTotal,
            employeeStats: employeeStats,
            transactionCount: transactions.length,
            expensesTotal: expensesMonthTotal
        };
    } catch (error) {
        console.error('Error loading monthly view:', error);
        showToast('Error loading monthly view: ' + error.message, 'error');
    }
}

// Navigation functions
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

// Clear date selection
function clearDateSelection() {
    document.getElementById('dateDetailsSection').style.display = 'none';
    document.getElementById('downloadMonthlyReportBtn').style.display = 'none';
    selectedDate = null;
    window.monthlyReportData = null;
    // Remove selected class from calendar days
    document.querySelectorAll('.calendar-day.selected').forEach(day => {
        day.classList.remove('selected');
    });
}

// Helper function to format currency for CSV (numbers only, no currency symbol)
function formatCurrencyForCSV(amount) {
    return parseFloat(amount || 0).toFixed(2);
}

// Download monthly sales report
async function downloadMonthlyReport() {
    if (!window.monthlyReportData) {
        showToast('No monthly data available. Please select Monthly View first.', 'error');
        return;
    }
    
    try {
        const data = window.monthlyReportData;
        
        // Fetch detailed transaction items for all transactions
        const transactionIds = data.transactions.map(t => t.id);
        
        let allTransactionItems = [];
        if (transactionIds.length > 0) {
            // Chunk .in() list to avoid URL too long -> 400 Bad Request.
            const chunkSize = 50;
            for (let i = 0; i < transactionIds.length; i += chunkSize) {
                const chunk = transactionIds.slice(i, i + chunkSize);
                const { data: items, error: itemsError } = await window.supabaseClient
                    .from('transaction_items')
                    .select('*')
                    .in('transaction_id', chunk);
                
                if (itemsError) throw itemsError;
                if (items && items.length) allTransactionItems.push(...items);
            }
        }
        
        // Create a map of transaction items by transaction ID
        const itemsByTransaction = {};
        allTransactionItems.forEach(item => {
            if (!itemsByTransaction[item.transaction_id]) {
                itemsByTransaction[item.transaction_id] = [];
            }
            itemsByTransaction[item.transaction_id].push(item);
        });
        
        // Generate CSV content
        let csvContent = '';
        
        // Header
        csvContent += 'BangzSalon - Monthly Sales Report\n';
        csvContent += `Month: ${data.monthName} ${data.year}\n`;
        const now = new Date();
        const gstNow = getGSTDate(now);
        csvContent += `Generated: ${formatDate(gstNow)} ${formatTime(gstNow)}\n`;
        csvContent += '\n';
        
        // Summary Section
        csvContent += 'SUMMARY\n';
        csvContent += '========\n';
        csvContent += `Total Sales (excl. tips),${formatCurrencyForCSV(data.totalSales)}\n`;
        csvContent += `Cash Total,${formatCurrencyForCSV(data.cashTotal)}\n`;
        csvContent += `Card Total,${formatCurrencyForCSV(data.cardTotal)}\n`;
        csvContent += `Employee Tips,${formatCurrencyForCSV(data.employeeTips)}\n`;
        csvContent += `Total Transactions,${data.transactionCount}\n`;
        csvContent += `Total Expenses,${formatCurrencyForCSV(data.expensesTotal || 0)}\n`;
        csvContent += '\n';
        
        // Employee Performance Section
        csvContent += 'EMPLOYEE PERFORMANCE\n';
        csvContent += '===================\n';
        csvContent += 'Employee Name,Transactions,Cash Total,Card Total,Employee Tips,Total Sales (excl. tips)\n';
        
        Object.entries(data.employeeStats).forEach(([name, stats]) => {
            const totalSales = stats.cashTotal + stats.cardTotal;
            csvContent += `"${name}",${stats.transactions},${formatCurrencyForCSV(stats.cashTotal)},${formatCurrencyForCSV(stats.cardTotal)},${formatCurrencyForCSV(stats.tips)},${formatCurrencyForCSV(totalSales)}\n`;
        });
        
        csvContent += '\n';
        
        // Detailed Transactions Section
        csvContent += 'DETAILED TRANSACTIONS\n';
        csvContent += '=====================\n';
        csvContent += 'Date,Time,Transaction ID,Employee Name,Payment Method,Services/Products,Subtotal,Tips,Total\n';
        
        // Sort transactions by date
        const sortedTransactions = [...data.transactions].sort((a, b) => {
            return new Date(a.transaction_date) - new Date(b.transaction_date);
        });
        
        sortedTransactions.forEach(transaction => {
            const gstDate = getGSTDate(new Date(transaction.transaction_date));
            const dateStr = formatDate(gstDate);
            const timeStr = formatTime(gstDate);
            const employeeName = transaction.employees?.name || 'Unknown';
            const paymentMethod = transaction.payment_method.toUpperCase();
            
            // Get transaction items
            const items = itemsByTransaction[transaction.id] || [];
            const servicesList = items.map(item => 
                `${item.service_name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`
            ).join('; ') || 'N/A';
            
            csvContent += `"${dateStr}","${timeStr}","${transaction.id}","${employeeName}","${paymentMethod}","${servicesList}",${formatCurrencyForCSV(transaction.subtotal)},${formatCurrencyForCSV(transaction.tips || 0)},${formatCurrencyForCSV(transaction.total)}\n`;
        });
        
        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `Monthly_Sales_Report_${data.monthName}_${data.year}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Monthly sales report downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error generating monthly report:', error);
        showToast('Error generating report: ' + error.message, 'error');
    }
}

