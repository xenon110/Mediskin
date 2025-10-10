
'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import { getUserProfile, createUserProfile } from '@/lib/firebase-services';
import React, { useState } from 'react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const role = searchParams.get('role') === 'doctor' ? 'doctor' : 'patient';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    if (!auth) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firebase is not configured.' });
      setIsLoading(false);
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      let userProfile = await getUserProfile(user.uid);

      if (!userProfile) {
        // If user signs in with Google but has no profile, create one with only basic info
        const profileData = {
          email: user.email!,
          role: role,
          name: user.displayName || 'New User',
        };
        userProfile = await createUserProfile(user.uid, profileData as any);
        toast({ title: 'Account Created', description: 'Welcome to MediSkin!' });
      }

      if (userProfile.role !== role) {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Role Mismatch',
          description: `This account is registered as a ${userProfile.role}. Please log in on the correct page.`,
        });
        setIsLoading(false);
        return;
      }
      
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      // Redirect to the dashboard, the layout will handle profile completion check
      router.push(role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard');

    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      toast({ variant: 'destructive', title: 'Sign-In Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    if (!auth) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Firebase is not configured. Please check your setup.',
        });
        setIsLoading(false);
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        const user = userCredential.user;

        const userProfile = await getUserProfile(user.uid);
        
        if (!userProfile) {
          throw new Error("Unable to find user profile.");
        }
        
        if (role === 'doctor' && userProfile.role === 'doctor') {
            toast({ title: 'Login Successful', description: 'Welcome back, Doctor!' });
            router.push('/doctor/dashboard');
        } else if (role === 'patient' && userProfile.role === 'patient') {
            toast({ title: 'Login Successful', description: 'Welcome back!' });
            // Redirect to dashboard, layout handles profile check
            router.push('/patient/dashboard');
        } else {
             await auth.signOut();
             throw new Error(`This account is not a ${role} account. Please use the correct login form.`);
        }
    } catch (error) {
        let description = 'An unexpected error occurred. Please try again.';
        if (error instanceof FirebaseError) {
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/invalid-email':
                case 'auth/invalid-credential':
                    description = 'Invalid credentials. Please check your email and password.';
                    break;
                case 'auth/wrong-password':
                    description = 'Incorrect password. Please try again.';
                    break;
                case 'auth/too-many-requests':
                    description = 'Access to this account has been temporarily disabled due to many failed login attempts. You can reset your password or try again later.';
                    break;
                default:
                    description = 'An error occurred during login. Please check your credentials.';
            }
        } else if (error instanceof Error) {
            description = error.message;
        }
        toast({ variant: 'destructive', title: 'Login Failed', description });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-login">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Login</CardTitle>
          <CardDescription>
            Access your {role} account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Button onClick={handleGoogleSignIn} disabled={isLoading} variant="outline" className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <svg className="w-5 h-5 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                      <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512S0 403.3 0 261.8 106.5 11.6 244 11.6c67.7 0 121.1 26.1 165.2 65.5l-65.5 63.5c-21.4-20.3-49-32.3-80.7-32.3-62.3 0-113.5 51.2-113.5 113.5s51.2 113.5 113.5 113.5c71.2 0 98.7-52.9 101.7-79.5H244V243.3h185.3c3.1 16.3 4.7 34.5 4.7 53.5z"></path>
                    </svg>
                    Sign in with Google
                  </>
                )}
            </Button>

             <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading} className="w-full bg-gradient-login text-white">
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Login with Email'}
                  </Button>
              </form>
            </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link href={`/signup?role=${role}`}>Sign up</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
