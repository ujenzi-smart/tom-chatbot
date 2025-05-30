import { generateText, tool } from 'ai';
import { z } from 'zod';
import { DEFAULT_CHAT_MODEL } from '../models'; // Import the default model

// Basic HTML tag stripper (can be improved)
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>?/gm, '');
}

export const summarizeUrl = tool({
  description: 'Summarizes the content of a web page.',
  parameters: z.object({
    url: z.string().url().describe('The URL of the web page to summarize.'),
  }),
  execute: async ({ url }): Promise<{ summary?: string; error?: string }> => {
    // 1. URL Validation (handled by Zod schema)
    // try {
    //   new URL(url); // Zod's .url() handles this
    // } catch (error) {
    //   return { error: 'Invalid URL format.' };
    // }

    let htmlContent: string;
    try {
      // 2. Fetch HTML Content
      const response = await fetch(url);

      if (!response.ok) {
        return { error: `Failed to fetch page: HTTP status ${response.status}` };
      }

      htmlContent = await response.text();

      // Check for non-html content if possible (e.g. via headers)
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('text/html')) {
        return { error: `Content is not HTML (type: ${contentType}). Cannot summarize.` };
      }

    } catch (error) {
      if (error instanceof Error) {
        return { error: `Network error when fetching the page: ${error.message}` };
      }
      return { error: 'Unknown network error when fetching the page.' };
    }

    // 3. Extract Text
    const textContent = stripHtmlTags(htmlContent);

    if (!textContent.trim()) {
      return { error: 'No text content found on the page to summarize.' };
    }

    // 4. AI Summarization (Placeholder for actual AI SDK call)
    try {
      // Use the default chat model from the project
      // Make sure generateText is compatible with the model from myProvider
      const generationResult = await generateText({
        model: DEFAULT_CHAT_MODEL, // This should be a LanguageModel instance or a string ID handled by the provider
        prompt: `Summarize the following text:\n\n${textContent.substring(0, 4000)}`, // Limit input length
      });
      // Assuming generateText returns an object with a 'text' property for the summary.
      // If not, adapt based on actual return structure (e.g. generationResult.text, or just generationResult if it's a string)
      const summary = typeof generationResult === 'string' ? generationResult : generationResult.text;

      return { summary };
    } catch (error) {
      if (error instanceof Error) {
        return { error: `AI summarization failed: ${error.message}` };
      }
      return { error: 'Unknown error during AI summarization.' };
    }
  },
});
