# FERO Checkout

A mobile-first checkout built for the FERO Product Engineer take-home assignment. It includes a fixed cart, delivery options, promotion codes, VAT-inclusive pricing, mock payments and order confirmation.

## Stack

- **Backend:** PHP ^8.2 and Laravel 12 (tested with PHP 8.2.12 and Laravel 12.69.3).
- **Frontend:** React 19.3.0, TypeScript 6.0.3, Vite 8.3.1 and Tailwind CSS 4.3.3.
- **Local tooling:** tested with Composer 2.8.9, Node.js 22.16.0 and npm 10.9.2. Vite requires Node.js ^20.19.0 or >=22.12.0.

## Run locally

Start the backend and frontend in separate terminals, from the repository root.

**Backend**

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
```

In PowerShell, `Copy-Item .env.example .env` can be used in place of `cp`. The API runs at `http://127.0.0.1:8000` by default.

**Frontend**

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to Laravel, so both servers need to be running.

No database or migrations are needed. Orders and idempotency records are stored in `backend/storage/app/private/checkout-orders.json`, which is created on the first valid order attempt and ignored by Git. The supplied `.env.example` uses file-based sessions and cache and synchronous queues.

## Try the checkout

The cart is fixed for this exercise. Choose a country and shipping method, optionally apply a promotion, then enter an email address and one of these mock card numbers:

| Card number | Result |
| --- | --- |
| `4111111111111111` | Approved |
| `4000000000000002` | Declined |
| `4000000000000069` | Expired |

Other valid 16-digit card numbers are declined.

Promotion codes are trimmed and case-insensitive:

| Code | Behaviour |
| --- | --- |
| `WELCOME10` | 10% off when the product subtotal is at least €30 |
| `FREESHIP` | Free selected shipping method when the product subtotal is at least €25 |
| `VIP50` | Already redeemed; cannot be applied |

## API and implementation

- `POST /api/checkout/quote` calculates prices and delivery options.
- `POST /api/checkout/order` adds email and card number and requires a UUID `Idempotency-Key` header.

Both endpoints accept and return JSON. Form Requests validate input, and `CheckoutCalculator` calculates prices from server-side configuration using integer cents. Client-supplied prices are ignored. VAT is included in the total; Spain's free-standard-shipping threshold is checked after discounts.

`CheckoutOrderService` handles mock payments and stores orders and idempotency records in one JSON file. An exclusive file lock protects the idempotency check and write: the same key and validated request return the original response, while the same key with different data returns HTTP 409. Card numbers are not persisted or returned.

React cancels stale quote requests. It does not cancel order requests; after an unknown outcome, the user can retry with the same request body and idempotency key.

## Verification

Run the backend feature tests:

```sh
cd backend
php artisan test
```

Check the frontend:

```sh
cd frontend
npm run lint
npm run build
```

Backend tests cover pricing, VAT, shipping thresholds, promotions, invalid countries, mock payment outcomes, idempotency, manipulated client-side prices and the absence of card numbers from persisted data. Each order test uses its own temporary JSON file and does not touch the application's order store.

Manual browser and API checks also covered invalid input, concurrent repeated requests, checkout error and confirmation states, and responsive layout. No automated frontend tests were added within the timebox.

## Trade-offs and next steps

JSON storage keeps the exercise database-free, but its file lock serializes order writes and would not suit a multi-instance deployment. Payments are mocked; authentication, inventory and real payment processing are outside the scope of this assignment.

With more time, I would add end-to-end tests for the checkout flow, refine accessibility and responsive details, and make local setup more reproducible with Docker Compose. I would extract UI components if the checkout grew further.

## Time spent

Approximately 5–6 hours of active development, including setup, implementation, testing and documentation.