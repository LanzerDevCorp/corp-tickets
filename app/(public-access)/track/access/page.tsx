import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrackAccessPanel } from "@/components/tracking/track-access-panel";

type SearchParams = {
  error_code?: string;
  ref?: string;
  email?: string;
};

function resolveTitle(errorCode: string | undefined): string {
  if (errorCode === "session_expired") return "Continuar seguimiento";
  if (errorCode === "otp_expired") return "Enlace expirado";
  return "Consultar tu ticket";
}

function resolveDescription(errorCode: string | undefined): string {
  if (errorCode === "session_expired")
    return "Tu sesión expiró. Ingresa tu correo y el número de ticket que recibiste al enviar la solicitud.";
  if (errorCode === "otp_expired")
    return "Tu enlace de acceso expiró. Ingresa tu correo y número de ticket para continuar, o solicita un nuevo enlace.";
  return "Ingresa el correo y el número de ticket que recibiste al enviar la solicitud.";
}

export default async function TrackAccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const errorCode = params.error_code;

  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{resolveTitle(errorCode)}</CardTitle>
        <CardDescription>{resolveDescription(errorCode)}</CardDescription>
      </CardHeader>
      <CardContent>
        <TrackAccessPanel
          defaultEmail={params.email ?? ""}
          defaultTicketRef={params.ref ?? ""}
        />
      </CardContent>
    </Card>
  );
}
