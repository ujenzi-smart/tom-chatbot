import { test, expect, Page } from '@playwright/test';

const MOCK_TARGET_URL = 'https://e2e.test/summarize-me';
const MOCK_HTML_CONTENT = `
  <!DOCTYPE html>
  <html>
  <head><title>E2E Test Page</title></head>
  <body>
    <h1>Hello E2E</h1>
    <p>This is content that the mock AI will summarize for our E2E test.</p>
  </body>
  </html>
`;
const MOCK_AI_SUMMARY = 'This is a mock E2E summary of the test page content.';
const MOCK_AI_ERROR = 'Mock AI failed to summarize this URL.';

// Helper function to mock the /api/chat response for summarization
async function mockApiChatForSummarization(
  page: Page,
  targetUrl: string,
  summary?: string,
  error?: string,
) {
  await page.route('**/api/chat', async (route) => {
    const request = route.request();
    const postData = request.postDataJSON();

    // Check if this is the request triggered by "Summarize this URL: <targetUrl>"
    const lastMessageContent = postData.message?.parts?.[0]?.text;
    if (lastMessageContent === `Summarize this URL: ${targetUrl}`) {
      // Construct a mock stream that simulates the AI SDK's tool usage
      // This is a simplified representation. Actual stream might be more complex.
      // 0:[data]
      // 2:[tool_call]
      // 2:[tool_result]
      // 0:[text_delta] (final assistant message if any)

      let streamChunks: string[] = [];

      // 1. Tool Call part (invoking summarizeUrl)
      const toolCallId = `tool_call_${Date.now()}`;
      const toolCallPayload = {
        type: 'tool-invocation',
        toolName: 'summarizeUrl',
        toolCallId: toolCallId,
        args: { url: targetUrl },
        state: 'call', // This is what components/message.tsx looks for
      };
      // The stream format is typically "id:[event]\ndata: json\n\n"
      // For Vercel AI SDK, it might be "2:[{...}]" for tool calls/results
      // Let's use a simplified text-based stream part for the message component to pick up
      // Assuming the message UI part can handle a 'tool_invocation' part directly in the message stream.
      // Actual stream data needs to match what streamUI/useChat expects.
      // This part is tricky and might need adjustment based on actual stream structure.

      // Simulate the "Summarizing URL..." message part
      const assistantMessageIdCall = `asst_call_${Date.now()}`;
      streamChunks.push(`0:[{"id":"${assistantMessageIdCall}","role":"assistant","parts":[{"type":"tool-invocation","toolName":"summarizeUrl","toolCallId":"${toolCallId}","args":{"url":"${targetUrl}"},"state":"call"}]}]\n`);


      // 2. Tool Result part
      const toolResultPayload = {
        type: 'tool-invocation',
        toolName: 'summarizeUrl',
        toolCallId: toolCallId,
        args: { url: targetUrl }, // Args are often included in result part too
        state: 'result',
        result: summary ? { summary } : { error },
      };
      const assistantMessageIdResult = `asst_res_${Date.now()}`;
      streamChunks.push(`0:[{"id":"${assistantMessageIdResult}","role":"assistant","parts":[{"type":"tool-invocation","toolName":"summarizeUrl","toolCallId":"${toolCallId}","args":{"url":"${targetUrl}"},"state":"result","result":${JSON.stringify(summary ? {summary} : {error})}}]}]\n`);
      
      // Send a text message indicating completion if desired (optional)
      // streamChunks.push(`0:[{"id":"asst_done_${Date.now()}","role":"assistant","parts":[{"type":"text","text":"Summary processed."}]}]\n`);


      // Route with the mock stream
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8', // Vercel AI SDK stream content type
        body: streamChunks.join(''),
      });
    } else {
      // For any other /api/chat call, let it pass through or mock generically
      await route.continue();
    }
  });
}


test.describe('URL Summarization E2E Tests', () => {
  test('should display summary when a URL is submitted via Summarize URL button', async ({ page }) => {
    // 1. Mock network requests
    // Mock fetching the target URL itself (if the tool actually tried to fetch it during E2E)
    // For this test, we assume the AI tool is mocked at the /api/chat level, so no actual fetch by summarizeUrl happens.
    // If summarizeUrl was to be tested without mocking its AI part, we'd mock MOCK_TARGET_URL fetch here.
    // await page.route(MOCK_TARGET_URL, async route => {
    //   await route.fulfill({ status: 200, contentType: 'text/html', body: MOCK_HTML_CONTENT });
    // });

    // Mock the /api/chat endpoint to control AI response and tool usage
    await mockApiChatForSummarization(page, MOCK_TARGET_URL, MOCK_AI_SUMMARY);

    // 2. Navigate to chat page
    await page.goto('/'); // Adjust if chat is not at root

    // 3. Type the URL and trigger summarization
    await page.getByTestId('multimodal-input').fill(MOCK_TARGET_URL);

    // Check that "Summarize URL" button appears
    const summarizeButton = page.getByTestId('summarize-url-button');
    await expect(summarizeButton).toBeVisible();
    await summarizeButton.click();

    // 4. Verify loading state for summarization
    // This message is rendered by components/message.tsx for state: 'call'
    const loadingMessageLocator = page.locator(`[data-testid="message-assistant"] div:has-text("Summarizing URL: ${MOCK_TARGET_URL}...")`);
    await expect(loadingMessageLocator).toBeVisible({ timeout: 10000 }); // Increased timeout for stream processing

    // 5. Verify summary display
    // This content is rendered by SummarizeUrlDisplay via components/message.tsx for state: 'result'
    const summaryDisplayLocator = page.locator(`[data-testid="message-assistant"] div[class*="bg-muted"]`); // Adjust selector for SummarizeUrlDisplay

    // Check for original URL display
    await expect(summaryDisplayLocator.getByText(`Summary for:`)).toBeVisible();
    const urlLink = summaryDisplayLocator.getByRole('link', { name: MOCK_TARGET_URL });
    await expect(urlLink).toBeVisible();
    await expect(urlLink).toHaveAttribute('href', MOCK_TARGET_URL);

    // Check for summary text
    await expect(summaryDisplayLocator.getByText(MOCK_AI_SUMMARY)).toBeVisible();
    
    // Ensure input is cleared
    await expect(page.getByTestId('multimodal-input')).toHaveValue('');
  });

  test('should display error when summarization tool returns an error', async ({ page }) => {
    await mockApiChatForSummarization(page, MOCK_TARGET_URL, undefined, MOCK_AI_ERROR);

    await page.goto('/');
    await page.getByTestId('multimodal-input').fill(MOCK_TARGET_URL);
    const summarizeButton = page.getByTestId('summarize-url-button');
    await expect(summarizeButton).toBeVisible();
    await summarizeButton.click();
    
    const loadingMessageLocator = page.locator(`[data-testid="message-assistant"] div:has-text("Summarizing URL: ${MOCK_TARGET_URL}...")`);
    await expect(loadingMessageLocator).toBeVisible({ timeout: 10000 });

    const errorDisplayLocator = page.locator(`[data-testid="message-assistant"] div[class*="bg-muted"]`); // Adjust for SummarizeUrlDisplay

    await expect(errorDisplayLocator.getByText(`Summary for:`)).toBeVisible();
    const urlLinkOnError = errorDisplayLocator.getByRole('link', { name: MOCK_TARGET_URL });
    await expect(urlLinkOnError).toBeVisible();

    await expect(errorDisplayLocator.getByText('Error summarizing URL:')).toBeVisible();
    await expect(errorDisplayLocator.getByText(MOCK_AI_ERROR)).toBeVisible();
    
    await expect(page.getByTestId('multimodal-input')).toHaveValue('');
  });
});
