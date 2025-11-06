
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
          const patientProfile = await getUserProfile(report.patientId) as PatientProfile | null;
          if (patientProfile) {
            groups[report.patientId] = { patientProfile, reports: [] };
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
          lastUpdate: lastReport.createdAt ? formatDistanceToNow(new Date((lastReport.createdAt as any).seconds * 1000), { addSuffix: true }) : 'N/A',
          unreadCount: group.reports.filter(r => r.status === 'pending-doctor-review').length
        };
      });

      patientGroupsArray.sort((a, b) => {
          const timeA = (a.reports[0]?.createdAt as any)?.seconds || 0;
          const timeB = (b.reports[0]?.createdAt as any)?.seconds || 0;
          return timeB - timeA;
      });

      setPatientGroups(patientGroupsArray);
      
      if (patientGroupsArray.length > 0) {
        const currentSelectedId = selectedGroup?.patientProfile?.uid;
        const updatedSelectedGroup = currentSelectedId ? patientGroupsArray.find(g => g.patientProfile.uid === currentSelectedId) : patientGroupsArray[0];
        
        if(updatedSelectedGroup) {
            setSelectedGroup(updatedSelectedGroup);
            const currentReportId = selectedReport?.id;
            const updatedReport = currentReportId ? updatedSelectedGroup.reports.find(r => r.id === currentReportId) : updatedSelectedGroup.reports[0];
            setSelectedReport(updatedReport || updatedSelectedGroup.reports[0]);
        } else {
             const newSelectedGroup = patientGroupsArray[0];
             setSelectedGroup(newSelectedGroup);
             setSelectedReport(newSelectedGroup.reports[0] || null);
        }
      } else {
        setSelectedGroup(null);
        setSelectedReport(null);
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
    setSelectedReport(group.reports[0] || null);
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
    { href: '/doctor/dashboard', icon: LayoutGrid, title: 'Dashboard' },
    { href: '#', icon: User, title: 'Patients' },
    { href: '/doctor/calendar', icon: Calendar, title: 'Calendar' },
    { href: '/doctor/analytics', icon: BarChart, title: 'Reports' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];

  return (
    <div className="dashboard-container-v2">
        {/* Sidebar */}
        <div className="sidebar-v2">
            <Link href="/doctor/dashboard" className="logo-sidebar-v2">
                <div className="logo-icon-v2">M</div>
                MediScan AI
            </Link>
            
            <div className="sidebar-search-v2">
                <Search className="sidebar-search-icon-v2" size={18} />
                <input type="text" className="sidebar-search-input-v2" placeholder="Search patients..." />
            </div>

            <nav className="sidebar-nav-v2">
               {sidebarNavItems.map(item => (
                  <Link href={item.href} key={item.title} className={cn('nav-item-v2', { active: pathname === item.href })} title={item.title}>
                      <item.icon size={20} />
                      <span>{item.title}</span>
                      {item.title === 'Patients' && <span className="nav-item-badge-v2">2</span>}
                  </Link>
               ))}
            </nav>
            <div className="user-profile-v2">
                <div className="user-avatar-v2">{getPatientInitials(selectedGroup?.patientProfile.name)}</div>
                <div className="user-info-v2">
                    <div className="user-name">{selectedGroup?.patientProfile.name}</div>
                    <div className="user-reports">{selectedGroup?.reports.length} reports</div>
                </div>
                 {selectedGroup?.unreadCount > 0 && <div className="nav-item-badge-v2">{selectedGroup?.unreadCount}</div>}
            </div>
        </div>
        
        {/* Main Content Area */}
        <div className="main-content-v2">
          <header className="main-header-v2">
            <h1 className="main-title-v2">Dr. {doctorProfile?.name}'s Dashboard</h1>
            <p className="main-subtitle-v2">{patientGroups.reduce((acc, g) => acc + g.unreadCount, 0)} pending reviews</p>
          </header>

          {selectedGroup ? (
            <>
              <section className="reports-section-v2">
                <h2 className="reports-header-v2">Reports for {selectedGroup.patientProfile.name}</h2>
                <div className="report-tabs-v2">
                  {['All', 'Pending', 'Reviewed'].map(tab => (
                    <div key={tab} className={cn('report-tab-v2', {'active': filter === tab})} onClick={() => setFilter(tab)}>
                      {tab}
                    </div>
                  ))}
                </div>
                <div className="report-list-v2">
                  {selectedGroup.reports.map(report => (
                     <div key={report.id} className={cn("report-card-v2", { "active": selectedReport?.id === report.id })} onClick={() => setSelectedReport(report)}>
                        <div>
                          <p className="report-card-info-v2">{report.reportName}</p>
                          <p className="report-card-date-v2">{new Date((report.createdAt as any).seconds * 1000).toLocaleString()}</p>
                        </div>
                        <Badge variant={statusMap[report.status].variant} className={cn(statusMap[report.status].badgeClass, "text-xs")}>{statusMap[report.status].label}</Badge>
                     </div>
                  ))}
                </div>
              </section>

              {selectedReport && (
                <section className="report-detail-v2">
                    <div className="report-detail-header-v2">
                        <div className="report-detail-avatar-v2">{getPatientInitials(selectedGroup.patientProfile.name)}</div>
                        <div>
                            <h3 className="report-detail-name-v2">{selectedGroup.patientProfile.name}</h3>
                            <p className="report-detail-meta-v2">
                                Dermatology Case • Age: {selectedGroup.patientProfile.age} • {selectedGroup.patientProfile.gender}
                            </p>
                        </div>
                        <div className="report-detail-actions-v2">
                            <button className="report-detail-btn-v2"><MessageSquare size={16}/></button>
                            <button className="report-detail-btn-v2"><Phone size={16}/></button>
                        </div>
                    </div>
                    
                    {selectedReport.aiReport.doctorConsultationSuggestion && (
                    <div className="consultation-alert-v2">
                        <p className="consultation-alert-title-v2"><AlertTriangle className="inline-block mr-2" />Professional Consultation Required</p>
                        <p className="text-sm">Based on the analysis, we recommend sharing this report with a doctor.</p>
                    </div>
                    )}
                    
                    <div className="assessment-section-v2">
                      <h4 className="assessment-title-v2">Your Professional Assessment</h4>
                      <Textarea 
                        className="assessment-textarea-v2"
                        placeholder="Add your professional assessment, modifications, or additional recommendations..."
                        value={assessment}
                        onChange={(e) => setAssessment(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                </section>
              )}

            </>
          ) : (
             <div className="flex-1 flex items-center justify-center bg-gray-100 text-center rounded-lg">
                <div>
                  <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700">Select a patient case</h3>
                  <p className="text-gray-500">Choose a case from the list to view details, or wait for new cases to arrive.</p>
                </div>
            </div>
          )}
        </div>
    </div>
  );
}
