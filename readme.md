# 🛒 OnlineKirana — Online Grocery Marketplace, Birgunj

**Online Kirana Pvt. Ltd., Birgunj, Nepal** — a production e-commerce service connecting
local shopkeepers with customers in Birgunj. Customers browse, order and track delivery
in **Nepali Rupees (रू)**; merchants run their own shop pages and fulfilment; riders
deliver; an operations desk moderates the marketplace.

> **Status: Beta.** See the [Public Notice & Beta Service Announcement](#-official-public-notice--beta-service-announcement) at the bottom of this document.

**Live:** storefront `https://onlinekiranabirgunj.vercel.app` · partner portal
`https://onlinekirana-partners.vercel.app` · API `https://onlinekirana.onrender.com`

---

## 📑 Documentation map

| Document | Contents |
|---|---|
| **README.md** (this file) | Business overview, policies & regulations, official public notice, user flows, roadmap |
| **[TECHNICAL.md](./TECHNICAL.md)** | Architecture, stack, CI/CD pipeline, hosting, environment variables, file structure, data model, API reference, security, flowcharts |
| **[SECURITY.md](./SECURITY.md)** | Security policy and vulnerability reporting |

---

## ✨ What the service offers

| Capability | Detail |
|---|---|
| **Multi-vendor marketplace** | Local shopkeepers register, get approved, set up a public shop page, and manage their own products and orders. |
| **Admin moderation** | Admin approves partner applications and new/edited products before they appear in the shop. |
| **Separate business portal** | The storefront is shoppers-only. Merchants, riders and operations get their own portal with a separate sign-in, enforced server-side via the login `scope`. |
| **Dark & light themes** | Saved per user across both apps. |
| **Zero-paperwork onboarding** | No shop licence, PAN/VAT, citizenship or driving licence required — a partner account is just a name, email, phone and password. |
| **Rider choice** | A packed order is offered to on-shift riders; a rider must accept before customer contact details are revealed. |
| **Verified reviews** | One review per user per product; **verified** only if the buyer has a *delivered* order for that product. |
| **Notifications** | In-app notifications everywhere, plus optional browser push for order and approval updates. |
| **Server-authoritative pricing** | Prices, discounts and stock are always re-read from the database at checkout — client numbers are never trusted. |

---

## 👥 Roles

- **Customer** — browse, search, review, order, track status.
- **Merchant (Partner)** — pending → approved by admin, then manages a shop page, products and fulfilment.
- **Rider (Delivery partner)** — on-shift job acceptance, pickup, delivery with a hand-over code.
- **Admin** — approves partners & products, manages the catalogue and every order.

New sign-ups can only become a **customer** or a **merchant** — the API ignores any
attempt to self-assign the `admin` role. Admins are seeded only via script.

---

## 📜 Policies & regulations

### Payments policy

- **Direct Merchant QR Payments** — digital payments go **directly to the merchant's QR
  account**. The platform never holds or escrows customer funds.
- **Refund-style Direct Settlement** — if a paid order is cancelled, lost or refunded,
  the refund is settled back the same way it went out: the merchant refunds through the
  same channel the customer paid (merchant QR / cash), never from a platform-held
  balance. The platform facilitates and tracks every settlement until it reaches the
  customer.
- **Cash on Delivery** — cash is collected by the rider and transferred directly to the
  fulfilling merchant. Checkout does not accept online payment during the beta.

### Delivery policy

- Free delivery from **5 am to 10 pm**.
- **10 pm–midnight:** checkout may quote ₹10 per started *straight-line* kilometre from
  shop to customer, only when an approved rider is online and both location pins are
  available. The estimate is not a road-distance quote.
- **Mandatory Delivery OTP** — customers inspect their items and complete payment
  **before** sharing the 4-digit hand-over code. Riders cannot mark an order
  Delivered/Returned without it.
- One order contains products from **one seller** only.

### Cancellation policy

- Customers may cancel any time **before rider pickup**. Pre-packing cancellations do
  not count against the customer.
- Packed/assigned cancellations count in a rolling **30-day window**: the second
  triggers a warning, the third **pauses new orders for 7 days**.
- System, shop and rider failures are excluded. Admin can restore ordering after review.

### Reviews policy

- One review per user per product (upserts allowed). A review is marked **verified**
  only when the buyer has a delivered order containing that product.

### Privacy & data

- Passwords are bcrypt-hashed and never returned by the API.
- Partner verification codes are stored only as SHA-256 hashes with expiry and
  attempt counters.
- Merchant pickup coordinates stay private; public shop listings omit them. Riders see
  customer name, phone and address only after accepting a job.
- Full details: [TECHNICAL.md § Security](./TECHNICAL.md) and [SECURITY.md](./SECURITY.md).

### Compliance notes

- The beta policy states no returns or refunds beyond the direct-settlement rule above.
  Obtain local legal review and publish a legally compliant returns policy before
  accepting real customers at scale.
- Regulatory registrations (company/PAN/VAT for the platform, applicable e-commerce and
  consumer-protection rules in Nepal) remain the operator's responsibility.

---

## 🗺️ User flows

**Shopping**
`Home` → search / filter / sort → `Product detail` (+ reviews & related) → `Cart` →
`Checkout` (address + phone + ward, COD) → `Orders` (live status).

**Partner onboarding**
`Register as merchant` → *pending* → admin approves → `Shop & profile` → product drafts
→ sync for admin approval → shop page live → accept and pack orders.

**Order lifecycle**
`pending → confirmed → packed → assigned → out_for_delivery → delivered` (or `cancelled`).

**Merchant → rider handoff**
1. Customer orders from a shop and picks a slot.
2. Merchant reviews the basket, taps **Accept order**.
3. Merchant packs and taps **Mark packed** — the job appears in the rider portal.
4. An on-shift rider taps **Accept order** (assignment only happens by choice; matching
   an area never auto-assigns).
5. Rider taps **I've reached the shop**, then **Goods collected**.
6. Customer sees the order move to *On the way*.
7. At the door the rider reads out the customer's 4-digit hand-over code. Only that code
   completes the drop.

Until a rider accepts, the job stays in the open list. Riders accept only while on shift
and below the active-order limit. A rider marking a job `failed` releases it back to the
open list.

---

## 🚦 Beta phase & migration

| Item | Detail |
|---|---|
| Beta window | **Nov 1 – Dec 31, 2026** at `onlinekiranabirgunj.vercel.app` |
| Commercial launch | **January 1, 2027** at `onlinekiranabirgunj.com.np` |
| Migration | All accounts and order histories migrate automatically |

---

## 🗺️ Roadmap / future updates

- Integrate a regulated online payment gateway (eSewa/Khalti) to replace COD-only checkout.
- Move uploads from local disk to object storage (S3/Cloudinary) for horizontal scaling.
- Back rate limiting with Redis across API instances; move "live" updates from polling
  to WebSockets/SSE.
- Automated test suite (Jest + supertest) around checkout, moderation transitions and auth.
- Delivery zones / fees by ward; catalogue pagination; admin analytics dashboard.
- Customer-initiated order cancellation flow with settlement tracking.
- Publish legally reviewed returns/refund and privacy policies before commercial launch.

---

---

# 📢 Official Public Notice & Beta Service Announcement

*(Readable text version of the official notice image shown at first visit in the app.
The signed original is displayed in the storefront popup — tap/scroll to zoom.)*

**PUBLIC NOTICE & BETA SERVICE ANNOUNCEMENT — Online Kirana**

Online Kirana is officially entering its controlled **Beta Testing Phase**, running from
**November 1, 2026 to December 31, 2026**, operating at
**onlinekiranabirgunj.vercel.app**.

The **official commercial launch** is on **January 1, 2027** at
**onlinekiranabirgunj.com.np**. All accounts and histories migrate automatically.

During the beta phase, please note the following service terms:

1. **Direct Merchant QR Payments** — digital payments go directly to the merchant's QR
   account. The platform does not hold or escrow funds.
2. **Refund-style Direct Settlement** — in the unlikely event a paid order is cancelled,
   lost or refunded, the refund is settled back the same way it went out: the merchant
   refunds through the same channel the customer paid (merchant QR / Cash-on-Delivery
   cash) — never a platform-held balance. The platform facilitates and tracks every
   settlement until it reaches your hands.
3. **Cash-on-Delivery** — cash is collected by the rider and transferred directly to the
   fulfilling merchant.
4. **Mandatory Delivery OTP** — inspect your items and complete payment before sharing
   your OTP. Riders cannot mark an order Delivered/Returned without it.

— **Dirghraj Giri**, Founder & Developer, **Online Kirana Pvt. Ltd., Birgunj**
