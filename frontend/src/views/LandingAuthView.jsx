import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestOtp, requestPasswordReset, resetPasswordWithOtp } from '../services/api';
import {
  Vote,
  ShieldCheck,
  Megaphone,
  Lock,
  Mail,
  User,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  BookOpen
} from 'lucide-react';

export default function LandingAuthView({ onNavigateRules, onNavigateFeed }) {
  const { login, submitOtp, register } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'
  const [otpStep, setOtpStep] = useState('request'); // 'request' | 'verify'
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'reset'

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

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

  // --- Handlers ---
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await login(email.trim(), password);
      setSuccessMsg('Authentication successful! Loading dashboard...');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await requestOtp(email.trim());
      setOtpStep('verify');
      setSuccessMsg(`A 6-digit OTP code has been dispatched to ${email.trim()}.`);
      startCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to send OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await submitOtp(email.trim(), otp.trim());
      setSuccessMsg('Authentication successful! Welcome.');
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please try again.');
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

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      await register({
        fullName: fullName.trim(),
        admissionNumber: trimmedAdmission,
        email: email.trim().toLowerCase(),
        password
      });
      setSuccessMsg('Registration successful! You can now log in with your Gmail.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your submission.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestForgot = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await requestPasswordReset(email.trim());
      setForgotStep('reset');
      setSuccessMsg(`Password reset OTP has been sent to ${email.trim()}.`);
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
      await resetPasswordWithOtp(email.trim(), otp.trim(), newPassword);
      setSuccessMsg('Password has been successfully updated! You can now log in.');
      setMode('login');
      setForgotStep('request');
      setOtp('');
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check your OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email.trim());
      } else {
        await requestOtp(email.trim());
      }
      setSuccessMsg('A new OTP has been dispatched to your Gmail.');
      startCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-6 px-3 sm:px-6 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* ======================================================== */}
        {/* LEFT PANEL: Vibrant Green Brand & Feature Showcase      */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-950 p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          
          {/* Subtle Background Circuit Circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

          {/* Top Logo Duo & Title */}
          <div className="space-y-6 relative z-10">
            {/* Logos: FUBK & NACOS */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-xl flex items-center justify-center border-2 border-emerald-300/40">
                <img src="/fubk-logo.png" alt="FUBK Logo" className="w-full h-full object-contain" />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-xl flex items-center justify-center border-2 border-emerald-300/40">
                <img src="/nacos-logo.png" alt="NACOS Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                NACOS ELECTION MANAGEMENT SYSTEM
              </h2>
              <p className="text-xs sm:text-sm font-bold text-emerald-200 uppercase tracking-widest mt-1">
                FUBK CHAPTER
              </p>
              <p className="text-[11px] text-emerald-100/80 mt-1 font-medium">
                Department of Computer Science & Information Technology
              </p>
            </div>

            {/* Feature Badges matching the sample image */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/15">
                <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-300">
                  <Vote className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Cast Departmental Ballots</span>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/15">
                <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Digital & Physical Verification</span>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/15">
                <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-300">
                  <Megaphone className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Departmental Election Feeds & Trends</span>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/15">
                <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-300">
                  <Lock className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Secure Single-Use Gmail OTP</span>
              </div>
            </div>
          </div>

          {/* Bottom Footer Note */}
          <div className="pt-8 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-200 font-medium relative z-10">
            <span>🏛️ Federal University Birnin Kebbi, Kebbi State</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT PANEL: Auth Form (Sign In / Register / Reset)      */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-slate-900/95">
          <div>
            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    mode === 'login'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    mode === 'register'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {onNavigateRules && (
                <button
                  type="button"
                  onClick={onNavigateRules}
                  className="text-xs font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Election Rules
                </button>
              )}
            </div>

            {/* Header Titles */}
            <div className="mb-6">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {mode === 'login' && 'Sign In to Your Account'}
                {mode === 'register' && 'Create Voter Account'}
                {mode === 'forgot' && 'Reset Your Password'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'login' && 'Enter your student credentials to access your election dashboard.'}
                {mode === 'register' && 'Register to verify your student status and participate in NACOS elections.'}
                {mode === 'forgot' && 'Receive a secure 6-digit OTP via Gmail to reset your password.'}
              </p>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* ==================================================== */}
            {/* 1. SIGN IN FORM                                      */}
            {/* ==================================================== */}
            {mode === 'login' && (
              <div className="space-y-4">
                {/* Method Switch: Password vs OTP */}
                <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold text-center mb-2">
                  <button
                    type="button"
                    onClick={() => { setLoginMethod('password'); setError(''); }}
                    className={`py-1.5 rounded-lg transition ${
                      loginMethod === 'password' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Password Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginMethod('otp'); setError(''); }}
                    className={`py-1.5 rounded-lg transition ${
                      loginMethod === 'otp' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Gmail OTP Sign In
                  </button>
                </div>

                {loginMethod === 'password' ? (
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Registered Gmail</label>
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">Password</label>
                        <button
                          type="button"
                          onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition"
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

                    <button
                      type="submit"
                      disabled={loading || !email || !password}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Signing In...
                        </>
                      ) : (
                        <>
                          Sign In <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div>
                    {otpStep === 'request' ? (
                      <form onSubmit={handleRequestOtp} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Registered Gmail</label>
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

                        <button
                          type="submit"
                          disabled={loading || !email}
                          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send 6-Digit OTP'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Enter 6-Digit OTP</label>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                            <input
                              type="text"
                              required
                              maxLength={6}
                              placeholder="123456"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono tracking-widest text-center placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={() => setOtpStep('request')}
                            className="hover:text-white transition"
                          >
                            ← Change Email
                          </button>
                          <button
                            type="button"
                            onClick={handleResend}
                            disabled={resendCooldown > 0}
                            className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 font-medium transition flex items-center gap-1"
                          >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={loading || otp.length < 6}
                          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify & Log In'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ==================================================== */}
            {/* 2. REGISTER FORM                                     */}
            {/* ==================================================== */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Abubakar Othman"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Registered Gmail Address</label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !fullName || !admissionNumber || !email || password.length < 8}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Creating Account...
                    </>
                  ) : (
                    <>
                      Create Voter Account <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ==================================================== */}
            {/* 3. FORGOT PASSWORD FORM                              */}
            {/* ==================================================== */}
            {mode === 'forgot' && (
              <div>
                {forgotStep === 'request' ? (
                  <form onSubmit={handleRequestForgot} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Registered Gmail</label>
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

                    <button
                      type="submit"
                      disabled={loading || !email}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Reset Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">6-Digit Reset Code</label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="123456"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono tracking-widest text-center placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          type="password"
                          required
                          minLength={8}
                          placeholder="At least 8 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => setForgotStep('request')}
                        className="hover:text-white transition"
                      >
                        ← Resend Code
                      </button>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0}
                        className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 font-medium transition flex items-center gap-1"
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length < 6 || newPassword.length < 8}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Update Password & Log In'}
                    </button>
                  </form>
                )}

                <div className="pt-3 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                    className="text-xs text-slate-400 hover:text-white transition"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Switcher */}
          <div className="pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                  className="font-bold text-emerald-400 hover:text-emerald-300 transition"
                >
                  Create Voter Account
                </button>
              </p>
            ) : mode === 'register' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                  className="font-bold text-emerald-400 hover:text-emerald-300 transition"
                >
                  Sign In here
                </button>
              </p>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  );
}
