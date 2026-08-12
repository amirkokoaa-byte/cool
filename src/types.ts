export interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  suggestedQuestions?: string[];
  files?: File[];
}

export interface ChatResponse {
  answer: string;
  suggestedQuestions: string[];
}
