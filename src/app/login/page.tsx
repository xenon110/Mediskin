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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/firebase-services';
import React, { useState } from 'react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-login">
            <Loader2 className="h-12 w-12 animate-spin text-white" />
        </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
