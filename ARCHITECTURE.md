# Syntra POS — System Architecture Document

> Complete architectural analysis across 5 levels: Business, Architecture, Data Model, Modules, and Business Processes.

---

## NIVEL 1 — Business Overview

### Company Profile

| Attribute      | Value                                                  |
| -------------- | ------------------------------------------------------ |
| **Name**       | Syntra POS                                             |
| **Type**       | Point-of-Sale / PWA for retail (libreria / stationery) |
| **Location**   | Argentina                                              |
| **Currency**   | ARS (Argentine Peso), symbol `$`                       |
| **Tax**        | IVA 21%                                                |
| **Mode**       | Take-away only (delivery removed)                      |
| **Deployment** | Vercel (static files, no backend)                      |
| **Storage**    | IndexedDB (single-tenant, local to browser)            |

### Roles

| Role     | Access                                 |
| -------- | -------------------------------------- |
| `admin`  | Full access to all modules             |
| `cajero` | POS, Cash, Products, Sales (read-only) |

### Product Catalog

- **344 products** across **11 categories**
- Papeleria (63), Escritura y Dibujo (71), Cuadernos (35), Adhesivos (26), Oficina (20), Manualidades (19), Carpetas (12), Geometria (9), Calculadoras (6), Herramientas (5), Varios (78)

### E-commerce

- **Shop** module sends WhatsApp message (no online payment, no cart persistence)

---

## NIVEL 2 — Architecture

### Technology Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | Vanilla JS (ES6 modules), CSS Custom Properties |
| Storage  | IndexedDB (`pos_premium_db` v4, 14 stores)      |
| Build    | None (native ES modules)                        |
| PWA      | Service Worker (`sw.js`), Web App Manifest      |
| Tests    | Node built-in test runner (148 tests)           |
| Linting  | ESLint + Prettier                               |

### Architectural Pattern

```
Module (UI) → Service (business logic) → Repository (data access) → IndexedDB
```

### Module Registry (`js/app.js`)

| Module     | Route         | Service       | Repository                                                                           |
| ---------- | ------------- | ------------- | ------------------------------------------------------------------------------------ |
| Dashboard  | `#dashboard`  | —             | saleRepo, productRepo, customerRepo, cashSessionRepo, cashMovementRepo, categoryRepo |
| POS        | `#pos`        | cashService   | productRepo, saleRepo, saleItemRepo, customerRepo                                    |
| Products   | `#products`   | —             | productRepo, categoryRepo, saleItemRepo                                              |
| Categories | `#categories` | —             | categoryRepo, productRepo                                                            |
| Customers  | `#customers`  | —             | customerRepo, saleRepo                                                               |
| Cash       | `#cash`       | cashService   | cashSessionRepo, cashMovementRepo, cashClosureRepo                                   |
| Sales      | `#sales`      | —             | saleRepo, customerRepo                                                               |
| Settings   | `#settings`   | backupManager | settingRepo, backupSnapshotRepo                                                      |
| Users      | `#users`      | —             | userRepo                                                                             |
| Reports    | `#reports`    | —             | saleRepo, categoryRepo, productRepo                                                  |
| Shop       | `#shop`       | shopService   | productRepo, categoryRepo, customerRepo                                              |

### Event Bus (`js/state.js`)

Synchronous pub/sub for inter-module communication.

| Event                          | Emitter                      | Consumer(s)          |
| ------------------------------ | ---------------------------- | -------------------- |
| `data:products-changed`        | products.js, cashService.js  | POS, dashboard, shop |
| `data:customers-changed`       | customers.js, cashService.js | POS, dashboard, shop |
| `data:sales-changed`           | pos.js, cashService.js       | POS, dashboard, cash |
| `data:categories-changed`      | categories.js                | POS, dashboard, shop |
| `data:settings-changed`        | settings.js                  | all modules          |
| `data:payment-methods-changed` | settings.js                  | POS                  |
| `sale:created`                 | pos.js                       | —                    |

### Component Library (`components/`)

| Component   | Purpose                                              |
| ----------- | ---------------------------------------------------- |
| `table.js`  | Generic data table with sorting, pagination, actions |
| `modal.js`  | Configurable modal dialogs                           |
| `toast.js`  | Toast notifications                                  |
| `header.js` | App header with navigation                           |

### Utility Modules (`utils/`)

| Utility           | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `currency.js`     | `format()`, `parse()` — ARS formatting                |
| `sanitizer.js`    | `escapeHtml()` — XSS prevention                       |
| `validators.js`   | Form validation (required, minLength, isNumber, etc.) |
| `payments.js`     | Payment method management, validation, decomposition  |
| `saleHelpers.js`  | Shared sale table rendering helpers                   |
| `charts.js`       | Canvas charting (bar, line, doughnut, pie)            |
| `analytics.js`    | Sales aggregation by period/category                  |
| `ticket.js`       | Receipt rendering                                     |
| `pdfExport.js`    | Cash session PDF export                               |
| `export.js`       | Full database JSON export                             |
| `imageHelper.js`  | Product image placeholders                            |
| `hash.js`         | Password hashing (salted SHA-256)                     |
| `logger.js`       | Buffered logging (debug/info/warn/error)              |
| `githubBackup.js` | GitHub API integration for backup sync                |

### Services (`services/`)

| Service            | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `backupManager.js` | Snapshots, auto-backup, restore, GitHub sync |

---

## NIVEL 3 — Data Model

### Database: `pos_premium_db` v4

| Store              | Key   | Records  | Purpose                   |
| ------------------ | ----- | -------- | ------------------------- |
| `products`         | `id`  | 344      | Product catalog           |
| `categories`       | `id`  | 11       | Product categories        |
| `customers`        | `id`  | ~5       | Customer accounts         |
| `sales`            | `id`  | variable | Sale transactions         |
| `sale_items`       | `id`  | variable | Individual line items     |
| `cash_sessions`    | `id`  | variable | Cash register sessions    |
| `cash_movements`   | `id`  | variable | Individual cash movements |
| `cash_closures`    | `id`  | variable | End-of-session closures   |
| `settings`         | `key` | ~10      | App configuration         |
| `users`            | `id`  | 2        | Authenticated users       |
| `notifications`    | `id`  | variable | In-app notifications      |
| `counters`         | `key` | 1        | ID generation counters    |
| `backup_snapshots` | `id`  | max 20   | Data snapshots            |
| `payment_methods`  | `id`  | 4        | Payment method config     |

### Key Data Structures

**Sale:**

```js
{
  id: 'S-2026-000001',
  items: [{ productId, name, price, quantity, subtotal }],
  total: 150.00,
  payments: [{ method: 'cash', amount: 200 }],
  paymentType: 'SIMPLE' | 'COMBINADO',
  cashReceived: 200,
  change: 50,
  discount: { type: null, value: 0 },
  subtotal: 150,
  tax: 0,
  customerId: 'cust_xxx',
  sessionId: 'session_xxx',
  userId: 'user_xxx',
  status: 'completed' | 'cancelled',
  createdAt: '2026-01-15T...'
}
```

**Cash Session:**

```js
{
  id: 'session_1700000000000',
  openedAt: Date,
  closedAt: Date | null,
  initialAmount: 10000,
  finalAmount: number,
  userId: string,
  userName: string,
  observation: string,
  closeObservation: string
}
```

**Cash Movement:**

```js
{
  id: 'mov_xxx',
  sessionId: string,
  type: 'opening' | 'in' | 'out' | 'sale' | 'cancellation',
  amount: number,
  description: string,
  createdAt: Date
}
```

**Cash Closure:**

```js
{
  id: 'cl_1700000000000_abc',
  sessionId: string,
  openedAt: Date,
  closedAt: Date,
  initialAmount: number,
  manualIn: number,
  manualOut: number,
  cashSales: number,
  transferSales: number,
  debitSales: number,
  accountSales: number,
  totalSales: number,
  expectedTotal: number,
  finalAmount: number,
  difference: number,
  salesCount: number,
  movements: [/* full snapshot for audit */],
  userName: string,
  observation: string,
  closeObservation: string
}
```

### Known Data Model Issues (Intentional / By Design)

| Issue                                        | Status                     |
| -------------------------------------------- | -------------------------- |
| `items` duplicated in `sales` + `sale_items` | Redundant but both needed  |
| `cash_closures.movements` is full snapshot   | Intentional audit trail    |
| `products.sku` always equals `id`            | Legacy, harmless           |
| `products.price_web` unused                  | Future feature placeholder |
| Counter doesn't reset per year               | Minor, non-critical        |

---

## NIVEL 4 — Module Analysis

### POS (`modules/pos/pos.js`) ~980 LOC

**Responsibility:** Cart management, multi-payment, sale confirmation, receipt display.

**Key methods:**

- `loadProducts()` — Filters active products, requires active cash session
- `addToCart(productId)` / `removeFromCart(index)` — Cart operations with stock guards
- `_validateSale()` — Returns error code string (or null): empty cart, no session, payment mismatch, insufficient balance, insufficient stock
- `_buildSaleObject(saleId, totals)` — Constructs sale data (ID: `S-YYYY-NNNNNN`, SIMPLE/COMBINADO type)
- `confirmSale()` — Full flow: validate → persist → items → stock decrement → balance decrement → cash movements → emit events → reset

**External integrations:**

- Calls `cashService.recordSale()` for cash movements
- Calls `cash.showQuickCashModal()` for quick-access button
- Listens to: `data:products-changed`, `data:customers-changed`, `data:categories-changed`, `data:settings-changed`, `data:payment-methods-changed`
- Emits: `sale:created`, `data:sales-changed`

### Cash (`modules/cash/cash.js`) ~540 LOC

**Responsibility:** Cash register UI (open/close sessions, movements, history, PDF export).

**Key methods:**

- `renderOpenSession(container)` — Summary + movement list
- `closeSession()` — Modal with `_renderCashSummaryRows()` + close inputs
- `showQuickCashModal()` — Quick access from POS (in/out/close)
- `_executeQuickClose()` — Execute close from quick modal
- `_renderCashSummaryRows(s, options)` — Shared helper for 3 summary variants
- `exportPDF()` — PDF export of current session
- `_renderHistoryTab()` — Closure history table

### Cash Service (`modules/cash/cashService.js`) ~345 LOC

**Responsibility:** Core cash business logic (session lifecycle, movements, summary calculation).

**Key methods:**

- `openSession(amount, obs)` — Create session + opening movement
- `closeSession(amount, obs)` — Compute summary, create closure, close session
- `cancelSale(sale)` — Reverse sale: negative movements, restore stock, restore balance
- `recordSale(sale)` — Create movement per payment method
- `addMovement(type, amount, desc)` — Manual in/out
- `getSummaryForSession(sessionId)` — Calculate `expectedTotal = initial + manualIn - manualOut + cashSales`

### Products (`modules/products/products.js`)

**Responsibility:** CRUD, stock adjustment, image resize, soft/hard delete.

**Notable:** Delete checks sale history — if sales exist, forces soft-delete (inactive).

### Categories (`modules/categories/categories.js`)

**Responsibility:** CRUD with M4 fix — `deleteCategory()` nullifies `categoryId` on associated products before deleting.

### Customers (`modules/customers/customers.js`)

**Responsibility:** CRUD, additive balance top-up, delete guard (blocks if sales exist).

**Balance flow:** Add top-up (UI) → POS decrements on account payment → `cashService.cancelSale()` restores on cancellation.

### Sales (`modules/sales/sales.js`)

**Responsibility:** Read-only list with KPIs, detail modal, ticket reprint.

**Note:** Cancel button exists in permissions but is NOT wired in the UI.

### Dashboard (`modules/dashboard/dashboard.js`) ~536 LOC

**Responsibility:** KPIs, charts, smart alerts, recent sales table.

**Data:** Fetches sales, products, customers, sessions, movements, categories. Uses `cashService.getSummaryForSession()` for cash KPI. Auto-refreshes via `data:sales-changed` listener.

### Settings (`modules/settings/settings.js`)

**Responsibility:** App configuration, backup/restore, GitHub sync, storage quota.

### Reports (`modules/reports/reports.js`)

**Responsibility:** Analytics charts, top products, payment method breakdown. Uses dynamic `PAYMENT_METHODS` (R3 fix).

### Shop (`modules/shop/shop.js` + `shopCheckout.js`)

**Responsibility:** Customer-facing e-commerce. Sends WhatsApp message (no online payment).

### Users (`modules/users/users.js`)

**Responsibility:** User CRUD with password hashing.

### Payment Methods (`modules/payment-methods/paymentMethods.js`)

**Responsibility:** Configure enabled payment methods.

---

## NIVEL 5 — Business Processes

### 1. Sale Flow

```
POS.loadProducts()
  └─ Requires active cash session (cashService.requireActiveSession)

Customer interaction:
  1. addToCart(productId) — stock guard: rejects if stock <= 0 or qty >= stock
  2. removeFromCart(index) — decrements or removes
  3. setDiscount(type, value) — percent or fixed
  4. _renderPaymentUI() — multi-method payment interface
  5. _updatePaymentSummary() — validates paid vs remaining

confirmSale():
  Step 1: VALIDATE (_validateSale)
    ├─ _isProcessing guard (prevents double-submit)
    ├─ Cart empty → error
    ├─ No active cash session → error
    ├─ validatePayments(payments, total) — sum must match within $0.01
    ├─ Account payment → requires customer + sufficient balance
    └─ Stock check per item → error with remaining qty

  Step 2: BUILD (_buildSaleObject)
    ├─ generateSaleId() → S-YYYY-NNNNNN
    ├─ items array from cart
    ├─ paymentType: SIMPLE (1 method) or COMBINADO (multi)
    └─ sessionId, userId, timestamps

  Step 3: PERSIST (saleRepo.create)
    └─ If fails → show error, abort

  Step 4: INNER TRY (rollback-capable)
    ├─ saleItemRepo.create × N items (SI-{saleId}-{index})
    ├─ productRepo.update (stock--) × N items
    ├─ customerRepo.update (balance--) if account payment
    ├─ cashService.recordSale(sale) — one movement per payment method
    │
    └─ ON FAILURE:
        ├─ productRepo.update (stock++) — restore stock
        ├─ customerRepo.update (balance++) — restore balance
        └─ saleRepo.delete(saleId) — remove orphan sale

  Step 5: SUCCESS
    ├─ state.emit('sale:created')
    ├─ state.emit('data:sales-changed')
    ├─ Toast.success
    ├─ showTicket(sale) — receipt modal
    └─ Reset cart, discount, payments, customer

  Step 6: FINALLY
    └─ _isProcessing = false, re-enable button
```

### 2. Cash Session Lifecycle

```
OPEN:
  cashService.openSession(initialAmount, observation)
    ├─ Validates no session already open
    ├─ Validates initialAmount >= 0
    ├─ Creates session record (id: session_{timestamp})
    ├─ Creates 'opening' cash movement
    └─ Sets this.currentSession

ACTIVE (during operation):
  ├─ POS calls cashService.recordSale(sale) — creates 'sale' movements per payment method
  ├─ Manual movements via cashService.addMovement(type, amount, desc)
  │   ├─ type: 'in' → positive movement (extra income)
  │   └─ type: 'out' → negative movement (extra expense)
  └─ Summary recalculated on demand:
      expectedTotal = initialAmount + manualIn - manualOut + cashSales

CLOSE:
  cashService.closeSession(finalAmount, observation)
    ├─ Validates session exists
    ├─ Validates finalAmount >= 0
    ├─ Computes full summary via getSessionSummary()
    ├─ Updates session with closedAt, finalAmount
    ├─ Creates closure record with difference = finalAmount - expectedTotal
    ├─ Clears this.currentSession
    └─ Best-effort: auto-export PDF
```

**Summary Formula:**

```
expectedTotal = initialAmount + manualIn - manualOut + cashSales
difference = finalAmount (real counted) - expectedTotal
```

Only cash payments affect the physical drawer. Transfers, debits, and account sales are tracked but don't affect the cash expected amount.

### 3. Sale Cancellation

```
cashService.cancelSale(sale)
  ├─ Gets active session
  ├─ Decomposes payments via getPayments(sale)
  ├─ For each payment method:
  │   └─ Creates 'cancellation' movement with NEGATIVE amount
  ├─ Updates sale status → 'cancelled'
  ├─ Emits 'data:sales-changed'
  ├─ Restores stock (productRepo.update for each item)
  ├─ Restores account balance (customerRepo.update) + emits 'data:customers-changed'
  └─ Emits 'data:sales-changed'
```

**Note:** Cancel button NOT wired in Sales UI — only accessible programmatically. Both admin and cajero roles have `cancel_sale` permission.

### 4. Account Balance Flow

```
ADD CREDIT (Customers module):
  openAddBalance(customer)
    ├─ newBalance = customer.balance + amount
    ├─ customerRepo.update()
    └─ Emits 'data:customers-changed'

USE CREDIT (POS → confirmSale):
  ├─ Account payment in payments array
  ├─ Validates customer selected + sufficient balance
  ├─ customerRepo.update(customerId, { balance: customer.balance - amount })
  └─ Balance decremented as part of sale inner try block

REVERSE CREDIT (cashService.cancelSale):
  ├─ Finds account payment in sale payments
  ├─ customerRepo.update(customerId, { balance: customer.balance + amount })
  └─ Emits 'data:customers-changed'
```

**Note:** There is no UI to subtract balance directly. Subtraction only happens through POS sale or is reversed by cancellation.

### 5. Backup & Restore

```
AUTO-BACKUP (every 5 minutes):
  backupManager.startAutoBackup(300000)
    ├─ Gathers all 12 IndexedDB stores
    ├─ Computes SHA-256 checksum
    ├─ Compares with last snapshot hash
    ├─ Only creates snapshot if hash differs (change detection)
    └─ Keeps max 20 snapshots

MANUAL SNAPSHOT:
  backupManager.createSnapshot(label, type)
    ├─ Gathers all data
    ├─ SHA-256 checksum
    ├─ Creates snapshot record with data + summary
    └─ Cleans old snapshots (max 20)

RESTORE FROM SNAPSHOT:
  backupManager.restoreSnapshot(id)
    ├─ Loads snapshot
    ├─ Verifies SHA-256 checksum integrity
    ├─ Clears each store
    └─ Re-inserts all items from snapshot

IMPORT FROM JSON FILE:
  backupManager.importFromFile(file)
    ├─ Creates pre-import snapshot (safety net)
    ├─ Validates file structure (known store names, arrays)
    ├─ Clears + re-inserts each store
    └─ Creates post-import snapshot

EXPORT JSON:
  exportDatabase()
    ├─ Reads all 13 stores
    ├─ Creates Blob with JSON content
    └─ Triggers browser download (pos-backup-{date}.json)

GITHUB SYNC:
  ├─ Uploads to: backups/syntra-backup-{timestamp}.json
  ├─ Overwrites: backups/latest.json
  └─ Config: token, owner, repo, autoSync (fire-and-forget)
```

### 6. Product Lifecycle

```
CREATE:
  products.openModal(null)
    ├─ Validates via validateProduct()
    ├─ Resizes image to 200×200 (Base64 JPEG)
    ├─ productRepo.create()
    └─ Emits 'data:products-changed'

EDIT:
  products.openModal(product)
    ├─ Same as create but with productRepo.update()
    └─ Emits 'data:products-changed'

STOCK ADJUSTMENT:
  products.openStockAdjustModal(product)
    ├─ newStock = product.stock + qty (positive or negative)
    ├─ Guards against newStock < 0
    └─ productRepo.update()

DELETE:
  products.deleteProduct(id)
    ├─ Checks sale history via saleItemRepo.query()
    ├─ If sales exist → soft-delete (inactive: true, visible: false)
    └─ If no sales → hard delete via productRepo.delete()
    └─ Emits 'data:products-changed'

POS STOCK DEDUCTION:
  confirmSale() inner try block
    ├─ productRepo.update(product.id, { stock: product.stock - quantity })
    └─ On failure → rolls back (stock++)
```

### 7. Inter-Module Communication Map

```
                    ┌──────────────────────────────────┐
                    │        STATE EVENT BUS            │
                    └──┬─────┬─────┬─────┬─────┬──────┘
                       │     │     │     │     │
    data:products ─────┤     │     │     │     ├──── data:categories
    data:customers ────┤     │     │     │     ├──── data:settings
    data:sales ────────┤     │     │     │     ├──── data:payment-methods
                       │     │     │     │     │
                       v     v     v     v     v
                  ┌─────────────────────────────────┐
                  │  POS ←→ Products ←→ Customers   │
                  │       ↕            ↕            │
                  │    Cash Service   Dashboard     │
                  │       ↕                         │
                  │    Cash UI    Reports            │
                  └─────────────┬───────────────────┘
                                │
                                v
                    ┌───────────────────────┐
                    │    IndexedDB (14)      │
                    └───────────────────────┘
```

**Critical dependency chains:**

1. **Sale creation:** POS → saleRepo → saleItemRepo → productRepo (stock--) → customerRepo (balance--) → cashService (movements)
2. **Sale cancellation:** cashService → cashMovementRepo (negative) → saleRepo (status) → productRepo (stock++) → customerRepo (balance++)
3. **Cash lifecycle:** openSession → movements accumulate → closeSession → closure record with difference calculation

---

## Appendix: Lint & Test Status

| Metric          | Value                                           |
| --------------- | ----------------------------------------------- |
| ESLint errors   | 0                                               |
| ESLint warnings | 144 (mostly `curly` and `no-case-declarations`) |
| Unit tests      | 148 passing                                     |
| Test duration   | ~335ms                                          |
