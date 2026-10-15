import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { execSync } from 'child_process';
import fs from 'fs';

const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());

const polly = new PollyClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken
  }
});

async function main() {
  console.log('Generating pre-cached instant Tiffany greeting...');
  const text = '<speak><prosody volume="+6dB" rate="103%">Hello! Welcome to Broccoli Pizza and Pasta. I am Zara! Which language would you prefer to speak in? English, Arabic, or Hindi?</prosody></speak>';
  const res = await polly.send(new SynthesizeSpeechCommand({
    Text: text,
    TextType: 'ssml',
    VoiceId: 'Tiffany',
    Engine: 'generative',
    OutputFormat: 'mp3'
  }));

  const chunks = [];
  for await (const chunk of res.AudioStream) {
    chunks.push(chunk);
  }
  const buf = Buffer.concat(chunks);
  fs.writeFileSync('greeting_tiffany.base64', buf.toString('base64'));
  console.log('✔ Generated greeting_tiffany.base64, size in bytes:', buf.length);
}

main().catch(console.error);

