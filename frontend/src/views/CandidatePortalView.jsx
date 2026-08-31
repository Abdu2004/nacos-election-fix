import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { listElections, getElectionDetails, applyForCandidacy, getMyCandidateApplication, pingVerification } from '../services/api';
import {
  Award,
  KeyRound,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  User,
  Clock,
  XCircle,
  RefreshCw,
  DollarSign
} from 'lucide-react';

export default function CandidatePortalView({ onGoToVerification }) {
  const { user, isVerified, refreshUser } = useAuth();
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [electionPositions, setElectionPositions] = useState([]);
  const [myApplication, setMyApplication] = useState(null);

  // Form State
  const [candidateCode, setCandidateCode] = useState('');
  const [positionId, setPositionId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [credentialsFile, setCredentialsFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadElections() {
      setFetching(true);
      try {
        const res = await listElections();
        const items = res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
        const activeElections = items.filter((e) => ['UPCOMING', 'OPEN'].includes(e.status)) || [];
        setElections(activeElections);
        if (activeElections.length > 0) {
          setSelectedElectionId(activeElections[0].id);
        }
      } catch (err) {
        console.error('Failed to load elections:', err);
      } finally {
        setFetching(false);
      }
    }
    loadElections();
  }, []);

  useEffect(() => {
    if (!selectedElectionId) return;

    async function loadDetailsAndApp() {
      try {
        const detailsRes = await getElectionDetails(selectedElectionId);
        setElectionPositions(detailsRes?.data?.election?.positions || []);

        const myAppRes = await getMyCandidateApplication(selectedElectionId);
        setMyApplication(myAppRes?.data?.application || null);
      } catch (err) {
        setMyApplication(null);
      }
    }
    loadDetailsAndApp();
  }, [selectedElectionId]);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!isVerified) {
      setError('You must complete voter verification before applying for candidacy (Rule 4).');
      return;
    }

    if (!photoFile) {
      setError('A candidate photograph is required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const cleanCandidateCode = candidateCode.trim().toUpperCase().replace(/\s+/g, '-');
      const formData = new FormData();
      formData.append('electionId', selectedElectionId);
      formData.append('positionId', positionId);
      formData.append('candidateCode', cleanCandidateCode);
      formData.append('externalPaymentReference', paymentReference.trim());
      formData.append('paymentReference', paymentReference.trim());
      formData.append('manifesto', manifesto.trim());
      formData.append('photo', photoFile);
      if (credentialsFile) {
        formData.append('credentials', credentialsFile);
      }

      await applyForCandidacy(formData);
      setSuccess('Candidate application submitted successfully! It is now pending Validator review.');
      await refreshUser();

      const myAppRes = await getMyCandidateApplication(selectedElectionId);
      setMyApplication(myAppRes?.data?.application || null);
    } catch (err) {
      setError(err.message || 'Failed to submit candidate application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Candidate Application & Registration</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Rule 2: One candidate, one position. Rule 4: Candidate code & external payment required.
            </p>
          </div>
        </div>
      </div>

      {/* Verification Guard Warning */}
      {!isVerified && (
        <div className="p-5 rounded-2xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Voter Verification Required</p>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Before applying as a candidate, you must complete the identity verification process with an approved student ID.
              </p>
            </div>
          </div>
          <button
            onClick={onGoToVerification}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 transition"
          >
            Verify Now
          </button>
        </div>
      )}

      {/* Target Election Selector */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-lg">
        <label className="block text-xs font-semibold text-slate-300 mb-2">Select Election to Contest</label>
        <select
          value={selectedElectionId}
          onChange={(e) => setSelectedElectionId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition"
        >
          {elections.map((elec) => (
            <option key={elec.id} value={elec.id}>
              {elec.title} ({elec.status})
            </option>
          ))}
        </select>
      </div>

      {/* Existing Application Status Card (If Applied) */}
      {myApplication && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-lg space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            Your Candidate Application Status
          </h3>

          {myApplication.status === 'APPROVED' ? (
            <div className="p-5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-base font-bold text-emerald-300">Application Approved — Official Candidate</h4>
                <p className="text-xs text-slate-300 mt-1">
                  You are officially contesting for the position of <strong>{myApplication.position_name}</strong>. Your profile and photo will appear on the official ballot and candidate rosters.
                </p>
              </div>
            </div>
          ) : myApplication.status === 'PENDING' ? (
            <div className="p-5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Clock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-base font-bold text-amber-300">Application Pending Validator Review</h4>
                    <p className="text-xs text-slate-300 mt-1">
                      Your candidate credentials, payment reference, and clearance code are under review by the Election Committee.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await pingVerification('candidate');
                      setSuccess('Verification desk has been pinged about your pending application!');
                    } catch (err) {
                      setError(err.message || 'Failed to ping verification desk.');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs shrink-0 transition flex items-center gap-1.5 shadow"
                >
                  <Clock className="w-3.5 h-3.5" /> Ping Reviewers
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-start gap-4">
              <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-base font-bold text-rose-300">Application Rejected</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Reason: {myApplication.rejection_reason || 'Application requirements not satisfied.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Candidate Application Form */}
      {!myApplication && (
        <form onSubmit={handleApply} className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            Contestant Registration Form
          </h3>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Candidate Code (Issued by Admin)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="CAND-XXXX-XXXX-XXXX"
                  value={candidateCode}
                  onChange={(e) => setCandidateCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white uppercase placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono transition"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Single-use, validated candidate clearance code.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                External Payment Reference / Receipt No.
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. REC-2026-88910"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Candidate clearance fee payment receipt number.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Contesting Position (Select One Position)
            </label>
            <select
              required
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition"
            >
              <option value="">-- Choose Position to Contest --</option>
              {electionPositions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Campaign Manifesto / Statement
            </label>
            <textarea
              required
              rows={4}
              placeholder="Outline your campaign vision, key goals, and message to students..."
              value={manifesto}
              onChange={(e) => setManifesto(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Candidate Photograph (JPG, PNG)
              </label>
              <input
                type="file"
                required
                accept=".jpg,.jpeg,.png"
                onChange={(e) => setPhotoFile(e.target.files[0] || null)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-950 file:text-purple-300 hover:file:bg-purple-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Supporting Credentials (Optional PDF/JPG)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCredentialsFile(e.target.files[0] || null)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 transition"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !isVerified}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Application...
                </>
              ) : (
                <>
                  Submit Candidate Application <Award className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
