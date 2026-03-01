import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../state/store';
import type { ToolCall } from '../../state/store';

type FileAction = 'written' | 'edited' | 'read' | 'searched';

interface FileEntry {
  path: string;
  actions: Set<FileAction>;
}

function shortenPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `~/${parts.slice(-2).join('/')}`;
}

function extractFilesFromToolCall(tc: ToolCall): { path: string; action: FileAction }[] {
  const results: { path: string; action: FileAction }[] = [];
  const input = tc.toolInput;
  if (!input) return results;

  const name = tc.toolName;
  if (name === 'Write' && input.file_path) {
    results.push({ path: input.file_path as string, action: 'written' });
  } else if (name === 'Edit' && input.file_path) {
    results.push({ path: input.file_path as string, action: 'edited' });
  } else if (name === 'Read' && input.file_path) {
    results.push({ path: input.file_path as string, action: 'read' });
  } else if ((name === 'Grep' || name === 'Glob') && input.path) {
    results.push({ path: input.path as string, action: 'searched' });
  } else if (name === 'Bash' && input.command) {
    // Best effort: extract file paths from bash commands
    const cmd = input.command as string;
    const pathMatches = cmd.match(/(?:^|\s)(\/[\w./-]+\.\w+)/g);
    if (pathMatches) {
      for (const match of pathMatches) {
        results.push({ path: match.trim(), action: 'read' });
      }
    }
  }
  return results;
}

const actionColors: Record<FileAction, string> = {
  written: '#22d65e',
  edited: '#fbbf24',
  read: '#60a5fa',
  searched: '#a78bfa',
};

const actionLabels: Record<FileAction, string> = {
  written: 'W',
  edited: 'E',
  read: 'R',
  searched: 'S',
};

export default function SessionDiffSummary() {
  const toolCalls = useAppStore((s) => s.toolCalls);
  const [expanded, setExpanded] = useState(false);

  const fileMap = useMemo(() => {
    const map = new Map<string, FileEntry>();
    for (const tc of Object.values(toolCalls)) {
      const files = extractFilesFromToolCall(tc);
      for (const { path, action } of files) {
        const existing = map.get(path);
        if (existing) {
          existing.actions.add(action);
        } else {
          map.set(path, { path, actions: new Set([action]) });
        }
      }
    }
    return map;
  }, [toolCalls]);

  const fileCount = fileMap.size;
  if (fileCount === 0) return null;

  const files = Array.from(fileMap.values()).sort((a, b) => {
    // Sort by most actions first, then by path
    if (b.actions.size !== a.actions.size) return b.actions.size - a.actions.size;
    return a.path.localeCompare(b.path);
  });

  return (
    <div className="flex items-start">
      <button
        className="flex items-center gap-1 text-[12px] font-bold uppercase px-1 py-px"
        style={{
          color: '#60a5fa',
          backgroundColor: 'transparent',
          border: '1px solid var(--border)',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? '\u25BE' : '\u25B8'}</span>
        <span>FILES</span>
        <span style={{ color: 'var(--text-muted)' }}>{fileCount}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="absolute left-0 right-0 top-full z-10 max-h-48 overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderTop: 'none',
            }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-1 px-2 py-0.5 border-b text-[11px]"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex gap-px flex-shrink-0">
                  {Array.from(file.actions).map((action) => (
                    <span
                      key={action}
                      className="w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold"
                      style={{
                        backgroundColor: actionColors[action],
                        color: '#000',
                      }}
                    >
                      {actionLabels[action]}
                    </span>
                  ))}
                </div>
                <span className="truncate" style={{ color: 'var(--text-dim)' }}>
                  {shortenPath(file.path)}
                </span>
              </div>
            ))}

            <div className="flex gap-2 px-2 py-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>
              <span><span style={{ color: actionColors.written }}>W</span>=Written</span>
              <span><span style={{ color: actionColors.edited }}>E</span>=Edited</span>
              <span><span style={{ color: actionColors.read }}>R</span>=Read</span>
              <span><span style={{ color: actionColors.searched }}>S</span>=Searched</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
