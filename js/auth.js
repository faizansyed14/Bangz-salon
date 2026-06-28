// Authentication Logic

// Check if user is logged in
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) {
    return null;
  }
  return user;
}

// Set user session
function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// Clear user session
function clearUser() {
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}

// Login function
// NOTE: This is a simplified authentication for demo purposes
// For production, use Supabase Auth with proper password hashing
async function login(email, password) {
  try {
    // Check if Supabase client is initialized
    if (!window.supabaseClient) {
      return { success: false, error: 'Database not configured. Please check Supabase settings.' };
    }

    // For demo purposes, we'll use a simple check
    // In production, use Supabase Auth with proper password verification
    const { data, error } = await window.supabaseClient
      .from('users')
      .select('*, employees(*)')
      .eq('email', email)
      .single();

    if (error) {
      // If user not found, return generic error for security
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Invalid email or password' };
      }
      throw error;
    }

    // Simple password check (for demo only)
    // In production, use bcrypt or Supabase Auth
    // For now, we'll compare plain text (NOT SECURE - for testing only)
    if (data && data.password_hash === password) {
      const linkedEmployee = data.employees;
      if (data.employee_id && linkedEmployee && linkedEmployee.is_active === false) {
        return { success: false, error: 'This account has been deactivated.' };
      }

      setUser({
        id: data.id,
        email: data.email,
        role: data.role,
        employee_id: data.employee_id || null,
        employee: linkedEmployee || null
      });
      return { success: true, user: data };
    } else {
      return { success: false, error: 'Invalid email or password' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message || 'Login failed. Please try again.' };
  }
}

// Redirect based on user role
function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = '/admin/dashboard.html';
  } else if (role === 'manager' || role === 'employee') {
    window.location.href = '/employee/dashboard.html';
  } else {
    window.location.href = '/index.html';
  }
}

// Hide manager-only navigation (e.g. New Entry) for stylist accounts
function setupStaffNavForRole(user) {
  if (!user || (user.role !== 'employee' && user.role !== 'manager')) {
    return;
  }
  if (user.role === 'employee') {
    document.querySelectorAll('a[href="expenses.html"]').forEach((el) => {
      el.style.display = 'none';
    });
  }
}

// Require authentication for protected pages.
// requiredRole: string or array of allowed roles (e.g. 'admin' or ['manager', 'employee']).
function requireAuth(requiredRole = null) {
  const user = checkAuth();
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(user.role)) {
      window.location.href = '/index.html';
      return null;
    }
  }
  return user;
}

