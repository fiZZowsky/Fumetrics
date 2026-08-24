import { useState } from 'react';
import { Activity, Lock, User, AlertCircle, Loader2, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (isRegistering && password !== confirmPassword) {
      setError('Wpisane hasła nie identyczne.');
      return;
    }

    setIsLoading(true);
    const endpoint = isRegistering ? 'register' : 'login';

    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Wystąpił błąd podczas autoryzacji');
      }

      if (isRegistering) {
        setSuccessMessage('Konto zostało utworzone! Możesz się teraz zalogować.');
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        onLoginSuccess(data.token);
      }
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd połączenia');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B101E] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-6">
          <div className="bg-linear-to-br from-cyan-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-cyan-500/30 mb-4">
            <Activity className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            FUMETRICS
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-2">
            {isRegistering ? 'Załóż nowe konto w systemie' : 'Zaloguj się do panelu administratora'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-5 flex items-center gap-2 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl mb-5 text-sm font-bold text-center">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Użytkownik</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 transition-colors shadow-sm"
                placeholder="Wpisz login..."
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Hasło</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-12 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 transition-colors shadow-sm"
                placeholder="Wpisz hasło..."
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Powtórz hasło</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-12 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500 transition-colors shadow-sm"
                  placeholder="Powtórz hasło..."
                  required={isRegistering}
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-900/20 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRegistering ? (
              <>
                <UserPlus className="w-5 h-5" /> Zarejestruj się
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> Zaloguj się
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMessage(''); setPassword(''); setConfirmPassword(''); }}
            className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            {isRegistering ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
          </button>
        </div>

      </div>
    </div>
  );
}