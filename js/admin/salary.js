// Admin Salary Management Logic

// Check authentication
const user = requireAuth('admin');
if (!user) {
    throw new Error('Unauthorized');
}

let selectedYear = null;
let selectedMonth = null;
let currentMonthTotal = 0;
let employeeCount = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupYearDropdown();
    setupMonthDropdown();
    setupEventListeners();
});

// Setup year dropdown
function setupYearDropdown() {
    const yearSelect = document.getElementById('yearSelect');
    const currentYear = getGSTParts(new Date()).year;
    
    // Add current year and previous 5 years
    for (let i = 0; i < 6; i++) {
        const year = currentYear - i;
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (i === 0) {
            option.selected = true;
            selectedYear = year;
        }
        yearSelect.appendChild(option);
    }
}

// Setup month dropdown
function setupMonthDropdown() {
    const monthSelect = document.getElementById('monthSelect');
    const currentMonth = getGSTParts(new Date()).month - 1;
    
    // Set current month as default
    monthSelect.value = currentMonth;
    selectedMonth = currentMonth;
    
    // Load data for current month
    loadSalaryData();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('yearSelect').addEventListener('change', (e) => {
        selectedYear = parseInt(e.target.value);
        if (selectedMonth !== null) {
            loadSalaryData();
        }
    });
    
    document.getElementById('monthSelect').addEventListener('change', (e) => {
        if (e.target.value === '') {
            selectedMonth = null;
            document.getElementById('summarySection').style.display = 'none';
            document.getElementById('noDataMessage').style.display = 'block';
        } else {
            selectedMonth = parseInt(e.target.value);
            loadSalaryData();
        }
    });
}

// Load salary data for selected month
async function loadSalaryData() {
    if (selectedYear === null || selectedMonth === null) {
        return;
    }
    
    try {
        // Show loading state
        document.getElementById('summarySection').style.display = 'block';
        document.getElementById('noDataMessage').style.display = 'none';
        document.getElementById('employeeTableBody').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                </td>
            </tr>
        `;
        
        const monthStart = getStartOfMonth(selectedYear, selectedMonth);
        const monthEnd = getEndOfMonth(selectedYear, selectedMonth);
        
        const startISO = monthStart.toISOString();
        const endISO = monthEnd.toISOString();
        
        console.log('Loading salary data for:', getMonthName(selectedMonth), selectedYear);
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
                console.error('Error fetching transactions:', error);
                throw error;
            }
            
            if (page && page.length) transactions.push(...page);
            if (!page || page.length < pageSize) break;
        }
        
        console.log('Transactions loaded:', transactions);
        
        // Calculate totals
        let totalSales = 0;
        let tipsTotal = 0;
        const employeeStats = {};
        
        transactions.forEach(transaction => {
            const subtotal = parseFloat(transaction.subtotal || 0);
            const tips = parseFloat(transaction.tips || 0);
            
            totalSales += subtotal;
            tipsTotal += tips;
            
            // Employee stats
            const employeeName = transaction.employees?.name || 'Unknown';
            const employeeId = transaction.employee_id || `unknown-${employeeName}`;
            
            if (!employeeStats[employeeId]) {
                employeeStats[employeeId] = {
                    name: employeeName,
                    totalSales: 0,
                    transactions: 0,
                    tips: 0
                };
            }
            
            employeeStats[employeeId].totalSales += subtotal;
            employeeStats[employeeId].transactions++;
            employeeStats[employeeId].tips += tips;
        });
        
        // All tips go to employees
        const employeeTipsTotal = tipsTotal;
        
        // Store values for business summary calculation
        currentMonthTotal = totalSales;
        employeeCount = Object.keys(employeeStats).length;
        
        // Update summary
        document.getElementById('monthTotal').textContent = formatCurrency(totalSales);
        document.getElementById('employeeTipsTotal').textContent = formatCurrency(employeeTipsTotal);
        document.getElementById('transactionCount').textContent = transactions.length;
        
        // Update business summary
        updateBusinessSummary();
        
        // Display employee table
        displayEmployeeTable(employeeStats);
        
    } catch (error) {
        console.error('Error loading salary data:', error);
        showToast('Error loading salary data: ' + error.message, 'error');
        document.getElementById('employeeTableBody').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">
                    Error loading data. Please try again.
                </td>
            </tr>
        `;
    }
}

// Display employee table
function displayEmployeeTable(employeeStats) {
    const tbody = document.getElementById('employeeTableBody');
    
    if (Object.keys(employeeStats).length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    No transactions found for this month.
                </td>
            </tr>
        `;
        return;
    }
    
    // Convert to array and sort by employee name
    const employees = Object.values(employeeStats).sort((a, b) => 
        a.name.localeCompare(b.name)
    );
    
    tbody.innerHTML = employees.map((employee, index) => {
        const employeeTips = employee.tips;
        const uniqueId = `percentage-${index}`;
        
        return `
            <tr>
                <td><strong>${employee.name}</strong></td>
                <td>${formatCurrency(employee.totalSales)}</td>
                <td>${employee.transactions}</td>
                <td>${formatCurrency(employeeTips)}</td>
                <td>
                    <input 
                        type="number" 
                        id="${uniqueId}"
                        class="form-control" 
                        style="width: 100px; text-align: center;"
                        min="0" 
                        max="100" 
                        placeholder="0.00"
                        data-employee-index="${index}"
                        data-total-sales="${employee.totalSales}"
                        onchange="calculatePercentage(${index}, ${employee.totalSales})"
                    />
                </td>
                <td>
                    <strong id="amount-${index}" class="amount-after-percentage">AED 0.00</strong>
                </td>
            </tr>
        `;
    }).join('');
}

// Calculate amount after percentage
function calculatePercentage(index, totalSales) {
    const percentageInput = document.getElementById(`percentage-${index}`);
    const amountDisplay = document.getElementById(`amount-${index}`);
    
    if (!percentageInput || !amountDisplay) {
        return;
    }
    
    const percentage = parseFloat(percentageInput.value) || 0;
    
    if (percentage < 0 || percentage > 100) {
        showToast('Percentage must be between 0 and 100', 'error');
        percentageInput.value = '';
        amountDisplay.textContent = formatCurrency(0);
        updateBusinessSummary();
        return;
    }
    
    // Calculate amount after percentage (from total sales excl. tips, not including tips)
    const amount = (totalSales * percentage) / 100;
    amountDisplay.textContent = formatCurrency(amount);
    
    // Update business summary
    updateBusinessSummary();
}

// Update business summary
function updateBusinessSummary() {
    // Calculate total paid to employees
    let totalPaid = 0;
    for (let i = 0; i < employeeCount; i++) {
        const amountDisplay = document.getElementById(`amount-${i}`);
        if (amountDisplay) {
            // Extract number from formatted currency string (e.g., "AED 88.00" -> 88.00)
            const amountText = amountDisplay.textContent.replace(/AED\s?/g, '').replace(/,/g, '').trim();
            const amount = parseFloat(amountText) || 0;
            totalPaid += amount;
        }
    }
    
    // Update business summary displays
    const businessTotalSalesEl = document.getElementById('businessTotalSales');
    const totalPaidToEmployeesEl = document.getElementById('totalPaidToEmployees');
    const totalRemainingBusinessEl = document.getElementById('totalRemainingBusiness');
    
    if (businessTotalSalesEl) businessTotalSalesEl.textContent = formatCurrency(currentMonthTotal);
    if (totalPaidToEmployeesEl) totalPaidToEmployeesEl.textContent = formatCurrency(totalPaid);
    
    // Calculate total remaining business
    // Total Remaining = Total Sales - Total Paid to Employees
    const totalRemaining = currentMonthTotal - totalPaid;
    if (totalRemainingBusinessEl) totalRemainingBusinessEl.textContent = formatCurrency(totalRemaining);
}

// Make function globally accessible
window.calculatePercentage = calculatePercentage;

