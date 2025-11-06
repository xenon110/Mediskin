
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
    setSelectedReport(group.reports[0] || null);
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
    } catch (e) {
        console.error("Failed to update report:", e);
        toast({ title: 'Error', description: 'Could not update the report status.', variant: 'destructive'});
    } finally {
        setIsSubmitting(false);
    }
  }

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
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: MessageSquare, title: 'Patient Cases' },
    { href: '/doctor/analytics', icon: LayoutGrid, title: 'Analytics' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];


  return (
    <div className="grid h-screen w-screen grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <div className="hidden border-r bg-muted/40 md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <Bot className="h-6 w-6" />
                        <span>Doctor Portal</span>
                    </Link>
                </div>
                <div className="flex-1">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {sidebarNavItems.map(item => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                                    { 'bg-muted text-primary': pathname === item.href }
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="mt-auto p-4 border-t">
                     <div className="flex items-center gap-2 mb-4">
                        <div className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-600">
                             <span className="font-medium text-gray-600 dark:text-gray-300">{getPatientInitials(doctorProfile?.name)}</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{doctorProfile?.name || 'Doctor'}</p>
                            <p className="text-xs text-muted-foreground">{doctorProfile?.email}</p>
                        </div>
                     </div>
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </div>
        </div>

        {/* Main Content */}
        <main className="grid h-full grid-cols-1 overflow-hidden xl:grid-cols-3">
            {/* Patient List Column */}
            <div className="border-r bg-muted/40 xl:col-span-1">
                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search patients..." className="pl-8" />
                    </div>
                </div>
                <div className="flex h-[calc(100vh-120px)] flex-col gap-2 overflow-y-auto p-2">
                    {patientGroups.length > 0 ? patientGroups.map((group) => (
                        <button 
                          key={group.patientProfile.uid} 
                          className={cn(
                            'w-full rounded-lg p-3 text-left transition-all hover:bg-accent',
                            { 'bg-accent': selectedGroup?.patientProfile.uid === group.patientProfile.uid }
                          )}
                          onClick={() => handleSelectGroup(group)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-600">
                                    <span className="font-medium text-gray-600 dark:text-gray-300">{getPatientInitials(group.patientProfile?.name)}</span>
                                     {group.unreadCount > 0 && <span className="absolute right-0 top-0 flex h-3 w-3"><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span></span>}
                                </div>
                                <div className="flex-1 truncate">
                                    <div className="font-semibold">{group.patientProfile?.name || 'Unknown Patient'}</div>
                                    <div className="text-xs text-muted-foreground">{group.reports.length} report{group.reports.length > 1 ? 's' : ''}</div>
                                </div>
                                <div className="ml-auto text-xs text-muted-foreground">{group.lastUpdate}</div>
                            </div>
                        </button>
                    )) : (
                      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                          <Inbox size={32} className="mb-2" />
                          <p className="font-semibold">All clear!</p>
                          <p className="text-sm">There are no pending reports to review.</p>
                      </div>
                    )}
                </div>
            </div>

            {/* Report Details Column */}
            <div className="overflow-y-auto xl:col-span-2">
                {selectedGroup && selectedReport ? (
                    <div className="space-y-6 p-6">
                        {/* Patient Profile Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Patient Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                                    <div><p className="text-muted-foreground">Name</p><p>{selectedGroup.patientProfile.name}</p></div>
                                    <div><p className="text-muted-foreground">Age</p><p>{selectedGroup.patientProfile.age}</p></div>
                                    <div><p className="text-muted-foreground">Gender</p><p>{selectedGroup.patientProfile.gender}</p></div>
                                    <div><p className="text-muted-foreground">Region</p><p>{selectedGroup.patientProfile.region}</p></div>
                                    <div><p className="text-muted-foreground">Skin Tone</p><p>{selectedGroup.patientProfile.skinTone}</p></div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {/* Report Selector */}
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><History size={20}/> Case History</CardTitle>
                                <CardDescription>Select a report to view its details.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {selectedGroup.reports.map(report => (
                                    <button 
                                        key={report.id}
                                        onClick={() => handleSelectReport(report)}
                                        className={cn(
                                            "w-full rounded-md p-3 text-left transition-colors hover:bg-accent",
                                            selectedReport.id === report.id ? 'bg-accent' : ''
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{report.reportName}</span>
                                            <span className="text-xs text-muted-foreground">{new Date((report.createdAt as any).seconds * 1000).toLocaleString()}</span>
                                        </div>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Report Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Bot size={20}/> AI Report: {selectedReport.reportName}
                                </CardTitle>
                                 <CardDescription>Case Submitted: {selectedReport.createdAt ? new Date((selectedReport.createdAt as any).seconds * 1000).toLocaleString() : 'N/A'}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="space-y-4">
                                     <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
                                        <Image src={selectedReport.photoDataUri || '/placeholder.svg'} alt="Patient's skin condition" layout="fill" objectFit="cover" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">📝 Reported Symptoms</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">{selectedReport.aiReport.symptomInputs || "No additional symptoms were described by the patient."}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold flex items-center gap-2"><Pill/> Potential Conditions Identified by AI</h3>
                                        <div className="mt-2 space-y-2">
                                            {selectedReport.aiReport.potentialConditions.map((c, i) => (
                                                <div key={i} className="rounded-md bg-muted p-2 text-sm">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{c.name}</span>
                                                        <Badge variant={c.likelihood === 'High' ? 'destructive' : c.likelihood === 'Medium' ? 'secondary' : 'default'}>
                                                            {c.likelihood}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-md bg-muted p-4">
                                        <h4 className="font-semibold flex items-center gap-2"><Home size={16}/> AI Home Remedy Suggestion</h4>
                                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{selectedReport.aiReport.homeRemedies}</p>
                                    </div>
                                    <div className="rounded border bg-amber-50 p-4 text-amber-900">
                                        <h4 className="font-semibold flex items-center gap-2"><FileText size={16}/> AI Medical Recommendation</h4>
                                        <p className="mt-1 text-sm whitespace-pre-wrap">{selectedReport.aiReport.medicalRecommendation}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Doctor's Action Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Doctor's Assessment & Action</CardTitle>
                                <CardDescription>Add your notes and approve or reject the AI's findings. Your notes will be visible to the patient.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Textarea 
                                    placeholder="Enter your key notes and assessment here..." 
                                    className="min-h-[120px]"
                                    value={doctorNotes}
                                    onChange={(e) => setDoctorNotes(e.target.value)}
                                />
                                <div className="mt-4 flex justify-end gap-2">
                                    <Button variant="destructive" onClick={() => handleDecision('rejected')} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : <X className="mr-2 h-4 w-4"/>} Reject
                                    </Button>
                                    <Button onClick={() => handleDecision('doctor-approved')} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Check className="mr-2 h-4 w-4"/>} Approve
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                    <Inbox size={48} className="mb-4" />
                    <h3 className="text-xl font-semibold">Select a Patient</h3>
                    <p>Choose a patient from the list on the left to view their case details.</p>
                  </div>
                )}
            </div>
        </main>
    </div>
  );
}
