process.env.UV_THREADPOOL_SIZE = '64';

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { validateOrigin, validateAuthToken } from './auth.js';
import { generateZaraResponse } from './bedrock.js';
import { streamNova2SonicTurn, streamNova2SonicGreeting } from './nova-sonic.js';
import { triggerN8nWebhook } from './n8n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-cached Nova 2 Sonic natural spoken greetings
let novaGreetings = null;
try {
  const greetingsPath = path.join(__dirname, 'nova_greetings.json');
  if (fs.existsSync(greetingsPath)) {
    novaGreetings = JSON.parse(fs.readFileSync(greetingsPath, 'utf8'));
    console.log('[INIT] Loaded Nova 2 Sonic greetings for en, hi, ar');
  }
} catch (e) {
  console.warn('[INIT] Could not load nova_greetings.json:', e.message);
}

// In-memory buffer for chunked WebSocket audio frames per connectionId
const connectionAudioMap = new Map();
const connectionMetaMap = new Map();

// Persistent API Gateway client pool with HTTP Keep-Alive
const apigwClients = new Map();

function getApigwClient(endpoint) {
  let client = apigwClients.get(endpoint);
  if (!client) {
    client = new ApiGatewayManagementApiClient({
      endpoint,
      region: process.env.AWS_REGION || 'us-east-1',
      requestHandler: new NodeHttpHandler({
        httpsAgent: new https.Agent({
          keepAlive: true,
          maxSockets: 50,
          timeout: 15000,
        })
      })
    });
    apigwClients.set(endpoint, client);
  }
  return client;
}

/**
 * Sends a message frame back to a connected WebSocket client via API Gateway Management API.
 */
async function sendToClient(domainName, stage, connectionId, payload) {
  if (!connectionId) return false;

  const endpoint = domainName && stage ? `https://${domainName}/${stage}` : 'https://15j2wt9hz1.execute-api.us-east-1.amazonaws.com/prod';
  const apigwClient = getApigwClient(endpoint);

  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: Buffer.from(JSON.stringify(payload)),
  });

  try {
    await apigwClient.send(command);
    return true;
  } catch (err) {
    if (err.name === 'GoneException' || err.$metadata?.httpStatusCode === 410) {
      connectionAudioMap.delete(connectionId);
      connectionMetaMap.delete(connectionId);
      return false;
    }
    console.warn(`[WEBSOCKET] Failed to send message to connection ${connectionId}:`, err.message);
    return false;
  }
}

/**
 * Main AWS Lambda Handler
 * Supports API Gateway WebSocket events ($connect, $default, $disconnect)
 * as well as direct HTTP POST invocations via Lambda Function URL.
 */
export const handler = async (event) => {
  // 1. Direct HTTP request (Lambda Function URL or standard HTTP proxy)
  if (event.httpMethod || event.requestContext?.http?.method) {
    const origin = event.headers?.origin || event.headers?.Origin || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    };

    if ((event.httpMethod || event.requestContext?.http?.method) === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders };
    }

    // Origin check
    if (origin && !validateOrigin(origin)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Origin not allowed' })
      };
    }

    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const language = body.language || 'English';
      const connectionId = body.connectionId || null;

      // A. Live Speech-to-Speech Voice Turn (Amazon Nova 2 Sonic)
      if (body.action === 'audio_turn' || body.audio) {
        const base64Audio = body.audio || body.data || '';
        if (!base64Audio) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Empty audio buffer' })
          };
        }

        const pcmBuffer = Buffer.from(base64Audio, 'base64');
        const audioChunks = [];

        console.log(`[HTTP] Processing Nova 2 Sonic voice turn (${pcmBuffer.length} bytes PCM, language: ${language}, targetWs: ${connectionId || 'none'})`);

        // Notify client over WebSocket if connectionId is provided
        if (connectionId) {
          sendToClient(null, null, connectionId, { type: 'status', status: 'thinking' }).catch(() => {});
        }

        const sonicResult = await streamNova2SonicTurn({
          pcmAudioBuffer: pcmBuffer,
          language,
          onAudioChunk: (chunkBase64, chunkIndex) => {
            audioChunks.push(chunkBase64);
            // Immediately stream 24kHz LPCM audio chunk to browser over WebSocket
            if (connectionId) {
              sendToClient(null, null, connectionId, {
                type: 'audio_chunk',
                chunkIndex,
                format: 'lpcm_24k',
                data: chunkBase64
              }).catch(() => {});
            }
          },
          onUserTranscript: (piece, fullUserText) => {
            if (connectionId) {
              sendToClient(null, null, connectionId, {
                type: 'user_transcript',
                text: fullUserText
              }).catch(() => {});
            }
          },
          onTranscriptChunk: (piece) => {
            if (connectionId) {
              sendToClient(null, null, connectionId, {
                type: 'transcript_chunk',
                text: piece
              }).catch(() => {});
            }
          }
        });

        const replyText = sonicResult.transcript || "I'm here! What delicious pizza or pasta can I get for you today?";

        if (connectionId) {
          sendToClient(null, null, connectionId, {
            type: 'zara_response',
            role: 'Zara',
            text: replyText,
            userText: sonicResult.userTranscript,
            hasAudio: audioChunks.length > 0,
            language,
            timestamp: new Date().toISOString()
          }).catch(() => {});
        }

        triggerN8nWebhook('voice_conversation', {
          sessionId: connectionId || 'http-direct',
          userTranscript: sonicResult.userTranscript,
          transcript: replyText,
          language,
          totalAudioChunks: sonicResult.totalAudioChunks,
          hasAudio: true
        }).catch((e) => console.warn('[n8n] Dispatch notice:', e.message));

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'Zara',
            userText: sonicResult.userTranscript,
            text: replyText,
            audioChunks,
            totalAudioChunks: sonicResult.totalAudioChunks,
            hasAudio: audioChunks.length > 0,
            language,
            timestamp: new Date().toISOString()
          })
        };
      }

      // B. Live Greeting Generation via Nova 2 Sonic
      if (body.action === 'greet') {
        const langKey = (language || 'English').toLowerCase().startsWith('hi') ? 'hi' : ((language || 'English').toLowerCase().startsWith('ar') ? 'ar' : 'en');
        const greetingData = novaGreetings?.[langKey];
        const text = greetingData?.transcript || (language === 'Hindi' ? 'नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?' : (language === 'Arabic' ? 'أهلاً بك! أنا زارا، مرحباً بك في بروكلي بيتزا وبستا. كيف يمكنني مساعدتك اليوم؟' : "Hello! Welcome to Broccoli Pizza & Pasta. I'm Zara! How can I help you today?"));
        const audioChunks = greetingData?.audioChunks || [];

        if (connectionId && audioChunks.length > 0) {
          for (let i = 0; i < audioChunks.length; i++) {
            await sendToClient(null, null, connectionId, {
              type: 'audio_chunk',
              chunkIndex: i + 1,
              format: 'lpcm_24k',
              data: audioChunks[i]
            }).catch(() => {});
          }
          await sendToClient(null, null, connectionId, {
            type: 'zara_response',
            role: 'Zara',
            text,
            hasAudio: true,
            language,
            timestamp: new Date().toISOString()
          }).catch(() => {});
        }

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'Zara',
            text,
            audioChunks,
            totalAudioChunks: audioChunks.length,
            hasAudio: audioChunks.length > 0,
            language,
            timestamp: new Date().toISOString()
          })
        };
      }

      // C. Text Turn Fallback
      const userText = (body.text || body.message || 'Hello').trim();
      const history = body.history || [];

      const replyText = await generateZaraResponse(userText, history, language);

      triggerN8nWebhook('http_conversation', {
        userText,
        replyText,
        language,
        sessionId: connectionId || 'http-direct',
        hasAudio: false
      }).catch((e) => console.warn('[n8n] Dispatch notice:', e.message));

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'Zara',
          text: replyText,
          hasAudio: false,
          language,
          timestamp: new Date().toISOString()
        })
      };
    } catch (err) {
      console.error('[HTTP] Error handling request:', err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // 2. API Gateway WebSocket event
  const routeKey = event.requestContext?.routeKey;
  const connectionId = event.requestContext?.connectionId;
  const domainName = event.requestContext?.domainName || '15j2wt9hz1.execute-api.us-east-1.amazonaws.com';
  const stage = event.requestContext?.stage || 'prod';

  console.log(`[WEBSOCKET] Route: ${routeKey}, Connection: ${connectionId}`);

  switch (routeKey) {
    case '$connect': {
      const origin = event.headers?.Origin || event.headers?.origin;
      const token = event.queryStringParameters?.token || event.headers?.Authorization;

      // Validate Origin Whitelist
      if (origin && !validateOrigin(origin)) {
        console.warn(`[AUTH] Connection rejected: unauthorized origin '${origin}'`);
        return { statusCode: 403, body: 'Forbidden origin' };
      }

      // Validate Auth Token (supports DEV_BYPASS or JWT)
      const authResult = validateAuthToken(token);
      if (!authResult.valid) {
        console.warn(`[AUTH] Connection rejected: ${authResult.error}`);
        return { statusCode: 401, body: 'Unauthorized' };
      }

      console.log(`[AUTH] Connection accepted for user:`, authResult.user);
      connectionMetaMap.set(connectionId, { language: 'English', connectedAt: Date.now() });

      return { statusCode: 200, body: 'Connected' };
    }

    case '$disconnect': {
      console.log(`[WEBSOCKET] Client disconnected: ${connectionId}`);
      connectionAudioMap.delete(connectionId);
      connectionMetaMap.delete(connectionId);
      return { statusCode: 200, body: 'Disconnected' };
    }

    case '$default':
    default: {
      try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
        console.log(`[WEBSOCKET] Incoming action='${body.action}', keys=[${Object.keys(body).join(',')}], bodyLen=${typeof event.body === 'string' ? event.body.length : 'obj'}`);
        let meta = connectionMetaMap.get(connectionId) || { language: 'English' };
        const userLanguage = body.language || meta.language || 'English';
        meta.language = userLanguage;
        connectionMetaMap.set(connectionId, meta);

        // 1. Language Selection: stream live greeting from Nova 2 Sonic in chosen language
        if (body.action === 'set_language') {
          console.log(`[WEBSOCKET] Language changed to: ${userLanguage}, preparing Nova 2 Sonic greeting...`);
          await sendToClient(domainName, stage, connectionId, {
            type: 'status',
            status: 'speaking'
          });

          const langKey = (userLanguage || 'English').toLowerCase().startsWith('hi') ? 'hi' : ((userLanguage || 'English').toLowerCase().startsWith('ar') ? 'ar' : 'en');
          const greetingData = novaGreetings?.[langKey];

          let chunkCount = 0;
          let replyText = '';

          if (greetingData && Array.isArray(greetingData.audioChunks) && greetingData.audioChunks.length > 0) {
            replyText = greetingData.transcript;
            const batched = [];
            const raw = greetingData.audioChunks;
            for (let i = 0; i < raw.length; i += 3) {
              const slice = raw.slice(i, i + 3);
              const merged = Buffer.concat(slice.map((c) => Buffer.from(c, 'base64')));
              batched.push(merged.toString('base64'));
            }

            for (let i = 0; i < batched.length; i++) {
              chunkCount++;
              const sent = await sendToClient(domainName, stage, connectionId, {
                type: 'audio_chunk',
                chunkIndex: chunkCount,
                format: 'lpcm_24k',
                data: batched[i]
              });
              if (!sent) break;
              await new Promise((r) => setTimeout(r, 22));
            }
          } else {
            const greetingResult = await streamNova2SonicGreeting({
              language: userLanguage,
              onAudioChunk: async (chunkBase64) => {
                chunkCount++;
                await sendToClient(domainName, stage, connectionId, {
                  type: 'audio_chunk',
                  chunkIndex: chunkCount,
                  format: 'lpcm_24k',
                  data: chunkBase64
                });
              },
              onTranscriptChunk: async (textPiece) => {
                await sendToClient(domainName, stage, connectionId, {
                  type: 'transcript_chunk',
                  text: textPiece
                });
              }
            });
            replyText = greetingResult.transcript;
          }

          await sendToClient(domainName, stage, connectionId, {
            type: 'zara_response',
            role: 'Zara',
            text: replyText,
            hasAudio: chunkCount > 0,
            language: userLanguage,
            timestamp: new Date().toISOString()
          });

          triggerN8nWebhook('voice_conversation', {
            sessionId: connectionId,
            event: 'set_language',
            transcript: replyText,
            language: userLanguage,
            totalAudioChunks: chunkCount,
            hasAudio: chunkCount > 0
          }).catch((e) => console.warn('[n8n] Dispatch notice:', e.message));

          return { statusCode: 200, body: 'OK' };
        }

        // 2. Initial Greeting Request: stream live greeting from Nova 2 Sonic
        if (body.action === 'greet' || (body.text || '').toLowerCase() === 'hello zara' || (body.text || '').toLowerCase() === 'hi zara') {
          console.log(`[WEBSOCKET] Greeting requested, generating live Nova 2 Sonic greeting for: ${userLanguage}...`);
          await sendToClient(domainName, stage, connectionId, {
            type: 'status',
            status: 'speaking'
          });

          const langKey = (userLanguage || 'English').toLowerCase().startsWith('hi') ? 'hi' : ((userLanguage || 'English').toLowerCase().startsWith('ar') ? 'ar' : 'en');
          const greetingData = novaGreetings?.[langKey];

          let chunkCount = 0;
          let replyText = '';

          if (greetingData && Array.isArray(greetingData.audioChunks) && greetingData.audioChunks.length > 0) {
            replyText = greetingData.transcript;
            const batched = [];
            const raw = greetingData.audioChunks;
            for (let i = 0; i < raw.length; i += 3) {
              const slice = raw.slice(i, i + 3);
              const merged = Buffer.concat(slice.map((c) => Buffer.from(c, 'base64')));
              batched.push(merged.toString('base64'));
            }

            for (let i = 0; i < batched.length; i++) {
              chunkCount++;
              const sent = await sendToClient(domainName, stage, connectionId, {
                type: 'audio_chunk',
                chunkIndex: chunkCount,
                format: 'lpcm_24k',
                data: batched[i]
              });
              if (!sent) break;
              await new Promise((r) => setTimeout(r, 22));
            }
          } else {
            const greetingResult = await streamNova2SonicGreeting({
              language: userLanguage,
              onAudioChunk: async (chunkBase64) => {
                chunkCount++;
                await sendToClient(domainName, stage, connectionId, {
                  type: 'audio_chunk',
                  chunkIndex: chunkCount,
                  format: 'lpcm_24k',
                  data: chunkBase64
                });
              },
              onTranscriptChunk: async (textPiece) => {
                await sendToClient(domainName, stage, connectionId, {
                  type: 'transcript_chunk',
                  text: textPiece
                });
              }
            });
            replyText = greetingResult.transcript;
          }

          await sendToClient(domainName, stage, connectionId, {
            type: 'zara_response',
            role: 'Zara',
            text: replyText,
            hasAudio: chunkCount > 0,
            language: userLanguage,
            timestamp: new Date().toISOString()
          });

          triggerN8nWebhook('voice_conversation', {
            sessionId: connectionId,
            event: 'greeting',
            transcript: replyText,
            language: userLanguage,
            totalAudioChunks: chunkCount,
            hasAudio: chunkCount > 0
          }).catch((e) => console.warn('[n8n] Dispatch notice:', e.message));

          return { statusCode: 200, body: 'OK' };
        }

        // 3. Audio Chunk Frame (Buffers incremental chunks to keep frames <= 16KB)
        if (body.action === 'audio_chunk') {
          const chunkData = body.audio || body.data || '';
          if (chunkData) {
            let bufferArr = connectionAudioMap.get(connectionId);
            if (!bufferArr) {
              bufferArr = [];
              connectionAudioMap.set(connectionId, bufferArr);
            }
            bufferArr.push(Buffer.from(chunkData, 'base64'));
          }
          return { statusCode: 200, body: 'OK' };
        }

        // 4. Nova 2 Sonic Audio Turn (audio_end or audio_turn)
        if (body.action === 'audio_end' || body.action === 'audio_turn' || body.audio) {
          const startTime = Date.now();
          let pcmBuffer;

          if (body.action === 'audio_end') {
            const chunks = connectionAudioMap.get(connectionId) || [];
            connectionAudioMap.delete(connectionId);
            if (chunks.length === 0) {
              console.log('[WEBSOCKET] audio_end with no buffered chunks.');
              return { statusCode: 200, body: 'OK' };
            }
            pcmBuffer = Buffer.concat(chunks);
          } else {
            const base64Audio = body.audio || body.data || '';
            if (!base64Audio) {
              console.log('[WEBSOCKET] Empty audio turn payload received.');
              return { statusCode: 200, body: 'OK' };
            }
            pcmBuffer = Buffer.from(base64Audio, 'base64');
          }

          console.log(`[WEBSOCKET] Processing Nova 2 Sonic speech turn (${pcmBuffer.length} bytes PCM, language: ${userLanguage})`);

          await sendToClient(domainName, stage, connectionId, {
            type: 'status',
            status: 'thinking'
          });

          try {
            const sonicResult = await streamNova2SonicTurn({
              pcmAudioBuffer: pcmBuffer,
              language: userLanguage,
              onAudioChunk: async (chunkBase64, chunkIndex) => {
                // Forward 24kHz LPCM audio chunk with gentle pacing to stay comfortably within WebSocket rate limits
                await sendToClient(domainName, stage, connectionId, {
                  type: 'audio_chunk',
                  chunkIndex,
                  format: 'lpcm_24k',
                  data: chunkBase64
                });
                await new Promise((r) => setTimeout(r, 15));
              },
              onUserTranscript: async (textPiece, fullUserText) => {
                await sendToClient(domainName, stage, connectionId, {
                  type: 'user_transcript',
                  text: fullUserText
                });
              },
              onTranscriptChunk: async (textPiece) => {
                await sendToClient(domainName, stage, connectionId, {
                  type: 'transcript_chunk',
                  text: textPiece
                });
              },
              onToolCall: (toolUse) => {
                console.log(`[WEBSOCKET] Nova Sonic invoking tool: ${toolUse.toolName || toolUse.name}`);
              }
            });

            const turnDuration = Date.now() - startTime;
            console.log(`[WEBSOCKET] Nova 2 Sonic turn complete in ${turnDuration}ms. Transcript: "${sonicResult.transcript}", Chunks: ${sonicResult.totalAudioChunks}`);

            const replyText = sonicResult.transcript || "I'm here! What delicious pizza or pasta can I get for you today?";

            // Send final response frame
            await sendToClient(domainName, stage, connectionId, {
              type: 'zara_response',
              role: 'Zara',
              text: replyText,
              userText: sonicResult.userTranscript,
              hasAudio: sonicResult.totalAudioChunks > 0,
              language: userLanguage,
              timestamp: new Date().toISOString()
            });

            triggerN8nWebhook('voice_conversation', {
              sessionId: connectionId,
              userTranscript: sonicResult.userTranscript,
              transcript: replyText,
              language: userLanguage,
              totalAudioChunks: sonicResult.totalAudioChunks,
              durationMs: turnDuration,
              hasAudio: true
            }).catch((e) => console.warn('[n8n] Dispatch notice:', e.message));
          } catch (turnErr) {
            console.error('[WEBSOCKET] Nova 2 Sonic turn error:', turnErr);
            // Graceful response to customer so session never hangs
            await sendToClient(domainName, stage, connectionId, {
              type: 'zara_response',
              role: 'Zara',
              text: "I'm right here! Could you please ask that again?",
              hasAudio: false,
              language: userLanguage,
              timestamp: new Date().toISOString()
            });
          }

          return { statusCode: 200, body: 'OK' };
        }

        // 5. Fallback text conversation (Converse API with n8n tool calling)
        const userText = body.text || body.message || '';
        const cleanUserText = (userText || '').trim();
        const history = body.history || [];

        if (!cleanUserText) {
          console.log('[WEBSOCKET] Received empty text frame, ignoring.');
          return { statusCode: 200, body: 'OK' };
        }

        await sendToClient(domainName, stage, connectionId, {
          type: 'status',
          status: 'thinking'
        });

        const replyText = await generateZaraResponse(cleanUserText, history, userLanguage);

        triggerN8nWebhook('voice_conversation', {
          sessionId: connectionId,
          userText: cleanUserText,
          replyText,
          language: userLanguage,
          hasAudio: false
        }).catch((e) => console.warn('[n8n] Dispatch notice:', e.message));

        await sendToClient(domainName, stage, connectionId, {
          type: 'zara_response',
          role: 'Zara',
          text: replyText,
          hasAudio: false,
          language: userLanguage,
          timestamp: new Date().toISOString()
        });

        return { statusCode: 200, body: 'OK' };
      } catch (err) {
        console.error('[WEBSOCKET] Error processing message:', err);
        await sendToClient(domainName, stage, connectionId, {
          type: 'error',
          message: 'Error processing your request'
        });
        return { statusCode: 500, body: 'Internal Error' };
      }
    }
  }
};
