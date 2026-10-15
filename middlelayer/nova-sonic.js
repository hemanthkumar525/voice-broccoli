import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import crypto from 'crypto';
import { executeRestaurantLookup } from './n8n.js';

const SONIC_MODEL_ID = process.env.BEDROCK_SONIC_MODEL_ID || 'amazon.nova-2-sonic-v1:0';

/**
 * Creates an appropriately configured BedrockRuntimeClient for Lambda or local dev.
 */
function createBedrockClient() {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  // Local testing support: export credentials from profile if static keys not present
  if (!process.env.AWS_ACCESS_KEY_ID) {
    try {
      // Dynamic import to avoid issues in Lambda
      const { execSync } = require('child_process');
      const creds = JSON.parse(execSync('aws configure export-credentials --profile voiceagent --output json').toString());
      return new BedrockRuntimeClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.SessionToken
        }
      });
    } catch {
      // Fallback to default credentials
    }
  }

  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
}

const client = createBedrockClient();

export const ZARA_PRODUCTION_SYSTEM_PROMPT = `
You are Zara, the friendly, professional, natural-sounding voice receptionist for Broccoli Pizza & Pasta at broccoli.ae.
Your job is to help customers with menu questions, prices, sizes, product details, branch information, franchise enquiries, restaurant information, and supported order inquiries.

Speak naturally and concisely. Usually use one or two short sentences at a time. Ask one question at a time. Avoid long monologues, robotic wording, markdown formatting, and unnecessary explanations.

LANGUAGE ENFORCEMENT:
Use the language explicitly selected for the current session.
If the customer selected Hindi, speak strictly in natural, conversational Hindi script. Never speak in English.
If the customer selected Arabic, speak strictly in natural UAE Arabic script (العربية). Never speak in English.
If the customer selected English, speak warmly in English.
Change language immediately when the customer or interface specifies a new language. Never speak in the previously selected language after a language shift.

ACCURACY & LIVE DATA:
Use broccoli_restaurant_lookup for all live restaurant data. Never invent prices, menu items, ingredients, offers, branch locations, opening hours, or franchise terms. Treat tool results as the source of truth.
If the tool returns multiple sizes with prices (e.g. Small, Medium, Large), tell the customer the available sizes and ask which one they prefer.

BRANCHES & FRANCHISE:
The official franchise email is sales@broccoli.ae. Never invent franchise fees or promises.

ORDER INQUIRIES:
For order status checks, always ask the customer for their order reference number or receipt number before looking up order details.
`;

const RESTAURANT_LOOKUP_TOOL_SPEC = {
  toolSpec: {
    name: 'broccoli_restaurant_lookup',
    description: 'Unified lookup tool for Broccoli Pizza & Pasta UAE. Queries live restaurant menu prices in AED, sizes, current offers (like 50% off), UAE branch locations & hours, official franchise details, and order tracking.',
    inputSchema: {
      json: JSON.stringify({
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['menu_lookup', 'branch_lookup', 'franchise_inquiry', 'order_info', 'restaurant_info'],
            description: 'Operation category'
          },
          action: {
            type: 'string',
            enum: ['price_lookup', 'product_details', 'list_branches', 'branch_details', 'franchise_details', 'order_status', 'general_info'],
            description: 'Action to perform'
          },
          product_name: {
            type: 'string',
            description: 'Menu item name (e.g. Vegetable Pizza, Super Chicken Pizza, Beef Strips Pasta, Alfredo Pasta)'
          },
          size: {
            type: 'string',
            description: 'Size of the pizza or dish if mentioned (e.g. Small, Medium, Large)'
          },
          branch: {
            type: 'string',
            description: 'UAE restaurant branch name (e.g. Dubai - DIFC, TECOM, Al Twar 2, Khalidiyah)'
          },
          query: {
            type: 'string',
            description: 'Natural language search query'
          },
          order_id: {
            type: 'string',
            description: 'Customer order reference number'
          }
        },
        required: ['operation', 'action']
      })
    }
  }
};

/**
 * Maps language code to Nova 2 Sonic voice ID.
 */
export function getVoiceIdForLanguage(language = 'English') {
  const lang = (language || '').toLowerCase();
  if (lang.includes('hindi') || lang === 'hi') {
    return 'kiara'; // Female Hindi voice on Nova 2 Sonic
  }
  return 'tiffany'; // Female English / Polyglot voice
}

/**
 * Handles a voice interaction turn with Amazon Nova 2 Sonic via bidirectional streaming.
 * @param {Object} params
 * @param {Buffer} params.pcmAudioBuffer - 16kHz 16-bit mono PCM audio buffer from client mic
 * @param {string} params.language - Selected language ('English', 'Hindi', 'Arabic')
 * @param {Function} params.onAudioChunk - Callback for incremental 24kHz LPCM audio chunks (base64)
 * @param {Function} params.onTranscriptChunk - Callback for assistant incremental text transcripts
 * @param {Function} params.onUserTranscript - Callback for user speech-to-text transcript
 * @param {Function} params.onToolCall - Callback when tool is invoked
 */
export async function streamNova2SonicTurn({
  pcmAudioBuffer,
  language = 'English',
  onAudioChunk = () => {},
  onTranscriptChunk = () => {},
  onUserTranscript = () => {},
  onToolCall = () => {}
}) {
  const promptName = 'prompt-' + crypto.randomUUID();
  const sysContentName = 'sys-' + crypto.randomUUID();
  const audioContentName = 'aud-' + crypto.randomUUID();
  const voiceId = getVoiceIdForLanguage(language);

  // Append 800ms of trailing silence (25,600 bytes) so Nova 2 Sonic VAD triggers userSpeechEnd cleanly
  const trailingSilence = Buffer.alloc(25600);
  const fullAudioBuffer = Buffer.concat([pcmAudioBuffer, trailingSilence]);

  // Queue to inject asynchronous tool results into the input stream generator
  const toolResultsQueue = [];
  let streamDone = false;

  async function* inputGenerator() {
    // 1. sessionStart
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            sessionStart: {
              inferenceConfiguration: {
                maxTokens: 512,
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
              },
              toolUseOutputConfiguration: { mediaType: 'application/json' },
              toolConfiguration: {
                tools: [RESTAURANT_LOOKUP_TOOL_SPEC]
              }
            }
          }
        }))
      }
    };

    // 3. SYSTEM Content Block
    let langPrompt = ZARA_PRODUCTION_SYSTEM_PROMPT;
    const langNormalized = (language || '').toLowerCase();
    if (langNormalized.includes('hindi') || langNormalized === 'hi') {
      langPrompt += '\nCRITICAL: The customer selected Hindi. You MUST converse, reason, and reply strictly in natural conversational Hindi. Do not speak English.';
    } else if (langNormalized.includes('arabic') || langNormalized === 'ar') {
      langPrompt += '\nCRITICAL: The customer selected Arabic. You MUST converse, reason, and reply strictly in natural UAE Arabic (العربية). Do not speak English.';
    } else {
      langPrompt += '\nCRITICAL: The customer selected English. Converse warmly in concise English.';
    }

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
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
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            textInput: {
              promptName,
              contentName: sysContentName,
              content: langPrompt
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
              promptName,
              contentName: sysContentName
            }
          }
        }))
      }
    };

    // 4. USER Audio Content Block (16kHz PCM audio stream)
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
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
        }))
      }
    };

    // Slice input buffer into ~100ms (3200 bytes) chunks with real-time pacing
    const CHUNK_SIZE = 3200;
    for (let offset = 0; offset < fullAudioBuffer.length; offset += CHUNK_SIZE) {
      const slice = fullAudioBuffer.subarray(offset, Math.min(offset + CHUNK_SIZE, fullAudioBuffer.length));
      yield {
        chunk: {
          bytes: Buffer.from(JSON.stringify({
            event: {
              audioInput: {
                promptName,
                contentName: audioContentName,
                content: slice.toString('base64')
              }
            }
          }))
        }
      };
      await new Promise((r) => setTimeout(r, 35));
    }

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentEnd: {
              promptName,
              contentName: audioContentName
            }
          }
        }))
      }
    };

    // Keep yielding any tool results or wait until the assistant finishes speaking (max 12s)
    const waitStartTime = Date.now();
    while (!streamDone && Date.now() - waitStartTime < 12000) {
      if (toolResultsQueue.length > 0) {
        const item = toolResultsQueue.shift();
        yield item;
      }
      await new Promise((r) => setTimeout(r, 25));
    }

    // 5. promptEnd cleanly closes the prompt after assistant has finished
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

  const command = new InvokeModelWithBidirectionalStreamCommand({
    modelId: SONIC_MODEL_ID,
    body: inputGenerator()
  });

  const response = await client.send(command);
  let assistantTranscript = '';
  let userTranscript = '';
  let audioChunksTotal = 0;

  for await (const streamEvent of response.body) {
    if (streamEvent.chunk?.bytes) {
      const rawStr = Buffer.from(streamEvent.chunk.bytes).toString('utf-8');
      try {
        const parsed = JSON.parse(rawStr);
        const eventKey = Object.keys(parsed.event || {})[0];

        if (eventKey === 'audioOutput') {
          const base64Pcm = parsed.event.audioOutput.content || '';
          audioChunksTotal++;
          onAudioChunk(base64Pcm, audioChunksTotal);
        } else if (eventKey === 'textOutput') {
          const role = parsed.event.textOutput.role;
          const textPiece = parsed.event.textOutput.content || '';
          if (role === 'USER') {
            userTranscript += textPiece;
            onUserTranscript(textPiece, userTranscript);
          } else {
            assistantTranscript += textPiece;
            onTranscriptChunk(textPiece, assistantTranscript);
          }
        } else if (eventKey === 'toolUse') {
          const toolUse = parsed.event.toolUse;
          const toolName = toolUse.toolName || toolUse.name;
          console.log(`[NOVA-SONIC] Tool use requested: ${toolName}`, toolUse.content);
          onToolCall(toolUse);

          let inputArgs = {};
          try {
            inputArgs = typeof toolUse.content === 'string' ? JSON.parse(toolUse.content) : (toolUse.content || {});
          } catch (e) {
            inputArgs = {};
          }

          let toolResultPayload;
          if (toolName === 'broccoli_restaurant_lookup') {
            toolResultPayload = await executeRestaurantLookup(inputArgs, toolUse.toolUseId);
          } else {
            toolResultPayload = { success: false, error: 'UNKNOWN_TOOL', message: `Tool ${toolName} not found` };
          }

          const toolContentName = 'toolres-' + crypto.randomUUID();

          // 1. contentStart for TOOL
          toolResultsQueue.push({
            chunk: {
              bytes: Buffer.from(JSON.stringify({
                event: {
                  contentStart: {
                    promptName,
                    contentName: toolContentName,
                    type: 'TOOL',
                    role: 'TOOL',
                    toolResultInputConfiguration: {
                      toolUseId: toolUse.toolUseId,
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

          // 2. toolResult
          toolResultsQueue.push({
            chunk: {
              bytes: Buffer.from(JSON.stringify({
                event: {
                  toolResult: {
                    promptName,
                    contentName: toolContentName,
                    content: JSON.stringify(toolResultPayload)
                  }
                }
              }))
            }
          });

          // 3. contentEnd for TOOL
          toolResultsQueue.push({
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
        } else if (eventKey === 'contentEnd') {
          const endObj = parsed.event.contentEnd || {};
          console.log('[NOVA-SONIC] contentEnd received:', JSON.stringify(endObj), 'audioChunksTotal:', audioChunksTotal);
          // When assistant finishes its spoken turn or token limit reached
          if (endObj.stopReason === 'END_TURN' || endObj.stopReason === 'MAX_TOKENS' || (endObj.type === 'AUDIO' && audioChunksTotal > 0)) {
            streamDone = true;
          }
        } else if (eventKey === 'completionEnd') {
          console.log('[NOVA-SONIC] completionEnd received:', JSON.stringify(parsed.event.completionEnd));
          streamDone = true;
        }
      } catch (err) {
        console.warn('[NOVA-SONIC] Parsing event chunk notice:', err.message);
      }
    }
  }

  streamDone = true;

  return {
    transcript: assistantTranscript.trim(),
    userTranscript: userTranscript.trim(),
    totalAudioChunks: audioChunksTotal
  };
}

/**
 * Generates an initial spoken greeting directly from Amazon Nova 2 Sonic (Speech-to-Speech).
 * Replaces any offline synthetic Polly audio with live model audio.
 */
export async function streamNova2SonicGreeting({
  language = 'English',
  onAudioChunk = () => {},
  onTranscriptChunk = () => {}
}) {
  const promptName = 'greet-' + crypto.randomUUID();
  const sysContentName = 'sys-' + crypto.randomUUID();
  const audioContentName = 'audio-' + crypto.randomUUID();
  const voiceId = getVoiceIdForLanguage(language);

  const langGreetingPrompts = {
    Hindi: 'नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद करूँ?',
    Arabic: 'أهلاً بك! أنا زارا، مرحباً بك في بروكلي بيتزا وبستا. كيف يمكنني مساعدتك اليوم؟',
    English: "Hello! Welcome to Broccoli Pizza & Pasta. I'm Zara! How can I help you today?"
  };

  const greetingRequest = langGreetingPrompts[language] || langGreetingPrompts.English;
  let streamDone = false;

  async function* greetingGenerator() {
    // 1. sessionStart
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            sessionStart: {
              inferenceConfiguration: {
                maxTokens: 128,
                temperature: 0.6,
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

    // 3. SYSTEM content block
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
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
        }))
      }
    };

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            textInput: {
              promptName,
              contentName: sysContentName,
              content: `${ZARA_PRODUCTION_SYSTEM_PROMPT}\n\nTASK: Speak this exact warm greeting cheerful and friendly: "${greetingRequest}"`
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
              promptName,
              contentName: sysContentName
            }
          }
        }))
      }
    };

    // 4. USER audio content block (required by Nova 2 Sonic)
    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
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
        }))
      }
    };

    // 500ms of 16kHz 16-bit mono silence (16000 bytes) sliced into ~100ms (3200-byte) chunks
    const silentPcm = Buffer.alloc(16000, 0);
    const CHUNK_SIZE = 3200;
    for (let offset = 0; offset < silentPcm.length; offset += CHUNK_SIZE) {
      const slice = silentPcm.subarray(offset, Math.min(offset + CHUNK_SIZE, silentPcm.length));
      yield {
        chunk: {
          bytes: Buffer.from(JSON.stringify({
            event: {
              audioInput: {
                promptName,
                contentName: audioContentName,
                content: slice.toString('base64')
              }
            }
          }))
        }
      };
      await new Promise((r) => setTimeout(r, 20));
    }

    yield {
      chunk: {
        bytes: Buffer.from(JSON.stringify({
          event: {
            contentEnd: {
              promptName,
              contentName: audioContentName
            }
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
            promptEnd: {
              promptName
            }
          }
        }))
      }
    };
  }

  const command = new InvokeModelWithBidirectionalStreamCommand({
    modelId: SONIC_MODEL_ID,
    body: greetingGenerator()
  });

  const response = await client.send(command);
  let assistantTranscript = '';
  let audioChunksTotal = 0;

  for await (const streamEvent of response.body) {
    if (streamEvent.chunk?.bytes) {
      try {
        const parsed = JSON.parse(Buffer.from(streamEvent.chunk.bytes).toString('utf-8'));
        const eventKey = Object.keys(parsed.event || {})[0];

        if (eventKey === 'audioOutput') {
          const base64Pcm = parsed.event.audioOutput.content || '';
          audioChunksTotal++;
          onAudioChunk(base64Pcm, audioChunksTotal);
        } else if (eventKey === 'textOutput') {
          if (parsed.event.textOutput.role === 'ASSISTANT') {
            const piece = parsed.event.textOutput.content || '';
            assistantTranscript += piece;
            onTranscriptChunk(piece, assistantTranscript);
          }
        } else if (eventKey === 'contentEnd' && parsed.event.contentEnd.stopReason === 'END_TURN') {
          streamDone = true;
        } else if (eventKey === 'completionEnd') {
          streamDone = true;
        }
      } catch (err) {
        console.warn('[NOVA-GREETING] Parse chunk notice:', err.message);
      }
    }
  }

  streamDone = true;

  const defaultFallbacks = {
    Hindi: 'नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद करूँ?',
    Arabic: 'أهلاً بك! أنا زارا، مرحباً بك في بروكلي بيتزا وبستا. كيف يمكنني مساعدتك اليوم؟',
    English: "Hello! Welcome to Broccoli Pizza & Pasta. I'm Zara! How can I help you today?"
  };

  return {
    transcript: assistantTranscript.trim() || defaultFallbacks[language] || defaultFallbacks.English,
    totalAudioChunks: audioChunksTotal
  };
}
