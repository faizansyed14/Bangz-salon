// Utility Functions for BangzSalon

// Timezone: GST (Gulf Standard Time, UTC+4) - Asia/Dubai
const TIMEZONE = 'Asia/Dubai';

/**
 * Get current date/time in GST (for display purposes)
 */
function getGSTDate(date = new Date()) {
  // Use Intl API for proper timezone conversion
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const second = parts.find(p => p.type === 'second').value;
  
  // Create date in GST (UTC+4)
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+04:00`);
}

/**
 * Get current GST time as UTC ISO string (for database storage)
 * This ensures the transaction_date stored in DB represents the correct GST time
 */
function getCurrentGSTAsUTC() {
  // Get current time components in GST
  const now = new Date();
  const gstDateStr = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse: format is "MM/DD/YYYY, HH:MM:SS"
  const [datePart, timePart] = gstDateStr.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  // Create date string in GST (UTC+4)
  const gstISOString = `${year}-${month}-${day}T${hour}:${minute}:${second}+04:00`;
  
  // Convert to UTC ISO string (this is what we store in DB)
  const gstDate = new Date(gstISOString);
  return gstDate.toISOString();
}

/**
 * Get start of day in GST (returns ISO string for database queries)
 * Simple and robust: Create date string in GST, then convert to UTC
 */
function getStartOfDay(date = new Date()) {
  // Get date string in GST timezone
  const gstDateStr = date.toLocaleString('en-US', { 
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse: format is "MM/DD/YYYY"
  const [month, day, year] = gstDateStr.split('/');
  
  // Create date at 00:00:00 in GST (UTC+4)
  // This automatically converts to UTC when we call toISOString()
  const gstDate = new Date(`${year}-${month}-${day}T00:00:00+04:00`);
  
  return gstDate;
}

/**
 * Get end of day in GST (returns ISO string for database queries)
 */
function getEndOfDay(date = new Date()) {
  // Get date string in GST timezone
  const gstDateStr = date.toLocaleString('en-US', { 
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse: format is "MM/DD/YYYY"
  const [month, day, year] = gstDateStr.split('/');
  
  // Create date at 23:59:59.999 in GST (UTC+4)
  const gstDate = new Date(`${year}-${month}-${day}T23:59:59.999+04:00`);
  
  return gstDate;
}

/**
 * Get start of month in GST (returns Date object in UTC for database queries)
 * This ensures we capture all transactions from the first moment of the month in GST
 */
function getStartOfMonth(year, month) {
  // Create date for first day of month
  // Note: month is 0-indexed in JavaScript (0=Jan, 11=Dec)
  const date = new Date(year, month, 1);
  return getStartOfDay(date);
}

/**
 * Get end of month in GST (returns Date object in UTC for database queries)
 * This ensures we capture all transactions up to the last moment of the month in GST
 */
function getEndOfMonth(year, month) {
  // Create date for last day of month (month + 1, day 0 = last day of previous month)
  const date = new Date(year, month + 1, 0);
  return getEndOfDay(date);
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDate(date) {
  const d = getGSTDate(new Date(date));
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format time as HH:MM AM/PM (in GST timezone)
 */
function formatTime(date) {
  // If date is a string or needs conversion, convert it first
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Get time in GST timezone using Intl API
  // This ensures the time is displayed in Asia/Dubai timezone (GST, UTC+4)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  return formatter.format(dateObj);
}

/**
 * Format datetime as DD/MM/YYYY HH:MM AM/PM
 */
function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Format currency as AED
 */
function formatCurrency(amount) {
  return `AED ${parseFloat(amount).toFixed(2)}`;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Show loading spinner
 */
function showLoading(element) {
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.innerHTML = '<div class="spinner"></div>';
  element.appendChild(spinner);
  return spinner;
}

/**
 * Hide loading spinner
 */
function hideLoading(spinner) {
  if (spinner) {
    spinner.remove();
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate phone number (UAE format)
 */
function isValidPhone(phone) {
  const re = /^[0-9+\-\s()]+$/;
  return re.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

/**
 * Confirm action with user using modal popup
 * Returns a Promise that resolves to true if confirmed, false if cancelled
 */
function confirmAction(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmModalMessage');
    const titleEl = document.getElementById('confirmModalTitle');
    const yesBtn = document.getElementById('confirmModalYes');
    
    if (!modal || !messageEl || !titleEl || !yesBtn) {
      // Fallback to browser confirm if modal doesn't exist
      resolve(confirm(message));
      return;
    }
    
    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Show modal
    modal.classList.add('show');
    
    // Remove any existing event listeners by cloning the button
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    
    // Handle confirm
    newYesBtn.addEventListener('click', () => {
      modal.classList.remove('show');
      resolve(true);
    });
    
    // Handle cancel (close button and cancel button)
    const closeConfirmModal = () => {
      modal.classList.remove('show');
      resolve(false);
    };
    
    modal.querySelector('.modal-close').onclick = closeConfirmModal;
    modal.querySelector('.btn-secondary').onclick = closeConfirmModal;
    
    // Close on outside click
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeConfirmModal();
      }
    };
    
    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        closeConfirmModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

/**
 * Close confirmation modal
 */
function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

/**
 * Get month name
 */
function getMonthName(monthIndex) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex];
}

/**
 * Get days in month
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get first day of month (0 = Sunday, 1 = Monday, etc.)
 */
function getFirstDayOfMonth(year, month) {
  const date = new Date(year, month, 1);
  return date.getDay();
}

/**
 * Setup mobile hamburger navigation
 */
function setupMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('.nav-mobile');
  const overlay = document.querySelector('.nav-overlay');

  if (!hamburger || !nav || !overlay) return;

  const closeNav = () => {
    document.body.classList.remove('nav-open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
  };

  const toggleNav = () => {
    const isOpen = document.body.classList.toggle('nav-open');
    hamburger.classList.toggle('active', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  hamburger.addEventListener('click', toggleNav);
  overlay.addEventListener('click', closeNav);
  nav.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', closeNav);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeNav();
    }
  });
}

document.addEventListener('DOMContentLoaded', setupMobileNav);

/**
 * Theme Toggle Functions
 */

// Initialize theme on page load
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
}

// Set theme
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update toggle button icons if they exist
  const toggleBtn = document.getElementById('themeToggle');
  const toggleBtnMobile = document.getElementById('themeToggleMobile');
  
  const icon = theme === 'dark' ? '☀️' : '🌙';
  const title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  
  if (toggleBtn) {
    toggleBtn.innerHTML = icon;
    toggleBtn.setAttribute('title', title);
  }
  
  if (toggleBtnMobile) {
    toggleBtnMobile.innerHTML = icon;
    toggleBtnMobile.setAttribute('title', title);
  }
}

/** Load expense rows in [startISO, endISO] (inclusive) on expense_date, newest first */
async function fetchExpensesInRange(startISO, endISO) {
  if (!window.supabaseClient) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('expenses')
      .select('id, category, custom_name, amount, expense_date, created_at')
      .gte('expense_date', startISO)
      .lte('expense_date', endISO)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('fetchExpensesInRange:', e);
    return [];
  }
}

/** Sum expense amounts in [startISO, endISO] (e.g. CSV summaries) */
async function sumExpensesInRange(startISO, endISO) {
  const rows = await fetchExpensesInRange(startISO, endISO);
  return rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
}

function _escapeHtmlCalendar(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function _expenseLabelForCalendar(row) {
  if (row.category === 'other' && row.custom_name) return _escapeHtmlCalendar(String(row.custom_name).trim());
  if (row.category === 'tea') return 'Tea';
  if (row.category === 'tea_cups') return 'Tea cups';
  return _escapeHtmlCalendar(row.category || '');
}

/** HTML block: list each expense (date, type/name, amount) + period total */
function calendarExpensesSectionHtml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  const bodyHtml =
    list.length === 0
      ? `<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-secondary);">No expenses in this period</td></tr>`
      : list
          .map((row) => {
            const ts = row.created_at || row.expense_date;
            const dt = new Date(ts);
            const when = `${formatDate(dt)} · ${formatTime(dt)}`;
            return `<tr>
            <td style="color:var(--text-secondary);font-size:14px;white-space:nowrap;">${_escapeHtmlCalendar(when)}</td>
            <td>${_expenseLabelForCalendar(row)}</td>
            <td><strong>${formatCurrency(row.amount)}</strong></td>
          </tr>`;
          })
          .join('');

  return `
    <div class="calendar-expenses-footer" style="margin-top: 28px; padding-top: 20px; border-top: 2px solid var(--border);">
      <h3 style="margin-bottom: 12px; color: var(--text-primary);">Expenses</h3>
      <div class="table-container" style="margin-bottom: 16px;">
        <table>
          <thead>
            <tr>
              <th>When added</th>
              <th>Expense</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      <div class="summary-grid" style="margin-bottom: 0;">
        <div class="summary-card">
          <div class="summary-card-label">Total expenses (this period)</div>
          <div class="summary-card-value" style="color: var(--error); font-weight: 700;">${formatCurrency(total)}</div>
        </div>
      </div>
    </div>`;
}

// Toggle theme
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

// Make toggleTheme globally accessible
window.toggleTheme = toggleTheme;

/**
 * Create celebration elements (sparkles) - Simplified
 * @param {HTMLElement} container - The award card container
 */
function createCelebrationElements(container) {
    if (!container || container._hasCelebration) return;
    container._hasCelebration = true;

    // Create a few subtle sparkles
    for (let i = 0; i < 10; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-particle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.animationDelay = Math.random() * 3 + 's';
        container.appendChild(sparkle);
    }
}

// Make globally accessible
window.createCelebrationElements = createCelebrationElements;

// Initialize theme when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
