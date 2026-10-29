import app from '../../cf/app.js';

export const onRequest = (context) => {
  console.log('[FUNCTIONS] Request received');
  console.log('[FUNCTIONS] context.env keys:', Object.keys(context.env || {}));
  return app.fetch(context.request, context.env, context.executionContext || context);
};
