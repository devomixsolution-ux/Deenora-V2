
/**
 * SMS Utility functions for counting characters and segments
 */

export const isUnicode = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) return true;
  }
  return false;
};

export interface SMSStats {
  isUnicode: boolean;
  segments: number;
  limitPerSMS: number;
  maxLength: number;
  currentLength: number;
  remaining: number;
}

export const getSMSStats = (text: string): SMSStats => {
  const unicode = isUnicode(text);
  const limitPerSMS = unicode ? 70 : 160;
  const segments = text.length === 0 ? 0 : Math.ceil(text.length / limitPerSMS);
  const maxSegments = 5;
  const maxLength = maxSegments * limitPerSMS;
  
  return {
    isUnicode: unicode,
    segments,
    limitPerSMS,
    maxLength,
    currentLength: text.length,
    remaining: maxLength - text.length
  };
};
