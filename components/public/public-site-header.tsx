import Link from "next/link";

type Props = {
  rightLink: { href: string; label: string };
};

export function PublicSiteHeader({ rightLink }: Props) {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto max-w-2xl px-6 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1C2438] tracking-tight">
          Mesa de ayuda
        </span>
        <Link
          href={rightLink.href}
          className="text-sm text-[#1C2438] hover:underline underline-offset-4"
        >
          {rightLink.label}
        </Link>
      </div>
    </header>
  );
}
