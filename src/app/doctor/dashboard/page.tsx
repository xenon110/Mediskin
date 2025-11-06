'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, Search, Settings, User, LogOut, FileText, Phone, Bot, Home, Pill } from 'lucide-react';
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

type PatientGroup = {
    patientProfile: PatientProfile;
    reports: Report[];
    lastUpdate: string;
    unreadCount: number;
};

const statusMap: { [key in Report['status']]: { label: string; badgeClass: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } } = {
  'pending-doctor-review': { label: 'Pending', badgeClass: 'status-badge status-pending', variant: 'outline' },
  'doctor-approved': { label: 'Reviewed', badgeClass: 'bg-green-100 text-green-800', variant: 'default' },
  'doctor-modified': { label: 'Reviewed', badgeClass: 'bg-green-100 text-green-800', variant: 'default' },
  'rejected': { label: 'Disqualified', badgeClass: 'bg-red-100 text-red-800', variant: 'destructive' },
  'pending-patient-input': { label: 'Draft', badgeClass: 'bg-gray-100 text-gray-800', variant: 'secondary' },
};


export default function DoctorDashboard() {
  const { toast } = useToast();
  const router = useRouter();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [patientGroups, setPatientGroups] = useState<PatientGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PatientGroup | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState('Pending');
  const [isLoading, setIsLoading] = useState(true);

  // State for doctor's response (functionality preserved but UI removed as per new design)
  const [assessment, setAssessment] = useState('');
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
         setSelectedReport(currentSelectedReport || currentSelectedGroup.reports.find(r => r.status === 'pending-doctor-review') || currentSelectedGroup.reports[0] || null);
      } else if (patientGroupsArray.length > 0) {
        const firstGroup = patientGroupsArray.find(g => g.unreadCount > 0) || patientGroupsArray[0];
        setSelectedGroup(firstGroup);
        setSelectedReport(firstGroup.reports.find(r => r.status === 'pending-doctor-review') || firstGroup.reports[0] || null);
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
    }
  }, [selectedReport]);


  const handleSelectGroup = (group: PatientGroup) => {
    setSelectedGroup(group);
    setSelectedReport(group.reports.find(r => r.status === 'pending-doctor-review') || group.reports[0] || null);
  };
  
  const filteredGroups = patientGroups.filter(g => {
    if (filter === 'Pending') return g.reports.some(r => r.status === 'pending-doctor-review');
    if (filter === 'Reviewed') return g.reports.every(r => r.status !== 'pending-doctor-review');
    return true;
  });

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
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: 'M', title: 'Dashboard' },
    { href: '/doctor/analytics', icon: '⊞', title: 'Analytics' },
    { href: '/doctor/settings', icon: <Settings size={20}/>, title: 'Settings' },
  ];

  const pendingReviewsCount = patientGroups.reduce((acc, g) => acc + g.unreadCount, 0);

  return (
    <>
        <div className="sidebar">
            {sidebarNavItems.map((item, index) => (
                <Link href={item.href} key={item.title} className={cn('sidebar-icon', { active: router.pathname === item.href })} title={item.title}>
                    {typeof item.icon === 'string' ? item.icon : item.icon}
                </Link>
            ))}
            <Link href="/doctor/profile" className="sidebar-icon" style={{ marginTop: 'auto' }} title="Profile">
                <User size={20} />
            </Link>
            <button onClick={handleSignOut} className="sidebar-icon" title="Sign Out">
                <LogOut size={20}/>
            </button>
        </div>

        <div className="main-content">
            <div className="header">
                <h1>{doctorProfile ? `Dr. ${doctorProfile.name}'s Dashboard` : 'Doctor Dashboard'}</h1>
                <span className="pending-badge">{pendingReviewsCount} pending reviews</span>
                <div className="search-bar">
                    <span className="search-icon"><Search size={18}/></span>
                    <input type="text" placeholder="Search patients..."/>
                </div>
                <div className="tabs">
                    <button className={cn('tab', { 'active': filter === 'Pending' })} onClick={() => setFilter('Pending')}>Pending</button>
                    <button className={cn('tab', { 'active': filter === 'Reviewed' })} onClick={() => setFilter('Reviewed')}>Reviewed</button>
                </div>
            </div>

            <div className="content-grid">
                <div className="patients-list">
                    {filteredGroups.length > 0 ? filteredGroups.map((group) => (
                        <div 
                          key={group.patientProfile.uid} 
                          className={cn('patient-card', { 'active': selectedGroup?.patientProfile.uid === group.patientProfile.uid })}
                          onClick={() => handleSelectGroup(group)}
                        >
                            {group.unreadCount > 0 && <span className="alert-badge">{group.unreadCount}</span>}
                            <div className="patient-initial">{getPatientInitials(group.patientProfile?.name)}</div>
                            <div className="patient-info">
                                <div className="patient-name">{group.patientProfile?.name || 'Unknown Patient'}</div>
                                <div className="patient-meta">{group.reports.length} report{group.reports.length > 1 ? 's' : ''} • {group.lastUpdate}</div>
                            </div>
                        </div>
                    )) : (
                      <div className="text-center p-8 text-gray-500">
                          <Inbox size={32} className="mx-auto mb-2" />
                          <p>No {filter.toLowerCase()} patient cases found.</p>
                      </div>
                    )}
                </div>

                {selectedGroup && selectedReport ? (
                    <div className="report-panel">
                        <div className="report-header">
                            <div>
                                <div className="report-title">Reports for {selectedGroup.patientProfile.name}</div>
                                <p style={{color: '#7f8c8d', fontSize: '14px', marginTop: '5px'}}>
                                    Dermatology Case • Age: {selectedGroup.patientProfile.age} • {selectedGroup.patientProfile.gender}
                                </p>
                            </div>
                            <div className="action-buttons">
                                <button className="btn btn-icon"><FileText size={14} className="mr-2"/> History</button>
                                <button className="btn btn-icon"><Phone size={14} className="mr-2"/> Call</button>
                            </div>
                        </div>

                        <div className="report-items">
                            {selectedGroup.reports.map(report => (
                                <div 
                                    key={report.id} 
                                    className={cn('report-item', {'report-item-active': selectedReport?.id === report.id})}
                                    onClick={() => setSelectedReport(report)}
                                >
                                    <div className="report-item-info">
                                        <h4>{report.reportName}</h4>
                                        <p>{report.createdAt ? new Date((report.createdAt as any).seconds * 1000).toLocaleString() : ''}</p>
                                    </div>
                                    <span className={cn(statusMap[report.status]?.badgeClass || '')}>
                                        {statusMap[report.status]?.label || 'Unknown'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="ai-report-section">
                            <span className="ai-badge"><Bot size={14} className="inline mr-1"/> AI GENERATED REPORT</span>
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
                                <div className="detail-value">{selectedReport.createdAt ? new Date((selectedReport.createdAt as any).seconds * 1000).toLocaleString() : 'N/A'}</div>
                            </div>
                        </div>

                        <div className="symptoms-section">
                            <h3 className="section-title">📝 Reported Symptoms:</h3>
                            <p className="p-4 bg-gray-100 rounded-lg text-sm text-gray-700 mb-4">{selectedReport.aiReport.symptomInputs || "No symptoms were described."}</p>
                            
                            <h3 className="section-title">💡 AI Recommendations:</h3>
                            <div className="recommendation-box mb-4">
                                <div className="recommendation-title">
                                    <Home size={16}/> Home Remedies Recommendation
                                </div>
                                <p className="recommendation-text whitespace-pre-wrap">{selectedReport.aiReport.homeRemedies}</p>
                            </div>
                             <div className="recommendation-box" style={{background: '#fff3e0', borderLeftColor: '#ff9800'}}>
                                <div className="recommendation-title" style={{color: '#e65100'}}>
                                    <Pill size={16}/> Medical Recommendation
                                </div>
                                <p className="recommendation-text whitespace-pre-wrap" style={{color: '#bf360c'}}>{selectedReport.aiReport.medicalRecommendation}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                  <div className="report-panel flex items-center justify-center text-center">
                    <div>
                      <Inbox size={48} className="mx-auto text-gray-300 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-700">Select a Patient</h3>
                      <p className="text-gray-500">Choose a patient from the list to view their case details.</p>
                    </div>
                  </div>
                )}
            </div>
        </div>
    </>
  );
}
