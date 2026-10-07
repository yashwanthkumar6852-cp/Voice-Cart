import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Globe,
  AlertCircle,
  RefreshCw,
  Send,
  HelpCircle,
  Radio
} from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';
import { useVoice, VoiceState } from '../hooks/useVoice';
import { api } from '../services/api';
import { VoiceIntentResult } from '../types';
import { translations, SupportedLanguage } from '../i18n/translations';

interface Props {
  onVoiceResult: (result: {
    intentResult: VoiceIntentResult;
    searchData?: any;
    cartData?: any;
    orderData?: any;
  }) => void;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  context?: any;
}

export const VoiceMicButton: React.FC<Props> = ({
  onVoiceResult,
  language,
  onLanguageChange,
  context
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSpoken, setLastSpoken] = useState<string>('');
  const [typedFallbackText, setTypedFallbackText] = useState('');
  const [didYouMean, setDidYouMean] = useState<{ query: string; lang: SupportedLanguage } | null>(null);

  const t = translations[language] || translations.en;
  const langCode = language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';

  // Process voice transcript with backend intent parser
  const handleFinalTranscript = async (transcript: string, _detectedLang?: string) => {
    if (!transcript.trim()) return;

    // Check script & auto-detect language mismatch
    const isKannadaScript = /[\u0C80-\u0CFF]/.test(transcript);
    const isHindiScript = /[\u0900-\u097F]/.test(transcript);

    if (isKannadaScript && language !== 'kn') {
      setDidYouMean({ query: transcript, lang: 'kn' });
    } else if (isHindiScript && language !== 'hi') {
      setDidYouMean({ query: transcript, lang: 'hi' });
    } else {
      setDidYouMean(null);
    }

    setIsProcessing(true);
    try {
      const result = await api.processVoice(transcript, context);
      setLastSpoken(result.intentResult.spokenResponse);
      speakWithBrowserTTS(
        result.intentResult.spokenResponse,
        result.intentResult.language || language
      );
      onVoiceResult(result);
    } catch (err: any) {
      console.error('Voice processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const {
    state,
    mode,
    liveTranscript,
    error,
    startListening,
    stopListening,
    resetState
  } = useVoice(langCode, handleFinalTranscript);

  // Browser Text-to-Speech
  const speakWithBrowserTTS = (text: string, lang: 'en' | 'hi' | 'kn') => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find((v) => {
        const vl = v.lang.toLowerCase();
        const vn = v.name.toLowerCase();
        if (lang === 'kn') return vl.startsWith('kn') || vn.includes('kannada');
        if (lang === 'hi') return vl.startsWith('hi') || vn.includes('hindi');
        return vl.startsWith('en-in') || vl.startsWith('en');
      });

      const utterance = new SpeechSynthesisUtterance(text);
      if (matchingVoice) utterance.voice = matchingVoice;
      utterance.lang = lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  };

  const handleToggleMic = () => {
    if (state === 'listening' || state === 'recording_fallback') {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedFallbackText.trim()) return;
    const q = typedFallbackText.trim();
    setTypedFallbackText('');
    handleFinalTranscript(q);
  };

  const handleAcceptDidYouMean = () => {
    if (!didYouMean) return;
    onLanguageChange(didYouMean.lang);
    handleFinalTranscript(didYouMean.query);
    setDidYouMean(null);
  };

  const isBusy = state === 'listening' || state === 'recording_fallback' || isProcessing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
      {/* Live Transcript / Bubble / Feedback */}
      {(liveTranscript || isProcessing || lastSpoken || error || didYouMean) && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 20px',
            maxWidth: '560px',
            width: '92%',
            textAlign: 'center',
            fontSize: '0.92rem',
            border: error
              ? '1px solid var(--accent-rose)'
              : state === 'listening' || state === 'recording_fallback'
              ? '1px solid var(--primary)'
              : '1px solid var(--border-focus)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          {/* Live Streaming Speech Preview */}
          {liveTranscript && (
            <div
              style={{
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '1rem'
              }}
            >
              <Sparkles size={16} color="var(--primary)" />
              <span>"{liveTranscript}"</span>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div
              style={{
                color: 'var(--accent-gold)',
                fontSize: '0.85rem',
                marginTop: liveTranscript ? '8px' : '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className="mic-active-pulse" />
              <span>{t.searchingStores}</span>
            </div>
          )}

          {/* Assistant Reply */}
          {!isProcessing && lastSpoken && (
            <div
              style={{
                color: 'var(--text-main)',
                marginTop: liveTranscript ? '8px' : '0',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                lineHeight: 1.4
              }}
            >
              <Volume2 size={16} color="var(--accent-green)" />
              <span>{lastSpoken}</span>
            </div>
          )}

          {/* Did You Mean Language / Query Confirmation */}
          {didYouMean && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                fontSize: '0.84rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}>
                <HelpCircle size={15} color="var(--primary)" />
                <span>
                  Did you mean in <strong>{didYouMean.lang === 'kn' ? 'ಕನ್ನಡ (Kannada)' : 'हिन्दी (Hindi)'}</strong>?
                </span>
              </div>
              <button
                onClick={handleAcceptDidYouMean}
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Yes, Search
              </button>
            </div>
          )}

          {/* Friendly Error Message & Try Again Button */}
          {error && (
            <div
              style={{
                marginTop: '6px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--accent-rose)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{error.userMessage}</span>
              </div>
              {error.canRetry && (
                <button
                  onClick={() => {
                    resetState();
                    startListening();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--accent-rose)',
                    color: '#fff',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={12} /> Try Again
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mic Controls Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Language Pill Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '4px 8px',
            gap: '4px'
          }}
        >
          <Globe size={14} color="var(--text-muted)" />
          <button
            onClick={() => {
              onLanguageChange('en');
              resetState();
            }}
            style={{
              background: language === 'en' ? 'var(--primary)' : 'transparent',
              color: language === 'en' ? '#fff' : 'var(--text-main)',
              border: 'none',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            EN
          </button>
          <button
            onClick={() => {
              onLanguageChange('hi');
              resetState();
            }}
            style={{
              background: language === 'hi' ? 'var(--primary)' : 'transparent',
              color: language === 'hi' ? '#fff' : 'var(--text-main)',
              border: 'none',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            हिन्दी
          </button>
          <button
            onClick={() => {
              onLanguageChange('kn');
              resetState();
            }}
            style={{
              background: language === 'kn' ? 'var(--primary)' : 'transparent',
              color: language === 'kn' ? '#fff' : 'var(--text-main)',
              border: 'none',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: "'Noto Sans Kannada', sans-serif"
            }}
          >
            ಕನ್ನಡ
          </button>
        </div>

        {/* Floating Mic Button with Dynamic States */}
        <button
          onClick={handleToggleMic}
          className={state === 'listening' || state === 'recording_fallback' ? 'mic-active-pulse' : ''}
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background:
              state === 'recording_fallback'
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : state === 'listening'
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : error
                ? 'linear-gradient(135deg, #64748b, #475569)'
                : 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            border:
              state === 'listening'
                ? '3px solid #fecaca'
                : state === 'recording_fallback'
                ? '3px solid #fef3c7'
                : '3px solid rgba(255,255,255,0.25)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow:
              state === 'listening'
                ? '0 0 30px rgba(239, 68, 68, 0.6)'
                : state === 'recording_fallback'
                ? '0 0 30px rgba(245, 158, 11, 0.6)'
                : '0 0 25px var(--primary-glow)',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          title={
            state === 'listening' || state === 'recording_fallback'
              ? 'Listening... Click to stop'
              : `${t.tapToSpeak} (${langCode})`
          }
        >
          {state === 'listening' ? (
            <Mic size={30} />
          ) : state === 'recording_fallback' ? (
            <Radio size={28} className="mic-active-pulse" />
          ) : error ? (
            <MicOff size={26} />
          ) : (
            <Mic size={28} />
          )}
        </button>

        {/* Waveform visualizer */}
        <AudioWaveform
          isActive={state === 'listening' || state === 'recording_fallback' || isProcessing}
          color={state === 'recording_fallback' ? '#f59e0b' : state === 'listening' ? '#ef4444' : 'var(--primary)'}
        />
      </div>

      {/* Mode / Language Status Indicator */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {state === 'listening' ? (
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>
            {language === 'kn'
              ? '🎙️ ಕನ್ನಡದಲ್ಲಿ ಆಲಿಸಲಾಗುತ್ತಿದೆ... (kn-IN)'
              : language === 'hi'
              ? '🎙️ हिन्दी में सुन रहे हैं... (hi-IN)'
              : '🎙️ Listening in English... (en-IN)'}
          </span>
        ) : state === 'recording_fallback' ? (
          <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
            ⏺️ Recording audio fallback (Upload to cloud STT)... Click to stop
          </span>
        ) : (
          t.listeningHint
        )}
      </div>

      {/* Typed Fallback Input Bar */}
      <form
        onSubmit={handleTypedSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '460px',
          width: '90%',
          marginTop: '4px'
        }}
      >
        <input
          type="text"
          value={typedFallbackText}
          onChange={(e) => setTypedFallbackText(e.target.value)}
          placeholder={
            language === 'kn'
              ? 'ಅಥವಾ ಧ್ವನಿ ಬದಲಿಗೆ ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ (e.g. boAt earbuds under 2000)...'
              : language === 'hi'
              ? 'या आवाज़ के बजाय यहाँ टाइप करें (e.g. boAt earbuds under 2000)...'
              : 'Or type your shopping query (e.g. boAt earbuds under 2000)...'
          }
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontSize: '0.82rem',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!typedFallbackText.trim() || isBusy}
          style={{
            background: typedFallbackText.trim() ? 'var(--primary)' : 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            color: typedFallbackText.trim() ? '#fff' : 'var(--text-muted)',
            padding: '8px 12px',
            borderRadius: '10px',
            cursor: typedFallbackText.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
