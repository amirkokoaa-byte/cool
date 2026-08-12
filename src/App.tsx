import React, { useState, useRef, useEffect, useCallback } from "react";
import { Message, ChatResponse } from "./types";
import { cn } from "./lib/utils";
import { Send, Paperclip, Loader2, FileText, X, Bot, User, Settings, Mic, MicOff, Lock, UploadCloud, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Live Clock State
  const [time, setTime] = useState(new Date());
  
  // Speech Recognition State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const handleSendRef = useRef<any>(null);

  // Admin Panel & Auth State
  const [siteName, setSiteName] = useState("المساعد الذكي للموظفين");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  
  // Global Company Files (Admin uploaded)
  const [adminFiles, setAdminFiles] = useState<File[]>([]);
  const [isUploadingAdmin, setIsUploadingAdmin] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Load saved site name from localStorage
    const savedName = localStorage.getItem("companySiteName");
    if (savedName) setSiteName(savedName);

    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Initialize Web Speech API
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'ar-SA';

      recognition.onstart = () => {
        setIsRecording(true);
        transcriptRef.current = "";
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        transcriptRef.current = finalTranscript + interimTranscript;
        setInputValue(transcriptRef.current);
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
        // Auto-send when voice input is complete
        if (transcriptRef.current.trim() && handleSendRef.current) {
          handleSendRef.current(transcriptRef.current);
          transcriptRef.current = "";
        }
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => clearInterval(timer);
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setInputValue("");
      recognitionRef.current?.start();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSend = async (text: string = inputValue) => {
    if (!text.trim() && selectedFiles.length === 0) return;

    const currentFiles = [...selectedFiles];
    const currentInput = text;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: currentInput,
      files: currentFiles.length > 0 ? currentFiles : undefined,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue("");
    setSelectedFiles([]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", currentInput);
      
      // We only send previous history content to save bandwidth/tokens, excluding previous files for simplicity.
      const historyToSend = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      formData.append("history", JSON.stringify(historyToSend));

      // Append user files
      currentFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with server");
      }

      const data: ChatResponse = await response.json();

      const newModelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: data.answer,
        suggestedQuestions: data.suggestedQuestions,
      };

      setMessages((prev) => [...prev, newModelMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: "حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep a stable ref to the latest handleSend for the speech recognition callback
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Admin Authentication
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authPassword === "0000") {
      setShowAuthModal(false);
      setShowAdminPanel(true);
      setAuthError("");
      setAuthPassword("");
    } else {
      setAuthError("كلمة المرور غير صحيحة");
    }
  };

  // Admin Site Name Change
  const handleSiteNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setSiteName(newName);
    localStorage.setItem("companySiteName", newName);
  };

  // Admin File Drop & Upload Simulation
  const handleAdminFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAdminFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleAdminFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processAdminFiles(Array.from(e.target.files));
    }
  };

  const processAdminFiles = async (files: File[]) => {
    const validExtensions = ['.pdf', '.docx', '.xlsx', '.csv', '.txt'];
    const validFiles = files.filter(f => validExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));
    
    if (validFiles.length === 0) return;

    setIsUploadingAdmin(true);
    setUploadProgress(10); // Start progress

    try {
      const formData = new FormData();
      validFiles.forEach(file => formData.append("files", file));

      // Fake progress interval while waiting for fetch
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error("Failed to upload files");
      }
      
      setTimeout(() => {
        setAdminFiles(prevFiles => [...prevFiles, ...validFiles]);
        setIsUploadingAdmin(false);
        setUploadProgress(0);
      }, 500);
      
    } catch (error) {
      console.error(error);
      setIsUploadingAdmin(false);
      setUploadProgress(0);
      alert("حدث خطأ أثناء معالجة الملفات");
    }
  };

  const removeAdminFile = (index: number) => {
    setAdminFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formattedTime = time.toLocaleTimeString('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const formattedDate = time.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB] font-sans" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm z-10">
        {/* Right: Site Name & Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800">{siteName}</h1>
            <p className="text-xs sm:text-sm text-slate-500">مساعدك الداخلي للشركة</p>
          </div>
        </div>
        
        {/* Center: Live Date & Time */}
        <div className="hidden md:flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-slate-700">{formattedTime}</span>
          <span className="text-xs text-slate-400">{formattedDate}</span>
        </div>
        
        {/* Left: Settings */}
        <button 
          onClick={() => setShowAuthModal(true)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors" 
          title="الإعدادات"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full mt-20 text-center space-y-4">
              <div className="bg-blue-100 p-4 rounded-full">
                <Bot className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-700">مرحباً بك!</h2>
              <p className="text-slate-500 max-w-md">
                قم بطرح أسئلتك، وسأقوم بالبحث والإجابة بناءً على محتوى ملفات الشركة المعتمدة فقط.
              </p>
            </div>
          ) : (
            <div className="space-y-6 pb-20">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-[85%]",
                    msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      msg.role === "user" ? "bg-slate-200" : "bg-blue-600"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="w-6 h-6 text-slate-600" />
                    ) : (
                      <Bot className="w-6 h-6 text-white" />
                    )}
                  </div>
                  
                  <div className="space-y-2 flex-1">
                    <div
                      className={cn(
                        "p-4 rounded-2xl",
                        msg.role === "user"
                          ? "bg-white border border-slate-200 text-slate-800 rounded-tr-sm"
                          : "bg-blue-50 border border-blue-100 text-slate-800 rounded-tl-sm"
                      )}
                    >
                      {/* Attached Files display in user message */}
                      {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.files.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md text-sm border border-slate-200">
                              <FileText className="w-4 h-4 text-slate-500" />
                              <span className="truncate max-w-[150px] text-slate-700">{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </div>

                    {/* Suggested Questions */}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-slate-500">أسئلة مقترحة:</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.suggestedQuestions.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => handleSend(q)}
                              disabled={isLoading}
                              className="text-right text-sm bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4 max-w-[85%] ml-auto"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-slate-800 rounded-tl-sm flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-sm text-slate-600">جاري البحث في المستندات...</span>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Selected Files Preview */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 mb-3"
              >
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm border border-slate-200">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="truncate max-w-[150px] text-slate-700">{file.name}</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="ml-1 p-0.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex items-end gap-2 bg-white rounded-2xl border border-slate-300 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 p-2 transition-all">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0"
              title="إرفاق ملف إضافي"
            >
              <Paperclip className="w-6 h-6" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            />
            
            <button
              onClick={toggleRecording}
              className={cn(
                "p-2 rounded-xl transition-colors shrink-0",
                isRecording 
                  ? "text-red-500 bg-red-50 hover:bg-red-100 animate-pulse" 
                  : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
              )}
              title="تحدث باستخدام الميكروفون"
            >
              {isRecording ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "جاري الاستماع..." : "اطرح سؤالك هنا (اضغط Enter للإرسال)..."}
              className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none outline-none py-2 px-2 text-slate-800 placeholder:text-slate-400"
              rows={1}
            />

            <button
              onClick={() => handleSend()}
              disabled={(!inputValue.trim() && selectedFiles.length === 0) || isLoading}
              className="p-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-6 h-6 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                    <Lock className="w-5 h-5 text-blue-600" />
                    تسجيل الدخول للإدارة
                  </div>
                  <button onClick={() => { setShowAuthModal(false); setAuthError(""); }} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
                    <input 
                      type="password"
                      autoFocus
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="أدخل كلمة المرور..."
                    />
                  </div>
                  
                  {authError && (
                    <div className="flex items-center gap-1.5 text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {authError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors"
                  >
                    دخول
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xl">
                  <Settings className="w-6 h-6 text-blue-600" />
                  لوحة تحكم الإدارة
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm hover:shadow">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-8 flex-1">
                
                {/* Site Name Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">اسم المساعد (الموقع)</label>
                  <input 
                    type="text"
                    value={siteName}
                    onChange={handleSiteNameChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="مثال: المساعد الذكي للموظفين"
                  />
                  <p className="text-xs text-slate-500">يتم حفظ الاسم وتحديثه فوراً في الشريط العلوي.</p>
                </div>

                {/* API Key Security Display */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">مفتاح الذكاء الاصطناعي (API Key)</label>
                  <div className="relative">
                    <input 
                      type="password"
                      value="********************************"
                      disabled
                      className="w-full px-4 py-2.5 bg-green-50/50 border border-green-200 text-green-700 rounded-xl cursor-not-allowed opacity-80"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600 text-xs font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      مؤمن ومخفي بالسيرفر
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">مفتاح Gemini API مشفر ومخفي تماماً في الخلفية (Backend) لضمان أعلى معايير الأمان، ولا يمكن لأحد رؤيته.</p>
                </div>

                <hr className="border-slate-100" />

                {/* File Upload Zone */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">قاعدة بيانات الشركة (الملفات)</h3>
                    <p className="text-xs text-slate-500 mb-3">ستُستخدم هذه الملفات للإجابة على جميع استفسارات الموظفين.</p>
                  </div>

                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleAdminFileDrop}
                    onClick={() => adminFileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors",
                      isUploadingAdmin ? "border-slate-200 bg-slate-50 cursor-default" : "border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400"
                    )}
                  >
                    <input 
                      type="file" 
                      ref={adminFileInputRef} 
                      className="hidden" 
                      onChange={handleAdminFileSelect} 
                      multiple 
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      disabled={isUploadingAdmin}
                    />
                    
                    {isUploadingAdmin ? (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="text-blue-600 font-medium text-sm">جاري استخراج النصوص وتحويلها لمعلومات...</div>
                        <div className="w-full max-w-xs bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-200 ease-out" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-slate-500">{uploadProgress}%</div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-600">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <div className="text-slate-700 font-medium">اسحب وأفلت ملفات الشركة هنا</div>
                        <div className="text-slate-400 text-xs text-center px-4">
                          يدعم .pdf, .docx, .xlsx
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Uploaded Files List */}
                  {adminFiles.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        الملفات المعتمدة حالياً ({adminFiles.length}):
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {adminFiles.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm group">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-sm text-slate-700 font-medium truncate max-w-[150px] sm:max-w-[180px]" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeAdminFile(i); }}
                              className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowAdminPanel(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                  إغلاق وحفظ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

