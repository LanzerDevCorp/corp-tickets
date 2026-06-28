import Link from "next/link";

type Props = {
  rightLink: { href: string; label: string };
};

export function PublicSiteHeader({ rightLink }: Props) {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
        <span className="text-sm font-semibold tracking-tight text-[#1C2438]">
          Mesa de ayuda
        </span>
        <Link
          href={rightLink.href}
          className="text-sm text-[#1C2438] underline-offset-4 hover:underline"
        >
          {rightLink.label}
        </Link>
      </div>
    </header>
  );
}
