import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { listElections, getElectionDetails, getVoterVotingStatus } from '../services/api';
import {
  Vote,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  RefreshCw,
  User
} from 'lucide-react';

export default function ElectionsView({ onOpenVotingModal, onSelectResults, onOpenAuth, onGoToVerification }) {
  const { isAuthenticated, isVerified, role, user } = useAuth();
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [electionDetails, setElectionDetails] = useState(null);
  const [voterStatus, setVoterStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchElections = async () => {
    setLoading(true);
    try {
      const res = await listElections(statusFilter);
      const list = res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
      setElections(list);
      // If we have an election and none selected, pick the first
      if (list.length > 0 && !selectedElection) {
        handleSelectElection(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load elections:', err);
      setElections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
  }, [statusFilter]);

  const handleSelectElection = async (id) => {
    setSelectedElection(id);
    setDetailsLoading(true);
    setVoterStatus(null);
    try {
      const res = await getElectionDetails(id);
      setElectionDetails(res?.data?.election || null);

      if (isAuthenticated) {
        try {
          const vStatus = await getVoterVotingStatus(id);
          setVoterStatus(vStatus?.data || null);
        } catch {
          // Non-fatal if unverified
        }
      }
    } catch (err) {
      console.error('Failed to fetch election details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 animate-pulse">
            <Vote className="w-3.5 h-3.5" />
            Voting Active (OPEN)
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-950 text-blue-400 border border-blue-800">
            <Clock className="w-3.5 h-3.5" />
            Upcoming
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Voting Concluded (CLOSED)
          </span>
        );
      case 'RESULTS_PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800">
            <BarChart3 className="w-3.5 h-3.5" />
            Official Results Published
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Vote className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Elections & Contested Positions</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            View active elections, inspect candidate rosters, and cast your official ballot.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === '' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'OPEN' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live (OPEN)
          </button>
          <button
            onClick={() => setStatusFilter('UPCOMING')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'UPCOMING' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setStatusFilter('RESULTS_PUBLISHED')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'RESULTS_PUBLISHED' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Published
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm">Loading elections...</p>
        </div>
      ) : elections.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
          <Vote className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Elections Available</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are currently no elections created in this category.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Election List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Available Elections ({elections.length})
            </h3>
            {elections.map((elec) => (
              <div
                key={elec.id}
                onClick={() => handleSelectElection(elec.id)}
                className={`p-4 rounded-xl border cursor-pointer transition shadow-md ${
                  selectedElection === elec.id
                    ? 'bg-slate-800/90 border-emerald-500 shadow-emerald-950/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {elec.status}
                  </span>
                  {selectedElection === elec.id && (
                    <ChevronRight className="w-4 h-4 text-emerald-400" />
                  )}
                </div>

                <h4 className="text-sm font-bold text-white mb-1 leading-snug">{elec.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{elec.description || 'No description provided.'}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                  <span>{elec.total_positions || 0} Positions</span>
                  <span>{elec.total_candidates || 0} Candidates</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Selected Election Detail */}
          <div className="lg:col-span-2 space-y-6">
            {detailsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 bg-slate-900/40 rounded-2xl border border-slate-800">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm">Loading election roster...</p>
              </div>
            ) : electionDetails ? (
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <div className="mb-2">{getStatusBadge(electionDetails.status)}</div>
                    <h3 className="text-xl font-extrabold text-white">{electionDetails.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">{electionDetails.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Starts: {new Date(electionDetails.start_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Ends: {new Date(electionDetails.end_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Voting / Results CTA */}
                  <div className="shrink-0">
                    {electionDetails.status === 'OPEN' && (
                      <div>
                        {voterStatus?.hasVoted ? (
                          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <p className="font-bold">Ballot Submitted</p>
                              <p className="text-[10px] text-slate-400">Receipt: {voterStatus.ballotReceiptHash.slice(0, 16)}...</p>
                            </div>
                          </div>
                        ) : !isAuthenticated ? (
                          <button
                            onClick={() => onOpenAuth('login')}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
                          >
                            <Vote className="w-4 h-4" />
                            Sign In to Vote
                          </button>
                        ) : role === 'ADMINISTRATOR' || role === 'VALIDATOR' ? (
                          <div className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs flex items-center gap-2 shadow">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span className="font-semibold">Staff Mode (Voting Restricted)</span>
                          </div>
                        ) : !isVerified ? (
                          <button
                            onClick={onGoToVerification}
                            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition flex items-center gap-2"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            Complete Verification to Vote
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenVotingModal(electionDetails)}
                            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition flex items-center gap-2 transform hover:scale-105"
                          >
                            <Vote className="w-5 h-5" />
                            Cast Official Ballot
                          </button>
                        )}
                      </div>
                    )}

                    {electionDetails.status === 'RESULTS_PUBLISHED' && (
                      <button
                        onClick={() => onSelectResults(electionDetails.id)}
                        className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition flex items-center gap-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        View Official Results
                      </button>
                    )}
                  </div>
                </div>

                {/* Assigned Positions Roster */}
                <div>
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-400" />
                    Contested Positions & Approved Candidates ({electionDetails.positions?.length || 0})
                  </h4>

                  {electionDetails.positions?.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4">No positions have been assigned to this election yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {electionDetails.positions?.map((pos, idx) => (
                        <div key={pos.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <h5 className="text-sm font-bold text-white">{pos.name}</h5>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {pos.candidate_count || 0} Candidate{pos.candidate_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 pl-8 mb-2">{pos.description || 'Standard executive office.'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
