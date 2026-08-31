import React, { useState, useEffect } from 'react';
import { listElections, getPublicResults } from '../services/api';
import {
  BarChart3,
  Award,
  Lock,
  CheckCircle2,
  Calendar,
  User,
  Vote,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function ResultsView({ initialElectionId }) {
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(initialElectionId || '');
  const [resultsData, setResultsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    async function loadElections() {
      try {
        const res = await listElections();
        const allElections = res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
        setElections(allElections);
        if (!selectedElectionId && allElections.length > 0) {
          setSelectedElectionId(allElections[0].id);
        }
      } catch (err) {
        console.error('Failed to load elections:', err);
      }
    }
    loadElections();
  }, []);

  useEffect(() => {
    if (!selectedElectionId) return;

    async function loadResults() {
      setLoading(true);
      setError('');
      setIsPrivate(false);
      try {
        const res = await getPublicResults(selectedElectionId);
        setResultsData(res?.data || null);
      } catch (err) {
        if (err.errorCode === 'RESULTS_PRIVATE' || err.status === 403) {
          setIsPrivate(true);
        } else {
          setError(err.message || 'Failed to load results.');
        }
        setResultsData(null);
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [selectedElectionId]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Official Election Results</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Official tallies and declared winners published by election administration.
          </p>
        </div>

        {/* Election Selector */}
        {elections.length > 0 && (
          <div className="w-full md:w-64">
            <select
              value={selectedElectionId}
              onChange={(e) => setSelectedElectionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition"
            >
              {elections.map((elec) => (
                <option key={elec.id} value={elec.id}>
                  {elec.title} ({elec.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-sm">Retrieving official tallies...</p>
        </div>
      ) : isPrivate ? (
        /* PRIVACY LOCK BANNER */
        <div className="text-center py-16 px-6 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-4 max-w-xl mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-950 border-2 border-amber-500 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-950/40">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-white">Results are Currently Private</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Election tallies remain confidential while voting is in progress and during calculation.
          </p>
          <p className="text-xs text-slate-500">
            Official results will appear here once finalized and published by the Administrator.
          </p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5 max-w-xl mx-auto">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : resultsData ? (
        <div className="space-y-8">
          {/* Summary Metric Header */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500">Election Title</span>
              <h4 className="text-base font-bold text-white mt-1">{resultsData.election?.title}</h4>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total Ballots Counted</span>
              <h4 className="text-2xl font-black text-emerald-400 mt-1">{resultsData.election?.totalBallotsCast || 0}</h4>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500">Published Timestamp</span>
              <h4 className="text-xs font-semibold text-slate-300 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                {new Date(resultsData.election?.publishedAt).toLocaleString()}
              </h4>
            </div>
          </div>

          {/* Results Grouped By Position */}
          <div className="space-y-6">
            {resultsData.results?.map((posGroup, idx) => (
              <div key={posGroup.positionId} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-800">
                      {idx + 1}
                    </span>
                    <h3 className="text-base font-extrabold text-white">{posGroup.positionName}</h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Total Votes Cast: <strong>{posGroup.totalVotesForPosition}</strong>
                  </span>
                </div>

                <div className="space-y-3">
                  {posGroup.candidates?.map((cand) => (
                    <div
                      key={cand.candidateId}
                      className={`p-4 rounded-xl border transition ${
                        cand.isWinner
                          ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/30'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold overflow-hidden shrink-0">
                            {cand.photoUrl ? (
                              <img src={cand.photoUrl} alt={cand.candidateName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{cand.candidateName}</h4>
                              {cand.isWinner && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow">
                                  <Award className="w-3 h-3" /> Winner
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">{cand.votes} votes</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-extrabold text-white">{cand.votePercentage}%</span>
                        </div>
                      </div>

                      {/* Vote Share Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cand.isWinner ? 'bg-emerald-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${cand.votePercentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
