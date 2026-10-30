// Host-scoped root redirect for the Asset Data Group brand domain.
//
// This is ONE Netlify site serving the whole DHI storefront, so the bare root
// "/" normally serves the DHI homepage (index.html). Netlify's static redirect
// rules cannot match on hostname, so we use an edge function instead: when a
// visitor hits the ROOT of assetdatagrp.com (the standalone ADG brand domain),
// send them to the ADG page. Every other host — digitalhealthinternational.com,
// the netlify.app origin, previews — falls through untouched and gets the normal
// DHI homepage. Scoped to path "/" below, so it never runs on any other route.
export default async (request, context) => {
  const url = new URL(request.url);
  const host = (url.hostname || "").toLowerCase();
  if (host === "assetdatagrp.com" || host === "www.assetdatagrp.com") {
    url.pathname = "/data-exchange.html";
    url.search = ""; // drop any query on the bare-domain hit
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
};

export const config = { path: "/" };
