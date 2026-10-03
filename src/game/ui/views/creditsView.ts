import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import { Q_COPY } from '../../../qcopy';

export interface CreditsViewOptions {
  onNext: () => void;
}

export interface CreditsView {
  readonly element: HTMLElement;
}

export function createCreditsView({ onNext }: CreditsViewOptions): CreditsView {
  const creditsText = [
    'THE ORACLE',
    'A QURIOSITY EXPERIMENT',
    Q_COPY.title,
    '',
    'CREATED BY',
    'ANUBAV K',
    'SARADHI',
    'CHANDAN',
    'THRISHAL',
    '',
    'BUILT WITH',
    'TypeScript',
    Q_COPY.p,
    'Vite',
    'Vitest',
    '',
    Q_COPY.system,
    'State-vector simulation',
    Q_COPY.oracle,
    Q_COPY.short,
    '',
    'QURIOSITY',
    '2026',
    '',
    'END OF RECORD'
  ];

  const container = createElement('div', { className: 'credits-container' }, 
    creditsText.map(t => createElement('p', { className: 'readout', text: t }))
  );
  container.style.textAlign = 'center';
  
  const nextButton = createControlButton({
    label: 'RETURN TO MENU',
    onActivate: onNext,
  });

  const element = createElement('section', { className: 'view credits-view' }, [
    container,
    nextButton
  ]);

  return {
    element
  };
}
