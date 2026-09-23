"use client";
import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!auth) {
        // Fallback para pruebas sin Firebase
        if (email === "admin@lilianasalon.com" && password === "admin123") {
           sessionStorage.setItem("mockAuth", "true");
           router.push("/admin");
           return;
        } else {
           throw new Error("Modo local: Usa admin@lilianasalon.com con contraseña admin123");
        }
      }

      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (db) {
          await setDoc(doc(db, "users", userCred.user.uid), {
            uid: userCred.user.uid,
            name: "Liliana (Admin)",
            email: email.trim(),
            role: "admin",
            points: 0,
            createdAt: serverTimestamp()
          });
        }
        localStorage.setItem("admin_session", "true");
        setSuccess("¡Cuenta creada exitosamente! Redirigiendo al panel...");
        setTimeout(() => {
          router.push("/admin");
        }, 800);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem("admin_session", "true");
        router.push("/admin");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Correo o contraseña incorrectos. Si es tu primera vez, haz clic abajo en 'Registrar primer administrador'.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este correo ya está registrado. Por favor, selecciona 'Iniciar Sesión'.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else if (err.code === "auth/invalid-email") {
        setError("El formato de correo no es válido.");
      } else {
        setError(err.message || "Error al autenticar. Revisa que 'Email/Password' esté activado en Authentication de Firebase.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6F2] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-stone-200">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-[#C08261] font-semibold">Liliana Salon</span>
          <h2 className="mt-2 text-3xl font-serif text-gray-900 tracking-wider">
            {isRegistering ? "Crear Administrador" : "Acceso Administrativo"}
          </h2>
          <p className="mt-2 text-xs text-gray-500 uppercase tracking-widest">
            {isRegistering ? "Registra la cuenta oficial del salón" : "Inicia sesión para gestionar productos"}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="text-red-700 text-xs bg-red-50 border border-red-200 p-3 rounded-lg leading-relaxed">
              {error}
            </div>
          )}
          {success && (
            <div className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 p-3 rounded-lg leading-relaxed">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
                Correo Electrónico
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                placeholder="ejemplo@lilianasalon.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-xs tracking-widest uppercase font-semibold rounded-lg text-white bg-black hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Procesando..." : isRegistering ? "Crear Administrador" : "Iniciar Sesión"}
            </button>
          </div>

          <div className="text-center pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
                setSuccess("");
              }}
              className="text-xs text-stone-600 hover:text-black underline transition-colors"
            >
              {isRegistering
                ? "¿Ya tienes cuenta? Iniciar Sesión"
                : "¿Primera vez? Registrar primer administrador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
