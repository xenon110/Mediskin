
import { doc, setDoc, getDoc, collection, getDocs, query, where, FieldValue, serverTimestamp, addDoc, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db, storage } from './firebase';
import type { GenerateInitialReportOutput } from '@/ai/flows/generate-initial-report';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';


// Type definitions based on your schema
export type UserProfile = {
  uid: string;
  email: string;
  role: 'patient' | 'doctor';
  name: string;
  age: number;
  createdAt: FieldValue;
  gender: string;
  photoURL?: string;
};

export type PatientProfile = UserProfile & {
  role: 'patient';
  region: string;
  skinTone: string;
};

export type DoctorProfile = UserProfile & {
  role: 'doctor';
  experience?: number;
  specialization?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  degreeUrl?: string;
  additionalFileUrl?: string;
};

// This data comes from the signup form
export type CreateUserProfileData = {
  email: string;
  role: 'patient' | 'doctor';
  name: string;
  age: number;
  gender: string;
  // Patient-specific fields
  skinTone?: string;
  region?: string;
  // Doctor-specific fields
  experience?: number;
  specialization?: string;
};

export type DoctorNote = {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: FieldValue | Timestamp;
};


// This function creates a user document in Firestore in the correct collection.
export const createUserProfile = async (uid: string, data: CreateUserProfileData) => {
  if (!db) throw new Error("Firestore is not initialized.");
  
  const collectionName = data.role === 'doctor' ? 'doctors' : 'patients';
  const userRef = doc(db, collectionName, uid);

  const commonData = {
    uid,
    email: data.email,
    role: data.role,
    name: data.name,
    age: data.age,
    gender: data.gender,
    createdAt: serverTimestamp(),
    photoURL: '',
  };

  let userData: PatientProfile | DoctorProfile;

  if (data.role === 'patient') {
    userData = {
      ...commonData,
      role: 'patient',
      region: data.region || 'N/A',
      skinTone: data.skinTone || 'N/A',
    };
  } else { // Doctor
    userData = {
      ...commonData,
      role: 'doctor',
      experience: data.experience || 0,
      specialization: data.specialization || 'Dermatology',
      verificationStatus: 'approved', // Auto-approved as per last request
    };
  }

  await setDoc(userRef, userData, { merge: true });
  return userData;
};

// This function retrieves a user's profile from either collection.
export const getUserProfile = async (uid: string): Promise<(PatientProfile | DoctorProfile | null)> => {
  if (!db) throw new Error("Firestore is not initialized.");

  // Check doctors collection first
  const doctorRef = doc(db, 'doctors', uid);
  const doctorSnap = await getDoc(doctorRef);
  if (doctorSnap.exists()) {
    return { uid: doctorSnap.id, ...doctorSnap.data() } as DoctorProfile;
  }

  // If not found, check patients collection
  const patientRef = doc(db, 'patients', uid);
  const patientSnap = await getDoc(patientRef);
  if (patientSnap.exists()) {
    return { uid: patientSnap.id, ...patientSnap.data() } as PatientProfile;
  }

  // If not found in either, return null
  return null;
};

export const updatePatientProfile = async (uid: string, data: Partial<PatientProfile>) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const patientRef = doc(db, 'patients', uid);
    await updateDoc(patientRef, data);
};

export type Report = {
  id: string;
  reportName: string;
  patientId: string;
  patientProfile?: PatientProfile;
  doctorId?: string | null;
  doctorProfile?: DoctorProfile;
  aiReport: GenerateInitialReportOutput;
  status: 'pending-doctor-review' | 'doctor-approved' | 'doctor-modified' | 'rejected' | 'pending-patient-input';
  createdAt: FieldValue | Timestamp | { seconds: number, nanoseconds: number };
  doctorNotes?: string;
  prescription?: string;
  photoDataUri?: string;
}

export const saveReport = async (patientId: string, reportName: string, reportData: GenerateInitialReportOutput, photoDataUri: string): Promise<Report> => {
    if (!db) throw new Error("Firestore is not initialized.");

    const reportsCollection = collection(db, 'reports');
    
    const newReportData = {
        patientId: patientId,
        reportName: reportName,
        aiReport: reportData,
        status: 'pending-patient-input' as const,
        createdAt: serverTimestamp(),
        doctorId: null,
        doctorNotes: '',
        prescription: '',
        photoDataUri: photoDataUri,
    };

    const reportDocRef = await addDoc(reportsCollection, newReportData);

    return {
        id: reportDocRef.id,
        ...newReportData,
    }
};

export const getReportsForPatient = async (patientId: string): Promise<Report[]> => {
    if (!db) throw new Error("Firestore is not initialized.");
    const reportsCollection = collection(db, 'reports');
    const q = query(reportsCollection, where("patientId", "==", patientId));
    const querySnapshot = await getDocs(q);

    const reportsPromises = querySnapshot.docs.map(async (docSnapshot) => {
      const report = { id: docSnapshot.id, ...docSnapshot.data() } as Report;
      if (report.doctorId) {
        const doctorProfile = await getUserProfile(report.doctorId) as DoctorProfile | null;
        if (doctorProfile) {
            report.doctorProfile = doctorProfile;
        }
      }
      return report;
    });
    
    let reports = await Promise.all(reportsPromises);
    
    // Sort reports by creation date client-side
    reports.sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds || 0;
        const timeB = (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
    });

    return reports;
};

export const getReportsForDoctor = async (doctorId: string): Promise<Report[]> => {
    if (!db) throw new Error("Firestore is not initialized.");
    const reportsCollection = collection(db, 'reports');
    const q = query(reportsCollection, where("doctorId", "==", doctorId));
    const querySnapshot = await getDocs(q);
    const reports: Report[] = [];

    for (const docSnapshot of querySnapshot.docs) {
      const report = { id: docSnapshot.id, ...docSnapshot.data() } as Report;
      if (report.patientId) {
        const patientProfile = await getUserProfile(report.patientId) as PatientProfile | null;
        if (patientProfile) {
            report.patientProfile = patientProfile;
        }
      }
      reports.push(report);
    }
    return reports;
};


export const getDoctors = async (): Promise<DoctorProfile[]> => {
  if (!db) throw new Error("Firestore is not initialized.");
  const doctorsCollection = collection(db, 'doctors');
  // Only fetch doctors who have been approved.
  const q = query(doctorsCollection, where("verificationStatus", "==", "approved"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as DoctorProfile));
};

export const sendReportToDoctor = async (reportId: string, doctorId: string) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
        doctorId: doctorId,
        status: 'pending-doctor-review'
    });
};

export const updateReportByDoctor = async (reportId: string, status: Report['status'], doctorNotes: string) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
        status: status,
        doctorNotes: doctorNotes
    });
};

export const updateDoctorProfile = async (uid: string, data: Partial<DoctorProfile>) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const doctorRef = doc(db, 'doctors', uid);
    await setDoc(doctorRef, data, { merge: true });
};

export const uploadProfilePicture = async (uid: string, file: File): Promise<string> => {
    if (!storage || !db) throw new Error("Firebase services not initialized.");

    const filePath = `profile-pictures/${uid}/${file.name}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, file);
    const photoURL = await getDownloadURL(storageRef);

    // After uploading, update the doctor's profile with the new URL
    await updateDoctorProfile(uid, { photoURL });
    
    return photoURL;
}

export const uploadVerificationDocument = async (uid: string, file: File, type: 'degree' | 'license'): Promise<string> => {
    if (!storage || !db) throw new Error("Firebase services not initialized.");
    
    const filePath = `verification-documents/${uid}/${type}-${file.name}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    // Update the doctor's profile with the URL of the uploaded document
    const dataToUpdate = type === 'degree' ? { degreeUrl: downloadURL } : { additionalFileUrl: downloadURL };
    
    await updateDoctorProfile(uid, dataToUpdate);

    return downloadURL;
}


export const logEmergency = async (patientId: string) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const emergenciesCollection = collection(db, 'emergencies');
    await addDoc(emergenciesCollection, {
        patientId: patientId,
        timestamp: serverTimestamp()
    });
};

export const saveDoctorNote = async (doctorId: string, date: string, note: string) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const noteId = `${doctorId}_${date}`;
    const noteRef = doc(db, 'doctorNotes', noteId);
    await setDoc(noteRef, {
        doctorId,
        date,
        note,
        createdAt: serverTimestamp(),
    }, { merge: true });
};

export const getDoctorNotesForMonth = async (doctorId: string, year: number, month: number): Promise<DoctorNote[]> => {
    if (!db) return [];
    
    // Construct start and end dates for the month
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

    const notesCollection = collection(db, 'doctorNotes');
    const q = query(
        notesCollection,
        where('doctorId', '==', doctorId),
        where('date', '>=', startDate),
        where('date', '<', endDate)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DoctorNote));
};
