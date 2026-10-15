/**
 * Centralized n8n Webhook Client & Unified Restaurant Lookup Tool
 * Handles menu lookups, prices, branch locations, franchise inquiries, and order queries.
 */

const DEFAULT_WEBHOOK_URL = 'https://n8n.smbjugaad.com/webhook/broccoli-full-lookup';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RETRIES = 1;

/**
 * Validates and normalizes tool arguments.
 */
const ALLOWED_OPERATIONS = new Set([
  'menu_lookup',
  'branch_lookup',
  'franchise_inquiry',
  'order_info',
  'restaurant_info'
]);

const ALLOWED_ACTIONS = new Set([
  'price_lookup',
  'product_details',
  'list_branches',
  'branch_details',
  'franchise_details',
  'order_status',
  'general_info'
]);

// Verified official UAE branch directory
const VERIFIED_BRANCHES = [
  { name: 'DIFC', city: 'Dubai', address: 'Damac Park Towers, DIFC, Dubai', hours: '10:00 AM - 12:00 AM' },
  { name: 'Barsha Heights (TECOM)', city: 'Dubai', address: 'Shaiba Towers, Barsha Heights, Dubai', hours: '10:00 AM - 2:00 AM' },
  { name: 'Al Twar 2', city: 'Dubai', address: 'Al Nahda St, Al Twar 2, Dubai', hours: '11:00 AM - 1:00 AM' },
  { name: 'Dubai Sports City', city: 'Dubai', address: 'Canal Residence, Sports City, Dubai', hours: '11:00 AM - 12:00 AM' },
  { name: 'Khalidiyah', city: 'Abu Dhabi', address: 'Zayed The First St, Al Khalidiyah, Abu Dhabi', hours: '10:00 AM - 1:00 AM' },
  { name: 'Khalifa City B', city: 'Abu Dhabi', address: 'Shakhbout City, Khalifa City B, Abu Dhabi', hours: '11:00 AM - 12:00 AM' },
  { name: 'Al Shamkha', city: 'Abu Dhabi', address: 'Makani Mall, Al Shamkha, Abu Dhabi', hours: '10:00 AM - 11:30 PM' },
  { name: 'Al Ain', city: 'Al Ain', address: 'Al Jimi Mall, Al Ain', hours: '10:00 AM - 11:00 PM' },
  { name: 'Sharjah', city: 'Sharjah', address: 'Al Majaz Waterfront / Al Taawun, Sharjah', hours: '10:00 AM - 1:00 AM' },
  { name: 'Fujairah', city: 'Fujairah', address: 'Hamad Bin Abdulla Rd, Fujairah', hours: '11:00 AM - 12:00 AM' },
  { name: 'Ras Al Khaimah', city: 'Ras Al Khaimah', address: 'Al Manar Mall, Ras Al Khaimah', hours: '10:00 AM - 12:00 AM' },
  { name: 'Umm Al Quwain', city: 'Umm Al Quwain', address: 'King Faisal Rd, Umm Al Quwain', hours: '11:00 AM - 11:30 PM' }
];

// Verified official franchise information
const VERIFIED_FRANCHISE = {
  brand: 'Broccoli Pizza & Pasta UAE',
  official_email: 'sales@broccoli.ae',
  official_website: 'https://broccoli.ae',
  headquarters: 'Dubai, United Arab Emirates',
  foundation: 'Founded on 2 December 2011 in TECOM (Barsha Heights), Dubai',
  process: [
    '1. Submit enquiry via sales@broccoli.ae or official website',
    '2. Review applicant experience and proposed territory',
    '3. Site selection approval and kitchen design',
    '4. Operational training and Grand Opening support'
  ],
  note: 'Specific franchise fees and royalties depend on the country and territory agreement and are provided directly by the corporate sales team.'
};

// Verified official menu items
export const VERIFIED_PIZZAS = [
  { name: 'Chicken BBQ Pizza', description: 'Tender chicken breast, sweet smoky BBQ sauce, red onions, and melted mozzarella.' },
  { name: 'Deluxe Pizza', description: 'Beef pepperoni, seasoned ground beef, green bell peppers, fresh mushrooms, black olives, and mozzarella.' },
  { name: 'Pepperoni Pizza', description: 'Premium beef pepperoni, rich Italian herb marinara, and melted mozzarella on crispy crust.' },
  { name: 'Greek Pizza', description: 'Tangy feta cheese crumbles, sliced black olives, cherry tomatoes, red onions, and oregano.' },
  { name: 'Vegetable Pizza', description: 'Fresh broccoli florets, button mushrooms, crisp green bell peppers, diced onions, and ripe tomatoes.' },
  { name: 'Classic Cheese Pizza', description: 'Rich tomato sauce topped with 100% whole milk golden melted mozzarella.' }
];

export const VERIFIED_PASTAS = [
  { name: 'Chicken Pasta & Alfredo', description: 'Grilled chicken breast, vibrant broccoli florets, penne, and rich creamy Alfredo sauce.' },
  { name: 'Spaghetti Bolognese Pasta', description: 'Traditional slow-cooked minced beef ragù simmered with Italian herbs and garlic over spaghetti.' },
  { name: 'Beef Strips Pasta', description: 'Succulent sautéed beef strips, sliced mushrooms, garlic butter, and creamy savory sauce with penne.' },
  { name: 'Shrimp Pasta', description: 'Pan-seared garlic shrimp tossed in delicate creamy pink Rosa sauce with fresh herbs.' }
];

/**
 * Normalizes any n8n response payload into a consistent internal format.
 */
function normalizeN8nResponse(operation, action, rawData, toolUseId) {
  let innerResult = rawData;

  // Unpack nested results array if returned by n8n
  if (rawData && Array.isArray(rawData.results) && rawData.results.length > 0) {
    const firstResult = rawData.results[0];
    if (typeof firstResult.result === 'string') {
      try {
        innerResult = JSON.parse(firstResult.result);
      } catch {
        innerResult = { raw: firstResult.result };
      }
    } else if (firstResult.result && typeof firstResult.result === 'object') {
      innerResult = firstResult.result;
    }
  }

  // Handle n8n size required options
  if (innerResult?.error === 'SIZE_REQUIRED' && Array.isArray(innerResult.options)) {
    return {
      success: true,
      toolUseId,
      operation,
      action,
      needs_size_selection: true,
      message: innerResult.message || 'Please ask the customer to choose a size.',
      available_sizes: innerResult.options.map((opt) => ({
        name: opt.name,
        size: opt.size,
        price_aed: opt.price_aed,
        original_price_aed: opt.original_price_aed,
        offer: opt.offer,
        branch: opt.branch
      }))
    };
  }

  // Handle successful item found
  if (innerResult?.success === true && innerResult?.product) {
    return {
      success: true,
      toolUseId,
      operation,
      action,
      product: innerResult.product,
      currency: innerResult.currency || 'AED',
      message: innerResult.message || 'Verified product details sourced from live restaurant workbook.'
    };
  }

  // Handle item not found in n8n workbook
  if (innerResult?.error === 'PRODUCT_NOT_FOUND') {
    return {
      success: false,
      toolUseId,
      operation,
      action,
      error: 'PRODUCT_NOT_FOUND',
      message: 'The requested item was not found in the current branch menu workbook. You may ask the customer if they would like to customize a fresh pizza or pasta.'
    };
  }

  return {
    success: innerResult?.success ?? true,
    toolUseId,
    operation,
    action,
    data: innerResult,
    message: innerResult?.message || 'Lookup completed'
  };
}

/**
 * Sends a POST request to the n8n webhook with bounded timeout and retries.
 */
async function callN8nWebhook(payload, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_KEY || '';

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Broccoli-Zara-Voice-Assistant/2.0'
  };

  if (webhookSecret) {
    headers['X-N8N-Webhook-Secret'] = webhookSecret;
    headers['Authorization'] = `Bearer ${webhookSecret}`;
  }

  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[n8n] HTTP ${response.status} from webhook: ${errorText.slice(0, 150)}`);
        if (response.status >= 500 && attempt <= maxRetries) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        return {
          httpStatus: response.status,
          success: false,
          error: `HTTP_${response.status}`,
          message: `Webhook returned HTTP status ${response.status}`
        };
      }

      const json = await response.json();
      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`[n8n] Request timed out after ${timeoutMs}ms (attempt ${attempt})`);
      } else {
        console.warn(`[n8n] Fetch error: ${err.message} (attempt ${attempt})`);
      }

      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  return {
    success: false,
    error: lastError?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
    message: lastError?.message || 'Could not reach n8n webhook'
  };
}

/**
 * Main Unified Restaurant Lookup Tool Handler.
 * Validates tool arguments and routes to n8n or verified knowledge.
 */
export async function executeRestaurantLookup(input = {}, toolUseId = '') {
  const operation = (input.operation || 'menu_lookup').trim().toLowerCase();
  const action = (input.action || 'price_lookup').trim().toLowerCase();
  const query = (input.query || input.product_name || '').trim();
  const branch = (input.branch || 'Dubai - DIFC').trim();
  const productName = (input.product_name || input.query || '').trim();
  const size = (input.size || '').trim();
  const orderId = (input.order_id || '').trim();

  // Validate allowed operation and action
  if (!ALLOWED_OPERATIONS.has(operation)) {
    return {
      success: false,
      toolUseId,
      error: 'UNSUPPORTED_OPERATION',
      message: `Operation '${operation}' is not supported.`
    };
  }

  console.log(`[LOOKUP] Executing '${operation}:${action}' for '${productName || query}' at branch '${branch}'`);

  // A. Branch Information
  if (operation === 'branch_lookup') {
    const search = (query || branch).toLowerCase();
    const matches = VERIFIED_BRANCHES.filter(
      (b) => b.name.toLowerCase().includes(search) || b.city.toLowerCase().includes(search) || b.address.toLowerCase().includes(search)
    );

    return {
      success: true,
      toolUseId,
      operation,
      action,
      total_matches: matches.length > 0 ? matches.length : VERIFIED_BRANCHES.length,
      branches: matches.length > 0 ? matches : VERIFIED_BRANCHES.slice(0, 6),
      message: matches.length > 0 ? `Found branch details for ${matches[0].name}.` : 'Here are our popular UAE branches.'
    };
  }

  // B. Franchise Information
  if (operation === 'franchise_inquiry') {
    return {
      success: true,
      toolUseId,
      operation,
      action,
      franchise: VERIFIED_FRANCHISE,
      message: 'Official franchise enquiries should be directed to sales@broccoli.ae.'
    };
  }

  // C. Order Status & Information
  if (operation === 'order_info') {
    const isGenericOrderId = !orderId || /^(user_provided_order_id|none|null|undefined|order_id|pending|placeholder)$/i.test(orderId);
    if (isGenericOrderId) {
      return {
        success: false,
        toolUseId,
        operation,
        action,
        needs_order_id: true,
        message: 'To check your order status, please provide your order reference number (e.g. from GoOrder, Talabat, or SMS confirmation).'
      };
    }

    // Try calling n8n if an order workflow is active
    const n8nPayload = {
      operation: 'order_info',
      action: action || 'order_status',
      order_id: orderId,
      branch,
      toolCallId: toolUseId
    };

    const n8nRes = await callN8nWebhook(n8nPayload);
    if (n8nRes?.success && n8nRes?.order) {
      return normalizeN8nResponse(operation, action, n8nRes, toolUseId);
    }

    // Graceful response for order tracking
    return {
      success: true,
      toolUseId,
      operation,
      action,
      order_id: orderId,
      order_status: 'Order lookup received. Orders are actively prepared within 20-30 minutes for delivery via GoOrder.',
      delivery_partner: 'GoOrder / Talabat',
      message: `For immediate assistance with order #${orderId}, please check your GoOrder app or call your branch directly.`
    };
  }

  // D. Menu Items, Pricing & Product Details
  const rawTarget = (productName || query).toLowerCase().trim();
  const isGeneralPizza = /^(what|which|list|show)?\s*(pizzas?|all pizzas?|types of pizzas?|pizza menu)\s*(do you have|are available)?$/i.test(rawTarget) ||
    rawTarget === 'pizza' || rawTarget === 'pizzas' || (rawTarget === '' && action === 'list_branches');

  if (isGeneralPizza && operation === 'menu_lookup') {
    return {
      success: true,
      toolUseId,
      operation: 'menu_lookup',
      action: 'list_items',
      category: 'Pizza',
      total: VERIFIED_PIZZAS.length,
      pizzas: VERIFIED_PIZZAS,
      available_pizzas: VERIFIED_PIZZAS.map((p) => p.name),
      message: 'We serve Chicken BBQ Pizza, Deluxe Pizza, Pepperoni Pizza, Greek Pizza, Vegetable Pizza, and Classic Cheese Pizza. All pizzas come in Small, Medium, and Large with a special 50% discount!'
    };
  }

  const isGeneralPasta = /^(what|which|list|show)?\s*(pastas?|all pastas?|types of pastas?|pasta menu)\s*(do you have|are available)?$/i.test(rawTarget) ||
    rawTarget === 'pasta' || rawTarget === 'pastas';

  if (isGeneralPasta && operation === 'menu_lookup') {
    return {
      success: true,
      toolUseId,
      operation: 'menu_lookup',
      action: 'list_items',
      category: 'Pasta',
      total: VERIFIED_PASTAS.length,
      pastas: VERIFIED_PASTAS,
      available_pastas: VERIFIED_PASTAS.map((p) => p.name),
      message: 'We serve Chicken Pasta & Alfredo, Spaghetti Bolognese Pasta, Beef Strips Pasta, and Shrimp Pasta.'
    };
  }

  // Extract size keyword from product_name or query if not explicitly passed
  let cleanItemName = productName || query;
  let resolvedSize = size;
  const sizeMatch = cleanItemName.match(/\b(large|medium|small)\b/i);
  if (sizeMatch) {
    if (!resolvedSize) {
      resolvedSize = sizeMatch[1].charAt(0).toUpperCase() + sizeMatch[1].slice(1).toLowerCase();
    }
    cleanItemName = cleanItemName.replace(/\b(large|medium|small)\b/gi, '').trim().replace(/\s+/g, ' ');
  }

  // If no item name was mentioned, provide verified menu summary immediately
  if (!cleanItemName) {
    return {
      success: true,
      toolUseId,
      operation: 'menu_lookup',
      action: 'list_items',
      category: 'Menu',
      available_pizzas: VERIFIED_PIZZAS.map((p) => p.name),
      available_pastas: VERIFIED_PASTAS.map((p) => p.name),
      message: 'We serve a delicious variety of fresh Pizzas (Chicken BBQ, Deluxe, Pepperoni, Greek, Vegetable, Classic Cheese) and Pastas (Chicken Alfredo, Bolognese, Beef Strips, Shrimp). Which would you like to know more about?'
    };
  }

  // The active n8n workbook workflow accepts operation: 'menu_lookup', action: 'price_lookup'
  const normalizedAction = action === 'product_details' ? 'price_lookup' : action;

  // Construct payload compatible with n8n workbook lookup
  const n8nPayload = {
    toolCallId: toolUseId,
    operation,
    action: normalizedAction,
    product_name: cleanItemName,
    size: resolvedSize || undefined,
    branch: branch || 'Dubai - DIFC',
    query: cleanItemName
  };

  const rawN8n = await callN8nWebhook(n8nPayload);
  return normalizeN8nResponse(operation, action, rawN8n, toolUseId);
}

/**
 * Generic webhook trigger for background event telemetry or external workflows.
 */
export async function triggerN8nWebhook(action, payload) {
  try {
    const n8nPayload = {
      action,
      timestamp: new Date().toISOString(),
      restaurant: 'Broccoli Pizza & Pasta UAE',
      payload
    };
    return await callN8nWebhook(n8nPayload, 4000, 0);
  } catch (err) {
    console.warn('[n8n] triggerN8nWebhook notice:', err.message);
    return { success: false, error: err.message };
  }
}
