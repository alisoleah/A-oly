import Script from "next/script";
import { env } from "@/lib/env";

/**
 * AnalyticsScripts — loads GA4 + Meta Pixel ONLY when their IDs are set in env.
 *
 * Both IDs are NEXT_PUBLIC_ so they reach the client (measurement/pixel IDs are
 * not secrets — they're meant to be public; the security boundary is the
 * provider dashboard, not the ID). The dataLayer is always initialised so the
 * analytics wrapper (lib/analytics.ts) can push events regardless of whether a
 * provider script is loaded.
 *
 * CSP note: next/script injects these with the strategy tag; GA4/Pixel domains
 * must be allowed in connect-src/script-src when CSP is tightened post-launch.
 */
export function AnalyticsScripts() {
  const ga4 = env.NEXT_PUBLIC_GA4_ID;
  const pixel = env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <>
      {/* GA4 */}
      {ga4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4}');
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel */}
      {pixel && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixel}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
