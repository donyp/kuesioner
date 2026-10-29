import app from '../../cf/app.js';

export const onRequest = (context) => app.fetch(context.request, context.env, context);
