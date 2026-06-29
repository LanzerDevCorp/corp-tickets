import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

type SearchParams = {
  error?: string;
  error_code?: string;
  ref?: string;
  email?: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const errorCode = params?.error_code;

  if (errorCode === "otp_expired" || errorCode === "session_expired") {
    const query = new URLSearchParams({ error_code: errorCode });
    if (params.ref) query.set("ref", params.ref);
    if (params.email) query.set("email", params.email);
    redirect(`/track/access?${query.toString()}`);
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {"Lo sentimos, algo salió mal."}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {params?.error ? (
                <p className="text-sm text-muted-foreground">{params.error}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {"Ocurrió un error no especificado."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
