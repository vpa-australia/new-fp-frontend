# API Usage Guide

This document summarises the publicly exposed API routes under Laravel''s `/api` prefix and how to interact with them.

## Base URL

- All endpoints live under `https://<host>/api`.
- Append the paths below to the base URL when making requests.

## Authentication & Access Control

- **Sanctum token (Bearer):** Routes protected by `auth:sanctum` expect an `Authorization: Bearer <token>` header. Obtain a token via `POST /api/users/auth/login` and store it securely.
- **Key-only routes:** Routes using the `KeyOnly` middleware require a `key` query parameter with the static value `hdjJEFHJISu46dbduy47djJH8sHJashdy374jshd`.
- **Role restrictions:** User management endpoints further restrict actions to privileged roles (see `availableRoles` field in login/register responses). Ensure the authenticated user has the necessary permissions before calling admin-style operations.

#### Examples (JavaScript fetch)

```js
const baseUrl = "https://example.com/api";

// Static key for the KeyOnly middleware routes.
export const KEY_ONLY_VALUE = "hdjJEFHJISu46dbduy47djJH8sHJashdy374jshd";

export async function loginUser(email, password) {
  const res = await fetch(`${baseUrl}/users/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }
  const data = await res.json();
  localStorage.setItem("token", data.token);
  return data;
}

export function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}
```

## Common Conventions

- Unless noted otherwise, payloads are JSON and responses are JSON.
- Query strings such as `shipment_ids` expect comma-separated lists (e.g. `shipment_ids=4,6,10`).
- Identifiers are large; send them as strings when working in JavaScript to avoid precision loss.

## Endpoint Directory

### Cron Jobs (`/crons`, key required)

| Method | Path                | Description                                 | Key params     |
| ------ | ------------------- | ------------------------------------------- | -------------- |
| GET    | `/crons/unlProcess` | Process all orders and forward them to UNL. | `key` (string) |

#### Examples (JavaScript fetch)

```js
// Requires KEY_ONLY_VALUE from the authentication snippet.
export async function runUnlProcess() {
  const url = `${baseUrl}/crons/unlProcess?key=${encodeURIComponent(
    KEY_ONLY_VALUE
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Cron call failed: ${res.status}`);
  }
  return res.json();
}
```

### Product Inventory (`/product`, Sanctum)

| Method | Path                | Description                                             | Key params                                                |
| ------ | ------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| GET    | `/product/variants` | List Shopify product variants with out-of-stock status. | `shop`, `perPage`, `page`, `orderBy`, `reverse`, `search` |
| POST   | `/product/oos`      | Mark a SKU as out of stock in a warehouse.              | JSON body: `sku`, `warehouse_code`                        |
| DELETE | `/product/oos`      | Remove an out-of-stock flag.                            | JSON/query: `sku`, `warehouse_code`                       |

#### Examples (JavaScript fetch)

```js
export async function getProductVariants({
  shop,
  perPage = 15,
  page = 1,
  orderBy,
  reverse,
  search,
} = {}) {
  const params = new URLSearchParams();
  if (shop) params.set("shop", shop);
  if (perPage) params.set("perPage", String(perPage));
  if (page) params.set("page", String(page));
  if (orderBy) params.set("orderBy", orderBy);
  if (reverse) params.set("reverse", reverse);
  if (search) params.set("search", search);

  const res = await fetch(`${baseUrl}/product/variants?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Unable to fetch variants: ${res.status}`);
  }
  return res.json();
}

export async function markOutOfStock(sku, warehouseCode) {
  const res = await fetch(`${baseUrl}/product/oos`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sku, warehouse_code: warehouseCode }),
  });
  if (!res.ok) {
    throw new Error(`Failed to mark OOS (POST): ${res.status}`);
  }
  return res.json();
}

export async function clearOutOfStock(sku, warehouseCode) {
  const res = await fetch(`${baseUrl}/product/oos`, {
    method: "DELETE",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sku, warehouse_code: warehouseCode }),
  });
  if (!res.ok) {
    throw new Error(`Failed to clear OOS (DELETE): ${res.status}`);
  }
  return res.json();
}
```

### PDF Assets (`/pdf`, Sanctum)

| Method | Path                                                          | Description                                                | Key params                                                    |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/pdf/invoice/{id}`                                           | Download a single invoice PDF.                             | `id` path parameter                                           |
| GET    | `/pdf/invoices`                                               | Batch download invoices.                                   | `archive`, `shipment_ids`, `only_if_printed`                  |
| GET    | `/pdf/labels/quickPrint`                                      | Batch download shipping labels.                            | `archive`, `shipment_ids`, `include_already_printed`          |
| GET    | `/pdf/manifests/daily/{carrier_code}/{warehouse_code}/{date}` | Fetch a day''s postal manifests.                           | Path params: `carrier_code`, `warehouse_code`, `date (Y-m-d)` |
| GET    | `/pdf/packingList/{id}`                                       | Download a shipment packing list.                          | `id` path parameter                                           |
| PUT    | `/pdf/labels/generateLabels`                                  | Generate labels for the provided shipments (long-running). | `shipment_ids`                                                |
| DELETE | `/pdf/labels`                                                 | Delete labels for the provided shipments.                  | `shipment_ids`                                                |

#### Examples (JavaScript fetch)

```js
async function saveBlobResponse(res, filename) {
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadInvoicePdf(id) {
  const res = await fetch(`${baseUrl}/pdf/invoice/${id}`, {
    headers: authHeaders(),
  });
  await saveBlobResponse(res, `invoice-${id}.pdf`);
}

export async function downloadInvoices(
  shipmentIds,
  archive = 0,
  onlyIfPrinted = 0
) {
  const params = new URLSearchParams({
    archive: String(archive),
    shipment_ids: shipmentIds.join(","),
    only_if_printed: String(onlyIfPrinted),
  });
  const res = await fetch(`${baseUrl}/pdf/invoices?${params}`, {
    headers: authHeaders(),
  });
  await saveBlobResponse(res, "invoices.zip");
}

export async function downloadQuickLabels(
  shipmentIds,
  archive = 0,
  includePrinted = false
) {
  const params = new URLSearchParams({
    archive: String(archive),
    shipment_ids: shipmentIds.join(","),
    include_already_printed: String(includePrinted),
  });
  const res = await fetch(`${baseUrl}/pdf/labels/quickPrint?${params}`, {
    headers: authHeaders(),
  });
  await saveBlobResponse(res, "labels.zip");
}

export async function downloadDailyManifest(carrierCode, warehouseCode, date) {
  const res = await fetch(
    `${baseUrl}/pdf/manifests/daily/${carrierCode}/${warehouseCode}/${date}`,
    {
      headers: authHeaders(),
    }
  );
  await saveBlobResponse(res, `manifest-${warehouseCode}-${date}.pdf`);
}

export async function downloadPackingList(id) {
  const res = await fetch(`${baseUrl}/pdf/packingList/${id}`, {
    headers: authHeaders(),
  });
  await saveBlobResponse(res, `packing-list-${id}.pdf`);
}

export async function generateShipmentLabels(shipmentIds) {
  const params = new URLSearchParams({ shipment_ids: shipmentIds.join(",") });
  const res = await fetch(`${baseUrl}/pdf/labels/generateLabels?${params}`, {
    method: "PUT",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Label generation failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteShipmentLabels(shipmentIds) {
  const params = new URLSearchParams({ shipment_ids: shipmentIds.join(",") });
  const res = await fetch(`${baseUrl}/pdf/labels?${params}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Label deletion failed: ${res.status}`);
  }
  return res.json();
}
```

### Platform Metadata (`/platform`, Sanctum)

| Method | Path                                    | Description                       | Key params                                                                |
| ------ | --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/platform/carriers`                    | List configured carriers.         | -                                                                         |
| GET    | `/platform/packages`                    | List available package templates. | -                                                                         |
| GET    | `/platform/shops`                       | List connected shops.             | -                                                                         |
| GET    | `/platform/statuses`                    | List shipment statuses.           | -                                                                         |
| GET    | `/platform/warehouses`                  | List warehouses.                  | -                                                                         |
| PATCH  | `/platform/carriers/{carrier_code}`     | Update carrier metadata.          | Body keys: `description`, `max_parcel_weight`, `active`                   |
| PATCH  | `/platform/warehouses/{warehouse_code}` | Update warehouse metadata.        | Body keys: `description`, `international`, `international_rank`, `active` |

#### Examples (JavaScript fetch)

```js
export const listCarriers = () =>
  fetch(`${baseUrl}/platform/carriers`, { headers: authHeaders() }).then(
    (r) => {
      if (!r.ok) throw new Error(`Carrier list failed: ${r.status}`);
      return r.json();
    }
  );

export const listPackages = () =>
  fetch(`${baseUrl}/platform/packages`, { headers: authHeaders() }).then(
    (r) => {
      if (!r.ok) throw new Error(`Package list failed: ${r.status}`);
      return r.json();
    }
  );

export const listShops = () =>
  fetch(`${baseUrl}/platform/shops`, { headers: authHeaders() }).then((r) => {
    if (!r.ok) throw new Error(`Shop list failed: ${r.status}`);
    return r.json();
  });

export const listStatuses = () =>
  fetch(`${baseUrl}/platform/statuses`, { headers: authHeaders() }).then(
    (r) => {
      if (!r.ok) throw new Error(`Status list failed: ${r.status}`);
      return r.json();
    }
  );

export const listWarehouses = () =>
  fetch(`${baseUrl}/platform/warehouses`, { headers: authHeaders() }).then(
    (r) => {
      if (!r.ok) throw new Error(`Warehouse list failed: ${r.status}`);
      return r.json();
    }
  );

export async function updateCarrier(carrierCode, payload) {
  const res = await fetch(`${baseUrl}/platform/carriers/${carrierCode}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Carrier update failed: ${res.status}`);
  }
  return res.json();
}

export async function updateWarehouse(warehouseCode, payload) {
  const res = await fetch(`${baseUrl}/platform/warehouses/${warehouseCode}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Warehouse update failed: ${res.status}`);
  }
  return res.json();
}
```

### Shipments (`/shipments`, Sanctum)

#### Retrieval

| Method | Path                               | Description                                     | Key params                                                                                           |
| ------ | ---------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | `/shipments/{id}`                  | Retrieve a shipment with optional related data. | `id` (path), optional `columns`, `archive`                                                           |
| GET    | `/shipments/errors/{id}`           | Fetch errors for a shipment.                    | `id` (path)                                                                                          |
| GET    | `/shipments/search/parameters`     | List searchable shipment fields.                | -                                                                                                    |
| GET    | `/shipments/warehouse/{warehouse}` | Paginated shipments for a warehouse.            | `warehouse` (path), optional `archive`, `deleted`, `perPage`, `page`, `columns`, plus search filters |

#### Examples (JavaScript fetch)

```js
export async function getShipmentById(id, { columns, archive } = {}) {
  const params = new URLSearchParams();
  if (columns) params.set("columns", columns);
  if (archive !== undefined) params.set("archive", String(archive));

  const url = params.toString()
    ? `${baseUrl}/shipments/${id}?${params}`
    : `${baseUrl}/shipments/${id}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Shipment fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function getShipmentErrors(id) {
  const res = await fetch(`${baseUrl}/shipments/errors/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Shipment errors fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function getShipmentSearchParameters() {
  const res = await fetch(`${baseUrl}/shipments/search/parameters`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Search parameters fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function listShipmentsByWarehouse(warehouse, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });
  const url = params.toString()
    ? `${baseUrl}/shipments/warehouse/${encodeURIComponent(
        warehouse
      )}?${params}`
    : `${baseUrl}/shipments/warehouse/${encodeURIComponent(warehouse)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Warehouse shipment list failed: ${res.status}`);
  }
  return res.json();
}
```

#### Comments & Notes

| Method | Path                      | Description                     | Key params                       |
| ------ | ------------------------- | ------------------------------- | -------------------------------- |
| POST   | `/shipments/comment/{id}` | Append a comment to a shipment. | Body: `comment`, `name`, `title` |

#### Examples (JavaScript fetch)

```js
export async function addShipmentComment(id, { comment, name, title }) {
  const res = await fetch(`${baseUrl}/shipments/comment/${id}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ comment, name, title }),
  });
  if (!res.ok) {
    throw new Error(`Add comment failed: ${res.status}`);
  }
  return res.json();
}
```

#### Manifesting & Status

| Method | Path                                         | Description                                 | Key params                                         |
| ------ | -------------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| POST   | `/shipments/manifest/{warehouse_code}`       | Trigger end-of-day manifest (long-running). | `warehouse_code` (path)                            |
| PATCH  | `/shipments/manifest/manual/{status}`        | Manually set manifest status.               | `status` (path), `shipment_ids`                    |
| PATCH  | `/shipments/manifest/shipmentcodes/{status}` | Bulk manifest by shipment codes.            | `status` (path), `content` (comma-separated codes) |
| PATCH  | `/shipments/shipped/{sentStatus}`            | Mark shipments as shipped/not shipped.      | `sentStatus` (path), `shipment_ids` (query/body)   |
| PATCH  | `/shipments/status/{statusId}`               | Assign a status to shipments.               | `statusId` (path), `shipment_ids`                  |
| PATCH  | `/shipments/unlDone/{unlDoneStatus}`         | Flag shipments as processed by UNL.         | `unlDoneStatus` (path), `shipment_ids`             |

#### Examples (JavaScript fetch)

```js
export async function triggerShipmentManifest(warehouseCode) {
  const res = await fetch(`${baseUrl}/shipments/manifest/${warehouseCode}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Manifest trigger failed: ${res.status}`);
  }
  return res.json();
}

export async function setManifestStatus(status, shipmentIds) {
  const res = await fetch(`${baseUrl}/shipments/manifest/manual/${status}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shipment_ids: shipmentIds.join(",") }),
  });
  if (!res.ok) {
    throw new Error(`Manual manifest update failed: ${res.status}`);
  }
  return res.json();
}

export async function manifestByShipmentCodes(status, shipmentCodes) {
  const res = await fetch(
    `${baseUrl}/shipments/manifest/shipmentcodes/${status}`,
    {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ content: shipmentCodes.join(",") }),
    }
  );
  if (!res.ok) {
    throw new Error(`Manifest by codes failed: ${res.status}`);
  }
  return res.json();
}

export async function updateShippedStatus(sentStatus, shipmentIds) {
  const res = await fetch(`${baseUrl}/shipments/shipped/${sentStatus}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shipment_ids: shipmentIds.join(",") }),
  });
  if (!res.ok) {
    throw new Error(`Shipped status update failed: ${res.status}`);
  }
  return res.json();
}

export async function updateShipmentStatus(statusId, shipmentIds) {
  const res = await fetch(`${baseUrl}/shipments/status/${statusId}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shipment_ids: shipmentIds.join(",") }),
  });
  if (!res.ok) {
    throw new Error(`Shipment status update failed: ${res.status}`);
  }
  return res.json();
}

export async function updateUnlDoneStatus(unlDoneStatus, shipmentIds) {
  const res = await fetch(`${baseUrl}/shipments/unlDone/${unlDoneStatus}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shipment_ids: shipmentIds.join(",") }),
  });
  if (!res.ok) {
    throw new Error(`UNL status update failed: ${res.status}`);
  }
  return res.json();
}
```

#### Maintenance & Workflow

| Method | Path                        | Description                             | Key params                                               |
| ------ | --------------------------- | --------------------------------------- | -------------------------------------------------------- |
| PATCH  | `/shipments/move/{id}`      | Reassign line items between warehouses. | `id` (path), query/body keys per warehouse or `transfur` |
| PATCH  | `/shipments/quote/{id}`     | Select the active shipping quote.       | `id` (path), `quote_id`                                  |
| PATCH  | `/shipments/restore/{id}`   | Restore a soft-deleted shipment.        | `id` (path)                                              |
| PATCH  | `/shipments/unlock/{id}`    | Unlock a shipment record.               | `id` (path)                                              |
| PATCH  | `/shipments/archive/{id}`   | Archive a shipment.                     | `id` (path)                                              |
| PATCH  | `/shipments/unarchive/{id}` | Unarchive a shipment.                   | `id` (path)                                              |

#### Examples (JavaScript fetch)

```js
export async function moveShipmentLineItems(id, payload) {
  const res = await fetch(`${baseUrl}/shipments/move/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Move line items failed: ${res.status}`);
  }
  return res.json();
}

export async function selectShipmentQuote(id, quoteId) {
  const res = await fetch(`${baseUrl}/shipments/quote/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ quote_id: quoteId }),
  });
  if (!res.ok) {
    throw new Error(`Quote selection failed: ${res.status}`);
  }
  return res.json();
}

export async function restoreShipment(id) {
  const res = await fetch(`${baseUrl}/shipments/restore/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Shipment restore failed: ${res.status}`);
  }
  return res.json();
}

export async function unlockShipment(id) {
  const res = await fetch(`${baseUrl}/shipments/unlock/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Shipment unlock failed: ${res.status}`);
  }
  return res.json();
}

export async function archiveShipment(id) {
  const res = await fetch(`${baseUrl}/shipments/archive/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Shipment archive failed: ${res.status}`);
  }
  return res.json();
}

export async function unarchiveShipment(id) {
  const res = await fetch(`${baseUrl}/shipments/unarchive/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Shipment unarchive failed: ${res.status}`);
  }
  return res.json();
}
```

#### Data Refresh & Files

| Method | Path                      | Description                                        | Key params                                                                      |
| ------ | ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| PUT    | `/shipments/refresh/{id}` | Re-fetch shipment data from Shopify (destructive). | `id` (path), optional `columns`                                                 |
| POST   | `/shipments/pdf/{id}`     | Upload a manually generated label PDF.             | Multipart form: `file`, `name`, `title`, `tracking_code`, `manual_carrier_code` |
| DELETE | `/shipments/{id}`         | Soft-delete a shipment and purge labels.           | `id` (path)                                                                     |

#### Examples (JavaScript fetch)

```js
export async function refreshShipment(id, { columns } = {}) {
  const params = new URLSearchParams();
  if (columns) params.set("columns", columns);
  const url = params.toString()
    ? `${baseUrl}/shipments/refresh/${id}?${params}`
    : `${baseUrl}/shipments/refresh/${id}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Shipment refresh failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadShipmentPdf(
  id,
  { file, name, title, trackingCode, manualCarrierCode }
) {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  if (title) form.append("title", title);
  if (trackingCode) form.append("tracking_code", trackingCode);
  if (manualCarrierCode) form.append("manual_carrier_code", manualCarrierCode);

  const res = await fetch(`${baseUrl}/shipments/pdf/${id}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    throw new Error(`PDF upload failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteShipment(id) {
  const res = await fetch(`${baseUrl}/shipments/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Shipment delete failed: ${res.status}`);
  }
  return res.json();
}
```

### Shopify Sync (`/shopify`, key required)

| Method | Path                        | Description                              | Key params                  |
| ------ | --------------------------- | ---------------------------------------- | --------------------------- |
| GET    | `/shopify/TestFull`         | Diagnostic test endpoint.                | `key` (query)               |
| GET    | `/shopify/fetchSingle/{id}` | Fetch a single Shopify order by ID.      | `id` (path), `shop` (query) |
| GET    | `/shopify/fetchLatest`      | Import the last hour of Shopify orders.  | `shop` (query)              |
| GET    | `/shopify/fetchVariants`    | Sync Shopify product catalogue.          | `shop` (query)              |
| GET    | `/shopify/fulfill`          | Push fulfilment updates back to Shopify. | `shop` (query)              |

#### Examples (JavaScript fetch)

```js
function withKey(params = {}) {
  return new URLSearchParams({ key: KEY_ONLY_VALUE, ...params });
}

export async function runShopifyTest() {
  const res = await fetch(`${baseUrl}/shopify/TestFull?${withKey()}`);
  if (!res.ok) {
    throw new Error(`Shopify test failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchShopifyOrder(id, shop) {
  const params = withKey(shop ? { shop } : {});
  const res = await fetch(`${baseUrl}/shopify/fetchSingle/${id}?${params}`);
  if (!res.ok) {
    throw new Error(`Shopify order fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchLatestShopifyOrders(shop) {
  const params = withKey(shop ? { shop } : {});
  const res = await fetch(`${baseUrl}/shopify/fetchLatest?${params}`);
  if (!res.ok) {
    throw new Error(`Latest orders fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchShopifyVariants(shop) {
  const params = withKey(shop ? { shop } : {});
  const res = await fetch(`${baseUrl}/shopify/fetchVariants?${params}`);
  if (!res.ok) {
    throw new Error(`Shopify variants sync failed: ${res.status}`);
  }
  return res.json();
}

export async function fulfillShopifyOrders(shop) {
  const params = withKey(shop ? { shop } : {});
  const res = await fetch(`${baseUrl}/shopify/fulfill?${params}`);
  if (!res.ok) {
    throw new Error(`Shopify fulfillment failed: ${res.status}`);
  }
  return res.json();
}
```

### Todos (`/todos`, Sanctum)

| Method | Path          | Description    |
| ------ | ------------- | -------------- |
| GET    | `/todos/`     | List todos.    |
| GET    | `/todos/{id}` | Fetch a todo.  |
| POST   | `/todos/`     | Create a todo. |
| PATCH  | `/todos/{id}` | Update a todo. |
| DELETE | `/todos/{id}` | Delete a todo. |

#### Examples (JavaScript fetch)

```js
export async function listTodos(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  const url = params.toString()
    ? `${baseUrl}/todos?${params}`
    : `${baseUrl}/todos`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Todo list failed: ${res.status}`);
  }
  return res.json();
}

export async function getTodo(id) {
  const res = await fetch(`${baseUrl}/todos/${id}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Todo fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function createTodo(payload) {
  const res = await fetch(`${baseUrl}/todos`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Todo creation failed: ${res.status}`);
  }
  return res.json();
}

export async function updateTodo(id, payload) {
  const res = await fetch(`${baseUrl}/todos/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Todo update failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteTodo(id) {
  const res = await fetch(`${baseUrl}/todos/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Todo delete failed: ${res.status}`);
  }
  return res.json();
}
```

### User Session (`/user`, Sanctum)

- `GET /user` returns the currently authenticated user profile.

#### Examples (JavaScript fetch)

```js
export async function getCurrentUser() {
  const res = await fetch(`${baseUrl}/user`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Current user fetch failed: ${res.status}`);
  }
  return res.json();
}
```

### Users & Authentication (`/users`)

| Method | Path                   | Description                               | Notes                                                         |
| ------ | ---------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| GET    | `/users/`              | Paginated user list.                      | Requires admin-capable Sanctum user. `perPage` optional.      |
| GET    | `/users/{id}`          | Load a specific user.                     | Admin-capable Sanctum user.                                   |
| PUT    | `/users/{id}`          | Update a user.                            | Admin-capable Sanctum user; body `name`, `email`, `password`. |
| POST   | `/users/auth/login`    | Authenticate and receive a Sanctum token. | Body: `email`, `password`.                                    |
| GET    | `/users/auth/me`       | Fetch the authenticated user with roles.  | Requires valid token.                                         |
| POST   | `/users/auth/register` | Register a new user.                      | Admin-capable Sanctum user; body `name`, `email`, `password`. |

#### Examples (JavaScript fetch)

```js
// loginUser is defined in the Authentication section and covers POST /users/auth/login.

export async function listUsers(perPage = 30) {
  const res = await fetch(`${baseUrl}/users?perPage=${perPage}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`User listing failed: ${res.status}`);
  }
  return res.json();
}

export async function getUserById(id) {
  const res = await fetch(`${baseUrl}/users/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`User load failed: ${res.status}`);
  }
  return res.json();
}

export async function updateUser(id, payload) {
  const res = await fetch(`${baseUrl}/users/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`User update failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchAuthenticatedUser() {
  const res = await fetch(`${baseUrl}/users/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Auth user fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function registerUser(payload) {
  const res = await fetch(`${baseUrl}/users/auth/register`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`User registration failed: ${res.status}`);
  }
  return res.json();
}
```

## Usage Tips

- Long-running endpoints (`generateLabels`, manifests, Shopify refresh) can take minutes; design clients to poll for completion or surface progress.
- Handle 401/403 responses by refreshing tokens or verifying role permissions.
- For bulk operations (`shipment_ids` lists, warehouse transfers), validate inputs client-side to avoid partial updates.
