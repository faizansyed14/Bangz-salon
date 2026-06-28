// Employee New Entry Logic

// Managers and Employees can create transactions
const user = requireAuth(['manager', 'employee']);
if (!user) {
    throw new Error('Unauthorized');
}


let services = [];
let selectedServices = [];
let filteredServices = [];

function showSubmitLoadingOverlay() {
    const overlay = document.getElementById('submitLoadingOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-busy', 'true');
}

function hideSubmitLoadingOverlay() {
    const overlay = document.getElementById('submitLoadingOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.removeAttribute('aria-busy');
}

// Load employees and services
async function loadData() {
    try {
        // Load all employees
        const { data: employeesData, error: employeesError } = await window.supabaseClient
            .from('employees')
            .select('id, name')
            .eq('is_active', true)
            .order('name', { ascending: true });
        
        if (employeesError) throw employeesError;
        
        const employeeSelect = document.getElementById('employeeSelect');
        if (user.role === 'employee') {
            // Employees can only select themselves
            const empName = user.employee ? user.employee.name : 'Your Name';
            employeeSelect.innerHTML = `<option value="${user.employee_id}">${empName}</option>`;
            employeeSelect.value = user.employee_id;
            // Optionally disable to prevent change, though only one option exists
            employeeSelect.disabled = true;
        } else {
            // Managers can select any active employee
            employeeSelect.innerHTML = '<option value="">Select an employee</option>' +
                employeesData.map(employee => `<option value="${employee.id}">${employee.name}</option>`).join('');
        }
        
        // Load services
        const { data: servicesData, error: servicesError } = await window.supabaseClient
            .from('services')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true });
        
        if (servicesError) throw servicesError;
        
        services = servicesData;
        // Don't show services initially - wait for category selection
        document.getElementById('servicesSection').style.display = 'none';
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data: ' + error.message, 'error');
    }
}

// Filter and display services based on selected category
function filterAndDisplayServices() {
    const categoryFilter = document.getElementById('categoryFilter').value;
    const servicesSection = document.getElementById('servicesSection');
    
    if (categoryFilter === '') {
        // Hide services section if no category selected
        servicesSection.style.display = 'none';
        filteredServices = [];
        return;
    }
    
    // Show services section and filter by category
    servicesSection.style.display = 'block';
    filteredServices = services.filter(service => service.category === categoryFilter);
    displayServices();
}

// Display services
function displayServices() {
    const grid = document.getElementById('servicesGrid');
    
    if (filteredServices.length === 0) {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const message = categoryFilter === 'service'
            ? 'No services available'
            : 'No products available';
        grid.innerHTML = `<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">${message}</p>`;
        return;
    }
    
    grid.innerHTML = filteredServices.map(service => `
        <div class="service-box" data-service-id="${service.id}" onclick="toggleService('${service.id}')">
            <div class="service-box-name">${service.name}</div>
            <div class="service-box-price">${formatCurrency(service.price)}</div>
        </div>
    `).join('');
    
    // Update selection state for filtered services
    updateServiceSelection();
}

// Toggle service selection
function toggleService(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    const index = selectedServices.findIndex(s => s.id === serviceId);
    
    if (index > -1) {
        // Remove service
        selectedServices.splice(index, 1);
    } else {
        // Add service
        selectedServices.push({
            id: service.id,
            name: service.name,
            price: parseFloat(service.price),
            quantity: 1
        });
    }
    
    updateServiceSelection();
    updateTotals();
}

// Update service selection UI
function updateServiceSelection() {
    // Update service boxes
    document.querySelectorAll('.service-box').forEach(box => {
        const serviceId = box.getAttribute('data-service-id');
        const isSelected = selectedServices.some(s => s.id === serviceId);
        box.classList.toggle('selected', isSelected);
    });
    
    // Update selected services list
    const selectedDiv = document.getElementById('selectedServices');
    const listDiv = document.getElementById('selectedServicesList');
    
    if (selectedServices.length === 0) {
        selectedDiv.style.display = 'none';
        return;
    }
    
    selectedDiv.style.display = 'block';
    listDiv.innerHTML = selectedServices.map(service => `
        <div class="selected-service-item">
            <span>${service.name} ${service.quantity > 1 ? `(x${service.quantity})` : ''}</span>
            <span><strong>${formatCurrency(service.price * service.quantity)}</strong></span>
        </div>
    `).join('');
}

// Update totals
function updateTotals() {
    const subtotal = selectedServices.reduce((sum, service) => {
        return sum + (service.price * service.quantity);
    }, 0);

    const { subtotalExclVat, vatAmount } = computeVAT(subtotal);
    const tips = parseFloat(document.getElementById('tips').value) || 0;
    const grandTotal = subtotal + tips;

    document.getElementById('subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('displaySubtotalExclVat').textContent = formatCurrency(subtotalExclVat);
    document.getElementById('displayVatAmount').textContent = formatCurrency(vatAmount);
    document.getElementById('displaySubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('displayTips').textContent = formatCurrency(tips);
    document.getElementById('grandTotal').textContent = formatCurrency(grandTotal);
}

// Handle tips input
document.getElementById('tips').addEventListener('input', updateTotals);

// Handle category filter change
document.getElementById('categoryFilter').addEventListener('change', () => {
    filterAndDisplayServices();
});

// Handle form submission
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');

    const employeeId = document.getElementById('employeeSelect').value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    const tips = parseFloat(document.getElementById('tips').value) || 0;
    const customerName = (document.getElementById('customerName')?.value || '').trim();
    const customerWhatsappRaw = (document.getElementById('customerWhatsapp')?.value || '').trim();

    if (!employeeId) {
        showToast('Please select an employee', 'error');
        return;
    }

    if (selectedServices.length === 0) {
        showToast('Please select at least one service', 'error');
        return;
    }

    if (!paymentMethod) {
        showToast('Please select a payment method', 'error');
        return;
    }

    const subtotal = selectedServices.reduce((sum, s) => sum + s.price * s.quantity, 0);
    const { subtotalExclVat, vatAmount } = computeVAT(subtotal);
    const total = subtotal + tips;

    if (submitBtn) submitBtn.disabled = true;
    showSubmitLoadingOverlay();

    try {
        // Upsert customer BEFORE inserting the transaction so we can include
        // customer_id directly in the INSERT (avoids a separate UPDATE that RLS
        // on transactions would silently block for employee accounts).
        let customerId = null;
        if (customerName && customerWhatsappRaw) {
            const normalizedPhone = normalizeWhatsAppNumber(customerWhatsappRaw);
            if (normalizedPhone.length >= 7) {
                try {
                    const { data: customer, error: customerError } = await window.supabaseClient
                        .from('customers')
                        .upsert(
                            { name: customerName, whatsapp_number: normalizedPhone, last_visited_at: new Date().toISOString() },
                            { onConflict: 'whatsapp_number' }
                        )
                        .select('id')
                        .single();

                    if (!customerError && customer) {
                        customerId = customer.id;
                    } else if (customerError) {
                        console.warn('Customer upsert error (non-fatal):', customerError);
                    }
                } catch (customerErr) {
                    console.warn('Customer save failed (non-fatal):', customerErr);
                }
            }
        }

        const transactionDateUTC = getCurrentGSTAsUTC();

        const { data: transaction, error: transactionError } = await window.supabaseClient
            .from('transactions')
            .insert([{
                employee_id: employeeId,
                payment_method: paymentMethod,
                subtotal,
                subtotal_excl_vat: subtotalExclVat,
                vat_amount: vatAmount,
                tips,
                total,
                transaction_date: transactionDateUTC,
                ...(customerId ? { customer_id: customerId } : {})
            }])
            .select()
            .single();

        if (transactionError) throw transactionError;

        const transactionItems = selectedServices.map(s => ({
            transaction_id: transaction.id,
            service_id: s.id,
            service_name: s.name,
            price: s.price,
            quantity: s.quantity
        }));

        const { error: itemsError } = await window.supabaseClient
            .from('transaction_items')
            .insert(transactionItems);

        if (itemsError) throw itemsError;

        showToast('Transaction saved.', 'success');
        setTimeout(() => { window.location.href = '/employee/dashboard.html'; }, 1100);

    } catch (error) {
        console.error('Error creating transaction:', error);
        hideSubmitLoadingOverlay();
        if (submitBtn) submitBtn.disabled = false;
        showToast('Error creating transaction: ' + (error.message || 'Unknown error'), 'error');
    }
});

// Make toggleService available globally
window.toggleService = toggleService;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupStaffNavForRole(user);
    loadData();
});

