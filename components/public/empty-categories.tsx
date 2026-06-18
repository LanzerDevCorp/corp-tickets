import { AlertCircleIcon } from "lucide-react";

export function EmptyCategories() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-border border-l-4 border-l-[#1C2438] shadow-sm px-8 py-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-muted p-3">
            <AlertCircleIcon className="size-6 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-[#1C2438]">
          Servicio temporalmente no disponible
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          No hay categorías disponibles por el momento. El formulario estará
          listo en breve. Intenta más tarde.
        </p>
      </div>
    </div>
  );
}
