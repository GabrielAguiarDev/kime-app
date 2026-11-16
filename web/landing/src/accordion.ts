const DURATION = 260;
const EASING = 'cubic-bezier(.2,.7,.2,1)';

function setup(details: HTMLDetailsElement) {
  const summary = details.querySelector('summary');
  if (!summary) return;
  let animation: Animation | null = null;

  summary.addEventListener('click', (event) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();

    const closing = details.open && !details.classList.contains('is-closing');
    const startHeight = details.offsetHeight;
    animation?.cancel();

    if (closing) {
      details.classList.add('is-closing');
    } else {
      details.classList.remove('is-closing');
      details.open = true;
    }
    const endHeight = closing ? summary.offsetHeight + details.offsetHeight - details.clientHeight : details.offsetHeight;

    details.style.overflow = 'hidden';
    animation = details.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration: DURATION, easing: EASING },
    );
    animation.onfinish = () => {
      if (closing) details.open = false;
      details.classList.remove('is-closing');
      details.style.overflow = '';
      animation = null;
    };
  });
}

export function mountAccordions() {
  document.querySelectorAll<HTMLDetailsElement>('details.feature-card, details.faq-item').forEach(setup);
}
