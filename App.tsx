
import React, { useState, useEffect } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { AppState } from './types';
import IntervieweeView from './components/IntervieweeView';
import InterviewerDashboard from './components/InterviewerDashboard';
import Modal from './components/shared/Modal';
import { BotIcon, UserIcon } from './components/shared/Icons';
import { TOTAL_QUESTIONS } from './constants';

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
        const updatedCandidate = { ...unfinishedCandidate };
        updatedCandidate.status = 'Completed';
        updatedCandidate.summary = "Interview session was discarded by the user.";
        
        const answeredQuestions = updatedCandidate.questions.filter(q => q.score !== null);
        if (answeredQuestions.length > 0) {
            const totalScore = answeredQuestions.reduce((acc, q) => acc + (q.score || 0), 0);
            updatedCandidate.finalScore = Math.round(totalScore / TOTAL_QUESTIONS);
        } else {
            updatedCandidate.finalScore = 0;
        }
        
        setAppState(prev => ({
            ...prev,
            candidates: prev.candidates.map(c => c.id === updatedCandidate.id ? updatedCandidate : c),
            activeCandidateId: null
        }));
    }
    setShowWelcomeModal(false);
  };

  const TabButton: React.FC<{ tabName: 'interviewee' | 'interviewer'; label: string; icon: React.ReactNode }> = ({ tabName, label, icon }) => (
    <button
      onClick={() => setAppState(prev => ({ ...prev, activeTab: tabName }))}
      className={`w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
        appState.activeTab === tabName
          ? 'bg-[#4285F4] text-white shadow'
          : 'text-gray-500 hover:bg-gray-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Crisp <span className="text-[#4285F4]">AI Interview Assistant</span>
          </h1>
          <p className="mt-2 text-gray-500">Your intelligent partner in technical screening</p>
        </header>
        
        <div className="bg-white p-1 rounded-lg mb-8 max-w-sm mx-auto flex justify-center items-center gap-2 shadow-sm border border-gray-200">
          <TabButton tabName="interviewee" label="Interviewee" icon={<UserIcon className="w-5 h-5"/>} />
          <TabButton tabName="interviewer" label="Interviewer" icon={<BotIcon className="w-5 h-5"/>} />
        </div>
        
        <main className="min-h-[600px]">
          <div style={{ display: appState.activeTab === 'interviewee' ? 'block' : 'none' }}>
            <IntervieweeView 
              appState={appState} 
              setAppState={setAppState} 
              isActive={appState.activeTab === 'interviewee'}
            />
          </div>
          <div style={{ display: appState.activeTab === 'interviewer' ? 'block' : 'none' }}>
            <InterviewerDashboard appState={appState} />
          </div>
        </main>
      </div>

      <Modal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} title="Welcome Back!">
        <p className="text-gray-600 mb-6">You have an interview in progress. Would you like to resume?</p>
        <div className="flex justify-end gap-4">
            <button onClick={handleDiscard} className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors">
                Discard
            </button>
            <button onClick={handleResume} className="px-4 py-2 rounded-md bg-[#4285F4] text-white font-semibold hover:bg-[#357ABD] transition-colors">
                Resume
            </button>
        </div>
      </Modal>
    </div>
  );
}

export default App;