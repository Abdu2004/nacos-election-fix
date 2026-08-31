import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import VotingBallotModal from './components/VotingBallotModal';
import ReceiptVerifyModal from './components/ReceiptVerifyModal';
import FeedView from './views/FeedView';
import ElectionsView from './views/ElectionsView';
import ResultsView from './views/ResultsView';
import RulesView from './views/RulesView';
import VoterVerificationView from './views/VoterVerificationView';
import CandidatePortalView from './views/CandidatePortalView';
import ValidatorPortalView from './views/ValidatorPortalView';
import AdminPortalView from './views/AdminPortalView';
import LandingAuthView from './views/LandingAuthView';
import {
  Vote,
  ShieldCheck,
  Award,
  LogIn,
  UserPlus,
  BookOpen,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

function AppContent() {
  const { isAuthenticated, user, isVerified } = useAuth();

  const [currentView, setView] = useState('feed');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [votingModalOpen, setVotingModalOpen] = useState(false);
  const [votingElection, setVotingElection] = useState(null);
  const [receiptVerifyOpen, setReceiptVerifyOpen] = useState(false);
  const [selectedResultsElectionId, setSelectedResultsElectionId] = useState('');

  const handleOpenAuth = (tab = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleOpenVoting = (election) => {
    setVotingElection(election);
    setVotingModalOpen(true);
  };

  const handleSelectResults = (electionId) => {
    setSelectedResultsElectionId(electionId);
    setView('results');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        setView={setView}
        onOpenAuth={handleOpenAuth}
        onOpenReceiptVerify={() => setReceiptVerifyOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* If user is not authenticated and hasn't explicitly clicked a public tab, show the Split-Screen Landing Page */}
        {!isAuthenticated && currentView !== 'rules' && currentView !== 'results' ? (
          <LandingAuthView
            onNavigateRules={() => setView('rules')}
            onNavigateFeed={() => setView('feed')}
          />
        ) : (
          <>
            {currentView === 'feed' && (
              <FeedView onOpenAuth={handleOpenAuth} />
            )}

            {currentView === 'elections' && (
              <ElectionsView
                onOpenVotingModal={handleOpenVoting}
                onSelectResults={handleSelectResults}
                onOpenAuth={handleOpenAuth}
                onGoToVerification={() => setView('verification')}
              />
            )}

            {currentView === 'results' && (
              <ResultsView initialElectionId={selectedResultsElectionId} />
            )}

            {currentView === 'rules' && (
              <RulesView
                onGoToVerification={() => setView('verification')}
                onGoToCandidateApply={() => setView('candidate-apply')}
                onOpenAuth={handleOpenAuth}
              />
            )}

            {currentView === 'verification' && (
              <VoterVerificationView />
            )}

            {(currentView === 'candidate-apply' || currentView === 'candidate-portal') && (
              <CandidatePortalView onGoToVerification={() => setView('verification')} />
            )}

            {currentView === 'validator' && (
              <ValidatorPortalView />
            )}

            {currentView === 'admin' && (
              <AdminPortalView />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        onClose={() => setAuthModalOpen(false)}
      />

      <VotingBallotModal
        isOpen={votingModalOpen}
        election={votingElection}
        onClose={() => setVotingModalOpen(false)}
        onVoteSuccess={() => {
          // Optional callback
        }}
      />

      <ReceiptVerifyModal
        isOpen={receiptVerifyOpen}
        onClose={() => setReceiptVerifyOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto flex items-center justify-center text-center">
          <p className="font-semibold tracking-wide text-slate-400">
            &copy; 2026 NACOS ELECTION SYSTEM FUBK CHAPTER
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
