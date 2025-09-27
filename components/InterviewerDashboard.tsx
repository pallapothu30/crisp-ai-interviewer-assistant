
import React, { useState, useMemo } from 'react';
import { AppState, Candidate } from '../types';
import Modal from './shared/Modal';
import { PersonIcon, BotIcon, CheckCircleIcon, XCircleIcon } from './shared/Icons';

interface InterviewerDashboardProps {
  appState: AppState;
}

const InterviewerDashboard: React.FC<InterviewerDashboardProps> = ({ appState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Candidate | 'finalScore', direction: 'asc' | 'desc' }>({ key: 'finalScore', direction: 'desc' });
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const filteredCandidates = useMemo(() => {
    return appState.candidates.filter(c =>
      c.status === 'Completed' &&
      (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       c.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [appState.candidates, searchTerm]);

  const sortedCandidates = useMemo(() => {
    const sorted = [...filteredCandidates];
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key] ?? -1;
      const bValue = b[sortConfig.key] ?? -1;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredCandidates, sortConfig]);

  const requestSort = (key: keyof Candidate | 'finalScore') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: keyof Candidate | 'finalScore') => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-xl h-full flex flex-col">
      <h1 className="text-2xl font-bold text-gray-100 mb-4">Interviewer Dashboard</h1>
      <input
        type="text"
        placeholder="Search by name or email..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
      />
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left table-auto">
          <thead className="sticky top-0 bg-gray-800">
            <tr className="border-b border-gray-700">
              <th className="p-3 cursor-pointer" onClick={() => requestSort('name')}>Name {getSortIndicator('name')}</th>
              <th className="p-3 cursor-pointer" onClick={() => requestSort('email')}>Email {getSortIndicator('email')}</th>
              <th className="p-3 cursor-pointer text-center" onClick={() => requestSort('finalScore')}>Score {getSortIndicator('finalScore')}</th>
              <th className="p-3">Summary</th>
            </tr>
          </thead>
          <tbody>
            {sortedCandidates.map(candidate => (
              <tr 
                key={candidate.id} 
                className="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                onClick={() => setSelectedCandidate(candidate)}
              >
                <td className="p-3">{candidate.name || 'N/A'}</td>
                <td className="p-3">{candidate.email || 'N/A'}</td>
                <td className="p-3 text-center font-bold">
                    <span className={`px-2 py-1 rounded-md ${candidate.finalScore! >= 70 ? 'bg-green-500/20 text-green-300' : candidate.finalScore! >= 50 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
                        {candidate.finalScore}%
                    </span>
                </td>
                <td className="p-3 text-gray-400 truncate max-w-sm">{candidate.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedCandidates.length === 0 && (
            <div className="text-center py-10 text-gray-500">No completed interviews found.</div>
        )}
      </div>

      {selectedCandidate && (
        <Modal isOpen={!!selectedCandidate} onClose={() => setSelectedCandidate(null)} title={`Interview Details: ${selectedCandidate.name}`} size="3xl">
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg text-gray-800 border-b pb-2 mb-2">Candidate Profile</h3>
              <p className="text-gray-600"><strong>Email:</strong> {selectedCandidate.email}</p>
              <p className="text-gray-600"><strong>Phone:</strong> {selectedCandidate.phone}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-bold text-lg text-gray-800 mb-2">Final Assessment</h3>
              <p className="text-gray-700">
                <strong>Score:</strong> <span className="font-bold text-cyan-700">{selectedCandidate.finalScore}%</span>
              </p>
              <p className="text-gray-700 mt-1 whitespace-pre-wrap"><strong>AI Summary:</strong> {selectedCandidate.summary}</p>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800 border-b pb-2 mb-2">Interview Transcript</h3>
              <div className="space-y-4 mt-4">
                {selectedCandidate.questions.map((q, index) => (
                  <div key={q.id} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-start gap-3">
                      <BotIcon className="w-6 h-6 p-1 bg-cyan-600 text-white rounded-full flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-700">Q{index+1} ({q.difficulty}): {q.text}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 mt-3 pl-9">
                      <PersonIcon className="w-6 h-6 p-1 bg-blue-600 text-white rounded-full flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-gray-600 italic">{q.answer || "No answer provided."}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-4 text-sm text-gray-600">
                        {q.score! >= 50 ? <CheckCircleIcon className="w-5 h-5 text-green-500"/> : <XCircleIcon className="w-5 h-5 text-red-500"/>}
                        <p><strong>Score:</strong> {q.score}/100</p>
                        <p className="flex-1"><strong>Feedback:</strong> {q.feedback}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InterviewerDashboard;
