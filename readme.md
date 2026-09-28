# 🛒 OnlineKirana — Local Grocery Marketplace for Birgunj

A full-stack **MERN** grocery marketplace built for **Birgunj, Nepal**. It is a
**multi-vendor** store: local shopkeepers sign up as partners, list their products,
and an admin approves them before they go live. Customers browse, order, and track
delivery — all priced in **Nepali Rupees (रू)** with **ward-wise delivery** in Birgunj.

> **Nothing is hardcoded.** The store starts empty. Every product, shop, order and
> review lives in MongoDB and is created through the app itself.

---

## ✨ What makes it more than a basic store

| Capability | Detail |
|---|---|
| **Multi-vendor** | Merchants register, get approved, set up a public shop page, and manage their own products and orders. |
| **Admin moderation** | Admin approves partner applications and new/edited products before they appear in the shop. |
| **Split apps** | The storefront (`:5173`) is shoppers-only. Merchants, riders and operations get their own portal (`:5174`) with a separate sign-in, enforced server-side via the login `scope`. |
| **No paperwork** | No shop licence, PAN/VAT, citizenship or driving licence is required to join. A partner account is just a name, email, phone and password. |
| **Self-service sign-up** | Shopkeepers *and* riders both apply from the same form, picking their role. Both land `pending`; an admin approves from the delivery desk. |
| **One typeface** | Lato across both apps, loaded with preconnect so the render never waits on it. |
| **Verified reviews** | One review per user per product. A review is marked **verified** only if the buyer has a *delivered* order for that product. |
| **Role-based dashboards** | Same `/dashboard` route, three different views (customer / merchant / admin) rendered from one endpoint. |
| **Live-ish updates** | Lists re-fetch on an interval while the tab is visible — orders and stock update without a page refresh. |
| **Hardened auth** | Bcrypt hashing, JWT sessions, login rate-limiting (per IP *and* per account), password strength policy, timing-safe login. |
| **Server-authoritative pricing** | Prices, discounts and stock are always re-read from the DB on checkout — the client's numbers are never trusted. |
| **Image uploads** | Avatars, shop logos and product photos, validated by type and size and stored per-folder. |
| **Localized** | NPR currency, Birgunj wards, Nepali mobile number validation, COD & eSewa. |

---

## 👥 Roles

- **Customer** — browse, search, review, order, track status.
- **Merchant (Partner)** — pending → approved by admin, then manage a shop page, products and fulfilment.
- **Admin** — approves partners & products, manages the whole catalogue and every order.

New sign-ups can only become a **customer** or a **merchant** — the API ignores any
attempt to self-assign the `admin` role.

---

## 🚀 Quick start

**Prerequisites:** Node.js 18+, and either a local MongoDB or a free MongoDB Atlas cluster.

### 1. Backend (`/server`)

```bash
cd server
npm install
```

Create `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/onlinekirana   # or your Atlas connection string
JWT_SECRET=replace-with-a-long-random-string
# Allowed browser origins, comma-separated. Storefront :5173, partner portal :5174.
CLIENT_URL=http://localhost:5173,http://localhost:5174

# Used by the seed script
ADMIN_NAME=OnlineKirana Admin
ADMIN_EMAIL=admin@onlinekirana.com
ADMIN_PASSWORD=ChangeMe@123
```

Then:

```bash
npm run seed-admin     # creates/upgrades the admin account from .env
npm run dev            # API on http://localhost:5000
```

### 2. Storefront (`/client`)

```bash
cd client
npm install
npm run dev            # app on http://localhost:5173
```

Optionally set `VITE_API_URL` (e.g. in `client/.env`) if the API is not on `localhost:5000`.
`VITE_PARTNERS_URL` points at the partner portal (defaults to `http://localhost:5174`).

### 3. Partner portal (`/partners`)

Everything that is not a shopper lives here: merchant shops, the delivery fleet, and
the operations desk. It runs on its own port and shares core logic with the storefront
by importing directly from `../client/src`.

```bash
cd partners
npm install
npm run dev            # portal on http://localhost:5174
```

`VITE_API_URL` and `VITE_STOREFRONT_URL` are both configurable via `partners/.env`.

### 4. Populate the store

1. Log in as the admin **in the partner portal** (`http://localhost:5174`).
2. **Admin → Partners** — approve any merchant applications.
3. **Admin → Products** — approve merchant-submitted products, or add your own (rice, dal, sabzi, oil…).
4. Browse the store as a customer on `http://localhost:5173` and place a test order.

> ⚠️ **Change the admin password after first login.** Use a strong `JWT_SECRET` and set
> `CLIENT_URL` to your real origin before deploying.

---

## 🗺️ User flows

**Shopping**
`Home` → search / filter by category / sort → `Product detail` (+ reviews & related items) → `Cart` → `Checkout` (ward + phone, COD/eSewa) → `Orders` (live status).

**Partner onboarding**
`Register as merchant` → status *pending* → admin approves → `Shop Setup` (name, logo, description, address) → add products (*pending*) → admin approves → shop page live → fulfil orders.

**Order lifecycle**
`pending → confirmed → packed → out_for_delivery → delivered` (or `cancelled`).

**Merchant → rider handoff** (no phone calls at any step)
1. Customer orders from a shop and picks a slot.
2. The merchant taps **Mark packed** — the shopkeeper's *only* action. This kicks the auto-dispatcher.
3. The least-busy rider who is on shift is assigned automatically; the job goes to `assigned` and the merchant can see the rider's name and phone.
4. The rider taps **I've reached the shop** on arrival, then **Goods collected**.
5. The customer sees the order move to *On the way* from their own account.
6. At the door the rider reads out the customer's 4-digit hand-over code. Only that code completes the drop.

If no rider is free the job stays `pending` and any rider on shift can claim it. The pool is
re-drained automatically whenever capacity appears — when a rider comes on shift, when an admin
approves one, and when a rider finishes a job and frees a slot. A rider who marks a job `failed`
has it taken off them, the order returns to `packed`, and it is re-dispatched immediately.

---

## 🔌 API overview

Base URL: `/api`. All authenticated routes expect `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/register` | public | Create a customer, merchant **or rider** (never admin). Partner roles start `pending` |
| POST | `/login` | public | Rate-limited; returns JWT + user. Optional `scope`: `customer` (storefront) or `portal` (business app) — a role outside the scope is refused with 403 |
| POST | `/password-strength` | public | Powers the client password meter |

### Catalogue — `/api/products`
| Method | Route | Access |
|---|---|---|
| GET | `/?search=&category=&sort=&min=&max=` | public |
| GET | `/categories` | public |
| GET | `/:id` | public |

### Shops — `/api/shops`
| Method | Route | Access |
|---|---|---|
| GET | `/` | public (all approved shops) |
| GET | `/:id` | public (shop page + its live products) |

### Reviews — `/api/reviews`
| Method | Route | Access |
|---|---|---|
| GET | `/product/:productId` | public (list + rating summary) |
| POST | `/product/:productId` | user (create/update your own) |
| DELETE | `/:id` | author or admin |

### Orders — `/api/orders`
| Method | Route | Access |
|---|---|---|
| POST | `/` | customer (place order) |
| GET | `/mine` | customer |
| GET | `/` | admin (all orders) |
| PATCH | `/:id/status` | admin |

### Partner (merchant) — `/api/partner`
| Method | Route | Access |
|---|---|---|
| GET/PUT | `/shop` | merchant |
| GET/POST | `/products` | merchant |
| PUT/DELETE | `/products/:id` | merchant (own) |
| GET | `/orders` | merchant (orders with their items) |
| PATCH | `/orders/:id/status` | merchant (`packed`/`out_for_delivery`/`delivered`) |

### Admin — `/api/admin`
| Method | Route | Access |
|---|---|---|
| GET/POST/PUT/DELETE | `/products` | admin |
| GET | `/partners` | admin |
| PATCH | `/partners/:id/status` | admin (approve/suspend partner) |
| GET | `/partners/pending-products` | admin |
| PATCH | `/partners/products/:id/review` | admin (approve/reject product) |

### Profile · Dashboard · Uploads · Health
| Method | Route | Access |
|---|---|---|
| GET/PUT | `/api/profile`, PUT `/api/profile/password` | user |
| GET | `/api/dashboard` | user (role-shaped response) |
| POST | `/api/uploads/avatar`, `/shop-logo`, `/product` | user |
| GET | `/api/health` | public |

Static uploads are served from `GET /uploads/...`.

---

## 🗂️ Project structure

```
onlinekirana/
├── server/                 Express + MongoDB API
│   ├── controllers/        auth, products, orders, partners, shops, reviews, dashboard, uploads
│   ├── models/             User, Product, Order, Review (Mongoose)
│   ├── routes/             /api/* route definitions
│   ├── middleware/         auth (JWT), validate, rateLimit, upload (multer)
│   ├── utils/errors.js     safe, non-leaking error responses
│   ├── scripts/            createAdmin (npm run seed-admin)
│   └── uploads/            avatars · shops · products
├── client/                 React + Vite — the storefront (shoppers only, :5173)
│   ├── src/pages/          Home, ProductDetail, Cart, Checkout, Orders, Shop,
│   │                       Partners (public blog + join guide), Info…
│   ├── src/components/     Navbar, Footer, ProductCard, ReviewSection, ImageUpload,
│   │                       RoleGuard, AccessDenied, OrderCard, PasswordSecurity
│   ├── src/context/        AuthContext (session) · CartContext (cart)
│   ├── src/hooks/useLive.js
│   └── src/api.js          axios instance, token handling, image URL resolver
└── partners/               React + Vite — the business portal (:5174)
    ├── src/pages/          Home, Faq, Join, Login, Register (public)
    │                       Dashboard, ShopSetup, Products, Orders (merchant)
    │                       RiderDashboard (delivery)
    │                       AdminOrders, AdminProducts, AdminPartners, AdminDelivery (ops)
    ├── src/components/     Navbar, Footer, RequireRole
    └── vite.config.js      aliases @shared → ../client/src (no duplicated logic)
```

For a deeper look at the stack, data model, security and design decisions, see
**[TECHNICAL.md](./TECHNICAL.md)**.

---

## 🧭 Pages (routes)

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Store — search, filter, sort |
| `/product/:id` | public | Product detail, reviews, related |
| `/shop/:id` | public | Public merchant shop page |
| `/cart`, `/checkout` | cart / customer | Cart and checkout |
| `/orders` | customer | Order history + live status |
| `/partners` | public | Partner blog + join instructions |
| `/dashboard`, `/profile` | any | Role-aware overview, profile |
| `/login`, `/register` | public | Shopper accounts |
| `/about`, `/faq`, `/contact` | public | Info |

### Partner portal routes (`:5174`)

| Route | Access | Purpose |
|---|---|---|
| `/`, `/faq`, `/join` | public | Portal landing, FAQ, step-by-step join guide |
| `/register` | public | One form for both partner kinds — shop or rider |
| `/pending` | signed in | "Application received" notice, shown after sign-up |
| `/login` | public | Merchant, rider and admin sign-in (`scope: 'portal'`) |
| `/dashboard` | merchant, delivery, admin | Role-shaped overview |
| `/shop-setup`, `/products`, `/orders` | merchant | Shop page, catalogue, fulfilment |
| `/rider` | delivery | Shifts, open jobs, earnings |
| `/admin/orders`, `/admin/products`, `/admin/partners`, `/admin/delivery` | admin | Operations desk |

---

## 🛠 Scripts

| Location | Command | What it does |
|---|---|---|
| server | `npm run dev` | Start API with nodemon |
| server | `npm start` | Start API (production) |
| server | `npm run seed-admin` | Create/upgrade the admin user from `.env` |
| server | `npm run cleanup-test-accounts` | Dry run by default; `--apply` deletes throwaway test accounts and their data |
| client | `npm run dev` | Storefront dev server (`:5173`) |
| client | `npm run build` | Production build |
| client | `npm run lint` | ESLint (catches missing imports that only fail at runtime) |
| client | `npm run preview` | Preview the built app |
| partners | `npm run dev` | Partner portal dev server (`:5174`) |
| partners | `npm run build` | Production build |
| partners | `npm run lint` | ESLint |

> **Run `npm run lint` before shipping.** Vite does not type-check, so a missing
> import builds cleanly and then blanks the page in the browser. ESLint is the
> only thing that catches it earlier.

---

## 📝 Notes

- JWT sessions last **7 days**; expired/invalid tokens are cleared on the client automatically.
- Stock is decremented on order placement; checkout re-validates availability.
- Passwords must be 8+ chars with upper, lower, number and symbol, and avoid common/derived words.
- Phone numbers follow the Nepali mobile format (`98XXXXXXXX`).
