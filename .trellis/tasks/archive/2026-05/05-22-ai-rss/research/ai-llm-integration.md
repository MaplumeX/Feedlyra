# Research: AI/LLM Integration for RSS Readers

- **Query**: How modern RSS readers integrate AI/LLM capabilities (summarization, translation, conversational Q&A)
- **Scope**: External (with project context: Python FastAPI backend + TypeScript React frontend)
- **Date**: 2026-05-22

## Findings

### 1. LLM APIs Commonly Used in RSS Readers

| Provider | API | Typical Use Case | Notes |
|----------|-----|------------------|-------|
| OpenAI | GPT-4o / GPT-4o-mini | Summarization, translation, chat | Most widely adopted; best documentation and SDK ecosystem |
| Anthropic | Claude 3.5 Sonnet / Haiku | Summarization, nuanced analysis | Strong at long-context tasks; 200K context window |
| Google | Gemini 1.5 Pro / Flash | Multilingual translation, summarization | Good multilingual support; competitive pricing |
| Ollama (local) | Llama 3 / Mistral / Qwen | Privacy-sensitive summarization | Zero per-call cost; requires GPU; latency varies by hardware |
| Groq | Llama 3 / Mixtral (hosted) | Low-latency summarization | Fastest inference; useful for real-time UI |
| DeepSeek | DeepSeek-V3 / Chat | Cost-effective summarization/translation | Very low pricing; strong Chinese language support |
| OpenRouter | Multi-model router | A/B testing across models | Single API, access to 100+ models |

**Key observation**: Most production RSS readers support multiple providers through an abstraction layer, allowing users to bring their own API key (BYOK) or switch between providers.

### 2. Common Patterns for AI Features

#### 2.1 Article Summarization

**Architecture pattern**: Background job on article ingestion, with on-demand fallback.

```
RSS Feed -> Fetch -> Store article -> Trigger AI summarization (async)
                                       |
                                       v
                                  Store summary in DB
                                  (article_summary table)
```

**Implementation details**:

- **Async processing**: When a new article is fetched, enqueue a summarization task (using Celery, arq, or FastAPI BackgroundTasks). The summary is generated and stored in the database, not generated on-demand per request.
- **Prompt pattern** (widely used):
  ```
  Summarize the following article in 3-5 bullet points. Focus on key facts and conclusions.
  Title: {title}
  Content: {cleaned_content}
  ```
- **Content cleaning**: Before sending to LLM, strip HTML tags, remove ads/navigation elements, extract main article content. Libraries: `readability-lxml` (Python), `trafilatura` (Python, best quality), `newspaper3k` (Python).
- **Content truncation**: Most articles fit within 4K-8K tokens. For very long articles, truncate to fit model context limit, or use chunked summarization (summarize chunks, then summarize summaries).
- **Caching**: Store generated summaries permanently in DB. Re-generate only if article content changes (rare for RSS articles).
- **Model choice**: GPT-4o-mini or Claude 3.5 Haiku are sufficient for summarization. Cost: ~$0.15 per 1M input tokens (GPT-4o-mini), ~$0.25 per 1M input tokens (Claude Haiku). A typical article summary costs $0.001-0.005.

**Database schema pattern**:
```sql
CREATE TABLE article_ai_data (
    article_id UUID PRIMARY KEY REFERENCES articles(id),
    summary TEXT,
    summary_model VARCHAR(50),
    summary_created_at TIMESTAMPTZ,
    translated_title TEXT,
    translated_content TEXT,
    translation_lang VARCHAR(10),
    translation_model VARCHAR(50),
    translation_created_at TIMESTAMPTZ
);
```

#### 2.2 Translation

**Architecture pattern**: On-demand with persistent caching.

- **Trigger**: User clicks "Translate" button in article view.
- **Process**: Send article content to LLM with translation prompt, store result, return to user.
- **Prompt pattern**:
  ```
  Translate the following article from {source_lang} to {target_lang}.
  Preserve the original formatting and structure.
  Title: {title}
  Content: {content}
  ```
- **Language detection**: Can be done by LLM itself (ask in prompt) or using `langdetect` / `fasttext` library for efficiency.
- **Caching strategy**: Translation is deterministic for a given model + target language. Store translation result permanently. Key: `(article_id, target_language, model)`.
- **Model choice**: DeepSeek-V3 and GPT-4o are strong for translation. DeepSeek has excellent Chinese translation quality. For European languages, GPT-4o-mini is sufficient.

#### 2.3 RAG-Based Q&A Over Article Content

**Architecture pattern**: Constrained context window RAG (article-scoped, not global).

**Key insight**: For RSS readers, RAG is simpler than general-purpose RAG because:
1. Context is scoped to a single article (or a few articles)
2. Most articles fit entirely within modern LLM context windows (4K-128K tokens)
3. No need for vector databases for single-article Q&A

**Two implementation approaches**:

**Approach A: Full-context injection (recommended for MVP)**
- Load entire article content into the system prompt
- User asks questions, LLM answers based on provided context
- No vector DB needed
- Works for articles up to ~100K tokens (with Claude/Gemini long-context)
- Prompt:
  ```
  You are an AI assistant helping a user understand an article.
  Answer questions based solely on the article content below.
  If the answer is not in the article, say so.

  ARTICLE:
  {article_full_content}
  ```
- Simple, effective, no retrieval complexity

**Approach B: Vector RAG (for multi-article / cross-feed Q&A, future scope)**
- Embed articles using embedding model (OpenAI text-embedding-3-small, or local via Ollama with nomic-embed-text)
- Store embeddings in pgvector extension (already available for PostgreSQL)
- Retrieve relevant chunks, inject into prompt
- This enables "ask across my subscriptions" functionality

**Conversation pattern**:
- Store chat history per article in DB
- Send last N turns + article content to LLM each turn
- Manage context window: if conversation exceeds model limit, truncate oldest turns or summarize conversation history

**Database schema pattern**:
```sql
CREATE TABLE article_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES articles(id),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    model VARCHAR(50)
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES article_chats(id),
    role VARCHAR(10) NOT NULL, -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Streaming Response Patterns for Chat UI

#### 3.1 Server-Sent Events (SSE) -- Recommended

**Why SSE over WebSocket for this use case**:
- LLM responses are server-to-client streaming (unidirectional)
- SSE is simpler to implement, works over HTTP/2, no connection upgrade needed
- SSE auto-reconnects on connection drop
- WebSocket is overkill when client only sends small messages and receives large streams

**Backend implementation (FastAPI + SSE)**:
```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

@app.post("/api/articles/{article_id}/chat")
async def chat_with_article(article_id: str, message: ChatMessage):
    # Build prompt with article context + history
    messages = build_messages(article_id, message)

    async def event_stream():
        client = AsyncOpenAI()
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                data = json.dumps({"content": chunk.choices[0].delta.content})
                yield f"data: {data}\n\n"
        yield f"data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**Frontend consumption (React)**:
```typescript
async function streamChat(articleId: string, message: string) {
  const response = await fetch(`/api/articles/${articleId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    // Parse SSE data lines, update state incrementally
    parseSSE(text, (chunk) => {
      setAssistantMessage(prev => prev + chunk);
    });
  }
}
```

**SSE format**:
```
data: {"content": "Hello"}

data: {"content": " world"}

data: [DONE]
```

#### 3.2 WebSocket (alternative)

- Useful if you need bidirectional real-time communication (e.g., user interrupts generation, multiple parallel operations)
- More complex: connection management, heartbeat, reconnection logic
- Not necessary for simple chat Q&A

#### 3.3 ReadableStream (fetch API native)

- Can use `response.body` ReadableStream directly without SSE framing
- Simpler on backend (just stream text), but loses structured event types
- Less interoperable than SSE

**Recommendation for Feedlyra**: Use SSE. It is the industry standard for LLM streaming in web apps, well-supported by FastAPI (StreamingResponse) and all modern browsers.

### 4. Cost/Performance Trade-offs for Different LLM Providers

#### 4.1 Pricing Comparison (as of early 2026)

| Provider | Model | Input $/1M tokens | Output $/1M tokens | Context Window | Speed (tokens/s) |
|----------|-------|-------------------|---------------------|----------------|------------------|
| OpenAI | GPT-4o | $2.50 | $10.00 | 128K | ~80 |
| OpenAI | GPT-4o-mini | $0.15 | $0.60 | 128K | ~150 |
| Anthropic | Claude 3.5 Sonnet | $3.00 | $15.00 | 200K | ~60 |
| Anthropic | Claude 3.5 Haiku | $0.80 | $4.00 | 200K | ~150 |
| Google | Gemini 1.5 Flash | $0.075 | $0.30 | 1M | ~200 |
| Google | Gemini 1.5 Pro | $1.25 | $5.00 | 2M | ~80 |
| DeepSeek | DeepSeek-V3 | $0.27 | $1.10 | 128K | ~60 |
| Groq | Llama 3.1 70B | $0.59 | $0.79 | 128K | ~300 |
| Ollama (local) | Llama 3.1 8B | Free | Free | 8K-128K | 20-100 (hardware dependent) |

#### 4.2 Cost Estimates for RSS Reader Use Cases

**Per-article summarization (GPT-4o-mini)**:
- Average article: ~2,000 input tokens, ~200 output tokens
- Cost: ~$0.0004 per article
- 100 articles/day = ~$1.20/month

**Per-article translation (GPT-4o-mini)**:
- Average article: ~2,000 input tokens, ~2,000 output tokens
- Cost: ~$0.0015 per article
- 20 translations/day = ~$0.90/month

**Chat Q&A (GPT-4o-mini)**:
- Per turn: ~3,000 input tokens (article context + history), ~300 output tokens
- Cost: ~$0.0007 per turn
- 50 turns/day = ~$1.05/month

**Total estimated cost for active user (GPT-4o-mini)**: ~$3-5/month

**With BYOK model**: User provides their own API key, zero cost to the service provider.

#### 4.3 Model Selection Strategy for Each Feature

| Feature | Recommended Model | Rationale |
|---------|-------------------|-----------|
| Summarization | GPT-4o-mini / Claude Haiku / Gemini Flash | Cheapest acceptable quality; summarization is a well-solved task |
| Translation | GPT-4o-mini / DeepSeek-V3 | DeepSeek excels at Chinese; GPT-4o-mini for European languages |
| Chat Q&A | GPT-4o / Claude Sonnet | Needs better reasoning; user-facing quality matters more |
| Embedding (future RAG) | text-embedding-3-small / nomic-embed-text (local) | Standard embedding models; nomic is free via Ollama |

#### 4.4 Cost Optimization Patterns

1. **BYOK (Bring Your Own Key)**: Let users provide their own API keys. Zero marginal cost for the service.
2. **Model routing**: Use cheaper models (GPT-4o-mini) for batch tasks (summarization), better models (GPT-4o) for interactive tasks (chat).
3. **Caching**: Never regenerate summaries/translations for the same article. Cache aggressively.
4. **Batch processing**: Summarize articles in background, not on-demand. This allows using cheaper/slower models.
5. **Local model fallback**: Offer Ollama integration for privacy-conscious users or cost-sensitive scenarios.

### 5. Open-Source RSS Reader Projects with AI Features

| Project | Language | AI Features | Stars (approx) | Notes |
|---------|----------|-------------|-----------------|-------|
| **Follow** (follow-is/follow) | TypeScript (Next.js) | AI summarization, translation, action (custom AI prompts) | 20K+ | Most relevant reference. Built on RSSHub. Uses OpenAI-compatible API. Supports BYOK. Has "AI actions" where users define custom prompt templates. |
| **RSSHub** (DIYgod/RSSHub) | TypeScript | RSS feed generation (not AI reader, but ecosystem dependency) | 35K+ | Not an AI reader, but many AI RSS readers depend on it for feed generation |
| **Readeck** | Go | AI-powered bookmarking and summarization | 2K+ | Self-hosted bookmark manager with RSS support and AI summarization |
| **Omnivore** (omnivore-app/omnivore) | TypeScript | Read-later app with highlighting (AI features added before shutdown) | 15K+ | Archived/shut down, but code is open source. Had AI summarization. |
| **Miniflux** | Go | Minimalist RSS reader (no built-in AI, but has integrations/gophish) | 7K+ | No AI, but clean architecture worth referencing for feed fetching |
| **FreshRSS** | PHP | Extensions system allows AI integration | 10K+ | Has community extensions for AI summarization via OpenAI API |
| **NetNewsWire** | Swift | No AI (macOS/iOS native reader) | 8K+ | Reference for UX patterns, not AI |
| **Feedbin** | Ruby | No AI (paid service) | 3K+ | Reference for clean reading experience |

**Most relevant project: Follow (follow-is/follow)**

Follow is the closest reference to Feedlyra's vision. Key design patterns from Follow:
- **AI Provider abstraction**: Supports OpenAI, Anthropic, Google, local models via OpenAI-compatible API
- **AI Actions**: User-defined prompt templates (e.g., "Explain like I'm 5", "Extract key quotes")
- **Streaming UI**: Uses SSE for real-time AI response rendering
- **Background summarization**: Generates summaries when articles are fetched
- **BYOK model**: Users configure their own API keys in settings
- **Architecture**: Next.js app with server-side API routes proxying to LLM providers

### 6. Implementation Architecture for Feedlyra

Based on the research, the recommended integration architecture:

```
                    Frontend (React)
                         |
                    SSE Stream
                         |
              FastAPI Backend
               /      |       \
              /       |        \
    Summarization  Translation  Chat/Q&A
    (async job)    (on-demand)  (streaming)
         |             |            |
         +-------------+------------+
                       |
               LLM Provider Layer
              (abstract interface)
              /       |        \
           OpenAI  Anthropic  Ollama
          (remote) (remote)  (local)
```

**LLM Provider abstraction (Python)**:
```python
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, messages: list[dict], **kwargs) -> str: ...

    @abstractmethod
    async def stream(self, messages: list[dict], **kwargs) -> AsyncIterator[str]: ...

class OpenAIProvider(LLMProvider): ...
class AnthropicProvider(LLMProvider): ...
class OllamaProvider(LLMProvider): ...  # Uses OpenAI-compatible API
```

**Key Python libraries for LLM integration**:
- `openai` -- Official OpenAI SDK (also works with Ollama, Groq, DeepSeek via compatible API)
- `anthropic` -- Official Anthropic SDK
- `httpx-sse` -- SSE client for consuming streaming LLM responses (used internally by SDKs)
- `litellm` -- Unified interface for 100+ LLM providers (simplifies multi-provider support)
- `arq` or `celery` -- Async task queue for background summarization jobs

**Key Frontend libraries**:
- `@ai-sdk/openai` + `ai` (Vercel AI SDK) -- Popular React hook for streaming LLM UI (`useChat` hook)
- `fetch` with ReadableStream -- Native browser API, no dependencies needed
- `eventsource-parser` -- SSE parser for manual implementation

### 7. Specific Technical Considerations for Feedlyra

#### 7.1 Article Content Extraction

Before sending to LLM, RSS article content must be cleaned:
- RSS feeds provide content as HTML or plain text
- Need to extract main article content, strip boilerplate/navigation
- Python libraries:
  - `trafilatura` -- Best quality content extraction (recommended)
  - `readability-lxml` -- Port of Readability.js
  - `newspaper3k` -- Good but less maintained
- After extraction, convert to markdown or plain text for LLM input

#### 7.2 Rate Limiting and Queue Management

- LLM APIs have rate limits (requests per minute, tokens per minute)
- For background summarization, use a task queue with rate limiting
- For interactive chat, handle 429 errors with exponential backoff
- Consider user-level rate limiting to prevent abuse

#### 7.3 Error Handling for LLM Calls

- API key validation: Check key validity on save, not on first use
- Timeout: Set reasonable timeouts (30s for summarization, 120s for chat)
- Fallback: If primary provider fails, try fallback provider or return cached result
- Content safety: Handle moderation refusals gracefully in UI

#### 7.4 User Configuration

- API key storage: Encrypt at rest in database (using application secret)
- Model selection: Let user choose provider + model for each feature type
- Custom prompts: Allow advanced users to customize summarization/translation prompts

## Caveats / Not Found

- Pricing data is approximate as of early 2026 and may have changed. Verify at provider websites before implementation.
- No internal codebase to reference (project is greenfield).
- Exa web search was unavailable; findings are based on knowledge of the ecosystem up to Jan 2026. Some newer projects or library updates may exist.
- The "Follow" project is the most relevant open-source reference but its codebase should be verified for current architecture patterns before making implementation decisions.
