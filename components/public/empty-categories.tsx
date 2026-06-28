import { AlertCircleIcon } from "lucide-react";

export function EmptyCategories() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-xl border border-l-4 border-border border-l-[#1C2438] bg-white px-8 py-12 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-muted p-3">
            <AlertCircleIcon className="size-6 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-[#1C2438]">
          Servicio temporalmente no disponible
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          No hay categorías disponibles por el momento. El formulario estará
          listo en breve. Intenta más tarde.
        </p>
      </div>
    </div>
  );
}
