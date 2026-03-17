import { Link } from 'react-router-dom';
import './legal.css';

const sections = [
  'Acceptance of Terms',
  'Description of Services',
  'Account Registration',
  'User Responsibilities',
  'Intellectual Property',
  'Limitation of Liability',
  'Disclaimer of Warranties',
  'Termination',
  'Governing Law',
  'Changes to These Terms',
  'Contact Information',
];

export default function TermsOfUse() {
  return (
    <div className="legal-page">
      <h1 className="legal-heading">Terms of Use</h1>
      <p className="legal-last-updated">Last updated: March 16, 2026</p>

      <nav className="legal-toc">
        <h3>Table of Contents</h3>
        <ol>
          {sections.map((s, i) => (
            <li key={i}><a href={`#terms-${i + 1}`}>{s}</a></li>
          ))}
        </ol>
      </nav>

      <section className="legal-section" id="terms-1">
        <h2 className="legal-subheading">1. Acceptance of Terms</h2>
        <p>
          By accessing or using the Hyrax Fitness website, mobile application, or any
          services provided by Hyrax Fitness ("we," "us," or "our"), you agree to be
          bound by these Terms of Use. If you do not agree to these terms, please do
          not use our services.
        </p>
        <p>
          These terms apply to all visitors, registered users, and anyone who accesses
          or uses the Hyrax Fitness platform.
        </p>
      </section>

      <section className="legal-section" id="terms-2">
        <h2 className="legal-subheading">2. Description of Services</h2>
        <p>
          Hyrax Fitness provides a start-stop, scramble-and-carry training system
          inspired by the rock hyrax. Our services include, but are not limited to:
        </p>
        <ul>
          <li>Access to structured fitness training programs and workout plans</li>
          <li>Online training content including exercise descriptions, workout formats, and coaching guidance</li>
          <li>Account management and progress tracking features</li>
          <li>Community features and event information</li>
        </ul>
        <p>
          We reserve the right to modify, suspend, or discontinue any part of our
          services at any time without prior notice.
        </p>
      </section>

      <section className="legal-section" id="terms-3">
        <h2 className="legal-subheading">3. Account Registration</h2>
        <p>
          To access certain features, you must create an account by providing accurate
          and complete information. You are responsible for maintaining the
          confidentiality of your account credentials and for all activities that occur
          under your account.
        </p>
        <p>
          You must notify us immediately of any unauthorized use of your account. We
          are not liable for any loss or damage arising from your failure to protect
          your login information.
        </p>
        <p>
          You must be at least 18 years of age to create an account and use our services.
        </p>
      </section>

      <section className="legal-section" id="terms-4">
        <h2 className="legal-subheading">4. User Responsibilities</h2>
        <p>
          By using our fitness training services, you acknowledge and agree to the following:
        </p>
        <ul>
          <li>
            <strong>Medical clearance:</strong> You should consult with a qualified
            healthcare provider before beginning any exercise program, particularly if
            you have pre-existing health conditions, injuries, or concerns about your
            physical fitness.
          </li>
          <li>
            <strong>Personal responsibility:</strong> You are solely responsible for
            your physical well-being during any training activities. Exercise
            inherently carries risk of injury, and you participate at your own risk.
          </li>
          <li>
            <strong>Proper form:</strong> It is your responsibility to use proper form
            and technique when performing exercises. We recommend working with a
            qualified trainer if you are unsure about exercise execution.
          </li>
          <li>
            <strong>Honest information:</strong> You agree to provide accurate health
            and fitness information when requested, such as through intake
            questionnaires.
          </li>
          <li>
            <strong>Acceptable use:</strong> You agree not to misuse the platform,
            share your account credentials, reverse-engineer our systems, or use the
            platform for any unlawful purpose.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="terms-5">
        <h2 className="legal-subheading">5. Intellectual Property</h2>
        <p>
          All content on the Hyrax Fitness platform, including but not limited to text,
          graphics, logos, images, workout programs, training methodologies, and
          software, is the property of Hyrax Fitness and is protected by applicable
          intellectual property laws.
        </p>
        <p>
          You may not reproduce, distribute, modify, or create derivative works from
          any content without our prior written consent.
        </p>
      </section>

      <section className="legal-section" id="terms-6">
        <h2 className="legal-subheading">6. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Hyrax Fitness, its officers,
          directors, employees, and agents shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages arising from your use
          of our services.
        </p>
        <p>
          This includes, without limitation, damages for personal injury, loss of data,
          or loss of profits, whether based on warranty, contract, tort, or any other
          legal theory. Hyrax Fitness does not guarantee specific fitness results from
          use of our programs.
        </p>
      </section>

      <section className="legal-section" id="terms-7">
        <h2 className="legal-subheading">7. Disclaimer of Warranties</h2>
        <p>
          Our services are provided "as is" and "as available" without any warranties
          of any kind, either express or implied, including but not limited to implied
          warranties of merchantability, fitness for a particular purpose, or
          non-infringement.
        </p>
        <p>
          We do not warrant that the services will be uninterrupted, error-free, or
          secure. We make no representations regarding the accuracy, reliability, or
          completeness of any fitness advice or content provided through our platform.
        </p>
      </section>

      <section className="legal-section" id="terms-8">
        <h2 className="legal-subheading">8. Termination</h2>
        <p>
          We may terminate or suspend your account and access to our services at our
          sole discretion, without prior notice, for conduct that we determine violates
          these Terms of Use or is harmful to other users or our business interests.
        </p>
        <p>
          You may terminate your account at any time by contacting us. Upon
          termination, your right to use the services will cease immediately.
        </p>
      </section>

      <section className="legal-section" id="terms-9">
        <h2 className="legal-subheading">9. Governing Law</h2>
        <p>
          These Terms of Use shall be governed by and construed in accordance with the
          laws of the jurisdiction in which Hyrax Fitness operates, without regard to
          its conflict of law principles.
        </p>
        <p>
          Any disputes arising under these terms shall be resolved through binding
          arbitration in accordance with applicable arbitration rules, unless otherwise
          required by law.
        </p>
      </section>

      <section className="legal-section" id="terms-10">
        <h2 className="legal-subheading">10. Changes to These Terms</h2>
        <p>
          We reserve the right to update or modify these Terms of Use at any time. We
          will notify users of material changes by posting the updated terms on this
          page and updating the "Last updated" date. Your continued use of the services
          after changes are posted constitutes acceptance of the revised terms.
        </p>
      </section>

      <section className="legal-section" id="terms-11">
        <h2 className="legal-subheading">11. Contact Information</h2>
        <p>
          If you have any questions about these Terms of Use, please contact us at:
        </p>
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:support@hyraxfitness.com">support@hyraxfitness.com</a>
        </p>
        <p>
          <strong>Website:</strong>{' '}
          <Link to="/">hyraxfitness.com</Link>
        </p>
      </section>
    </div>
  );
}
