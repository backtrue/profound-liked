/**
 * AI Engine Integration Module for Cloudflare Workers
 * Supports ChatGPT (OpenAI), Perplexity, and Gemini (Google)
 */

export interface EngineResponse {
    content: string;
    citations?: Array<{
        url: string;
        title?: string;
    }>;
    rawResponse: unknown;
}

// ============ OpenAI (ChatGPT) ============
export async function queryChatGPT(apiKey: string, query: string): Promise<EngineResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
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

    const data = await response.json() as any;
    return {
        content: data.choices[0]?.message?.content || "",
        citations: [],
        rawResponse: data,
    };
}

export async function executeValueSerpSearch(apiKey: string, query: string, market: 'TW' | 'JP' = 'TW') {
    const gl = market === 'TW' ? 'tw' : 'jp';
    const hl = market === 'TW' ? 'zh-tw' : 'ja';
    const location = market === 'TW' ? 'Taiwan' : 'Japan';

    const params = new URLSearchParams({
        api_key: apiKey,
        q: query,
        location: location,
        google_domain: 'google.com',
        gl: gl,
        hl: hl,
        device: 'desktop',
        include_html: 'false',
        output: 'json'
    });

    const response = await fetch(`https://api.valueserp.com/search?${params.toString()}`);

    if (!response.ok) {
        if (response.status === 429 || response.status === 402) {
            throw new Error('QUOTA_EXCEEDED');
        }
        const errorText = await response.text();
        throw new Error(`ValueSERP API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;

    // Parse AI Overview / SGE
    // ValueSERP usually puts this in 'knowledge_graph' or specific 'ai_overview' fields depending on updates.
    // Let's check for common SGE structures.
    // Note: ValueSERP structure for SGE might vary, but often it's in 'inline_knowledge' or similar if not explicit.
    // For now, we will look for 'ai_overview' or fallback to organic results if not found, 
    // but the goal is SGE.

    let content = "";
    const citations: Array<{ url: string; title?: string }> = [];

    // Check for AI Overview (SGE)
    if (data.ai_overview) {
        content += "=== AI Overview (SGE) ===\n";
        content += data.ai_overview.text || "";
        content += "\n\n";

        if (data.ai_overview.sources) {
            data.ai_overview.sources.forEach((source: any) => {
                if (source.link) citations.push({ url: source.link, title: source.title });
            });
        }
    } else if (data.knowledge_graph) {
        // Fallback to knowledge graph if SGE is missing but KG is present
        content += "=== Knowledge Graph ===\n";
        content += data.knowledge_graph.description || "";
        content += "\n\n";
    }

    if (!content) {
        content = "此查詢未觸發 AI Overview (SGE)，僅顯示自然搜尋結果。\n\n";
        if (data.organic_results) {
            content += "=== Top Organic Results ===\n";
            data.organic_results.slice(0, 5).forEach((result: any) => {
                content += `Title: ${result.title}\nSnippet: ${result.snippet}\nLink: ${result.link}\n\n`;
                if (result.link) citations.push({ url: result.link, title: result.title });
            });
        }
    }

    return {
        content,
        citations: [...new Set(citations.map(c => JSON.stringify(c)))].map(s => JSON.parse(s)), // Remove duplicates
        rawResponse: data,
    };
}

// ============ Perplexity ============
export async function queryPerplexity(apiKey: string, query: string): Promise<EngineResponse> {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [
                {
                    role: 'user',
                    content: query,
                },
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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

    const data = await response.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Gemini doesn't provide structured citations in the same way
    // We would need to parse the content for URLs if needed
    return {
        content,
        rawResponse: data,
    };
}

// ============ Unified Query Interface ============
export async function queryEngine(
    provider: 'openai' | 'perplexity' | 'google' | 'valueserp',
    apiKey: string,
    query: string
): Promise<EngineResponse> {
    switch (provider) {
        case 'openai':
            return queryChatGPT(apiKey, query);
        case 'perplexity':
            return queryPerplexity(apiKey, query);
        case 'google':
            return queryGemini(apiKey, query);
        case 'valueserp':
            return executeValueSerpSearch(apiKey, query);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}
