// Admin Dashboard Logic

// Check authentication
const user = requireAuth('admin');
if (!user) {
    // Redirect handled by requireAuth
    throw new Error('Unauthorized');
}

let refreshInterval;

// Load monthly data
async function loadMonthlyData() {
    try {
        const gstNow = getGSTParts(new Date());
        const year = gstNow.year;
        const monthIndex = gstNow.month - 1;

        const monthStart = getStartOfMonth(year, monthIndex);
        const monthEnd = getEndOfMonth(year, monthIndex);
        
        const startISO = monthStart.toISOString();
        const endISO = monthEnd.toISOString();
        
        console.log('Loading monthly data for:', getMonthName(monthIndex), year);
        console.log('Month range (UTC):', startISO, 'to', endISO);
        
        // Fetch all transactions for the current month.
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
        
        // Calculate monthly totals and employee stats
        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        const employeeStats = {};
        
        transactions.forEach(transaction => {
            const subtotal = parseFloat(transaction.subtotal || 0);
            const tips = parseFloat(transaction.tips || 0);
            
            totalSales += subtotal;
            tipsTotal += tips;
            
            if (transaction.payment_method === 'cash') {
                cashTotal += subtotal;
            } else {
                cardTotal += subtotal;
            }
            
            // Employee stats
            const employeeName = transaction.employees?.name || 'Unknown';
            const employeeId = transaction.employee_id || `unknown-${employeeName}`;
            
            if (!employeeStats[employeeId]) {
                employeeStats[employeeId] = {
                    name: employeeName,
                    cashTotal: 0,
                    cardTotal: 0,
                    tips: 0,
                    totalSales: 0
                };
            }
            
            employeeStats[employeeId].totalSales += subtotal;
            employeeStats[employeeId].tips += tips;
            
            if (transaction.payment_method === 'cash') {
                employeeStats[employeeId].cashTotal += subtotal;
            } else {
                employeeStats[employeeId].cardTotal += subtotal;
            }
        });
        
        // All tips go to employees
        const employeeTips = tipsTotal;
        
        // Display employee monthly stats
        displayEmployeeMonthlyStats(employeeStats);
        
        // Update monthly summary cards
        document.getElementById('monthlyTotalSales').textContent = formatCurrency(totalSales);
        document.getElementById('monthlyCashTotal').textContent = formatCurrency(cashTotal);
        document.getElementById('monthlyCardTotal').textContent = formatCurrency(cardTotal);
        document.getElementById('monthlyTransactionCount').textContent = transactions.length;
        document.getElementById('monthlyEmployeeTips').textContent = formatCurrency(employeeTips);

        const monthlyExpensesTotal = await sumExpensesInRange(startISO, endISO);
        const monthlyExpensesEl = document.getElementById('monthlyExpensesTotal');
        if (monthlyExpensesEl) {
            monthlyExpensesEl.textContent = formatCurrency(monthlyExpensesTotal);
        }
        
        const monthlyNetProfitEl = document.getElementById('monthlyNetProfit');
        const monthlyFinalProfitEl = document.getElementById('monthlyFinalProfit');
        const monthlyFixedSalaryEl = document.getElementById('monthlyFixedSalary');
        const monthlyBagga40El = document.getElementById('monthlyBagga40');
        const monthlyWasif40El = document.getElementById('monthlyWasif40');
        if (monthlyNetProfitEl) {
            const netProfit = totalSales - (parseFloat(monthlyExpensesTotal) || 0);
            monthlyNetProfitEl.textContent = formatCurrency(netProfit);
            
            if (monthlyFinalProfitEl) {
                const fixedSalary = 4800;
                if (monthlyFixedSalaryEl) monthlyFixedSalaryEl.textContent = `Salary: ${formatCurrency(fixedSalary)}`;
                const norm = (s) => String(s || '').trim().toLowerCase();
                const baggaSales = Object.values(employeeStats).reduce((sum, s) => {
                    return sum + (norm(s.name) === 'bagga' ? (parseFloat(s.totalSales) || 0) : 0);
                }, 0);
                
                const wasifSales = Object.values(employeeStats).reduce((sum, s) => {
                    return sum + (norm(s.name) === 'wasif' ? (parseFloat(s.totalSales) || 0) : 0);
                }, 0);
                
                const baggaCut = 0.4 * baggaSales;
                const wasifCut = 0.4 * wasifSales;
                if (monthlyBagga40El) monthlyBagga40El.textContent = `Bagga 40%: ${formatCurrency(baggaCut)}`;
                if (monthlyWasif40El) monthlyWasif40El.textContent = `Wasif 40%: ${formatCurrency(wasifCut)}`;
                
                const finalProfit =
                    netProfit
                    - fixedSalary
                    - baggaCut
                    - wasifCut;
                
                monthlyFinalProfitEl.textContent = formatCurrency(finalProfit);
            }
        }

        // Update monthly last update time
        const now = new Date();
        const gstTime = formatTime(now);
        document.getElementById('monthlyLastUpdate').textContent = `Last updated: ${gstTime}`;
        
    } catch (error) {
        console.error('Error loading monthly data:', error);
        // Show empty state
        document.getElementById('monthlyEmployeeStats').innerHTML = '';
        document.getElementById('monthlyTotalSales').textContent = formatCurrency(0);
        document.getElementById('monthlyCashTotal').textContent = formatCurrency(0);
        document.getElementById('monthlyCardTotal').textContent = formatCurrency(0);
        document.getElementById('monthlyTransactionCount').textContent = '0';
        document.getElementById('monthlyEmployeeTips').textContent = formatCurrency(0);
        const monthlyExpensesEl = document.getElementById('monthlyExpensesTotal');
        if (monthlyExpensesEl) monthlyExpensesEl.textContent = formatCurrency(0);
        const monthlyNetProfitEl = document.getElementById('monthlyNetProfit');
        if (monthlyNetProfitEl) monthlyNetProfitEl.textContent = formatCurrency(0);
        const monthlyFinalProfitEl = document.getElementById('monthlyFinalProfit');
        if (monthlyFinalProfitEl) monthlyFinalProfitEl.textContent = formatCurrency(0);
        const monthlyFixedSalaryEl = document.getElementById('monthlyFixedSalary');
        if (monthlyFixedSalaryEl) monthlyFixedSalaryEl.textContent = '';
        const monthlyBagga40El = document.getElementById('monthlyBagga40');
        if (monthlyBagga40El) monthlyBagga40El.textContent = '';
        const monthlyWasif40El = document.getElementById('monthlyWasif40');
        if (monthlyWasif40El) monthlyWasif40El.textContent = '';
    }
}

// Display employee monthly stats
function displayEmployeeMonthlyStats(employeeStats) {
    const container = document.getElementById('monthlyEmployeeStats');
    
    if (Object.keys(employeeStats).length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No employee data for this month.</p>';
        return;
    }
    
    // Convert to array and sort by employee name
    const employees = Object.values(employeeStats).sort((a, b) => 
        a.name.localeCompare(b.name)
    );
    
    container.innerHTML = `
        <h3 style="margin-bottom: 16px; color: var(--text-primary);">Employee Monthly Performance</h3>
        <div class="summary-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            ${employees.map(employee => `
                <div style="border: 2px solid var(--border-color); border-radius: 12px; background: var(--card-bg); padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                    <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--border-color);">
                        <div style="font-weight: 700; font-size: 20px; color: var(--text-primary); text-align: center;">${employee.name}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <span style="color: var(--text-secondary); font-size: 14px; font-weight: 500;">Cash Total:</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${formatCurrency(employee.cashTotal)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <span style="color: var(--text-secondary); font-size: 14px; font-weight: 500;">Card Total:</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${formatCurrency(employee.cardTotal)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <span style="color: var(--text-secondary); font-size: 14px; font-weight: 500;">Tips:</span>
                            <span style="font-weight: 600; color: var(--success);">${formatCurrency(employee.tips)}</span>
                        </div>
                        <div style="margin-top: 8px; padding-top: 12px; border-top: 2px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-primary); font-weight: 600; font-size: 15px;">Total (excl. tips):</span>
                            <span style="font-weight: 700; font-size: 18px; color: var(--text-primary);">${formatCurrency(employee.totalSales)}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Load today's data
async function loadTodayData() {
    try {
        const today = new Date();
        const startOfDay = getStartOfDay(today);
        const endOfDay = getEndOfDay(today);
        
        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        
        console.log('Loading data for today:', today);
        console.log('GST date:', getGSTDate(today));
        console.log('Start of day (UTC):', startISO);
        console.log('End of day (UTC):', endISO);
        
        // Fetch transactions with related data
        // Use simpler date filtering that works with Supabase timestamps
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
        
        console.log('Transactions loaded:', transactions); // Debug log
        console.log('Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString()); // Debug log
        console.log('Today in GST:', getGSTDate(new Date())); // Debug log
        
        // Also fetch all recent transactions for debugging
        const { data: allRecent, error: allError } = await window.supabaseClient
            .from('transactions')
            .select('id, transaction_date, subtotal, total')
            .order('transaction_date', { ascending: false })
            .limit(10);
        
        if (!allError && allRecent) {
            console.log('Last 10 transactions in DB:', allRecent);
            allRecent.forEach(t => {
                const dbDate = new Date(t.transaction_date);
                const gstDate = getGSTParts(dbDate);
                const todayGST = getGSTParts(new Date());
                const isToday = gstDate.day === todayGST.day &&
                               gstDate.month === todayGST.month &&
                               gstDate.year === todayGST.year;
                console.log(`Transaction ${t.id}: DB date = ${t.transaction_date}, GST date = ${gstDate.year}-${gstDate.month}-${gstDate.day}, Is today = ${isToday}`);
            });
        }
        
        // Calculate totals
        let totalSales = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let tipsTotal = 0;
        
        transactions.forEach(transaction => {
            totalSales += parseFloat(transaction.subtotal);
            tipsTotal += parseFloat(transaction.tips || 0);
            
            if (transaction.payment_method === 'cash') {
                cashTotal += parseFloat(transaction.subtotal);
            } else {
                cardTotal += parseFloat(transaction.subtotal);
            }
        });
        
        // All tips go to employees
        const employeeTips = tipsTotal;
        
        // Update summary cards
        document.getElementById('totalSales').textContent = formatCurrency(totalSales);
        document.getElementById('cashTotal').textContent = formatCurrency(cashTotal);
        document.getElementById('cardTotal').textContent = formatCurrency(cardTotal);
        document.getElementById('transactionCount').textContent = transactions.length;
        document.getElementById('employeeTipsTotal').textContent = formatCurrency(employeeTips);
        
        // Calculate Top Employee (excluding tips)
        const employeeDailySales = {};
        transactions.forEach(tx => {
            const empName = tx.employees?.name;
            if (empName) {
                employeeDailySales[empName] = (employeeDailySales[empName] || 0) + parseFloat(tx.subtotal || 0);
            }
        });

        let topEmpName = null;
        let maxSales = 0;
        for (const [name, sales] of Object.entries(employeeDailySales)) {
            if (sales > maxSales) {
                maxSales = sales;
                topEmpName = name;
            }
        }

        const topEmpContainer = document.getElementById('topEmployeeContainer');
        const topEmpNameEl = document.getElementById('topEmployeeName');
        const rankingsEl = document.getElementById('employeeRankings');

        if (topEmpContainer && topEmpNameEl && rankingsEl) {
            const sortedRankings = Object.entries(employeeDailySales)
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

        // Update transactions table
        updateTransactionsTable(transactions || []);
        
        // Update Employee Targets (Admin View)
        await updateEmployeeTargets(transactions);
        
        // Update last refresh time (in GST)
        const now = new Date();
        const gstTime = formatTime(now);
        console.log('Last updated - Local time:', now.toLocaleTimeString(), 'GST time:', gstTime);
        document.getElementById('lastUpdate').textContent = `Last updated: ${gstTime}`;
        
    } catch (error) {
        console.error('Error loading today data:', error);
        showToast('Error loading data: ' + error.message, 'error');
        // Show empty state
        document.getElementById('totalSales').textContent = formatCurrency(0);
        document.getElementById('cashTotal').textContent = formatCurrency(0);
        document.getElementById('cardTotal').textContent = formatCurrency(0);
        document.getElementById('transactionCount').textContent = '0';
        document.getElementById('employeeTipsTotal').textContent = formatCurrency(0);
        updateTransactionsTable([]);
    }
}

// Update Employee Targets (Admin View)
async function updateEmployeeTargets(dayTransactions) {
    const listContainer = document.getElementById('employeeTargetList');
    const card = document.getElementById('employeeTargetProgressCard');
    if (!listContainer || !card) return;

    try {
        // 1. Fetch all employees to get their targets
        const { data: employees, error: empError } = await window.supabaseClient
            .from('employees')
            .select('id, name, per_person_target_aed')
            .order('name');

        if (empError) throw empError;
        if (!employees || employees.length === 0) {
            card.style.display = 'none';
            return;
        }

        // 2. Group transactions by employee
        const empProgress = {};
        employees.forEach(emp => {
            empProgress[emp.id] = {
                name: emp.name,
                targetPerPerson: parseFloat(emp.per_person_target_aed || 0),
                actualSubtotal: 0,
                customers: 0
            };
        });

        dayTransactions.forEach(tx => {
            if (tx.employee_id && empProgress[tx.employee_id]) {
                empProgress[tx.employee_id].actualSubtotal += parseFloat(tx.subtotal || 0);
                empProgress[tx.employee_id].customers += 1;
            }
        });

        // 3. Render each employee's progress
        let hasTargetsSet = false;
        const html = employees.map(emp => {
            const progress = empProgress[emp.id];
            const targetPerPerson = progress.targetPerPerson;
            if (targetPerPerson <= 0) return ''; // Skip employees with no target set
            hasTargetsSet = true;

            const targetRevenue = progress.customers * targetPerPerson;
            const pct = targetRevenue > 0 
                ? Math.min(100, Math.round((progress.actualSubtotal / targetRevenue) * 1000) / 10) 
                : 0;
            const reached = targetRevenue > 0 && progress.actualSubtotal + 0.005 >= targetRevenue;

            return `
                <div style="margin-bottom: 20px; padding: 10px; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                            <strong style="font-size: 16px; color: var(--text-primary);">${progress.name}</strong>
                            <span style="font-size: 13px; color: var(--text-secondary); margin-left: 10px;">
                                ${progress.customers} customers · Goal: ${formatCurrency(targetPerPerson)}/each
                            </span>
                        </div>
                        <div style="font-weight: 700; color: ${reached ? 'var(--success)' : (pct > 0 ? 'var(--warning)' : 'var(--text-secondary)')};">
                            ${pct}% ${reached ? '✓' : ''}
                        </div>
                    </div>
                    
                    <div class="target-progress-track" style="height: 12px; background: var(--background); border-radius: 6px; overflow: hidden; position: relative;">
                        <div class="target-progress-fill ${reached ? 'target-progress-fill--complete' : ''}" 
                             style="width: ${pct}%; height: 100%; transition: width 1s ease;"></div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; color: var(--text-secondary);">
                        <span>Sales: ${formatCurrency(progress.actualSubtotal)}</span>
                        <span>Target: ${formatCurrency(targetRevenue)}</span>
                    </div>
                </div>
            `;
        }).join('');

        if (hasTargetsSet) {
            listContainer.innerHTML = html;
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }

    } catch (error) {
        console.error('Error updating employee targets:', error);
        card.style.display = 'none';
    }
}

// Update transactions table
function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTable');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions today</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const employeeName = transaction.employees?.name || 'Unknown';
        const serviceNames = transaction.transaction_items
            ?.map(item => `${item.service_name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`)
            .join(', ') || 'N/A';
        const paymentBadge = transaction.payment_method === 'cash' 
            ? '<span class="badge badge-cash">Cash</span>'
            : '<span class="badge badge-card">Card</span>';
        const transactionTips = parseFloat(transaction.tips || 0);
        const tipsDisplay = transactionTips > 0 
            ? `<div style="color: var(--success); font-weight: 600;">${formatCurrency(transactionTips)}</div>`
            : '-';
        
        return `
            <tr>
                <td>${formatTime(transaction.transaction_date)}</td>
                <td>${serviceNames}</td>
                <td>${employeeName}</td>
                <td>${paymentBadge}</td>
                <td>${tipsDisplay}</td>
                <td><strong>${formatCurrency(transaction.total)}</strong></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="deleteTransaction('${transaction.id}')" style="background-color: #ef4444; color: white; border: none;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
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
        loadMonthlyData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction: ' + error.message, 'error');
    }
}

// Make deleteTransaction available globally
window.deleteTransaction = deleteTransaction;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadTodayData();
    loadMonthlyData();
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
        loadTodayData();
        loadMonthlyData();
    }, 30000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

