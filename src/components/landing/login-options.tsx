
'use client';

import { useRouter } from 'next/navigation';

const LoginOptions = () => {
  const router = useRouter();

  const patientFeatures = [
    'Upload & analyze skin images',
    'AI-powered symptom assessment',
    'Personalized home remedies',
    'Connect with dermatologists',
    'Multi-language support',
    'Secure medical records',
  ];

  const doctorFeatures = [
    'Review AI-generated reports',
    'Professional verification system',
    'Secure patient communication',
    'Customize prescriptions',
    'Medical document management',
    'WhatsApp-style interface',
  ];

  return (
    <section className="login-section">
        <h2>Choose Your Login</h2>
        <p>Select how you'd like to access the MEDISKIN platform</p>
        
        <div className="login-grid">
            <div className="login-card">
                <div className="login-icon">👤</div>
                <h3>Patient Login</h3>
                <p>Upload your skin condition images and get AI-powered analysis with personalized recommendations.</p>
                
                <ul className="feature-list">
                    {patientFeatures.map(feature => <li key={feature}>{feature}</li>)}
                </ul>
                
                <button className="login-btn patient-btn" onClick={() => router.push('/payment')}>Login as Patient</button>
            </div>
            
            <div className="login-card">
                <div className="login-icon">🩺</div>
                <h3>Doctor Login</h3>
                <p>Verify AI-generated reports, provide professional consultation, and manage patient communications.</p>
                
                <ul className="feature-list">
                    {doctorFeatures.map(feature => <li key={feature}>{feature}</li>)}
                </ul>
                
                <button className="login-btn doctor-btn" onClick={() => router.push('/doctor/payment')}>Login as Doctor</button>
            </div>
        </div>
    </section>
  );
};

export default LoginOptions;

    