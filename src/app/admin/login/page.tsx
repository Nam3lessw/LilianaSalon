"use client";
import { useState, useEffect, Suspense } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "unauthorized" || searchParams.get("unauthorized") === "true") {
      setError("Acceso Denegado: Tu cuenta no tiene permisos administrativos. Inicia sesión con una cuenta de administrador autorizada.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!auth) {
        throw new Error("El servicio de autenticación no está disponible.");
      }

      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);

      // Verify Firebase Auth Custom Claims directly on the cryptographically signed ID Token
      const tokenResult = await userCred.user.getIdTokenResult(true);
      const isAuthorized = Boolean(tokenResult.claims.admin);

      if (!isAuthorized) {
        await signOut(auth);
        throw new Error(
          "Esta cuenta no cuenta con permisos de administrador. El acceso a este panel está restringido exclusivamente al personal autorizado de Liliana Salon."
        );
      }

      router.push("/admin");
    } catch (err: any) {
      console.error("Admin login error:", err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Correo electrónico o contraseña incorrectos.");
      } else if (err.code === "auth/invalid-email") {
        setError("El formato de correo no es válido.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos fallidos. Por favor espera unos minutos antes de volver a intentar.");
      } else {
        setError(err.message || "Error al autenticar con el panel administrativo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6F2] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-stone-200">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-[#FAF3EC] text-[#C08261] rounded-full flex items-center justify-center mb-3">
            <Lock size={22} />
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-[#C08261] font-semibold">Liliana Salon</span>
          <h2 className="mt-2 text-3xl font-serif text-gray-900 tracking-wider">
            Acceso Administrativo
          </h2>
          <p className="mt-2 text-xs text-gray-500 uppercase tracking-widest">
            Gestión interna de catálogo, pedidos y recompensas
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="text-red-700 text-xs bg-red-50 border border-red-200 p-3.5 rounded-xl leading-relaxed flex items-start gap-2">
              <ShieldAlert size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Correo Electrónico
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="appearance-none rounded-xl relative block w-full px-3.5 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                placeholder="admin@lilianasalon.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="appearance-none rounded-xl relative block w-full px-3.5 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent text-xs tracking-widest uppercase font-semibold rounded-xl text-white bg-black hover:bg-stone-800 transition-colors disabled:opacity-50 shadow-xs"
            >
              {loading ? "Verificando Credenciales..." : "Iniciar Sesión"}
            </button>
          </div>

          <div className="text-center pt-3 border-t border-gray-100">
            <p className="text-[11px] text-stone-400 leading-normal">
              Acceso restringido únicamente para cuentas autorizadas con Custom Claims.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-stone-500">Cargando...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
