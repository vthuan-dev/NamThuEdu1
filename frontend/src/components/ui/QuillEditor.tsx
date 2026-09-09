import { forwardRef, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

export const DEFAULT_QUILL_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'link',
  'align',
  'blockquote',
  'code-block',
  'clean',
];

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  modules?: any;
  formats?: string[];
  theme?: string;
  className?: string;
  stripColorsOnPaste?: boolean;
}

/**
 * Wrapper component for ReactQuill
 * Note: findDOMNode warning is suppressed globally in App.tsx
 */
export const QuillEditor = forwardRef<ReactQuill, QuillEditorProps>(
  (
    {
      value,
      onChange,
      placeholder,
      modules,
      formats,
      theme = 'snow',
      className,
      stripColorsOnPaste = true,
    },
    ref
  ) => {
    const editorRef = useRef<ReactQuill | null>(null);

    useEffect(() => {
      if (!editorRef.current || !stripColorsOnPaste) return;
      try {
        const quill = editorRef.current.getEditor();
        if (quill && quill.clipboard) {
          quill.clipboard.addMatcher(Node.ELEMENT_NODE, (_node: HTMLElement, delta: any) => {
            if (delta && Array.isArray(delta.ops)) {
              delta.ops.forEach((op: any) => {
                if (op.attributes) {
                  delete op.attributes.color;
                  delete op.attributes.background;
                }
              });
            }
            return delta;
          });
        }
      } catch (err) {
        console.warn('Could not attach clipboard matcher to Quill:', err);
      }
    }, [stripColorsOnPaste]);

    return (
      <ReactQuill
        ref={(el) => {
          editorRef.current = el;
          if (typeof ref === 'function') {
            ref(el);
          } else if (ref) {
            ref.current = el;
          }
        }}
        value={value}
        onChange={onChange}
        theme={theme}
        placeholder={placeholder}
        modules={modules}
        formats={formats ?? DEFAULT_QUILL_FORMATS}
        className={className}
      />
    );
  }
);

QuillEditor.displayName = 'QuillEditor';
