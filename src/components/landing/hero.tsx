
'use client';
import { useRouter } from 'next/navigation';

const Hero = () => {
  const router = useRouter();

  return (
    <section className="landing-hero">
        <h1>AI-Powered Skin Health for Everyone</h1>
        <p>Get instant skin condition analysis, personalized treatment recommendations, and connect with verified dermatologists - all powered by advanced artificial intelligence.</p>
        
        <div className="features-grid">
            <div className="feature-btn">🔬 HIPAA Compliant</div>
            <div className="feature-btn">🛡️ End-to-End Encrypted</div>
            <div className="feature-btn">⚡ Instant Analysis</div>
            <div className="feature-btn">🌍 Multi-Language</div>
        </div>
        
        <a onClick={() => router.push('/login?role=patient')} className="cta-btn cursor-pointer">Start Your Free Analysis</a>
    </section>
  );
};

export default Hero;

    