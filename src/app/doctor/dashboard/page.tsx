'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Paperclip, Send, CheckCircle, Pencil, Loader2, Inbox, XCircle, ThumbsUp, Search, Stethoscope, FileText, Edit3, MessageSquare, LayoutGrid, Calendar, Settings, User, Phone, MoreVertical, Star, Bot, Home, Pill, AlertTriangle, LogOut, Camera, ArrowLeft } from 'lucide-react';
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

type PatientGroup = {
    patientProfile: PatientProfile;
    reports: Report[];
    lastUpdate: string;
    unreadCount: number;
};

const statusMap: { [key in Report['status']]: { label: string; badgeClass: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } } = {
  'pending-doctor-review': { label: 'Pending', badgeClass: 'bg-blue-100 text-blue-800', variant: 'outline' },
  'doctor-approved': { label: 'Reviewed', badgeClass: 'bg-green-100 text-green-800', variant: 'default' },
  'doctor-modified': { label: 'Reviewed', badgeClass: 'bg-green-100 text-green-800', variant: 'default' },
  'rejected': { label: 'Disqualified', badgeClass: 'bg-red-100 text-red-800', variant: 'destructive' },
  'pending-patient-input': { label: 'Draft', badgeClass: 'bg-gray-100 text-gray-800', variant: 'secondary' },
};


export default function DoctorDashboard() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [patientGroups, setPatientGroups] = useState<PatientGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PatientGroup | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
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
    const q = query(reportsRef, where('doctorId', '==', currentUser.uid));

    unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const reportsPromises = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      const allReports = await Promise.all(reportsPromises);

      const groups: { [patientId: string]: { patientProfile: PatientProfile; reports: Report[] } } = {};

      for (const report of allReports) {
        if (!report.patientId) continue;
        
        if (!groups[report.patientId]) {
          try {
            const patientProfile = await getUserProfile(report.patientId) as PatientProfile | null;
            if (patientProfile) {
              groups[report.patientId] = { patientProfile, reports: [] };
            }
          } catch (e) {
             console.error(`Could not fetch profile for patient ${report.patientId}`, e);
          }
        }
        if (groups[report.patientId]) {
          groups[report.patientId].reports.push(report);
        }
      }

      const patientGroupsArray: PatientGroup[] = Object.values(groups).map(group => {
        group.reports.sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0));
        const lastReport = group.reports[0];
        return {
          ...group,
          lastUpdate: lastReport?.createdAt ? formatDistanceToNow(new Date((lastReport.createdAt as any).seconds * 1000), { addSuffix: true }) : 'N/A',
          unreadCount: group.reports.filter(r => r.status === 'pending-doctor-review').length
        };
      }).filter(g => g.patientProfile); // Filter out groups where profile might be null

      patientGroupsArray.sort((a, b) => {
          const timeA = (a.reports[0]?.createdAt as any)?.seconds || 0;
          const timeB = (b.reports[0]?.createdAt as any)?.seconds || 0;
          return timeB - timeA;
      });

      setPatientGroups(patientGroupsArray);
      
      if (!selectedGroup && patientGroupsArray.length > 0) {
        const firstGroup = patientGroupsArray[0];
        setSelectedGroup(firstGroup);
        setSelectedReport(firstGroup.reports.find(r => r.status === 'pending-doctor-review') || firstGroup.reports[0] || null);
      } else if (selectedGroup) {
        // Refresh selected group data
        const refreshedGroup = patientGroupsArray.find(g => g.patientProfile.uid === selectedGroup.patientProfile.uid);
        if(refreshedGroup) {
          setSelectedGroup(refreshedGroup);
          if (selectedReport) {
            const refreshedReport = refreshedGroup.reports.find(r => r.id === selectedReport.id);
            setSelectedReport(refreshedReport || refreshedGroup.reports[0] || null);
          } else {
            setSelectedReport(refreshedGroup.reports[0] || null);
          }
        } else {
          // If selected group is gone, select first group
          const firstGroup = patientGroupsArray[0];
          setSelectedGroup(firstGroup || null);
          setSelectedReport(firstGroup?.reports[0] || null);
        }
      }
      
      setIsLoading(false);

    }, (error) => {
      console.error("Error fetching reports in real-time:", error);
      toast({ title: 'Error', description: 'A problem occurred while fetching patient cases.', variant: 'destructive' });
      setIsLoading(false);
    });

    return () => unsubscribe && unsubscribe();
  }, [router, toast]);
  
  useEffect(() => {
    if (selectedReport) {
      setAssessment(selectedReport.doctorNotes || '');
      if (selectedReport.status === 'doctor-approved') {
          setActiveResponseTab('approve');
      } else {
          setActiveResponseTab('customize');
      }
    }
  }, [selectedReport]);


  const handleSelectGroup = (group: PatientGroup) => {
    setSelectedGroup(group);
    // When a new patient is selected, default to the first pending report, or the first report overall
    setSelectedReport(group.reports.find(r => r.status === 'pending-doctor-review') || group.reports[0] || null);
  };
  
  const filteredGroups = patientGroups.filter(g => {
    if (filter === 'All') return true;
    if (filter === 'Pending') return g.unreadCount > 0;
    if (filter === 'Reviewed') return g.reports.some(r => ['doctor-approved', 'doctor-modified', 'rejected'].includes(r.status));
    return true;
  });

  const handleSendAssessment = async () => {
      if (!selectedReport) return;
      
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
          await updateReportByDoctor(selectedReport.id, newStatus, notes);
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
    { href: '/doctor/analytics', icon: LayoutGrid, title: 'Analytics' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];
  const MainChatPanel = () => {
      if(!selectedReport) {
        return (
             <div className="flex-1 flex items-center justify-center bg-gray-50 text-center">
              <div>
                <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700">Select a report</h3>
                <p className="text-gray-500">Choose a report from the list to view its details.</p>
              </div>
            </div>
        )
      }

      return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="chat-header">
                 <div className="chat-patient-info">
                    {selectedGroup && (
                        <>
                            <div className="chat-avatar">{getPatientInitials(selectedGroup.patientProfile.name)}</div>
                            <div className="chat-patient-details">
                                <h3 id="chat-patient-name">{selectedGroup.patientProfile.name || 'Unknown Patient'}</h3>
                                <p id="chat-patient-condition">Dermatology Case • Age: {selectedGroup.patientProfile.age || 'N/A'} • {selectedGroup.patientProfile.gender || 'N/A'}</p>
                            </div>
                        </>
                    )}
                 </div>
                <div className="chat-actions">
                    <button className="action-btn btn-secondary"><FileText size={14}/> History</button>
                    <button className="action-btn btn-primary"><Phone size={14} /> Call</button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
                <div className="chat-messages">
                    <div className="message-group fade-in">
                        <div className="message-date">{selectedReport.createdAt ? formatDistanceToNow(new Date((selectedReport.createdAt as any).seconds * 1000), { addSuffix: true }) : 'N/A'}</div>
                        
                        <div className="ai-report">
                            <div className="report-header">
                                <div className="ai-badge"><Bot size={14} className="inline mr-1" /> AI GENERATED REPORT</div>
                                <div className="report-title">{selectedReport.reportName || 'Dermatological Analysis'}</div>
                            </div>
                            <div className="patient-details-section">
                                <div className="details-grid">
                                    <div className="detail-item">
                                        <div className="detail-label">Patient Name</div>
                                        <div className="detail-value">{selectedGroup?.patientProfile.name || 'N/A'}</div>
                                    </div>
                                    <div className="detail-item">
                                        <div className="detail-label">Age</div>
                                        <div className="detail-value">{selectedGroup?.patientProfile.age || 'NA'} years</div>
                                    </div>
                                    <div className="detail-item">
                                        <div className="detail-label">Gender</div>
                                        <div className="detail-value">{selectedGroup?.patientProfile.gender || 'N/A'}</div>
                                    </div>
                                    <div className="detail-item">
                                        <div className="detail-label">Region</div>
                                        <div className="detail-value">{selectedGroup?.patientProfile.region || 'N/A'}</div>
                                    </div>
                                    <div className="detail-item">
                                        <div className="detail-label">Skin Tone</div>
                                        <div className="detail-value">{selectedGroup?.patientProfile.skinTone || 'N/A'}</div>
                                    </div>
                                    <div className="detail-item">
                                        <div className="detail-label">Submitted</div>
                                        <div className="detail-value">{selectedReport.createdAt && (selectedReport.createdAt as any).seconds ? new Date((selectedReport.createdAt as any).seconds * 1000).toLocaleString() : 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="symptoms-list">
                                <div className="symptoms-title">Reported Symptoms:</div>
                                <div className="symptoms-content">{selectedReport.aiReport.symptomInputs}</div>
                            </div>
                            {selectedReport.photoDataUri && (
                                <div className="image-analysis">
                                    <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2"><Camera /> Uploaded Skin Image</h4>
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
                                        <Image src={selectedReport.photoDataUri} alt="Patient's skin condition" layout="fill" objectFit="contain" />
                                    </div>
                                </div>
                            )}
                            <div className="analysis-sections">
                                <div className="analysis-section">
                                    <h4 className="section-title text-green-600">
                                        <Home size={18} /> Home Remedies Recommendation
                                    </h4>
                                    <div className="section-content whitespace-pre-wrap">
                                    {selectedReport.aiReport.homeRemedies}
                                    </div>
                                </div>
                                <div className="analysis-section medical">
                                    <h4 className="section-title text-amber-600">
                                        <Pill size={18} /> Medical Recommendation
                                    </h4>
                                    <div className="section-content whitespace-pre-wrap">
                                    {selectedReport.aiReport.medicalRecommendation}
                                    </div>
                                </div>
                            {selectedReport.aiReport.doctorConsultationSuggestion && (
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
        </div>
      );
  }

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
                <h2 className="list-title">{doctorProfile ? `Dr. ${doctorProfile.name}'s Dashboard` : 'Doctor Dashboard'}</h2>
                <p className="list-subtitle">{patientGroups.reduce((acc, g) => acc + g.unreadCount, 0)} pending reviews</p>
            </div>

            <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input type="text" className="search-input" placeholder="Search patients..." />
            </div>

            <div className="filter-tabs">
                <div className={cn('filter-tab', {'active': filter === 'All'})} onClick={() => setFilter('All')}>All</div>
                <div className={cn('filter-tab', {'active': filter === 'Pending'})} onClick={() => setFilter('Pending')}>Pending</div>
                <div className={cn('filter-tab', {'active': filter === 'Reviewed'})} onClick={() => setFilter('Reviewed')}>Reviewed</div>
            </div>

            <div className="patients-container">
                {filteredGroups.map((group) => (
                    <div 
                      key={group.patientProfile.uid} 
                      className={cn('patient-item', { 'active': selectedGroup?.patientProfile.uid === group.patientProfile.uid })}
                      onClick={() => handleSelectGroup(group)}
                    >
                        <div className="patient-avatar">{getPatientInitials(group.patientProfile?.name)}</div>
                        <div className="patient-info">
                            <div className="patient-name">{group.patientProfile?.name || 'Unknown Patient'}</div>
                            <div className="patient-condition">{group.reports.length} report{group.reports.length > 1 ? 's' : ''}</div>
                            <div className="patient-time">{group.lastUpdate}</div>
                        </div>
                        <div className="patient-status">
                            {group.unreadCount > 0 && <div className="unread-count">{group.unreadCount}</div>}
                        </div>
                    </div>
                ))}
                 {filteredGroups.length === 0 && !isLoading && (
                    <div className="text-center p-8 text-gray-500">
                        <Inbox size={32} className="mx-auto mb-2" />
                        <p>No {filter !== 'All' ? filter.toLowerCase() : ''} patient cases found.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Chat Panel */}
        {selectedGroup ? (
          <div className="chat-panel">
            <div className="p-4 border-b">
                 <h3 className="font-semibold text-lg">Reports for {selectedGroup.patientProfile.name}</h3>
            </div>
            <div className="flex-1 flex min-h-0">
                 <div className="w-1/3 border-r overflow-y-auto">
                    {selectedGroup.reports.map(report => (
                         <div
                           key={report.id}
                           className={cn("p-4 border-b cursor-pointer hover:bg-gray-50", { "bg-blue-50": selectedReport?.id === report.id })}
                           onClick={() => setSelectedReport(report)}
                         >
                            <div className="font-semibold">{report.reportName}</div>
                            <div className="text-xs text-gray-500">{report.createdAt ? new Date((report.createdAt as any).seconds * 1000).toLocaleString() : ''}</div>
                            <Badge variant={(statusMap[report.status] || statusMap['pending-patient-input']).variant} className={cn((statusMap[report.status] || statusMap['pending-patient-input']).badgeClass, "mt-1")}>
                                {statusMap[report.status]?.label || 'Unknown'}
                            </Badge>

                         </div>
                    ))}
                 </div>
                 <div className="w-2/3 flex flex-col">
                    <MainChatPanel />
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
