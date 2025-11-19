/**
 * AI Engine Integration Module
 * Supports ChatGPT (OpenAI), Perplexity, and Gemini (Google)
 */

interface EngineResponse {
  content: string;
  citations?: Array<{
    url: string;
    title?: string;
  }>;
  rawResponse: unknown;
}

// ============ OpenAI (ChatGPT) ============
export async function queryChatGPT(apiKey: string, query: string): Promise<EngineResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return {
    content,
    rawResponse: data,
  };
}

// ============ Perplexity ============
export async function queryPerplexity(apiKey: string, query: string): Promise<EngineResponse> {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-large-128k-online",
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const citations = data.citations?.map((citation: { url: string; title?: string }) => ({
    url: citation.url,
    title: citation.title,
  })) || [];

  return {
    content,
    citations,
    rawResponse: data,
  };
}

// ============ Google Gemini ============
export async function queryGemini(apiKey: string, query: string): Promise<EngineResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: query,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Gemini doesn't provide structured citations in the same way
  // We would need to parse the content for URLs if needed
  return {
    content,
    rawResponse: data,
  };
}

// ============ Unified Query Interface ============
export async function queryEngine(
  provider: "openai" | "perplexity" | "google",
  apiKey: string,
  query: string
): Promise<EngineResponse> {
  switch (provider) {
    case "openai":
      return queryChatGPT(apiKey, query);
    case "perplexity":
      return queryPerplexity(apiKey, query);
    case "google":
      return queryGemini(apiKey, query);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
