import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { currentUser } from "@/lib/auth/session";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <div className="bg-canvas flex min-h-screen flex-col md:flex-row">
      <AppSidebar />
      <div className="bg-surface-1 flex min-w-0 flex-1 flex-col md:my-2 md:mr-2 md:rounded-xl md:border">
        {children}
      </div>
      {user && <FeedbackWidget />}
    </div>
  );
}
