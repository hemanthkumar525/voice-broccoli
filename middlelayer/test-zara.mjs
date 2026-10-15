const ws = new WebSocket('wss://15j2wt9hz1.execute-api.us-east-1.amazonaws.com/prod?token=DEV_BYPASS', {
  headers: { Origin: 'http://localhost:5173' }
});

console.log('Connecting to wss://15j2wt9hz1.execute-api.us-east-1.amazonaws.com/prod...');

let receivedText = '';
let audioChunks = [];
let totalChunksExpected = 0;

ws.onopen = () => {
  console.log('✔ WebSocket Connected Successfully!');
  console.log('Sending message to Zara: "How much is the Vegetable Pizza Large at DIFC?"');
  ws.send(JSON.stringify({
    action: 'message',
    text: 'How much is the Vegetable Pizza Large at DIFC?'
  }));
};

ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    console.log(`✔ Received frame type: ${msg.type}`);
    if (msg.type === 'status') {
      console.log(`  Assistant status: ${msg.status}`);
    } else if (msg.type === 'zara_response') {
      receivedText = msg.text;
      console.log(`\n🎉 Zara's Response:`);
      console.log(`"${msg.text}"`);
      if (!msg.hasAudio) {
        ws.close();
        process.exit(0);
      }
    } else if (msg.type === 'audio_chunk') {
      audioChunks.push(msg.data);
      totalChunksExpected = msg.totalChunks;
      console.log(`  Received audio chunk ${msg.chunkIndex + 1}/${msg.totalChunks} (${msg.data.length} chars)`);

      if (audioChunks.length === totalChunksExpected) {
        const fullAudio = audioChunks.join('');
        console.log(`\n🔊 Audio stream complete! Total Base64 bytes: ${fullAudio.length}`);
        ws.close();
        process.exit(0);
      }
    } else if (msg.type === 'error') {
      console.error(`  Error from Zara:`, msg);
      ws.close();
      process.exit(1);
    }
  } catch (e) {
    console.log('Raw message:', event.data);
  }
};

ws.onerror = (err) => {
  console.error('❌ WebSocket error:', err.message || err);
};

ws.onclose = (event) => {
  console.log(`WebSocket closed: code ${event.code}, reason: "${event.reason}"`);
};

setTimeout(() => {
  console.error('Timed out after 30 seconds waiting for Zara response');
  process.exit(1);
}, 30000);
