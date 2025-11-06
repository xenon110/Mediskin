'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, MessageSquare, LayoutGrid, Settings, FileText, LogOut, Activity, BarChart, PieChartIcon, Clock, CheckCircle, XCircle } from 'lucide-react';
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

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending-doctor-review').length,
    reviewed: reports.filter(r => r.status === 'doctor-approved' || r.status === 'doctor-modified').length,
    rejected: reports.filter(r => r.status === 'rejected').length,
  };

  const statusData = [
    { name: 'Pending', value: stats.pending, fill: 'var(--color-pending)' },
    { name: 'Reviewed', value: stats.reviewed, fill: 'var(--color-reviewed)' },
    { name: 'Rejected', value: stats.rejected, fill: 'var(--color-rejected)' },
  ];
  const chartConfig = {
    pending: { label: 'Pending', color: 'hsl(var(--chart-2))' },
    reviewed: { label: 'Reviewed', color: 'hsl(var(--chart-1))' },
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
    <div className="grid h-screen w-screen overflow-hidden" style={{gridTemplateColumns: '80px 1fr'}}>
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

        {/* Main Analytics Panel */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto">
             <div className="p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
                    <p className="text-gray-500">Welcome back, {doctorProfile ? `Dr. ${doctorProfile.name}` : 'Doctor'}</p>
                </header>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="bg-blue-100 border-blue-200 rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-blue-800">Total Reports Received</CardTitle>
                            <Activity className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
                            <p className="text-xs text-blue-700">All-time patient reports</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-100 border-amber-200 rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-amber-800">Pending Review</CardTitle>
                            <Clock className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-900">{stats.pending}</div>
                            <p className="text-xs text-amber-700">Reports waiting for your assessment</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-100 border-green-200 rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-green-800">Reviewed Cases</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-900">{stats.reviewed}</div>
                            <p className="text-xs text-green-700">Reports you have approved or modified</p>
                        </CardContent>
                    </Card>
                     <Card className="bg-red-100 border-red-200 rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-red-800">Disqualified / More Info</CardTitle>
                            <XCircle className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-900">{stats.rejected}</div>
                            <p className="text-xs text-red-700">Reports needing patient follow-up</p>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <Card className="lg:col-span-3 rounded-xl">
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BarChart/> Weekly Activity</CardTitle>
                            <CardDescription>Number of reports received per day this week.</CardDescription>
                         </CardHeader>
                         <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <RechartsBarChart data={weeklyChartData}>
                                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ background: "white", border: "1px solid #ccc", borderRadius: "8px" }} />
                                    <Bar dataKey="reports" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                         </CardContent>
                    </Card>
                     <Card className="lg:col-span-2 rounded-xl">
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
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Legend/>
                              </RechartsPieChart>
                            </ChartContainer>
                         </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    </div>
  );
}