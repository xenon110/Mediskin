
import { BrainCircuit, Zap, UserCheck, Globe, ShieldCheck, MessagesSquare } from 'lucide-react';

const benefits = [
  {
    icon: '🧠',
    title: 'AI-Powered Analysis',
    description: 'Our advanced machine learning algorithms analyze thousands of dermatological patterns to provide accurate, instant skin condition identification.',
  },
  {
    icon: '⚡',
    title: 'Instant Results',
    description: 'Get comprehensive skin analysis within seconds. No waiting for appointments - immediate insights at your fingertips, anytime, anywhere.',
  },
  {
    icon: '👨‍⚕️',
    title: 'Expert Verification',
    description: 'All AI analysis is reviewed and verified by certified dermatologists, ensuring you receive professional-grade medical guidance and peace of mind.',
  },
  {
    icon: '🌐',
    title: 'Multi-Language Support',
    description: 'Access our platform in your preferred language with support for multiple languages, making skin health accessible to everyone worldwide.',
  },
  {
    icon: '🔒',
    title: 'Privacy & Security',
    description: 'Your medical data is protected with bank-level encryption and HIPAA compliance, ensuring complete privacy and secure medical record management.',
  },
  {
    icon: '💬',
    title: 'Seamless Communication',
    description: 'Connect directly with dermatologists through our intuitive WhatsApp-style interface for ongoing consultation and personalized care recommendations.',
  },
];

const Features = () => {
  return (
    <section className="why-choose">
        <h2>Why Choose MEDISKIN?</h2>
        <p>Advanced technology meets medical expertise</p>
        
        <div className="benefits-grid">
            {benefits.map((benefit, index) => (
                <div key={index} className="benefit-card">
                    <div className="benefit-icon">{benefit.icon}</div>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.description}</p>
                </div>
            ))}
        </div>
    </section>
  );
};

export default Features;

    