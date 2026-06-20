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
  ref?: string;
  email?: string;
};

export default async function TrackAccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <Card className="border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.sessionExpiredTitle")}</CardTitle>
        <CardDescription>{t("auth.sessionExpiredDescription")}</CardDescription>
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
