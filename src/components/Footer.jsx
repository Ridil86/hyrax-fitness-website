import './Footer.css';

const footerLinks = {
  Explore: [
    { href: '#method', label: 'Method' },
    { href: '#workouts', label: 'Workouts' },
    { href: '#programs', label: 'Programs' },
  ],
  Resources: [
    { href: '#faq', label: 'FAQ' },
    { href: '#get-started', label: 'Starter Plan' },
    { href: '#gallery', label: 'Imagery' },
  ],
  Contact: [
    { href: '#get-started', label: 'Email Signup' },
    { href: '#top', label: 'Back to Top' },
  ],
};

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <div>
            <a className="brand" href="#top" style={{ padding: 0 }}>
              <img src="/img/hyrax-fitness-logo-512x512.png" alt="Hyrax Fitness logo" />
              <div className="name">
                <strong>HYRAX FITNESS</strong>
                <span className="muted">Scramble. Haul. Bolt. Recover.</span>
              </div>
            </a>
          </div>

          <div className="cols" aria-label="Footer links">
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4>{title}</h4>
                {links.map(link => (
                  <a key={link.href + link.label} href={link.href}>{link.label}</a>
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
