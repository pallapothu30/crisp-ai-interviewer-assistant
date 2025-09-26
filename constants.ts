
import { Difficulty } from './types';

export const INTERVIEW_FLOW: { difficulty: Difficulty; time: number }[] = [
  { difficulty: 'Easy', time: 20 },
  { difficulty: 'Easy', time: 20 },
  { difficulty: 'Medium', time: 60 },
  { difficulty: 'Medium', time: 60 },
  { difficulty: 'Hard', time: 120 },
  { difficulty: 'Hard', time: 120 },
];

export const TOTAL_QUESTIONS = INTERVIEW_FLOW.length;
