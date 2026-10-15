/**
 * Deprecated Vapi hook (maintained as safe stub for telephony/backwards compatibility).
 * The website voice assistant Zara exclusively uses Amazon Nova 2 Sonic.
 */
import { useState, useCallback } from 'react';

function useVapiAssistant() {
  const [phase, setPhase] = useState('idle');
  const [error] = useState('');
  const [transcript] = useState([]);

  const startCall = useCallback(() => {
    console.warn('Vapi is deprecated for website calls. Use useZaraVoiceAssistant for Nova 2 Sonic.');
  }, []);

  const endCall = useCallback(() => {
    setPhase('idle');
  }, []);

  return {
    phase,
    error,
    transcript,
    startCall,
    endCall
  };
}

export default useVapiAssistant;