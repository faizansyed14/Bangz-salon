// Admin Services Management Logic

// Check authentication
const user = requireAuth('admin');
if (!user) {
    throw new Error('Unauthorized');
}

// Load services list
async function loadServices() {
    try {
        const { data: services, error } = await window.supabaseClient
            .from('services')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        displayServices(services);
    } catch (error) {
        console.error('Error loading services:', error);
        showToast('Error loading services: ' + error.message, 'error');
        document.getElementById('servicesList').innerHTML = '<p style="text-align: center; color: var(--error);">Error loading services</p>';
    }
}

// Display services
function displayServices(services) {
    const container = document.getElementById('servicesList');
    
    if (services.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No services found</p>';
        return;
    }
    
    container.innerHTML = services.map(service => `
        <div class="employee-card">
            <div class="employee-card-header">
                <div>
                    <div class="employee-name">${service.name}</div>
                    <div class="employee-phone" style="text-transform: capitalize;">${service.category}</div>
                </div>
            </div>
            <div style="margin: 16px 0;">
                <div class="summary-card-value" style="font-size: 20px;">${formatCurrency(service.price)}</div>
            </div>
            <div class="employee-actions">
                <button class="btn btn-primary btn-sm" onclick="openEditModal('${service.id}', '${service.name.replace(/'/g, "\\'")}', ${service.price}, '${service.category}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteService('${service.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Create service
document.getElementById('serviceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('serviceName').value.trim();
    const price = parseFloat(document.getElementById('servicePrice').value);
    const category = document.getElementById('serviceCategory').value;
    
    // Validate
    if (!name) {
        showToast('Service name is required', 'error');
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showToast('Please enter a valid price', 'error');
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('services')
            .insert([
                {
                    name: name,
                    price: price,
                    category: category
                }
            ])
            .select()
            .single();
        
        if (error) throw error;
        
        const itemType = category === 'product' ? 'Product' : 'Service';
        showToast(`${itemType} added successfully`, 'success');
        document.getElementById('serviceForm').reset();
        loadServices();
    } catch (error) {
        console.error('Error creating service:', error);
        showToast('Error creating service: ' + error.message, 'error');
    }
});

// Open edit modal
function openEditModal(serviceId, name, price, category) {
    document.getElementById('editServiceId').value = serviceId;
    document.getElementById('editServiceName').value = name;
    document.getElementById('editServicePrice').value = price;
    document.getElementById('editServiceCategory').value = category;
    document.getElementById('editModal').classList.add('show');
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    document.getElementById('editForm').reset();
}

// Update service
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const serviceId = document.getElementById('editServiceId').value;
    const name = document.getElementById('editServiceName').value.trim();
    const price = parseFloat(document.getElementById('editServicePrice').value);
    const category = document.getElementById('editServiceCategory').value;
    
    if (!name) {
        showToast('Service name is required', 'error');
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showToast('Please enter a valid price', 'error');
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('services')
            .update({ 
                name, 
                price, 
                category,
                updated_at: new Date().toISOString()
            })
            .eq('id', serviceId);
        
        if (error) throw error;
        
        showToast('Service updated successfully', 'success');
        closeEditModal();
        loadServices();
    } catch (error) {
        console.error('Error updating service:', error);
        showToast('Error updating service: ' + error.message, 'error');
    }
});

// Delete service
async function deleteService(serviceId) {
    const confirmed = await confirmAction(
        'Are you sure you want to delete this service? This action cannot be undone.',
        'Delete Service'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('services')
            .delete()
            .eq('id', serviceId);
        
        if (error) throw error;
        
        showToast('Service deleted successfully', 'success');
        loadServices();
    } catch (error) {
        console.error('Error deleting service:', error);
        showToast('Error deleting service: ' + error.message, 'error');
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
    loadServices();
});

