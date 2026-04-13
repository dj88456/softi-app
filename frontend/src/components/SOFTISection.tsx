import React, { useState, useRef, useEffect, useCallback } from 'react';

export type SectionKey = 'successes' | 'opportunities' | 'failures' | 'threats' | 'issues';

const SECTION_META: Record<SectionKey, { label: string; letter: string; color: string; bg: string; border: string; badge: string }> = {
  successes:     { label: 'Successes',     letter: 'S', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-600' },
  opportunities: { label: 'Opportunities', letter: 'O', color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    badge: 'bg-blue-600'    },
  failures:      { label: 'Failures',      letter: 'F', color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-600'     },
  threats:       { label: 'Threats',       letter: 'T', color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  badge: 'bg-orange-600'  },
  issues:        { label: 'Issues',        letter: 'I', color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-500'   },
};


// ─── Inline markdown renderer (for read-only display) ─────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        parts.push(<strong key={key++}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '_') {
      const end = text.indexOf('_', i + 1);
      if (end !== -1) {
        parts.push(<em key={key++}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    // accumulate plain text
    let j = i + 1;
    while (j < text.length && text[j] !== '*' && text[j] !== '_') j++;
    parts.push(<span key={key++}>{text.slice(i, j)}</span>);
    i = j;
  }
  return parts;
}

function RenderText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className="flex items-start gap-1 mt-0.5">
              <span className="text-gray-400 flex-shrink-0 leading-snug">○</span>
              <span>{renderInline(line)}</span>
            </span>
          )}
          {i === 0 && renderInline(line)}
        </React.Fragment>
      ))}
    </>
  );
}

// ─── Rich text input (textarea + toolbar) ─────────────────────────────────────

interface RichTextInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

function RichTextInput({
  value, onChange, onKeyDown, onBlur, placeholder, className, textareaRef,
}: RichTextInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? internalRef;

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value, ref]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Auto-continue bullet prefix on Enter
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      const ta = ref.current!;
      const { value, selectionStart: ss } = ta;
      const lineStart = value.lastIndexOf('\n', ss - 1) + 1;
      const lineText = value.slice(lineStart, ss);
      const matchedPrefix = ['• ', '○ ', '– '].find(p => lineText.startsWith(p));

      if (matchedPrefix) {
        e.preventDefault();
        if (lineText === matchedPrefix) {
          // Line is only the prefix — remove it (exit bullet mode)
          const next = value.slice(0, lineStart) + value.slice(lineStart + matchedPrefix.length);
          onChange(next);
          requestAnimationFrame(() => { ta.setSelectionRange(lineStart, lineStart); ta.focus(); });
        } else {
          // Insert newline + same prefix
          const insertion = '\n' + matchedPrefix;
          const next = value.slice(0, ss) + insertion + value.slice(ss);
          onChange(next);
          const cur = ss + insertion.length;
          requestAnimationFrame(() => { ta.setSelectionRange(cur, cur); ta.focus(); });
        }
        return;
      }
    }

    onKeyDown?.(e);
  }, [ref, onChange, onKeyDown]);

  return (
    <div className={`relative rounded border bg-white focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 border-gray-200 transition ${className ?? ''}`}>
      <textarea
        ref={ref}
        value={value}
        rows={1}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onBlur?.()}
        placeholder={placeholder}
        className="w-full resize-none overflow-hidden bg-transparent px-2.5 py-2 text-base focus:outline-none"
      />
    </div>
  );
}

// ─── Read-only view ────────────────────────────────────────────────────────────

interface ReadOnlyProps {
  section: SectionKey;
  items: string[];
  onCopy?: (item: string) => void;
}

export function SOFTISectionReadOnly({ section, items, onCopy }: ReadOnlyProps) {
  const meta = SECTION_META[section];
  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-4 mb-2`}>
      <div className={`flex items-center gap-2 mb-3 font-bold text-base ${meta.color}`}>
        <span className={`${meta.badge} text-white text-sm px-2 py-0.5 rounded-md font-black`}>{meta.letter}</span>
        {meta.label}
        <span className="ml-auto text-sm font-semibold text-gray-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic font-normal">No entries</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-base text-gray-700 group">
              <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${meta.badge}`} />
              <span className="flex-1 font-medium">
                <RenderText text={item} />
              </span>
              {onCopy && (
                <button
                  onClick={() => onCopy(item)}
                  className="opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-700 text-sm font-bold transition ml-1"
                  title="Copy to consolidated"
                >
                  + Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Editable section ─────────────────────────────────────────────────────────

interface EditableProps {
  section: SectionKey;
  items: string[];
  onChange: (items: string[]) => void;
  canReorder?: boolean;
}

export function SOFTISectionEditable({ section, items, onChange, canReorder = false }: EditableProps) {
  const meta = SECTION_META[section];
  const [draft, setDraft] = useState('');
  const addRef = useRef<HTMLTextAreaElement>(null);

  // Successes always shows the input; other sections toggle it via "+ Add"
  const alwaysOpen = section === 'successes';
  const [inputOpen, setInputOpen] = useState(alwaysOpen);

  function openInput() {
    setInputOpen(true);
    setTimeout(() => addRef.current?.focus(), 0);
  }

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (!alwaysOpen) setInputOpen(false); // hide if user blurred with nothing typed
      return;
    }
    onChange([...items, trimmed]);
    setDraft('');
    if (alwaysOpen) {
      setTimeout(() => addRef.current?.focus(), 0);
    } else {
      setInputOpen(false); // hide after adding in collapsible sections
    }
  }

  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...items]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; onChange(next);
  }

  function moveDown(i: number) {
    if (i === items.length - 1) return;
    const next = [...items]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; onChange(next);
  }

  function editItem(i: number, value: string) {
    const next = [...items]; next[i] = value; onChange(next);
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); }
  }

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-4 mb-3`}>
      {/* Header */}
      <div className={`flex items-center gap-2 mb-3 font-bold text-base ${meta.color}`}>
        <span className={`${meta.badge} text-white text-sm px-2 py-0.5 rounded-md font-black`}>{meta.letter}</span>
        {meta.label}
        <span className="ml-auto text-sm font-semibold text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Existing items */}
      <ul className="space-y-2 mb-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 group">
            {canReorder && (
              <div className="flex flex-col gap-0.5 mt-2">
                <button onClick={() => moveUp(i)}   disabled={i === 0}                 className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-sm leading-none" title="Move up">▲</button>
                <button onClick={() => moveDown(i)} disabled={i === items.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-sm leading-none" title="Move down">▼</button>
              </div>
            )}
            <span className={`mt-2.5 w-2 h-2 rounded-full flex-shrink-0 ${meta.badge}`} />
            <RichTextInput
              value={item}
              onChange={v => editItem(i, v)}
              className="flex-1"
            />
            <button
              onClick={() => remove(i)}
              className="text-red-400 hover:text-red-600 text-base font-bold px-1 mt-1.5 opacity-50 hover:opacity-100 transition"
              title="Remove"
            >×</button>
          </li>
        ))}
      </ul>

      {/* Add new item */}
      {inputOpen ? (
      <div className="flex gap-2 items-start">
        <span className={`mt-2.5 w-2 h-2 rounded-full flex-shrink-0 ${meta.badge} opacity-40`} />
        <RichTextInput
          value={draft}
          onChange={setDraft}
          onKeyDown={handleAddKeyDown}
          onBlur={add}
          textareaRef={addRef}
          className="flex-1"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className={`px-4 py-2 rounded-lg text-base font-semibold transition flex-shrink-0 ${
            draft.trim() ? `${meta.badge} text-white hover:opacity-90` : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          + Add
        </button>
      </div>
      ) : (
        <button
          onClick={openInput}
          className={`mt-1 px-3 py-1.5 rounded-lg text-sm font-semibold ${meta.badge} text-white hover:opacity-90 transition`}
        >
          + Add
        </button>
      )}
    </div>
  );
}
