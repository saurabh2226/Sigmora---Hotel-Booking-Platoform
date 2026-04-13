import styles from './Loader.module.css';
export default function Loader({ fullPage, size = 'md' }) {
  if (fullPage) return <div className={styles.fullPage}><div className={`${styles.spinner} ${styles[size]}`} /></div>;
  return <div className={`${styles.spinner} ${styles[size]}`} />;
}
