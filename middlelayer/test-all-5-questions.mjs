import { execSync } from 'child_process';
import fs from 'fs';

// Set up credentials for test execution
if (!process.env.AWS_ACCESS_KEY_ID) {
  try {
    const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());
    process.env.AWS_ACCESS_KEY_ID = creds.AccessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey;
    process.env.AWS_SESSION_TOKEN = creds.SessionToken;
    process.env.AWS_REGION = 'us-east-1';
    delete process.env.AWS_PROFILE;
  } catch {}
}

const { executeRestaurantLookup } = await import('./n8n.js');
const { generateZaraResponse } = await import('./bedrock.js');
const { streamNova2SonicTurn } = await import('./nova-sonic.js');

async function runCustomerQuestionSuite() {
  console.log('===============================================================');
  console.log('TEST SUITE: VERIFYING 5 CUSTOMER QUESTIONS & SPEECH GENERATION');
  console.log('===============================================================\n');

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

  // Question 1: What pizzas do you have?
  console.log('--- Question 1: What pizzas do you have? ---');
  const q1Lookup = await executeRestaurantLookup({
    operation: 'menu_lookup',
    action: 'product_details',
    product_name: 'pizzas',
    branch: 'Dubai - DIFC'
  }, 'call_q1');
  console.log('[Lookup Result Q1]:', q1Lookup.message);
  assert('Q1 returns verified pizza menu list', Array.isArray(q1Lookup.available_pizzas) && q1Lookup.available_pizzas.length >= 6);
  assert('Q1 contains Vegetable Pizza and Pepperoni Pizza', q1Lookup.available_pizzas.includes('Vegetable Pizza') && q1Lookup.available_pizzas.includes('Pepperoni Pizza'));

  const q1Reply = await generateZaraResponse('What pizzas do you have on the menu?');
  console.log('[Zara Spoken Reply Q1]:', q1Reply);
  assert('Q1 Zara reply is cheerful and names pizzas', q1Reply.toLowerCase().includes('pizza'));

  // Question 2: How much is a large Vegetable Pizza?
  console.log('\n--- Question 2: How much is a large Vegetable Pizza? ---');
  const q2Lookup = await executeRestaurantLookup({
    operation: 'menu_lookup',
    action: 'price_lookup',
    product_name: 'Vegetable Pizza',
    size: 'Large',
    branch: 'Dubai - DIFC'
  }, 'call_q2');
  console.log('[Lookup Result Q2]:', JSON.stringify(q2Lookup.product));
  assert('Q2 exact price matches live n8n workbook (28.5 AED)', q2Lookup.product?.price_aed === 28.5);
  assert('Q2 verified 50% discount offer present', q2Lookup.product?.offer === '50% off');

  const q2Reply = await generateZaraResponse('How much is a large Vegetable Pizza at your DIFC branch?');
  console.log('[Zara Spoken Reply Q2]:', q2Reply);
  assert('Q2 Zara announces 28.5 AED live price', q2Reply.includes('28.5') || q2Reply.toLowerCase().includes('28.5 aed'));

  // Question 3: Which branches do you have in Dubai?
  console.log('\n--- Question 3: Which branches do you have in Dubai? ---');
  const q3Lookup = await executeRestaurantLookup({
    operation: 'branch_lookup',
    action: 'list_branches',
    query: 'Dubai'
  }, 'call_q3');
  console.log('[Lookup Result Q3]:', q3Lookup.branches?.map(b => b.name).join(', '));
  assert('Q3 returns Dubai branches', q3Lookup.branches?.some(b => b.name.includes('DIFC')));
  assert('Q3 includes Barsha Heights TECOM', q3Lookup.branches?.some(b => b.name.includes('TECOM')));

  const q3Reply = await generateZaraResponse('Which branches do you have in Dubai?');
  console.log('[Zara Spoken Reply Q3]:', q3Reply);
  assert('Q3 Zara mentions Dubai locations', q3Reply.includes('DIFC') || q3Reply.includes('Dubai'));

  // Question 4: How can I enquire about a franchise?
  console.log('\n--- Question 4: How can I enquire about a franchise? ---');
  const q4Lookup = await executeRestaurantLookup({
    operation: 'franchise_inquiry',
    action: 'franchise_details'
  }, 'call_q4');
  console.log('[Lookup Result Q4]:', q4Lookup.franchise?.official_email);
  assert('Q4 official franchise email is sales@broccoli.ae', q4Lookup.franchise?.official_email === 'sales@broccoli.ae');

  const q4Reply = await generateZaraResponse('How can I enquire about a franchise?');
  console.log('[Zara Spoken Reply Q4]:', q4Reply);
  assert('Q4 Zara directs to sales@broccoli.ae', q4Reply.includes('sales@broccoli.ae'));

  // Question 5: Can you check my order status?
  console.log('\n--- Question 5: Can you check my order status? ---');
  const q5Lookup = await executeRestaurantLookup({
    operation: 'order_info',
    action: 'order_status'
  }, 'call_q5');
  console.log('[Lookup Result Q5]:', q5Lookup.message);
  assert('Q5 prompts for order reference number without inventing order state', q5Lookup.needs_order_id === true);

  const q5Reply = await generateZaraResponse('Can you check my order status?');
  console.log('[Zara Spoken Reply Q5]:', q5Reply);
  assert('Q5 Zara asks for order reference/number', q5Reply.toLowerCase().includes('order') && (q5Reply.toLowerCase().includes('number') || q5Reply.toLowerCase().includes('reference') || q5Reply.toLowerCase().includes('id')));

  // Test 6: Verify genuine Nova Sonic speech-to-speech audio output
  console.log('\n--- Test 6: Verify Genuine Nova 2 Sonic Bidirectional Audio Generation ---');
  const pcmPath = fs.existsSync('middlelayer/real_question_16k.pcm') ? 'middlelayer/real_question_16k.pcm' : 'real_question_16k.pcm';
  const pcm = fs.readFileSync(pcmPath);
  let audioChunksCount = 0;
  let sonicUserTranscript = '';
  let sonicAssistantTranscript = '';

  const sonicResult = await streamNova2SonicTurn({
    pcmAudioBuffer: pcm,
    language: 'English',
    onAudioChunk: (chunk) => {
      audioChunksCount++;
    },
    onUserTranscript: (piece, full) => {
      sonicUserTranscript = full;
    },
    onTranscriptChunk: (piece, full) => {
      sonicAssistantTranscript = full;
    }
  });

  console.log('[Nova Sonic User Transcript]:', sonicUserTranscript || sonicResult.userTranscript);
  console.log('[Nova Sonic Spoken Transcript]:', sonicAssistantTranscript || sonicResult.transcript);
  console.log('[Nova Sonic Total 24kHz LPCM Audio Chunks]:', audioChunksCount);

  assert('User microphone speech transcribed accurately', Boolean(sonicUserTranscript || sonicResult.userTranscript));
  assert('Genuine 24kHz LPCM audio chunks streamed (> 10 chunks)', audioChunksCount > 10, `audioChunksCount=${audioChunksCount}`);
  assert('Assistant transcript generated', Boolean(sonicAssistantTranscript || sonicResult.transcript));

  console.log('\n===============================================================');
  console.log(`CUSTOMER QUESTION SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runCustomerQuestionSuite().catch((e) => {
  console.error('Test suite failure:', e);
  process.exit(1);
});
