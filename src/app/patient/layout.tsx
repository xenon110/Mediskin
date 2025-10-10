
'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { getUserProfile, PatientProfile } from '@/lib/firebase-services';
import { useToast } from '@/hooks/use-toast';

// Function to check if a patient's profile is complete
const isProfileComplete = (profile: PatientProfile): boolean => {
    return !!(profile.age && profile.gender && profile.region && profile.skinTone);
};

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userProfile = await getUserProfile(user.uid);
          
          if (userProfile && userProfile.role === 'patient') {
            const patientProfile = userProfile as PatientProfile;
            // If the profile is NOT complete and they aren't already on the complete-profile page...
            if (!isProfileComplete(patientProfile) && pathname !== '/patient/complete-profile') {
                // ...redirect them to complete it.
                router.replace('/patient/complete-profile');
                // No need to set loading to false, redirect will handle it.
                return;
            }
            
            // If the profile IS complete and they are trying to access the complete-profile page...
            if(isProfileComplete(patientProfile) && pathname === '/patient/complete-profile'){
                //...redirect them to the dashboard.
                router.replace('/patient/dashboard');
                return;
            }

            setIsAuthorized(true);
          } else {
            // This user is not a patient, or has no profile.
            toast({
              variant: 'destructive',
              title: 'Access Denied',
              description: 'This account is not authorized for the patient dashboard.',
            });
            await auth.signOut();
            router.push('/login?role=doctor');
          }
        } catch (error) {
           console.error("Authorization check failed:", error);
           toast({
              variant: 'destructive',
              title: 'Authorization Error',
              description: 'Could not verify your role. Please try logging in again.',
           });
           await auth.signOut();
           router.push('/login?role=patient');
        } finally {
            setIsLoading(false);
        }
      } else {
        // No user is signed in, redirect to login.
        router.push('/login?role=patient');
      }
    });

    return () => unsubscribe();
  }, [router, toast, pathname]);


  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Verifying your session...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    // This state is hit if auth fails. The redirect has already been triggered.
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
}
