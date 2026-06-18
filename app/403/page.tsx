export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
      <a href="/" className="text-sm underline underline-offset-4">
        Go home
      </a>
    </div>
  );
}
