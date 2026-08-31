import React from 'react';
import {
  ShieldCheck,
  Vote,
  Award,
  Lock,
  EyeOff,
  FileCheck,
  KeyRound,
  Megaphone,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function RulesView({ onGoToVerification, onGoToCandidateApply, onOpenAuth }) {
  return (
    <div className="space-y-10 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-800/40 p-8 sm:p-10 shadow-2xl">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            Official Election Code & Integrity Regulations
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Constitution & Election Rules
          </h2>

          <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
            The NACOS Election Management System (FUBK Chapter) is governed by strict digital democracy standards, cryptographic verification, and inviolable election rules.
          </p>

          <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span>Technology Towards Advancement</span>
            <span>&bull;</span>
            <span>NACOS FUBK Chapter</span>
          </div>
        </div>
      </div>

      {/* 5 Core Pillars Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* RULE 1 */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-emerald-500/50 transition">
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-800">
              1
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              Ballot Integrity
            </span>
          </div>

          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-emerald-400" />
            One Voter, One Ballot
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            A registered and verified student voter can submit <strong>only one ballot</strong> per election. Once a ballot is cryptographically committed to the database, choices are immutable and cannot be changed, overwritten, or re-submitted.
          </p>

          <ul className="text-xs text-slate-300 space-y-1.5 pt-2 border-t border-slate-800">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Strict atomic database transactions prevent race conditions or simultaneous duplicate submissions.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Every submitted ballot produces a unique 64-character SHA-256 cryptographic receipt hash for voter verification.</span>
            </li>
          </ul>
        </div>

        {/* RULE 2 */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-purple-500/50 transition">
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-xl bg-purple-950 text-purple-400 font-black text-sm flex items-center justify-center border border-purple-800">
              2
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
              Contestant Limitation
            </span>
          </div>

          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-400" />
            One Candidate, One Position
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            A student applicant can contest for <strong>only ONE executive office</strong> in a particular election. The system strictly forbids running for multiple offices simultaneously.
          </p>

          <ul className="text-xs text-slate-300 space-y-1.5 pt-2 border-t border-slate-800">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Enforced by database constraints and server-side application validation across all 20 executive positions.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Candidate clearances require single-use clearance codes issued by the electoral committee.</span>
            </li>
          </ul>
        </div>

        {/* RULE 3 */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-blue-500/50 transition">
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-xl bg-blue-950 text-blue-400 font-black text-sm flex items-center justify-center border border-blue-800">
              3
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              Voter Eligibility
            </span>
          </div>

          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-400" />
            Mandatory Identity Verification
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            Registration alone does not grant voting privileges. Every voter must submit a genuine student identification document (Student ID card, Departmental Slip, or Admission Letter) and pass scrutiny by accredited Validators.
          </p>

          <ul className="text-xs text-slate-300 space-y-1.5 pt-2 border-t border-slate-800">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>Unverified accounts cannot cast ballots or apply for candidacy.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>Uploaded documents are securely stored in private directories with strict RBAC access controls.</span>
            </li>
          </ul>
        </div>

        {/* RULE 4 */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-amber-500/50 transition">
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-xl bg-amber-950 text-amber-400 font-black text-sm flex items-center justify-center border border-amber-800">
              4
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              Candidacy Approval
            </span>
          </div>

          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            Candidate Approval & Clearance
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            To appear on the ballot, candidates must be verified voters, obtain a valid single-use candidate clearance code, provide an external payment reference receipt, and pass committee review.
          </p>

          <ul className="text-xs text-slate-300 space-y-1.5 pt-2 border-t border-slate-800">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Candidate codes are cryptographically generated and single-use (`CAND-XXXX-XXXX-XXXX`).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Only approved candidates with vetted photographs and manifestos appear on the official ballot.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* RULE 5: FULL WIDTH PRIVACY GUARANTEE */}
      <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800">
              <EyeOff className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Rule 5 &bull; Core Democracy Guarantee</span>
              <h3 className="text-xl font-black text-white">Results Privacy & Publication Control</h3>
            </div>
          </div>
          <span className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center">
            5
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Election totals remain <strong>strictly confidential</strong> while voting is OPEN and remain private even when voting is CLOSED. Results become publicly accessible <strong>only after official Administrator publication</strong>.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
            <span className="text-emerald-400 font-bold block">1. Privacy While Voting</span>
            <p className="text-slate-400 text-[11px]">No voter, candidate, or validator can view live counts during active polling.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
            <span className="text-amber-400 font-bold block">2. Privacy After Close</span>
            <p className="text-slate-400 text-[11px]">Closed election results remain hidden on the backend until official auditing is complete.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
            <span className="text-purple-400 font-bold block">3. Administrator Release</span>
            <p className="text-slate-400 text-[11px]">Only the Administrator can publish final results, creating an immutable audit trail.</p>
          </div>
        </div>
      </div>

      {/* Feed & Anti-Impersonation Guidelines */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-purple-400" />
          Feed & Campaign Conduct Guidelines
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          Candidates may publish campaign statements and manifesto highlights in the Feed & Trends section. Anti-impersonation rules strictly prevent candidates from posting official administrative notices or election schedules.
        </p>
      </div>
    </div>
  );
}
