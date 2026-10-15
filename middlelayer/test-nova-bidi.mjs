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

async function test() {
  const promptName = 'prompt-' + crypto.randomUUID();
  const systemContentName = 'sys-' + crypto.randomUUID();
  const audioContentName = 'aud-' + crypto.randomUUID();
  const textContentName = 'txt-' + crypto.randomUUID();

  // 100ms of 16kHz silence
  const silentPcm = Buffer.alloc(3200);

  async function* generateInputChunks() {
    // 1. sessionStart
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

    // 2. promptStart
    const promptStart = {
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
    };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(promptStart)) } };

    // 3. SYSTEM content
    const sysStart = {
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
    };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(sysStart)) } };

    const sysText = {
      event: {
        textInput: {
          promptName: promptName,
          contentName: systemContentName,
          content: 'You are Zara, the official voice assistant for Broccoli Pizza & Pasta UAE. Keep answers very brief (1 sentence), warm, and hospitable.'
        }
      }
    };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(sysText)) } };

    const sysEnd = { event: { contentEnd: { promptName: promptName, contentName: systemContentName } } };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(sysEnd)) } };

    // 4. USER audio (required by Nova 2 Sonic)
    const audStart = {
      event: {
        contentStart: {
          promptName: promptName,
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
    };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(audStart)) } };

    const audChunk = {
      event: {
        audioInput: {
          promptName: promptName,
          contentName: audioContentName,
          content: silentPcm.toString('base64')
        }
      }
    };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(audChunk)) } };

    const audEnd = { event: { contentEnd: { promptName: promptName, contentName: audioContentName } } };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(audEnd)) } };

    // 5. USER text
    const txtStart = {
      event: {
        contentStart: {
          promptName: promptName,
          contentName: textContentName,
          type: 'TEXT',
          interactive: true,
          role: 'USER',
          textInputConfiguration: { mediaType: 'text/plain' }
        }
      }
    };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(txtStart)) } };

    const txtInput = {
      event: {
        textInput: {
          promptName: promptName,
          contentName: textContentName,
          content: 'What is your specialty pasta dish?'
        }
      }
    };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(txtInput)) } };

    const txtEnd = { event: { contentEnd: { promptName: promptName, contentName: textContentName } } };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(txtEnd)) } };

    // 6. promptEnd
    const pEnd = { event: { promptEnd: { promptName: promptName } } };
    yield { chunk: { bytes: Buffer.from(JSON.stringify(pEnd)) } };
  }

  try {
    console.log('Sending hybrid text+audio stream to amazon.nova-2-sonic-v1:0...');
    const command = new InvokeModelWithBidirectionalStreamCommand({
      modelId: 'amazon.nova-2-sonic-v1:0',
      body: generateInputChunks()
    });

    const response = await client.send(command);
    console.log('Stream open! Reading events...');

    let textAcc = '';
    let audioBytesCount = 0;

    if (response.body) {
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
    }

    console.log('\n\n--- Result ---');
    console.log('Text:', textAcc);
    console.log('Audio bytes generated by Nova 2 Sonic:', audioBytesCount);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();

