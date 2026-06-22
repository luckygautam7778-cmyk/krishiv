/* ============================================================
   POSHAAK - Main JavaScript (Customer Side)
   ============================================================ */

// ── TOAST NOTIFICATION ─────────────────────────────────────────
let toastContainer = null;

function showToast(message, type = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── ADD TO CART (from product cards) ──────────────────────────
function addToCart(productId, quantity = 1) {
  fetch('/cart/add', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || ''
    },
    body: JSON.stringify({ productId, quantity })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      showToast(data.message || 'Added to cart! 🛍️', 'success');
      // Update cart badge
      const badge = document.getElementById('cartBadge');
      if (badge) {
        badge.textContent = data.cartCount;
        badge.classList.remove('hidden');
      }
    } else {
      showToast(data.message || 'Could not add to cart', 'error');
    }
  })
  .catch(() => showToast('Network error. Please try again.', 'error'));
}

// ── MOBILE MENU ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!menu?.contains(e.target) && e.target !== btn) {
      menu?.classList.add('hidden');
    }
  });

  // Auto-hide flash messages after 5s
  setTimeout(() => {
    document.getElementById('flashSuccess')?.remove();
    document.getElementById('flashError')?.remove();
  }, 5000);
});

// ── LAZY LOADING ───────────────────────────────────────────────
if ('IntersectionObserver' in window) {
  const lazyImages = document.querySelectorAll('img[loading="lazy"]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src || img.src;
        observer.unobserve(img);
      }
    });
  });
  lazyImages.forEach(img => observer.observe(img));
}

// ── SMOOTH SCROLL TO TOP ───────────────────────────────────────
window.addEventListener('scroll', () => {
  const scrollBtn = document.getElementById('scrollTop');
  if (scrollBtn) {
    scrollBtn.style.display = window.pageYOffset > 400 ? 'flex' : 'none';
  }
});

// ── FORM VALIDATION ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Phone number: only allow digits
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 10);
    });
  });

  // Pincode: only allow digits
  document.querySelectorAll('input[name="pincode"]').forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 6);
    });
  });
});

// ── PRODUCT SEARCH DEBOUNCE ────────────────────────────────────
let searchTimer = null;
function debounceSearch(input, delay = 400) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    input.form?.submit();
  }, delay);
}
