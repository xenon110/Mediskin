
import Features from '@/components/landing/features';
import Footer from '@/components/landing/footer';
import Hero from '@/components/landing/hero';
import LoginOptions from '@/components/landing/login-options';
import Header from '@/components/landing/header';
import ImageSlider from '@/components/landing/image-slider';

export default function Home() {
  return (
    <div className="landing-body">
      <Header />
      <Hero />
      <ImageSlider />
      <LoginOptions />
      <Features />
      <Footer />
    </div>
  );
}
