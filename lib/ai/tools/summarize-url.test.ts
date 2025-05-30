import { summarizeUrl } from './summarize-url';
import { DEFAULT_CHAT_MODEL } from '../models';
import { generateText } from 'ai';

// Mock global fetch
global.fetch = vi.fn();

// Mock 'ai' module
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

// Mock models if they are more complex or have side effects, for now, direct import is fine
// vi.mock('../models', () => ({
//   DEFAULT_CHAT_MODEL: 'test-chat-model',
// }));

describe('summarizeUrl Tool Unit Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  const mockValidUrl = 'https://example.com/article';

  it('should successfully summarize a valid URL with HTML content', async () => {
    (fetch as vi.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Test Page</title></head><body><p>This is some interesting content to summarize.</p></body></html>',
      headers: new Headers({ 'Content-Type': 'text/html' }),
    });
    (generateText as vi.Mock).mockResolvedValue({
      text: 'This is a summary of the interesting content.',
      // other potential fields from generateText result if needed
    });

    const result = await summarizeUrl.execute({ url: mockValidUrl });

    expect(fetch).toHaveBeenCalledWith(mockValidUrl);
    expect(generateText).toHaveBeenCalledWith({
      model: DEFAULT_CHAT_MODEL,
      prompt: 'Summarize the following text:\n\nThis is some interesting content to summarize.',
    });
    expect(result).toEqual({ summary: 'This is a summary of the interesting content.' });
  });

  it('should return an error for network issues during fetch', async () => {
    (fetch as vi.Mock).mockRejectedValue(new Error('Network connection failed'));

    const result = await summarizeUrl.execute({ url: mockValidUrl });

    expect(fetch).toHaveBeenCalledWith(mockValidUrl);
    expect(result).toEqual({ error: 'Network error when fetching the page: Network connection failed' });
  });

  it('should return an error for non-successful HTTP status codes', async () => {
    (fetch as vi.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(), // Add headers if your main code accesses them
    });

    const result = await summarizeUrl.execute({ url: mockValidUrl });

    expect(fetch).toHaveBeenCalledWith(mockValidUrl);
    expect(result).toEqual({ error: 'Failed to fetch page: HTTP status 404' });
  });

  it('should return an error if content type is not HTML', async () => {
    (fetch as vi.Mock).mockResolvedValue({
      ok: true,
      text: async () => '{"data": "not html"}',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const result = await summarizeUrl.execute({ url: mockValidUrl });

    expect(fetch).toHaveBeenCalledWith(mockValidUrl);
    expect(result).toEqual({ error: 'Content is not HTML (type: application/json). Cannot summarize.' });
  });

  it('should return an error if no text content is found on the page', async () => {
    (fetch as vi.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Empty Page</title></head><body><!-- Just comments --></body></html>',
      headers: new Headers({ 'Content-Type': 'text/html' }),
    });

    const result = await summarizeUrl.execute({ url: mockValidUrl });

    expect(fetch).toHaveBeenCalledWith(mockValidUrl);
    expect(generateText).not.toHaveBeenCalled();
    expect(result).toEqual({ error: 'No text content found on the page to summarize.' });
  });

  it('should return an error if AI summarization fails', async () => {
    (fetch as vi.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><body>Some text</body></html>',
      headers: new Headers({ 'Content-Type': 'text/html' }),
    });
    (generateText as vi.Mock).mockRejectedValue(new Error('AI model error'));

    const result = await summarizeUrl.execute({ url: mockValidUrl });

    expect(fetch).toHaveBeenCalledWith(mockValidUrl);
    expect(generateText).toHaveBeenCalled();
    expect(result).toEqual({ error: 'AI summarization failed: AI model error' });
  });
  
  // Test for Zod schema validation (Invalid URL)
  // This test is more about the tool's definition than its execute function,
  // as Zod validation happens before execute is called by the `tool` wrapper.
  it('should fail schema validation for an invalid URL', () => {
    const invalidUrlData = { url: 'not-a-valid-url' };
    // The `parameters` object is a Zod schema
    const parseResult = summarizeUrl.parameters.safeParse(invalidUrlData);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      // Check for the specific URL validation error
      expect(parseResult.error.errors[0].message).toContain('Invalid url');
    }
  });

  it('should handle generateText returning a string directly', async () => {
    (fetch as vi.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><body>Direct string summary content.</body></html>',
      headers: new Headers({ 'Content-Type': 'text/html' }),
    });
    // Mock generateText to return a plain string
    (generateText as vi.Mock).mockResolvedValue('Direct summary string.');

    const result = await summarizeUrl.execute({ url: mockValidUrl });

    expect(generateText).toHaveBeenCalledWith({
      model: DEFAULT_CHAT_MODEL,
      prompt: 'Summarize the following text:\n\nDirect string summary content.',
    });
    expect(result).toEqual({ summary: 'Direct summary string.' });
  });
});
