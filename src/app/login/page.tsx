import Brand from "@/components/brand";
import { APP_NAME } from "@/lib/brand";
import LoginForm from "./login-form";

export const metadata = { title: `Sign in · ${APP_NAME}` };

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <header className="px-4 py-3">
        <Brand />
      </header>
      <main className="mx-auto flex max-w-sm flex-col justify-center px-4 pb-10 pt-6">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mb-8 mt-1 text-sm text-stone-500">Your hostel mess, in one place.</p>
        <LoginForm />
      </main>
    </div>
  );
}
