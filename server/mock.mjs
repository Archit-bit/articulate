// Test-only stand-in for Vertex AI (used when MOCK_AI=1). Never used in production.
const feedback = {
  transcript: 'Um, so basically I think listening is the most underrated skill in sales.',
  fillers: [{ word: 'um', count: 1 }, { word: 'basically', count: 1 }],
  scores: { clarity: 7, structure: 5, concision: 6, confidence: 5, language: 6 },
  overall: 6,
  verdict: 'Clear idea, weak structure (mock).',
  strengths: ['Clear position.'],
  issues: [{ quote: 'so basically I think', problem: 'Hedging before the point.', fix: 'Start with the claim.' }],
  wordSwaps: [{ said: 'most underrated', better: 'most overlooked', why: 'Crisper.' }],
  delivery: 'Steady pace.',
  fixNext: 'Say the point in the first sentence.',
  strongerVersion: 'Listening is the most overlooked skill in sales.',
};
const debrief = {
  outcome: 'Mock outcome.', scores: { clarity: 6, structure: 5, listening: 7, objectionHandling: 4, confidence: 5 },
  overall: 5, verdict: 'Mock debrief.', strengths: ['Asked questions.'],
  moments: [{ clientSaid: 'Can it run offline?', youSaid: 'I think so.', better: 'Yes — fully on-premise.', why: 'Precise.' }],
  wordSwaps: [], fixNext: 'Prepare objection answers.',
};
export const mockAi = {
  models: {
    async generateContent({ contents }) {
      const s = JSON.stringify(contents);
      const text = s.includes('inlineData') ? JSON.stringify(feedback)
        : s.includes('TRANSCRIPT') ? JSON.stringify(debrief)
        : s.includes('single word') ? 'ready'
        : JSON.stringify({ text: 'Mock topic: sell a pen to a PSU officer.', context: 'Mock' });
      return { text, usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 400, promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 1000 }] } };
    },
  },
  live: {
    async connect({ model, callbacks }) {
      if (process.env.MOCK_LIVE_DENY === '1' && model === 'gemini-3.8-live') {
        setTimeout(() => callbacks.onclose?.({ code: 1008, reason: `Publisher model ${model} was not found or your project does not have access to it` }), 50);
        return { sendRealtimeInput() {}, sendClientContent() {}, close() {} };
      }
      const silence = Buffer.alloc(24000 * 2).toString('base64');
      return {
        sendRealtimeInput() {},
        sendClientContent() {
          setTimeout(() => {
            callbacks.onmessage({ serverContent: { outputTranscription: { text: 'Good morning. What are you offering us?' } } });
            callbacks.onmessage({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: silence } }] } } });
            callbacks.onmessage({ serverContent: { turnComplete: true } });
            callbacks.onmessage({ serverContent: { inputTranscription: { text: ' We build AI tools.' } } });
          }, 200);
        },
        close() { callbacks.onclose?.({ code: 1000, reason: '' }); },
      };
    },
  },
};
