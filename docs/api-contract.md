# Delivery Order Tracker: API contract (what the frontend expects)

The frontend is finished, so the backend must return **exactly** these shapes.
All bodies are JSON. All field names are camelCase.

## Common rules

- **Auth header:** `Authorization: Bearer <token>` on every protected route (`api.js` adds it).
- **Errors:** every error returns `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
  The frontend shows `message` to the user, so write it for a person.
- A **401** on any protected route makes the frontend log the user out.
- **Ids:** order `id` = its order number (e.g. `"DOT-7K3P9Q"`). Courier `id` is a string.
  Every `:id` in a URL is the order `id`.
- **Status values:** `created`, `assigned`, `picked_up`, `on_the_way`, `delivered`, `failed`, `cancelled`.

## The order object

Returned by orders, deliveries and assignment routes:

```json
{
  "id": "DOT-7K3P9Q",
  "orderNumber": "DOT-7K3P9Q",
  "customerName": "Ahmed Ali",
  "customerPhone": "01012345678",
  "pickupAddress": "...",
  "deliveryAddress": "...",
  "deliveryLat": 30.04,
  "deliveryLon": 31.23,
  "addressVerified": true,
  "packageDetails": "2 boxes",
  "priority": "standard",
  "notes": "",
  "status": "assigned",
  "courierId": "c-1a2b3c",
  "courierName": "Mona Hassan",
  "createdAt": "2026-11-24T10:00:00.000Z",
  "updatedAt": "2026-11-24T10:05:00.000Z"
}
```

`priority` is `standard` or `express`. **Address check (Nominatim):**
- If Nominatim can't find the address, the order is rejected with 400.
- If Nominatim is down or slow (more than 3 seconds), the order is saved with `deliveryLat` and `deliveryLon` set to `null` and `addressVerified` set to `false`.

## Shared: authentication (S2, Malak)

| Method | Path | Sends | Success response | Errors |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password, turnstileToken }` | 200 `{ token, user: { id, fullName, email, role } }` | 400 missing fields · 401 `INVALID_CREDENTIALS` · 403 `BOT_CHECK_FAILED` |
| GET | `/api/auth/me` | none | 200 `{ user }` | 401 |
| GET | `/api/health` | none | 200 `{ status: "ok", runtime: "lambda" or "pc" }` | none |

`role` is `dispatcher` or `courier`. Never return the password hash.

## S1: Order Management (Meret), dispatcher only

| Method | Path | Sends | Success response | Errors |
|---|---|---|---|---|
| POST | `/api/orders` | `{ customerName, customerPhone, pickupAddress, deliveryAddress, packageDetails, priority, notes }` | 201 `{ order }` | 400 `VALIDATION_ERROR` (also when Nominatim cannot find the delivery address) |
| GET | `/api/orders?q=&status=&courierId=&date=YYYY-MM-DD` | none | 200 `{ orders: [order] }`, newest first, each with `courierName` | 400 |
| GET | `/api/orders/:id` | none | 200 `{ order }` | 404 `ORDER_NOT_FOUND` |
| PATCH | `/api/orders/:id` | the same fields as POST | 200 `{ order }` | 400 · 404 · 409 `ORDER_LOCKED` (not `created`/`assigned`) |
| PATCH | `/api/orders/:id/cancel` | none | 200 `{ order }`, status `cancelled` | 404 · 409 `ORDER_LOCKED` |

Validation, matching `orders.js`:
- `customerName`: at least 2 characters.
- `customerPhone`: matches `^\+?[0-9]{10,15}$`.
- Both addresses: at least 5 characters.
- `packageDetails`: at least 2 characters.
- `notes`: 500 characters or fewer.

`q` matches the order number or the customer name.

## S2: Couriers and Assignment (Malak), dispatcher only

| Method | Path | Sends | Success response | Errors |
|---|---|---|---|---|
| POST | `/api/couriers` | `{ fullName, email, password, phone, vehicleType }` | 201 `{ courier }` | 400 · 409 `EMAIL_TAKEN` |
| GET | `/api/couriers?q=&availability=` | none | 200 `{ couriers: [courier] }` | 400 |
| PATCH | `/api/couriers/:id` | `{ phone, vehicleType, availability, isActive }` | 200 `{ courier }` | 400 · 404 `COURIER_NOT_FOUND` |
| PATCH | `/api/orders/:id/assignment` | `{ courierId }` | 200 `{ order }`, status `assigned` | 400 · 404 · 409 `COURIER_UNAVAILABLE` / `ORDER_NOT_ASSIGNABLE` |
| DELETE | `/api/orders/:id/assignment` | none | 200 `{ order }`, status back to `created` | 404 · 409 `ORDER_NOT_ASSIGNABLE` |

The courier object:

```json
{
  "id": "c-1a2b3c",
  "fullName": "Mona Hassan",
  "email": "mona@dot.test",
  "phone": "01098765432",
  "vehicleType": "motorcycle",
  "availability": "available",
  "isActive": true,
  "activeOrders": 2
}
```

- `vehicleType` is `bike`, `motorcycle`, `car` or `van`.
- `availability` is `available` or `off_duty`.
- `activeOrders` counts this courier's orders in `assigned`, `picked_up` or `on_the_way`.
- Validation, matching `couriers.js`:
  - `fullName`: at least 2 characters.
  - `email`: a valid email address.
  - `password`: at least 8 characters.
  - `phone`: the same pattern as orders.
- **Assignment** is allowed only when:
  - the order status is `created`, `assigned` or `failed`,
  - the courier is `isActive` and `available`, and
  - the courier has fewer than `MAX_ACTIVE_ORDERS` (default 5) unfinished orders.
- A deactivated courier is logged out at once and cannot log in again (403 `ACCOUNT_DISABLED`).

## S3: Delivery Status and Tracking (Farah)

| Method | Path | Who | Sends | Success response | Errors |
|---|---|---|---|---|---|
| GET | `/api/deliveries` | courier | none | 200 `{ deliveries: [order] }`: this courier's orders in `assigned`, `picked_up` or `on_the_way` | 401 · 403 |
| PATCH | `/api/deliveries/:id/status` | courier (assigned only) | `{ status, note }` | 200 `{ order }` | 400 (`failed` needs a `note` of at least 3 characters) · 403 `NOT_ASSIGNED` · 404 · 409 `INVALID_TRANSITION` |
| GET | `/api/deliveries/:id/history` | dispatcher, assigned courier | none | 200 `{ history: [entry] }`, oldest first | 403 · 404 |
| GET | `/api/track/:orderNumber?turnstileToken=...` | public | none | 200 `{ order: { orderNumber, status, updatedAt, courierFirstName, history: [{ toStatus, createdAt }] } }` | 400 bad format · 403 `BOT_CHECK_FAILED` · 404 `ORDER_NOT_FOUND` |

**Allowed status moves** (the same as `NEXT_STEPS` in `deliveries.js`):

| From | Allowed to |
|---|---|
| `assigned` | `picked_up` |
| `picked_up` | `on_the_way`, `failed` |
| `on_the_way` | `delivered`, `failed` |

**The history entry:**

```json
{
  "fromStatus": "picked_up",
  "toStatus": "on_the_way",
  "note": "",
  "changedByName": "Mona Hassan",
  "createdAt": "..."
}
```

S1 (create, cancel), S2 (assign, unassign) and S3 (status changes) all add history entries.

**Tracking privacy:** the public response must not include the phone number, the full addresses or the courier's full name.
