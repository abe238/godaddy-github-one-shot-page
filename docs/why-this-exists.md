# Why This Exists

## The Promise

**GitHub Pages gives you free unlimited website hosting.**

Not "free trial." Not "free tier with limits." Actually free, forever, for as many sites as you want:
- Free SSL certificates
- Free global CDN
- 100GB bandwidth/month
- Unlimited repositories = unlimited websites

## The Catch

GitHub Pages assumes you know Git. And DNS. And how they connect.

### Without gg-deploy

**Initial Setup (~30 min if you know what you're doing):**
1. Create GitHub repo with special naming convention
2. Install Git on your computer
3. Learn terminal commands (clone, add, commit, push)
4. Create index.html manually
5. Push to GitHub
6. Go to repo Settings → Pages → Enable
7. Go to your DNS provider's dashboard
8. Find DNS management panel
9. Create 4 separate A records pointing to GitHub's IPs
10. Or figure out CNAME records
11. Create a CNAME file in your repo
12. Push the CNAME file
13. Go back to GitHub Settings
14. Enter custom domain
15. Wait for DNS verification
16. Enable HTTPS checkbox
17. Wait for SSL provisioning

**Every time you update your site:**
1. Open terminal
2. Navigate to project folder
3. `git add .`
4. `git commit -m "message"`
5. `git push origin main`
6. Hope you didn't break anything

### With gg-deploy

**Initial Setup (~60 seconds):**
```bash
npx gg-deploy apply yourdomain.com user/repo
```

**Every time you update your site:**
```bash
gg-deploy push "Updated homepage"
```

That's it. No Git. No terminal wizardry. No DNS googling.

## The Real Value

| What you get | Traditional | gg-deploy |
|--------------|-------------|-----------|
| **Free hosting** | ✓ | ✓ |
| **Free SSL** | ✓ | ✓ |
| **Custom domain** | 30+ min setup | 60 seconds |
| **Update your site** | Git required | Just `push` |
| **Track deployments** | Manual | `list` command |
| **AI assistant ready** | No | MCP built-in |

## Who This Is For

- **Designers** who want to ship without learning Git
- **Writers** who want a blog without WordPress
- **Developers** who are tired of DNS configuration
- **AI agents** that need to deploy sites autonomously
- **Anyone** who thinks free hosting shouldn't require a CS degree

## The Bottom Line

The hosting is free. The SSL is free. The CDN is free.

Your time shouldn't be the price you pay.

---

*gg-deploy: Because `git push` shouldn't be a prerequisite for publishing a website.*
