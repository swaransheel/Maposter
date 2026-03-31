import Editor from './components/Editor'
import LoginScreen from './components/LoginScreen'
import { useAuth } from './contexts/AuthContext'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <main className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-700">Loading...</main>
  }

  if (!user) {
    return <LoginScreen />
  }

  return <Editor />
}