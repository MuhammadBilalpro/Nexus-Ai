import { Logo } from "@/components/dashboard/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-[400px] animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo href="/login" />
        </div>
        {children}
        <p className="mt-6 text-center text-[11px] text-fg-subtle">Authorised personnel only. All access is logged.</p>
      </div>
    </main>
  );
}
