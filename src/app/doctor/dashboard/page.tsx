
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Inbox, Search, Settings, User, LogOut, FileText, Check, X, MessageSquare, LayoutGrid, Pill, Home, History, Phone, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { Report, getUserProfile, PatientProfile, DoctorProfile, updateReportByDoctor } from '@/lib/firebase-services';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type PatientGroup = {
    patientProfile: PatientProfile;
    reports: Report[];
    lastUpdate: string;
    unreadCount: number;
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
  const [activeTab, setActiveTab] = useState('Pending');

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
    // Select the first report in the group that matches the active tab's criteria, or just the first report overall
    const reportsForTab = group.reports.filter(r => {
        if (activeTab === 'Pending') return r.status === 'pending-doctor-review';
        if (activeTab === 'Reviewed') return r.status === 'doctor-approved' || r.status === 'doctor-modified';
        return true;
    });
    setSelectedReport(reportsForTab[0] || group.reports[0] || null);
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

  const getPatientInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: MessageSquare, title: 'Patient Cases' },
    { href: '/doctor/analytics', icon: LayoutGrid, title: 'Analytics' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];
  
  const getLikelihoodColor = (likelihood: 'High' | 'Medium' | 'Low') => {
    switch (likelihood) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Dashboard...</p>
      </div>
    );
  }

  const filteredPatientGroups = patientGroups.filter(group => {
    if (activeTab === 'Pending') {
      return group.reports.some(r => r.status === 'pending-doctor-review');
    }
    if (activeTab === 'Reviewed') {
      return group.reports.some(r => r.status === 'doctor-approved' || r.status === 'doctor-modified');
    }
    return true; // for an "All" tab if you add one
  });


  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Sidebar */}
       <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <FileText className="h-6 w-6" />
              <span className="">Doctor Portal</span>
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
      <div className="flex flex-col">
        {/* Main Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
            <div className="w-full flex-1">
                <h1 className="text-lg font-semibold md:text-2xl">Patient Cases</h1>
            </div>
            <div className="w-full flex-1">
                <form>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search patients..." className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"/>
                    </div>
                </form>
            </div>
            <Button variant="outline" size="icon" className="shrink-0">
                <User className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
            </Button>
        </header>
        
        {/* Main Content Area */}
        <main className="flex flex-1 flex-row gap-4 p-4 lg:gap-6 lg:p-6 overflow-hidden">
          <div className="flex flex-col w-1/3 border-r pr-4 overflow-y-auto">
            <div className="flex items-center">
                <h2 className="text-xl font-semibold flex-1">Inbox</h2>
                <div className="space-x-2">
                    <Button variant={activeTab === 'Pending' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('Pending')}>Pending</Button>
                    <Button variant={activeTab === 'Reviewed' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('Reviewed')}>Reviewed</Button>
                </div>
            </div>
            <div className="mt-4 space-y-2">
             {filteredPatientGroups.length > 0 ? filteredPatientGroups.map((group) => (
              <div 
                key={group.patientProfile.uid} 
                className={cn('p-3 rounded-lg cursor-pointer hover:bg-muted', { 'bg-muted': selectedGroup?.patientProfile.uid === group.patientProfile.uid })}
                onClick={() => handleSelectGroup(group)}
              >
                <div className="flex items-center gap-3">
                    <div className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-600">
                         <span className="font-medium text-gray-600 dark:text-gray-300">{getPatientInitials(group.patientProfile.name)}</span>
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold">{group.patientProfile.name}</p>
                        <p className="text-sm text-muted-foreground">{group.reports.length} reports • {group.lastUpdate}</p>
                    </div>
                    {group.unreadCount > 0 && <Badge>{group.unreadCount}</Badge>}
                </div>
              </div>
             )) : (
              <div className="text-center text-muted-foreground py-16">
                <Inbox size={48} className="mx-auto" />
                <p>No {activeTab.toLowerCase()} patient cases.</p>
              </div>
             )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
          {selectedGroup && selectedReport ? (
            <div className="space-y-6">
                {/* Report Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Reports for {selectedGroup.patientProfile.name}</h2>
                        <p className="text-muted-foreground">Dermatology Case • Age: {selectedGroup.patientProfile.age} • {selectedGroup.patientProfile.gender}</p>
                    </div>
                    <div className="space-x-2">
                        <Button variant="outline"><History className="mr-2 h-4 w-4"/> View History</Button>
                        <Button variant="outline"><Phone className="mr-2 h-4 w-4"/> Call Patient</Button>
                    </div>
                </div>

                {/* Horizontal Report Items */}
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {selectedGroup.reports.map(report => (
                      <div key={report.id} className={cn('p-4 rounded-md cursor-pointer border-2 min-w-[200px]', {'border-primary': report.id === selectedReport.id})} onClick={() => handleSelectReport(report)}>
                          <p className="font-semibold">{report.reportName}</p>
                          <p className="text-sm text-muted-foreground">{new Date((report.createdAt as any).seconds * 1000).toLocaleDateString()}</p>
                          <Badge className={cn('mt-2', {
                              'bg-yellow-500': report.status === 'pending-doctor-review',
                              'bg-green-500': report.status === 'doctor-approved' || report.status === 'doctor-modified',
                              'bg-red-500': report.status === 'rejected'
                          })}>
                              {report.status.includes('pending') ? 'Pending' : (report.status.includes('doctor') ? 'Reviewed' : 'Rejected')}
                          </Badge>
                      </div>
                  ))}
                </div>
              
              {/* AI Report Section */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={20}/>
                    <h3 className="text-lg font-semibold">AI GENERATED REPORT</h3>
                  </div>
                  <p className="font-bold text-2xl">{selectedReport.reportName}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="font-semibold">Patient Name:</span> {selectedGroup.patientProfile.name}</div>
                <div><span className="font-semibold">Age:</span> {selectedGroup.patientProfile.age}</div>
                <div><span className="font-semibold">Gender:</span> {selectedGroup.patientProfile.gender}</div>
                <div><span className="font-semibold">Region:</span> {selectedGroup.patientProfile.region}</div>
                <div><span className="font-semibold">Skin Tone:</span> {selectedGroup.patientProfile.skinTone}</div>
                <div><span className="font-semibold">Submitted:</span> {new Date((selectedReport.createdAt as any).seconds * 1000).toLocaleString()}</div>
              </div>

              {/* Symptoms Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">📝 Reported Symptoms & Home Remedies</h3>
                <div className="p-4 bg-muted rounded-md space-y-4">
                  <div className="flex items-start gap-4">
                      <Pill className="h-5 w-5 text-primary mt-1"/>
                      <div>
                          <p className="font-semibold text-primary">Potential Conditions</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedReport.aiReport.potentialConditions.map((condition, index) => (
                              <Badge key={index} className={cn('text-sm', getLikelihoodColor(condition.likelihood))}>
                                {condition.name} ({(condition.confidence * 100).toFixed(0)}%)
                              </Badge>
                            ))}
                          </div>
                      </div>
                  </div>
                   <div className="flex items-start gap-4">
                      <Home className="h-5 w-5 text-green-600 mt-1"/>
                      <div>
                          <p className="font-semibold text-green-600">Home Remedies</p>
                          <p className="text-muted-foreground text-sm">{selectedReport.aiReport.homeRemedies}</p>
                      </div>
                  </div>
                </div>
              </div>

              {/* Action Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">🩺 Doctor's Assessment & Action</h3>
                <Textarea 
                    placeholder="Enter your key notes and assessment here..." 
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    className="min-h-[120px]"
                />
                <div className="flex justify-end gap-2 mt-2">
                    <Button variant="destructive" onClick={() => handleDecision('rejected')} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><X className="mr-2 h-4 w-4"/> Reject</>}
                    </Button>
                    <Button onClick={() => handleDecision('doctor-approved')} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><Check className="mr-2 h-4 w-4"/> Approve</>}
                    </Button>
                </div>
              </div>

            </div>
          ) : (
             <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                <div>
                    <Inbox size={48} className="mx-auto" />
                    <h3 className="text-xl font-semibold">Select a Patient</h3>
                    <p>Choose a patient from the list to view their case details.</p>
                </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
