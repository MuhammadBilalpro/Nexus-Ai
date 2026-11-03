import { headers } from "next/headers";

/**
 * Applies the saved theme before first paint to avoid a flash.
 * Inline scripts must carry the per-request CSP nonce issued by proxy.ts.
 */
export async function ThemeScript() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const code = `(function(){try{var t=localStorage.getItem("nexus-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=t==="dark"||(t!=="light"&&d)?"dark":"light";document.documentElement.setAttribute("data-theme",r);}catch(e){}})();`;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: code }} />;
}
