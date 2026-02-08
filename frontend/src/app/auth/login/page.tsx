"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useAuthStore } from "@/lib/store";
import { loginUser, fetchMe } from "@/lib/api";

type LoginForm = { username: string; password: string };

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const justRegistered = params.get("registered") === "true";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");
    try {
      const { data: tokenData } = await loginUser(data.username, data.password);
      const { data: me } = await fetchMe(tokenData.access_token);
      setAuth(tokenData.access_token, me.username, me.is_superuser);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100 px-4">
      <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">DeployX</h2>
          <p className="mt-1 text-sm text-gray-500">Sign in to your platform</p>
        </div>

        {justRegistered && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
            <p className="text-sm text-green-700">
              Account created! Please sign in.
            </p>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              {...register("username", { required: "Username is required" })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="admin"
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-600">
                {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              {...register("password", { required: "Password is required" })}
              type="password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-sm text-gray-500">
            No account yet?{" "}
            <Link
              href="/auth/register"
              className="text-blue-600 hover:underline font-medium"
            >
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
