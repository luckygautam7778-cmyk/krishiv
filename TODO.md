# TODO - Production Admin Login Incident

## Completed
- [x] Updated `utils/bootstrapAdmin.js` to use ONLY `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (removed hardcoded credentials)
- [x] Added deterministic guard in `app.js` to prevent accidental double-run of `bootstrapAdmin()` within a single process

## Pending
- [ ] Remove temporary CSRF diagnostics logging from `middleware/csrf.js` (keep only production-safe minimal logs)
- [ ] Verify CSRF token lifecycle for `/admin/login` (GET generates token in session; POST validates same session)
- [ ] Verify Render/HTTPS cookie behavior (session cookie persists; CSRF token cookie/session aligned)
- [ ] Run production validation checklist (TEST 1-7)
- [ ] Regression safety checks: confirm products, categories, cart, checkout, COD, UPI, orders, and users untouched
- [ ] Commit and push changes
- [ ] Redeploy to Render and confirm admin login works with valid credentials


