import fs from 'fs';
import path from 'path';

const en = fs.readFileSync('greeting_tiffany.base64', 'utf8').trim();
const ar = fs.readFileSync('greeting_arabic.base64', 'utf8').trim();
const hi = fs.readFileSync('greeting_hindi.base64', 'utf8').trim();

const code = `export const GREETING_AUDIO = {
  en: '${en}',
  ar: '${ar}',
  hi: '${hi}'
};

export const GREETING_TEXTS = {
  initial: "Hello! Welcome to Broccoli Pizza & Pasta UAE. I'm Zara! Which language would you prefer to speak in? English, Arabic, or Hindi?",
  en: "Awesome! I'm ready in English. How can I help you today?",
  ar: "أهلاً بك! أنا زارا، كيف يمكنني مساعدتك اليوم في بروكلي بيتزا وبستا؟",
  hi: "नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?"
};
`;

fs.writeFileSync(path.join('..', 'src', 'common', 'zaraGreetings.js'), code);
console.log('✔ Successfully created src/common/zaraGreetings.js');

