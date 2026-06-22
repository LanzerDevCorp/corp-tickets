import type { AttachmentItem } from "@/app/actions/attachments";

interface AttachmentListProps {
  attachments: AttachmentItem[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentList({ attachments }: AttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1.5">
      {attachments.map((att) => (
        <li
          key={att.id}
          className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
              {att.filename}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(att.size_bytes)}
            </span>
          </div>
          <div className="ml-2 shrink-0">
            {att.expired ? (
              <span className="text-xs text-muted-foreground italic">File expired</span>
            ) : att.url ? (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.filename}
                className="text-xs font-medium text-[#1C2438] hover:underline dark:text-zinc-300"
              >
                Download
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
