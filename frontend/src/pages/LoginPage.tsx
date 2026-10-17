import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const { devLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('oliver.brown@domain.io');
  const [password, setPassword] = useState('••••••••');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    // If backend Google OAuth is configured, redirect; otherwise quick login
    window.location.href = '/api/auth/google';
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use the email entered or default to Oliver Brown
      const loginEmail = email.trim() || 'oliver.brown@domain.io';
      const loginName = loginEmail.includes('oliver') ? 'Oliver Brown' : loginEmail.split('@')[0];
      await devLogin(loginEmail, loginName);
      navigate('/scheduled');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 font-sans select-none">
      <div className="w-full max-w-[420px] bg-white border border-gray-100/90 rounded-2xl p-8 sm:p-10 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        {/* Title */}
        <h1 className="text-[28px] font-bold text-center text-[#111827] mb-7 tracking-tight">
          Login
        </h1>

        {/* Login with Google Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-[#E6F4EA] hover:bg-[#DDF0E2] text-[#202124] font-medium text-sm transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span className="text-[13px] text-gray-700">Login with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <span className="relative bg-white px-3 text-[11px] text-gray-400 font-normal">
            or sign up through email
          </span>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailLogin} className="space-y-3.5">
          <div>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              className="w-full px-4 py-3 bg-[#F4F5F7] border border-transparent rounded-xl text-sm text-[#111827] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-200 transition-all"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-[#F4F5F7] border border-transparent rounded-xl text-sm text-[#111827] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-200 transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#00A854] hover:bg-[#00964B] active:bg-[#008542] text-white font-medium rounded-xl text-sm transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Login'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default LoginPage;
