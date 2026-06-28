// Expenses entry — admin or manager only (which page is determined by URL path)

const isAdminArea = window.location.pathname.includes('/admin/');
const user = isAdminArea ? requireAuth('admin') : requireAuth('manager');
if (!user) {
    throw new Error('Unauthorized');
}

function expenseCategoryLabel(category) {
    if (category === 'tea') return 'Tea';
    if (category === 'tea_cups') return 'Tea cups';
    if (category === 'other') return 'Other';
    return category || '—';
}

function toggleCustomNameField() {
    const type = document.getElementById('expenseType').value;
    const wrap = document.getElementById('expenseCustomWrap');
    const input = document.getElementById('expenseCustomName');
    if (!wrap) return;
    const show = type === 'other';
    wrap.style.display = show ? 'block' : 'none';
    if (input) {
        input.required = show;
        if (!show) input.value = '';
    }
}

document.getElementById('expenseType').addEventListener('change', toggleCustomNameField);

document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const category = document.getElementById('expenseType').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const customRaw = document.getElementById('expenseCustomName')?.value?.trim() || '';

    if (!category) {
        showToast('Please choose an expense type', 'error');
        return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    if (category === 'other' && !customRaw) {
        showToast('Please enter the expense name for “Other”', 'error');
        return;
    }

    const custom_name = category === 'other' ? customRaw : null;

    try {
        const expense_date = getCurrentGSTAsUTC();
        const { error } = await window.supabaseClient.from('expenses').insert([
            {
                category,
                custom_name,
                amount,
                expense_date
            }
        ]);

        if (error) throw error;

        showToast('Expense saved', 'success');
        document.getElementById('expenseForm').reset();
        toggleCustomNameField();
        loadRecentExpenses();
    } catch (err) {
        console.error(err);
        showToast('Could not save expense: ' + (err.message || 'Unknown error'), 'error');
    }
});

async function loadRecentExpenses() {
    const tbody = document.getElementById('recentExpensesBody');
    if (!tbody) return;

    tbody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-secondary);">Loading…</td></tr>';

    try {
        const since = new Date();
        since.setDate(since.getDate() - 60);
        const startISO = getStartOfDay(since).toISOString();

        const { data, error } = await window.supabaseClient
            .from('expenses')
            .select('*')
            .gte('expense_date', startISO)
            .order('expense_date', { ascending: false })
            .limit(80);

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-secondary);">No expenses yet</td></tr>';
            return;
        }

        tbody.innerHTML = data
            .map((row) => {
                const label =
                    row.category === 'other' && row.custom_name
                        ? escapeHtml(row.custom_name)
                        : expenseCategoryLabel(row.category);
                const when = formatDate(new Date(row.expense_date)) + ' ' + formatTime(new Date(row.expense_date));
                return `<tr>
          <td>${when}</td>
          <td>${label}</td>
          <td><strong>${formatCurrency(row.amount)}</strong></td>
        </tr>`;
            })
            .join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML =
            '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--error);">Could not load list</td></tr>';
    }
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!isAdminArea) setupStaffNavForRole(user);
    toggleCustomNameField();
    loadRecentExpenses();
});
