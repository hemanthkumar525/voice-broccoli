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
  console.log('Testing Arabic Hala...');
  const arRes = await polly.send(new SynthesizeSpeechCommand({
    Text: '<speak><prosody volume="+6dB">أهلاً بك! أنا زارا، كيف يمكنني مساعدتك اليوم في بروكلي بيتزا وبستا؟</prosody></speak>',
    TextType: 'ssml',
    VoiceId: 'Hala',
    Engine: 'neural',
    OutputFormat: 'mp3'
  }));
  const arChunks = [];
  for await (const chunk of arRes.AudioStream) arChunks.push(chunk);
  const arBuf = Buffer.concat(arChunks);
  fs.writeFileSync('greeting_arabic.base64', arBuf.toString('base64'));
  console.log('✔ Arabic Hala SUCCESS! Bytes:', arBuf.length);

  console.log('Testing Hindi Kajal...');
  const hiRes = await polly.send(new SynthesizeSpeechCommand({
    Text: '<speak><prosody volume="+6dB">नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?</prosody></speak>',
    TextType: 'ssml',
    VoiceId: 'Kajal',
    Engine: 'neural',
    OutputFormat: 'mp3'
  }));
  const hiChunks = [];
  for await (const chunk of hiRes.AudioStream) hiChunks.push(chunk);
  const hiBuf = Buffer.concat(hiChunks);
  fs.writeFileSync('greeting_hindi.base64', hiBuf.toString('base64'));
  console.log('✔ Hindi Kajal SUCCESS! Bytes:', hiBuf.length);
}

main().catch(console.error);

