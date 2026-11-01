// Utility Functions for BangzSalon

// Timezone: GST (Gulf Standard Time, UTC+4) - Asia/Dubai
// Every calendar day, month total, and saved sale uses this zone.
// Phone timezone (UAE, Philippines, anywhere else) must not change the numbers.
const TIMEZONE = 'Asia/Dubai';
const GST_OFFSET = '+04:00';

function _pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Dubai wall-clock parts for an instant. Does not use the phone timezone.
 * month is 1-12.
 */
function getGSTParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const pick = (type) => {
    const part = parts.find((p) => p.type === type);
    return part ? part.value : '0';
  };

  // Some engines report midnight as 24:00. That makes an invalid ISO string.
  let hour = pick('hour');
  if (hour === '24') hour = '00';

  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(hour),
    minute: Number(pick('minute')),
    second: Number(pick('second'))
  };
}

/**
 * Instant for a Dubai civil date. monthIndex is 0-11.
 * Building +04:00 directly avoids new Date(y, m, d), which is phone-local midnight.
 */
function dateAtGST(year, monthIndex, day, hour = 0, minute = 0, second = 0, ms = 0) {
  const iso = `${year}-${_pad2(monthIndex + 1)}-${_pad2(day)}T${_pad2(hour)}:${_pad2(minute)}:${_pad2(second)}.${String(ms).padStart(3, '0')}${GST_OFFSET}`;
  return new Date(iso);
}

/** Noon Dubai on the Dubai day of `date`. Safe cursor for month navigation. */
function getGSTNoon(date = new Date()) {
  const p = getGSTParts(date);
  return dateAtGST(p.year, p.month - 1, p.day, 12, 0, 0, 0);
}

/** Calendar key year-monthIndex-day in Dubai. monthIndex is 0-11. */
function gstDateKey(date) {
  const p = getGSTParts(date);
  return `${p.year}-${p.month - 1}-${p.day}`;
}

/** Move a Dubai calendar month without local setMonth (which can skip February). */
function shiftGSTMonth(date, delta) {
  const p = getGSTParts(date);
  const utc = new Date(Date.UTC(p.year, (p.month - 1) + delta, 1));
  return dateAtGST(utc.getUTCFullYear(), utc.getUTCMonth(), 1, 12, 0, 0, 0);
}

/**
 * Get current date/time in GST (for display purposes)
 */
function getGSTDate(date = new Date()) {
  const p = getGSTParts(date);
  return dateAtGST(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
}

/**
 * Get current GST time as UTC ISO string (for database storage)
 * A sale at 00:01 Dubai is stored on the new Dubai date, on every phone.
 */
function getCurrentGSTAsUTC() {
  const p = getGSTParts(new Date());
  return dateAtGST(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0).toISOString();
}

/**
 * Start of the Dubai day that contains `date` (00:00:00.000 GST).
 */
function getStartOfDay(date = new Date()) {
  const p = getGSTParts(date);
  return dateAtGST(p.year, p.month - 1, p.day, 0, 0, 0, 0);
}

/**
 * End of the Dubai day that contains `date` (23:59:59.999 GST).
 */
function getEndOfDay(date = new Date()) {
  const p = getGSTParts(date);
  return dateAtGST(p.year, p.month - 1, p.day, 23, 59, 59, 999);
}

/**
 * Start of a Dubai month. month is 0-indexed (0=Jan, 11=Dec).
 * 1st 00:00:00 GST, not phone-local midnight.
 */
function getStartOfMonth(year, month) {
  return dateAtGST(year, month, 1, 0, 0, 0, 0);
}

/**
 * End of a Dubai month. month is 0-indexed.
 * Last day 23:59:59.999 GST. A sale at 00:01 on the 1st belongs to the new month.
 */
function getEndOfMonth(year, month) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return dateAtGST(year, month, lastDay, 23, 59, 59, 999);
}

/**
 * Format date as DD/MM/YYYY in Dubai, ignoring the phone timezone.
 */
function formatDate(date) {
  const p = getGSTParts(date instanceof Date ? date : new Date(date));
  return `${_pad2(p.day)}/${_pad2(p.month)}/${p.year}`;
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
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Weekday of the 1st (0 = Sunday). Gregorian weekday, not the phone timezone.
 */
function getFirstDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
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
