import React, { useState, useEffect } from 'react';
import {
  listPendingVerifications,
  reviewVerificationApplication,
  listCandidateApplications,
  reviewCandidateApplication,
  getStoredToken
} from '../services/api';
import {
  UserCheck,
  FileCheck,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
  FileText
} from 'lucide-react';

export default function ValidatorPortalView() {
  const [activeTab, setActiveTab] = useState('voters'); // 'voters', 'candidates'
  const [pendingVoters, setPendingVoters] = useState([]);
  const [pendingCandidates, setPendingCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Review Modal State
  const [reviewModal, setReviewModal] = useState(null); // { type: 'voter'|'candidate', item: {...} }
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchQueues = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'voters') {
        const res = await listPendingVerifications();
        const voters = res?.data?.items || res?.data?.applications || (Array.isArray(res?.data) ? res.data : []);
        setPendingVoters(voters);
      } else {
        const res = await listCandidateApplications('', 'PENDING');
        const candidates = res?.data?.items || res?.data?.applications || (Array.isArray(res?.data) ? res.data : []);
        setPendingCandidates(candidates);
      }
    } catch (err) {
      setError('Failed to load queue: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, [activeTab]);

  const handleDecision = async (status) => {
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      alert('A rejection reason is required when rejecting an application.');
      return;
    }

    setReviewing(true);
    try {
      if (reviewModal.type === 'voter') {
        const voterDocId = reviewModal.item.id || reviewModal.item.document_id || reviewModal.item.documentId;
        await reviewVerificationApplication(voterDocId, status, rejectionReason);
        setSuccess(`Voter application marked as ${status}.`);
      } else {
        const candidateAppId = reviewModal.item.id || reviewModal.item.application_id || reviewModal.item.applicationId;
        await reviewCandidateApplication(candidateAppId, status, rejectionReason);
        setSuccess(`Candidate application marked as ${status}.`);
      }

      setReviewModal(null);
      setRejectionReason('');
      fetchQueues();
    } catch (err) {
      alert('Review action failed: ' + err.message);
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-950 text-blue-400 border border-blue-800">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Election Validator Review Desk</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Review and authorize student identity credentials and candidate eligibility.
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('voters')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'voters' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Voter ID Queue ({pendingVoters.length})
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'candidates' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Candidate Applications ({pendingCandidates.length})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Queue Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">Fetching review queue...</p>
        </div>
      ) : activeTab === 'voters' ? (
        /* VOTER QUEUE */
        pendingVoters.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Voter Queue Cleared</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are currently no pending voter verification documents awaiting review.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {pendingVoters.map((item) => (
              <div key={item.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                    {item.document_type}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{item.full_name}</h4>
                  <p className="text-xs text-slate-400">Admission No: <strong className="text-slate-200">{item.admission_number}</strong></p>
                  <p className="text-xs text-slate-400">Gmail: {item.email}</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <a
                    href={`/api/v1/verification/documents/${item.id}/file?token=${getStoredToken()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Inspect ID File
                  </a>

                  <button
                    onClick={() => setReviewModal({ type: 'voter', item })}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                  >
                    Review Document
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* CANDIDATE QUEUE */
        pendingCandidates.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Candidate Queue Cleared</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are currently no pending candidate applications awaiting review.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {pendingCandidates.map((item) => (
              <div key={item.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                    Contesting: {item.position_name}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{item.full_name}</h4>
                  <p className="text-xs text-slate-400">Payment Ref: <strong className="text-slate-200">{item.payment_reference}</strong></p>
                  <p className="text-xs text-slate-400">Code Used: <code className="text-purple-300 font-mono text-[11px]">{item.candidate_code}</code></p>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 italic">"{item.manifesto}"</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  {item.credentials_document_path ? (
                    <a
                      href={`/api/v1/candidates/applications/${item.id}/credentials?token=${getStoredToken()}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Credentials
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-600" /> No File Uploaded
                    </span>
                  )}

                  <button
                    onClick={() => setReviewModal({ type: 'candidate', item })}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition"
                  >
                    Review Application
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* REVIEW DECISION MODAL */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <h3 className="text-sm font-bold text-white">
                Review {reviewModal.type === 'voter' ? 'Voter Document' : 'Candidate Application'}
              </h3>
              <button onClick={() => setReviewModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <p>Applicant: <strong className="text-white">{reviewModal.item.full_name || reviewModal.item.applicant_name}</strong></p>
                <p>Admission No: <strong className="text-slate-200">{reviewModal.item.admission_number}</strong></p>
                <p>Email: <span className="text-slate-300">{reviewModal.item.email || reviewModal.item.applicant_email}</span></p>
                {reviewModal.type === 'candidate' && (
                  <>
                    <p>Contesting Position: <strong className="text-purple-300">{reviewModal.item.position_name}</strong></p>
                    <p>Payment Ref: <code className="text-slate-200 font-mono text-[11px]">{reviewModal.item.payment_reference || reviewModal.item.external_payment_reference}</code></p>
                    <p>Candidate Code: <code className="text-purple-300 font-mono text-[11px]">{reviewModal.item.candidate_code}</code></p>
                    <div className="pt-1 border-t border-slate-800/80 mt-1">
                      {reviewModal.item.credentials_document_path ? (
                        <a
                          href={`/api/v1/candidates/applications/${reviewModal.item.id}/credentials?token=${getStoredToken()}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect Supporting Credentials File
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
                          <FileText className="w-3 h-3" /> No supporting credentials file attached to application.
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rejection Reason (Required only if rejecting)
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why the credentials or ID was rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none transition"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => handleDecision('REJECTED')}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>

                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => handleDecision('APPROVED')}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
