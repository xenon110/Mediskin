
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, Search, Settings, User, LogOut, FileText, Check, X, MessageSquare, LayoutGrid, Pill, Home, History, Phone, Bot } from 'lucide-react';
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

  const getPatientInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: LayoutGrid, title: 'Dashboard' },
    { href: '/doctor/analytics', icon: MessageSquare, title: 'Cases' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Dashboard...</p>
      </div>
    );
  }

  const pendingCount = patientGroups.reduce((acc, group) => acc + group.unreadCount, 0);


  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <Link href="/doctor/dashboard" className="logo-sidebar">M</Link>
        <nav className="sidebar-nav">
          {sidebarNavItems.map(item => (
            <Link key={item.title} href={item.href} className={cn('nav-item', { 'active': pathname === item.href })} title={item.title}>
              <item.icon size={20} />
            </Link>
          ))}
        </nav>
        <div className="flex flex-col items-center mt-auto gap-4">
          <Link href="/doctor/profile" className="user-profile" title="Profile">
             <User size={22} />
          </Link>
          <button onClick={handleSignOut} className="nav-item !bg-transparent" title="Sign Out">
            <LogOut size={22} />
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="main-dashboard-content">
        <div className="dashboard-header">
          <h1>Dr. {doctorProfile?.name || "Mayank Raj"}'s Dashboard</h1>
          {pendingCount > 0 && <span className="pending-badge">{pendingCount} pending reviews</span>}
          <div className="search-bar">
            <Search className="search-icon" size={20} />
            <input type="text" placeholder="Search patients..." />
          </div>
          <div className="tabs">
            <button className="tab active">Pending</button>
            <button className="tab">Reviewed</button>
          </div>
        </div>

        <div className="content-grid">
          <div className="patients-list">
             {patientGroups.length > 0 ? patientGroups.map((group) => (
              <div 
                key={group.patientProfile.uid} 
                className={cn('patient-card', { 'active': selectedGroup?.patientProfile.uid === group.patientProfile.uid })}
                onClick={() => handleSelectGroup(group)}
              >
                {group.unreadCount > 0 && <span className="alert-badge">{group.unreadCount}</span>}
                <div className="patient-card-content">
                  <div className="patient-initial">{getPatientInitials(group.patientProfile?.name)}</div>
                  <div className="patient-info">
                    <div className="patient-name">{group.patientProfile?.name || 'Unknown Patient'}</div>
                    <div className="patient-meta">{group.reports.length} report{group.reports.length !== 1 ? 's' : ''} • {group.lastUpdate}</div>
                  </div>
                </div>
              </div>
             )) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                <Inbox size={48} className="mb-4 text-gray-400" />
                <h3 className="font-semibold text-lg text-gray-700">All Caught Up</h3>
                <p>No pending patient reports.</p>
              </div>
             )}
          </div>

          {selectedGroup && selectedReport ? (
            <div className="report-panel">
              <div className="report-header">
                <div>
                  <div className="report-title">Reports for {selectedGroup.patientProfile.name}</div>
                  <p className="report-subtitle">Dermatology Case • Age: {selectedGroup.patientProfile.age} • {selectedGroup.patientProfile.gender}</p>
                </div>
                <div className="action-buttons">
                  <Button variant="outline" className="btn-icon gap-2"><History size={16}/> History</Button>
                  <Button variant="outline" className="btn-icon gap-2"><Phone size={16}/> Call</Button>
                </div>
              </div>
              
              <div className="report-items">
                {selectedGroup.reports.map(report => (
                  <div key={report.id} className={cn('report-item', {'active': selectedReport.id === report.id})} onClick={() => handleSelectReport(report)}>
                    <div className="report-item-info">
                      <h4>{report.reportName}</h4>
                      <p>{new Date((report.createdAt as any).seconds * 1000).toLocaleString()}</p>
                    </div>
                    <span className="status-badge status-pending">Pending</span>
                  </div>
                ))}
              </div>

              <div className="ai-report-section">
                <span className="ai-badge"><Bot size={14}/> AI GENERATED REPORT</span>
                <h3 className="ai-report-title">{selectedReport.reportName}</h3>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                    <div className="detail-label">Patient Name</div>
                    <div className="detail-value">{selectedGroup.patientProfile.name}</div>
                </div>
                <div className="detail-item">
                    <div className="detail-label">Age</div>
                    <div className="detail-value">{selectedGroup.patientProfile.age} years</div>
                </div>
                <div className="detail-item">
                    <div className="detail-label">Gender</div>
                    <div className="detail-value">{selectedGroup.patientProfile.gender}</div>
                </div>
                <div className="detail-item">
                    <div className="detail-label">Region</div>
                    <div className="detail-value">{selectedGroup.patientProfile.region}</div>
                </div>
                <div className="detail-item">
                    <div className="detail-label">Skin Tone</div>
                    <div className="detail-value">{selectedGroup.patientProfile.skinTone}</div>
                </div>
                <div className="detail-item">
                    <div className="detail-label">Submitted</div>
                    <div className="detail-value">{new Date((selectedReport.createdAt as any).seconds * 1000).toLocaleString()}</div>
                </div>
              </div>

              <div className="symptoms-section">
                <h3 className="section-title">📝 Reported Symptoms:</h3>
                <div className="recommendation-box">
                    <div className="recommendation-title">
                        <Home size={16}/> Home Remedies Recommendation
                    </div>
                    <p>
                      {selectedReport.aiReport.homeRemedies}
                    </p>
                </div>
              </div>

              {/* Action Section */}
              <div className="action-section">
                <h3 className="section-title">🩺 Doctor's Assessment & Action</h3>
                <Textarea 
                    placeholder="Enter your key notes and assessment here..." 
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                />
                <div className="final-actions">
                    <Button className="btn-reject gap-2" onClick={() => handleDecision('rejected')} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><X size={16}/> Reject</>}
                    </Button>
                    <Button className="btn-approve gap-2" onClick={() => handleDecision('doctor-approved')} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><Check size={16}/> Approve</>}
                    </Button>
                </div>
              </div>


            </div>
          ) : (
             <div className="report-panel flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <Inbox size={48} className="mx-auto mb-4 text-gray-400" />
                    <h3 className="text-xl font-semibold text-gray-700">Select a Patient</h3>
                    <p>Choose a patient from the list to view their case details.</p>
                </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
