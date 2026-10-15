import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILE = (process.env.AWS_PROFILE || 'voiceagent').trim();
const REGION = 'us-east-1';
const STACK_NAME = 'BroccoliZaraBackend';
const TEMPLATE_FILE = path.join(__dirname, 'template.yaml');
const DEPLOY_ROLE_ARN = 'arn:aws:iam::529349714437:role/cdk-hnb659fds-deploy-role-529349714437-us-east-1';
const CFN_EXEC_ROLE_ARN = 'arn:aws:iam::529349714437:role/cdk-hnb659fds-cfn-exec-role-529349714437-us-east-1';

console.log('================================================================');
console.log('Deploying Zara Voice Assistant Middlelayer directly via AWS CLI');
console.log(`Profile: ${PROFILE} | Region: ${REGION}`);
console.log('================================================================\n');

// 1. Assume the CDK Deployment Role
console.log('[1/3] Assuming CDK deployment credentials...');
const stsCmd = `aws sts assume-role --role-arn ${DEPLOY_ROLE_ARN} --role-session-name zara-deploy-cli --profile ${PROFILE} --output json`;
const stsRaw = execSync(stsCmd).toString();
const creds = JSON.parse(stsRaw).Credentials;

const deployEnv = {
  ...process.env,
  AWS_ACCESS_KEY_ID: creds.AccessKeyId,
  AWS_SECRET_ACCESS_KEY: creds.SecretAccessKey,
  AWS_SESSION_TOKEN: creds.SessionToken,
  AWS_DEFAULT_REGION: REGION
};
delete deployEnv.AWS_PROFILE;
console.log('✔ Credentials acquired.');

// 2. Deploy CloudFormation Stack
console.log(`\n[2/3] Deploying CloudFormation Stack: ${STACK_NAME}...`);
const deployCmd = `aws cloudformation deploy --template-file "${TEMPLATE_FILE}" --stack-name ${STACK_NAME} --role-arn ${CFN_EXEC_ROLE_ARN} --capabilities CAPABILITY_NAMED_IAM`;

execSync(deployCmd, { cwd: __dirname, env: deployEnv, stdio: 'inherit' });
console.log('✔ CloudFormation deployment completed successfully.');

// 3. Fetch Outputs
console.log(`\n[3/3] Fetching Stack Outputs...`);
const describeCmd = `aws cloudformation describe-stacks --stack-name ${STACK_NAME} --output json`;
const describeRaw = execSync(describeCmd, { env: deployEnv }).toString();
const stack = JSON.parse(describeRaw).Stacks[0];

const outputs = {};
for (const out of stack.Outputs || []) {
  outputs[out.OutputKey] = out.OutputValue;
}

console.log('\n================================================================');
console.log('🎉 DIRECT AWS CLI DEPLOYMENT COMPLETE!');
console.log('================================================================');
console.log(`WebSocket URL (Live Zara Voice Backend):`);
console.log(`  ${outputs.WebSocketUrl}`);
console.log(`\nDirect HTTP URL (Test Endpoint):`);
console.log(`  ${outputs.FunctionUrl}`);
console.log('================================================================\n');

