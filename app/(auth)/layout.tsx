import { Radio } from "lucide-react";
import Link from "next/link";

/** Sign-in pages: no navigation, just the logo over a centered card. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_65%)]"
      />
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-[15px] font-[590] tracking-tight"
      >
        <Radio aria-hidden className="text-brand size-5" />
        SignalCraft
      </Link>
      {children}
    </div>
  );
}
