import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { execSync } from 'child_process';

const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());

const polly = new PollyClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken
  }
});

async function test() {
  console.log('Testing Danielle Generative Voice with SSML...');
  try {
    const text = '<speak><prosody volume="+6dB" rate="105%">Hello! Welcome to Broccoli Pizza &amp; Pasta UAE. I am Zara, how can I help you today?</prosody></speak>';
    const res = await polly.send(new SynthesizeSpeechCommand({
      Text: text,
      TextType: 'ssml',
      VoiceId: 'Danielle',
      Engine: 'generative',
      OutputFormat: 'mp3'
    }));
    console.log('✔ Danielle Generative SUCCESS! AudioStream returned:', Boolean(res.AudioStream));
  } catch (e) {
    console.log('❌ Danielle Generative error:', e.message);
  }

  console.log('Testing Tiffany Generative Voice...');
  try {
    const text = 'Hello! Welcome to Broccoli Pizza and Pasta UAE. I am Zara, how can I help you today?';
    const res = await polly.send(new SynthesizeSpeechCommand({
      Text: text,
      TextType: 'text',
      VoiceId: 'Tiffany',
      Engine: 'generative',
      OutputFormat: 'mp3'
    }));
    console.log('✔ Tiffany Generative SUCCESS! AudioStream returned:', Boolean(res.AudioStream));
  } catch (e) {
    console.log('❌ Tiffany Generative error:', e.message);
  }
}

test();

