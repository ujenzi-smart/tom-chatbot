import { translateTextTool } from './translate-text';
import { DEFAULT_CHAT_MODEL } from '../models';
import { generateText } from 'ai';

// Mock 'ai' module for generateText
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual, // Spread actual module to keep other exports like `tool`
    generateText: vi.fn(),
  };
});

describe('translateTextTool Unit Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks(); // Reset mocks before each test
  });

  const MOCK_TEXT = 'Hello world';
  const MOCK_TARGET_LANGUAGE = 'es';

  it('should successfully translate text', async () => {
    const mockTranslatedText = 'Hola Mundo';
    (generateText as vi.Mock).mockResolvedValue({
      text: mockTranslatedText,
      finishReason: 'stop',
    });

    const result = await translateTextTool.execute({
      text: MOCK_TEXT,
      targetLanguage: MOCK_TARGET_LANGUAGE,
    });

    expect(generateText).toHaveBeenCalledWith({
      model: DEFAULT_CHAT_MODEL,
      prompt: `Translate the following text to ${MOCK_TARGET_LANGUAGE}: "${MOCK_TEXT}"`,
    });
    expect(result).toEqual({ translatedText: mockTranslatedText });
  });

  it('should return an error if generateText throws an exception', async () => {
    const aiError = new Error('AI model unavailable');
    (generateText as vi.Mock).mockRejectedValue(aiError);

    const result = await translateTextTool.execute({
      text: MOCK_TEXT,
      targetLanguage: MOCK_TARGET_LANGUAGE,
    });

    expect(result).toEqual({
      error: `Translation failed due to an internal error: ${aiError.message}`,
    });
  });

  it('should return an error if AI returns the original text (and target is not source)', async () => {
    (generateText as vi.Mock).mockResolvedValue({
      text: MOCK_TEXT, // Returns original text
      finishReason: 'stop',
    });

    const result = await translateTextTool.execute({
      text: MOCK_TEXT,
      targetLanguage: MOCK_TARGET_LANGUAGE, // Assuming targetLanguage 'es' is different from source 'en'
    });
    
    expect(result).toEqual({
      error: `Translation to ${MOCK_TARGET_LANGUAGE} might have failed or returned original text. The language might be unsupported or the text too short/ambiguous.`,
    });
  });
  
  it('should return original text if AI returns original text and target is English (source)', async () => {
    (generateText as vi.Mock).mockResolvedValue({
      text: MOCK_TEXT, // Returns original text
      finishReason: 'stop',
    });

    // If target language is 'en', it might be a valid scenario if the source was also 'en'
    // The tool's current logic specifically checks `targetLanguage !== 'en'` for this error.
    const resultForEn = await translateTextTool.execute({
      text: MOCK_TEXT,
      targetLanguage: 'en',
    });
    expect(resultForEn).toEqual({ translatedText: MOCK_TEXT });
  });


  it('should return an error if AI returns empty text', async () => {
    (generateText as vi.Mock).mockResolvedValue({
      text: '', // Empty response
      finishReason: 'stop',
    });

    const result = await translateTextTool.execute({
      text: MOCK_TEXT,
      targetLanguage: MOCK_TARGET_LANGUAGE,
    });

    expect(result).toEqual({
      error: 'Translation failed. AI model did not provide a valid translation. Reason: stop',
    });
  });

  it('should return an error if AI finishReason is not "stop" (e.g., "length")', async () => {
    (generateText as vi.Mock).mockResolvedValue({
      text: 'Incomplete translation because...',
      finishReason: 'length', // Model hit token limit
    });

    const result = await translateTextTool.execute({
      text: MOCK_TEXT,
      targetLanguage: MOCK_TARGET_LANGUAGE,
    });

    expect(result).toEqual({
      error: 'Translation failed. AI model did not provide a valid translation. Reason: length',
    });
  });

  describe('Zod Schema Validation', () => {
    it('should fail if text is missing', () => {
      const result = translateTextTool.parameters.safeParse({
        targetLanguage: MOCK_TARGET_LANGUAGE,
      });
      expect(result.success).toBe(false);
      expect(result.success === false && result.error.issues[0].path).toContain('text');
    });

    it('should fail if text is an empty string', () => {
      const result = translateTextTool.parameters.safeParse({
        text: '',
        targetLanguage: MOCK_TARGET_LANGUAGE,
      });
      expect(result.success).toBe(false);
      // Zod's .min(1) for string means empty string is invalid
      expect(result.success === false && result.error.issues[0].path).toContain('text');
      expect(result.success === false && result.error.issues[0].message).toBe('String must contain at least 1 character(s)');
    });

    it('should fail if targetLanguage is missing', () => {
      const result = translateTextTool.parameters.safeParse({ text: MOCK_TEXT });
      expect(result.success).toBe(false);
      expect(result.success === false && result.error.issues[0].path).toContain('targetLanguage');
    });

    it('should fail if targetLanguage is less than 2 characters', () => {
      const result = translateTextTool.parameters.safeParse({
        text: MOCK_TEXT,
        targetLanguage: 'e',
      });
      expect(result.success).toBe(false);
      expect(result.success === false && result.error.issues[0].path).toContain('targetLanguage');
      expect(result.success === false && result.error.issues[0].message).toBe('String must contain at least 2 character(s)');
    });

    it('should pass with valid text and targetLanguage', () => {
      const result = translateTextTool.parameters.safeParse({
        text: MOCK_TEXT,
        targetLanguage: MOCK_TARGET_LANGUAGE,
      });
      expect(result.success).toBe(true);
    });
  });
});
