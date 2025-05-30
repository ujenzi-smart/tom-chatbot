import { tool, generateText } from 'ai';
import { z } from 'zod';
import { DEFAULT_CHAT_MODEL } from '../models';

export const translateTextTool = tool({
  description: 'Translates text from one language to another.',
  parameters: z.object({
    text: z.string().min(1).describe('The text to be translated.'),
    targetLanguage: z.string().min(2).describe('The target language code (e.g., "es", "fr", "de").'),
  }),
  execute: async ({ text, targetLanguage }) => {
    try {
      // Construct the prompt for the AI model
      const prompt = `Translate the following text to ${targetLanguage}: "${text}"`;

      // Call the AI model to generate the translation
      const { text: translatedTextResponse, finishReason } = await generateText({
        model: DEFAULT_CHAT_MODEL, // Or a model specifically fine-tuned for translation if available
        prompt: prompt,
        // Consider adding parameters like maxTokens if needed, or temperature for creativity.
      });

      if (finishReason === 'stop' && translatedTextResponse && translatedTextResponse.trim().length > 0) {
        // Basic check to see if the AI just returned the original text or a refusal
        if (translatedTextResponse.trim().toLowerCase() === text.trim().toLowerCase() && targetLanguage !== 'en') { // Assuming English is the source if not specified
             // This check is very basic and might lead to false positives.
             // A more robust check would involve analyzing if the response indicates an inability to translate.
            return { error: `Translation to ${targetLanguage} might have failed or returned original text. The language might be unsupported or the text too short/ambiguous.` };
        }
        return { translatedText: translatedTextResponse.trim() };
      } else {
        // This case handles empty responses or other finish reasons like 'length' if maxTokens is hit.
        return { error: `Translation failed. AI model did not provide a valid translation. Reason: ${finishReason}` };
      }
    } catch (error) {
      console.error('Error during translation:', error);
      // Check if the error is an instance of Error to access message property safely
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return { error: `Translation failed due to an internal error: ${errorMessage}` };
    }
  },
});
