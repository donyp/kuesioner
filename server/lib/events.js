import { EventEmitter } from 'node:events';
export const bus = new EventEmitter();
bus.setMaxListeners(1000);

export function emitSubmission(formId) {
  bus.emit('submission', formId);
}