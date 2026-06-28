import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrackAccessPanel } from "@/components/tracking/track-access-panel";
import { t } from "@/lib/i18n/t";

type SearchParams = {
  error_code?: string;
  ref?: string;
  email?: string;
};

function resolveTitle(errorCode: string | undefined): string {
  if (errorCode === "session_expired") return t("auth.sessionExpiredTitle");
  if (errorCode === "otp_expired") return t("tracking.otpExpiredTitle");
  return t("tracking.accessTitle");
}

function resolveDescription(errorCode: string | undefined): string {
  if (errorCode === "session_expired")
    return t("auth.sessionExpiredDescription");
  if (errorCode === "otp_expired") return t("tracking.otpExpiredDescription");
  return t("tracking.accessDescription");
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
