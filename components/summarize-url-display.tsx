import React from 'react';
import { AlertTriangleIcon, FileTextIcon } from 'lucide-react'; // Using lucide-react icons

interface SummarizeUrlDisplayProps {
  args: { url?: string; [key: string]: any }; // Tool arguments, expecting a URL
  result: { summary?: string; error?: string }; // Tool result
}

export const SummarizeUrlDisplay: React.FC<SummarizeUrlDisplayProps> = ({ args, result }) => {
  const url = args.url || 'Unknown URL';

  return (
    <div className="p-4 my-2 rounded-lg border bg-muted/30 dark:bg-muted/50">
      <div className="flex items-center text-sm font-medium text-muted-foreground mb-2">
        <FileTextIcon className="w-4 h-4 mr-2 flex-shrink-0" />
        <span>Summary for: </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-blue-600 dark:text-blue-400 hover:underline truncate"
          title={url}
        >
          {url}
        </a>
      </div>

      {result.summary && (
        <div className="text-sm text-foreground">
          <p>{result.summary}</p>
        </div>
      )}

      {result.error && (
        <div className="flex items-start text-sm text-red-600 dark:text-red-400 p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-500/50">
          <AlertTriangleIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error summarizing URL:</p>
            <p>{result.error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
