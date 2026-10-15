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

const promptName = 'p-' + crypto.randomUUID();
const sysName = 'sys-' + crypto.randomUUID();
const userTextName = 'utxt-' + crypto.randomUUID();
const audioName = 'aud-' + crypto.randomUUID();
let streamDone = false;

async function* chunks() {
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            sessionStart: {
              inferenceConfiguration: { maxTokens: 128, temperature: 0.7, topP: 0.9 }
            }
          }
        })
      )
    }
  };

  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
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
        })
      )
    }
  };

  // 1. SYSTEM Content
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            contentStart: {
              promptName,
              contentName: sysName,
              type: 'TEXT',
              interactive: false,
              role: 'SYSTEM',
              textInputConfiguration: { mediaType: 'text/plain' }
            }
          }
        })
      )
    }
  };
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            textInput: {
              promptName,
              contentName: sysName,
              content:
                'You are Zara, receptionist for Broccoli Pizza & Pasta. Welcoming customer warmly.'
            }
          }
        })
      )
    }
  };
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            contentEnd: { promptName, contentName: sysName }
          }
        })
      )
    }
  };

  // 2. USER TEXT Content
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            contentStart: {
              promptName,
              contentName: userTextName,
              type: 'TEXT',
              interactive: false,
              role: 'USER',
              textInputConfiguration: { mediaType: 'text/plain' }
            }
          }
        })
      )
    }
  };
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            textInput: {
              promptName,
              contentName: userTextName,
              content: 'Hello Zara! Please introduce yourself and welcome me.'
            }
          }
        })
      )
    }
  };
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            contentEnd: { promptName, contentName: userTextName }
          }
        })
      )
    }
  };

  // 3. USER AUDIO Content (satisfy Bedrock validation)
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            contentStart: {
              promptName,
              contentName: audioName,
              type: 'AUDIO',
              interactive: false,
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
        })
      )
    }
  };
  // Send 100ms of silence
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            audioInput: {
              promptName,
              contentName: audioName,
              content: Buffer.alloc(3200).toString('base64')
            }
          }
        })
      )
    }
  };
  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            contentEnd: { promptName, contentName: audioName }
          }
        })
      )
    }
  };

  // Wait for Nova Sonic to respond before ending prompt
  const waitStart = Date.now();
  while (!streamDone && Date.now() - waitStart < 15000) {
    await new Promise((r) => setTimeout(r, 50));
  }

  yield {
    chunk: {
      bytes: Buffer.from(
        JSON.stringify({
          event: {
            promptEnd: { promptName }
          }
        })
      )
    }
  };
}

console.log('Sending text prompt + dummy audio to Nova 2 Sonic...');
try {
  const res = await client.send(
    new InvokeModelWithBidirectionalStreamCommand({
      modelId: 'amazon.nova-2-sonic-v1:0',
      body: chunks()
    })
  );
  let audioChunks = 0;
  for await (const ev of res.body) {
    if (ev.chunk?.bytes) {
      const parsed = JSON.parse(Buffer.from(ev.chunk.bytes).toString());
      const k = Object.keys(parsed.event || {})[0];
      if (k === 'audioOutput') audioChunks++;
      if (k === 'textOutput') console.log('TEXT:', parsed.event.textOutput.content);
      if (k === 'contentEnd' && parsed.event.contentEnd.stopReason === 'END_TURN') streamDone = true;
      if (k === 'completionEnd') streamDone = true;
    }
  }
  streamDone = true;
  console.log('Finished! Audio chunks:', audioChunks);
} catch (e) {
  console.error('Error:', e);
}
