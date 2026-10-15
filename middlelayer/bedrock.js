import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeRestaurantLookup } from './n8n.js';

if (!process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.AWS_PROFILE) {
  process.env.AWS_PROFILE = 'voiceagent';
}

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';

const ZARA_SYSTEM_PROMPT = `
You are Zara, the official friendly voice assistant for Broccoli Pizza & Pasta UAE.
Your speech is cheerful, energetic, warm, and hospitable—speaking like a helpful restaurant host, never robotic.

Voice & Conversation Rules:
1. Speak in ultra-concise, conversational sentences (1 to 2 short sentences per response).
2. NEVER use markdown symbols like asterisks, bolding, bullet points, hashtags, or thinking tags.
3. Language Matching: Automatically speak the customer's language. If the customer speaks Arabic, reply in natural UAE Arabic. If they speak Hindi, reply in Hindi. If English, reply in cheerful English. Never mix languages.
4. For menu prices, special offers, item sizes, branch locations, and franchise inquiries, ALWAYS use the 'broccoli_restaurant_lookup' tool to retrieve live verified facts.
5. If the lookup tool returns multiple sizes with prices (e.g. Small, Medium, Large), tell the customer the available sizes and ask which one they prefer.
6. Official franchise contact is sales@broccoli.ae. Never invent franchise fees or contracts.
7. For order status inquiries, always ask the customer for their order reference number (e.g. from GoOrder, Talabat, or SMS confirmation) before looking up order details.
`;

const RESTAURANT_LOOKUP_TOOL = {
  toolSpec: {
    name: 'broccoli_restaurant_lookup',
    description: 'Unified lookup tool for Broccoli Pizza & Pasta UAE. Queries live restaurant menu prices in AED, sizes, current offers (like 50% off), UAE branch locations & hours, official franchise details, and order tracking.',
    inputSchema: {
      json: {
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
      }
    }
  }
};

/**
 * Invokes Amazon Bedrock Nova model with tool handling connected to n8n.
 */
export async function generateZaraResponse(userMessage, conversationHistory = [], language = 'English') {
  try {
    const cleanUserMessage = (userMessage || '').trim();
    if (!cleanUserMessage) {
      if (language === 'Arabic') {
        return 'أهلاً بك! أنا زارا، كيف يمكنني مساعدتك في قائمة بروكلي بيتزا وبستا اليوم؟';
      } else if (language === 'Hindi') {
        return 'नमस्ते! मैं ज़ारा हूँ, आज ब्रोकली पिज़्ज़ा और पास्ता में आपकी क्या सेवा करूँ?';
      }
      return "Hello! I'm Zara. What fresh pizza or pasta can I get for you today?";
    }

    let effectiveSystemPrompt = ZARA_SYSTEM_PROMPT;
    if (language === 'Arabic') {
      effectiveSystemPrompt += '\nIMPORTANT: The customer chose Arabic. You MUST answer strictly in natural UAE Arabic script (العربية).';
    } else if (language === 'Hindi') {
      effectiveSystemPrompt += '\nIMPORTANT: The customer chose Hindi. You MUST answer strictly in natural conversational Hindi script (हिंदी).';
    } else {
      effectiveSystemPrompt += '\nIMPORTANT: The customer chose English. Answer in cheerful, concise English.';
    }

    // Filter out any blank history messages so Bedrock Converse API never receives an empty text block
    const messages = conversationHistory
      .filter((entry) => {
        const txt = (entry.text || entry.message || '').trim();
        return txt.length > 0;
      })
      .map((entry) => ({
        role: entry.role === 'assistant' || entry.role === 'Zara' ? 'assistant' : 'user',
        content: [{ text: (entry.text || entry.message || '').trim() }]
      }));

    messages.push({
      role: 'user',
      content: [{ text: cleanUserMessage }]
    });

    const commandConfig = {
      modelId: MODEL_ID,
      system: [{ text: effectiveSystemPrompt }],
      messages,
      toolConfig: {
        tools: [RESTAURANT_LOOKUP_TOOL]
      },
      inferenceConfig: {
        maxTokens: 256,
        temperature: 0.5,
        topP: 0.9,
      }
    };

    let response = await client.send(new ConverseCommand(commandConfig));

    // Handle tool use loop (up to 3 iterations)
    let iterations = 0;
    while (response.stopReason === 'tool_use' && iterations < 3) {
      iterations++;
      const assistantMessage = response.output?.message;
      if (!assistantMessage) break;

      messages.push(assistantMessage);

      const toolUseBlocks = assistantMessage.content?.filter((c) => c.toolUse) || [];
      const toolResultBlocks = [];

      for (const block of toolUseBlocks) {
        const { toolUseId, name, input } = block.toolUse;
        console.log(`[BEDROCK] Nova requested tool: ${name} (id: ${toolUseId})`, input);

        let resultPayload;
        if (name === 'broccoli_restaurant_lookup') {
          resultPayload = await executeRestaurantLookup(input, toolUseId);
        } else {
          resultPayload = { success: false, error: 'UNKNOWN_TOOL', message: `Tool ${name} not supported` };
        }

        toolResultBlocks.push({
          toolResult: {
            toolUseId,
            content: [{ json: resultPayload }],
            status: resultPayload.success !== false ? 'success' : 'error'
          }
        });
      }

      messages.push({
        role: 'user',
        content: toolResultBlocks
      });

      // Invoke Nova again with the tool result so it can generate the spoken response
      response = await client.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: effectiveSystemPrompt }],
        messages,
        toolConfig: {
          tools: [RESTAURANT_LOOKUP_TOOL]
        },
        inferenceConfig: {
          maxTokens: 256,
          temperature: 0.5,
          topP: 0.9,
        }
      }));
    }

    // Extract text reply and strip any internal thinking tags
    const textBlocks = response.output?.message?.content?.filter((c) => c.text) || [];
    let replyText = textBlocks.map((b) => b.text).join(' ').trim();
    if (!replyText) {
      replyText = "I'm here! What would you like to enjoy from our Broccoli Pizza & Pasta menu today?";
    }

    replyText = replyText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

    return replyText;
  } catch (err) {
    console.error('[BEDROCK] Error invoking Amazon Nova model:', err);
    return "I'm having a little trouble connecting to our live kitchen system right now. Feel free to ask me again or check our menu at broccoli.ae!";
  }
}
