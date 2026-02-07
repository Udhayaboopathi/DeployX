"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { registerUser, fetchPlatformStatus } from "@/lib/api";

type RegisterForm = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>();
  const pw = watch("password");

  useEffect(() => {
    fetchPlatformStatus()
      .then(({ data }) => setIsFirstUser(!data.has_admin))
      .catch(() => {});
  }, []);

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError("");
    try {
      await registerUser(data.username, data.email, data.password);
      router.push("/auth/login?registered=true");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100 px-4">
      <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            {isFirstUser ? "Welcome to DeployX" : "Create Account"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isFirstUser
              ? "Register the admin account to get started"
              : "Sign up for a new account"}
          </p>
        </div>

        {isFirstUser && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm text-blue-700 text-center">
              You are creating the <strong>admin</strong> account. This will
              have full platform access.
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
              {...register("username", {
                required: "Required",
                minLength: { value: 3, message: "Min 3 chars" },
              })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              Email
            </label>
            <input
              {...register("email", {
                required: "Required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Invalid email",
                },
              })}
              type="email"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              {...register("password", {
                required: "Required",
                minLength: { value: 8, message: "Min 8 chars" },
              })}
              type="password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              {...register("confirmPassword", {
                required: "Required",
                validate: (v) => v === pw || "Passwords don't match",
              })}
              type="password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50"
          >
            {loading
              ? "Creating…"
              : isFirstUser
                ? "Create Admin Account"
                : "Create Account"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
