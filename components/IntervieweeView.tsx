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

const Timer: React.FC<{ timeLeft: number; questionTime: number }> = ({ timeLeft, questionTime }) => {
    const progress = (timeLeft / questionTime) * 100;
    const strokeColor = timeLeft > questionTime * 0.5 ? 'text-green-500' : timeLeft > questionTime * 0.25 ? 'text-yellow-500' : 'text-red-500';
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
            updatedCandidate.status = 'Completed';
            const thinkingMessage: Message = { id: 'thinking-msg', sender: 'ai', text: "Thank you for completing the interview. I'm now calculating your final score and generating a summary. One moment...", isInfo: true };
            
            updatedCandidate.chatHistory = [...updatedCandidate.chatHistory, thinkingMessage];
            updateCandidate(updatedCandidate);

            const totalScore = updatedCandidate.questions.reduce((acc, q) => acc + (q.score || 0), 0);
            updatedCandidate.finalScore = Math.round(totalScore / TOTAL_QUESTIONS);
            updatedCandidate.summary = await summarizeInterview(updatedCandidate.name || 'Candidate', updatedCandidate.questions);
            
            const finalMessage: Message = { id: Date.now().toString() + '-final', sender: 'ai', text: `**Interview Complete!**\n\n**Final Score:** ${updatedCandidate.finalScore}%\n\n**Summary:**\n${updatedCandidate.summary}`, isInfo: true };
            
            const finalChatHistory = updatedCandidate.chatHistory.filter(msg => msg.id !== 'thinking-msg');
            finalChatHistory.push(finalMessage);
            updatedCandidate.chatHistory = finalChatHistory;

            // Perform the final state update for the candidate.
            setAppState(prev => ({
                ...prev,
                candidates: prev.candidates.map(c => c.id === updatedCandidate.id ? updatedCandidate : c),
            }));
            
            // After a delay, return to the welcome screen.
            setTimeout(() => {
                setAppState(prev => ({ ...prev, activeCandidateId: null }));
            }, 8000);
            
            setIsLoading(false);
            return;
        }
    }
    
    updatedCandidate.chatHistory = [...updatedCandidate.chatHistory, ...newMessages];
    updateCandidate(updatedCandidate);
    setIsLoading(false);
  }, [updateCandidate, setAppState]);

  const handleSubmit = useCallback(async (e: React.FormEvent | Event) => {
    e.preventDefault();
    if (!activeCandidate || (userInput.trim() === '' && activeCandidate.status !== 'InProgress')) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setIsLoading(true);
    // Fix: Using JSON.parse(JSON.stringify(...)) for a deep clone loses specific type information,
    // like the 'ai' | 'user' union for the sender property, which TypeScript then infers as a generic string.
    // By explicitly casting the result back to `Candidate`, we restore this type information and
    // prevent downstream type errors when manipulating the chat history.
    const updatedCandidate: Candidate = JSON.parse(JSON.stringify(activeCandidate));

    if (updatedCandidate.status === 'InfoCollected') {
        const missingFields: string[] = [];
        if (!updatedCandidate.name) missingFields.push('name');
        if (!updatedCandidate.email) missingFields.push('email');
        if (!updatedCandidate.phone) missingFields.push('phone');

        if (missingFields.length > 0) {
            const fieldToUpdate = missingFields[0] as keyof Candidate;
            (updatedCandidate[fieldToUpdate] as any) = userInput;
        }
        updatedCandidate.chatHistory.push({ id: Date.now().toString(), sender: 'user', text: userInput });
    } else if (updatedCandidate.status === 'InProgress') {
        const currentQuestionIndex = updatedCandidate.currentQuestionIndex;
        const currentQuestion = updatedCandidate.questions[currentQuestionIndex];
        
        updatedCandidate.chatHistory.push({ id: Date.now().toString(), sender: 'user', text: userInput });
        currentQuestion.answer = userInput;
        
        const loaderMessage = { id: Date.now().toString() + "-loader", sender: 'ai' as const, text: "Evaluating...", isInfo: true };
        updatedCandidate.chatHistory.push(loaderMessage);
        updateCandidate(updatedCandidate);
        
        const { score, feedback } = await evaluateAnswer(currentQuestion.text, userInput);
        currentQuestion.score = score;
        currentQuestion.feedback = feedback;
        updatedCandidate.currentQuestionIndex += 1;
        updatedCandidate.chatHistory.pop(); // remove loader message
        
        updatedCandidate.chatHistory.push({ id: Date.now().toString(), sender: 'ai', text: `**Score:** ${score}/100\n**Feedback:** ${feedback}`, isInfo: true });
    }

    setUserInput('');
    await handleNextAction(updatedCandidate);
  }, [activeCandidate, userInput, handleNextAction, updateCandidate]);

  // Timer logic
  useEffect(() => {
    if (timeLeft > 0 && activeCandidate?.status === 'InProgress') {
      timerRef.current = window.setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && activeCandidate?.status === 'InProgress') {
      const currentQuestion = activeCandidate.questions[activeCandidate.currentQuestionIndex];
      if (currentQuestion && currentQuestion.answer === '') { // Auto-submit if time runs out
          handleSubmit(new Event('submit'));
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) };
  }, [timeLeft, activeCandidate, handleSubmit]);
  
  const processResumeText = async (text: string) => {
    setIsLoading(true);
    const { name, email, phone } = await extractInfoFromResume(text);
    
    let newCandidate: Candidate = {
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
    
    let newMessages: Message[] = [];
    const missingFields: string[] = [];
    if (!newCandidate.name) missingFields.push('name');
    if (!newCandidate.email) missingFields.push('email');
    if (!newCandidate.phone) missingFields.push('phone');

    if (missingFields.length > 0) {
        newMessages.push({ id: Date.now().toString() + '_q', sender: 'ai', text: `Thanks. I see we're missing your ${missingFields.join(', ')}. What is your ${missingFields[0]}?`, isInfo: true });
    } else {
        newMessages.push({ id: Date.now().toString() + '_q', sender: 'ai', text: "Great, I have all your information. We'll now begin the interview. You'll have a specific time for each question.", isInfo: true });
        newCandidate.status = 'InProgress';
    }
    
    if (newCandidate.status === 'InProgress') {
        const { difficulty, time } = INTERVIEW_FLOW[0];
        const questionText = await generateQuestion(difficulty, []);
        const newQuestion: Question = { id: Date.now().toString() + '_qn', text: questionText, difficulty, time, answer: '', score: null, feedback: '' };
        newCandidate.questions.push(newQuestion);
        newMessages.push({ id: Date.now().toString() + '_qn_text', sender: 'ai', text: `Question 1/${TOTAL_QUESTIONS} (${difficulty}):\n\n${questionText}` });
        setTimeLeft(time);
    }

    newCandidate.chatHistory.push(...newMessages);

    setAppState(prev => ({
        ...prev,
        candidates: [...prev.candidates, newCandidate],
        activeCandidateId: newCandidate.id
    }));
    
    setIsLoading(false);
};

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    let text = '';
    const reader = new FileReader();

    const processFileText = async (fileText: string) => {
        try {
            await processResumeText(fileText);
        } catch (error) {
            console.error("Error processing resume text:", error);
            setIsLoading(false);
        }
    }

    if (file.type === 'application/pdf') {
        reader.onload = async (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const pdf = await pdfjsLib.getDocument({ data }).promise;
              let pdfText = '';
              for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const content = await page.getTextContent();
                  pdfText += content.items.map((item: any) => item.str).join(' ');
              }
              await processFileText(pdfText);
            } catch (error) {
              console.error("Error processing PDF:", error);
              setIsLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    } else { // DOCX
        reader.onload = async (e) => {
            try {
              const arrayBuffer = e.target?.result as ArrayBuffer;
              const result = await mammoth.extractRawText({ arrayBuffer });
              await processFileText(result.value);
            } catch(error) {
              console.error("Error processing DOCX:", error);
              setIsLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }
  };
  
  if (!activeCandidate) {
    return <div className="p-4"><ResumeUpload onUpload={handleFileUpload} loading={isLoading} /></div>;
  }

  const isInterviewInProgress = activeCandidate.status === 'InProgress' && activeCandidate.currentQuestionIndex < TOTAL_QUESTIONS;
  const currentQuestionTime = isInterviewInProgress ? activeCandidate.questions[activeCandidate.currentQuestionIndex]?.time : 0;

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg shadow-xl">
      <div className="flex-1 p-4 overflow-y-auto">
        {activeCandidate.chatHistory.map(msg => (
          <div key={msg.id} className={`flex items-start gap-3 my-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <BotIcon className="w-8 h-8 p-1.5 bg-indigo-600 text-white rounded-full flex-shrink-0" />}
            <div className={`max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-200'} whitespace-pre-wrap`}>
                {msg.text.includes('**') ? 
                  <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} /> : 
                  msg.text
                }
            </div>
            {msg.sender === 'user' && <PersonIcon className="w-8 h-8 p-1.5 bg-sky-600 text-white rounded-full flex-shrink-0" />}
          </div>
        ))}
        {isLoading && activeCandidate.status !== 'Completed' && (
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
            placeholder={activeCandidate.status === 'Completed' ? 'Interview has ended.' : 'Type your answer...'}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white disabled:opacity-50"
            disabled={isLoading || activeCandidate.status === 'Completed'}
          />
          {isInterviewInProgress && <Timer timeLeft={timeLeft} questionTime={currentQuestionTime} />}
          <button type="submit" className="bg-indigo-600 p-2 rounded-lg text-white hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed" disabled={isLoading || userInput.trim() === '' || activeCandidate.status === 'Completed'}>
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default IntervieweeView;