// Admin Employees Management Logic

// Check authentication
const user = requireAuth('admin');
if (!user) {
    throw new Error('Unauthorized');
}

function linkedUserRecord(employee) {
    const u = employee.users;
    if (!u) return null;
    return Array.isArray(u) ? u[0] : u;
}

function roleDisplayLabel(role) {
    if (role === 'manager') return 'Manager';
    if (role === 'employee') return 'Stylist';
    return role || '—';
}

// Load employees list
async function loadEmployees() {
    try {
        const { data: employees, error } = await window.supabaseClient
            .from('employees')
            .select('*, users(id, email, role)')
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayEmployees(employees);
    } catch (error) {
        console.error('Error loading employees:', error);
        showToast('Error loading employees: ' + error.message, 'error');
        document.getElementById('employeesList').innerHTML = '<p style="text-align: center; color: var(--error);">Error loading employees</p>';
    }
}

// Display employees
function displayEmployees(employees) {
    const container = document.getElementById('employeesList');

    if (employees.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No employees found</p>';
        return;
    }

    container.innerHTML = employees.map((employee) => {
        const isActive = employee.is_active !== false;
        const statusBadge = isActive
            ? '<span class="employee-status-badge employee-status-active">Active</span>'
            : '<span class="employee-status-badge employee-status-inactive">Inactive</span>';
        const actionButton = isActive
            ? `<button class="btn btn-danger btn-sm" onclick="deactivateEmployee('${employee.id}')">Deactivate</button>`
            : `<button class="btn btn-success btn-sm" onclick="activateEmployee('${employee.id}')">Activate</button>`;

        const usr = linkedUserRecord(employee);
        const loginLine = usr
            ? `<div class="employee-phone">${escapeHtml(usr.email)} · ${roleDisplayLabel(usr.role)}</div>`
            : '<div class="employee-phone" style="color: var(--text-secondary);">No login linked</div>';
        const targetAed = Number(employee.per_person_target_aed ?? 30).toFixed(2);
        const targetLine = `<div class="employee-phone" style="color: var(--text-secondary);">Sales target: ${targetAed} AED / customer</div>`;

        return `
        <div class="employee-card ${!isActive ? 'employee-card-inactive' : ''}">
            <div class="employee-card-header">
                <div>
                    <div class="employee-name">
                        ${escapeHtml(employee.name)}
                        ${statusBadge}
                    </div>
                    <div class="employee-phone">${escapeHtml(employee.phone)}</div>
                    ${targetLine}
                    ${loginLine}
                </div>
            </div>
            <div class="employee-actions">
                <button class="btn btn-primary btn-sm" onclick="openEditModal('${employee.id}')">Edit</button>
                ${actionButton}
            </div>
        </div>
    `;
    }).join('');
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create employee + login user
document.getElementById('employeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('employeeName').value.trim();
    const phone = document.getElementById('employeePhone').value.trim();
    const email = document.getElementById('employeeEmail').value.trim().toLowerCase();
    const password = document.getElementById('employeePassword').value;
    const role = document.getElementById('employeeRole').value;
    const perPersonRaw = document.getElementById('employeePerPersonTarget').value;
    const perPersonTarget = parseFloat(perPersonRaw);
    const perPersonTargetAed = Number.isFinite(perPersonTarget) && perPersonTarget >= 0 ? perPersonTarget : 30;

    if (!name) {
        showToast('Employee name is required', 'error');
        return;
    }

    if (!isValidPhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }

    if (!email) {
        showToast('Email is required', 'error');
        return;
    }

    if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    if (role !== 'manager' && role !== 'employee') {
        showToast('Please select a valid role', 'error');
        return;
    }

    try {
        const { data: empRow, error: empError } = await window.supabaseClient
            .from('employees')
            .insert([{ name, phone, per_person_target_aed: perPersonTargetAed }])
            .select()
            .single();

        if (empError) throw empError;

        const { error: userError } = await window.supabaseClient.from('users').insert([
            {
                email,
                password_hash: password,
                role,
                employee_id: empRow.id
            }
        ]);

        if (userError) {
            await window.supabaseClient.from('employees').delete().eq('id', empRow.id);
            throw userError;
        }

        showToast('Employee created successfully', 'success');
        document.getElementById('employeeForm').reset();
        loadEmployees();
    } catch (error) {
        console.error('Error creating employee:', error);
        const msg = error.message || 'Unknown error';
        if (msg.includes('duplicate') || msg.includes('unique')) {
            showToast('That email is already in use', 'error');
        } else {
            showToast('Error creating employee: ' + msg, 'error');
        }
    }
});

// Open edit modal
async function openEditModal(employeeId) {
    try {
        const { data: emp, error: empError } = await window.supabaseClient
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .single();

        if (empError) throw empError;

        const { data: usr } = await window.supabaseClient
            .from('users')
            .select('id, email, role')
            .eq('employee_id', employeeId)
            .maybeSingle();

        document.getElementById('editEmployeeId').value = employeeId;
        document.getElementById('editEmployeeName').value = emp.name || '';
        document.getElementById('editEmployeePhone').value = emp.phone || '';
        const ppt = document.getElementById('editPerPersonTarget');
        if (ppt) {
            const v = emp.per_person_target_aed;
            ppt.value = v != null && v !== '' ? String(v) : '30';
        }
        document.getElementById('editUserId').value = usr?.id || '';
        document.getElementById('editEmployeeEmail').value = usr?.email || '';
        document.getElementById('editEmployeeRole').value = usr?.role === 'manager' ? 'manager' : 'employee';
        document.getElementById('editEmployeePassword').value = '';

        const hasLogin = !!usr?.id;
        document.getElementById('editEmployeeEmail').disabled = !hasLogin;
        document.getElementById('editEmployeeRole').disabled = !hasLogin;
        document.getElementById('editEmployeePassword').disabled = !hasLogin;

        document.getElementById('editModal').classList.add('show');
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Could not load employee: ' + error.message, 'error');
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    document.getElementById('editForm').reset();
    document.getElementById('editEmployeeEmail').disabled = false;
    document.getElementById('editEmployeeRole').disabled = false;
    document.getElementById('editEmployeePassword').disabled = false;
}

// Update employee (+ linked user when present)
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const employeeId = document.getElementById('editEmployeeId').value;
    const userId = document.getElementById('editUserId').value;
    const name = document.getElementById('editEmployeeName').value.trim();
    const phone = document.getElementById('editEmployeePhone').value.trim();
    const email = document.getElementById('editEmployeeEmail').value.trim().toLowerCase();
    const role = document.getElementById('editEmployeeRole').value;
    const newPassword = document.getElementById('editEmployeePassword').value;
    const perPersonRaw = document.getElementById('editPerPersonTarget')?.value;
    const perPersonParsed = parseFloat(perPersonRaw);
    const perPersonTargetAed = Number.isFinite(perPersonParsed) && perPersonParsed >= 0 ? perPersonParsed : 30;

    if (!name) {
        showToast('Employee name is required', 'error');
        return;
    }

    if (!isValidPhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }

    if (userId && !email) {
        showToast('Email is required for accounts with login', 'error');
        return;
    }

    if (newPassword && newPassword.length < 6) {
        showToast('New password must be at least 6 characters', 'error');
        return;
    }

    try {
        const { error: empUpdateError } = await window.supabaseClient
            .from('employees')
            .update({ name, phone, per_person_target_aed: perPersonTargetAed })
            .eq('id', employeeId);

        if (empUpdateError) throw empUpdateError;

        if (userId) {
            const userPayload = { email, role };
            if (newPassword) {
                userPayload.password_hash = newPassword;
            }

            const { error: userUpdateError } = await window.supabaseClient
                .from('users')
                .update(userPayload)
                .eq('id', userId);

            if (userUpdateError) throw userUpdateError;
        }

        showToast('Employee updated successfully', 'success');
        closeEditModal();
        loadEmployees();
    } catch (error) {
        console.error('Error updating employee:', error);
        const msg = error.message || 'Unknown error';
        if (msg.includes('duplicate') || msg.includes('unique')) {
            showToast('That email is already in use', 'error');
        } else {
            showToast('Error updating employee: ' + msg, 'error');
        }
    }
});

// Deactivate employee
async function deactivateEmployee(employeeId) {
    const confirmed = await confirmAction(
        'Are you sure you want to deactivate this employee?',
        'Deactivate Employee'
    );

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('employees')
            .update({ is_active: false })
            .eq('id', employeeId);

        if (error) throw error;

        showToast('Employee deactivated successfully', 'success');
        loadEmployees();
    } catch (error) {
        console.error('Error deactivating employee:', error);
        showToast('Error deactivating employee: ' + error.message, 'error');
    }
}

// Activate employee
async function activateEmployee(employeeId) {
    const confirmed = await confirmAction(
        'Are you sure you want to activate this employee?',
        'Activate Employee'
    );

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('employees')
            .update({ is_active: true })
            .eq('id', employeeId);

        if (error) throw error;

        showToast('Employee activated successfully', 'success');
        loadEmployees();
    } catch (error) {
        console.error('Error activating employee:', error);
        showToast('Error activating employee: ' + error.message, 'error');
    }
}

// Close modal on outside click
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadEmployees();
});
