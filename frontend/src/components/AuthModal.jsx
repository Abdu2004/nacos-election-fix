import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { resendOtp, requestPasswordReset, resetPasswordWithOtp } from '../services/api';
import {
  X,
  Lock,
  Mail,
  User,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Clock,
  HelpCircle
} from 'lucide-react';

export default function AuthModal({ isOpen, onClose, initialTab = 'login', onSuccess }) {
  const { login, submitOtp, register } = useAuth();

  const [tab, setTab] = useState(initialTab); // 'login', 'register', 'otp', 'forgot'
  const [forgotStep, setForgotStep] = useState('request'); // 'request', 'reset'
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [otp, setOtp] = useState('');

  // Cooldown
  const [resendCooldown, setResendCooldown] = useState(0);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res?.data?.requiresOtp) {
        setError('');
        setTab('otp');
        setSuccessMsg(`OTP code has been sent to ${email}. Please check your Gmail.`);
        startCooldown(60);
      } else {
        setError('');
        setSuccessMsg('Logged in successfully! Welcome.');
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 500);
      }
    } catch (err) {
      setSuccessMsg('');
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedAdmission = admissionNumber.trim();
    const nacosRegex = /^\d{4}204\d{3}$/;
    if (!nacosRegex.test(trimmedAdmission)) {
      setError("Admission number must be exactly 10 digits with '204' as the 5th, 6th, and 7th digits (e.g. 2022204001).");
      return;
    }

    setLoading(true);

    try {
      await register({ fullName, admissionNumber: trimmedAdmission, email, password });
      setError('');
      setSuccessMsg('Registration successful! You can now log in using your registered Gmail.');
      setTab('login');
    } catch (err) {
      setSuccessMsg('');
      setError(err.message || 'Registration failed. Please check your submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await submitOtp(email, otp);
      setError('');
      setSuccessMsg('Authentication successful! Welcome.');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 600);
    } catch (err) {
      setSuccessMsg('');
      setError(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setForgotStep('reset');
      setSuccessMsg(`Password reset code sent to ${email}. Check your inbox.`);
      startCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to send password reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await resetPasswordWithOtp(email, otp, newPassword);
      setSuccessMsg('Password has been successfully updated! Please log in.');
      setTab('login');
      setForgotStep('request');
      setOtp('');
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check your OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');
    try {
      if (tab === 'forgot') {
        await requestPasswordReset(email);
      } else {
        await resendOtp(email);
      }
      setError('');
      setSuccessMsg('A new OTP has been dispatched to your Gmail.');
      startCooldown(60);
    } catch (err) {
      setSuccessMsg('');
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  const startCooldown = (seconds) => {
    setResendCooldown(seconds);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {tab === 'otp'
                ? 'Gmail OTP Verification'
                : tab === 'login'
                ? 'Student Sign In'
                : tab === 'forgot'
                ? 'Reset Your Password'
                : 'Voter Registration'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle (Login vs Register) */}
        {tab !== 'otp' && tab !== 'forgot' && (
          <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
            <button
              onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                tab === 'login'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                tab === 'register'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              New Voter Registration
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6">
          {/* Notification Banners */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Registered Gmail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="student@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setForgotStep('request'); setError(''); setSuccessMsg(''); }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 transition"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: FORGOT / RESET PASSWORD */}
          {tab === 'forgot' && (
            <div className="space-y-4">
              {forgotStep === 'request' ? (
                <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Enter your registered Gmail address. We will dispatch a 6-digit verification code to reset your password.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Registered Gmail</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="student@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={loading || !email}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Sending Code...
                        </>
                      ) : (
                        <>
                          Send Reset OTP Code
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); }}
                      className="w-full py-2 text-xs text-slate-400 hover:text-white transition"
                    >
                      ← Back to Login
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="text-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <p className="text-xs text-slate-400">Enter the 6-digit reset code sent to:</p>
                    <p className="text-sm font-semibold text-emerald-400 mt-0.5">{email}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                      6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      autoFocus
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.5em] font-mono text-2xl bg-slate-950 border border-slate-700 rounded-xl py-3 text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={loading || otp.length < 6 || newPassword.length < 6}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        <>
                          Update Password & Log In
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1">
                      <button
                        type="button"
                        onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); }}
                        className="hover:text-white transition"
                      >
                        ← Back to Login
                      </button>

                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0}
                        className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 font-medium transition flex items-center gap-1"
                      >
                        {resendCooldown > 0 ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Resend in {resendCooldown}s
                          </>
                        ) : (
                          'Resend Code'
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Student Admission Number</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. 2022204001"
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono tracking-wider"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Gmail Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="student@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Voter Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: OTP VERIFICATION */}
          {tab === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="text-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-xs text-slate-400">Enter the 6-digit verification code sent to:</p>
                <p className="text-sm font-semibold text-emerald-400 mt-0.5">{email}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl bg-slate-950 border border-slate-700 rounded-xl py-3 text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Verifying OTP...
                    </>
                  ) : (
                    <>
                      Verify & Log In
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1">
                  <button
                    type="button"
                    onClick={() => { setTab('login'); setOtp(''); }}
                    className="hover:text-white transition"
                  >
                    ← Back to Login
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 font-medium transition flex items-center gap-1"
                  >
                    {resendCooldown > 0 ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        Resend in {resendCooldown}s
                      </>
                    ) : (
                      'Resend Code'
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
