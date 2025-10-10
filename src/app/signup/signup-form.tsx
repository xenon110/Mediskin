'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { indianStates } from '@/lib/indian-states';
import { FirebaseError } from 'firebase/app';
import { Separator } from '@/components/ui/separator';


const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  age: z.coerce.number().min(1, 'Age must be a positive number.').max(120),
  gender: z.string().min(1, 'Please select a gender.'),
  skinTone: z.string().min(1, 'Please select a skin tone.'),
  region: z.string().min(1, 'Please select your state.'),
  mobile: z.string().regex(/^\d{10}$/, 'Please enter a valid 10-digit mobile number.'),
  email: z.string().email().regex(/^[a-zA-Z0-9._%+-]+@gmail\.com$/, 'Please enter a valid Gmail address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type SignupFormValues = z.infer<typeof signupSchema>;


export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const role = searchParams.get('role') === 'doctor' ? 'doctor' : 'patient';

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      age: undefined,
      gender: '',
      skinTone: '',
      region: '',
      mobile: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    
    try {
      const functions = getFunctions();
      const sendOtpEmail = httpsCallable(functions, 'sendOtpEmail');
      const verifyOtpAndCreateUser = httpsCallable(functions, 'verifyOtpAndCreateUser');

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store verification data temporarily in a session or pass it securely
      sessionStorage.setItem('verificationData', JSON.stringify({ ...data, role }));
      sessionStorage.setItem('userEmail', data.email);

      // Save temporary data to Firestore for server-side verification
      const verificationRef = doc(db, "verifications", data.email);
      await setDoc(verificationRef, {
        otp: otp, // In a real app, you'd hash this OTP
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        userData: { ...data, role }
      });
      
      // Call the Cloud Function to send the email
      await sendOtpEmail({ email: data.email, otp });

      toast({
        title: 'Verification Code Sent!',
        description: 'A 6-digit code has been sent to your Gmail. Please use it to verify your account.',
      });
      
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`);

    } catch (error: any) {
        let description = 'An unexpected error occurred. Please try again.';
        if (error.code === 'functions/internal') {
             description = error.message;
        }
        toast({ variant: 'destructive', title: 'Sign Up Failed', description });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-subtle">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Create a {role === 'doctor' ? 'Doctor' : 'Patient'} Account</CardTitle>
          <CardDescription>Please fill in your details to get started.</CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Enter your full name" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" placeholder="Enter your age" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem><FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select your gender" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                 <FormField control={form.control} name="mobile" render={({ field }) => (
                  <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input type="tel" placeholder="10-digit mobile number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="region" render={({ field }) => (
                    <FormItem><FormLabel>State / Region</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select your state" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {indianStates.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                 <FormField control={form.control} name="skinTone" render={({ field }) => (
                    <FormItem><FormLabel>Skin Tone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select your skin tone" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Fair">Fair</SelectItem>
                          <SelectItem value="Wheatish">Wheatish</SelectItem>
                          <SelectItem value="Dusky">Dusky</SelectItem>
                          <SelectItem value="Dark">Dark</SelectItem>
                          <SelectItem value="Olive">Olive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
              </div>
              
              <Separator />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Gmail Address</FormLabel><FormControl><Input type="email" placeholder="you@gmail.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <Button type="submit" disabled={isLoading} className="w-full bg-gradient-login text-white">
                {isLoading ? <Loader2 className="animate-spin" /> : 'Get Verification Code'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link href={`/login?role=${role}`}>Login</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
