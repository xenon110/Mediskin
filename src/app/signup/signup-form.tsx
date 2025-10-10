
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
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { FileUp, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createUserProfile, getUserProfile } from '@/lib/firebase-services';
import { indianStates } from '@/lib/indian-states';


const patientSignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  age: z.coerce.number().min(1, 'Age is required.').max(120),
  gender: z.string().min(1, 'Gender is required.'),
  skinTone: z.string().min(1, 'Skin tone is required.'),
  region: z.string().min(1, 'Region is required.'),
});

// We keep the schema for validation but will populate it from Google Sign-In
const doctorSignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  age: z.coerce.number().min(18, 'You must be at least 18.').max(100),
  gender: z.string().min(1, 'Gender is required.'),
  experience: z.coerce.number().min(0, 'Experience cannot be negative.'),
  degree: z.any().refine(file => file?.length == 1, 'Degree certificate is required.'),
  additionalFile: z.any().optional(),
});

type PatientSignupForm = z.infer<typeof patientSignupSchema>;
type DoctorSignupForm = z.infer<typeof doctorSignupSchema>;


export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const role = searchParams.get('role') === 'doctor' ? 'doctor' : 'patient';

  const form = useForm<PatientSignupForm | DoctorSignupForm>({
    resolver: zodResolver(role === 'doctor' ? doctorSignupSchema : patientSignupSchema),
    defaultValues: role === 'doctor' 
      ? { name: '', email: '', age: 30, gender: 'Other', experience: 5 }
      : { name: '', email: '', age: 30, gender: '', skinTone: '', region: '' },
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
        // User is new, create a profile
        const profileData = {
          email: user.email!,
          role: role,
          name: user.displayName || 'New User',
          age: 30, // Default age, can be collected later
          gender: 'Other', // Default gender
          ...(role === 'patient' && { skinTone: 'Type III', region: 'Delhi' }),
          ...(role === 'doctor' && { experience: 0, verificationStatus: 'pending' }),
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
      router.push(role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard');

    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      toast({ variant: 'destructive', title: 'Sign-In Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };


  const renderPatientForm = () => (
    <>
      <p className="text-center text-sm text-muted-foreground mb-4">
        Create your patient account by signing in with Google. This ensures your email is valid and your account is secure.
      </p>
    </>
  );

  const renderDoctorForm = () => {
      return (
        <>
            <p className="text-center text-sm text-muted-foreground mb-4">
                To create a doctor account, please sign in with your professional Google account.
            </p>
            {/* The rest of the form for file uploads could be shown after initial sign-in */}
        </>
      );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-subtle">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Create a {role === 'doctor' ? 'Doctor' : 'Patient'} Account</CardTitle>
          <CardDescription>Join MEDISKIN by using a secure Google account.</CardDescription>
        </CardHeader>
        
            <CardContent className="space-y-4">
                {role === 'doctor' ? renderDoctorForm() : renderPatientForm()}
                 <Button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    {isLoading ? <Loader2 className="animate-spin" /> : (
                      <>
                        <svg className="w-5 h-5 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                          <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512S0 403.3 0 261.8 106.5 11.6 244 11.6c67.7 0 121.1 26.1 165.2 65.5l-65.5 63.5c-21.4-20.3-49-32.3-80.7-32.3-62.3 0-113.5 51.2-113.5 113.5s51.2 113.5 113.5 113.5c71.2 0 98.7-52.9 101.7-79.5H244V243.3h185.3c3.1 16.3 4.7 34.5 4.7 53.5z"></path>
                        </svg>
                        Sign up with Google
                      </>
                    )}
                </Button>
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
