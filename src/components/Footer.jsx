import { Link } from 'react-router-dom';
import './Footer.css';

const footerLinks = {
  Explore: [
    { to: '/#method', label: 'Method' },
    { to: '/about', label: 'About' },
    { to: '/events', label: 'Events' },
    { to: '/programs', label: 'Programs' },
    { to: '/merch', label: 'Merch' },
  ],
  Resources: [
    { to: '/get-started', label: 'Get Started' },
    { to: '/faq', label: 'FAQ' },
  ],
  Legal: [
    { to: '/terms', label: 'Terms of Use' },
    { to: '/privacy', label: 'Privacy Policy' },
    { to: '/cookie-policy', label: 'Cookie Policy' },
  ],
};

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <div>
            <Link className="brand" to="/" style={{ padding: 0 }}>
              <img src="/img/hyrax-fitness-logo-512x512.png" alt="Hyrax Fitness logo" />
              <div className="name">
                <strong>HYRAX FITNESS</strong>
                <span className="muted">Scramble. Haul. Bolt. Recover.</span>
              </div>
            </Link>
          </div>

          <div className="cols" aria-label="Footer links">
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4>{title}</h4>
                {links.map(link => (
                  <Link key={link.to + link.label} to={link.to}>{link.label}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="muted small" style={{ marginTop: 16 }}>
          &copy; {new Date().getFullYear()} Hyrax Fitness. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
