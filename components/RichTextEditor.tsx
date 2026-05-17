import { useRef } from 'react';
import { Platform } from 'react-native';

// A lightweight rich-text editor for web (owner dashboard). Uses a
// contentEditable surface + document.execCommand. Uncontrolled: the surface
// is seeded once from initialHtml and reports changes via onChange.

const TOOLBAR_BTN: any = {
  minWidth: 32,
  height: 30,
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  background: '#fff',
  color: '#0F172A',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '0 8px',
};

export function RichTextEditor({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  if (Platform.OS !== 'web') return null;

  const report = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };
  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    report();
  };
  const keepFocus = (e: any) => e.preventDefault();

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: 6,
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          alignItems: 'center',
        }}
      >
        <button type="button" onMouseDown={keepFocus} onClick={() => exec('bold')} style={{ ...TOOLBAR_BTN, fontWeight: 800 }}>
          B
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={() => exec('italic')} style={{ ...TOOLBAR_BTN, fontStyle: 'italic' }}>
          I
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={() => exec('underline')} style={{ ...TOOLBAR_BTN, textDecoration: 'underline' }}>
          U
        </button>
        <select
          onMouseDown={keepFocus}
          onChange={(e) => {
            exec('fontSize', e.target.value);
            e.target.selectedIndex = 0;
          }}
          style={{ ...TOOLBAR_BTN, fontWeight: 600 }}
          defaultValue=""
        >
          <option value="" disabled>
            Size
          </option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="6">X-Large</option>
        </select>
        <select
          onMouseDown={keepFocus}
          onChange={(e) => {
            exec('formatBlock', e.target.value);
            e.target.selectedIndex = 0;
          }}
          style={{ ...TOOLBAR_BTN, fontWeight: 600 }}
          defaultValue=""
        >
          <option value="" disabled>
            Style
          </option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="p">Paragraph</option>
        </select>
        <label style={{ ...TOOLBAR_BTN, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12 }}>Color</span>
          <input
            type="color"
            onMouseDown={keepFocus}
            onChange={(e) => exec('foreColor', e.target.value)}
            style={{ width: 22, height: 20, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          />
        </label>
        <button type="button" onMouseDown={keepFocus} onClick={() => exec('justifyLeft')} style={TOOLBAR_BTN}>
          ⯇
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={() => exec('justifyCenter')} style={TOOLBAR_BTN}>
          ⯈⯇
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={() => exec('justifyRight')} style={TOOLBAR_BTN}>
          ⯈
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={() => exec('insertUnorderedList')} style={TOOLBAR_BTN}>
          • List
        </button>
      </div>
      <div
        ref={(el) => {
          if (el && ref.current !== el) {
            ref.current = el;
            el.innerHTML = initialHtml;
          }
        }}
        contentEditable
        suppressContentEditableWarning
        onInput={report}
        onBlur={report}
        style={{
          minHeight: 280,
          maxHeight: 520,
          overflowY: 'auto',
          padding: '14px 16px',
          fontSize: 15,
          lineHeight: 1.6,
          color: '#0F172A',
          outline: 'none',
          background: '#fff',
        }}
      />
    </div>
  );
}
