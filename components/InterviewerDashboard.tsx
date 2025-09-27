
import React, { useState, useMemo } from 'react';
import { AppState, Candidate } from '../types';
import Modal from './shared/Modal';
import { UserIcon, BotIcon, CheckCircleIcon, XCircleIcon, UsersIcon, CheckBadgeIcon, ClockIcon, TrendingUpIcon, SearchIcon } from './shared/Icons';

interface InterviewerDashboardProps {
  appState: AppState;
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-gray-500 text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
);

type SortKey = 'name' | 'email' | 'finalScore' | 'date';

const InterviewerDashboard: React.FC<InterviewerDashboardProps> = ({ appState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSort, setActiveSort] = useState<SortKey>('date');

  const completedCandidates = useMemo(() => appState.candidates.filter(c => c.status === 'Completed'), [appState.candidates]);

  const stats = useMemo(() => {
    const totalCandidates = appState.candidates.length;
    const completed = completedCandidates.length;
    const inProgress = appState.candidates.filter(c => c.status === 'InProgress').length;
    const totalScore = completedCandidates.reduce((acc, c) => acc + (c.finalScore || 0), 0);
    const avgScore = completed > 0 ? Math.round(totalScore / completed) : 0;
    return { totalCandidates, completed, inProgress, avgScore };
  }, [appState.candidates, completedCandidates]);

  const filteredCandidates = useMemo(() => {
    return completedCandidates.filter(c =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [completedCandidates, searchTerm]);

  const sortedCandidates = useMemo(() => {
    const sorted = [...filteredCandidates];
    sorted.sort((a, b) => {
        switch(activeSort) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'finalScore':
                return (b.finalScore || 0) - (a.finalScore || 0);
            case 'date':
                // Assuming candidate id is based on timestamp
                return (b.id).localeCompare(a.id);
            default:
                return 0;
        }
    });
    return sorted;
  }, [filteredCandidates, activeSort]);
  
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  const SortButton: React.FC<{ sortKey: SortKey, label: string }> = ({ sortKey, label }) => (
    <button
      onClick={() => setActiveSort(sortKey)}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeSort === sortKey ? 'bg-[#00B0FF] text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Interview Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage and review all candidate interviews</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<UsersIcon className="w-6 h-6 text-blue-600"/>} label="Total Candidates" value={stats.totalCandidates} color="bg-blue-100" />
            <StatCard icon={<CheckBadgeIcon className="w-6 h-6 text-green-600"/>} label="Completed" value={stats.completed} color="bg-green-100" />
            <StatCard icon={<ClockIcon className="w-6 h-6 text-yellow-600"/>} label="In Progress" value={stats.inProgress} color="bg-yellow-100" />
            <StatCard icon={<TrendingUpIcon className="w-6 h-6 text-indigo-600"/>} label="Avg Score" value={`${stats.avgScore}%`} color="bg-indigo-100" />
        </div>

        {/* Controls and Table */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                <div className="relative w-full sm:w-auto sm:flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                    <input
                        type="text"
                        placeholder="Search candidates..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00B0FF] focus:outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <SortButton sortKey="date" label="Sort by Date" />
                    <SortButton sortKey="name" label="Sort by Name" />
                    <SortButton sortKey="finalScore" label="Sort by Score" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase">
                            <th className="p-3 font-semibold">Name</th>
                            <th className="p-3 font-semibold">Email</th>
                            <th className="p-3 font-semibold">Status</th>
                            <th className="p-3 font-semibold text-center">Score</th>
                            <th className="p-3 font-semibold">Date</th>
                            <th className="p-3 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCandidates.map(candidate => (
                        <tr 
                            key={candidate.id} 
                            className="border-b border-gray-200 hover:bg-gray-50"
                        >
                            <td className="p-3 font-medium text-gray-800">{candidate.name || 'N/A'}</td>
                            <td className="p-3 text-gray-600">{candidate.email || 'N/A'}</td>
                            <td className="p-3"><span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span></td>
                            <td className="p-3 text-center font-bold">
                                <span className={`px-2 py-1 rounded-md text-sm ${candidate.finalScore! >= 70 ? 'bg-green-100 text-green-800' : candidate.finalScore! >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                    {candidate.finalScore}%
                                </span>
                            </td>
                            <td className="p-3 text-gray-600">{new Date(parseInt(candidate.id.split('_')[1])).toLocaleDateString()}</td>
                            <td className="p-3">
                                <button onClick={() => setSelectedCandidate(candidate)} className="text-[#00B0FF] hover:text-[#0099E6] font-semibold">View Details</button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                </table>
                {sortedCandidates.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <h3 className="font-semibold text-lg">No candidates yet</h3>
                        <p className="text-sm">Completed interviews will appear here.</p>
                    </div>
                )}
            </div>
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
                <strong>Score:</strong> <span className="font-bold text-[#00B0FF]">{selectedCandidate.finalScore}%</span>
              </p>
              <p className="text-gray-700 mt-1 whitespace-pre-wrap"><strong>AI Summary:</strong> {selectedCandidate.summary}</p>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800 border-b pb-2 mb-2">Interview Transcript</h3>
              <div className="space-y-4 mt-4">
                {selectedCandidate.questions.map((q, index) => (
                  <div key={q.id} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-start gap-3">
                      <BotIcon className="w-6 h-6 p-1 bg-[#00B0FF] text-white rounded-full flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-700">Q{index+1} ({q.difficulty}): {q.text}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 mt-3 pl-9">
                      <UserIcon className="w-6 h-6 p-1 bg-gray-500 text-white rounded-full flex-shrink-0 mt-1" />
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
