import fs from 'fs';
import crypto from 'crypto';
import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { execSync } from 'child_process';

const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());
const client = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken
  }
});

const pcm = fs.readFileSync('middlelayer/test_16k.pcm');
const promptName = 'prompt-' + crypto.randomUUID();
const sysContentName = 'sys-' + crypto.randomUUID();
const audioContentName = 'aud-' + crypto.randomUUID();

async function* chunks() {
  const sessionStart = {
    event: {
      sessionStart: {
        inferenceConfiguration: {
          maxTokens: 256,
          temperature: 0.7,
          topP: 0.9
        }
      }
    }
  };
  yield { chunk: { bytes: Buffer.from(JSON.stringify(sessionStart)) } };

  const promptStart = {
    event: {
      promptStart: {
        promptName,
        textOutputConfiguration: { mediaType: 'text/plain' },
        audioOutputConfiguration: {
          mediaType: 'audio/lpcm',
          sampleRateHertz: 24000,
          sampleSizeBits: 16,
          channelCount: 1,
          voiceId: 'tiffany',
          encoding: 'base64',
          audioType: 'SPEECH'
        }
      }
    }
  };
  yield { chunk: { bytes: Buffer.from(JSON.stringify(promptStart)) } };

  // 1. SYSTEM Content (REQUIRED as first content!)
  yield { chunk: { bytes: Buffer.from(JSON.stringify({
    event: {
      contentStart: {
        promptName,
        contentName: sysContentName,
        type: 'TEXT',
        interactive: false,
        role: 'SYSTEM',
        textInputConfiguration: { mediaType: 'text/plain' }
      }
    }
  })) } };

  yield { chunk: { bytes: Buffer.from(JSON.stringify({
    event: {
      textInput: {
        promptName,
        contentName: sysContentName,
        content: 'You are Zara, the friendly voice assistant for Broccoli Pizza & Pasta UAE. Reply in 1 short cheerful sentence.'
      }
    }
  })) } };

  yield { chunk: { bytes: Buffer.from(JSON.stringify({
    event: {
      contentEnd: {
        promptName,
        contentName: sysContentName
      }
    }
  })) } };

  // 2. USER Audio Content
  yield { chunk: { bytes: Buffer.from(JSON.stringify({
    event: {
      contentStart: {
        promptName,
        contentName: audioContentName,
        type: 'AUDIO',
        interactive: true,
        role: 'USER',
        audioInputConfiguration: {
          mediaType: 'audio/lpcm',
          sampleRateHertz: 16000,
          sampleSizeBits: 16,
          channelCount: 1,
          encoding: 'base64'
        }
      }
    }
  })) } };

  const CHUNK_LEN = 3200; // 100ms chunks
  for (let offset = 0; offset < pcm.length; offset += CHUNK_LEN) {
    const slice = pcm.subarray(offset, Math.min(offset + CHUNK_LEN, pcm.length));
    yield { chunk: { bytes: Buffer.from(JSON.stringify({
      event: {
        audioInput: {
          promptName,
          contentName: audioContentName,
          content: slice.toString('base64')
        }
      }
    })) } };
  }

  yield { chunk: { bytes: Buffer.from(JSON.stringify({
    event: {
      contentEnd: {
        promptName,
        contentName: audioContentName
      }
    }
  })) } };

  yield { chunk: { bytes: Buffer.from(JSON.stringify({
    event: {
      promptEnd: {
        promptName
      }
    }
  })) } };
}

async function run() {
  console.log('Sending audio PCM to Nova 2 Sonic...');
  const command = new InvokeModelWithBidirectionalStreamCommand({
    modelId: 'amazon.nova-2-sonic-v1:0',
    body: chunks()
  });
  const res = await client.send(command);
  console.log('Stream opened! Reading response events:');
  for await (const ev of res.body) {
    if (ev.chunk?.bytes) {
      const parsed = JSON.parse(Buffer.from(ev.chunk.bytes).toString());
      const k = Object.keys(parsed.event || {})[0];
      if (k === 'textOutput') {
        process.stdout.write(parsed.event.textOutput.content || '');
      } else if (k === 'audioOutput') {
        process.stdout.write(`[AUDIO:${parsed.event.audioOutput.content.length}]`);
      } else {
        console.log('\n[Event]', k, parsed.event[k]);
      }
    }
  }
}
run().catch(console.error);

