/** Re-mounted on every navigation inside the app, so each page eases in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in slide-in-from-bottom-1 flex flex-1 flex-col duration-300">
      {children}
    </div>
  );
}
