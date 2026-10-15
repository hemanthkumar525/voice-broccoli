# Broccoli Pizza & Pasta UAE - Zara Voice Assistant & n8n Integration Contract

## 1. Webhook Configuration
- **Active Webhook URL**: `https://n8n.smbjugaad.com/webhook/broccoli-full-lookup`
- **Fallback Webhook URL**: `https://n8n.smbjugaad.com/webhook/broccoli-menu-lookup`
- **Authentication**: Bearer token via `X-N8N-Webhook-Secret` or `Authorization: Bearer <token>` (Configured via `N8N_WEBHOOK_KEY` or `N8N_WEBHOOK_SECRET`).

## 2. Environment Variables in AWS Lambda
| Variable | Description | Example / Default |
|---|---|---|
| `N8N_WEBHOOK_URL` | Active n8n endpoint for restaurant data | `https://n8n.smbjugaad.com/webhook/broccoli-full-lookup` |
| `N8N_WEBHOOK_KEY` | Optional security key / secret header | (optional) |
| `N8N_TIMEOUT_SECONDS` | Bounded timeout for webhook calls | `8` |
| `N8N_MAX_RETRIES` | Max retries for transient HTTP 5xx errors | `1` |
| `BEDROCK_MODEL_ID` | Amazon Nova model ID | `amazon.nova-lite-v1:0` |
| `POLLY_VOICE_ID` | Female voice identifier | `Tiffany` (Generative) / `Danielle` (Neural) |
| `JWT_SECRET` | Secret key for client token validation | `broccoli-zara-secret-key-2026` |
| `DEV_BYPASS` | Allow `DEV_BYPASS` token for local/staging | `true` |
| `ALLOWED_ORIGINS` | CORS & WebSocket whitelist | `http://localhost:5173,http://localhost:3000,*.hostinger.com,https://broccoli.ae` |

---

## 3. Tool Specification (`broccoli_restaurant_lookup`)
Bedrock Nova invokes `broccoli_restaurant_lookup` with this contract:

```json
{
  "operation": "menu_lookup | branch_lookup | franchise_inquiry | order_info | restaurant_info",
  "action": "price_lookup | product_details | list_branches | branch_details | franchise_details | order_status | general_info",
  "product_name": "Vegetable Pizza",
  "size": "Large | Medium | Small",
  "branch": "Dubai - DIFC",
  "query": "optional natural language string",
  "order_id": "optional order tracking reference"
}
```

---

## 4. Operation Schemas & Payloads

### A. Menu Items & Price Lookup (`operation: menu_lookup`)
#### Request to n8n:
```json
{
  "toolCallId": "call_abc123",
  "operation": "menu_lookup",
  "action": "price_lookup",
  "product_name": "Vegetable Pizza",
  "size": "Large",
  "branch": "Dubai - DIFC"
}
```

#### Actual n8n Response:
```json
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "{\"success\":true,\"product\":{\"name\":\"Vegetable Pizza Large\",\"category\":\"Pizza\",\"size\":\"Large\",\"price_aed\":28.5,\"original_price_aed\":57,\"offer\":\"50% off\",\"branch\":\"Dubai - DIFC\",\"source_sheet\":\"Dubai - DIFC\",\"source_url\":\"https://goorder.com/restaurant/68a46334be07d1a17f24f5ec/broccoli-pizza-pasta-difc\"},\"currency\":\"AED\",\"message\":\"Data sourced from workbook.\",\"http_status\":200}"
    }
  ]
}
```

#### Size Selection Handling (When size is omitted):
```json
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "{\"success\":false,\"error\":\"SIZE_REQUIRED\",\"options\":[{\"name\":\"Vegetable Pizza Large\",\"price_aed\":28.5,\"size\":\"Large\"},{\"name\":\"Vegetable Pizza Medium\",\"price_aed\":22,\"size\":\"Medium\"},{\"name\":\"Vegetable Pizza Small\",\"price_aed\":14,\"size\":\"Small\"}],\"message\":\"Ask the customer to choose a size.\",\"http_status\":200}"
    }
  ]
}
```
*Zara announces available sizes and prompts the customer to choose.*

---

### B. Branch Lookup (`operation: branch_lookup`)
- **Supported Branches**:
  - **Dubai**: DIFC (Damac Park Towers), Barsha Heights / TECOM (Shaiba Towers), Al Twar 2, Dubai Sports City.
  - **Abu Dhabi**: Al Khalidiyah (Zayed The First St), Khalifa City B, Al Shamkha (Makani Mall), Al Ain (Al Jimi Mall).
  - **Northern Emirates**: Sharjah (Al Majaz / Al Taawun), Fujairah, Ras Al Khaimah, Umm Al Quwain.

---

### C. Franchise Inquiries (`operation: franchise_inquiry`)
- **Official Contact**: `sales@broccoli.ae`
- **Official Website**: `https://broccoli.ae`
- **Origin**: Founded in TECOM (Barsha Heights), Dubai on December 2, 2011.
- **Rule**: Never invent franchise fees or contractual terms; directs customer to the official sales desk.

---

### D. Order Information (`operation: order_info`)
- **Validation**: Requires `order_id`. If omitted, prompts customer for their GoOrder / branch receipt number.
- **Delivery Partner**: GoOrder / Talabat.

---

## 5. Operations Status Matrix
| Operation | Action | Status | Source |
|---|---|---|---|
| Menu Price Lookup | `price_lookup` | ✅ Fully Supported | n8n Google Sheet Workbook |
| Product Details & Sizes | `product_details` | ✅ Fully Supported | n8n Google Sheet Workbook |
| Size Clarification | N/A | ✅ Fully Supported | n8n `SIZE_REQUIRED` Response |
| Branch Directory | `list_branches` / `branch_details` | ✅ Fully Supported | Verified UAE Directory & DIFC Sheet |
| Franchise Enquiries | `franchise_details` | ✅ Fully Supported | Verified Corporate Registry (`sales@broccoli.ae`) |
| Order Tracking | `order_status` | ⚠️ Read-only Guidance | Awaits live POS/GoOrder order API in n8n |

---

## 6. How to Run Tests
```powershell
cd middlelayer
node test-tools.mjs
node test-zara.mjs
```

