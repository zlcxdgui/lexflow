import styles from './AccessDeniedView.module.css';

export function AccessDeniedView({
  area = 'esta rotina',
}: {
  area?: string;
}) {
  return (
    <section className={styles.wrap}>
      <div className={styles.card} role="alert" aria-live="polite">
        <h2 className={styles.title}>Acesso negado</h2>
        <p className={styles.text}>Acesso negado para {area}.</p>
        <p className={styles.text}>Entre em contato com o responsável do escritório.</p>
      </div>
    </section>
  );
}

