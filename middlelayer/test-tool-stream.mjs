import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { execSync } from 'child_process';
import crypto from 'crypto';

const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());
const client = new BedrockRuntimeClient({ region: 'us-east-1', credentials: { accessKeyId: creds.AccessKeyId, secretAccessKey: creds.SecretAccessKey, sessionToken: creds.SessionToken } });
const polly = new PollyClient({ region: 'us-east-1', credentials: { accessKeyId: creds.AccessKeyId, secretAccessKey: creds.SecretAccessKey, sessionToken: creds.SessionToken } });

const pRes = await polly.send(new SynthesizeSpeechCommand({
  Text: 'How much is the large Vegetable Pizza at your DIFC branch?',
  VoiceId: 'Danielle', Engine: 'generative', OutputFormat: 'pcm', SampleRate: '16000'
}));
const chunksArr = [];
for await (const c of pRes.AudioStream) chunksArr.push(c);
const pcm = Buffer.concat(chunksArr);
const silence = Buffer.alloc(48000); // 1.5s trailing silence
const fullAudio = Buffer.concat([pcm, silence]);

const promptName = 'prompt-' + crypto.randomUUID();
const sysContentName = 'sys-' + crypto.randomUUID();
const audioContentName = 'aud-' + crypto.randomUUID();

const toolSpec = {
  toolSpec: {
    name: 'broccoli_restaurant_lookup',
    description: 'Unified lookup tool for Broccoli Pizza & Pasta UAE prices, menu, branches.',
    inputSchema: {
      json: JSON.stringify({
        type: 'object',
        properties: {
          operation: { type: 'string' },
          action: { type: 'string' },
          product_name: { type: 'string' },
          size: { type: 'string' },
          branch: { type: 'string' }
        },
        required: ['operation', 'action']
      })
    }
  }
};

const toolQueue = [];
let streamDone = false;

async function* chunks() {
  yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { sessionStart: { inferenceConfiguration: { maxTokens: 256, temperature: 0.7, topP: 0.9 } } } })) } };
  yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { promptStart: {
    promptName,
    textOutputConfiguration: { mediaType: 'text/plain' },
    audioOutputConfiguration: { mediaType: 'audio/lpcm', sampleRateHertz: 24000, sampleSizeBits: 16, channelCount: 1, voiceId: 'tiffany', encoding: 'base64', audioType: 'SPEECH' },
    toolUseOutputConfiguration: { mediaType: 'application/json' },
    toolConfiguration: { tools: [toolSpec] }
  } } })) } };
  yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { contentStart: { promptName, contentName: sysContentName, type: 'TEXT', interactive: false, role: 'SYSTEM', textInputConfiguration: { mediaType: 'text/plain' } } } })) } };
  yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { textInput: { promptName, contentName: sysContentName, content: 'You are Zara, the voice assistant for Broccoli Pizza & Pasta UAE. For prices, use broccoli_restaurant_lookup tool. Answer in 1 short cheerful sentence.' } } })) } };
  yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { contentEnd: { promptName, contentName: sysContentName } } })) } };
  yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { contentStart: { promptName, contentName: audioContentName, type: 'AUDIO', interactive: true, role: 'USER', audioInputConfiguration: { mediaType: 'audio/lpcm', sampleRateHertz: 16000, sampleSizeBits: 16, channelCount: 1, encoding: 'base64' } } } })) } };

  const CHUNK_LEN = 3200;
  for (let offset = 0; offset < fullAudio.length; offset += CHUNK_LEN) {
    const slice = fullAudio.subarray(offset, Math.min(offset + CHUNK_LEN, fullAudio.length));
    yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { audioInput: { promptName, contentName: audioContentName, content: slice.toString('base64') } } })) } };
    await new Promise(r => setTimeout(r, 40));
  }
  yield { chunk: { bytes: Buffer.from(JSON.stringify({ event: { contentEnd: { promptName, contentName: audioContentName } } })) } };

  while (!streamDone) {
    if (toolQueue.length > 0) {
      const item = toolQueue.shift();
      console.log('SENDING TOOL RESULT TO STREAM...');
      yield item;
    }
    await new Promise(r => setTimeout(r, 30));
  }

  yield {
    chunk: {
      bytes: Buffer.from(JSON.stringify({
        event: {
          promptEnd: {
            promptName
          }
        }
      }))
    }
  };
}

console.log('Sending question with tool support...');
const res = await client.send(new InvokeModelWithBidirectionalStreamCommand({ modelId: 'amazon.nova-2-sonic-v1:0', body: chunks() }));
console.log('Stream open!');
let spokenText = '', audioCount = 0;
for await (const ev of res.body) {
  if (ev.chunk?.bytes) {
    const parsed = JSON.parse(Buffer.from(ev.chunk.bytes).toString());
    const k = Object.keys(parsed.event || {})[0];
    if (k === 'toolUse') {
      const tu = parsed.event.toolUse;
      console.log('TOOL USE REQUESTED:', tu.toolName, tu.content);
      const fakeResult = {
        success: true,
        product: { name: 'Vegetable Pizza', size: 'Large', price_aed: '28.5 AED', branch: 'Dubai - DIFC' }
      };
      const toolContentName = 'toolres-' + crypto.randomUUID();
      toolQueue.push({
        chunk: {
          bytes: Buffer.from(JSON.stringify({
            event: {
              contentStart: {
                promptName,
                contentName: toolContentName,
                type: 'TOOL',
                role: 'TOOL',
                toolResultInputConfiguration: {
                  toolUseId: tu.toolUseId,
                  type: 'TEXT',
                  textInputConfiguration: {
                    mediaType: 'text/plain'
                  }
                }
              }
            }
          }))
        }
      });
      toolQueue.push({
        chunk: {
          bytes: Buffer.from(JSON.stringify({
            event: {
              toolResult: {
                promptName,
                contentName: toolContentName,
                content: JSON.stringify(fakeResult)
              }
            }
          }))
        }
      });
      toolQueue.push({
        chunk: {
          bytes: Buffer.from(JSON.stringify({
            event: {
              contentEnd: {
                promptName,
                contentName: toolContentName
              }
            }
          }))
        }
      });
    } else if (k === 'textOutput') {
      const role = parsed.event.textOutput.role;
      const text = parsed.event.textOutput.content;
      console.log(`[TEXT ${role}]:`, text);
      if (role === 'ASSISTANT') spokenText += text;
    } else if (k === 'audioOutput') {
      audioCount++;
    } else if (k === 'contentEnd' && parsed.event.contentEnd.stopReason === 'END_TURN') {
      streamDone = true;
    }
  }
}
streamDone = true;
console.log('\nFINAL ASSISTANT SPOKEN TEXT:', spokenText);
console.log('TOTAL AUDIO CHUNKS:', audioCount);

