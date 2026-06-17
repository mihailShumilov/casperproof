/**
 * A labelled JSON textarea with inline validation. Shows a parse error when the
 * current text is not valid JSON so the user can fix it before submitting.
 */
'use client';

import { useId } from 'react';
import { parseJson } from '@/lib/format';

export interface JsonFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function JsonField({ label, value, onChange, rows = 6 }: JsonFieldProps): JSX.Element {
  const id = useId();
  const parsed = parseJson(value);
  const invalid = !parsed.ok;
  const errorId = `${id}-error`;

  return (
    <div className={`field${invalid ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid && (
        <span id={errorId} className="field__error" role="alert">
          Invalid JSON: {parsed.error}
        </span>
      )}
    </div>
  );
}
