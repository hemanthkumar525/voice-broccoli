import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import useZaraVoiceAssistant from '../hooks/useZaraVoiceAssistant';

const { FiMic, FiX, FiRefreshCw, FiChevronUp, FiChevronDown } = FiIcons;

const labels = {
  connecting: 'Connecting to Zara…',
  listening: 'Listening…',
  speaking: 'Zara is speaking',
  ended: 'Call ended'
};

function VoiceAssistantWidget() {
  const { phase, error, transcript, currentLanguage, selectLanguage, startCall, endCall } = useZaraVoiceAssistant();
  const [showTranscript, setShowTranscript] = useState(true);
  const isActive = phase === 'connecting' || phase === 'listening' || phase === 'speaking';

  return (
    <aside className="voice-widget" aria-label="Talk to Zara voice assistant">
      <AnimatePresence>
        {showTranscript && isActive && (
          <motion.div className="transcript-panel" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} role="log" aria-live="polite">
            <div className="transcript-heading">
              <span>Conversation with Zara</span>
              <button onClick={() => setShowTranscript(false)} aria-label="Close conversation panel"><SafeIcon icon={FiX} /></button>
            </div>
            <div className="language-selector-pills" role="radiogroup" aria-label="Select conversation language">
              <button
                className={`lang-pill ${currentLanguage === 'en' ? 'is-active' : ''}`}
                onClick={() => selectLanguage('en')}
                aria-pressed={currentLanguage === 'en'}
              >
                🇬🇧 English
              </button>
              <button
                className={`lang-pill ${currentLanguage === 'ar' ? 'is-active' : ''}`}
                onClick={() => selectLanguage('ar')}
                aria-pressed={currentLanguage === 'ar'}
              >
                🇦🇪 العربية
              </button>
              <button
                className={`lang-pill ${currentLanguage === 'hi' ? 'is-active' : ''}`}
                onClick={() => selectLanguage('hi')}
                aria-pressed={currentLanguage === 'hi'}
              >
                🇮🇳 हिन्दी
              </button>
            </div>
            <div className="transcript-body">
              {transcript.length ? transcript.map((line, index) => <p className={line.role === 'Zara' ? 'transcript-Zara' : 'transcript-User'} key={`${index}-${line.text}`}><strong>{line.role}</strong>{line.text}</p>) : <p className="transcript-empty">Your conversation will appear here.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div className="voice-active" key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <button className="voice-orb is-active" onClick={() => setShowTranscript((visible) => !visible)} aria-label={showTranscript ? 'Hide conversation' : 'Show conversation'}>
              <span className="sound-bars"><i /><i /><i /><i /><i /></span>
            </button>
            <div className="voice-status"><span className="voice-status-label">{labels[phase]}</span><button className="transcript-toggle" onClick={() => setShowTranscript((visible) => !visible)}>{showTranscript ? <SafeIcon icon={FiChevronDown} /> : <SafeIcon icon={FiChevronUp} />} Conversation</button></div>
            <button className="end-call-button" onClick={endCall}><SafeIcon icon={FiX} /> End call</button>
          </motion.div>
        ) : phase === 'error' ? (
          <motion.div className="voice-error" key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <div className="error-copy"><strong>Can’t connect just yet</strong><span>{error}</span></div>
            <button className="retry-button" onClick={startCall}><SafeIcon icon={FiRefreshCw} /> Retry</button>
            <button className="close-error" onClick={endCall} aria-label="Dismiss error"><SafeIcon icon={FiX} /></button>
          </motion.div>
        ) : (
          <motion.button className={`voice-launch ${phase === 'ended' ? 'just-ended' : ''}`} key="launch" onClick={startCall} aria-label="Talk to Zara voice assistant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <span className="voice-orb"><SafeIcon icon={FiMic} /></span>
            <span className="launch-copy"><strong>{phase === 'ended' ? 'Talk again?' : 'Talk to Zara'}</strong><small>{phase === 'ended' ? 'Whenever you’re ready' : 'Ask Zara anything'}</small></span>
            <span className="launch-arrow">↗</span>
          </motion.button>
        )}
      </AnimatePresence>
    </aside>
  );
}

export default VoiceAssistantWidget;