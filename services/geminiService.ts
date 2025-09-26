import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Question, Message } from '../types';

// Fix: Initialize the GoogleGenAI client directly with the API key from environment variables,
// assuming it is always present as per the guidelines. Removed fallback logic.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const extractInfoFromResume = async (resumeText: string): Promise<{ name: string | null; email: string | null; phone: string | null }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert HR assistant. Extract the full name, email address, and phone number from the following resume text. Respond ONLY with a valid JSON object with the keys "name", "email", and "phone". If a value is not found, set it to null. Resume Text: ${resumeText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Candidate's full name" },
            email: { type: Type.STRING, description: "Candidate's email address" },
            phone: { type: Type.STRING, description: "Candidate's phone number" },
          },
        },
      },
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error extracting info from resume:", error);
    return { name: null, email: null, phone: null };
  }
};

export const generateQuestion = async (difficulty: Difficulty, existingQuestions: string[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an expert technical interviewer for a full stack (React/Node.js) role. Generate one interview question with ${difficulty} difficulty. The question should be a single, clear question. Do not repeat any of the following questions: ${existingQuestions.join(', ')}`,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating question:", error);
    return "Error generating question. Please try again.";
  }
};

export const evaluateAnswer = async (question: string, answer: string): Promise<{ score: number; feedback: string }> => {
    if (!answer || answer.trim() === '') {
        return { score: 0, feedback: "Candidate did not provide an answer." };
    }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert technical interviewer. Evaluate the candidate's answer to the following question. Provide a score from 0 to 100 and brief feedback on the answer's correctness, clarity, and depth. Respond ONLY with a valid JSON object with the keys "score" (number) and "feedback" (string). Question: ${question}. Answer: ${answer}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Score from 0 to 100" },
            feedback: { type: Type.STRING, description: "Brief feedback on the answer" },
          },
          required: ["score", "feedback"],
        },
      },
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error evaluating answer:", error);
    return { score: 0, feedback: "AI evaluation failed." };
  }
};

export const summarizeInterview = async (candidateName: string, questions: Question[]): Promise<string> => {
    const transcript = questions.map(q => 
        `Q: ${q.text}\nA: ${q.answer || 'No answer'}\nScore: ${q.score}/100\nFeedback: ${q.feedback}`
    ).join('\n\n');

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an expert HR manager. Based on the following interview transcript, write a concise summary of the candidate's performance, highlighting their strengths and weaknesses. The candidate's name is ${candidateName}.\n\nTranscript:\n${transcript}`,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing interview:", error);
        return "Failed to generate interview summary.";
    }
};