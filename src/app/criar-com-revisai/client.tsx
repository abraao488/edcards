"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Paperclip, Send, Loader2, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/empty-state"
import {
  generateFlashcardsFromText,
  generateFlashcardsFromPDF,
  injectFlashcardsToDatabase,
} from "@/lib/ai/actions"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  type?: "text" | "processing" | "flashcards"
  flashcards?: { front: string; back: string }[]
}

const MAX_PDF_SIZE = 5 * 1024 * 1024

export function CriarComRevisaiClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPdfError(null)

    if (file.type !== "application/pdf") {
      setPdfError("Apenas arquivos PDF sao aceitos.")
      return
    }

    if (file.size > MAX_PDF_SIZE) {
      setPdfError("O PDF e muito grande. Tamanho maximo: 5 MB.")
      return
    }

    setAttachedFile(file)
  }

  const handleRemoveFile = () => {
    setAttachedFile(null)
    setPdfError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSendPDF = async () => {
    if (!attachedFile || isProcessing) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `PDF: ${attachedFile.name}`,
      type: "text",
    }

    setMessages((prev) => [...prev, userMessage])
    setAttachedFile(null)
    setIsProcessing(true)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    const processingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Revisei esta processando e lendo o PDF...",
      type: "processing",
    }

    setMessages((prev) => [...prev, processingMessage])

    try {
      const formData = new FormData()
      formData.append("pdf", attachedFile)
      const flashcards = await generateFlashcardsFromPDF(formData)

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === processingMessage.id
            ? {
                ...msg,
                content: `Aqui estao ${flashcards.length} flashcards gerados do PDF:`,
                type: "flashcards",
                flashcards,
              }
            : msg
        )
      )
    } catch (err) {
      console.error("Erro ao gerar flashcards do PDF:", err)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === processingMessage.id
            ? {
                ...msg,
                content:
                  err instanceof Error
                    ? err.message
                    : "Nao consegui gerar os flashcards do PDF. Tente novamente.",
                type: "text",
              }
            : msg
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendMessage = async () => {
    if (attachedFile) {
      return handleSendPDF()
    }

    if (!input.trim() || isProcessing) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      type: "text",
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsProcessing(true)

    const processingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Revisei esta processando e lendo o material...",
      type: "processing",
    }

    setMessages((prev) => [...prev, processingMessage])

    try {
      const flashcards = await generateFlashcardsFromText(userMessage.content)

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === processingMessage.id
            ? {
                ...msg,
                content: `Aqui estao ${flashcards.length} flashcards gerados automaticamente:`,
                type: "flashcards",
                flashcards,
              }
            : msg
        )
      )
    } catch (err) {
      console.error("Erro ao gerar flashcards:", err)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === processingMessage.id
            ? {
                ...msg,
                content:
                  "Nao consegui gerar os flashcards agora, tenta de novo. Se o problema persistir, o servico de IA pode estar indisponivel.",
                type: "text",
              }
            : msg
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleInjectCards = async (flashcards: { front: string; back: string }[]) => {
    await injectFlashcardsToDatabase(flashcards)
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "Flashcards injetados no seu banco de dados com sucesso!",
        type: "text",
      },
    ])
  }

  return (
    <>
      <div className="relative mb-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,212,255,0.12)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
              Gerador de flashcards
            </p>
            <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">
              Crie com Revisei
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Cole, digite ou anexe um PDF e a IA transforma em flashcards prontos para revisar.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <EmptyState
                icon={Sparkles}
                title="Seus flashcards comecam aqui"
                description="Cole, digite ou anexe um PDF no campo abaixo e envie para gerar seus primeiros flashcards."
              />
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="flex max-w-[85%] items-start gap-3">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-border bg-card p-4 shadow-sm">
                    <p className="text-foreground">{message.content}</p>
                    {message.type === "processing" && (
                      <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {message.type === "flashcards" && message.flashcards && (
                      <div className="mt-4 space-y-3">
                        {message.flashcards.map((card, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-border bg-secondary/40 p-4"
                          >
                            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary/80">
                              Card {String(index + 1).padStart(2, "0")}
                            </p>
                            <p className="mt-2 font-semibold tracking-tight text-foreground">
                              {card.front}
                            </p>
                            <div className="my-3 h-px bg-border/60" />
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {card.back}
                            </p>
                          </div>
                        ))}
                        <Button
                          className="w-full mt-4 h-10 font-semibold"
                          onClick={() => handleInjectCards(message.flashcards!)}
                        >
                          Injetar Cards no meu Banco
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="max-w-[80%] rounded-2xl rounded-br-md border border-primary/25 bg-primary/10 p-4"
                >
                  <p className="text-foreground">{message.content}</p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {pdfError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {pdfError}
          </div>
        )}

        {attachedFile && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-foreground">{attachedFile.name}</span>
            <span className="shrink-0 text-muted-foreground">
              ({(attachedFile.size / 1024).toFixed(0)} KB)
            </span>
            <button
              onClick={handleRemoveFile}
              className="ml-auto shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={isProcessing}
            title="Anexar PDF"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite seu texto aqui..."
            onKeyDown={(e) => e.key === "Enter" && !isProcessing && handleSendMessage()}
            disabled={isProcessing}
            className="h-11 flex-1 rounded-xl"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isProcessing || (!input.trim() && !attachedFile)}
            className="h-11 shrink-0 rounded-xl px-5 font-semibold"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </Button>
        </div>
      </div>
    </>
  )
}