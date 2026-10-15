import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILE = (process.env.AWS_PROFILE || 'voiceagent').trim();
const REGION = 'us-east-1';
const FUNCTION_NAME = 'BroccoliZaraVoiceAssistant';
const API_NAME = 'BroccoliZaraWebSocketAPI';

console.log('==========================================================');
console.log(`Configuring & Deploying Zara to AWS via Profile: ${PROFILE}`);
console.log(`Region: ${REGION}`);
console.log('==========================================================\n');

function runAws(cmd, ignoreError = false) {
  const fullCmd = `aws ${cmd} --profile ${PROFILE} --output json`;
  try {
    const res = execSync(fullCmd, { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] });
    return res.toString();
  } catch (err) {
    if (ignoreError) return null;
    console.error(`Command failed: ${fullCmd}`);
    console.error(err.stderr?.toString() || err.message);
    throw err;
  }
}

// 1. Verify Caller Identity
const callerRaw = runAws('sts get-caller-identity');
const caller = JSON.parse(callerRaw);
const ACCOUNT_ID = caller.Account;
console.log(`✔ Authenticated as AWS Account: ${ACCOUNT_ID}`);

// 2. Check if Lambda Function exists
console.log(`\n[1/4] Checking Lambda Function (${FUNCTION_NAME})...`);
const lambdaCheck = runAws(`lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION}`, true);

if (!lambdaCheck) {
  console.log(`❌ Function '${FUNCTION_NAME}' does not exist yet.`);
  console.log('\nPlease open your AWS Console in the browser:');
  console.log('1. Go to AWS Lambda Console -> Create function');
  console.log(`2. Function name: ${FUNCTION_NAME}`);
  console.log('3. Runtime: Node.js 20.x');
  console.log('4. Click "Create function"');
  console.log('\nOnce created, run this script again and it will automatically upload your code and setup the WebSocket API!');
  process.exit(1);
}

// 3. Upload Code & Configuration
console.log('✔ Function found! Uploading code package...');
const zipPath = path.join(__dirname, 'middlelayer.zip');

runAws(`lambda update-function-code --function-name ${FUNCTION_NAME} --zip-file fileb://${zipPath} --region ${REGION}`);
console.log('Waiting for code update to finish...');
runAws(`lambda wait function-updated --function-name ${FUNCTION_NAME} --region ${REGION}`);
console.log('✔ Code uploaded successfully.');

// Write environment variables to env.json to avoid command line shell quote bugs
const envJsonPath = path.join(__dirname, 'env.json');
fs.writeFileSync(
  envJsonPath,
  JSON.stringify(
    {
      Variables: {
        AWS_REGION: 'us-east-1',
        BEDROCK_MODEL_ID: 'amazon.nova-lite-v1:0',
        POLLY_VOICE_ID: 'Tiffany',
        ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000,*.hostinger.com,https://broccoli.ae,http://broccoli.ae',
        DEV_BYPASS: 'true',
        JWT_SECRET: 'broccoli-zara-secret-key-2026',
        N8N_WEBHOOK_URL: '',
        N8N_WEBHOOK_KEY: ''
      }
    },
    null,
    2
  )
);

console.log('Updating function configuration (timeout: 60s, memory: 512MB, env vars)...');
runAws(`lambda update-function-configuration --function-name ${FUNCTION_NAME} --environment file://${envJsonPath} --timeout 60 --memory-size 512 --region ${REGION}`);
runAws(`lambda wait function-updated --function-name ${FUNCTION_NAME} --region ${REGION}`);
console.log('✔ Configuration updated.');

const functionArn = `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}`;

// 4. Setup Direct HTTP Function URL
console.log(`\n[2/4] Setting up Direct HTTP Function URL...`);
let fnUrl = '';
const urlConfigRaw = runAws(`lambda get-function-url-config --function-name ${FUNCTION_NAME} --region ${REGION}`, true);
if (urlConfigRaw) {
  fnUrl = JSON.parse(urlConfigRaw).FunctionUrl;
} else {
  const corsJsonPath = path.join(__dirname, 'cors.json');
  fs.writeFileSync(
    corsJsonPath,
    JSON.stringify(
      {
        AllowOrigins: ['*'],
        AllowMethods: ['*'],
        AllowHeaders: ['*']
      },
      null,
      2
    )
  );
  const createUrlRaw = runAws(`lambda create-function-url-config --function-name ${FUNCTION_NAME} --auth-type NONE --cors file://${corsJsonPath} --region ${REGION}`);
  fnUrl = JSON.parse(createUrlRaw).FunctionUrl;
  runAws(`lambda add-permission --function-name ${FUNCTION_NAME} --statement-id FunctionURLAllowPublicAccess --action lambda:InvokeFunctionUrl --principal * --function-url-auth-type NONE --region ${REGION}`, true);
}
console.log(`✔ Direct HTTP Test URL: ${fnUrl}`);

// 5. Setup WebSocket API Gateway
console.log(`\n[3/4] Setting up API Gateway WebSocket API (${API_NAME})...`);
const apisRaw = runAws(`apigatewayv2 get-apis --region ${REGION}`);
const apis = JSON.parse(apisRaw);
const existingApi = apis.Items?.find((a) => a.Name === API_NAME);

let API_ID = existingApi ? existingApi.ApiId : null;
if (API_ID) {
  console.log(`✔ Existing WebSocket API found (ID: ${API_ID})`);
} else {
  console.log('Creating new WebSocket API...');
  const newApiRaw = runAws(`apigatewayv2 create-api --name ${API_NAME} --protocol-type WEBSOCKET --route-selection-expression $request.body.action --region ${REGION}`);
  API_ID = JSON.parse(newApiRaw).ApiId;
  console.log(`✔ WebSocket API created (ID: ${API_ID})`);
}

// Integration
const integrationsRaw = runAws(`apigatewayv2 get-integrations --api-id ${API_ID} --region ${REGION}`);
const integrations = JSON.parse(integrationsRaw);
let integrationId = integrations.Items?.[0]?.IntegrationId;

if (!integrationId) {
  const targetUri = `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${functionArn}/invocations`;
  const newIntRaw = runAws(`apigatewayv2 create-integration --api-id ${API_ID} --integration-type AWS_PROXY --integration-uri ${targetUri} --region ${REGION}`);
  integrationId = JSON.parse(newIntRaw).IntegrationId;
  console.log('✔ Created API Gateway Lambda integration');
}

// Routes
const routesRaw = runAws(`apigatewayv2 get-routes --api-id ${API_ID} --region ${REGION}`);
const routes = JSON.parse(routesRaw);
const routeKeys = routes.Items?.map((r) => r.RouteKey) || [];

for (const rKey of ['$connect', '$default', '$disconnect']) {
  if (!routeKeys.includes(rKey)) {
    runAws(`apigatewayv2 create-route --api-id ${API_ID} --route-key "${rKey}" --target integrations/${integrationId} --region ${REGION}`);
    console.log(`✔ Route created: ${rKey}`);
  }
}

// Permission for API Gateway to invoke Lambda
runAws(`lambda add-permission --function-name ${FUNCTION_NAME} --statement-id ApiGatewayInvokePermission-${API_ID} --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/* --region ${REGION}`, true);

// 6. Deploy Stage
console.log(`\n[4/4] Deploying API Gateway to 'prod' stage...`);
const deploymentRaw = runAws(`apigatewayv2 create-deployment --api-id ${API_ID} --region ${REGION}`);
const deploymentId = JSON.parse(deploymentRaw).DeploymentId;

const stageExists = runAws(`apigatewayv2 get-stage --api-id ${API_ID} --stage-name prod --region ${REGION}`, true);
if (stageExists) {
  runAws(`apigatewayv2 update-stage --api-id ${API_ID} --stage-name prod --deployment-id ${deploymentId} --region ${REGION}`);
} else {
  runAws(`apigatewayv2 create-stage --api-id ${API_ID} --stage-name prod --deployment-id ${deploymentId} --region ${REGION}`);
}

const WSS_URL = `wss://${API_ID}.execute-api.${REGION}.amazonaws.com/prod`;

console.log('\n==========================================================');
console.log('🎉 DEPLOYMENT SUCCESSFUL!');
console.log('==========================================================');
console.log('WebSocket URL (for React Voice Assistant):');
console.log(`  ${WSS_URL}`);
console.log('\nDirect HTTP Test URL:');
console.log(`  ${fnUrl}`);
console.log('==========================================================\n');
