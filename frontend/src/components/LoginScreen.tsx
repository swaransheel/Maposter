import { useAuth } from '../contexts/AuthContext'

export default function LoginScreen() {
  const { signInAnonymously, loading } = useAuth()

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">MAPOSTER</h1>
        <p className="text-slate-600 mt-2">Continue as guest to access your personal gallery and journal.</p>

        <button
          onClick={() => void signInAnonymously()}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Continue as Guest
        </button>
      </section>
    </main>
  )
}
