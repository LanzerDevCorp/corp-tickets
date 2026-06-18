import { CheckCircle2Icon } from "lucide-react";

interface SubmitSuccessProps {
  ticketId: string;
}

export function SubmitSuccess({ ticketId }: SubmitSuccessProps) {
  const ref = ticketId.slice(0, 8).toUpperCase();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-border border-l-4 border-l-[#2563EB] shadow-sm px-8 py-12 text-center">
        <div className="flex justify-center mb-5">
          <div className="rounded-full bg-blue-50 p-4">
            <CheckCircle2Icon className="size-8 text-[#2563EB]" strokeWidth={1.5} />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-[#1C2438]">
          Ticket recibido
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          Recibimos tu solicitud. Te enviaremos un correo con el enlace para
          darle seguimiento.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-50 border border-border px-4 py-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Referencia
          </span>
          <code className="text-sm font-mono font-semibold text-[#1C2438]">
            #{ref}
          </code>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/70">
          ¿Tienes otro problema?{" "}
          <a
            href="/"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Enviar otro ticket
          </a>
        </p>
      </div>
    </div>
  );
}
