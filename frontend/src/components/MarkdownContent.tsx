import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const html = useMemo(() => {
    if (!content) return "";
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert [&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_h4]:font-heading", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
