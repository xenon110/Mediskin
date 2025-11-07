
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, FileText, Pill, Home, Stethoscope, Languages, ChevronLeft, Download, Camera, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Report } from '@/lib/firebase-services';
import { translateReport, TranslateReportOutput } from '@/ai/flows/translate-report';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Image from 'next/image';

type TranslatedReport = Omit<TranslateReportOutput, 'potentialConditions'> & {
  potentialConditions: { name: string; description: string }[];
};

export default function ReportPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [report, setReport] = useState<Report | null>(null);
  const [translatedReport, setTranslatedReport] = useState<TranslatedReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const reportContentRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    try {
      const storedReport = sessionStorage.getItem('latestReport');
      if (storedReport) {
        setReport(JSON.parse(storedReport));
      } else {
        setError('No report found. Please generate a new analysis from the dashboard.');
      }
    } catch (e) {
      console.error('Failed to parse report from session storage', e);
      setError('Could not load the report data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTranslate = async (language: string) => {
    if (!report || language === 'en') {
      setTranslatedReport(null); // Reset to original if English is selected
      return;
    }
    setIsTranslating(true);
    try {
      const translation = await translateReport({ report: report.aiReport, language });
      setTranslatedReport(translation as TranslatedReport); // Cast to include potentialConditions
      toast({
        title: `Report translated to ${language}`,
      });
    } catch (e) {
      console.error('Translation failed', e);
      toast({
        variant: 'destructive',
        title: 'Translation Failed',
        description: 'Could not translate the report at this time.',
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportContentRef.current) return;
    
    setIsDownloading(true);
    toast({ title: 'Preparing Download', description: 'Generating PDF, please wait...' });

    try {
      const canvas = await html2canvas(reportContentRef.current, {
        scale: 2, // Increase scale for better resolution
        useCORS: true,
        backgroundColor: null, // Use the actual background
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      
      let reportDate = "report";
      if (report?.createdAt) {
        // Handle Firestore Timestamp (object with seconds)
        if ((report.createdAt as any).seconds) {
          reportDate = new Date((report.createdAt as any).seconds * 1000)
            .toISOString()
            .split("T")[0];
        } 
        // Handle standard Date object
        else if (report.createdAt instanceof Date) {
          reportDate = report.createdAt.toISOString().split("T")[0];
        }
      }

      pdf.save(`MediSkin-Report-${reportDate}.pdf`);

    } catch (err) {
      console.error("Failed to generate PDF", err);
      toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not generate the PDF file.' });
    } finally {
       setIsDownloading(false);
    }
  };

  const displayReport = translatedReport || report?.aiReport;
  
  const getLikelihoodColor = (likelihood: 'High' | 'Medium' | 'Low') => {
    switch (likelihood) {
      case 'High': return 'bg-red-500/20 text-red-500';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-500';
      case 'Low': return 'bg-green-500/20 text-green-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-subtle">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 text-center">
        <Card className="max-w-lg mx-auto bg-card/80">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center justify-center gap-2">
                    <AlertTriangle /> Report Error
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg mb-4">{error}</p>
                <Button onClick={() => router.push('/patient/dashboard')}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  if (!report || !displayReport) {
    return null; // Should be handled by error state, but as a fallback
  }

  return (
    <div className="bg-gradient-subtle min-h-screen py-10 px-4">
        <div className="max-w-4xl mx-auto">
            <Card className="bg-card/90 backdrop-blur-lg shadow-2xl shadow-primary/10" ref={reportContentRef}>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <Button variant="outline" size="sm" onClick={() => router.push('/patient/dashboard')} className="mb-4 print-hidden">
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Back to Dashboard
                            </Button>
                            <CardTitle className="font-headline text-3xl md:text-4xl text-gradient-primary flex items-center gap-3">
                                <FileText /> AI Analysis Report
                            </CardTitle>
                            <CardDescription className="mt-2">
                                This report is AI-generated. Always consult a qualified dermatologist for a final diagnosis.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2 print-hidden">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isDownloading}>
                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                    Download PDF
                                </Button>
                                 <Select onValueChange={handleTranslate} disabled={isTranslating}>
                                    <SelectTrigger className="w-[180px]">
                                        <Languages className="mr-2 h-4 w-4" />
                                        <SelectValue placeholder="Translate..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="es">Español</SelectItem>
                                        <SelectItem value="hi">हिन्दी</SelectItem>
                                        <SelectItem value="bn">বাংলা</SelectItem>
                                        <SelectItem value="ta">தமிழ்</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {isTranslating && <span className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/> Translating...</span>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                     {/* Uploaded Image Section */}
                    {report.photoDataUri && (
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Camera /> Uploaded Image</h2>
                        <div className="flex justify-center">
                             <div className="relative w-full max-w-md h-80 rounded-lg overflow-hidden border-4 border-black shadow-lg">
                                <Image src={report.photoDataUri} alt="Uploaded skin condition" layout="fill" objectFit="contain" />
                            </div>
                        </div>
                    </section>
                    )}
                    
                    <Separator/>

                    {/* Potential Conditions */}
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Pill /> Potential Conditions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {displayReport.potentialConditions.map((condition, index) => (
                                <Card key={index} className="bg-muted/30">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{condition.name}</CardTitle>
                                        {'likelihood' in condition && (
                                            <div className="flex items-center gap-4 pt-2">
                                                <Badge className={getLikelihoodColor(condition.likelihood as any)}>Likelihood: {condition.likelihood}</Badge>
                                                <div className="w-full bg-muted rounded-full h-2.5">
                                                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(condition.confidence || 0) * 100}%` }}></div>
                                                </div>
                                                <span className="text-sm font-bold">{((condition.confidence || 0) * 100).toFixed(0)}%</span>
                                            </div>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground text-sm">{condition.description}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                    
                    <Separator />

                    {/* Detailed Analysis */}
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><FileText /> Detailed Analysis</h2>
                        <div className="prose prose-blue dark:prose-invert max-w-none text-foreground/80 p-6 rounded-2xl shadow-lg border border-sky-200 bg-sky-50 transition-shadow duration-300 hover:shadow-xl">
                           <p>{displayReport.report}</p>
                        </div>
                    </section>
                    
                    <Separator />

                    {/* Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section>
                            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Home/> Home Remedies</h2>
                             <div className="prose prose-blue dark:prose-invert max-w-none text-foreground/80 p-6 rounded-2xl shadow-lg border border-sky-200 bg-sky-50 transition-shadow duration-300 hover:shadow-xl">
                                <p>{displayReport.homeRemedies}</p>
                            </div>
                        </section>
                        <section>
                            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Stethoscope/> Medical Recommendation</h2>
                            <div className="prose prose-blue dark:prose-invert max-w-none text-foreground/80 p-6 rounded-2xl shadow-lg border border-sky-200 bg-sky-50 transition-shadow duration-300 hover:shadow-xl">
                                <p>{displayReport.medicalRecommendation}</p>
                            </div>
                        </section>
                    </div>

                    {report.aiReport.doctorConsultationSuggestion && (
                         <div className="!mt-12 text-center print-hidden">
                             <div className="bg-gradient-to-r from-primary to-accent p-8 rounded-2xl inline-block text-white shadow-lg">
                                <h3 className="text-2xl font-bold mb-2">Doctor Consultation Recommended</h3>
                                <p className="opacity-90 mb-6 max-w-xl mx-auto">Based on the analysis, we recommend scheduling a consultation with a dermatologist for proper diagnosis and treatment plan.</p>
                                <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 rounded-full">
                                    <Calendar className="mr-2 h-4 w-4"/> Schedule Consultation
                                </Button>
                             </div>
                         </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
