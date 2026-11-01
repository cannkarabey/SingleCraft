import { TopNav } from "@/components/shell/TopNav";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
