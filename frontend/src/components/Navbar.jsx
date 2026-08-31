import React from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import {
  Vote,
  ShieldCheck,
  Award,
  BarChart3,
  FileCheck,
  Megaphone,
  UserCheck,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  BookOpen
} from 'lucide-react';

export default function Navbar({ currentView, setView, onOpenAuth, onOpenReceiptVerify }) {
  const { user, isAuthenticated, role, isVerified, verificationStatus, logout } = useAuth();

  const getVerificationBadge = () => {
    if (!isAuthenticated) return null;
    if (isVerified) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
          <CheckCircle2 className="w-3 h-3" />
          Verified Voter
        </span>
      );
    }
    if (verificationStatus === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-700/60">
          <Clock className="w-3 h-3" />
          Verification Pending
        </span>
      );
    }
    if (verificationStatus === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-700/60">
          <XCircle className="w-3 h-3" />
          Verification Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        Unverified
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 lg:px-8 py-3.5 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div
          onClick={() => setView('feed')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 rounded-full p-0.5 bg-white border border-emerald-600/40 shadow-lg shadow-emerald-600/20 group-hover:scale-105 transition transform flex items-center justify-center overflow-hidden">
              <img src="/fubk-logo.png" alt="FUBK" className="w-full h-full object-contain" />
            </div>
            <div className="w-10 h-10 rounded-full p-0.5 bg-white border border-emerald-600/40 shadow-lg shadow-emerald-600/20 group-hover:scale-105 transition transform flex items-center justify-center overflow-hidden">
              <img src="/nacos-logo.png" alt="NACOS" className="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-emerald-400 transition">
                NACOS ELECTION MANAGEMENT SYSTEM
              </h1>
            </div>
            <p className="text-xs font-bold text-emerald-400 tracking-wider">FUBK CHAPTER</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
          <button
            onClick={() => setView('feed')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentView === 'feed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Feed & Trends
          </button>

          <button
            onClick={() => setView('elections')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentView === 'elections'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Vote className="w-4 h-4" />
            Elections
          </button>

          <button
            onClick={() => setView('results')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentView === 'results'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Results
          </button>

          <button
            onClick={() => setView('rules')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              currentView === 'rules'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Election Rules
          </button>

          <button
            onClick={onOpenReceiptVerify}
            className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <Search className="w-4 h-4" />
            Verify Receipt
          </button>

          {/* Role-Specific Navigation */}
          {isAuthenticated && (
            <>
              {role === 'VOTER' && (
                <>
                  <button
                    onClick={() => setView('verification')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      currentView === 'verification'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                    Voter Verification
                  </button>
                  <button
                    onClick={() => setView('candidate-apply')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      currentView === 'candidate-apply'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    Contest Election
                  </button>
                </>
              )}

              {role === 'CANDIDATE' && (
                <button
                  onClick={() => setView('candidate-portal')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    currentView === 'candidate-portal'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-purple-300 hover:bg-purple-950/60 hover:text-white'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  Candidate Profile
                </button>
              )}

              {role === 'VALIDATOR' && (
                <button
                  onClick={() => setView('validator')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    currentView === 'validator'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-blue-300 hover:bg-blue-950/60 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  Validator Desk
                </button>
              )}

              {role === 'ADMINISTRATOR' && (
                <button
                  onClick={() => setView('admin')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    currentView === 'admin'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-amber-300 hover:bg-amber-950/60 hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Admin Console
                </button>
              )}
            </>
          )}
        </nav>

        {/* User Auth Info & Actions */}
        <div className="flex items-center gap-2.5">
          {isAuthenticated && (
            <NotificationBell onNavigate={(view) => setView(view)} />
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight">{user.full_name || user.fullName}</p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                    {role}
                  </span>
                  {getVerificationBadge()}
                </div>
              </div>

              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5 border border-slate-700"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
