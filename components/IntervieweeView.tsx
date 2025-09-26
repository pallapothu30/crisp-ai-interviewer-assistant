
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, Candidate, Message, Question } from '../types';
import { BotIcon, PersonIcon, SendIcon, UploadIcon } from './shared/Icons';
import Loader from './shared/Loader';
import { extractInfoFromResume, generateQuestion, evaluateAnswer, summarizeInterview } from '../services/geminiService';
import { INTERVIEW_FLOW, TOTAL_QUESTIONS } from '../constants';

// Declare global variables from CDN scripts
declare var pdfjsLib: any;
declare var mammoth: any;

interface IntervieweeViewProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const ResumeUpload: React.FC<{ onUpload: (file: File) => void, loading: boolean }> = ({ onUpload, loading }) => {
  const [error, setError] = useState('');
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        onUpload(file);
      } else {
        setError('Please upload a PDF or DOCX file.');
      }
    }
  };

  return (
    <div className="text-center p-8 border-2 border-dashed border-slate-600 rounded-lg">
      <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
      <h3 className="mt-2 text-lg font-medium text-white">Upload your resume</h3>
      <p className="mt-1 text-sm text-slate-400">PDF or DOCX accepted</p>
      <div className="mt-4">
        <label htmlFor="file-upload" className="cursor-pointer bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors">
          {loading ? 'Processing...' : 'Select File'}
        </label>
        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.docx" disabled={loading} />
      </div>
      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
    </div>
  );
};

const Timer: React.FC<{ timeLeft: number }> = ({ timeLeft }) => {
    const progress = (timeLeft / 20) * 100; // Assuming max time is dynamic, need to pass it
    const strokeColor = timeLeft > 10 ? 'text-green-500' : timeLeft > 5 ? 'text-yellow-500' : 'text-red-500';
    return (
        <div className="flex items-center space-x-2 text-sm font-mono">
            <svg className="w-6 h-6 transform -rotate-90" viewBox="0 0 24 24">
                <circle className="text-slate-700" strokeWidth="4" stroke="currentColor" fill="transparent" r="8" cx="12" cy="12"/>
                <circle className={strokeColor} strokeWidth="4" strokeDasharray="50.265" strokeDashoffset={50.265 - (progress / 100) * 50.265} stroke="currentColor" fill="transparent" r="8" cx="12" cy="12"/>
            </svg>
            <span className={`font-bold ${strokeColor}`}>{timeLeft}s</span>
        </div>
    );
};

const IntervieweeView: React.FC<IntervieweeViewProps> = ({ appState, setAppState }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  // Fix: The return type of setTimeout in the browser is a number, not NodeJS.Timeout.
  const timerRef = useRef<number | null>(null);

  const activeCandidate = appState.candidates.find(c => c.id === appState.activeCandidateId);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeCandidate?.chatHistory]);

  const updateCandidate = useCallback((updatedCandidate: Candidate) => {
    setAppState(prev => ({
        ...prev,
        candidates: prev.candidates.map(c => c.id === updatedCandidate.id ? updatedCandidate : c)
    }));
  }, [setAppState]);

  const handleNextAction = useCallback(async (candidate: Candidate) => {
    setIsLoading(true);

    let updatedCandidate = { ...candidate };
    let newMessages: Message[] = [];

    // Step 1: Check for missing info
    if (updatedCandidate.status === 'InfoCollected') {
        const missingFields: string[] = [];
        if (!updatedCandidate.name) missingFields.push('name');
        if (!updatedCandidate.email) missingFields.push('email');
        if (!updatedCandidate.phone) missingFields.push('phone');

        if (missingFields.length > 0) {
            newMessages.push({ id: Date.now().toString(), sender: 'ai', text: `Thanks. I see we're missing your ${missingFields.join(', ')}. What is your ${missingFields[0]}?`, isInfo: true });
        } else {
            newMessages.push({ id: Date.now().toString(), sender: 'ai', text: "Great, I have all your information. We'll now begin the interview. You'll have a specific time for each question.", isInfo: true });
            updatedCandidate.status = 'InProgress';
        }
    }

    // Step 2: Handle interview in progress
    if (updatedCandidate.status === 'InProgress') {
        const { currentQuestionIndex } = updatedCandidate;
        if (currentQuestionIndex < TOTAL_QUESTIONS) {
            const { difficulty, time } = INTERVIEW_FLOW[currentQuestionIndex];
            const existingQuestionTexts = updatedCandidate.questions.map(q => q.text);
            const questionText = await generateQuestion(difficulty, existingQuestionTexts);
            
            const newQuestion: Question = { id: Date.now().toString(), text: questionText, difficulty, time, answer: '', score: null, feedback: '' };
            updatedCandidate.questions.push(newQuestion);

            newMessages.push({ id: Date.now().toString(), sender: 'ai', text: `Question ${currentQuestionIndex + 1}/${TOTAL_QUESTIONS} (${difficulty}):\n\n${questionText}` });
            setTimeLeft(time);
        } else {
            // Interview finished
            updatedCandidate.status = 'Completed';
            newMessages.push({ id: Date.now().toString(), sender: 'ai', text: "Thank you for completing the interview. I'm now calculating your final score and generating a summary. One moment...", isInfo: true });
            
            // Calculate score and summary
            const totalScore = updatedCandidate.questions.reduce((acc, q) => acc + (q.score || 0), 0);
            updatedCandidate.finalScore = Math.round(totalScore / TOTAL_QUESTIONS);
            updatedCandidate.summary = await summarizeInterview(updatedCandidate.name || 'Candidate', updatedCandidate.questions);
            
            newMessages.push({ id: Date.now().toString(), sender: 'ai', text: `**Interview Complete!**\n\n**Final Score:** ${updatedCandidate.finalScore}%\n\n**Summary:**\n${updatedCandidate.summary}`, isInfo: true });
            setAppState(prev => ({ ...prev, activeCandidateId: null })); // Go back to start screen for next candidate
        }
    }
    
    updatedCandidate.chatHistory = [...updatedCandidate.chatHistory, ...newMessages];
    updateCandidate(updatedCandidate);
    setIsLoading(false);
  }, [updateCandidate, setAppState]);

  // Timer logic
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && activeCandidate?.status === 'InProgress') {
      if (timerRef.current) clearTimeout(timerRef.current);
      const currentQuestion = activeCandidate.questions[activeCandidate.currentQuestionIndex];
      if (currentQuestion && currentQuestion.answer === '') { // Auto-submit if time runs out
          handleSubmit(new Event('submit'));
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, activeCandidate?.status]);

  const handleSubmit = async (e: React.FormEvent | Event) => {
    e.preventDefault();
    if (!activeCandidate || (userInput.trim() === '' && activeCandidate.status !== 'InProgress')) return;
    if(timerRef.current) clearTimeout(timerRef.current);

    const updatedCandidate = { ...activeCandidate };
    let newMessages: Message[] = [];

    // Handle collecting missing info
    if (updatedCandidate.status === 'InfoCollected') {
        const missingFields: string[] = [];
        if (!updatedCandidate.name) missingFields.push('name');
        if (!updatedCandidate.email) missingFields.push('email');
        if (!updatedCandidate.phone) missingFields.push('phone');

        if (missingFields.length > 0) {
            const fieldToUpdate = missingFields[0] as keyof Candidate;
            (updatedCandidate[fieldToUpdate] as any) = userInput;
            newMessages.push({ id: Date.now().toString(), sender: 'user', text: userInput });
        }
    }

    // Handle interview question answer
    if (updatedCandidate.status === 'InProgress') {
        const currentQuestionIndex = updatedCandidate.currentQuestionIndex;
        const currentQuestion = updatedCandidate.questions[currentQuestionIndex];
        
        newMessages.push({ id: Date.now().toString(), sender: 'user', text: userInput });
        currentQuestion.answer = userInput;
        
        setIsLoading(true);
        newMessages.push({ id: Date.now().toString() + "-loader", sender: 'ai', text: "Evaluating...", isInfo: true });
        updatedCandidate.chatHistory = [...updatedCandidate.chatHistory, ...newMessages];
        updateCandidate(updatedCandidate);
        
        const { score, feedback } = await evaluateAnswer(currentQuestion.text, userInput);
        currentQuestion.score = score;
        currentQuestion.feedback = feedback;

        updatedCandidate.currentQuestionIndex += 1;
        updatedCandidate.chatHistory = updatedCandidate.chatHistory.slice(0, -1); // remove loader message
        newMessages = [{ id: Date.now().toString(), sender: 'ai', text: `**Score:** ${score}/100\n**Feedback:** ${feedback}`, isInfo: true }];
    }

    setUserInput('');
    updatedCandidate.chatHistory = [...updatedCandidate.chatHistory, ...newMessages];
    updateCandidate(updatedCandidate);
    await handleNextAction(updatedCandidate);
  };
  
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    let text = '';
    const reader = new FileReader();

    if (file.type === 'application/pdf') {
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map((item: any) => item.str).join(' ');
            }
            await processResumeText(text);
        };
        reader.readAsArrayBuffer(file);
    } else { // DOCX
        reader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            text = result.value;
            await processResumeText(text);
        };
        reader.readAsArrayBuffer(file);
    }
  };
  
  const processResumeText = async (text: string) => {
      const { name, email, phone } = await extractInfoFromResume(text);
      const newCandidate: Candidate = {
          id: `cand_${Date.now()}`,
          name, email, phone,
          resumeText: text,
          status: 'InfoCollected',
          questions: [],
          currentQuestionIndex: 0,
          finalScore: null,
          summary: '',
          chatHistory: [{ id: Date.now().toString(), sender: 'ai', text: `Hello! I've processed your resume. Let's confirm your details.` }]
      };
      setAppState(prev => ({
          ...prev,
          candidates: [...prev.candidates, newCandidate],
          activeCandidateId: newCandidate.id
      }));
      await handleNextAction(newCandidate);
      setIsLoading(false);
  };

  if (!activeCandidate) {
    return <div className="p-4"><ResumeUpload onUpload={handleFileUpload} loading={isLoading} /></div>;
  }

  const isInterviewInProgress = activeCandidate.status === 'InProgress' && activeCandidate.currentQuestionIndex < TOTAL_QUESTIONS;

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg shadow-xl">
      <div className="flex-1 p-4 overflow-y-auto">
        {activeCandidate.chatHistory.map(msg => (
          <div key={msg.id} className={`flex items-start gap-3 my-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <BotIcon className="w-8 h-8 p-1.5 bg-indigo-600 text-white rounded-full flex-shrink-0" />}
            <div className={`max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-200'} whitespace-pre-wrap`}>
                {msg.text.includes('**') ? 
                  <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} /> : 
                  msg.text
                }
            </div>
            {msg.sender === 'user' && <PersonIcon className="w-8 h-8 p-1.5 bg-sky-600 text-white rounded-full flex-shrink-0" />}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start gap-3 my-4">
                <BotIcon className="w-8 h-8 p-1.5 bg-indigo-600 text-white rounded-full" />
                <div className="max-w-md p-3 rounded-lg bg-slate-700">
                    <Loader />
                </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-slate-700">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your answer..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white disabled:opacity-50"
            disabled={isLoading || activeCandidate.status === 'Completed'}
          />
          {isInterviewInProgress && <Timer timeLeft={timeLeft} />}
          <button type="submit" className="bg-indigo-600 p-2 rounded-lg text-white hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed" disabled={isLoading || userInput.trim() === ''}>
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default IntervieweeView;
