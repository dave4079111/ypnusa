import Link from "next/link";
import { marketingUrl } from "@/lib/site";

export const metadata = {
  title: "Sign-in issue",
  robots: { index: false, follow: false },
};

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09081b] px-5 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
          Secure sign-in
        </p>
        <h1 className="mt-3 text-3xl font-semibold">That sign-in link could not be used.</h1>
        <p className="mt-4 text-sm leading-6 text-white/55">
          The link may have expired or already been exchanged. Start again from YPN USA to create
          a fresh, one-time sign-in.
        </p>
        <a
          href={marketingUrl("/wp-admin/admin-post.php?action=ypnus_app_sso")}
          className="mt-6 inline-flex rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-[#09081b]"
        >
          Return to secure sign-in
        </a>
        <div className="mt-4">
          <Link href="/" className="text-sm font-semibold text-violet-300 hover:text-white">
            Back to YPN USA App
          </Link>
        </div>
      </div>
    </main>
  );
}
