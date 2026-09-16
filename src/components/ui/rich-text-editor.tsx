"use client"

import { useEffect, useRef, useCallback } from "react"
import { Bold, Italic, Underline } from "lucide-react"
import { ALLOWED_COLORS, sanitizeHtml } from "@/lib/sanitize"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  minHeight?: string
}

const COLOR_OPTIONS: { label: string; value: string; color: string }[] = [
  { label: "Preto", value: ALLOWED_COLORS.preto, color: ALLOWED_COLORS.preto },
  { label: "Vermelho", value: ALLOWED_COLORS.vermelho, color: ALLOWED_COLORS.vermelho },
  { label: "Azul", value: ALLOWED_COLORS.azul, color: ALLOWED_COLORS.azul },
  { label: "Verde", value: ALLOWED_COLORS.verde, color: ALLOWED_COLORS.verde },
  { label: "Amarelo", value: ALLOWED_COLORS.amarelo, color: ALLOWED_COLORS.amarelo },
]

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  minHeight = "140px",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)

  // Sincroniza value externo para o DOM quando não está focado (evita pular cursor)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (document.activeElement === el) return
    const currentHtml = el.innerHTML
    // Normaliza comparação para evitar loop
    if (sanitizeHtml(value) !== sanitizeHtml(currentHtml) && value !== currentHtml) {
      el.innerHTML = value || ""
    }
    if (!value && el.innerHTML === "") {
      // mantém vazio
    }
  }, [value])

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return
    const el = editorRef.current
    if (!el) return
    onChange(el.innerHTML)
  }, [onChange])

  const exec = useCallback((command: string, val?: string) => {
    if (disabled) return
    // Garante que styleWithCSS esteja ativo para foreColor gerar span style
    try {
      document.execCommand("styleWithCSS", false, "true")
    } catch {}
    document.execCommand(command, false, val)
    // Força atualização
    handleInput()
    editorRef.current?.focus()
  }, [disabled, handleInput])

  const isActive = useCallback((command: string) => {
    try {
      return document.queryCommandState(command)
    } catch {
      return false
    }
  }, [])

  // Atalho para re-renderizar estado ativo após seleção mudar
  // Simples: não guarda estado reativo, apenas checa no render do toolbar via queryCommandState pode ficar stale.
  // Mantemos simples sem highlight reativo para evitar complexidade.

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-secondary/35 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-secondary/40 p-2">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("bold")
          }}
          aria-label="Negrito"
          title="Negrito (Ctrl+B)"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent hover:bg-secondary hover:border-border text-foreground transition-colors data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
          data-active={isActive("bold")}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("italic")
          }}
          aria-label="Itálico"
          title="Itálico (Ctrl+I)"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent hover:bg-secondary hover:border-border text-foreground transition-colors"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("underline")
          }}
          aria-label="Sublinhado"
          title="Sublinhado (Ctrl+U)"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent hover:bg-secondary hover:border-border text-foreground transition-colors"
        >
          <Underline className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Cor:</span>
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                exec("foreColor", opt.value)
              }}
              title={opt.label}
              aria-label={`Cor ${opt.label}`}
              className="h-6 w-6 rounded-full border-2 border-border shadow-sm hover:scale-110 transition-transform ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary"
              style={{ backgroundColor: opt.color, borderColor: opt.color === "#000000" ? "hsl(var(--border))" : opt.color }}
            />
          ))}
          {/* Botão remover cor */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              exec("removeFormat")
              // removeFormat também remove bold/italic, então reaplicar? Mantém simples.
            }}
            title="Remover formatação"
            className="ml-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Editable area */}
      <div
        id={id}
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onCompositionStart={() => { isComposingRef.current = true }}
        onCompositionEnd={() => { isComposingRef.current = false; handleInput() }}
        onKeyDown={() => {
          // Permitir que Shift+Enter insira quebra natural (contentEditable já faz)
          // Não interceptar aqui para cadastro; Enter simples também quebra linha
        }}
        className={cn(
          "w-full px-4 py-3 text-base text-foreground outline-none overflow-auto max-h-[300px]",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
          "[&>div]:min-h-[1em]"
        )}
        style={{ minHeight }}
        // initial content via effect; não usar dangerouslySetInnerHTML aqui para não conflitar com contentEditable
      />
    </div>
  )
}
