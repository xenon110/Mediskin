
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, Search, Settings, User, LogOut, FileText, Bot, Check, X, MessageSquare, LayoutGrid, Pill, Home, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { Report, getUserProfile, PatientProfile, DoctorProfile, updateReportByDoctor } from '@/lib/firebase-services';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';

type PatientGroup = {
    patientProfile: PatientProfile;
    reports: Report[];
    lastUpdate: string;
    unreadCount: number;
};

const statusMap: { [key in Report['status']]: { label: string; badgeClass: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } } = {
  'pending-doctor-review': { label: 'Pending', badgeClass: 'bg-amber-100 text-amber-800', variant: 'outline' },
  'doctor-approved': { label: 'Approved', badgeClass: 'bg-green-100 text-green-800', variant: 'default' },
  'doctor-modified': { label: 'Approved', badgeClass: 'bg-green-100 text-green-800', variant: 'default' },
  'rejected': { label: 'Rejected', badgeClass: 'bg-red-100 text-red-800', variant: 'destructive' },
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
  const [isLoading, setIsLoading] = useState(true);

  const [doctorNotes, setDoctorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
    // This query ensures doctors only see reports assigned to them
    const q = query(reportsRef, where('doctorId', '==', currentUser.uid), where('status', '==', 'pending-doctor-review'));

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
      }).filter(g => g.patientProfile);

      patientGroupsArray.sort((a, b) => {
          const timeA = (a.reports[0]?.createdAt as any)?.seconds || 0;
          const timeB = (b.reports[0]?.createdAt as any)?.seconds || 0;
          return timeB - timeA;
      });

      setPatientGroups(patientGroupsArray);
      
      const currentSelectedGroup = patientGroupsArray.find(g => g.patientProfile.uid === selectedGroup?.patientProfile.uid);
      
      if (currentSelectedGroup) {
         setSelectedGroup(currentSelectedGroup);
         const currentSelectedReport = currentSelectedGroup.reports.find(r => r.id === selectedReport?.id);
         setSelectedReport(currentSelectedReport || currentSelectedGroup.reports[0] || null);
      } else if (patientGroupsArray.length > 0) {
        const firstGroup = patientGroupsArray[0];
        setSelectedGroup(firstGroup);
        setSelectedReport(firstGroup.reports[0] || null);
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
      setDoctorNotes(selectedReport.doctorNotes || '');
    } else {
      setDoctorNotes('');
    }
  }, [selectedReport]);


  const handleSelectGroup = (group: PatientGroup) => {
    setSelectedGroup(group);
    // Select the first pending report in that group
    setSelectedReport(group.reports.find(r => r.status === 'pending-doctor-review') || group.reports[0] || null);
  };
  
  const handleSelectReport = (report: Report) => {
    setSelectedReport(report);
  }

  const handleSignOut = async () => {
    if (auth) {
        await auth.signOut();
        toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
        router.push('/login?role=doctor');
    }
  };

  const handleDecision = async (decision: 'doctor-approved' | 'rejected') => {
    if (!selectedReport || !selectedReport.id) {
        toast({ title: 'Error', description: 'No report selected.', variant: 'destructive'});
        return;
    }
    setIsSubmitting(true);
    try {
        await updateReportByDoctor(selectedReport.id, decision, doctorNotes);
        toast({ title: 'Success', description: `Report has been ${decision === 'doctor-approved' ? 'approved' : 'rejected'}.` });
        // The real-time listener will automatically update the UI
    } catch (e) {
        console.error("Failed to update report:", e);
        toast({ title: 'Error', description: 'Could not update the report status.', variant: 'destructive'});
    } finally {
        setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-light-gray">
        <Loader2 className="h-12 w-12 animate-spin text-lavender-blue" />
        <p className="ml-4 text-lg">Loading Patient Cases...</p>
      </div>
    );
  }

  const getPatientInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: MessageSquare, title: 'Dashboard' },
    { href: '/doctor/analytics', icon: LayoutGrid, title: 'Analytics' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];


  return (
    <div className="grid h-screen w-screen overflow-hidden main-content-bg" style={{gridTemplateColumns: '80px 1fr'}}>
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

        {/* Main Content */}
        <main className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 h-full overflow-hidden">
            {/* Patient List Column */}
            <div className="md:col-span-1 xl:col-span-1 border-r border-silver-gray h-full overflow-y-auto">
                <div className="p-4 sticky top-0 bg-light-gray z-10 border-b border-silver-gray">
                    <h2 className="text-xl font-bold text-dark-slate">Patient Queue</h2>
                    <p className="text-sm text-gray">{patientGroups.length} case(s) pending review</p>
                </div>
                <div className="p-2">
                    {patientGroups.length > 0 ? patientGroups.map((group) => (
                        <button 
                          key={group.patientProfile.uid} 
                          className={cn(
                            'w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors',
                            'patient-card',
                            { 'active': selectedGroup?.patientProfile.uid === group.patientProfile.uid }
                          )}
                          onClick={() => handleSelectGroup(group)}
                        >
                            <div className="relative">
                                <div className="patient-initial">
                                    {getPatientInitials(group.patientProfile?.name)}
                                </div>
                                {group.unreadCount > 0 && <span className="alert-badge">{group.unreadCount}</span>}
                            </div>
                            <div className="flex-1 truncate patient-info">
                                <div className="font-semibold patient-name">{group.patientProfile?.name || 'Unknown Patient'}</div>
                                <div className="text-xs patient-meta">{group.reports.length} report{group.reports.length > 1 ? 's' : ''} • {group.lastUpdate}</div>
                            </div>
                        </button>
                    )) : (
                      <div className="text-center p-8 text-gray">
                          <Inbox size={32} className="mx-auto mb-2" />
                          <p className="font-semibold">All clear!</p>
                          <p className="text-sm">There are no pending reports to review.</p>
                      </div>
                    )}
                </div>
            </div>

            {/* Report Details Column */}
            <div className="md:col-span-2 xl:col-span-3 h-full overflow-y-auto">
                {selectedGroup && selectedReport ? (
                    <div className="p-6 space-y-6">
                        {/* Patient Profile Card */}
                        <Card className="report-panel">
                            <CardHeader>
                                <CardTitle className="report-title">Patient Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="detail-grid">
                                    <div className="detail-item"><p className="detail-label">Name</p><p className="detail-value">{selectedGroup.patientProfile.name}</p></div>
                                    <div className="detail-item"><p className="detail-label">Age</p><p className="detail-value">{selectedGroup.patientProfile.age}</p></div>
                                    <div className="detail-item"><p className="detail-label">Gender</p><p className="detail-value">{selectedGroup.patientProfile.gender}</p></div>
                                    <div className="detail-item"><p className="detail-label">Region</p><p className="detail-value">{selectedGroup.patientProfile.region}</p></div>
                                    <div className="detail-item"><p className="detail-label">Skin Tone</p><p className="detail-value">{selectedGroup.patientProfile.skinTone}</p></div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {/* Report Selector */}
                         <Card className="report-panel">
                            <CardHeader>
                                <CardTitle className="report-title flex items-center gap-2"><History size={20}/> Case History</CardTitle>
                                <CardDescription>Select a report to view its details.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {selectedGroup.reports.map(report => (
                                    <button 
                                        key={report.id}
                                        onClick={() => handleSelectReport(report)}
                                        className={cn(
                                            "w-full text-left p-3 rounded-md flex justify-between items-center transition-colors report-item",
                                            selectedReport.id === report.id ? 'active' : ''
                                        )}
                                    >
                                        <div className="font-medium">{report.reportName}</div>
                                        <div className="text-xs text-gray">{new Date((report.createdAt as any).seconds * 1000).toLocaleString()}</div>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Report Details */}
                        <Card className="report-panel">
                            <CardHeader>
                                <CardTitle className="ai-report-title flex items-center gap-2">
                                    <Bot size={20} className="text-lavender-blue"/> AI Report: {selectedReport.reportName}
                                </CardTitle>
                                 <CardDescription>Case Submitted: {selectedReport.createdAt ? new Date((selectedReport.createdAt as any).seconds * 1000).toLocaleString() : 'N/A'}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                     <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-silver-gray">
                                        <Image src={selectedReport.photoDataUri || '/placeholder.svg'} alt="Patient's skin condition" layout="fill" objectFit="cover" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-dark-slate section-title">📝 Reported Symptoms</h3>
                                        <p className="text-sm text-gray mt-1">{selectedReport.aiReport.symptomInputs || "No additional symptoms were described by the patient."}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-dark-slate section-title flex items-center gap-2"><Pill/> Potential Conditions Identified by AI</h3>
                                        <div className="mt-2 space-y-2">
                                            {selectedReport.aiReport.potentialConditions.map((c, i) => (
                                                <div key={i} className="p-2 bg-light-gray rounded-md text-sm">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-medium">{c.name}</span>
                                                        <Badge variant={c.likelihood === 'High' ? 'destructive' : c.likelihood === 'Medium' ? 'secondary' : 'default'} className={
                                                          cn({
                                                            'bg-red/20 text-red': c.likelihood === 'High',
                                                            'bg-amber/20 text-amber': c.likelihood === 'Medium',
                                                            'bg-green/20 text-green': c.likelihood === 'Low',
                                                          })
                                                        }>
                                                            {c.likelihood}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-4 recommendation-box">
                                        <h4 className="font-semibold recommendation-title flex items-center gap-2"><Home size={16}/> AI Home Remedy Suggestion</h4>
                                        <p className="text-sm recommendation-text mt-1 whitespace-pre-wrap">{selectedReport.aiReport.homeRemedies}</p>
                                    </div>
                                    <div className="p-4 bg-amber text-dark-slate border-l-4 border-amber rounded">
                                        <h4 className="font-semibold section-title flex items-center gap-2"><FileText size={16}/> AI Medical Recommendation</h4>
                                        <p className="text-sm mt-1 whitespace-pre-wrap">{selectedReport.aiReport.medicalRecommendation}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Doctor's Action Card */}
                        <Card className="report-panel">
                            <CardHeader>
                                <CardTitle className="report-title">Doctor's Assessment & Action</CardTitle>
                                <CardDescription>Add your notes and approve or reject the AI's findings. Your notes will be visible to the patient.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Textarea 
                                    placeholder="Enter your key notes and assessment here..." 
                                    className="min-h-[120px] border-silver-gray focus:border-lavender-blue"
                                    value={doctorNotes}
                                    onChange={(e) => setDoctorNotes(e.target.value)}
                                />
                                <div className="flex justify-end gap-2 mt-4 action-buttons">
                                    <Button variant="destructive" className="btn bg-red text-white" onClick={() => handleDecision('rejected')} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : <X className="mr-2 h-4 w-4"/>} Reject
                                    </Button>
                                    <Button className="btn bg-success text-white" onClick={() => handleDecision('doctor-approved')} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Check className="mr-2 h-4 w-4"/>} Approve
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-center text-gray p-8">
                    <Inbox size={48} className="mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-dark-slate">Select a Patient</h3>
                    <p>Choose a patient from the list on the left to view their case details.</p>
                  </div>
                )}
            </div>
        </main>
    </div>
  );
}
