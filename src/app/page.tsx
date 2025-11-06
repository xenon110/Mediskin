
import Features from '@/components/landing/features';
import Footer from '@/components/landing/footer';
import Hero from '@/components/landing/hero';
import LoginOptions from '@/components/landing/login-options';
import Header from '@/components/landing/header';

export default function Home() {
  return (
    <div className="landing-body">
      <Header />
      <Hero />
      <LoginOptions />
      <Features />
      <Footer />
    </div>
  );
}

    