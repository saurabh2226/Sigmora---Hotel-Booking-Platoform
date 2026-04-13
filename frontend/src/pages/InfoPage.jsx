import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './InfoPage.module.css';

const PAGE_CONTENT = {
  careers: {
    eyebrow: 'Company',
    title: 'Careers at Sigmora',
    intro: 'We build a cleaner booking experience for guests, admins, and operations teams. In this capstone build, the careers page explains the kinds of roles and values the platform stands for.',
    sections: [
      {
        heading: 'What we value',
        body: 'We care about guest trust, honest product decisions, inclusive hospitality, and software that stays understandable as the platform grows.',
      },
      {
        heading: 'Typical teams',
        body: 'Product design, frontend engineering, backend engineering, hotel success, support operations, and growth all contribute to how Sigmora runs.',
      },
      {
        heading: 'How to express interest',
        body: 'For local project demos, use the contact page or in-app support center to share your interest and a short introduction.',
      },
    ],
  },
  blog: {
    eyebrow: 'Company',
    title: 'Sigmora Journal',
    intro: 'This page acts as the platform blog hub. It shares product updates, booking tips, hospitality insights, and operational notes in one calm reading space.',
    sections: [
      {
        heading: 'What you would find here',
        body: 'Travel inspiration, booking best practices, host enablement guides, seasonal offer planning, and product release notes.',
      },
      {
        heading: 'Editorial approach',
        body: 'We keep posts factual, practical, and guest-safe. Promotional claims should stay transparent and avoid misleading discount language.',
      },
      {
        heading: 'For this local project',
        body: 'The blog is seeded as a working placeholder page so the footer routes are complete and logically connected.',
      },
    ],
  },
  'help-center': {
    eyebrow: 'Support',
    title: 'Help Center',
    intro: 'The Help Center is the self-serve support area for common questions around searching, booking, payments, cancellations, refunds, and support chats.',
    sections: [
      {
        heading: 'Booking help',
        body: 'Guests can browse hotels, review room-level pricing, apply coupons, and confirm their stay with the supported payment methods configured in the project.',
      },
      {
        heading: 'Owner support',
        body: 'Admins can manage hotels, offers, bookings, and respond to guest queries from the support inbox linked to each hotel conversation.',
      },
      {
        heading: 'Best next step',
        body: 'If you are signed in, the fastest path is usually the in-app support center where messages stay tied to the correct hotel and booking context.',
      },
    ],
  },
  faq: {
    eyebrow: 'Support',
    title: 'Frequently Asked Questions',
    intro: 'These are the most common questions guests and admins usually ask when navigating a booking platform like Sigmora.',
    sections: [
      {
        heading: 'How do coupons work?',
        body: 'Coupons can be global or hotel-specific. Eligible discounts appear on hotel cards, hotel details, and the booking flow before payment.',
      },
      {
        heading: 'Can a booking be cancelled?',
        body: 'Yes. Refunds follow the configured cancellation rules in the backend, including partial refunds where applicable.',
      },
      {
        heading: 'Who answers support chats?',
        body: 'Guest queries are routed to the admin team so the platform can oversee property operations directly.',
      },
    ],
  },
  contact: {
    eyebrow: 'Support',
    title: 'Contact Sigmora',
    intro: 'This page explains the ethical support paths for the project without pretending there is a live public operations team behind the local demo.',
    sections: [
      {
        heading: 'For guest questions',
        body: 'Use the in-app support chat after login so your message stays linked to the right hotel and can notify the admin team directly.',
      },
      {
        heading: 'For admin or platform requests',
        body: 'During local development, platform setup questions are best handled by the project maintainer or through the development workflow you are using.',
      },
      {
        heading: 'Suggested support mailbox',
        body: 'If you want a visible support contact in your demo, configure your SMTP sender and use a monitored inbox such as support@yourdomain.com.',
      },
    ],
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    intro: 'This page sets clear expectations for account use, bookings, payments, cancellations, and acceptable platform behavior in a responsible way.',
    sections: [
      {
        heading: 'Account responsibility',
        body: 'Users are responsible for keeping their credentials secure and providing accurate identity and booking details.',
      },
      {
        heading: 'Booking responsibility',
        body: 'Hotels, room availability, prices, offers, and cancellation rules are governed by the current inventory and policy logic configured in the platform.',
      },
      {
        heading: 'Fair use',
        body: 'Guests and admins should not misuse messaging, attempt payment fraud, scrape data, or interfere with platform availability.',
      },
    ],
  },
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    intro: 'This page explains what user information the platform stores and why it is needed to support hotel discovery, booking, support, and account security.',
    sections: [
      {
        heading: 'Data we store',
        body: 'Profile details, booking details, payment references, support conversations, and operational logs may be stored to keep the platform functional and accountable.',
      },
      {
        heading: 'Why it is stored',
        body: 'The platform needs this data to authenticate users, process bookings, manage refunds, deliver support, and protect the system from abuse.',
      },
      {
        heading: 'Development note',
        body: 'In local development, use only non-sensitive demo data and test credentials unless you have a secure environment for real customer information.',
      },
    ],
  },
  cookies: {
    eyebrow: 'Legal',
    title: 'Cookie Policy',
    intro: 'This page outlines how session cookies and browser storage support login, refresh tokens, preferences, and smoother booking flows.',
    sections: [
      {
        heading: 'Essential cookies',
        body: 'Authentication cookies help keep users signed in securely and allow refresh-token based session continuity where configured.',
      },
      {
        heading: 'Preference storage',
        body: 'Theme choice, some user preferences, and session context may also be stored in the browser to improve usability.',
      },
      {
        heading: 'Responsible usage',
        body: 'The project should avoid tracking beyond what is needed for core product functionality unless informed consent is added.',
      },
    ],
  },
};

export default function InfoPage({ pageKey }) {
  const { isAuthenticated } = useAuth();
  const page = PAGE_CONTENT[pageKey] || PAGE_CONTENT['help-center'];

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.hero}>
        <span className={styles.eyebrow}>{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </div>

      <div className={styles.grid}>
        <div className={styles.mainCard}>
          {page.sections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <aside className={styles.sideCard}>
          <h3>Quick actions</h3>
          <p>Use the next best path depending on whether you are browsing as a guest or already signed in.</p>
          <div className={styles.actions}>
            <Link to="/about" className={styles.secondaryLink}>About Sigmora</Link>
            <Link to={isAuthenticated ? '/support' : '/login'} className={styles.primaryLink}>
              {isAuthenticated ? 'Open Support Center' : 'Login For Support'}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
