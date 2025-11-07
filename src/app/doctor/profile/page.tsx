
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { User, ChevronLeft, Edit, Mail, Briefcase, Award, Gift, Camera, Loader2, BadgeCheck, Stethoscope, UploadCloud, FileText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { DoctorProfile, getUserProfile, updateDoctorProfile, uploadProfilePicture, uploadVerificationDocument } from '@/lib/firebase-services';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const profileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  age: z.coerce.number().min(18, 'You must be at least 18.').max(100),
  gender: z.string().min(1, 'Gender is required.'),
  experience: z.coerce.number().min(0, 'Experience cannot be negative.'),
  specialization: z.string().min(2, 'Specialization is required.'),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const degreeInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState<'profile' | 'degree' | 'license' | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      age: '' as any,
      gender: '',
      experience: '' as any,
      specialization: 'Dermatology',
    }
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile && profile.role === 'doctor') {
            const docProfile = profile as DoctorProfile;
            setDoctorProfile(docProfile);
            form.reset({
              name: docProfile.name,
              age: docProfile.age,
              gender: docProfile.gender,
              experience: docProfile.experience || 0,
              specialization: docProfile.specialization || 'Dermatology',
            });
          } else {
             toast({ title: "Error", description: "Could not find doctor profile.", variant: 'destructive' });
             router.push('/login?role=doctor');
          }
        } catch (error) {
            console.error("Error fetching doctor profile:", error);
            toast({ title: "Error", description: "An issue occurred while fetching your profile.", variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
      } else {
         router.push('/login?role=doctor');
      }
    });

    return () => unsubscribe();
  }, [router, toast, form]);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'degree' | 'license') => {
    const file = event.target.files?.[0];
    if (!file || !doctorProfile) return;

    setIsUploading(type);
    toast({ title: 'Uploading...', description: `Your ${type} file is being uploaded.` });
    
    try {
      let newUrl: string;
      if (type === 'profile') {
        newUrl = await uploadProfilePicture(doctorProfile.uid, file);
        setDoctorProfile(prev => prev ? { ...prev, photoURL: newUrl } : null);
      } else {
        newUrl = await uploadVerificationDocument(doctorProfile.uid, file, type);
        if (type === 'degree') {
             setDoctorProfile(prev => prev ? { ...prev, degreeUrl: newUrl } : null);
        } else {
             setDoctorProfile(prev => prev ? { ...prev, additionalFileUrl: newUrl } : null);
        }
      }
      toast({ title: 'Success!', description: `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully.` });
    } catch (error) {
      console.error(`Failed to upload ${type}:`, error);
      toast({ title: 'Upload Failed', description: `Could not upload the ${type}. Please try again.`, variant: 'destructive' });
    } finally {
      setIsUploading(null);
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!doctorProfile) return;
    setIsUpdating(true);
    try {
      await updateDoctorProfile(doctorProfile.uid, data);
      setDoctorProfile(prev => prev ? { ...prev, ...data } : null);
      toast({ title: 'Profile Updated', description: 'Your information has been successfully updated.' });
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      toast({ title: 'Update Failed', description: 'Could not update your profile. Please try again.', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const getStatusBadge = (status: DoctorProfile['verificationStatus']) => {
    const config = {
      approved: { text: 'Verified Professional', icon: BadgeCheck, className: 'bg-green-100 text-green-800 border-green-200' },
      pending: { text: 'Verification Pending', icon: ShieldAlert, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      rejected: { text: 'Verification Failed', icon: ShieldAlert, className: 'bg-red-100 text-red-800 border-red-200' },
    };
    const { text, icon: Icon, className } = config[status];
    return (
      <div className={cn('inline-flex items-center gap-2 py-2 px-4 rounded-full font-semibold text-sm shadow-sm', className)}>
        <Icon size={16}/>
        {text}
      </div>
    )
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2]">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
        <p className="ml-4 text-lg text-white">Loading Profile...</p>
      </div>
    );
  }

  if (!doctorProfile) {
    return (
       <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2]">
          <p className="ml-4 text-lg text-red-200">Could not load doctor profile.</p>
      </div>
    )
  }

  return (
    <>
    <style jsx global>{`
        .profile-body-bg {
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .pulse-animation {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
            100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
        }
    `}</style>
    <div className="profile-body-bg min-h-screen p-5">
        <div className="container mx-auto">
            <Button variant="outline" onClick={() => router.back()} className="mb-8 gap-2 rounded-full bg-white/10 text-white border-white/20 backdrop-blur-sm hover:bg-white/20 hover:text-white transition-all">
                <ChevronLeft className="h-4 w-4" />
                Back to Dashboard
            </Button>
            
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-10 mb-8 shadow-2xl border border-white/30 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#667eea] to-[#f093fb]"></div>
                <div className="relative">
                    <div className="w-36 h-36 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-lg pulse-animation overflow-hidden">
                         {doctorProfile.photoURL ? (
                           <Image src={doctorProfile.photoURL} alt={doctorProfile.name} width={144} height={144} className="object-cover w-full h-full" />
                         ) : (
                           <span className="text-5xl font-bold text-white">{getInitials(doctorProfile.name)}</span>
                         )}
                    </div>
                </div>
                <div className="text-center md:text-left">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">{doctorProfile.name}</h1>
                    <p className="text-lg font-medium text-primary mb-4">{doctorProfile.specialization || 'Dermatologist'}</p>
                    <input type="file" ref={profilePicInputRef} onChange={(e) => handleFileChange(e, 'profile')} accept="image/*" className="hidden" />
                    <Button onClick={() => profilePicInputRef.current?.click()} disabled={isUploading === 'profile'} className="rounded-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-md hover:shadow-lg transition-all">
                        {isUploading === 'profile' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        {isUploading === 'profile' ? 'Uploading...' : 'Change Picture'}
                    </Button>
                </div>
                <div className="ml-auto text-center md:text-right">
                    {getStatusBadge(doctorProfile.verificationStatus)}
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <div className="grid md:grid-cols-3 gap-8">
                  <Card className="md:col-span-2 bg-white/95 backdrop-blur-2xl rounded-2xl p-8 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                      <CardHeader className="flex-row justify-between items-center p-0 mb-6">
                          <CardTitle className="text-xl font-bold flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
                                 <User size={20}/>
                              </div>
                             Personal & Professional Info
                          </CardTitle>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-white">
                                <Edit className="mr-2 h-4 w-4"/> Edit
                            </Button>
                          </DialogTrigger>
                      </CardHeader>
                      <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                              <div className="w-9 h-9 flex-shrink-0 rounded-md flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white"><Mail size={16}/></div>
                              <div>
                                  <p className="text-xs text-muted-foreground">Email Address</p>
                                  <p className="font-semibold text-gray-800">{doctorProfile.email}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                              <div className="w-9 h-9 flex-shrink-0 rounded-md flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white"><Gift size={16}/></div>
                              <div>
                                  <p className="text-xs text-muted-foreground">Age</p>
                                  <p className="font-semibold text-gray-800">{doctorProfile.age} years old</p>
                              </div>
                          </div>
                           <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                              <div className="w-9 h-9 flex-shrink-0 rounded-md flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white"><User size={16}/></div>
                              <div>
                                  <p className="text-xs text-muted-foreground">Gender</p>
                                  <p className="font-semibold text-gray-800">{doctorProfile.gender}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                              <div className="w-9 h-9 flex-shrink-0 rounded-md flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white"><Briefcase size={16}/></div>
                              <div>
                                  <p className="text-xs text-muted-foreground">Experience</p>
                                  <p className="font-semibold text-gray-800">{doctorProfile.experience || 0} years of experience</p>
                              </div>
                          </div>
                           <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                              <div className="w-9 h-9 flex-shrink-0 rounded-md flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white"><Award size={16}/></div>
                              <div>
                                  <p className="text-xs text-muted-foreground">Specialization</p>
                                  <p className="font-semibold text-gray-800">{doctorProfile.specialization || 'Dermatology'}</p>
                              </div>
                          </div>
                      </CardContent>
                  </Card>
                   <Card className="bg-white/95 backdrop-blur-2xl rounded-2xl p-8 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                      <CardHeader className="p-0 mb-6">
                           <CardTitle className="text-xl font-bold flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                                 <UploadCloud size={20}/>
                              </div>
                             Upload Documents
                          </CardTitle>
                          <CardDescription>Upload your degree and license for verification.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 space-y-4">
                          <input type="file" ref={degreeInputRef} onChange={(e) => handleFileChange(e, 'degree')} accept="application/pdf,image/*" className="hidden" />
                          <input type="file" ref={licenseInputRef} onChange={(e) => handleFileChange(e, 'license')} accept="application/pdf,image/*" className="hidden" />
                          
                          <Button onClick={() => degreeInputRef.current?.click()} disabled={isUploading === 'degree'} variant="outline" className="w-full justify-between">
                            {isUploading === 'degree' ? <Loader2 className="animate-spin" /> : <FileText />}
                            <span>{doctorProfile.degreeUrl ? 'Degree Uploaded' : 'Upload Degree'}</span>
                            {doctorProfile.degreeUrl ? <Link href={doctorProfile.degreeUrl} target="_blank" className="text-primary hover:underline">View</Link> : <span />}
                          </Button>
                          
                           <Button onClick={() => licenseInputRef.current?.click()} disabled={isUploading === 'license'} variant="outline" className="w-full justify-between">
                            {isUploading === 'license' ? <Loader2 className="animate-spin" /> : <FileText />}
                            <span>{doctorProfile.additionalFileUrl ? 'License Uploaded' : 'Upload License'}</span>
                            {doctorProfile.additionalFileUrl ? <Link href={doctorProfile.additionalFileUrl} target="_blank" className="text-primary hover:underline">View</Link> : <span />}
                          </Button>
                      </CardContent>
                  </Card>
              </div>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                  <DialogDescription>
                    Make changes to your profile here. Click save when you're done.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                     <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="age" render={({ field }) => (
                        <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem><FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="experience" render={({ field }) => (
                        <FormItem><FormLabel>Experience (years)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="specialization" render={({ field }) => (
                        <FormItem><FormLabel>Specialization</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancel</Button>
                      </DialogClose>
                      <Button type="submit" disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
        </div>
    </div>
    </>
  );
}
