import { test, expect, Page } from '@playwright/test';

const MOCK_USER_MESSAGE = 'Can you help me?';
const MOCK_AI_ORIGINAL_RESPONSE = 'Hello from mock AI, I can assist you.';
const MOCK_AI_TRANSLATED_SPANISH = 'Hola desde la IA simulada, puedo ayudarte.';
const MOCK_TRANSLATION_ERROR_MESSAGE = 'Mock translation to xx failed because it is a test code.';

// Helper function to mock /api/chat for translation scenarios
async function mockApiChatForTranslation(
  page: Page,
  options: {
    selectedLanguage: string;
    aiOriginalText?: string;
    aiTranslatedText?: string;
    translationError?: string;
  }
) {
  await page.route('**/api/chat', async (route) => {
    const request = route.request();
    const postData = request.postDataJSON();

    // Only intercept if the selectedLanguage matches what we're testing
    if (postData.selectedLanguage === options.selectedLanguage) {
      const assistantMessageId = `asst_trans_${Date.now()}`;
      let parts = [{ type: 'text', text: options.aiOriginalText || MOCK_AI_ORIGINAL_RESPONSE }];
      let messagePayload: any = {
        id: assistantMessageId,
        role: 'assistant',
        parts: parts,
      };

      if (options.selectedLanguage && options.selectedLanguage !== 'en') {
        if (options.translationError) {
          // Keep original text in parts, add error fields
          messagePayload.translationError = options.translationError;
          messagePayload.targetLanguage = options.selectedLanguage;
          // parts[0].text remains original
        } else if (options.aiTranslatedText) {
          // Put translated text in parts, add original and targetLanguage
          parts[0].text = options.aiTranslatedText;
          messagePayload.originalText = options.aiOriginalText || MOCK_AI_ORIGINAL_RESPONSE;
          messagePayload.targetLanguage = options.selectedLanguage;
        }
      }
      // If 'en' or no translation happened, messagePayload is just original text without extra fields

      const streamChunk = `0:[${JSON.stringify(messagePayload)}]\n`;
      
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: streamChunk,
      });
    } else {
      // Let other calls pass or be handled by other mocks if any
      await route.continue();
    }
  });
}

test.describe('Real-time Translation E2E Tests', () => {
  test('should display translated AI response when a target language is selected', async ({ page }) => {
    await mockApiChatForTranslation(page, {
      selectedLanguage: 'es',
      aiOriginalText: MOCK_AI_ORIGINAL_RESPONSE,
      aiTranslatedText: MOCK_AI_TRANSLATED_SPANISH,
    });

    await page.goto('/');

    // Select Spanish from the language dropdown
    await page.locator('header').getByRole('button', { name: /Language|English/i }).click(); // Open dropdown
    await page.getByRole('option', { name: 'Spanish' }).click(); // Select Spanish

    // Send a message
    await page.getByTestId('multimodal-input').fill(MOCK_USER_MESSAGE);
    await page.getByTestId('send-button').click();

    // Verify translated response and indicator
    const assistantMessage = page.locator('[data-testid="message-assistant"]').last();
    await expect(assistantMessage.getByText(MOCK_AI_TRANSLATED_SPANISH)).toBeVisible({ timeout: 10000 });
    await expect(assistantMessage.getByText('Translated from English to es.')).toBeVisible();
  });

  test('should display original AI response when English (default) is selected', async ({ page }) => {
    await mockApiChatForTranslation(page, {
      selectedLanguage: 'en', // or undefined if that's how "no translation" is sent
      aiOriginalText: MOCK_AI_ORIGINAL_RESPONSE,
    });

    await page.goto('/');

    // Ensure English is selected (or is default)
    await page.locator('header').getByRole('button', { name: /Language|English/i }).click();
    await page.getByRole('option', { name: 'English' }).click();
    
    await page.getByTestId('multimodal-input').fill(MOCK_USER_MESSAGE);
    await page.getByTestId('send-button').click();

    const assistantMessage = page.locator('[data-testid="message-assistant"]').last();
    await expect(assistantMessage.getByText(MOCK_AI_ORIGINAL_RESPONSE)).toBeVisible({ timeout: 10000 });
    // Check that no translation indicator is present
    await expect(assistantMessage.getByText(/Translated from English to/)).not.toBeVisible();
    await expect(assistantMessage.getByText(/Translation to .* failed:/)).not.toBeVisible();
  });

  test('should display translation error if translation fails', async ({ page }) => {
    const errorLangCode = 'xx';
    await mockApiChatForTranslation(page, {
      selectedLanguage: errorLangCode,
      aiOriginalText: MOCK_AI_ORIGINAL_RESPONSE,
      translationError: MOCK_TRANSLATION_ERROR_MESSAGE,
    });

    await page.goto('/');

    // Select a (mock) problematic language - needs to be added to LanguageContext for UI selection
    // For now, we assume "xx" could be selected if available in dropdown.
    // If not, this part of test setup needs adjustment (e.g. adding "xx" to availableLanguages in LanguageProvider for test mode)
    // For this test, we'll assume "xx" can be chosen. If the UI doesn't allow it, the mock won't be hit correctly.
    // Let's add a temporary language to the list for the test or use an existing one and make it fail.
    // For simplicity, let's assume 'Japanese' is selected and we make it fail.
    const failingLanguageName = 'Japanese';
    const failingLanguageCode = 'ja';

    await mockApiChatForTranslation(page, { // Re-apply mock for the specific language code
      selectedLanguage: failingLanguageCode,
      aiOriginalText: MOCK_AI_ORIGINAL_RESPONSE,
      translationError: `Mock translation to ${failingLanguageCode} failed.`,
    });

    await page.locator('header').getByRole('button', { name: /Language|English/i }).click();
    await page.getByRole('option', { name: failingLanguageName }).click(); // Select Japanese

    await page.getByTestId('multimodal-input').fill(MOCK_USER_MESSAGE);
    await page.getByTestId('send-button').click();

    const assistantMessage = page.locator('[data-testid="message-assistant"]').last();
    // Original text should be shown
    await expect(assistantMessage.getByText(MOCK_AI_ORIGINAL_RESPONSE)).toBeVisible({ timeout: 10000 });
    // Error indicator should be shown
    await expect(assistantMessage.getByText(`Translation to ${failingLanguageCode} failed: Mock translation to ${failingLanguageCode} failed.`)).toBeVisible();
  });
});
