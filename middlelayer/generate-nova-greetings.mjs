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

const pcmAudio = fs.readFileSync('middlelayer/real_question_16k.pcm');

async function generateNovaGreeting(language, voiceId, promptText) {
  console.log(`Generating Nova 2 Sonic greeting for ${language} (${voiceId})...`);
  const promptName = 'greet-' + crypto.randomUUID();
  const sysName = 'sys-' + crypto.randomUUID();
  const audioName = 'aud-' + crypto.randomUUID();

  let streamDone = false;
  const audioChunks = [];
  let transcript = '';

  async function* chunks() {
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            sessionStart: {
              inferenceConfiguration: { maxTokens: 128, temperature: 0.6, topP: 0.9 }
            }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            promptStart: {
              promptName,
              textOutputConfiguration: { mediaType: 'text/plain' },
              audioOutputConfiguration: {
                mediaType: 'audio/lpcm',
                sampleRateHertz: 24000,
                sampleSizeBits: 16,
                channelCount: 1,
                voiceId,
                encoding: 'base64',
                audioType: 'SPEECH'
              }
            }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
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
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            textInput: {
              promptName,
              contentName: sysName,
              content: `You are Zara, the receptionist at Broccoli Pizza & Pasta UAE.\n\nCRITICAL INSTRUCTION: You MUST speak strictly in ${language}. Do not use any other language. Speak a warm, friendly, natural greeting welcoming the customer to Broccoli Pizza & Pasta in exactly 1 sentence. Say: "${promptText}"`
            }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentEnd: { promptName, contentName: sysName }
          }
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentStart: {
              promptName,
              contentName: audioName,
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
        }))
      }
    };

    const CHUNK_SIZE = 3200;
    for (let offset = 0; offset < pcmAudio.length; offset += CHUNK_SIZE) {
      const slice = pcmAudio.subarray(offset, Math.min(offset + CHUNK_SIZE, pcmAudio.length));
      yield {
        chunk: {
          bytes: Buffer.from(JSON.stringify({
            event: {
              audioInput: {
                promptName,
                contentName: audioName,
                content: slice.toString('base64')
              }
            }
          }))
        }
      };
      await new Promise((r) => setTimeout(r, 30));
    }

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentEnd: { promptName, contentName: audioName }
          }
        }))
      }
    };

    const waitStart = Date.now();
    while (!streamDone && Date.now() - waitStart < 15000) {
      await new Promise((r) => setTimeout(r, 40));
    }

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            promptEnd: { promptName }
          }
        }))
      }
    };
  }

  const res = await client.send(
    new InvokeModelWithBidirectionalStreamCommand({
      modelId: 'amazon.nova-2-sonic-v1:0',
      body: chunks()
    })
  );

  for await (const ev of res.body) {
    if (ev.chunk?.bytes) {
      const parsed = JSON.parse(Buffer.from(ev.chunk.bytes).toString());
      const k = Object.keys(parsed.event || {})[0];
      if (k === 'audioOutput') {
        audioChunks.push(parsed.event.audioOutput.content);
      } else if (k === 'textOutput') {
        if (parsed.event.textOutput.role === 'ASSISTANT') {
          transcript += parsed.event.textOutput.content;
        }
      } else if (k === 'contentEnd' && parsed.event.contentEnd.stopReason === 'END_TURN') {
        streamDone = true;
      } else if (k === 'completionEnd') {
        streamDone = true;
      }
    }
  }

  streamDone = true;
  console.log(`[${language}] Done! Transcript: "${transcript}", Audio chunks: ${audioChunks.length}`);
  return { transcript, audioChunks };
}

async function main() {
  const en = await generateNovaGreeting(
    'English',
    'tiffany',
    "Hello! Welcome to Broccoli Pizza & Pasta. I'm Zara! How can I help you today?"
  );

  const hi = await generateNovaGreeting(
    'Hindi',
    'kiara',
    'नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?'
  );

  const ar = await generateNovaGreeting(
    'Arabic',
    'tiffany',
    'أهلاً بك! أنا زارا، مرحباً بك في بروكلي بيتزا وبستا. كيف يمكنني مساعدتك اليوم؟'
  );

  // Write out as json
  fs.writeFileSync('middlelayer/nova_greetings.json', JSON.stringify({ en, hi, ar }, null, 2));
  console.log('Successfully saved middlelayer/nova_greetings.json!');
}

main().catch(console.error);
