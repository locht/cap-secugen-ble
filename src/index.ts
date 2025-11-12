import { registerPlugin } from '@capacitor/core';

import type { SecuGenBLEPlugin } from './definitions';

const SecuGenBLE = registerPlugin<SecuGenBLEPlugin>('SecuGenBLE', {
  web: () => import('./web').then(m => new m.SecuGenBLEWeb()),
});

export * from './definitions';
export { SecuGenBLE };
