import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { FileText, Lock, Trash2, UploadCloud } from "lucide-react";
import { Button, Card, EmptyState, PageIntro, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { timeAgo } from "../lib/format";
import { useDocuments } from "../lib/queries";

function Uploader() {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append("file", file);
      return api("/knowledge/upload", { method: "POST", form });
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.error || "Upload failed");
        return;
      }
      toast.success(`${data.filename} added. The AI can use it now.`);
      if (data.redactions) toast.info(`${data.redactions} personal detail(s) were removed from the document for privacy.`);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.(pdf|txt|md)$/i.test(file.name)) {
      toast.error("Please choose a PDF or text file.");
      return;
    }
    upload.mutate(file);
  };

  return (
    <button
      type="button"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      disabled={upload.isPending}
      className={clsx(
        "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-brand bg-brand-soft/60" : "border-line-strong hover:border-brand/60 hover:bg-surface-2/50"
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-brand text-white">
        <UploadCloud className="size-6" />
      </div>
      <p className="mt-4 text-lg font-medium">{upload.isPending ? "Adding your document…" : "Click to upload a document"}</p>
      <p className="mt-1 text-sm text-muted">or drag and drop it here · PDF or text files up to 10 MB</p>
      <input ref={inputRef} type="file" accept=".pdf,.txt,.md" hidden onChange={(event) => handleFiles(event.target.files)} />
    </button>
  );
}

export default function HelpDocs() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const documents = useDocuments();

  const remove = useMutation({
    mutationFn: (filename) => api(`/knowledge/documents/${encodeURIComponent(filename)}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Document removed");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const docs = documents.data || [];

  return (
    <>
      <PageIntro>
        Upload your company's help pages, like refund, shipping or warranty policies. The AI reads them to answer customer questions correctly.
      </PageIntro>

      <div className="space-y-6">
        {isAdmin ? (
          <Uploader />
        ) : (
          <Card className="flex items-center gap-3 p-4 text-sm text-muted">
            <Lock className="size-4" /> Only admins can add or remove documents.
          </Card>
        )}

        <Card className="p-5 sm:p-6">
          <h3 className="font-semibold">Your documents</h3>
          <p className="text-sm text-muted">The AI uses these when answering questions.</p>

          <div className="mt-4 space-y-2">
            {documents.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
            {!documents.isLoading && docs.length === 0 && (
              <EmptyState icon={FileText} title="No documents yet" description="Upload your first help document above." className="py-8" />
            )}
            {docs.map((doc) => (
              <div key={doc.filename} className="flex items-center gap-4 rounded-xl border border-line p-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{doc.filename}</div>
                  <div className="text-sm text-muted">{doc.uploaded_at ? `Added ${timeAgo(doc.uploaded_at)}` : "Included sample document"}</div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => window.confirm(`Remove ${doc.filename}? The AI will stop using it.`) && remove.mutate(doc.filename)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
