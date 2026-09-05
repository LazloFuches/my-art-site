export const onRequest = async ({ request, next }) => {
  const url = new URL(request.url);
  if (url.hostname === 'my-art-site-48k.pages.dev') {
    return Response.redirect(`https://robertegert.com${url.pathname}${url.search}`, 301);
  }
  return next();
};
