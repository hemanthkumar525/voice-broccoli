# Broccoli Pizza & Pasta - Zara Voice Middlelayer

This folder contains the complete, production-ready AWS Lambda backend for the **Zara** voice assistant.

---

## 📁 Architecture Overview

- **`index.js`**: Main Lambda entry point. Handles both API Gateway WebSocket routes (`$connect`, `$default`, `$disconnect`) and direct HTTP POST requests (for quick testing).
- **`auth.js`**: Checks the `Origin` header against your whitelist (`localhost:5173`, `hostinger.com`, etc.) and verifies the JWT Bearer token.
- **`bedrock.js`**: Invokes the **Amazon Nova** model with the Zara persona, Broccoli Pizza & Pasta UAE menu knowledge, and conversational parameters.
- **`voice.js`**: Synthesizes speech using **Amazon Polly** using the **Tiffany** neural female voice.
- **`n8n.js`**: Dispatches external action calls to your **n8n** webhook endpoint whenever Zara detects an actionable user intent (orders, bookings, franchise leads).

---

## 🔐 Required AWS IAM Policy

When deploying your Lambda function, attach this IAM Policy to the Lambda Execution Role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:Converse"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PollySpeechAccess",
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ApiGatewayManageConnections",
      "Effect": "Allow",
      "Action": [
        "execute-api:ManageConnections"
      ],
      "Resource": "arn:aws:execute-api:*:*:*/*"
    }
  ]
}
```

---

## 🚀 How to Deploy to AWS

### Option A: AWS Console (Zip Upload)
1. In the `middlelayer/` directory, install dependencies:
   ```bash
   cd middlelayer
   npm install --production
   ```
2. Zip all files inside `middlelayer/` (including `node_modules`).
3. Open the **AWS Lambda Console** → **Create function**:
   - Runtime: **Node.js 20.x** (or Node.js 18.x)
   - Architecture: **x86_64** or **arm64**
4. Upload your `.zip` file in the **Code** tab.
5. In **Configuration** → **Environment variables**, add the keys from `.env.example`.

### Option B: WebSocket API Gateway Setup
1. In **API Gateway Console** → **Create API** → **WebSocket API**.
2. Set Route Selection Expression to `request.body.action`.
3. Add routes:
   - `$connect` → Attach your Lambda
   - `$disconnect` → Attach your Lambda
   - `$default` → Attach your Lambda
4. Deploy the API to a stage (e.g., `prod`).
5. Copy the WebSocket URL (`wss://<api-id>.execute-api.<region>.amazonaws.com/prod`).

