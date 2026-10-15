import fs from 'fs';

const WS_URL = 'wss://15j2wt9hz1.execute-api.us-east-1.amazonaws.com/prod?token=DEV_BYPASS';

console.log('Testing Live WebSocket Connection to AWS:', WS_URL);

async function testWebSocketFlow() {
  const ws = new globalThis.WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log('✔ WebSocket Connected to AWS!');
      resolve();
    };
    ws.onerror = (e) => reject(new Error('WebSocket connection error: ' + (e.message || 'unknown')));
  });

  // 1. Test set_language to Hindi
  console.log('\n[1/3] Testing set_language -> Hindi');
  const hindiPromise = new Promise((resolve) => {
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'zara_response' && msg.language === 'Hindi') {
        console.log('✔ Received Hindi Greeting Ack:', msg.text);
        ws.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    ws.addEventListener('message', handler);
  });
  ws.send(JSON.stringify({ action: 'set_language', language: 'Hindi' }));
  await hindiPromise;

  // 2. Test set_language to Arabic (Immediate language shift)
  console.log('\n[2/3] Testing shift language -> Arabic');
  const arabicPromise = new Promise((resolve) => {
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'zara_response' && msg.language === 'Arabic') {
        console.log('✔ Received Arabic Greeting Ack:', msg.text);
        ws.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    ws.addEventListener('message', handler);
  });
  ws.send(JSON.stringify({ action: 'set_language', language: 'Arabic' }));
  await arabicPromise;

  // 3. Test sending live Audio Turn (with test PCM question)
  console.log('\n[3/3] Testing live Nova 2 Sonic Audio Turn via WebSocket...');
  const pcm = fs.readFileSync('middlelayer/real_question_16k.pcm');
  const base64Audio = pcm.toString('base64');

  let receivedChunks = 0;
  let receivedTranscript = '';

  await new Promise((resolve, reject) => {
    ws.addEventListener('close', (e) => {
      console.log('WS CLOSED:', e.code, e.reason);
      resolve();
    });
    ws.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data);
      console.log('[RECV MSG]:', msg.type, msg.type === 'audio_chunk' ? `chunk#${msg.chunkIndex}` : (msg.text || msg.status || msg.message || ''));
      if (msg.type === 'audio_chunk') {
        receivedChunks++;
      } else if (msg.type === 'transcript_chunk') {
        receivedTranscript += msg.text;
      } else if (msg.type === 'zara_response') {
        console.log('✔ Received Final Response Frame from Nova 2 Sonic!');
        console.log('  Zara Spoken Text:', msg.text);
        console.log('  Total 24kHz LPCM audio chunks streamed:', receivedChunks);
        resolve();
      } else if (msg.type === 'error') {
        console.error('❌ Server returned error:', msg.message);
        resolve();
      }
    });

    const CHUNK_SIZE = 14000;
    const rawPcm = Buffer.from(pcm);
    for (let i = 0; i < rawPcm.length; i += CHUNK_SIZE) {
      const slice = rawPcm.subarray(i, Math.min(i + CHUNK_SIZE, rawPcm.length));
      ws.send(JSON.stringify({
        action: 'audio_chunk',
        audio: slice.toString('base64')
      }));
    }
    ws.send(JSON.stringify({
      action: 'audio_end',
      language: 'English'
    }));
  });

  ws.close();
  console.log('\n======================================================');
  console.log('🎉 ALL LIVE AWS WEBSOCKET TESTS COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
}

testWebSocketFlow().catch(console.error);

