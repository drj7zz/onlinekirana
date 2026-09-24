# OnlineKirana — Technical Documentation

Engineering reference for the OnlineKirana marketplace: architecture, data model,
security posture, API surface and the reasoning behind key decisions.

---

## 1. Architecture

```
┌──────────────────────┐        HTTPS / JSON (Bearer JWT)        ┌───────────────────────┐
│  React SPA (Vite)    │  ─────────────────────────────────────▶ │  Express REST API      │
│  client/  :5173      │  ◀───────────────────────────────────── │  server/  :5000        │
│  • React Router      │                                         │  • Controllers         │
│  • Context (Auth/Cart)│                                        │  • Mongoose models     │
│  • axios instance    │        static files  /uploads/*         │  • Multer disk storage │
└──────────────────────┘  ◀───────────────────────────────────── └──────────┬────────────┘
                                                                            │
                                                                    MongoDB (local / Atlas)
```

- **Client** is a Single Page Application — all routing is client-side; it talks to the
  API over JSON and authenticates with a Bearer token.
- **Server** is a stateless REST API. All state lives in MongoDB; nothing is stored on
  the API process except the in-memory rate-limit buckets.
- **Uploads** are written to disk under `server/uploads/` and served statically. This
  keeps the app dependency-light but means the uploads folder must be a persistent
  volume in any containerized/cloud deployment (see §9).

---

## 2. Stack

### Backend (`server/`)
| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js (CommonJS) | 18+ |
| Web framework | Express | ^4.19 |
| Database | MongoDB via Mongoose | ^8.4 |
| Auth | jsonwebtoken (JWT) | ^9.0 |
| Password hashing | bcryptjs | ^2.4 |
| File uploads | multer (disk storage) | ^2.4 |
| CORS | cors | ^2.8 |
| Env config | dotenv | ^16.4 |
| Dev runner | nodemon | ^3.1 |

### Frontend (`client/`)
| Layer | Choice | Version |
|---|---|---|
| UI library | React | ^18.3 |
| Build tool | Vite | ^5.3 |
| Routing | react-router-dom | ^6.24 |
| HTTP client | axios | ^1.7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + hand-written CSS | ^4.3 |
| React plugin | @vitejs/plugin-react | ^4.3 |

> Styling is a **hybrid**: Tailwind v4 is wired through the Vite plugin
> (`@import "tailwindcss";` in `src/styles.css`), while a bespoke stylesheet provides the
> theme palette (greens), layout container and component classes. This keeps utility
> classes available for newer components without a full Tailwind migration.

### Data & services
- **MongoDB** — local (`mongodb://127.0.0.1:27017/onlinekirana`) or **MongoDB Atlas**.
- **Payments** — COD and eSewa are modelled as order options (`paymentMethod`).
  eSewa is currently recorded as a preference, not an integrated live gateway.
- **Image hosting** — local disk; URLs are resolved by a small client helper (§7).

---

## 3. Repository layout

```
onlinekirana/
├── server/
│   ├── server.js              app bootstrap, middleware wiring, Mongo connect
│   ├── controllers/           authController, authController2, productController,
│   │                          adminProductController, orderController, partnerController,
│   │                          shopController, reviewController, dashboardController,
│   │                          profileController, uploadController
│   ├── models/                User.js · Product.js · Order.js · Review.js
│   ├── routes/                one router per resource (see §6)
│   ├── middleware/
│   │   ├── auth.js            JWT verification → req.user
│   │   ├── validate.js        input cleaning + password/phone/email policy
│   │   ├── rateLimit.js       in-memory sliding-window limiter
│   │   └── upload.js          multer disk storage, per-kind folders
│   ├── utils/errors.js        serverError(): never leaks internals
│   ├── scripts/
│   │   ├── createAdmin.js     npm run seed-admin
│   │   └── findRsName.js      helper script
│   ├── uploads/               avatars · shops · products  (gitignored content)
│   └── .env                   secrets (gitignored)
└── client/
    ├── index.html
    ├── vite.config.js         react + tailwind plugins, port 5173
    └── src/
        ├── main.jsx           providers: Router → Auth → Cart → App
        ├── App.jsx            all routes + RoleGuard wrappers
        ├── api.js             axios instance, token store, imageUrl()
        ├── context/           AuthContext · CartContext
        ├── hooks/useLive.js   visibility-aware polling
        ├── components/        Navbar, Footer, ProductCard, ReviewSection,
        │                      ImageUpload, RoleGuard, AccessDenied, OrderCard,
        │                      PasswordSecurity
        ├── pages/             Home, ProductDetail, Cart, Checkout, Orders,
        │                      Login, Register, Profile, Shop, ShopSetup, Partners,
        │                      Dashboard, AdminProducts, AdminOrders, AdminPartners,
        │                      Info, NotFound
        └── styles.css         Tailwind import + theme CSS
```

---

## 4. Data model (Mongoose)

### User (`models/User.js`)
| Field | Type | Notes |
|---|---|---|
| `name`, `email`, `password` | String | `email` unique + lowercased; password bcrypt-hashed (10 rounds) |
| `phone` | String | optional, Nepali mobile |
| `address` | `{ line, ward, city='Birgunj' }` | delivery default |
| `avatarUrl` | String | uploaded avatar |
| `role` | enum | `customer` \| `merchant` \| `admin` (default `customer`) |
| `shopName` | String | merchant only |
| `merchantStatus` | enum | `pending` \| `approved` \| `suspended` |
| `shopDescription` / `shopPhone` / `shopLogoUrl` | String | public shop profile |
| `shopAddress` | `{ line, ward, city='Birgunj' }` | public shop address |
| `createdAt` / `updatedAt` | Date | timestamps |

Hooks: `pre('save')` hashes the password when modified; `comparePassword()` for login.

### Product (`models/Product.js`)
| Field | Type | Notes |
|---|---|---|
| `name`, `description`, `category` | String | `category` indexed |
| `price` | Number | NPR per unit, min 0 |
| `unit` | String | kg, litre, packet, piece… |
| `stock` | Number | min 0 |
| `imageUrl` | String | |
| `discountPercent` | Number | 0–90 |
| `isActive` | Boolean | soft on/off |
| `merchant` | ObjectId → User | `null` = listed by admin |
| `status` | enum | `pending` \| `approved` \| `rejected` |

- Text index: `{ name, category }`.
- Virtual **`finalPrice`** = `price × (1 − discountPercent/100)`, rounded to 2dp.
  Because `.lean()` strips virtuals, `productController` recomputes it manually.

### Order (`models/Order.js`)
| Field | Notes |
|---|---|
| `user` | ObjectId → User |
| `items[]` | `{ product, merchant, name, price, qty, unit }` — **price snapshot at order time** |
| `total` | Number, server-computed |
| `deliveryAddress` | `{ line, city='Birgunj', ward, phone }` |
| `paymentMethod` | `cod` \| `esewa` |
| `status` | `pending → confirmed → packed → out_for_delivery → delivered` \| `cancelled` |

Storing `merchant` and `price` **inside each item** lets merchants query "orders that
contain my products" and preserves the historical price even if the product changes.

### Review (`models/Review.js`)
| Field | Notes |
|---|---|
| `product`, `user` | ObjectIds; **unique compound index** → one review per user per product |
| `name` | snapshot of author name |
| `rating` | 1–5 |
| `comment` | ≤ 800 chars |
| `verified` | true when the user has a **delivered** order containing the product |

---

## 5. Authentication & authorization

**Flow**
1. `POST /api/auth/register` or `/login` → server signs a JWT:
   `jwt.sign({ id, role, name }, JWT_SECRET, { expiresIn: '7d' })`.
2. Client stores the token (via `setToken`) and attaches it as
   `Authorization: Bearer <token>` on every request (axios request interceptor).
3. `middleware/auth.js` verifies the token and sets `req.user = { id, role, name }`.
4. Route-level guards enforce roles.

**Role guards**
- **Admin** — `requireAdmin` on `/api/admin/*` (server.js) and on admin-only order routes.
- **Merchant** — `c.requireMerchant` on all of `/api/partner/*`.
- **Client side** — `<RoleGuard role="…">` wraps protected pages; unauthenticated or
  wrong-role users see a friendly `AccessDenied` gate (no internals leaked).

**Registration safety** — `role` can only resolve to `merchant` or `customer`; any other
value (including `admin`) is discarded by the validator. Admin is seeded only via script.

**Session handling on the client** (`api.js`)
- Token persisted in `localStorage` (`ok_token`); user in `ok_user`.
- Response interceptor: a `401` on a request that *carried* a token clears the session
  and redirects to `/login` — a wrong password on the login page does not wipe state.

---

## 6. API reference

Base URL `/api`. Auth: `Authorization: Bearer <token>`.

| Resource | Base | Highlights |
|---|---|---|
| Auth | `/api/auth` | `POST /register`, `POST /login`, `POST /password-strength` |
| Products | `/api/products` | `GET /` (`search,category,sort,min,max`), `GET /categories`, `GET /:id` |
| Shops | `/api/shops` | `GET /`, `GET /:id` (public shop + live products) |
| Reviews | `/api/reviews` | `GET /product/:productId`, `POST /product/:productId`, `DELETE /:id` |
| Orders | `/api/orders` | `POST /` (customer), `GET /mine`, `GET /` (admin), `PATCH /:id/status` (admin) |
| Partner | `/api/partner` | shop `GET/PUT`, products `GET/POST/PUT/DELETE`, orders `GET`, `PATCH /orders/:id/status` |
| Admin — products | `/api/admin/products` | `GET/POST/PUT/DELETE` |
| Admin — partners | `/api/admin/partners` | `GET /`, `PATCH /:id/status`, `GET /pending-products`, `PATCH /products/:id/review` |
| Profile | `/api/profile` | `GET`, `PUT /`, `PUT /password` |
| Dashboard | `/api/dashboard` | `GET /` — role-shaped stats |
| Uploads | `/api/uploads` | `POST /avatar`, `POST /shop-logo`, `POST /product` |
| Health | `/api/health` | `{ ok: true, city: 'Birgunj' }` |

**Response conventions**
- Errors return JSON `{ message }` (plus `errors{}` on validation failures).
- Unknown `/api/*` paths → `404 { message: "Not found" }` (never an HTML page).
- A global error handler logs the real stack server-side but returns a generic message.
- `utils/errors.serverError()` whitelists a few safe messages (`"Product not found"`,
  `"Order not found"`, …) and otherwise hides DB/query details — especially in production.

**Rate limits** (`middleware/rateLimit.js`, in-memory)
- Login per **IP**: 20 requests / 15 min.
- Login per **account** (email): 6 requests / 15 min.
- Over the limit → `429` with `Retry-After`.
- Note: in-memory buckets are per-process; use a shared store (Redis) if you scale horizontally.

---

## 7. Frontend architecture

**Providers** (`main.jsx`): `BrowserRouter → AuthProvider → CartProvider → App`.

- **AuthContext** — holds `user`, exposes `login`, `register`, `logout`, `updateUser`.
  Restores the session from `localStorage` on load and merges fresh profile/shop data
  after edits.
- **CartContext** — in-memory cart `[{ product, qty }]` with `add`, `updateQty`, `remove`,
  `clear`, and memoized `count` / `total`. Quantity is clamped to available stock; the
  cart uses `finalPrice` when present. The cart is intentionally **not** persisted.
- **useLive(fn, intervalMs)** — visibility-aware polling: runs immediately, then on an
  interval, pausing when `document.visibilityState !== 'visible'`. Gives "live" order and
  stock updates without a page refresh or a websocket server.
- **api.js** — axios instance (`baseURL = VITE_API_URL || http://localhost:5000` + `/api`),
  request interceptor for the bearer token, response interceptor for `401`, and an
  `imageUrl()` helper that normalises every stored image value (absolute URL, `data:`,
  `/uploads/…`, bare filename) into a loadable URL or `null`.

**Routing** (`App.jsx`) — public pages plus `RoleGuard`-protected pages for
`customer` (`/checkout`, `/orders`), `merchant` (`/partners`, `/shop-setup`) and
`admin` (`/admin/*`).

---

## 8. Key behaviors & business rules

- **Server-authoritative checkout** (`orderController.place`): on order, the server
  re-reads each product from the DB, rejects unavailable items, verifies stock, and
  recomputes `price = round(price × (1 − discount/100))` and `total`. Client prices are
  never trusted. Stock is then decremented with `$inc: { stock: -qty }`.
- **Moderation lifecycle**: a merchant's new product is created with `status: 'pending'`.
  The public catalogue only shows `isActive: true, status: 'approved'`.
  A merchant edit that changes name/category/price/discount/image reverts status to
  `pending`; **stock-only** updates stay live.
- **Partner application**: a merchant registers with `merchantStatus: 'pending'`; the
  public shop page exists only once the admin approves (`merchantStatus === 'approved'`).
- **Partner order control**: partners may set status only to
  `packed`, `out_for_delivery`, `delivered`, and only on orders containing their items.
- **Review verification**: `POST /reviews/product/:id` upserts the caller's review; the
  `verified` flag is derived from a delivered order containing that product.
- **Ratings** are aggregated per product (average + count + 5→1 breakdown) and attached
  to list and detail responses.
- **Related products**: the product detail endpoint returns up to 4 same-category items.

---

## 9. Security

| Area | Approach |
|---|---|
| Password storage | bcryptjs, 10 rounds; never returned in API responses |
| Password policy | 8–72 chars, upper+lower+digit+symbol; rejects common words, the user's name and email local-part (`validate.js`) |
| Login enumeration | Uniform failure message + a dummy bcrypt compare so timing does not reveal whether the email exists |
| Brute force | Per-IP and per-account rate limiting on login |
| Input sanitisation | `cleanStr()` strips `<`/`>` and trims/length-caps; email/phone/name regexes |
| Role escalation | `role` can only become `merchant`; admin is seeded offline |
| Error leakage | `serverError()` + global handler never expose stack/DB details |
| Uploads | mime allow-list (`jpeg/png/webp`), 3 MB cap, randomised filenames, per-kind folders |
| CORS | Restricted to `CLIENT_URL` (falls back to `*` if unset) |
| Secrets | `.env` is gitignored; never commit real `MONGO_URI` / `JWT_SECRET` |

**Production checklist**
- Replace every default secret and the seeded admin password.
- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and a real `CLIENT_URL`.
- Serve over HTTPS; consider httpOnly-cookie sessions if XSS is a concern (token is
  currently in `localStorage`).
- Move uploads to object storage (S3/Cloudinary) or mount a persistent volume.
- Back the rate limiter with Redis if running more than one instance.

---

## 10. Local development & deployment

**Dev**
```bash
# terminal 1
cd server && npm install && npm run dev      # :5000
# terminal 2
cd client && npm install && npm run dev      # :5173
```
The client defaults to `http://localhost:5000` for the API; override with
`VITE_API_URL` in `client/.env`.

**Production build**
```bash
cd client && npm run build                   # outputs client/dist
cd ../server && NODE_ENV=production npm start
```
Serve `client/dist` as static files and reverse-proxy `/api` and `/uploads` to the
Node process.

---

## 11. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | server | API port (default 5000) |
| `MONGO_URI` | server | MongoDB/Atlas connection string |
| `JWT_SECRET` | server | signs/verifies JWTs |
| `CLIENT_URL` | server | allowed CORS origin |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | server | consumed by `npm run seed-admin` |
| `DB_USER` / `DB_PASS` | server | Atlas credentials (informational; the full URI is in `MONGO_URI`) |
| `VITE_API_URL` | client | API base URL for the SPA |

> `server/.env` and `server/atlas-credentials.env` contain secrets — keep them out of
> version control. `atlas-credentials.env` in particular holds live database credentials;
> rotate them if they were ever exposed.

---

## 12. Known limitations & roadmap

- **eSewa** is recorded as a preference, not a live payment integration.
- **Rate limiting** and **"live" updates** are in-memory / polling — fine for a single
  city instance, but swap for Redis + WebSockets/SSE at scale.
- **Uploads** on local disk are not horizontally scalable.
- No automated test suite yet — a good next step is API tests (Jest + supertest) around
  checkout, moderation transitions and auth.
- Possible additions: order cancellation by customers, delivery zones/fees by ward,
  pagination on the catalogue, and admin analytics.