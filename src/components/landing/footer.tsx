
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="landing-footer">
        <div className="footer-links">
            <Link href="/#privacy">Privacy Policy</Link>
            <Link href="/#terms">Terms of Service</Link>
            <Link href="/#about">About Us</Link>
            <Link href="/help">Contact</Link>
            <Link href="/help">Support</Link>
        </div>
        
        <div className="footer-bottom">
            <p>© {new Date().getFullYear()} MEDISKIN. All rights reserved. | Made with ❤️ for better healthcare</p>
        </div>
    </footer>
  );
};

export default Footer;

    