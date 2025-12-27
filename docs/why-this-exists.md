# Why This Exists

**GitHub Pages gives you free unlimited website hosting.** Not "free trial." Not "free tier with limits." Actually free, forever, for as many sites as you want. Free SSL. Free CDN. 100GB bandwidth/month.

The catch? Connecting your own domain is a 14-step process:

| Without gg-deploy | With gg-deploy |
|-------------------|----------------|
| Create GitHub repo with special naming | `npx gg-deploy apply yourdomain.com user/repo` |
| Learn Git commands (clone, add, commit, push) | That's it. |
| Create index.html manually | |
| Go to repo Settings → Pages → Enable | |
| Go to your DNS provider's dashboard | |
| Find DNS management panel | |
| Create 4 separate A records pointing to GitHub's IPs | |
| Or figure out CNAME records | |
| Create a CNAME file in your repo | |
| Push the CNAME file | |
| Go back to GitHub Settings | |
| Enter custom domain | |
| Wait for DNS verification | |
| Enable HTTPS checkbox | |
| Wait for SSL provisioning | |
| **~30 minutes if you know what you're doing** | **~60 seconds** |

The hosting is free. The SSL is free. Your time shouldn't be the price you pay.
