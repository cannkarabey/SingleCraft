import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { TopNav } from "@/components/shell/TopNav";
import { currentUser } from "@/lib/auth/session";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <>
      <TopNav />
      {children}
      {user && <FeedbackWidget />}
    </>
  );
}
