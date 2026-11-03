import { AuthForm } from "@/components/auth/AuthForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  return <AuthForm mode="login" searchParams={await searchParams} />;
}
