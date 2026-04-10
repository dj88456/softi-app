import React, { useState, useRef, useEffect } from 'react';

export type SectionKey = 'successes' | 'opportunities' | 'failures' | 'threats' | 'issues';

const SECTION_META: Record<SectionKey, { label: string; letter: string; color: string; bg: string; border: string; badge: string }> = {
  successes:     { label: 'Successes',     letter: 'S', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-600' },
  opportunities: { label: 'Opportunities', letter: 'O', color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    badge: 'bg-blue-600'    },
  failures:      { label: 'Failures',      letter: 'F', color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-600'     },
  threats:       { label: 'Threats',       letter: 'T', color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  badge: 'bg-orange-600'  },
  issues:        { label: 'Issues',        letter: 'I', color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-500'   },
};

// Auto-growing textarea helper
function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  dataItem,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  dataItem?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      data-item={dataItem ? 'true' : undefined}
      className={`resize-none overflow-hidden ${className ?? ''}`}
    />
  );
}

// ─── Read-only view (member report in consolidation panel) ─────────────────────

interface ReadOnlyProps {
  section: SectionKey;
  items: string[];
  onCopy?: (item: string) => void;
}

export function SOFTISectionReadOnly({ section, items, onCopy }: ReadOnlyProps) {
  const meta = SECTION_META[section];
  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} p-3 mb-2`}>
      <div className={`flex items-center gap-2 mb-2 font-semibold text-sm ${meta.color}`}>
        <span className={`${meta.badge} text-white text-xs px-1.5 py-0.5 rounded font-bold`}>{meta.letter}</span>
        {meta.label}
        <span className="ml-auto text-xs font-normal text-gray-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No entries</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 group">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.badge}`} />
              <span className="flex-1 whitespace-pre-wrap">{item}</span>
              {onCopy && (
                <button
                  onClick={() => onCopy(item)}
                  className="opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-700 text-xs font-bold transition ml-1"
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
  const addInputRef = useRef<HTMLTextAreaElement>(null);

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft('');
    // refocus after add
    setTimeout(() => addInputRef.current?.focus(), 0);
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }

  function moveDown(i: number) {
    if (i === items.length - 1) return;
    const next = [...items];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  function editItem(i: number, value: string) {
    const next = [...items];
    next[i] = value;
    onChange(next);
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      add();
    }
    // Shift+Enter: default textarea behavior (newline)
  }

  function handleItemKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, i: number) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Insert a new empty item after this one
      const next = [...items];
      next.splice(i + 1, 0, '');
      onChange(next);
      // Focus new item — let React re-render first
      setTimeout(() => {
        const textareas = document.querySelectorAll<HTMLTextAreaElement>(
          `[data-section="${section}"] textarea[data-item]`
        );
        textareas[i + 1]?.focus();
      }, 0);
    }
  }

  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} p-3 mb-3`} data-section={section}>
      {/* Header */}
      <div className={`flex items-center gap-2 mb-3 font-semibold text-sm ${meta.color}`}>
        <span className={`${meta.badge} text-white text-xs px-1.5 py-0.5 rounded font-bold`}>{meta.letter}</span>
        {meta.label}
        <span className="ml-auto text-xs font-normal text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Items */}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-2">No entries yet. Add one below.</p>
      )}
      <ul className="space-y-1.5 mb-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 group">
            {canReorder && (
              <div className="flex flex-col gap-0.5 mt-1">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                  title="Move up"
                >▲</button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === items.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                  title="Move down"
                >▼</button>
              </div>
            )}
            <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.badge}`} />
            <AutoTextarea
              value={item}
              onChange={v => editItem(i, v)}
              onKeyDown={e => handleItemKeyDown(e, i)}
              dataItem={true}
              className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={() => remove(i)}
              className="text-red-400 hover:text-red-600 text-xs font-bold px-1 mt-1 opacity-60 hover:opacity-100 transition"
              title="Remove"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {/* Add new item */}
      <div className="flex gap-2 items-start">
        <AutoTextarea
          value={draft}
          onChange={setDraft}
          onKeyDown={handleAddKeyDown}
          placeholder={`Add ${meta.label.toLowerCase()}… (Enter to add, Shift+Enter for new line)`}
          className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition flex-shrink-0 ${
            draft.trim()
              ? `${meta.badge} text-white hover:opacity-90`
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          + Add
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">Enter 添加条目 · Shift+Enter 换行</p>
    </div>
  );
}
