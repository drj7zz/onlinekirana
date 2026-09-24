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
CLIENT_URL=http://localhost:5173

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

### 2. Frontend (`/client`)

```bash
cd client
npm install
npm run dev            # app on http://localhost:5173
```

Optionally set `VITE_API_URL` (e.g. in `client/.env`) if the API is not on `localhost:5000`.

### 3. Populate the store

1. Log in as the admin.
2. **Admin → Partners** — approve any merchant applications.
3. **Admin → Products** — approve merchant-submitted products, or add your own (rice, dal, sabzi, oil…).
4. Browse the store as a customer and place a test order.

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
Merchants may advance only `packed → out_for_delivery → delivered` for orders containing their items.

---

## 🔌 API overview

Base URL: `/api`. All authenticated routes expect `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/register` | public | Create customer or merchant (never admin) |
| POST | `/login` | public | Rate-limited; returns JWT + user |
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
└── client/                 React + Vite SPA
    ├── src/pages/          Home, ProductDetail, Cart, Checkout, Orders, Shop,
    │                       ShopSetup, Partners, Dashboard, Admin*, Profile, Info…
    ├── src/components/     Navbar, Footer, ProductCard, ReviewSection, ImageUpload,
    │                       RoleGuard, AccessDenied, OrderCard, PasswordSecurity
    ├── src/context/        AuthContext (session) · CartContext (cart)
    ├── src/hooks/useLive.js
    └── src/api.js          axios instance, token handling, image URL resolver
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
| `/partners` | merchant | Partner hub |
| `/shop-setup` | merchant | Public shop profile |
| `/dashboard` | any (role-aware) | Role-specific overview |
| `/admin/products`, `/admin/orders`, `/admin/partners` | admin | Management |
| `/login`, `/register`, `/profile` | mixed | Account |
| `/about`, `/faq`, `/contact` | public | Info |

---

## 🛠 Scripts

| Location | Command | What it does |
|---|---|---|
| server | `npm run dev` | Start API with nodemon |
| server | `npm start` | Start API (production) |
| server | `npm run seed-admin` | Create/upgrade the admin user from `.env` |
| client | `npm run dev` | Vite dev server |
| client | `npm run build` | Production build |
| client | `npm run preview` | Preview the built app |

---

## 📝 Notes

- JWT sessions last **7 days**; expired/invalid tokens are cleared on the client automatically.
- Stock is decremented on order placement; checkout re-validates availability.
- Passwords must be 8+ chars with upper, lower, number and symbol, and avoid common/derived words.
- Phone numbers follow the Nepali mobile format (`98XXXXXXXX`).
