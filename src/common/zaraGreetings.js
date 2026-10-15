/**
 * Verified greeting texts and supported language metadata for Zara Voice Assistant.
 * Amazon Polly audio has been completely removed.
 * Voice is rendered natively by Amazon Nova 2 Sonic (24kHz LPCM streaming).
 */

export const GREETING_TEXTS = {
  en: "Hello! Welcome to Broccoli Pizza & Pasta. I'm Zara! How can I help you today?",
  ar: 'أهلاً بك! أنا زارا، مرحباً بك في بروكلي بيتزا وبستا. كيف يمكنني مساعدتك اليوم؟',
  hi: 'नमस्ते! मैं ज़ारा हूँ, ब्रोकली पिज़्ज़ा और पास्ता में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?'
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', label: 'English', flag: '🇬🇧', backendLang: 'English', voiceId: 'tiffany' },
  { code: 'ar', name: 'Arabic', label: 'العربية', flag: '🇦🇪', backendLang: 'Arabic', voiceId: 'tiffany' },
  { code: 'hi', name: 'Hindi', label: 'हिन्दी', flag: '🇮🇳', backendLang: 'Hindi', voiceId: 'kiara' }
];
