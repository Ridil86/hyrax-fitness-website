import { Link } from 'react-router-dom';
import './legal.css';

const sections = [
  'What Are Cookies',
  'How We Use Cookies',
  'Types of Cookies We Use',
  'Managing Your Cookie Preferences',
  'Third-Party Cookies',
  'Changes to This Policy',
  'Contact Information',
];

export default function CookiePolicy() {
  return (
    <div className="legal-page">
      <h1 className="legal-heading">Cookie Policy</h1>
      <p className="legal-last-updated">Last updated: March 25, 2026</p>

      <nav className="legal-toc">
        <h3>Table of Contents</h3>
        <ol>
          {sections.map((s, i) => (
            <li key={i}><a href={`#cookie-${i + 1}`}>{s}</a></li>
          ))}
        </ol>
      </nav>

      <section className="legal-section" id="cookie-1">
        <h2 className="legal-subheading">1. What Are Cookies</h2>
        <p>
          Cookies are small text files that are stored on your device when you visit a
          website. They are widely used to make websites work efficiently and to
          provide information to website owners. Similar technologies include
          localStorage and sessionStorage, which allow websites to store data in your
          browser.
        </p>
        <p>
          This policy covers cookies and similar browser-based storage technologies
          used on the Hyrax Fitness platform.
        </p>
      </section>

      <section className="legal-section" id="cookie-2">
        <h2 className="legal-subheading">2. How We Use Cookies</h2>
        <p>
          Hyrax Fitness uses cookies and browser storage for the following purposes:
        </p>
        <ul>
          <li>
            <strong>Authentication:</strong> To keep you signed in to your account and
            maintain your session securely.
          </li>
          <li>
            <strong>Preferences:</strong> To remember your cookie consent choice so
            we do not ask you again on each visit.
          </li>
          <li>
            <strong>Site functionality:</strong> To provide core features of the
            platform that require temporary data storage.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="cookie-3">
        <h2 className="legal-subheading">3. Types of Cookies We Use</h2>

        <p><strong>Essential Cookies (Strictly Necessary)</strong></p>
        <p>
          These cookies are required for the platform to function properly and cannot
          be disabled. They include:
        </p>
        <ul>
          <li>
            <strong>Authentication tokens:</strong> Managed by AWS Cognito to maintain
            your signed-in session. These are stored in your browser's localStorage
            and are required for account access.
          </li>
        </ul>

        <p><strong>Preference Cookies (Non-Essential)</strong></p>
        <p>
          These cookies remember your choices and preferences to improve your
          experience. They include:
        </p>
        <ul>
          <li>
            <strong>Cookie consent preference:</strong> Stored in localStorage to
            remember whether you have accepted or rejected our cookie policy. If you
            reject cookies, this preference is not stored and you will be asked again
            on your next visit.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="cookie-4">
        <h2 className="legal-subheading">4. Managing Your Cookie Preferences</h2>
        <p>
          When you first visit the Hyrax Fitness website, a cookie consent banner will
          appear at the bottom of the page. You can choose to:
        </p>
        <ul>
          <li>
            <strong>Accept:</strong> Non-essential cookies will be enabled and your
            preference will be saved so the banner does not appear again.
          </li>
          <li>
            <strong>Reject:</strong> Non-essential cookies will not be stored. Since
            your rejection preference is not saved, the banner will appear again on
            your next visit.
          </li>
        </ul>
        <p>
          You can also manage cookies through your browser settings. Most browsers
          allow you to view, delete, and block cookies. Please note that disabling
          essential cookies may affect the functionality of the platform, particularly
          account authentication.
        </p>
        <p>
          To clear your cookie consent preference and see the banner again, clear your
          browser's localStorage for hyraxfitness.com.
        </p>
      </section>

      <section className="legal-section" id="cookie-5">
        <h2 className="legal-subheading">5. Third-Party Cookies</h2>
        <p>
          The following third-party services may set cookies or use browser storage
          when you interact with specific features of the platform:
        </p>
        <ul>
          <li>
            <strong>Stripe:</strong> When payment forms are loaded during the
            subscription checkout process, Stripe may set cookies or use browser
            storage for fraud detection and payment processing security. These are
            essential for completing transactions securely.
          </li>
          <li>
            <strong>Google Sign-In:</strong> If you use Google to sign in to your
            account, Google may set cookies during the OAuth authentication flow.
            These are necessary for the sign-in process to function.
          </li>
        </ul>
        <p>
          We do not use any third-party analytics or advertising cookies. If we
          introduce such cookies in the future, this policy will be updated
          accordingly, and you will be informed through the cookie consent banner.
        </p>
      </section>

      <section className="legal-section" id="cookie-6">
        <h2 className="legal-subheading">6. Changes to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time to reflect changes in our
          practices or applicable laws. We will update the "Last updated" date at the
          top of this page. Material changes will be communicated through the cookie
          consent banner or other appropriate means.
        </p>
      </section>

      <section className="legal-section" id="cookie-7">
        <h2 className="legal-subheading">7. Contact Information</h2>
        <p>
          If you have questions about this Cookie Policy, please contact us at:
        </p>
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:support@hyraxfitness.com">support@hyraxfitness.com</a>
        </p>
        <p>
          <strong>Website:</strong>{' '}
          <Link to="/">hyraxfitness.com</Link>
        </p>
        <p>
          For more information about how we handle your data, please see our{' '}
          <Link to="/privacy">Privacy Policy</Link> and{' '}
          <Link to="/terms">Terms of Use</Link>.
        </p>
      </section>
    </div>
  );
}
