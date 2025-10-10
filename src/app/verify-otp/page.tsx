'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits.'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

function VerifyOtpComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const email = searchParams.get('email');
  
  const form = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  useEffect(() => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No email address found. Please start the registration process again.',
      });
      router.push('/signup');
    }
  }, [email, router, toast]);

  const onSubmit = async (data: OtpFormValues) => {
    setIsLoading(true);
    
    const verificationDataString = sessionStorage.getItem('verificationData');
    if (!verificationDataString || !email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Session expired. Please sign up again.' });
      router.push('/signup');
      return;
    }
    
    try {
      const functions = getFunctions();
      const verifyOtpAndCreateUser = httpsCallable(functions, 'verifyOtpAndCreateUser');

      const result = await verifyOtpAndCreateUser({
        email,
        otp: data.otp,
        userData: JSON.parse(verificationDataString),
      });

      if ((result.data as any).success) {
        toast({
          title: 'Account Created Successfully!',
          description: 'You can now log in with your credentials.',
        });
        sessionStorage.removeItem('verificationData');
        sessionStorage.removeItem('userEmail');
        const role = JSON.parse(verificationDataString).role;
        router.push(`/login?role=${role}`);
      }
    } catch (error: any) {
      let description = 'An unexpected error occurred.';
      if (error.code === 'functions/internal' || error.code === 'functions/not-found' || error.code === 'functions/permission-denied' || error.code === 'functions/deadline-exceeded' || error.code === 'functions/already-exists') {
        description = error.message;
      }
      toast({ variant: 'destructive', title: 'Verification Failed', description });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-login">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
          <CardTitle className="font-headline text-3xl mt-4">Verify Your Email</CardTitle>
          <CardDescription>
            A 6-digit code was sent to <strong>{email}</strong>. Please enter it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input 
                        type="tel" 
                        placeholder="••••••" 
                        {...field}
                        className="text-center text-2xl tracking-[1em]"
                        maxLength={6}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full bg-gradient-login text-white">
                {isLoading ? <Loader2 className="animate-spin" /> : 'Verify and Create Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


export default function VerifyOtpPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        }>
            <VerifyOtpComponent />
        </Suspense>
    )
}
