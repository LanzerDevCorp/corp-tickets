import { Lock, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type CommentWithAuthor } from "@/app/actions/comments";
import { formatDateTime } from "@/lib/format-date";

type CommentThreadProps = {
  comments: CommentWithAuthor[];
};

export default function CommentThread({ comments }: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-zinc-400">
        <MessageSquare className="h-8 w-8 opacity-40" />
        <p className="text-sm">{"Aún no hay comentarios"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} />
      ))}
    </div>
  );
}

function CommentCard({ comment }: { comment: CommentWithAuthor }) {
  const authorName =
    comment.author?.display_name ?? comment.author?.email ?? "Desconocido";
  const timestamp = formatDateTime(comment.created_at);

  if (comment.is_internal) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {authorName}
            </span>
            <Badge
              variant="outline"
              className="flex items-center gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400"
            >
              <Lock className="h-3 w-3" />
              {"Interno"}
            </Badge>
          </div>
          <time className="shrink-0 text-xs text-zinc-400">{timestamp}</time>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
          {comment.body}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {authorName}
        </span>
        <time className="shrink-0 text-xs text-zinc-400">{timestamp}</time>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
        {comment.body}
      </p>
    </div>
  );
}
