// Pricing section: reads the plan catalog (public.list_public_plans, the same
// data as the app sign-up) and renders one card per plan, with a monthly /
// annual toggle. Formatting mirrors src/domain/Gym/plans.ts.

interface PlanRow {
  code: string;
  name: string;
  monthly_price_cents: number;
  annual_discount_pct: number;
  /** Null = unlimited. */
  student_limit: number | null;
  benefits: string[] | null;
  trial_days: number;
  is_popular: boolean;
}

type Period = 'monthly' | 'annual';

const SOON = 'Os planos estarão disponíveis em breve.';

/** 179 → "R$ 179"; 143.2 → "R$ 143,20". */
function formatBrl(value: number): string {
  const cents = Math.round(value * 100) % 100 !== 0;
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Price per month for the period (annual = discounted monthly equivalent), rounded to cents. */
function monthlyPriceFor(plan: PlanRow, period: Period): number {
  const monthly = plan.monthly_price_cents / 100;
  const price = period === 'annual' ? monthly * (1 - plan.annual_discount_pct / 100) : monthly;
  return Math.round(price * 100) / 100;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderCard(plan: PlanRow, period: Period): HTMLElement {
  const card = el('article', plan.is_popular ? 'plan-card plan-popular' : 'plan-card');
  if (plan.is_popular) card.appendChild(el('span', 'plan-badge', 'Mais escolhido'));

  card.appendChild(el('h3', 'plan-name', plan.name));
  card.appendChild(
    el('p', 'plan-limit', plan.student_limit == null ? 'Alunos ilimitados' : `Até ${plan.student_limit} alunos`),
  );

  const price = el('p', 'plan-price');
  price.appendChild(el('strong', undefined, formatBrl(monthlyPriceFor(plan, period))));
  price.appendChild(el('span', undefined, '/mês'));
  card.appendChild(price);

  let billing = 'Cobrado todo mês';
  if (period === 'annual') {
    billing =
      plan.annual_discount_pct > 0
        ? `Cobrado anualmente: ${formatBrl(Math.round(monthlyPriceFor(plan, period) * 12 * 100) / 100)}`
        : 'Sem desconto no anual';
  }
  card.appendChild(el('p', 'plan-billing', billing));

  const list = el('ul', 'plan-benefits');
  for (const benefit of plan.benefits ?? []) {
    const item = el('li');
    const check = el('span', 'check', '✓');
    check.setAttribute('aria-hidden', 'true');
    item.append(check, ` ${benefit}`);
    list.appendChild(item);
  }
  card.appendChild(list);

  if (plan.trial_days > 0) card.appendChild(el('p', 'plan-trial', `${plan.trial_days} dias de teste grátis`));
  card.appendChild(
    el('span', `button plan-cta ${plan.is_popular ? 'button-primary' : 'button-secondary'}`, 'Em breve nas lojas'),
  );
  return card;
}

async function fetchPlans(url: string, key: string): Promise<PlanRow[]> {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/list_public_plans`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? (rows as PlanRow[]) : [];
}

export async function mountPlans(): Promise<void> {
  const grid = document.getElementById('plans-grid');
  const toggle = document.querySelector<HTMLElement>('.period-toggle');
  const trialText = document.getElementById('plans-trial');
  if (!grid || !toggle || !trialText) return;

  let period: Period = 'monthly';
  let plans: PlanRow[] = [];

  const showMessage = (text: string) => {
    grid.replaceChildren(el('p', 'plans-message', text));
    grid.setAttribute('aria-busy', 'false');
  };
  const render = () => {
    grid.replaceChildren(...plans.map((plan) => renderCard(plan, period)));
    grid.setAttribute('aria-busy', 'false');
  };

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    showMessage(SOON);
    return;
  }

  try {
    plans = await fetchPlans(url, key);
  } catch {
    showMessage('Não foi possível carregar os planos agora. Tente de novo em instantes.');
    return;
  }
  if (plans.length === 0) {
    showMessage(SOON);
    return;
  }

  const trialDays = plans.map((p) => p.trial_days);
  const minTrial = Math.min(...trialDays);
  if (minTrial > 0 && trialDays.every((d) => d === minTrial)) {
    trialText.textContent = `Comece com ${minTrial} dias de teste grátis. Professores e alunos entram pelo app da academia.`;
  }

  const maxDiscount = Math.max(...plans.map((p) => p.annual_discount_pct));
  if (maxDiscount > 0) {
    const discount = toggle.querySelector('.period-discount');
    if (discount) discount.textContent = `-${maxDiscount}%`;
    toggle.hidden = false;
    toggle.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-period]');
      if (!button || button.dataset.period === period) return;
      period = button.dataset.period as Period;
      toggle.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      render();
    });
  }

  render();
}
