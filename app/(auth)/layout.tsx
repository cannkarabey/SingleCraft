import { MarketingNav } from "@/components/marketing/MarketingNav";

/** Sign-in pages keep the site navigation so there is always a way back. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_65%)]"
        />
        {children}
      </div>
    </>
  );
}
