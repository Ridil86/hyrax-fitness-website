import { Link } from 'react-router-dom';
import './legal.css';

const sections = [
  'Information We Collect',
  'How We Use Your Information',
  'Authentication and Account Security',
  'Cookies and Tracking',
  'Data Storage and Security',
  'Data Retention',
  'Third-Party Services',
  'Automated Decision-Making and Personalization',
  'Email Notifications',
  'Your Rights',
  "Children's Privacy",
  'Changes to This Policy',
  'Contact Information',
];

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <h1 className="legal-heading">Privacy Policy</h1>
      <p className="legal-last-updated">Last updated: March 25, 2026</p>

      <nav className="legal-toc">
        <h3>Table of Contents</h3>
        <ol>
          {sections.map((s, i) => (
            <li key={i}><a href={`#privacy-${i + 1}`}>{s}</a></li>
          ))}
        </ol>
      </nav>

      <section className="legal-section" id="privacy-1">
        <h2 className="legal-subheading">1. Information We Collect</h2>
        <p>
          We collect information that you provide directly when you register for an
          account, use our services, or communicate with us. This includes:
        </p>
        <ul>
          <li>
            <strong>Account information:</strong> Your first name, last name, and
            email address when you create an account. If you sign in with Google, we
            receive your name and email from your Google account.
          </li>
          <li>
            <strong>Profile information:</strong> Any additional details you provide,
            such as fitness goals, training preferences, experience level, and
            schedule preferences.
          </li>
          <li>
            <strong>Health and fitness data:</strong> Information you provide through
            our fitness questionnaire, including physical limitations, injuries,
            health conditions, age, and training environment. This data is used to
            personalize your experience.
          </li>
          <li>
            <strong>Dietary and nutrition data:</strong> Food allergies, dietary
            restrictions (e.g., vegetarian, halal, keto), food preferences, caloric
            goals, macronutrient targets, cooking skill level, and supplement use,
            as provided through our nutrition questionnaire.
          </li>
          <li>
            <strong>Meal logging data:</strong> Food items, caloric intake,
            macronutrient data, and meal timing that you record through the meal
            logging feature. This data is aggregated on a daily and monthly basis.
          </li>
          <li>
            <strong>Workout and activity data:</strong> Exercise completion logs,
            benchmark scores, routine history, and progress metrics generated through
            your use of the platform.
          </li>
          <li>
            <strong>Chat communications:</strong> Messages you exchange with the
            digital coaching feature, which are stored to maintain conversation
            context and improve your experience.
          </li>
          <li>
            <strong>Community content:</strong> Forum posts, replies, and reactions
            you create in the community forum. Anonymous posts are stored with
            authorship information visible only to administrators for moderation.
          </li>
          <li>
            <strong>Support communications:</strong> Tickets and messages you submit
            through our support system, including any attachments.
          </li>
          <li>
            <strong>Payment information:</strong> Your subscription tier and billing
            status. Full payment card details are handled directly by Stripe and are
            not stored by Hyrax Fitness.
          </li>
          <li>
            <strong>Uploaded media:</strong> Images you upload to the platform, which
            are stored securely and delivered through a content delivery network.
          </li>
          <li>
            <strong>Usage data:</strong> Information about how you interact with our
            platform, including pages visited, features used, and the date and time of
            your visits.
          </li>
          <li>
            <strong>Device information:</strong> Browser type, operating system, and
            IP address collected automatically when you access our services.
          </li>
          <li>
            <strong>Compliance records:</strong> Your acceptance or rejection of our
            cookie policy and terms of use, along with timestamps, IP address, and
            basic device information, for legal compliance purposes.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="privacy-2">
        <h2 className="legal-subheading">2. How We Use Your Information</h2>
        <p>We use the information we collect for the following purposes:</p>
        <ul>
          <li>To create and manage your account</li>
          <li>To deliver and improve our fitness training services</li>
          <li>To generate personalized workout routines, nutrition plans, and coaching responses using automated processing systems based on your profile, questionnaire data, and activity history</li>
          <li>To personalize your experience and training recommendations</li>
          <li>To track your fitness progress and provide benchmark comparisons</li>
          <li>To communicate with you about your account, programs, and updates</li>
          <li>To send transactional email notifications about your account, subscription status, payment issues, support tickets, and trial reminders</li>
          <li>To process payments and manage subscriptions</li>
          <li>To moderate community content and maintain a safe forum environment</li>
          <li>To comply with legal obligations and maintain compliance records, including terms and privacy acceptance logs</li>
          <li>To protect the security and integrity of our platform</li>
        </ul>
      </section>

      <section className="legal-section" id="privacy-3">
        <h2 className="legal-subheading">3. Authentication and Account Security</h2>
        <p>
          We use Amazon Web Services (AWS) Cognito for account authentication. Your
          password is never stored in plain text. AWS Cognito uses industry-standard
          Secure Remote Password (SRP) protocol for authentication, which means your
          password is cryptographically hashed and never transmitted to our servers in
          its original form.
        </p>
        <p>
          If you sign in with Google, authentication is handled through Google's OAuth
          protocol. We receive only your name and email address from Google; we do not
          receive or store your Google password.
        </p>
        <p>
          Session tokens are stored in your browser to keep you signed in. These are
          considered strictly necessary for the functioning of the service and are not
          subject to cookie consent.
        </p>
      </section>

      <section className="legal-section" id="privacy-4">
        <h2 className="legal-subheading">4. Cookies and Tracking</h2>
        <p>
          For detailed information about how we use cookies and similar technologies,
          please refer to our <Link to="/cookie-policy">Cookie Policy</Link>.
        </p>
        <p>
          In summary, we use essential cookies for authentication and non-essential
          cookies for remembering your preferences. You can manage your cookie
          preferences through the cookie consent banner displayed on your first visit.
        </p>
      </section>

      <section className="legal-section" id="privacy-5">
        <h2 className="legal-subheading">5. Data Storage and Security</h2>
        <p>
          Your data is stored on Amazon Web Services (AWS) infrastructure located in
          the United States (us-east-1 region). We implement appropriate technical and
          organizational measures to protect your personal data, including:
        </p>
        <ul>
          <li>Encryption at rest for all stored data</li>
          <li>Encryption in transit using HTTPS/TLS for all data transfers</li>
          <li>Role-based access controls limiting data access to authorized personnel only</li>
          <li>Regular security reviews and monitoring</li>
        </ul>
        <p>
          Uploaded media is stored in encrypted cloud storage and delivered through a
          secure content delivery network (CloudFront). Video content is processed
          through a transcoding pipeline to ensure optimal playback quality.
        </p>
        <p>
          While we strive to protect your personal data, no method of electronic
          transmission or storage is completely secure. We cannot guarantee absolute
          security of your information.
        </p>
      </section>

      <section className="legal-section" id="privacy-6">
        <h2 className="legal-subheading">6. Data Retention</h2>
        <p>
          We retain your personal data for as long as your account is active or as
          needed to provide our services. If you request account deletion, we will
          remove your personal data within 30 days, except where we are required to
          retain certain information for legal or compliance purposes.
        </p>
        <ul>
          <li>Compliance records (terms acceptance, privacy acceptance, cookie consent logs) may be retained for up to 3 years in accordance with applicable data protection regulations.</li>
          <li>Billing and payment transaction records may be retained as required by tax and financial reporting obligations.</li>
          <li>Personalized content history (workout routines, nutrition plans, chat history) is retained while your account is active and deleted upon account deletion.</li>
        </ul>
      </section>

      <section className="legal-section" id="privacy-7">
        <h2 className="legal-subheading">7. Third-Party Services</h2>
        <p>We use the following third-party services to operate our platform:</p>
        <ul>
          <li>
            <strong>Amazon Web Services (AWS):</strong> Cloud infrastructure,
            authentication (Cognito), data storage (DynamoDB, S3), content delivery
            (CloudFront), video transcoding (MediaConvert), and email delivery (SES).
          </li>
          <li>
            <strong>Amazon Bedrock (Anthropic Claude):</strong> Processes your fitness
            profile, nutrition profile, workout history, meal logs, and chat messages
            to generate personalized workout routines, nutrition plans, and coaching
            responses. Data is processed within US-based AWS infrastructure. Amazon
            Bedrock does not use your data to train or improve its models.
          </li>
          <li>
            <strong>Stripe:</strong> Processes subscription payments and manages
            billing. Stripe receives your payment method details directly during
            checkout; Hyrax Fitness only stores your subscription status and
            transaction records. See{' '}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
              Stripe's Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Google (OAuth):</strong> If you choose to sign in with Google, we
            receive your name and email address from your Google account through the
            OAuth protocol. See{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google's Privacy Policy
            </a>.
          </li>
          <li>
            <strong>GitHub:</strong> Source code management for our platform.
          </li>
        </ul>
        <p>
          We do not sell, trade, or rent your personal information to third parties. We
          may share information with service providers who assist us in operating the
          platform, provided they agree to keep your information confidential.
        </p>
      </section>

      <section className="legal-section" id="privacy-8">
        <h2 className="legal-subheading">8. Automated Decision-Making and Personalization</h2>
        <p>
          Hyrax Fitness uses automated systems to generate personalized content for
          you, including workout routines, nutrition plans, and coaching responses.
          These systems process your profile data, questionnaire responses, activity
          history, and meal logs to create tailored recommendations.
        </p>
        <ul>
          <li>
            These automated systems do not make decisions that produce legal effects
            or similarly significant effects on you. They provide fitness and
            nutrition suggestions for informational purposes only.
          </li>
          <li>
            You can request human review of any generated content by contacting us
            at <a href="mailto:support@hyraxfitness.com">support@hyraxfitness.com</a>.
          </li>
          <li>
            You may update your profile data, fitness questionnaire, or nutrition
            questionnaire at any time to change the inputs used for personalization.
          </li>
          <li>
            Allergy and dietary restriction data is prioritized in the generation
            process, but you remain responsible for verifying the suitability of all
            recommendations for your specific needs.
          </li>
        </ul>
      </section>

      <section className="legal-section" id="privacy-9">
        <h2 className="legal-subheading">9. Email Notifications</h2>
        <p>
          We send the following types of email communications using Amazon Simple
          Email Service (SES):
        </p>
        <ul>
          <li>
            <strong>Account security emails:</strong> Verification codes, password
            resets, and account invitations. These are required for account
            functionality and cannot be disabled.
          </li>
          <li>
            <strong>Subscription and billing emails:</strong> Confirmations of
            subscription changes, payment receipts, and payment failure notifications.
          </li>
          <li>
            <strong>Support emails:</strong> Notifications when your support tickets
            receive a reply from our team.
          </li>
          <li>
            <strong>Trial reminders:</strong> Notifications about your free trial
            status and expiration.
          </li>
        </ul>
        <p>
          You can manage your non-essential email notification preferences (subscription,
          support, and trial categories) through the Settings page in your portal.
          Your notification preferences are stored as part of your profile data.
        </p>
      </section>

      <section className="legal-section" id="privacy-10">
        <h2 className="legal-subheading">10. Your Rights</h2>
        <p>
          Depending on your location, you may have the following rights regarding your
          personal data:
        </p>
        <ul>
          <li>
            <strong>Access:</strong> Request a copy of the personal data we hold about
            you.
          </li>
          <li>
            <strong>Correction:</strong> Request correction of inaccurate or
            incomplete data.
          </li>
          <li>
            <strong>Deletion:</strong> Request deletion of your personal data, subject
            to legal retention requirements.
          </li>
          <li>
            <strong>Portability:</strong> Request your data in a structured,
            machine-readable format.
          </li>
          <li>
            <strong>Objection:</strong> Object to the processing of your data in
            certain circumstances, including automated decision-making.
          </li>
        </ul>
        <p>
          To exercise any of these rights, please contact us at{' '}
          <a href="mailto:support@hyraxfitness.com">support@hyraxfitness.com</a>.
          We will respond to your request within 30 days.
        </p>
      </section>

      <section className="legal-section" id="privacy-11">
        <h2 className="legal-subheading">11. Children's Privacy</h2>
        <p>
          Our services are not intended for individuals under the age of 18. We do not
          knowingly collect personal information from children. If you believe a child
          has provided us with personal information, please contact us immediately and
          we will take steps to delete such data.
        </p>
      </section>

      <section className="legal-section" id="privacy-12">
        <h2 className="legal-subheading">12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of
          material changes by posting the updated policy on this page and updating the
          "Last updated" date. We encourage you to review this page periodically.
        </p>
      </section>

      <section className="legal-section" id="privacy-13">
        <h2 className="legal-subheading">13. Contact Information</h2>
        <p>
          If you have questions or concerns about this Privacy Policy or our data
          practices, please contact us at:
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
