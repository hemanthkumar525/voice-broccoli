import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { execSync } from 'child_process';
import crypto from 'crypto';

const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());

const client = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken
  }
});

async function testTextOnly() {
  const promptName = 'prompt-' + crypto.randomUUID();
  const systemContentName = 'sys-' + crypto.randomUUID();
  const userContentName = 'user-' + crypto.randomUUID();

  async function* generateInputChunks() {
    // 1. sessionStart
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            sessionStart: {
              inferenceConfiguration: {
                maxTokens: 256,
                temperature: 0.7,
                topP: 0.9
              }
            }
          }
        }))
      }
    };

    // 2. promptStart
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            promptStart: {
              promptName: promptName,
              textOutputConfiguration: {
                mediaType: 'text/plain'
              },
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
        }))
      }
    };

    // 3. SYSTEM content
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentStart: {
              promptName: promptName,
              contentName: systemContentName,
              type: 'TEXT',
              interactive: false,
              role: 'SYSTEM',
              textInputConfiguration: { mediaType: 'text/plain' }
            }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            textInput: {
              promptName: promptName,
              contentName: systemContentName,
              content: 'You are Zara, the official friendly voice assistant for Broccoli Pizza & Pasta UAE. Reply in 1 short cheerful sentence.'
            }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentEnd: {
              promptName: promptName,
              contentName: systemContentName
            }
          }
        }))
      }
    };

    // 4. USER text
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentStart: {
              promptName: promptName,
              contentName: userContentName,
              type: 'TEXT',
              interactive: true,
              role: 'USER',
              textInputConfiguration: { mediaType: 'text/plain' }
            }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            textInput: {
              promptName: promptName,
              contentName: userContentName,
              content: 'What is your specialty pizza dish?'
            }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentEnd: {
              promptName: promptName,
              contentName: userContentName
            }
          }
        }))
      }
    };

    // 5. promptEnd
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            promptEnd: {
              promptName: promptName
            }
          }
        }))
      }
    };
  }

  try {
    console.log('Sending text-only prompt to amazon.nova-2-sonic-v1:0...');
    const command = new InvokeModelWithBidirectionalStreamCommand({
      modelId: 'amazon.nova-2-sonic-v1:0',
      body: generateInputChunks()
    });

    const response = await client.send(command);
    console.log('Stream open! Reading events...');

    let textAcc = '';
    let audioBytesCount = 0;

    for await (const streamEvent of response.body) {
      if (streamEvent.chunk?.bytes) {
        const rawStr = Buffer.from(streamEvent.chunk.bytes).toString('utf-8');
        try {
          const parsed = JSON.parse(rawStr);
          const eventKey = Object.keys(parsed.event || {})[0];

          if (eventKey === 'textOutput') {
            const piece = parsed.event.textOutput.content || '';
            process.stdout.write(piece);
            textAcc += piece;
          } else if (eventKey === 'audioOutput') {
            const audioBase64 = parsed.event.audioOutput.content || '';
            audioBytesCount += audioBase64.length;
          } else {
            console.log(`[Event: ${eventKey}]`);
          }
        } catch (e) {
          console.log('Raw:', rawStr.slice(0, 100));
        }
      }
    }

    console.log('\n\n--- Result ---');
    console.log('Text from Nova 2 Sonic:', textAcc);
    console.log('Audio bytes generated by Nova 2 Sonic:', audioBytesCount);
  } catch (err) {
    console.error('Test error:', err);
  }
}

testTextOnly();

