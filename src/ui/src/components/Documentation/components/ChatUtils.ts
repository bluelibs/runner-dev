export const generateUnifiedDiff = (prevContent: string, newContent: string, fileName: string): string => {
  const prevLines = prevContent.split('\n');
  const newLines = newContent.split('\n');
  
  let diff = `--- a/${fileName}\n+++ b/${fileName}\n`;
  
  // Simple line-by-line diff (in production, use a proper diff library like diff2html)
  const maxLines = Math.max(prevLines.length, newLines.length);
  let hunkStart = 0;
  let hunkLines: string[] = [];
  
  for (let i = 0; i < maxLines; i++) {
    const prevLine = prevLines[i];
    const newLine = newLines[i];
    
    if (prevLine === newLine) {
      hunkLines.push(` ${prevLine || ''}`);
    } else {
      if (prevLine !== undefined) {
        hunkLines.push(`-${prevLine}`);
      }
      if (newLine !== undefined) {
        hunkLines.push(`+${newLine}`);
      }
    }
  }
  
  if (hunkLines.length > 0) {
    diff += `@@ -${hunkStart + 1},${prevLines.length} +${hunkStart + 1},${newLines.length} @@\n`;
    diff += hunkLines.join('\n');
  }
  
  return diff;
};

export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (seconds < 30) return "now";
  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
    return false;
  }
};

export const parseMessageForFiles = (text: string) => {
  const fileRegex = /\[([^\]]+)\]/g;
  const parts: Array<{ type: 'text' | 'file'; content: string }> = [];
  let lastIndex = 0;
  let match;
  
  while ((match = fileRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'file', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  
  return parts;
};

export const getThinkingText = (stage: "none" | "thinking" | "processing" | "generating"): string => {
  switch (stage) {
    case "thinking": return "Thinking";
    case "processing": return "Processing";
    case "generating": return "Generating response";
    default: return "";
  }
};

export const saveChatHistory = (messages: any[]) => {
  try {
    localStorage.setItem('chat-sidebar-history', JSON.stringify({
      messages,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to save chat history:', e);
  }
};

export const loadChatHistory = () => {
  try {
    const saved = localStorage.getItem('chat-sidebar-history');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.messages || [];
    }
  } catch (e) {
    console.warn('Failed to load chat history:', e);
  }
  return null;
};