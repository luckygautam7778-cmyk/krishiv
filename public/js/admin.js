/* ============================================================
   POSHAAK - Admin JavaScript
   ============================================================ */

// ── ADMIN TOAST ─────────────────────────────────────────────────
function showAdminToast(message, type = 'success') {
  let container = document.querySelector('.admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'admin-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `admin-toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── SIDEBAR TOGGLE ───────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  sidebar.classList.toggle('-translate-x-full');
  overlay?.classList.toggle('hidden');
}

// ── CONFIRM DELETE ───────────────────────────────────────────────
function confirmDelete(message = 'Are you sure you want to delete this?') {
  return window.confirm(message);
}

// ── IMAGE PREVIEW ────────────────────────────────────────────────
function previewImages(input) {
  const preview = document.getElementById('imagePreview');
  if (!preview) return;
  preview.innerHTML = '';

  const files = Array.from(input.files).slice(0, 6);
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'relative group';
      div.innerHTML = `
        <img src="${e.target.result}" 
             class="w-full aspect-square object-cover rounded-xl border-2 border-green-200 shadow-sm" 
             alt="Preview ${i + 1}" />
        <div class="absolute top-1 right-1 bg-green-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shadow">
          <i class="fas fa-check text-[8px]"></i>
        </div>
      `;
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// ── AUTO DISMISS FLASH MESSAGES ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('adminFlashSuccess')?.remove();
    document.getElementById('adminFlashError')?.remove();
  }, 5000);

  // Confirm before deletes
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!confirm(el.dataset.confirm)) e.preventDefault();
    });
  });

  // Activate correct sidebar link
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && path.startsWith(href) && href !== '/admin/') {
      link.classList.add('active');
    }
  });
});

// ── PRODUCT FORM: TAG INPUT ───────────────────────────────────────
function formatTags(input) {
  // Normalize comma-separated tags
  const val = input.value;
  if (val.endsWith(',') || val.endsWith(', ')) return;
}

// ── STATUS COLOR HELPER ──────────────────────────────────────────
function getStatusClass(status) {
  const map = {
    'Pending':   'bg-yellow-100 text-yellow-700',
    'Confirmed': 'bg-blue-100 text-blue-700',
    'Shipped':   'bg-purple-100 text-purple-700',
    'Delivered': 'bg-green-100 text-green-700',
    'Cancelled': 'bg-red-100 text-red-700'
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

// ── PRINT ORDER ──────────────────────────────────────────────────
function printOrder() {
  window.print();
}

// ── DRAG & DROP UPLOAD ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.querySelector('.drop-zone');
  const fileInput = document.getElementById('imageInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      fileInput.files = e.dataTransfer.files;
      previewImages(fileInput);
    });
  }
});
