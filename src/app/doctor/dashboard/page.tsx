
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Paperclip, Send, CheckCircle, Pencil, Loader2, Inbox, XCircle, ThumbsUp, Search, Stethoscope, FileText, Edit3, MessageSquare, LayoutGrid, Calendar, Settings, User, Phone, MoreVertical, Star, Bot, Home, Pill, AlertTriangle, LogOut, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { Report, getUserProfile, PatientProfile, DoctorProfile, updateReportByDoctor } from '@/lib/firebase-services';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, onSnapshot, orderBy, Unsubscribe } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';


type PatientCase = Report & {
    time: string;
    unread: number;
};

const statusMap: { [key in Report['status']]: { label: string; badgeClass: string; } } = {
  'pending-doctor-review': { label: 'Pending', badgeClass: 'status-pending' },
  'doctor-approved': { label: 'Reviewed', badgeClass: 'status-reviewed' },
  'doctor-modified': { label: 'Reviewed', badgeClass: 'status-reviewed' },
  'rejected': { label: 'Disqualified', badgeClass: 'status-reviewed' },
  'pending-patient-input': { label: 'Draft', badgeClass: 'status-reviewed' },
};


export default function DoctorDashboard() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [patientCases, setPatientCases] = useState<PatientCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);
  const [filter, setFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  // State for doctor's response
  const [assessment, setAssessment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeResponseTab, setActiveResponseTab] = useState<'customize' | 'approve'>('customize');
  
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    const currentUser = auth.currentUser;

    if (!currentUser || !db) {
      // This should be handled by the layout now, but as a fallback.
      router.push('/login?role=doctor');
      return;
    }

    setIsLoading(true);

    getUserProfile(currentUser.uid).then(profile => {
      if (profile && profile.role === 'doctor') {
        setDoctorProfile(profile as DoctorProfile);
      }
    });

    const reportsRef = collection(db, 'reports');
    // Firestore security rules require that we can only query for reports where the doctorId is the current user's UID.
    const q = query(reportsRef, where('doctorId', '==', currentUser.uid));

    unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const casesPromises = querySnapshot.docs.map(async (doc) => {
        const report = { id: doc.id, ...doc.data() } as Report;
        if (!report.patientId) return null;

        const patientProfile = await getUserProfile(report.patientId) as PatientProfile | null;
        
        const patientName = patientProfile?.name;

        return {
          ...report,
          patientProfile: patientProfile ?? { name: 'Unknown Patient' } as PatientProfile,
          time: report.createdAt ? formatDistanceToNow(new Date((report.createdAt as any).seconds * 1000), { addSuffix: true }) : 'N/A',
          unread: report.status === 'pending-doctor-review' ? 1 : 0,
        };
      });

      let cases = (await Promise.all(casesPromises)).filter((c): c is PatientCase => c !== null);
      
      cases.sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds || 0;
        const timeB = (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
      });

      setPatientCases(cases);
      
      if (cases.length > 0) {
        const currentSelectedId = selectedCase?.id;
        const updatedSelectedCase = currentSelectedId ? cases.find(c => c.id === currentSelectedId) : undefined;
        const newSelectedCase = updatedSelectedCase || cases[0];
        
        if (newSelectedCase) {
          setSelectedCase(newSelectedCase);
          setAssessment(newSelectedCase.doctorNotes || '');
          if (newSelectedCase.status === 'doctor-approved') {
              setActiveResponseTab('approve');
          } else {
              setActiveResponseTab('customize');
          }
        }

      } else {
        setSelectedCase(null);
      }
      
      setIsLoading(false);

    }, (error) => {
      console.error("Error fetching reports in real-time:", error);
      if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
        toast({ title: 'Permissions Error', description: 'Missing or insufficient permissions. Please check your Firestore security rules.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'A problem occurred while fetching patient cases.', variant: 'destructive' });
      }
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router, toast, selectedCase?.id]);


  const handleSelectCase = (patientCase: PatientCase) => {
    setSelectedCase(patientCase);
    setAssessment(patientCase.doctorNotes || '');
    if (patientCase.status === 'doctor-approved') {
        setActiveResponseTab('approve');
    } else {
        setActiveResponseTab('customize');
    }
  };
  
  const filteredCases = patientCases.filter(p => {
    if (filter === 'All') return true;
    if (filter === 'Pending') return p.status === 'pending-doctor-review';
    if (filter === 'Reviewed') return ['doctor-approved', 'doctor-modified', 'rejected'].includes(p.status);
    return true;
  });

  const handleSendAssessment = async () => {
      if (!selectedCase) return;
      
      let newStatus: Report['status'];
      let notes = assessment;

      if (activeResponseTab === 'approve') {
          newStatus = 'doctor-approved';
          notes = assessment || 'The AI-generated report has been reviewed and approved.'
      } else { // 'customize'
          if (!assessment.trim()) {
              toast({ title: 'Assessment Required', description: 'Please write your assessment before sending.', variant: 'destructive' });
              return;
          }
          newStatus = 'doctor-modified';
      }

      setIsSubmitting(true);
      try {
          await updateReportByDoctor(selectedCase.id, newStatus, notes);
          toast({ title: 'Success', description: 'Your assessment has been sent to the patient.' });
      } catch (error) {
          console.error("Failed to send assessment:", error);
          toast({ title: 'Error', description: 'Could not send the assessment. Please try again.', variant: 'destructive' });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSignOut = async () => {
    if (auth) {
        await auth.signOut();
        toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
        router.push('/login?role=doctor');
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Patient Cases...</p>
      </div>
    );
  }

  const getPatientInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('');
  };
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: MessageSquare, title: 'Patient Cases' },
    { href: '/doctor/analytics', icon: LayoutGrid, title: 'Analytics' },
    { href: '#', icon: FileText, title: 'Documents' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];


  return (
    <div className="dashboard-container">
        {/* Sidebar */}
        <div className="sidebar">
            <Link href="/doctor/dashboard" className="logo-sidebar">M</Link>
            <nav className="sidebar-nav">
               {sidebarNavItems.map(item => (
                  <Link href={item.href} key={item.title} className={cn('nav-item', { active: pathname === item.href })} title={item.title}>
                      <item.icon size={24} />
                  </Link>
               ))}
            </nav>
            <div className="flex flex-col gap-2 items-center mt-auto">
                <Link href="/doctor/profile" className="user-profile" title="Dr. Profile">
                  <User size={24} />
                </Link>
                 <button onClick={handleSignOut} className="nav-item !w-10 !h-10" title="Sign Out">
                    <LogOut size={22} />
                </button>
            </div>
        </div>

        {/* Patient List Panel */}
        <div className="patient-list">
            <div className="list-header">
                <h2 className="text-xl font-bold text-gray-800">{doctorProfile ? `Dr. ${doctorProfile.name}'s Dashboard` : 'Doctor Dashboard'}</h2>
                <p className="text-sm text-gray-500">{patientCases.filter(p => p.status === 'pending-doctor-review').length} pending reviews</p>
            </div>

            <div className="search-bar">
                <Search className="search-icon" size={18} />
                <input type="text" className="search-input" placeholder="Search patients..." />
            </div>

            <div className="filter-tabs">
                {['All', 'Pending', 'Reviewed'].map(tab => (
                    <div 
                      key={tab} 
                      className={cn('filter-tab', { 'active': filter === tab })}
                      onClick={() => setFilter(tab)}
                    >
                        {tab}
                    </div>
                ))}
            </div>

            <div className="patients-container">
                {filteredCases.map((pCase) => (
                    <div 
                      key={pCase.id} 
                      className={cn('patient-item', { 'active': selectedCase?.id === pCase.id })}
                      onClick={() => handleSelectCase(pCase)}
                    >
                        <div className="patient-avatar">{getPatientInitials(pCase.patientProfile?.name)}</div>
                        <div className="patient-info">
                            <div className="patient-name">{pCase.patientProfile?.name || 'Unknown Patient'}</div>
                            <p className="patient-condition">Dermatology Case</p>
                            <p className="patient-time">{pCase.time}</p>
                        </div>
                        <div className="patient-status">
                            {statusMap[pCase.status] && <div className={cn('status-badge', statusMap[pCase.status].badgeClass)}>{statusMap[pCase.status].label}</div>}
                            {pCase.unread > 0 && <div className="unread-count">{pCase.unread}</div>}
                        </div>
                    </div>
                ))}
                 {filteredCases.length === 0 && !isLoading && (
                    <div className="text-center p-8 text-gray-500">
                        <Inbox size={32} className="mx-auto mb-2" />
                        <p>No {filter !== 'All' ? filter.toLowerCase() : ''} cases found.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Chat Panel */}
        {selectedCase && selectedCase.patientProfile ? (
          <div className="chat-panel">
            <div className="chat-header">
                <div className="chat-patient-info">
                    <div className="chat-avatar">{getPatientInitials(selectedCase.patientProfile.name)}</div>
                    <div className="chat-patient-details">
                        <h3 id="chat-patient-name">{selectedCase.patientProfile.name || 'Unknown Patient'}</h3>
                        <p id="chat-patient-condition">Dermatology Case • Age: {selectedCase.patientProfile.age || 'N/A'} • {selectedCase.patientProfile.gender || 'N/A'}</p>
                    </div>
                </div>
                <div className="chat-actions">
                    <button className="action-btn btn-secondary"><FileText size={14}/> History</button>
                    <button className="action-btn btn-primary"><Phone size={14} /> Call</button>
                </div>
            </div>

            <div className="chat-messages">
                <div className="message-group fade-in">
                    <div className="message-date">{selectedCase.time}</div>
                    
                    <div className="ai-report">
                        <div className="report-header">
                            <div className="ai-badge"><Bot size={14} className="inline mr-1" /> AI GENERATED REPORT</div>
                            <div className="report-title">Dermatological Analysis</div>
                        </div>

                        <div className="patient-details-section">
                            <div className="details-grid">
                                <div className="detail-item">
                                    <div className="detail-label">Patient Name</div>
                                    <div className="detail-value">{selectedCase.patientProfile.name || 'N/A'}</div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label">Age</div>
                                    <div className="detail-value">{selectedCase.patientProfile.age || 'N/A'} years</div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label">Gender</div>
                                    <div className="detail-value">{selectedCase.patientProfile.gender || 'N/A'}</div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label">Region</div>
                                    <div className="detail-value">{selectedCase.patientProfile.region || 'N/A'}</div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label">Skin Tone</div>
                                    <div className="detail-value">{selectedCase.patientProfile.skinTone || 'N/A'}</div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label">Submitted</div>
                                    <div className="detail-value">{selectedCase.createdAt && (selectedCase.createdAt as any).seconds ? new Date((selectedCase.createdAt as any).seconds * 1000).toLocaleString() : 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="symptoms-list">
                            <div className="symptoms-title">Reported Symptoms:</div>
                            <div className="symptoms-content">{selectedCase.aiReport.symptomInputs}</div>
                        </div>

                        {selectedCase.photoDataUri && (
                            <div className="image-analysis">
                                <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2"><Camera /> Uploaded Skin Image</h4>
                                <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
                                    <Image src={selectedCase.photoDataUri} alt="Patient's skin condition" layout="fill" objectFit="contain" />
                                </div>
                            </div>
                        )}


                        <div className="analysis-sections">
                             <div className="analysis-section">
                                <h4 className="section-title text-green-600">
                                    <Home size={18} /> Home Remedies Recommendation
                                </h4>
                                <div className="section-content whitespace-pre-wrap">
                                   {selectedCase.aiReport.homeRemedies}
                                </div>
                            </div>

                            <div className="analysis-section medical">
                                <h4 className="section-title text-amber-600">
                                    <Pill size={18} /> Medical Recommendation
                                </h4>
                                <div className="section-content whitespace-pre-wrap">
                                   {selectedCase.aiReport.medicalRecommendation}
                                </div>
                            </div>

                           {selectedCase.aiReport.doctorConsultationSuggestion && (
                             <div className="analysis-section consultation">
                                <h4 className="section-title text-red-600">
                                    <AlertTriangle size={18}/> Professional Consultation Required
                                </h4>
                                <div className="section-content">
                                    Based on the analysis, we recommend sharing this report with a doctor.
                                </div>
                            </div>
                           )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="doctor-response">
                <div className="response-header">
                    <h3 className="response-title">Your Professional Assessment</h3>
                    <div className="response-actions">
                        <button className={cn('quick-action', {'active': activeResponseTab === 'approve'})} onClick={() => setActiveResponseTab('approve')}>✅ Approve AI Report</button>
                        <button className={cn('quick-action', {'active': activeResponseTab === 'customize'})} onClick={() => setActiveResponseTab('customize')}>✏️ Customize</button>
                        <button className="quick-action" onClick={() => setAssessment('The submitted image is unclear. Please provide a clearer photo of the affected area.')}>❓ Request More Info</button>
                    </div>
                </div>

                <textarea 
                    className="response-editor" 
                    placeholder="Add your professional assessment, modifications, or additional recommendations..."
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                    disabled={isSubmitting}
                />
                
                <div className="editor-toolbar">
                   <div className="file-upload">
                        <Paperclip size={16}/>
                        <span>Attach Prescription</span>
                   </div>
                   <button className="send-response" onClick={handleSendAssessment} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <>Send Assessment &rarr;</>}
                    </button>
                </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 text-center">
            <div>
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">Select a patient case</h3>
              <p className="text-gray-500">Choose a case from the list to view details, or wait for new cases to arrive.</p>
            </div>
          </div>
        )}
    </div>
  );
}
