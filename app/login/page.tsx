import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return <LoginForm linkProblem={reset === "failed"} />;
}
