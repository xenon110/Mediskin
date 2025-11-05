
'use client';

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Bot, CheckCircle, Loader2, Sparkles, Upload, Camera, Mic, Send, Stethoscope, FileText, Clock, User, LogOut, ArrowUp, File, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { collection, query, where, onSnapshot, Timestamp, orderBy, Unsubscribe } from 'firebase/firestore';

import { validateImageUpload } from '@/ai/flows/validate-image-upload';
import { symptomChat } from '@/ai/flows/symptom-chat';
import { generateInitialReport } from '@/ai/flows/generate-initial-report';
import { auth, db } from '@/lib/firebase';
import { getUserProfile, saveReport, Report, PatientProfile, logEmergency } from '@/lib/firebase-services';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ChatMessage {
  sender: 'ai' | 'user';
  text: string;
}

export default function PatientDashboard() {
  const { toast } = useToast();
  const router = useRouter();
  const [user, setUser] = useState<PatientProfile | null>(null);
  
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imageValidationError, setImageValidationError] = useState<string | null>(null);
  const [isImageValidating, setIsImageValidating] = useState(false);
  const [isImageReady, setIsImageReady] = useState(false);
  const [reportName, setReportName] = useState('');
  
  const [symptomInput, setSymptomInput] = useState('');
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'ai', text: "Hello! I'm your MEDISKIN AI assistant. Please upload an image and describe your symptoms. The more details you provide, the better I can assist you." }
  ]);

  const [recentReports, setRecentReports] = useState<Report[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let reportsUnsubscribe: Unsubscribe | undefined;
  
    const authUnsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          if (profile.role === 'doctor') {
            router.push('/doctor/dashboard');
            return;
          }
          setUser(profile as PatientProfile);

          if (db) {
            const reportsRef = collection(db, 'reports');
            const q = query(reportsRef, where('patientId', '==', firebaseUser.uid));
            
            reportsUnsubscribe = onSnapshot(q, (querySnapshot) => {
              let reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
              reports.sort((a, b) => {
                const timeA = (a.createdAt as any)?.seconds || 0;
                const timeB = (b.createdAt as any)?.seconds || 0;
                return timeB - timeA;
              });
              setRecentReports(reports);
            }, (error) => {
              console.error("Error fetching patient reports in real-time:", error);
              toast({ variant: "destructive", title: "Error", description: "Could not fetch your reports." });
            });
          }

        } else {
          router.push('/login?role=patient');
        }
      } else {
        router.push('/login?role=patient');
      }
    });

     setTimeout(() => {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        if(notification && notificationText) {
            notificationText.textContent = "🎉 Welcome to MEDISKIN AI! Upload an image to get started.";
            notification.style.display = 'flex';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 4000);
        }
    }, 1000);

    return () => {
      authUnsubscribe();
      if (reportsUnsubscribe) {
        reportsUnsubscribe();
      }
    };
  }, [router, toast]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReportName(file.name.split('.')[0] || `Report ${new Date().toLocaleDateString()}`);
    setIsImageValidating(true);
    setIsImageReady(false);
    setImageValidationError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const validation = await validateImageUpload({ photoDataUri: dataUrl });
        if (validation.isValid) {
          setImageDataUri(dataUrl);
          setIsImageReady(true);
          showNotification(`✅ File "${file.name}" uploaded successfully!`);
        } else {
          setImageValidationError(validation.reason || 'Invalid image.');
          setImageDataUri(null);
          showNotification(`❌ ${validation.reason || 'Invalid image.'}`, true);
        }
      } catch (error) {
        console.error(error);
        setImageValidationError('Validation error occurred.');
        showNotification('❌ Validation error occurred.', true);
      } finally {
        setIsImageValidating(false);
      }
    };
    reader.readAsDataURL(file);
  };
  
  const handleSymptomSubmit = async () => {
    if (!symptomInput.trim()) return;
    
    const userMessage = symptomInput.trim();
    const newChatHistory = [...chatHistory, { sender: 'user', text: userMessage }];
    setChatHistory(newChatHistory);
    setSymptomInput('');
    setIsChatbotLoading(true);

    try {
      const result = await symptomChat({ message: userMessage });
      setChatHistory(prev => [...prev, { sender: 'ai', text: result.response }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: "I'm sorry, I encountered an error. Please try again." }]);
      showNotification("🤖 I'm sorry, I encountered an error. Please try again.", true);
      console.error(error);
    } finally {
      setIsChatbotLoading(false);
    }
  };


  const handleAnalyze = async () => {
    if (!imageDataUri || !user?.uid) {
        showNotification("Please upload a valid image before analyzing.", true);
        return;
    }
    if (!reportName.trim()) {
      showNotification("Please provide a name for your report.", true);
      return;
    }

    setIsAnalyzing(true);
    showNotification("🔬 Starting comprehensive analysis...");
    
    const fullSymptomText = chatHistory
      .filter(m => m.sender === 'user')
      .map(m => m.text)
      .join('\n');

    try {
      const result = await generateInitialReport({
        photoDataUri: imageDataUri,
        symptomInputs: fullSymptomText || 'No symptoms described.',
        age: user.age || 30,
        gender: user.gender || 'not specified',
        region: user.region || 'not specified',
        skinTone: user.skinTone || 'not specified',
      });
      
      const savedReport = await saveReport(user.uid, reportName.trim(), result, imageDataUri);

      sessionStorage.setItem('latestReport', JSON.stringify(savedReport));

      showNotification("📊 Analysis Complete! Redirecting to your report...");
      
      router.push(`/patient/report`);

    } catch (error) {
      console.error(error);
      showNotification("Analysis Failed: An error occurred while analyzing your data.", true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusText = (status: Report['status']) => {
    switch (status) {
        case 'pending-doctor-review': return 'Pending Doctor Review';
        case 'doctor-approved': return 'Approved by Doctor';
        case 'doctor-modified': return 'Reviewed by Doctor';
        case 'rejected': return 'Disqualified by Doctor';
        case 'pending-patient-input': return 'Ready for Doctor Consultation';
        default: return 'Unknown Status';
    }
  };

  const formatReportDate = (createdAt: any): string => {
    if (!createdAt) {
        return 'Date not available';
    }
    if (typeof createdAt.toDate === 'function') {
        return createdAt.toDate().toLocaleDateString();
    }
    if (typeof createdAt.seconds === 'number') {
        return new Date(createdAt.seconds * 1000).toLocaleDateString();
    }
    try {
      const date = new Date(createdAt);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    } catch (e) {
      // ignore
    }
    return 'Invalid Date';
  };
  
  const handleEmergencyClick = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        await logEmergency(user.uid);
        showNotification('🚨 Emergency Logged. Please call your local emergency number for immediate assistance.', true);
      } catch (error) {
        console.error("Failed to log emergency:", error);
        showNotification('Could not log emergency. Please call for help directly.', true);
      }
    } else {
       showNotification('🚨 Please Log In to report an emergency.', true);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
        await auth.signOut();
        toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
        router.push('/login?role=patient');
    }
  };

  const showNotification = (text: string, isError = false) => {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    if (notification && notificationText) {
      notificationText.textContent = text;
      notification.style.background = isError ? 'linear-gradient(45deg, #ff4b2b, #ff416c)' : 'linear-gradient(45deg, #2edc76, #02e4a0)';
      notification.style.display = 'flex';
      setTimeout(() => {
        notification.style.display = 'none';
      }, 4000);
    }
  };

  const closeNotification = () => {
    const notification = document.getElementById('notification');
    if (notification) {
      notification.style.display = 'none';
    }
  };

  const toggleVoice = () => {
    setIsVoiceActive(!isVoiceActive);
    const btn = document.querySelector('.voice-btn');
    if (btn) {
        if (!isVoiceActive) {
            btn.innerHTML = '🔴';
            showNotification("🎤 Voice recording started");
        } else {
            btn.innerHTML = '🎤';
            showNotification("⏹️ Voice recording stopped");
        }
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center new-dashboard-bg">
        <Loader2 className="animate-spin text-white" size={48} />
      </div>
    );
  }

  const latestAiMessage = chatHistory.slice().reverse().find(m => m.sender === 'ai')?.text;

  return (
    <>
      <div className="container pt-24">
        {/* Header */}
        <header className="header">
            <div className="logo">
                <div className="logo-icon">🏥</div>
                <span>MEDISKIN</span>
            </div>
            <nav className="nav">
                <Link href="/#features">Features</Link>
                <Link href="/patient/my-info">My Info</Link>
                <Link href="/patient/reports">My Reports</Link>
                <Link href="/patient/consult">Consult</Link>
                <Link href="/help">Contact</Link>
                <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground hover:text-primary">
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </Button>
                <button className="emergency-btn" onClick={handleEmergencyClick}>🚨 Emergency</button>
            </nav>
        </header>

        {/* Main Content */}
        <div className="main-content">
            {/* Upload Skin Image */}
            <div className="card">
                <div className="card-title">
                    <div className="card-icon upload-icon">📷</div>
                    Upload Skin Image
                </div>
                <p className="card-subtitle">Upload a clear image of your skin condition for AI analysis.</p>
                
                <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                   {isImageValidating ? (
                        <>
                           <div className="upload-icon-large"><Loader2 className="animate-spin" /></div>
                           <div className="upload-text">Validating...</div>
                           <div className="upload-subtext">Please wait while we check your image.</div>
                        </>
                    ) : isImageReady ? (
                        <>
                           <div className="upload-icon-large" style={{background: 'linear-gradient(45deg, #2edc76, #02e4a0)'}}><CheckCircle/></div>
                           <div className="upload-text">Image Ready!</div>
                           <div className="upload-subtext">You can now describe symptoms or analyze.</div>
                        </>
                    ) : imageValidationError ? (
                         <>
                           <div className="upload-icon-large" style={{background: 'linear-gradient(45deg, #ff4b2b, #ff7849)'}}><Upload/></div>
                           <div className="upload-text text-red-600">{imageValidationError}</div>
                           <div className="upload-subtext">Please try another image.</div>
                        </>
                    ) : (
                        <>
                           <div className="upload-icon-large">⬆️</div>
                           <div className="upload-text">Click to upload or drag and drop</div>
                           <div className="upload-subtext">PNG, JPG up to 10MB</div>
                        </>
                    )}
                </div>
                <input type="file" id="fileInput" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload}/>
            
                {isImageReady && (
                    <div className="mt-4">
                        <label htmlFor="reportName" className="font-semibold text-gray-700">Report Name</label>
                        <Input
                            id="reportName"
                            type="text"
                            value={reportName}
                            onChange={(e) => setReportName(e.target.value)}
                            placeholder="e.g., 'Rash on my arm'"
                            className="mt-1"
                        />
                    </div>
                )}
            </div>

            {/* AI Assistant */}
            <div className="card ai-assistant">
                <div className="card-title">
                    <div className="card-icon ai-icon">🤖</div>
                    AI Assistant
                </div>
                <p className="card-subtitle">Chat with our AI to describe your symptoms.</p>
                
                <div className="ai-message">
                    <div className="ai-avatar">AI</div>
                    <p>{latestAiMessage}</p>
                </div>

                <div className="input-area">
                    <textarea 
                        className="symptom-input" 
                        placeholder="Describe your symptoms..."
                        value={symptomInput}
                        onChange={(e) => setSymptomInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSymptomSubmit();
                          }
                        }}
                    ></textarea>
                </div>

                <div className="input-actions">
                    <button className="voice-btn" onClick={toggleVoice}>🎤</button>
                    <button 
                      className="send-btn" 
                      onClick={handleSymptomSubmit}
                      disabled={isChatbotLoading || !symptomInput.trim()}
                    >
                      {isChatbotLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Send'}
                    </button>
                </div>

                <button 
                  className="analyze-btn mt-4" 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !isImageReady}
                >
                  {isAnalyzing ? <Loader2 className="animate-spin mx-auto" /> : <>✨ Analyze Now</>}
                </button>
            </div>
        </div>

        {/* Recent Reports */}
        <div className="reports-section">
            <div className="reports-title">
                <div className="reports-icon">📋</div>
                Recent Reports
            </div>
            <p className="card-subtitle">Review your past skin analysis reports.</p>
            
            {recentReports.length > 0 ? recentReports.map((report) => (
                <div key={report.id} className="report-item">
                    <div className="report-info">
                        <h3>{report.reportName || `Report from ${formatReportDate(report.createdAt)}`}</h3>
                        <div className="report-status">{getStatusText(report.status)}</div>
                    </div>
                    <button className="view-btn" onClick={() => {
                        sessionStorage.setItem('latestReport', JSON.stringify(report));
                        router.push('/patient/report');
                    }}>View Report</button>
                </div>
            )) : (
                <p className="text-center text-gray-500 py-8">No reports found.</p>
            )}
        </div>
      </div>
      <div id="notification" className="notification" style={{display: 'none'}}>
        <span>🔔</span>
        <span id="notificationText"></span>
        <button className="notification-close" onClick={closeNotification}>×</button>
      </div>
    </>
  );
}
