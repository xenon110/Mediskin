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
    { href: '/doctor/analytics', icon: MessageSquare, title: 'Reports' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];

  return (
    <div className="dashboard-container-v3">
        {/* Sidebar */}
        <div className="sidebar-v3">
            <Link href="/doctor/dashboard" className="logo-sidebar-v3">
                <div className="logo-icon-v3">M</div>
                MediScan
            </Link>
            
            <nav className="sidebar-nav-v3">
               {sidebarNavItems.map(item => (
                  <Link href={item.href} key={item.title} className={cn('nav-item-v3', { active: pathname === item.href })} title={item.title}>
                      <item.icon size={20} />
                  </Link>
               ))}
            </nav>

            <div className="flex flex-col gap-2 items-center mt-auto">
                 <Link href="/doctor/profile" className="user-profile-v3" title="My Profile">
                   <User size={24} />
                 </Link>
                 <button onClick={handleSignOut} className="nav-item-v3 !w-10 !h-10" title="Sign Out">
                    <LogOut size={22} />
                </button>
            </div>
        </div>
        
        {/* Patient List Panel */}
        <div className="patient-list-panel-v3">
            <header className="patient-list-header-v3">
                <div>
                    <h1 className="patient-list-title-v3">Dr. {doctorProfile?.name}'s Dashboard</h1>
                    <p className="patient-list-subtitle-v3">{patientGroups.reduce((acc, g) => acc + g.unreadCount, 0)} pending reviews</p>
                </div>
            </header>
             <div className="patient-search-v3">
                <Search className="patient-search-icon-v3" size={18} />
                <input type="text" className="patient-search-input-v3" placeholder="Search patients..." />
            </div>
            
             <div className="flex items-center p-2 space-x-2 bg-gray-100 m-4 rounded-lg">
                <Button size="sm" variant={filter === 'All' ? 'default' : 'ghost'} onClick={() => setFilter('All')} className="flex-1">All</Button>
                <Button size="sm" variant={filter === 'Pending' ? 'default' : 'ghost'} onClick={() => setFilter('Pending')} className="flex-1">Pending</Button>
                <Button size="sm" variant={filter === 'Reviewed' ? 'default' : 'ghost'} onClick={() => setFilter('Reviewed')} className="flex-1">Reviewed</Button>
             </div>

            <div className="patient-list-v3">
                {filteredGroups.map(group => (
                    <div key={group.patientProfile.uid} className={cn("patient-card-v3", {"active": selectedGroup?.patientProfile.uid === group.patientProfile.uid})} onClick={() => handleSelectGroup(group)}>
                        <div className="patient-avatar-v3">{getPatientInitials(group.patientProfile.name)}</div>
                        <div className="patient-info-v3">
                            <div className="patient-name-v3">{group.patientProfile.name}</div>
                            <div className="patient-last-update-v3">{group.reports.length} reports • {group.lastUpdate}</div>
                        </div>
                        {group.unreadCount > 0 && <div className="patient-unread-badge-v3">{group.unreadCount}</div>}
                    </div>
                ))}
            </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content-v3">
          {selectedGroup && selectedReport ? (
              <div className="report-details-wrapper-v3">
                  <header className="report-header-v3">
                      <h2 className="report-title-v3">Reports for {selectedGroup.patientProfile.name}</h2>
                  </header>

                   <div className="report-content-grid-v3">
                       {/* Left side: Report list and details */}
                       <div className="report-column-v3">
                           <div className="report-list-container-v3">
                            <h3 className="text-md font-semibold text-gray-600 px-2 pb-2">Pending Reports ({selectedGroup.reports.filter(r => r.status === 'pending-doctor-review').length})</h3>
                             {selectedGroup.reports.filter(r => r.status === 'pending-doctor-review').map(report => (
                               <div key={report.id} className={cn("report-item-v3", {"active": report.id === selectedReport.id})} onClick={() => setSelectedReport(report)}>
                                   <div className="flex-1">
                                    <p className="report-item-name-v3">{report.reportName}</p>
                                    <p className="text-xs text-gray-500">{new Date((report.createdAt as any).seconds * 1000).toLocaleString()}</p>
                                   </div>
                                   <Badge variant={statusMap[report.status].variant} className={cn(statusMap[report.status].badgeClass, "text-xs")}>{statusMap[report.status].label}</Badge>
                               </div>
                             ))}
                           </div>

                           <div className="report-analysis-v3">
                                <h3 className="section-title-v3">{selectedReport.reportName}</h3>
                                {selectedReport.aiReport.doctorConsultationSuggestion && (
                                    <div className="consultation-alert-v3">
                                        <AlertTriangle size={16} /> Professional Consultation Required
                                    </div>
                                )}
                                
                                <div className="p-4 bg-gray-50 rounded-lg mb-4">
                                    <h4 className="font-semibold text-sm mb-2 text-gray-600">Patient Details</h4>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <div><strong className="text-gray-500">Name:</strong> {selectedGroup.patientProfile.name}</div>
                                        <div><strong className="text-gray-500">Age:</strong> {selectedGroup.patientProfile.age}</div>
                                        <div><strong className="text-gray-500">Gender:</strong> {selectedGroup.patientProfile.gender}</div>
                                        <div><strong className="text-gray-500">Region:</strong> {selectedGroup.patientProfile.region}</div>
                                        <div><strong className="text-gray-500">Skin Tone:</strong> {selectedGroup.patientProfile.skinTone}</div>
                                    </div>
                                </div>
                                
                                <h4 className="font-semibold text-sm mb-2 text-gray-600">Reported Symptoms</h4>
                                <p className="analysis-text-v3 mb-4">{selectedReport.aiReport.symptomInputs || "No symptoms reported."}</p>

                                <h4 className="font-semibold text-sm mb-2 text-gray-600">Home Remedies</h4>
                                <p className="analysis-text-v3 mb-4">{selectedReport.aiReport.homeRemedies}</p>
                                
                                {selectedReport.photoDataUri && (
                                  <div className="mt-4">
                                      <h4 className="font-semibold text-sm mb-2 text-gray-600">Uploaded Image</h4>
                                      <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden border">
                                          <Image src={selectedReport.photoDataUri} alt="Patient's skin condition" layout="fill" objectFit="cover" />
                                      </div>
                                  </div>
                                )}
                           </div>
                       </div>
                       
                       {/* Right side: Doctor's assessment */}
                       <div className="assessment-column-v3">
                           <h3 className="section-title-v3">Your Professional Assessment</h3>
                           <Textarea 
                              className="assessment-textarea-v3"
                              placeholder="Add your professional assessment, modifications, or additional recommendations..."
                              value={assessment}
                              onChange={(e) => setAssessment(e.target.value)}
                              disabled={isSubmitting}
                            />
                            <div className="flex items-center gap-2 mt-4">
                                <Button size="sm" onClick={handleSendAssessment} disabled={isSubmitting}>
                                  {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Send size={16} className="mr-2"/>}
                                  Send Assessment
                                </Button>
                                 <Button size="sm" variant="outline" onClick={() => setActiveResponseTab('approve')} disabled={isSubmitting}>
                                  Approve AI Report
                                </Button>
                            </div>
                       </div>
                   </div>
              </div>
          ) : (
             <div className="flex-1 flex items-center justify-center bg-gray-50 text-center rounded-lg">
                <div>
                  <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700">Select a patient case</h3>
                  <p className="text-gray-500">Choose a case from the list to view details.</p>
                </div>
            </div>
          )}
        </div>
    </div>
  );
}
