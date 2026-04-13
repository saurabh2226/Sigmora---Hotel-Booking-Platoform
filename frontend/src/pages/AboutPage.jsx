import { FiShield, FiHeadphones, FiHeart, FiGlobe } from 'react-icons/fi';

export default function AboutPage() {
  return (
    <div className="page container" style={{ paddingTop: 100, paddingBottom: 80 }}>
      <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto', marginBottom: 'var(--space-16)' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, marginBottom: 'var(--space-4)' }}>About <span className="text-gradient">Sigmora</span></h1>
        <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>We're on a mission to make travel accessible and delightful for everyone. Our platform connects travelers with verified hotels across India, ensuring the best prices and exceptional experiences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-8)', maxWidth: 900, margin: '0 auto' }}>
        {[
          { icon: <FiShield size={28} />, title: 'Trust & Safety', desc: 'Every hotel is verified. We personally inspect properties to ensure quality and safety standards.' },
          { icon: <FiHeadphones size={28} />, title: '24/7 Support', desc: 'Our dedicated support team is available round the clock to help with any queries or issues.' },
          { icon: <FiHeart size={28} />, title: 'Best Deals', desc: 'We negotiate directly with hotels to bring you exclusive deals and the guaranteed lowest prices.' },
          { icon: <FiGlobe size={28} />, title: 'Pan-India Coverage', desc: 'From metro cities to hidden gems, we cover 500+ destinations across India.' },
        ].map((item, i) => (
          <div key={i} style={{ padding: 'var(--space-8)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', transition: 'all 0.2s' }}>
            <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>{item.icon}</div>
            <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>{item.title}</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.7 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-16)', padding: 'var(--space-10)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-xl)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Our Numbers Speak</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-16)', marginTop: 'var(--space-8)' }}>
          {[{ n: '30,000+', l: 'Hotels' }, { n: '500+', l: 'Cities' }, { n: '1M+', l: 'Happy Guests' }, { n: '4.8', l: 'App Rating' }].map((s, i) => (
            <div key={i}><p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-primary)' }}>{s.n}</p><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{s.l}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}
