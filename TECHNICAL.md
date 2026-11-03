# OnlineKirana — Technical Documentation

Engineering reference for the OnlineKirana marketplace: architecture, stack, CI/CD
pipeline, hosting, environment variables, file structure, data model, flowcharts,
security posture, API surface and the reasoning behind key decisions.

Business overview, policies and the official public notice live in
**[README.md](./README.md)**.

---

## 0. Delivery pipeline & hosting

**Environments**

| Env | Storefront | Partner portal | API | Database |
|---|---|---|---|---|
| Local dev | `localhost:5173` | `localhost:5174` | `localhost:5000` | local Mongo / Atlas |
| Production | `onlinekiranabirgunj.vercel.app` | `onlinekirana-partners.vercel.app` | `onlinekirana.onrender.com` (Render) | MongoDB Atlas |

**CI/CD** — `.github/workflows/ci.yml` runs ESLint (`npm run lint` at the repo root:
client + partners) and the server tests on every push/PR; Vercel deploys the two
frontends automatically from the connected Git repo, Render deploys the API.

**Deploy flow**
```
git push → GitHub Actions (lint + tests)
        → Vercel build (vite build, VITE_API_URL baked in) → storefront + portal CDNs
        → Render deploy (NODE_ENV=production, npm start)     → API + static /uploads
```

`VITE_API_URL` is embedded in each frontend **at build time** — changing it requires a
rebuild/redeploy of both frontends. `PILOT_*` flags are API runtime flags and require
an API restart/redeploy.

**High-level request flow**
```
Browser (SPA) ── HTTPS JSON (Bearer JWT) ──▶ Express API ──▶ MongoDB Atlas
      │                                          │
      └── VAPID web push ◀───────────────────────┘
```

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
| Dev runner | Node.js `--watch` | built in |

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
- **Payments** — Cash on delivery is currently supported. eSewa is a legacy stored value only and new online payments are disabled until a gateway is integrated.
- **Pilot flags** — `PILOT_DELIVERY_ENABLED=true` enables free delivery from 5 am–10 pm and 10 pm–midnight delivery at ₹10 per started estimated kilometer when an approved rider is online. `PILOT_CANCELLATION_ENABLED=true` enables cancellation warnings and a 7-day ordering pause after three qualifying cancellations in 30 days. Both default off; use them for development/pitching only until policies are approved for a live service.
- **Distance estimate** — Late-night pricing uses straight-line distance between shop pickup and customer pins, rounded to 0.1 km and billed by started kilometer. It is not road distance. Merchant pickup coordinates are stored in `shopAddress.location`; customer pins are saved to the order and delivery. Public shop listings omit pickup coordinates, and riders receive customer details only after accepting a job.
- **Order constraints** — An order may contain one seller only. New checkout accepts COD (payment after delivery) only. Pilot cancellation counting excludes customer cancellations before packing and system/shop/rider failures; the admin can clear an active order restriction after review.
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
| `address` | `{ line, ward, city='Birgunj', location? }` | delivery default and optional customer pin |
| `avatarUrl` | String | uploaded avatar |
| `role` | enum | `customer` \| `merchant` \| `delivery` \| `admin` (default `customer`) |
| `emailVerified` | Boolean | Legacy-named gate; new partners complete the in-app code step, which does not establish email ownership |
| `emailVerificationCodeHash`, `emailVerificationExpires`, `emailVerificationAttempts` | String, Date, Number | Hashed 6-digit in-app code, 15-minute expiry, and per-code attempt counter |
| `shopName` | String | merchant only |
| `merchantStatus` | enum | `pending` \| `approved` \| `suspended` |
| `shopDescription` / `shopPhone` / `shopLogoUrl` | String | public shop profile |
| `shopAddress` | `{ line, ward, city='Birgunj', location? }` | address is public; pickup location remains private |
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
| `deliveryAddress` | `{ line, city='Birgunj', ward, phone, location? }` |
| `deliveryFee`, `deliveryDistanceKm` | Fee and straight-line estimate snapshots for this order |
| `paymentMethod` | `cod` only for new orders; `esewa` remains a legacy enum value |
| `cancelledBy`, `cancelledAt`, `cancellationCounted` | Cancellation audit and pilot abuse controls |
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

**Registration safety** — public registration permits only `customer`, `merchant`, or
`delivery`; any other value (including `admin`) is discarded by the validator. New
merchant and delivery-partner accounts must complete the in-app code step before
login or approval. This temporary step does not verify email ownership. Admin
is seeded only via script.

**Session handling on the client** (`api.js`)
- Token persisted in `localStorage` (`ok_token`); user in `ok_user`.
- Response interceptor: a `401` on a request that *carried* a token clears the session
  and redirects to `/login` — a wrong password on the login page does not wipe state.

---

## 6. API reference

Base URL `/api`. Auth: `Authorization: Bearer <token>`.

| Resource | Base | Highlights |
|---|---|---|
| Auth | `/api/auth` | `POST /register`, `POST /login`, `POST /verify-email`, `POST /resend-verification`, `POST /password-strength` |
| Products | `/api/products` | `GET /` (`search,category,sort,min,max`), `GET /categories`, `GET /:id` |
| Shops | `/api/shops` | `GET /`, `GET /:id` (public shop + live products) |
| Reviews | `/api/reviews` | `GET /product/:productId`, `POST /product/:productId`, `DELETE /:id` |
| Orders | `/api/orders` | `POST /` (customer), `GET /mine`, `GET /` (admin), `PATCH /:id/status` (admin) |
| Partner | `/api/partner` | shop `GET/PUT`, products `GET/POST/PUT/DELETE`, orders `GET`, `PATCH /orders/:id/status` |
| Admin — products | `/api/admin/products` | `GET/POST/PUT/DELETE` |
| Admin — partners | `/api/admin/partners` | `GET /`, `PATCH /:id/status`, `GET /pending-products`, `PATCH /products/:id/review` |
| Admin — integrations | `/api/admin/integrations` | `GET /` (Resend, Cloudinary and Redis health; admin only) |
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

**Rate limits** (`middleware/rateLimit.js`, Redis-backed with per-process memory fallback)
- Login per **IP**: 20 requests / 15 min.
- Login per **account** (email): 6 requests / 15 min.
- Partner verification-code issuance: 3 per email / hour and 12 per IP / hour.
- Partner code verification: 5 attempts per code and 30 requests per IP / hour.
- Admin-created riders: 6 per admin / hour and 3 code issuances per recipient / hour.
- Password changes: 5 per account / hour.
- Customer order placements: 8 per account / hour.
- Image uploads: 30 per account / hour.
- Integration health checks: 6 per admin / 15 min.
- Over the limit → `429` with `Retry-After`.
- Redis shares limits between API instances; the memory fallback is per-process.

**Temporary partner verification** uses a random six-digit in-app code. The
database stores only its SHA-256 hash, code expiry, and failed-attempt count.
The code is shown in the portal and reissue requires the application password.
This does not prove email ownership and is not suitable for identity
verification or account recovery. Resend is optional for registration and
checkout. Customer delivery codes remain in the authenticated order card after
the rider picks up the order. Application/status, product-review, order-progress
and password-change emails are optional Resend notifications; their failure
does not undo completed actions.

Admins can check Resend sender-domain status, Cloudinary API connectivity, and
Redis availability at `GET /api/admin/integrations`. This endpoint never returns
API credentials and is rate-limited.

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
- **api.js** — axios instance (`baseURL = VITE_API_URL` + `/api`; required at build time),
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
| CORS | Restricted to exact `CLIENT_URL` origins; production startup rejects missing or wildcard origins |
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
Set `VITE_API_URL=http://localhost:5000` in `client/.env` for local work. It is
required when building either web app; production values are baked into each
frontend bundle at build time.

**Production build**
```bash
cd client && npm run build                   # outputs client/dist
cd ../server && NODE_ENV=production npm start
```
Set `VITE_API_URL` in both frontend build environments to the public HTTPS API
origin, without a trailing `/api`. Rebuild and redeploy both frontends whenever
that value changes. Deploy the API separately with `NODE_ENV=production`, a
32-character `JWT_SECRET`, MongoDB access, and `CLIENT_URL` set to the exact
comma-separated HTTPS origins of the storefront and partner portal. The
`PILOT_DELIVERY_ENABLED` and `PILOT_CANCELLATION_ENABLED` settings are API runtime
flags; restarting/redeploying the API is required for changes to take effect.
After deployment, check `/api/health`, confirm API CORS allows both frontend
origins, and verify that late-night test orders quote the same fee as checkout.

---

## 11. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | server | API port (default 5000) |
| `MONGO_URI` | server | MongoDB/Atlas connection string |
| `JWT_SECRET` | server | signs/verifies JWTs |
| `CLIENT_URL` | server | allowed CORS origin |
| `GOOGLE_CLIENT_ID` | server | validates customer Google ID tokens |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | server | consumed by `npm run seed-admin` |
| `DB_USER` / `DB_PASS` | server | Atlas credentials (informational; the full URI is in `MONGO_URI`) |
| `VITE_API_URL` | client | API base URL for the SPA |
| `VITE_GOOGLE_CLIENT_ID` | client | enables the Google Identity Services button; use the same OAuth Web client ID as the API |
| `VITE_PARTNERS_URL` | client (storefront) | public URL of the partner portal |
| `VITE_STOREFRONT_URL` | partners | public URL of the storefront |
| `PILOT_DELIVERY_ENABLED` / `PILOT_CANCELLATION_ENABLED` | server | pilot feature flags (runtime; restart to apply) |
| `PLATFORM_PICKUP_LAT` / `PLATFORM_PICKUP_LNG` | server | pickup point for admin-listed products |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | server | browser web-push credentials (`npm run setup-push-keys` generates them) |
| `RESEND_API_KEY` | server | optional transactional email notifications |
| `CLOUDINARY_*`, `REDIS_URL` | server | optional integrations (uploads / shared rate-limit store) |

Google sign-in is customer-only. The API verifies Google ID tokens, requires a
verified email, links an existing customer account with the same email, and asks
new users to complete their shopper details. Add each storefront's exact origin
to the Google OAuth client's authorized JavaScript origins. Google-only users
can add a password later from their profile.

> `server/.env` holds live database credentials and the JWT secret — keep it out of
> version control and rotate both if they are ever exposed.

---

## 12. Known limitations & roadmap

- **eSewa** is not available for new orders until a verified payment gateway is integrated.
- **Rate limiting** and **"live" updates** are in-memory / polling — fine for a single
  city instance, but swap for Redis + WebSockets/SSE at scale.
- **Uploads** on local disk are not horizontally scalable.
- No automated test suite yet — a good next step is API tests (Jest + supertest) around
  checkout, moderation transitions and auth.
- Possible additions: order cancellation by customers, delivery zones/fees by ward,
  pagination on the catalogue, and admin analytics.

---

## 13. Hosting & operations

| Component | Host | Notes |
|---|---|---|
| Storefront SPA | Vercel (`onlinekiranabirgunj`) | static build of `client/`; `VITE_API_URL` + `VITE_PARTNERS_URL` baked at build time |
| Partner portal SPA | Vercel (`onlinekirana-partners`) | static build of `partners/`; shares code via `@shared → ../client/src` |
| REST API | Render (`onlinekirana`) | `NODE_ENV=production npm start`; persistent disk for `server/uploads` |
| Database | MongoDB Atlas | automated backups enabled; IP allowlist includes the Render egress |
| Push / email / cache | VAPID keys · Resend · Redis (optional) | configured via server env; health-checkable at `GET /api/admin/integrations` |

**Operational checks after each deploy**
1. `GET /api/health` returns `{ ok: true }`.
2. Both frontends load, sign-in works for each role.
3. CORS (`CLIENT_URL`) lists the exact HTTPS origins of both frontends.
4. Place one free-window test order and one late-night eligible order; confirm the
   checkout fee matches the saved order total.
5. Confirm uploads persist across API restarts (persistent disk or object storage).

---

## 14. Flowcharts

### Order lifecycle

```
place order ─▶ pending ─▶ confirmed (merchant accepts)
                    │            │
              (cancel)      mark packed ─▶ packed ─▶ rider accepts ─▶ assigned
                    │                                                │
                    ▼                                            out_for_delivery
               cancelled ◀── customer cancels before pickup          │
                                                             OTP verified at door
                                                                     ▼
                                                                 delivered
```

### Merchant → rider handoff

```
Customer order ─▶ Merchant Accept ─▶ Mark packed ─▶ job appears in rider open list
                                                        │
                                        on-shift rider taps Accept ◀── (else stays pending)
                                                        │
                                          Reached shop ─▶ Goods collected
                                                        │
                                          customer sees "On the way" ─▶ OTP handover ─▶ delivered
```

### Checkout (server-authoritative)

```
client cart ──▶ POST /api/orders ──▶ re-read products from DB
                                     ├─ unavailable / out of stock? → reject
                                     ├─ recompute price × discount, total
                                     ├─ decrement stock ($inc: -qty)
                                     └─ save order + delivery snapshot → notify merchant/rider
```

### Auth flow

```
register/login ─▶ validator (role, password, phone policy)
              ─▶ bcrypt compare / hash
              ─▶ JWT sign { id, role, name } 7d ─▶ localStorage (ok_token)
              ─▶ axios attaches Bearer token ─▶ middleware/auth.js sets req.user
              ─▶ role guards (requireAdmin / requireMerchant / RoleGuard)
```

---

## 15. File structure (authoritative)

```
onlinekirana/
├── .github/workflows/ci.yml   CI: lint (client + partners) + server tests
├── server/                    Express + MongoDB API (Render)
│   ├── server.js              bootstrap, middleware wiring, Mongo connect
│   ├── config/                delivery config (pilot flags, slots, rates)
│   ├── controllers/           auth, products, admin products, orders, partner,
│   │                          shop, review, dashboard, profile, delivery, upload
│   ├── models/                User, Product, Order, Review, Delivery,
│   │                          Notification, AuditEvent
│   ├── routes/                one router per resource under /api
│   ├── middleware/            auth (JWT), validate, rateLimit, roles,
│   │                          upload (multer), auditAdmin
│   ├── lib/                   email (Resend), emailNotifications, googleIdentity,
│   │                          piiCrypto, platform, productSearch, redis, tokens
│   ├── utils/                 errors (non-leaking), notifications, otp, privacy
│   ├── workers/tasks.js       background jobs
│   ├── scripts/               createAdmin, createRider, seedCatalog, dbStats,
│   │                          setupPushKeys, cleanupTestAccounts, fixMojibake
│   ├── test/                  googleIdentity, productSearch tests
│   └── uploads/               avatars · shops · products (persistent volume)
├── client/                    React + Vite storefront (Vercel, :5173 dev)
│   ├── public/                logo.png, notice.png, icons/, manifest, push-sw.js
│   ├── src/pages/             Home, Shop, ProductDetail, Cart, Checkout, Orders,
│   │                          Wishlist, CustomerAuth, Dashboard, Profile, Info,
│   │                          Login, Register, NotFound
│   ├── src/components/        Navbar, Footer, ProductCard, AddToCartButton,
│   │                          StickyCartBar, BottomTabs, BetaNoticeModal,
│   │                          NotificationCenter, ReviewSection, ImageZoom,
│   │                          SmartImage, ImageUpload, OrderCard, RoleGuard,
│   │                          AccessDenied, PasswordSecurity, Skeletons, Dropdown
│   ├── src/context/           AuthContext, CartContext, WishlistContext, ToastContext
│   ├── src/hooks/             useLive (polling), useSeo
│   ├── src/lib/               apps, catalog, delivery, pricing, productUrl, recent, theme
│   └── src/api.js             axios instance, token store, imageUrl()
└── partners/                  React + Vite business portal (Vercel, :5174 dev)
    ├── public/                logo.png, push-sw.js
    ├── src/pages/             public: Home, Faq, Join, Login, Register
    │                          merchant: Dashboard, ShopSetup, Products, Orders
    │                          rider: RiderDashboard
    │                          admin: AdminOrders, AdminProducts, AdminPartners,
    │                                 AdminDelivery, AdminAudit, AdminIntegrations
    ├── src/components/        Navbar, Footer, BottomTabs, RequireRole, WorkspaceHeader
    └── vite.config.js         aliases @shared → ../client/src (no duplicated logic)
```
