# Optimize LLM Summary Generation

## Goal

优化摘要截断策略：从简单的前 N 字符截断改为智能段落提取，解决长文后半段关键信息丢失的问题。

## Requirements

* 实现智能段落提取：按 HTML/段落结构解析文章，提取标题段落 + 每段首句 + 末段
* 总提取内容长度不超过 `MAX_CONTENT_CHARS`（8000）
* 当文章没有清晰段落/HTML 结构时，回退到当前的简单截断 `content[:8000]`
* 不改变 `MAX_CONTENT_CHARS`、`temperature`、`max_tokens` 等其他参数
* 不影响 translate 和 chat 的截断逻辑

## Acceptance Criteria

* [ ] 对于有清晰段落结构的文章，摘要能覆盖末段关键结论/发现
* [ ] 对于无段落结构的纯文本，行为与现有简单截断一致
* [ ] 提取内容总长度不超过 MAX_CONTENT_CHARS
* [ ] 现有摘要缓存（content_hash 机制）仍正常工作
* [ ] 单元测试覆盖：多段落文章、纯文本、空内容、短内容等场景

## Definition of Done

* Tests added/updated
* Lint / typecheck / CI green
* 缓存兼容性验证通过

## Out of Scope

* translate/chat 的截断优化
* prompt 工程优化
* 流式输出
* 摘要风格可配置
* MAX_CONTENT_CHARS 上限调整

## Technical Approach

在 `article_summary.py` 中新增智能段落提取函数，替代 `generate_summary()` 中的简单截断。

**提取算法：**
1. 按 `\n\n` 或 HTML `<p>` / `<br>` 标签分割段落
2. 始终保留第一段（引言/背景）
3. 对中间段落提取首句
4. 始终保留最后一段（结论/发现）
5. 总长度控制在 MAX_CONTENT_CHARS 内，超限时从中间段落首句开始裁剪
6. 无法识别段落分隔时回退到 `content[:MAX_CONTENT_CHARS]`

**触动文件：**
* `backend/app/services/article_summary.py` — 新增提取函数
* `backend/app/services/llm.py` — `generate_summary()` 调用新函数替代简单截断
* 测试文件

## Technical Notes

* `llm.py:18` — `MAX_CONTENT_CHARS = 8000`
* `llm.py:96-111` — `generate_summary()` — 当前截断逻辑在 line 98
* `article_summary.py:14-17` — `get_summary_content()` — feed vs full
* 文章内容来源：`article.content`（feed HTML）、`article.full_content`（全文 HTML）、`article.content_snippet`（纯文本摘要）
