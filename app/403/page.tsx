export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">{"403"}</h1>
      <p className="text-muted-foreground">
        {"No tienes permiso para acceder a esta página."}
      </p>
      <a href="/" className="text-sm underline underline-offset-4">
        {"Ir al inicio"}
      </a>
    </div>
  );
}
