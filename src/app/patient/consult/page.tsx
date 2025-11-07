
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ChevronLeft, Star, User } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';


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
                    
                    setDoctors(fetchedDoctors); // getDoctors now only returns approved doctors

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
            <div className="flex h-screen items-center justify-center bg-gradient-subtle">
                <div className="text-center">
                    <Loader2 className="animate-spin text-primary mx-auto" size={48} />
                    <p className="mt-4 text-lg text-muted-foreground">Fetching available doctors...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-background min-h-screen">
                <div className="container mx-auto py-12">
                    <main>
                        <Button variant="outline" onClick={() => router.back()} className="mb-8">
                            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                        </Button>

                        <div className="text-center mb-12">
                            <h1 className="text-4xl font-bold tracking-tight mb-2">Consult a Verified Doctor</h1>
                            <p className="text-lg text-muted-foreground">Send your AI-generated report to a professional for expert review.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {doctors.length > 0 ? (
                                doctors.map((doctor) => (
                                    <Card key={doctor.uid} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-2xl border-2 border-transparent hover:border-primary">
                                        <CardContent className="p-6 text-center">
                                            <div className="relative w-24 h-24 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                                                 {doctor.photoURL ? (
                                                    <Image src={doctor.photoURL} alt={`Dr. ${doctor.name}`} layout="fill" className="rounded-full object-cover" />
                                                ) : (
                                                    <User className="w-12 h-12 text-muted-foreground"/>
                                                )}
                                            </div>
                                            <h3 className="text-xl font-semibold">Dr. {doctor.name}</h3>
                                            <p className="text-muted-foreground">{doctor.specialization || 'Dermatology'}</p>
                                             <div className="flex justify-center items-center gap-1 text-sm text-amber-500 mt-2">
                                                <Star className="w-4 h-4 fill-current"/>
                                                <Star className="w-4 h-4 fill-current"/>
                                                <Star className="w-4 h-4 fill-current"/>
                                                <Star className="w-4 h-4 fill-current"/>
                                                <Star className="w-4 h-4"/>
                                                <span className="text-muted-foreground ml-1">({Math.floor(Math.random() * 50 + 10)})</span>
                                             </div>
                                        </CardContent>
                                        <div className="p-6 bg-muted/50">
                                             <Button 
                                                className="w-full" 
                                                onClick={() => handleSendClick(doctor)}
                                                disabled={isSending === doctor.uid || reports.length === 0}
                                            >
                                                {isSending === doctor.uid ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Send className="mr-2 h-4 w-4" />
                                                )}
                                                Send Report
                                            </Button>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-16 text-muted-foreground col-span-full bg-background/50 rounded-xl">
                                    <User size={48} className="mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-xl font-semibold">No Doctors Available</h3>
                                    <p>We couldn't find any approved doctors at the moment. Please check back later.</p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                 <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select a report to send to Dr. {targetDoctor?.name}</DialogTitle>
                        <DialogDescription>
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
                        <Button onClick={handleConfirmSend} disabled={!selectedReportId || !!isSending}>
                            {isSending ? <Loader2 className="animate-spin" /> : 'Confirm & Send'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
