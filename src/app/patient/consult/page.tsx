'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ChevronLeft, Star, Stethoscope, MoreVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDoctors, getReportsForPatient, sendReportToDoctor, DoctorProfile, Report } from '@/lib/firebase-services';
import { auth } from '@/lib/firebase';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';


export default function ConsultPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState<string | null>(null);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [targetDoctor, setTargetDoctor] = useState<DoctorProfile | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                setIsLoading(true);
                try {
                    const [fetchedDoctors, fetchedReports] = await Promise.all([
                        getDoctors(),
                        getReportsForPatient(user.uid)
                    ]);
                    
                    setDoctors(fetchedDoctors.filter(d => d.verificationStatus === 'approved'));

                    const pendingReports = fetchedReports.filter(r => r.status === 'pending-patient-input');
                    setReports(pendingReports);
                    if (pendingReports.length > 0) {
                        setSelectedReportId(pendingReports[0].id); // Pre-select the first pending report
                    }

                } catch (error: any) {
                    console.error("Failed to fetch initial data:", error);
                    toast({ 
                        variant: 'destructive', 
                        title: 'Error Loading Page', 
                        description: error.message || 'Could not retrieve doctors or reports. Check your connection and security rules.' 
                    });
                } finally {
                    setIsLoading(false);
                }
            } else {
                router.push('/login?role=patient');
            }
        });
        
        return () => unsubscribe();
    }, [toast, router]);
    
    const getInitials = (name: string | undefined) => {
      if (!name) return '?';
      const nameParts = name.split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    const handleSendClick = (doctor: DoctorProfile) => {
        if (reports.length > 0) {
            setTargetDoctor(doctor);
            setIsDialogOpen(true);
        } else {
            toast({
                title: "No Reports to Send",
                description: "You don't have any new reports ready for consultation. Please create one from the dashboard.",
                variant: "destructive",
                action: <Button onClick={() => router.push('/patient/dashboard')}>Go to Dashboard</Button>
            });
        }
    };
    
    const handleConfirmSend = async () => {
        if (!selectedReportId || !targetDoctor) return;

        setIsSending(targetDoctor.uid);
        setIsDialogOpen(false);
        
        try {
            await sendReportToDoctor(selectedReportId, targetDoctor.uid);
            
            toast({
                title: "Report Sent!",
                description: `Your report has been successfully sent to Dr. ${targetDoctor.name}.`,
            });
            // Immediately update the UI to reflect the change
            setReports(reports.filter(r => r.id !== selectedReportId));
            setSelectedReportId(reports.length > 1 ? reports.filter(r => r.id !== selectedReportId)[0].id : null);

        } catch (error: any) {
            console.error("Failed to send report:", error);
            toast({ variant: 'destructive', title: 'Error Sending Report', description: error.message || 'Could not send the report.' });
        } finally {
            setIsSending(null);
            setTargetDoctor(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="animate-spin text-primary mx-auto" size={48} />
                    <p className="mt-4 text-lg text-slate-600">Fetching available doctors...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="consult-page-bg min-h-screen">
                <div className="page-container">
                    <main className="main-content">
                         <button onClick={() => router.back()} className="back-button">
                            <ChevronLeft size={20} /> Back
                        </button>

                        <div className="page-header" style={{ textAlign: 'center' }}>
                            <h1 className="page-title">Consult a Doctor</h1>
                            <p className="page-subtitle">Send a new report to our network of professionals for reviews.</p>
                        </div>

                        <div className="doctors-grid">
                            {doctors.length > 0 ? (
                                doctors.map((doctor) => (
                                    <div key={doctor.uid} className="consult-doctor-card">
                                        <div className="consult-doctor-info">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="consult-doctor-avatar">{getInitials(doctor.name)}</div>
                                                    <div>
                                                        <h3 className="consult-doctor-name">Dr. {doctor.name}</h3>
                                                        <p className="consult-doctor-specialty">{doctor.specialization || 'Dermatology'}</p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                                    <MoreVertical size={20} />
                                                </Button>
                                            </div>
                                             <div className="consult-doctor-rating">
                                                <div className="stars">
                                                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                                    <Star size={16} className="text-gray-300 fill-gray-300" />
                                                </div>
                                                <span className="rating-text">4.0 • {Math.floor(Math.random() * 100 + 10)} reviews</span>
                                            </div>
                                            <button 
                                                className="consult-send-report-btn" 
                                                onClick={() => handleSendClick(doctor)}
                                                disabled={isSending === doctor.uid || reports.length === 0}
                                            >
                                                {isSending === doctor.uid ? (
                                                    <><Loader2 size={20} className="animate-spin" /> Sending...</>
                                                ) : (
                                                    <><FileText size={16} /> Send New Report</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-16 text-slate-500 col-span-full bg-white/50 rounded-xl">
                                    <Stethoscope size={48} className="mx-auto mb-4 text-slate-400" />
                                    <h3 className="text-xl font-semibold text-slate-700">No Doctors Available</h3>
                                    <p>We couldn't find any approved doctors at the moment. Please check back later.</p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                 <DialogContent className="bg-background border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Select a report to send to Dr. {targetDoctor?.name}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Choose one of your pending reports for consultation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select onValueChange={setSelectedReportId} value={selectedReportId || undefined}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a report..." />
                            </SelectTrigger>
                            <SelectContent>
                                {reports.map(report => (
                                    <SelectItem key={report.id} value={report.id}>
                                        {report.reportName || `Report from ${new Date((report.createdAt as any).seconds * 1000).toLocaleString()}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmSend} disabled={!selectedReportId || !!isSending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            {isSending ? <Loader2 className="animate-spin" /> : 'Confirm & Send'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}