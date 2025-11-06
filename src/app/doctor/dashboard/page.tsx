'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Inbox, Search, Settings, User, LogOut, FileText, Check, X, MessageSquare, LayoutGrid, Pill, Home, History, Phone, Bot, Calendar } from 'lucide-react';
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
        const firstGroup = patientGroupsArray.find(g => g.unreadCount > 0) || patientGroupsArray[0];
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

  const getPatientInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getPendingReviewsCount = () => {
    return patientGroups.reduce((acc, group) => acc + group.unreadCount, 0);
  }
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: MessageSquare, title: 'Patient Cases' },
    { href: '/doctor/analytics', icon: LayoutGrid, title: 'Analytics' },
    { href: '/doctor/calendar', icon: Calendar, title: 'Calendar' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPatientGroups = patientGroups.filter(group => {
    if (activeTab === 'Pending') return group.unreadCount > 0;
    if (activeTab === 'Reviewed') return group.reports.some(r => r.status === 'doctor-approved' || r.status === 'doctor-modified');
    return false;
  });

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
                <Link href="/doctor/profile" className="user-profile" title="My Profile">
                  <User size={24} />
                </Link>
                <div className="user-initials" title={doctorProfile?.name}>{getPatientInitials(doctorProfile?.name)}</div>
                 <button onClick={handleSignOut} className="nav-item !w-10 !h-10" title="Sign Out">
                    <LogOut size={22} />
                </button>
            </div>
        </div>

        {/* Main Content */}
        <main className="main-content-area">
            <header className="main-header-dash">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Dr. {doctorProfile?.name}'s Dashboard</h1>
                    <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-300">{getPendingReviewsCount()} pending reviews</Badge>
                </div>
                <div className="flex items-center gap-4">
                     <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input type="search" placeholder="Search patients..." className="w-full pl-10 rounded-full bg-white border-gray-200 focus:border-primary"/>
                    </div>
                </div>
            </header>

            <div className="content-grid">
                <div className="patient-list">
                     <div className="flex items-center gap-2 mb-4">
                        <Button variant={activeTab === 'Pending' ? 'default' : 'outline'} onClick={() => setActiveTab('Pending')} className="rounded-full">Pending</Button>
                        <Button variant={activeTab === 'Reviewed' ? 'default' : 'outline'} onClick={() => setActiveTab('Reviewed')} className="rounded-full">Reviewed</Button>
                    </div>

                    <div className="space-y-2">
                       {filteredPatientGroups.length > 0 ? filteredPatientGroups.map((group) => (
                        <div 
                          key={group.patientProfile.uid} 
                          className={cn('patient-card', { 'selected': selectedGroup?.patientProfile.uid === group.patientProfile.uid })}
                          onClick={() => handleSelectGroup(group)}
                        >
                          <div className="flex items-center gap-3">
                              <div className="patient-initials">{getPatientInitials(group.patientProfile.name)}</div>
                              <div className="flex-1">
                                  <p className="font-semibold text-gray-800">{group.patientProfile.name}</p>
                                  <p className="text-sm text-gray-500">{group.reports.length} reports • {group.lastUpdate}</p>
                              </div>
                              {group.unreadCount > 0 && <div className="unread-badge">{group.unreadCount}</div>}
                          </div>
                        </div>
                       )) : (
                        <div className="text-center text-gray-500 py-16">
                          <Inbox size={48} className="mx-auto text-gray-400" />
                          <p className="mt-2">No {activeTab.toLowerCase()} cases.</p>
                        </div>
                       )}
                    </div>
                </div>

                <div className="report-details">
                {selectedGroup && selectedReport ? (
                    <div className="bg-white p-6 rounded-2xl shadow-sm h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Reports for {selectedGroup.patientProfile.name}</h2>
                                <p className="text-sm text-gray-500">Dermatology Case • Age: {selectedGroup.patientProfile.age} • {selectedGroup.patientProfile.gender}</p>
                            </div>
                            <div className="space-x-2">
                                <Button variant="outline" size="sm"><History className="mr-2 h-4 w-4"/> History</Button>
                                <Button variant="outline" size="sm"><Phone className="mr-2 h-4 w-4"/> Call</Button>
                            </div>
                        </div>
                        
                        <div className="report-list mb-6">
                            {selectedGroup.reports.map(report => (
                                <div key={report.id} className={cn('report-item', {'selected': report.id === selectedReport.id})} onClick={() => handleSelectReport(report)}>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-700">{report.reportName}</p>
                                        <p className="text-xs text-gray-500">{new Date((report.createdAt as any).seconds * 1000).toLocaleString()}</p>
                                    </div>
                                    <Badge className={cn({
                                        'bg-yellow-100 text-yellow-800': report.status === 'pending-doctor-review',
                                        'bg-green-100 text-green-800': report.status === 'doctor-approved' || report.status === 'doctor-modified',
                                        'bg-red-100 text-red-800': report.status === 'rejected',
                                        'bg-blue-100 text-blue-800': report.status === 'pending-patient-input',
                                    })}>Pending</Badge>
                                </div>
                            ))}
                        </div>

                        <div className="ai-report-header">
                            <Bot size={16}/>
                            <span>AI GENERATED REPORT</span>
                        </div>
                        <h3 className="text-xl font-bold text-white p-4 bg-primary-darker rounded-b-lg mb-4">{selectedReport.reportName}</h3>

                        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                            <div className="info-box">
                                <label>PATIENT NAME</label>
                                <p>{selectedGroup.patientProfile.name}</p>
                            </div>
                            <div className="info-box">
                                <label>AGE</label>
                                <p>{selectedGroup.patientProfile.age} years</p>
                            </div>
                            <div className="info-box">
                                <label>GENDER</label>
                                <p>{selectedGroup.patientProfile.gender}</p>
                            </div>
                            <div className="info-box">
                                <label>REGION</label>
                                <p>{selectedGroup.patientProfile.region}</p>
                            </div>
                             <div className="info-box">
                                <label>SKIN TONE</label>
                                <p>{selectedGroup.patientProfile.skinTone}</p>
                            </div>
                            <div className="info-box">
                                <label>SUBMITTED</label>
                                <p>{new Date((selectedReport.createdAt as any).seconds * 1000).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <h4 className="font-semibold text-gray-700 mb-2">Reported Symptoms:</h4>
                            {/* This is where the AI report details would go. Placeholder for now. */}
                            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 min-h-[100px]">
                                 {selectedReport.aiReport.report}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-center text-gray-500 bg-white rounded-2xl shadow-sm">
                        <div>
                            <Inbox size={48} className="mx-auto text-gray-400" />
                            <h3 className="text-xl font-semibold mt-2">Select a Patient</h3>
                            <p>Choose a patient case from the list to view details.</p>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </main>
    </div>
  );
}
