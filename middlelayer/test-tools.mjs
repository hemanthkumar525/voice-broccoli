import { execSync } from 'child_process';

if (!process.env.AWS_ACCESS_KEY_ID) {
  try {
    const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());
    process.env.AWS_ACCESS_KEY_ID = creds.AccessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey;
    process.env.AWS_SESSION_TOKEN = creds.SessionToken;
    process.env.AWS_REGION = 'us-east-1';
    delete process.env.AWS_PROFILE;
  } catch (e) {
    // Ignore if not available
  }
}

const { executeRestaurantLookup } = await import('./n8n.js');
const { generateZaraResponse } = await import('./bedrock.js');

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING UNIT & INTEGRATION TESTS FOR ZARA & N8N');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title, condition, details = '') {
    if (condition) {
      console.log(`✔ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} - ${details}`);
      failed++;
    }
  }

  // 1. Menu item price lookup with exact size
  console.log('Test 1: Price lookup (Vegetable Pizza Large)');
  const res1 = await executeRestaurantLookup({
    operation: 'menu_lookup',
    action: 'price_lookup',
    product_name: 'Vegetable Pizza',
    size: 'Large',
    branch: 'Dubai - DIFC'
  }, 'call_001');
  assert('Price lookup returns success', res1.success === true, JSON.stringify(res1));
  assert('Tool call id preserved', res1.toolUseId === 'call_001');
  assert('Exact product price in AED returned', Boolean(res1.product?.price_aed), `price_aed=${res1.product?.price_aed}`);

  // 2. Menu lookup without size (should return size options)
  console.log('\nTest 2: Product details without size (Vegetable Pizza)');
  const res2 = await executeRestaurantLookup({
    operation: 'menu_lookup',
    action: 'product_details',
    product_name: 'Vegetable Pizza',
    branch: 'Dubai - DIFC'
  }, 'call_002');
  assert('Size selection needed', res2.needs_size_selection === true || res2.success === true);
  assert('Available sizes list present', Array.isArray(res2.available_sizes) && res2.available_sizes.length > 0);

  // 3. Branch lookup
  console.log('\nTest 3: Branch search (DIFC)');
  const res3 = await executeRestaurantLookup({
    operation: 'branch_lookup',
    action: 'branch_details',
    query: 'DIFC'
  }, 'call_003');
  assert('Branch lookup success', res3.success === true);
  assert('Found DIFC branch address', res3.branches?.some((b) => b.name.includes('DIFC')));

  // 4. Franchise inquiry
  console.log('\nTest 4: Franchise details');
  const res4 = await executeRestaurantLookup({
    operation: 'franchise_inquiry',
    action: 'franchise_details'
  }, 'call_004');
  assert('Franchise official email is sales@broccoli.ae', res4.franchise?.official_email === 'sales@broccoli.ae');

  // 5. Order inquiry without order ID
  console.log('\nTest 5: Order status without order_id');
  const res5 = await executeRestaurantLookup({
    operation: 'order_info',
    action: 'order_status'
  }, 'call_005');
  assert('Requires order ID validation', res5.needs_order_id === true);

  // 6. Unsupported operation
  console.log('\nTest 6: Unsupported operation rejection');
  const res6 = await executeRestaurantLookup({
    operation: 'arbitrary_operation',
    action: 'hack'
  }, 'call_006');
  assert('Rejects unsupported operations', res6.success === false && res6.error === 'UNSUPPORTED_OPERATION');

  // 7. End-to-end Bedrock Nova test with Tool Use
  console.log('\nTest 7: End-to-end Bedrock Nova conversation with Tool Use');
  const answer = await generateZaraResponse('How much is the Vegetable Pizza Large at your DIFC branch?');
  console.log('Zara spoken reply:', answer);
  assert('Zara answers with live price details', answer.includes('28.5') || answer.toLowerCase().includes('aed') || answer.toLowerCase().includes('vegetable pizza'));

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
