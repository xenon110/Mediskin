
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Settings, FileText, LogOut, Activity, BarChart, PieChartIcon, Clock, CheckCircle, XCircle, MessageSquare, LayoutGrid } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { Report, getUserProfile, DoctorProfile } from '@/lib/firebase-services';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import { Bar, BarChart as RechartsBarChart, Pie, PieChart as RechartsPieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartContainer,
} from '@/components/ui/chart';

export default function DoctorAnalytics() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedReports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(fetchedReports);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching reports for analytics:", error);
      toast({ title: 'Error', description: 'A problem occurred while fetching analytics data.', variant: 'destructive' });
      setIsLoading(false);
    });

    return () => unsubscribe && unsubscribe();
  }, [router, toast]);
  
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

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending-doctor-review').length,
    reviewed: reports.filter(r => r.status === 'doctor-approved' || r.status === 'doctor-modified').length,
    rejected: reports.filter(r => r.status === 'rejected').length,
  };

  const statusData = [
    { name: 'Pending', value: stats.pending },
    { name: 'Reviewed', value: stats.reviewed },
    { name: 'Rejected', value: stats.rejected },
  ];
  
  const chartConfig = {
    pending: { label: 'Pending', color: 'hsl(var(--chart-1))' },
    reviewed: { label: 'Reviewed', color: 'hsl(var(--chart-2))' },
    rejected: { label: 'Rejected', color: 'hsl(var(--chart-3))' },
  }

  const weeklyActivity = reports.reduce((acc, report) => {
    const date = (report.createdAt as any)?.seconds ? new Date((report.createdAt as any).seconds * 1000) : new Date();
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const weeklyChartData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({
    day,
    reports: weeklyActivity[day] || 0,
  }));
  
  const sidebarNavItems = [
    { href: '/doctor/dashboard', icon: MessageSquare, title: 'Patient Cases' },
    { href: '/doctor/analytics', icon: LayoutGrid, title: 'Analytics' },
    { href: '/doctor/settings', icon: Settings, title: 'Settings' },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Analytics...</p>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
       {/* Sidebar */}
       <div className="hidden border-r bg-muted/40 md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <FileText className="h-6 w-6" />
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

        {/* Main Analytics Panel */}
        <div className="flex flex-col">
             <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
                <div className="w-full flex-1">
                    <h1 className="text-lg font-semibold md:text-2xl">Analytics Dashboard</h1>
                </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
                 <p className="text-muted-foreground">Welcome back, {doctorProfile ? `Dr. ${doctorProfile.name}` : 'Doctor'}</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground">All-time patient reports</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.pending}</div>
                            <p className="text-xs text-muted-foreground">Reports awaiting assessment</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Reviewed Cases</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.reviewed}</div>
                            <p className="text-xs text-muted-foreground">Approved or modified reports</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.rejected}</div>
                            <p className="text-xs text-muted-foreground">Reports needing more info</p>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <Card className="lg:col-span-3">
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BarChart/> Weekly Activity</CardTitle>
                            <CardDescription>Number of reports received per day this week.</CardDescription>
                         </CardHeader>
                         <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <RechartsBarChart data={weeklyChartData}>
                                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                                    <Bar dataKey="reports" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                         </CardContent>
                    </Card>
                     <Card className="lg:col-span-2">
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2"><PieChartIcon/> Report Status Breakdown</CardTitle>
                            <CardDescription>A summary of all your report statuses.</CardDescription>
                         </CardHeader>
                         <CardContent>
                           <ChartContainer config={chartConfig} className="mx-auto aspect-square h-full w-full">
                              <RechartsPieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                   {statusData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={`var(--color-${entry.name.toLowerCase()})`} />
                                  ))}
                                </Pie>
                                <Legend/>
                              </RechartsPieChart>
                            </ChartContainer>
                         </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    </div>
  );
}
