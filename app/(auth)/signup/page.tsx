import { AuthForm } from "@/components/auth/AuthForm";

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  return <AuthForm mode="signup" searchParams={await searchParams} />;
}
