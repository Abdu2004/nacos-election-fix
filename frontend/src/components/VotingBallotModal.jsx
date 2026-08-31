import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { listApprovedCandidates, submitBallot, requestVotingOtp } from '../services/api';
import {
  X,
  Vote,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  User,
  RefreshCw,
  KeyRound,
  Mail
} from 'lucide-react';

export default function VotingBallotModal({ isOpen, onClose, election, onVoteSuccess }) {
  const { user } = useAuth();
  const [candidatesByPosition, setCandidatesByPosition] = useState({});
  const [selectedVotes, setSelectedVotes] = useState({}); // { [positionId]: candidateId }
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('ballot'); // 'ballot', 'review', 'otp', 'receipt'
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receiptData, setReceiptData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !election) return;
    setStep('ballot');
    setSelectedVotes({});
    setError('');
    setOtp('');
    setOtpSent(false);
    setResendCooldown(0);
    setReceiptData(null);
    setCopied(false);

    async function loadCandidates() {
      setLoading(true);
      try {
        const res = await listApprovedCandidates(election.id);
        const candidates = res?.data?.candidates || [];

        // Group by position
        const grouped = {};
        candidates.forEach((c) => {
          if (!grouped[c.position_id]) {
            grouped[c.position_id] = {
              positionId: c.position_id,
              positionName: c.position_name,
              positionOrder: c.display_order,
              candidates: []
            };
          }
          grouped[c.position_id].candidates.push(c);
        });

        setCandidatesByPosition(grouped);
      } catch (err) {
        setError('Failed to load candidate roster: ' + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCandidates();
  }, [isOpen, election]);

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

  const handleRequestVotingOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await requestVotingOtp(election.id);
      setOtpSent(true);
      setStep('otp');
      startCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to dispatch voting OTP to your Gmail.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await requestVotingOtp(election.id);
      startCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend voting confirmation code.');
    }
  };

  if (!isOpen || !election) return null;

  const handleSelectCandidate = (positionId, candidateId) => {
    setSelectedVotes((prev) => {
      if (prev[positionId] === candidateId) {
        const next = { ...prev };
        delete next[positionId];
        return next;
      }
      return {
        ...prev,
        [positionId]: candidateId
      };
    });
  };

  const handleProceedToReview = () => {
    const voteCount = Object.keys(selectedVotes).length;
    if (voteCount === 0) {
      setError('Please select at least one candidate before proceeding.');
      return;
    }
    setError('');
    setStep('review');
  };

  const handleSubmitBallot = async (e) => {
    if (e) e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit confirmation code sent to your Gmail.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const votesPayload = Object.entries(selectedVotes).map(([positionId, candidateId]) => ({
        positionId,
        candidateId
      }));

      const res = await submitBallot(election.id, votesPayload, otp.trim());
      setReceiptData(res?.data);
      setStep('receipt');
      if (onVoteSuccess) onVoteSuccess();
    } catch (err) {
      setError(err.message || 'Failed to submit ballot. Please check your confirmation code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyReceipt = () => {
    if (receiptData?.ballotReceiptHash) {
      navigator.clipboard.writeText(receiptData.ballotReceiptHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const positionsList = Object.values(candidatesByPosition);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Official Ballot — {election.title}</h3>
              <p className="text-[11px] text-slate-400">One voter, one ballot. Choices are final once submitted.</p>
            </div>
          </div>
          {step !== 'receipt' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: BALLOT SELECTION */}
          {step === 'ballot' && (
            <div className="space-y-6">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span>Select up to 1 candidate per position. You have selected <strong>{Object.keys(selectedVotes).length}</strong> candidate(s).</span>
                <span className="text-emerald-400 font-bold">{positionsList.length} Positions</span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <p className="text-xs">Loading approved ballot contestants...</p>
                </div>
              ) : positionsList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-12">No approved candidates available for this election.</p>
              ) : (
                <div className="space-y-6">
                  {positionsList.map((posGroup, pIdx) => {
                    const selectedCandId = selectedVotes[posGroup.positionId];

                    return (
                      <div key={posGroup.positionId} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-800">
                              {pIdx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-white">{posGroup.positionName}</h4>
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            {selectedCandId ? 'Choice Selected' : 'No Choice Selected'}
                          </span>
                        </div>

                        {posGroup.candidates.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No approved contestants for this position.</p>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-3 pt-1">
                            {posGroup.candidates.map((cand) => {
                              const candId = cand.id || cand.candidate_id;
                              const isSelected = Boolean(selectedCandId && selectedCandId === candId);

                              return (
                                <div
                                  key={candId}
                                  onClick={() => handleSelectCandidate(posGroup.positionId, candId)}
                                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                                    isSelected
                                      ? 'bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-950/30'
                                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  {/* Candidate Photo */}
                                  <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold overflow-hidden shrink-0">
                                    {cand.photo_url ? (
                                      <img src={cand.photo_url} alt={cand.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <User className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <h5 className="text-xs font-bold text-white truncate">{cand.full_name}</h5>
                                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700'
                                      }`}>
                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{cand.manifesto || 'Contesting candidate.'}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: REVIEW SELECTIONS */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Review Your Ballot Selections</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Please carefully verify your choices below. Next, you will confirm with a 6-digit one-time code sent to your registered Gmail.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {positionsList.map((posGroup) => {
                  const chosenId = selectedVotes[posGroup.positionId];
                  const chosenCand = posGroup.candidates.find((c) => (c.id || c.candidate_id) === chosenId);

                  return (
                    <div key={posGroup.positionId} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">{posGroup.positionName}</span>
                        <span className="font-bold text-white text-sm">
                          {chosenCand ? chosenCand.full_name : <span className="text-slate-500 italic">Abstained / No selection</span>}
                        </span>
                      </div>
                      {chosenCand ? (
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded">None</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: 2FA VOTING OTP CONFIRMATION */}
          {step === 'otp' && (
            <div className="space-y-6 max-w-md mx-auto py-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/30">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-black text-white">Gmail Ballot Confirmation</h4>
                <p className="text-xs text-slate-400">
                  A 6-digit confirmation code has been dispatched to your registered Gmail address <strong className="text-slate-200">{user?.email}</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 text-center">Enter 6-Digit Confirmation Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-slate-500">Didn't receive the code?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold disabled:text-slate-600 transition"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUBMISSION RECEIPT */}
          {step === 'receipt' && receiptData && (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-950 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-in zoom-in-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-extrabold text-white">Official Ballot Recorded</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Your vote has been cryptographically recorded in the election database.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3 max-w-md mx-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cryptographic Receipt Hash</span>
                  <button
                    onClick={handleCopyReceipt}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Receipt
                      </>
                    )}
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 break-all select-all">
                  {receiptData.ballotReceiptHash}
                </div>

                <p className="text-[10px] text-slate-500 leading-normal">
                  Vote Privacy Guarantee: This receipt allows you to independently verify that your ballot was counted without revealing who you voted for.
                </p>
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                Close & Return
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {step !== 'receipt' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80 shrink-0">
            {step === 'otp' ? (
              <button
                onClick={() => setStep('review')}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Review
              </button>
            ) : step === 'review' ? (
              <button
                onClick={() => setStep('ballot')}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Choices
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            )}

            {step === 'ballot' ? (
              <button
                onClick={handleProceedToReview}
                disabled={Object.keys(selectedVotes).length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                Review Selections ({Object.keys(selectedVotes).length})
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : step === 'review' ? (
              <button
                onClick={handleRequestVotingOtp}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xl shadow-emerald-600/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending Code...
                  </>
                ) : (
                  <>
                    Proceed to 2FA Confirmation <Mail className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSubmitBallot}
                disabled={submitting || otp.length !== 6}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xl shadow-emerald-600/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Casting Ballot...
                  </>
                ) : (
                  <>
                    Confirm & Submit Ballot <Vote className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
