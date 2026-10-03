import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';

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
    'DEUTSCH–JOZSA ALGORITHM',
    '',
    'CREATED BY',
    'ANUBAV K',
    '',
    'BUILT WITH',
    'TypeScript',
    'Phaser',
    'Vite',
    'Vitest',
    '',
    'QUANTUM SYSTEM',
    'State-vector simulation',
    'Quantum Oracle',
    'Deutsch–Jozsa',
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
