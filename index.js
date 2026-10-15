import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { validateOrigin, validateAuthToken } from './auth.js';
import { generateZaraResponse } from './bedrock.js';
import { streamNova2SonicTurn } from './nova-sonic.js';
import { triggerN8nWebhook } from './n8n.js';

/**
 * Sends a message frame back to a connected WebSocket client.
 */
async function sendToClient(domainName, stage, connectionId, payload) {
  const endpoint = `https://${domainName}/${stage}`;
  const apigwClient = new ApiGatewayManagementApiClient({ endpoint });

  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: Buffer.from(JSON.stringify(payload)),
  });

  try {
    await apigwClient.send(command);
  } catch (err) {
    console.error(`[WEBSOCKET] Failed to send message to connection ${connectionId}:`, err);
  }
}

/**
 * Main AWS Lambda Handler
 * Supports API Gateway WebSocket events ($connect, $default, $disconnect)
 * as well as direct HTTP POST invocations for easy testing.
 */
export const handler = async (event) => {
  // 1. Direct HTTP request (for easy testing via curl, Postman, or Lambda Function URL)
  if (event.httpMethod || event.requestContext?.http?.method) {
    const origin = event.headers?.origin || event.headers?.Origin || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'OPTIONS, POST',
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
      const userText = (body.text || body.message || 'Hello').trim();
      const history = body.history || [];
      const language = body.language || 'English';

      const replyText = await generateZaraResponse(userText, history, language);

      triggerN8nWebhook('http_conversation', {
        userText,
        replyText,
        language,
        sessionId: body.sessionId || 'http-direct',
        hasAudio: false
      }).catch((e) => console.warn('[n8n] Dispatch notice:', e.message));

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'Zara',
          text: replyText,
          hasAudio: false,
          timestamp: new Date().toISOString()
        })
      };
    } catch (err) {
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
  const domainName = event.requestContext?.domainName;
  const stage = event.requestContext?.stage;

  console.log(`[WEBSOCKET] Event route: ${routeKey}, Connection: ${connectionId}`);

  switch (routeKey) {
    case '$connect': {
      const origin = event.headers?.Origin || event.headers?.origin;
      const token = event.queryStringParameters?.token || event.headers?.Authorization;

      // Validate Origin Whitelist
      if (origin && !validateOrigin(origin)) {
        console.warn(`[AUTH] Connection rejected: unauthorized origin '${origin}'`);
        return { statusCode: 403, body: 'Forbidden origin' };
      }

      // Validate JWT Bearer Auth
      const authResult = validateAuthToken(token);
      if (!authResult.valid) {
        console.warn(`[AUTH] Connection rejected: ${authResult.error}`);
        return { statusCode: 401, body: 'Unauthorized' };
      }

      console.log(`[AUTH] Connection accepted for user:`, authResult.user);
      return { statusCode: 200, body: 'Connected' };
    }

    case '$disconnect': {
      console.log(`[WEBSOCKET] Client disconnected: ${connectionId}`);
      return { statusCode: 200, body: 'Disconnected' };
    }

    case '$default':
    default: {
      try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
        const userLanguage = body.language || 'English';

        // 1. Handle Language Selection explicitly
        if (body.action === 'set_language') {
          console.log(`[WEBSOCKET] Customer changed language to: ${userLanguage}`);
          const languageGreetings = {
            Hindi: 'नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?',
            Arabic: 'أهلاً بك! أنا زارا، كيف يمكنني مساعدتك اليوم في بروكلي بيتزا وبستا؟',
            English: "Awesome! I'm ready in English. How can I help you today?"
          };
          const ackText = languageGreetings[userLanguage] || languageGreetings.English;

          await sendToClient(domainName, stage, connectionId, {
            type: 'zara_response',
            role: 'Zara',
            text: ackText,
            hasAudio: false,
            language: userLanguage,
            timestamp: new Date().toISOString()
          });

          return { statusCode: 200, body: 'OK' };
        }

        // 2. Instant Greeting asking which language the user wants
        if (body.action === 'greet' || (body.text || '').toLowerCase() === 'hello zara' || (body.text || '').toLowerCase() === 'hi zara') {
          const replyText = "Hello! Welcome to Broccoli Pizza & Pasta. I'm Zara! Which language would you prefer to speak in: English, Arabic, or Hindi?";

          await sendToClient(domainName, stage, connectionId, {
            type: 'zara_response',
            role: 'Zara',
            text: replyText,
            hasAudio: false,
            timestamp: new Date().toISOString()
          });

          return { statusCode: 200, body: 'OK' };
        }

        // 3. REAL NOVA 2 SONIC SPEECH-TO-SPEECH AUDIO TURN
        if (body.action === 'audio_turn' || body.audio) {
          const startTime = Date.now();
          const base64Audio = body.audio || body.data || '';
          if (!base64Audio) {
            console.log('[WEBSOCKET] Empty audio turn payload received.');
            return { statusCode: 200, body: 'OK' };
          }

          console.log(`[WEBSOCKET] Processing real Nova 2 Sonic speech turn (${base64Audio.length} chars base64, language: ${userLanguage})`);

          await sendToClient(domainName, stage, connectionId, {
            type: 'status',
            status: 'thinking'
          });

          const pcmBuffer = Buffer.from(base64Audio, 'base64');

          const sonicResult = await streamNova2SonicTurn({
            pcmAudioBuffer: pcmBuffer,
            language: userLanguage,
            onAudioChunk: async (chunkBase64, chunkIndex) => {
              // Immediately forward 24kHz LPCM audio chunk to browser speaker
              await sendToClient(domainName, stage, connectionId, {
                type: 'audio_chunk',
                chunkIndex,
                format: 'lpcm_24k',
                data: chunkBase64
              });
            },
            onUserTranscript: async (textPiece, fullUserText) => {
              // Send user speech-to-text transcript
              await sendToClient(domainName, stage, connectionId, {
                type: 'user_transcript',
                text: fullUserText
              });
            },
            onTranscriptChunk: async (textPiece, fullTextSoFar) => {
              // Incrementally stream Zara's transcript
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

          const defaultReplies = {
            Hindi: 'नमस्ते! मैं आपकी क्या मदद कर सकती हूँ? ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है।',
            Arabic: 'أهلاً بك! كيف يمكنني مساعدتك في قائمة بروكلي بيتزا وبستا اليوم؟',
            English: "I'm here! What delicious pizza or pasta can I get for you today?"
          };
          const replyText = sonicResult.transcript || defaultReplies[userLanguage] || defaultReplies.English;

          // Send final response frame
          await sendToClient(domainName, stage, connectionId, {
            type: 'zara_response',
            role: 'Zara',
            text: replyText,
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

          return { statusCode: 200, body: 'OK' };
        }

        // 4. Fallback text conversation (Converse API with n8n tool calling)
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
