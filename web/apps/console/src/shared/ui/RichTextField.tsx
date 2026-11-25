import { SegmentedControl, Text, Textarea } from '@mantine/core'
import { Link, RichTextEditor } from '@mantine/tiptap'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'
import './rich-text-field.css'

type Mode = 'visual' | 'html'

type RichTextFieldProps = {
  label: string
  value: string
  onChange: (html: string) => void
  error?: string
  hint?: string
  minRows?: number
}

// The visual editor knows these tags; anything else (tables, images, iframes…) would be dropped on the first edit,
// so such text opens in HTML mode instead.
const VISUAL_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'hr'])

export function hasOnlyVisualTags(html: string): boolean {
  for (const match of html.matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)) {
    if (!VISUAL_TAGS.has(match[1].toLowerCase())) return false
  }
  return true
}

/**
 * Text with formatting for the shop (product description, page text). The manager edits it like a document;
 * the HTML tab stays for content the visual editor cannot hold. The server sanitizes whatever is saved.
 */
export function RichTextField({ label, value, onChange, error, hint, minRows = 8 }: RichTextFieldProps) {
  const visualOk = hasOnlyVisualTags(value)
  const [mode, setMode] = useState<Mode>(visualOk ? 'visual' : 'html')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, code: false, codeBlock: false, link: false }),
      Link.configure({ openOnClick: false }),
    ],
    content: visualOk ? value : '',
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : current.getHTML()),
  })

  // Keep the editor in step when the value changes from outside (HTML tab, reset after save).
  useEffect(() => {
    if (!editor || mode !== 'visual') return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (current !== value) editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, mode, value])

  const canUseVisual = hasOnlyVisualTags(value)

  return (
    <div className="rich-text-field">
      <div className="rich-text-field__head">
        <Text component="span" size="sm" fw={500}>{label}</Text>
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(next) => setMode(next as Mode)}
          data={[
            { value: 'visual', label: 'Редактор', disabled: !canUseVisual },
            { value: 'html', label: 'HTML' },
          ]}
        />
      </div>
      {mode === 'visual' ? (
        <RichTextEditor editor={editor} className="rich-text-field__editor" aria-label={label}>
          <RichTextEditor.Toolbar sticky stickyOffset={0}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Underline />
              <RichTextEditor.ClearFormatting />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
              <RichTextEditor.Blockquote />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Undo />
              <RichTextEditor.Redo />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>
          <RichTextEditor.Content style={{ minHeight: `${minRows * 1.6}em` }} />
        </RichTextEditor>
      ) : (
        <Textarea
          aria-label={`${label}, HTML`}
          classNames={{ input: 'rich-text-field__code' }}
          autosize
          minRows={minRows}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
      {!canUseVisual ? (
        <Text size="xs" c="dimmed">У тексті є елементи, яких немає в редакторі (наприклад, таблиця), тому він відкритий як HTML.</Text>
      ) : hint ? (
        <Text size="xs" c="dimmed">{hint}</Text>
      ) : null}
      {error ? <Text size="xs" c="red">{error}</Text> : null}
    </div>
  )
}
