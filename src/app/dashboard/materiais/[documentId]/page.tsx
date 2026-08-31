import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export default async function DocumentViewerPage({
  params,
}: {
  params: { documentId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const doc = await prisma.document.findUnique({
    where: { id: params.documentId },
  })

  if (!doc || doc.userId !== user.id) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Documento não encontrado.</p>
      </div>
    )
  }

  const { data } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.fileUrl, 3600)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/dashboard/materiais"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="text-right">
          <h1 className="text-lg font-semibold text-foreground">{doc.title}</h1>
          {doc.subject && (
            <p className="text-sm text-muted-foreground">{doc.subject}</p>
          )}
        </div>
      </div>

      {data?.signedUrl ? (
        <iframe
          src={data.signedUrl}
          className="flex-1 rounded-xl border border-border"
          title={doc.title}
        />
      ) : (
        <p className="py-10 text-center text-muted-foreground">
          Erro ao carregar o documento.
        </p>
      )}
    </div>
  )
}
