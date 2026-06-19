import { redirect } from "next/navigation";

export default function TrackIndexPage() {
  redirect("/auth/error?error_code=otp_expired");
}
