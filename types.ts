
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  isInfo?: boolean;
}

export interface Question {
  id: string;
  text: string;
  difficulty: Difficulty;
  time: number;
  answer: string;
  score: number | null;
  feedback: string;
}

export interface Candidate {
  id:string;
  name: string | null;
  email: string | null;
  phone: string | null;
  resumeText: string;
  status: 'PendingInfo' | 'InfoCollected' | 'InProgress' | 'Completed';
  questions: Question[];
  currentQuestionIndex: number;
  finalScore: number | null;
  summary: string;
  chatHistory: Message[];
}

export interface AppState {
    candidates: Candidate[];
    activeCandidateId: string | null;
    activeTab: 'interviewee' | 'interviewer';
}
