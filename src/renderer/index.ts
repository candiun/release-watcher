import { RendererApp } from './app.js';

async function bootstrap(): Promise<void> {
  const app = new RendererApp();
  await app.init();
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : 'Initialization failed';
  const toast = document.querySelector('#toast');
  if (toast instanceof HTMLElement) {
    toast.textContent = message;
    toast.hidden = false;
  }
});
