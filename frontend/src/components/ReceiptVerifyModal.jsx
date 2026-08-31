import React, { useState } from 'react';
import { verifyBallotReceipt } from '../services/api';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Vote,
  RefreshCw
} from 'lucide-react';

export default function ReceiptVerifyModal({ isOpen, onClose }) {
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!hash.trim()) return;

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res = await verifyBallotReceipt(hash.trim());
      setResult(res?.data);
    } catch (err) {
      setError(err.message || 'Invalid or non-existent ballot receipt hash.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Verify Ballot Inclusion</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-400">
            Enter your 64-character ballot confirmation receipt hash to independently verify that your vote was accepted and counted in the election ledger.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ballot Receipt Hash (SHA-256)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || hash.length < 32}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Ledger...
                </>
              ) : (
                <>
                  Verify Ballot Record <ShieldCheck className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Verification Results */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div>
              {result.valid ? (
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-sm text-emerald-300">Ballot Verified in Ledger</span>
                  </div>
                  <div className="space-y-1 pl-7 text-[11px] text-slate-300">
                    <p>Election: <strong className="text-white">{result.electionTitle}</strong></p>
                    <p>Recorded: {new Date(result.submittedAt).toLocaleString()}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-7 pt-1 border-t border-emerald-800/60">
                    Vote Privacy Enforced (§14): Your individual vote choices are not exposed by the verification ledger.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>No recorded ballot found matching this receipt hash.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
