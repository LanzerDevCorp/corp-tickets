import { t } from "@/lib/i18n/t";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">{t("forbidden.title")}</h1>
      <p className="text-muted-foreground">{t("forbidden.message")}</p>
      <a href="/" className="text-sm underline underline-offset-4">
        {t("common.goHome")}
      </a>
    </div>
  );
}
