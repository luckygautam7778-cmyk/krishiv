# TODO - Visual Premium E-commerce Redesign (Visual-only)

## Phase 1 — Re-review + change plan (visual only)
- [x] Reviewed existing styling and structure for customer + admin pages.
- [x] Reviewed: `public/css/style.css`, `public/css/admin.css`.
- [x] Reviewed shared partials: `views/partials/header.ejs`, `views/partials/footer.ejs`, `views/partials/product-card.ejs`.
- [x] Reviewed target pages for visual-only risks: `views/index.ejs`, `views/product-detail.ejs`, `views/cart.ejs`, `views/checkout.ejs`.
- [x] Reviewed additional pages: `views/login.ejs`, `views/signup.ejs`, `views/products.ejs`, `views/order-history.ejs`, `views/tracking.ejs`, `views/admin/*`.

## Phase 2 — Implement visual improvements (no functional changes)
- [~] Update `public/css/style.css`:
  - [ ] premium design tokens + typography rhythm

  - [ ] targeted transitions (remove broad transition-all where risky)
  - [ ] accessibility + prefers-reduced-motion support
  - [ ] strengthen focus rings and outline behavior
- [ ] Update `public/css/admin.css` (tables/cards/forms/badges polish only)

- [ ] Update shared partials (presentation only):
  - [ ] `views/partials/header.ejs` (navbar/cart/mobile menu styling only)
  - [ ] `views/partials/footer.ejs` (spacing/typography polish only)
  - [ ] `views/partials/product-card.ejs` (card hierarchy/image/badges)
- [ ] Page refinements (class changes only):

  - [ ] `views/index.ejs`
  - [ ] `views/product-detail.ejs`
  - [ ] `views/cart.ejs`
  - [ ] `views/checkout.ejs` (visual only; no flow/structure changes)

## Phase 3 — Verification pass (manual)
- [ ] Validate customer flows visually:
  - [ ] Login
  - [ ] Signup
  - [ ] Home + Shop
  - [ ] Product detail
  - [ ] Cart
  - [ ] Wishlist (ensure exists in UI)
  - [ ] Search + filters
  - [ ] Checkout incl. COD and payment step visuals
  - [ ] Orders + tracking
- [ ] Validate admin visuals:
  - [ ] Dashboard
  - [ ] Products
  - [ ] Categories
  - [ ] Banners
  - [ ] Orders
  - [ ] Settings
  - [ ] UPI QR

## Phase 4 — Final report
- [ ] List modified files + summary of visual-only improvements.
- [ ] Confirm no functionality/business logic was changed.

