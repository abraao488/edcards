import Link from "next/link"
import { FileText, Trash2, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { UploadPdfDialog } from "@/components/upload-pdf-dialog"
import { deleteDocument } from "@/lib/materiais/actions"

export default async function MateriaisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const documents = await prisma.document.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Materiais</h1>
        <UploadPdfDialog />
      </div>

      {documents.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum material enviado. Envie seu primeiro PDF para começar.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="font-semibold text-foreground">{doc.title}</h3>
                    {doc.subject && (
                      <p className="text-xs text-muted-foreground">{doc.subject}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/materiais/${doc.id}`}
                  className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  <ExternalLink className="h-3 w-3" /> Visualizar
                </Link>
                <form action={deleteDocument.bind(null, doc.id)}>
                  <button
                    type="submit"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
