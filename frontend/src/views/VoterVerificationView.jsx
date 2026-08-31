import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { uploadVerificationDocument, getVerificationStatus, pingVerification } from '../services/api';
import {
  FileCheck,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Shield,
  RefreshCw,
  FileText
} from 'lucide-react';

export default function VoterVerificationView() {
  const { user, isVerified, verificationStatus, refreshUser } = useAuth();
  const [docType, setDocType] = useState('STUDENT_ID');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusData, setStatusData] = useState(null);

  const fetchStatus = async () => {
    setFetching(true);
    try {
      const res = await getVerificationStatus();
      setStatusData(res?.data || null);
    } catch (err) {
      console.warn('Failed to load status:', err.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      // Size check 5MB
      if (selected.size > 5 * 1024 * 1024) {
        setError('Document file size must be less than 5MB.');
        setFile(null);
        return;
      }
      setError('');
      setFile(selected);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a student ID or verification document.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', docType);

      await uploadVerificationDocument(formData);
      setSuccess('Verification document uploaded successfully. Awaiting Validator review.');
      setFile(null);
      await refreshUser();
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Voter Identification & Verification</h2>
            <p className="text-xs sm:text-sm text-slate-400">All registered student voters must be verified by election officials to cast ballots.</p>
          </div>
        </div>
      </div>

      {/* Current Status Card */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-lg">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Your Verification Status
        </h3>

        {fetching ? (
          <div className="py-6 flex items-center justify-center text-slate-400 gap-2 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> Loading status...
          </div>
        ) : isVerified || statusData?.verificationStatus === 'APPROVED' ? (
          <div className="p-5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 flex items-start gap-4">
            <div className="p-2 rounded-full bg-emerald-900/80 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-emerald-300">Verified & Eligible Voter</h4>
              <p className="text-xs text-slate-300 mt-1">
                Your student identity has been approved by the election validation committee. You are fully authorized to vote in all active elections.
              </p>
            </div>
          </div>
        ) : statusData?.verificationStatus === 'PENDING' && statusData?.document ? (
          <div className="p-5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-200 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-amber-900/80 text-amber-400 shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-amber-300">Verification Request Pending Review</h4>
                  <p className="text-xs text-slate-300">
                    Your verification request has been submitted and is currently in the Validator review queue. You will be notified once reviewed.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await pingVerification('voter');
                    setSuccess('Verification desk has been pinged about your pending document!');
                  } catch (err) {
                    setError(err.message || 'Failed to ping verification desk.');
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs shrink-0 transition flex items-center gap-1.5 shadow"
              >
                <Clock className="w-3.5 h-3.5" /> Ping Reviewers
              </button>
            </div>

            <div className="pt-2 border-t border-amber-800/50 flex flex-wrap items-center justify-between text-xs text-amber-400/80">
              <span>Submitted File: <strong>{statusData.document.original_filename}</strong></span>
              <span>Date: {new Date(statusData.document.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ) : statusData?.verificationStatus === 'REJECTED' ? (
          <div className="p-5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 space-y-3">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-rose-900/80 text-rose-400 shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-rose-300">Verification Rejected</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Reason: <strong className="text-rose-200">{statusData.rejectionReason || 'Document could not be verified.'}</strong>
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 pl-14">
              You may upload a new, clear photograph of your valid Student ID card below to request re-review.
            </p>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <p>You have not yet submitted a verification document. Please upload your student ID below to become eligible to vote.</p>
          </div>
        )}
      </div>

      {/* Upload Form: Only visible if not verified and not pending */}
      {!isVerified && statusData?.verificationStatus !== 'APPROVED' && (!statusData?.document || statusData?.verificationStatus === 'NOT_SUBMITTED' || statusData?.verificationStatus === 'REJECTED') && (
        <form onSubmit={handleUpload} className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            Upload Identification Document
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="STUDENT_ID">Official Student ID Card</option>
              <option value="ADMISSION_LETTER">Admission Letter / Clearance Slip</option>
              <option value="NATIONAL_ID">National ID / Passport</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Document File (JPG, PNG, PDF - Max 5MB)</label>
            <div className="p-6 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-950/60 text-center hover:border-emerald-500 transition">
              <input
                type="file"
                id="docUploadInput"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="docUploadInput" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                <div className="p-3 rounded-full bg-slate-800 text-slate-300">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-white">
                  {file ? file.name : 'Click to browse files or drag and drop here'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Securely encrypted in private backend storage'}
                </span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !file}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Uploading Document...
                </>
              ) : (
                <>
                  Submit Document for Verification <Upload className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Privacy Guarantee: Voter verification documents are stored securely in a private directory and can only be inspected by authorized election Validators.
          </p>
        </form>
      )}
    </div>
  );
}
