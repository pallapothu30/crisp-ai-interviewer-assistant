
import React, { useState, useEffect } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { AppState } from './types';
import IntervieweeView from './components/IntervieweeView';
import InterviewerDashboard from './components/InterviewerDashboard';
import Modal from './components/shared/Modal';

const initialAppState: AppState = {
  candidates: [],
  activeCandidateId: null,
  activeTab: 'interviewee',
};

function App() {
  const [appState, setAppState] = useLocalStorage<AppState>('interview-app-state', initialAppState);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    const unfinishedCandidate = appState.candidates.find(c => c.status === 'InProgress');
    if (unfinishedCandidate) {
        setShowWelcomeModal(true);
    }
  }, []); // Run only on initial mount

  const handleResume = () => {
    const unfinishedCandidate = appState.candidates.find(c => c.status === 'InProgress');
    if (unfinishedCandidate) {
        setAppState(prev => ({
            ...prev,
            activeCandidateId: unfinishedCandidate.id,
            activeTab: 'interviewee'
        }));
    }
    setShowWelcomeModal(false);
  };
  
  const handleDiscard = () => {
    const unfinishedCandidate = appState.candidates.find(c => c.status === 'InProgress');
    if (unfinishedCandidate) {
        // Reset the candidate by removing them, or resetting their progress
        setAppState(prev => ({
            ...prev,
            candidates: prev.candidates.filter(c => c.id !== unfinishedCandidate.id),
            activeCandidateId: null
        }));
    }
    setShowWelcomeModal(false);
  };

  const TabButton: React.FC<{ tabName: 'interviewee' | 'interviewer'; label: string }> = ({ tabName, label }) => (
    <button
      onClick={() => setAppState(prev => ({ ...prev, activeTab: tabName }))}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        appState.activeTab === tabName
          ? 'bg-indigo-600 text-white'
          : 'text-slate-300 hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Crisp <span className="text-indigo-400">AI Interview Assistant</span>
          </h1>
          <p className="mt-2 text-slate-400">Your intelligent partner in technical screening</p>
        </header>
        
        <div className="bg-slate-800/50 border border-slate-700 p-2 rounded-lg mb-6 flex justify-center items-center gap-2">
          <TabButton tabName="interviewee" label="Interviewee" />
          <TabButton tabName="interviewer" label="Interviewer" />
        </div>
        
        <main className="min-h-[600px]">
          {appState.activeTab === 'interviewee' ? (
            <IntervieweeView appState={appState} setAppState={setAppState} />
          ) : (
            <InterviewerDashboard appState={appState} />
          )}
        </main>
      </div>

      <Modal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} title="Welcome Back!">
        <p className="text-slate-300 mb-6">You have an interview in progress. Would you like to resume?</p>
        <div className="flex justify-end gap-4">
            <button onClick={handleDiscard} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 transition-colors">
                Discard
            </button>
            <button onClick={handleResume} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors">
                Resume
            </button>
        </div>
      </Modal>
    </div>
  );
}

export default App;
