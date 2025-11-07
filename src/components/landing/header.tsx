
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

const Header = () => {
    const router = useRouter();

    return (
        <header className="landing-header">
            <div className="landing-logo">
                <div className="landing-logo-icon">M</div>
                MEDISKIN
            </div>
            <nav className="landing-nav">
                <Link href="#features">Features</Link>
                <Link href="/#about">About</Link>
                <Link href="/#security">Security</Link>
                <Link href="/help">Contact</Link>
            </nav>
            <a onClick={() => router.push('/emergency')} className="landing-emergency-btn cursor-pointer">Emergency</a>
        </header>
    );
};

export default Header;
