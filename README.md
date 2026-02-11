# Dabys.org – Movie Site

Themed weekly movie submission and voting site: name-based login, admin-controlled phases, submissions, voting, winners, and ratings. This README is a **reference for recommended tech and documentation** for agents and developers.

---

## Recommended tech stack

| Layer | Technology | Purpose |
|-------|------------|--------|
| Framework | [Next.js](https://nextjs.org/) (App Router) | Full-stack React app, API routes, server components |
| Database | [Turso](https://turso.tech/) (SQLite) or [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) | Relational data: users, weeks, submissions, votes, winners, ratings |
| ORM | [Drizzle](https://orm.drizzle.team/) or [Prisma](https://www.prisma.io/) | Schema, migrations, type-safe queries |
| User session | [iron-session](https://github.com/vvo/iron-session) or [NextAuth.js](https://next-auth.js.org/) | "Select your name" login; store `userId` in cookie |
| Admin auth | Env var `ADMIN_PASSWORD` + session | Single admin; password check then admin cookie |
| Styling | [Tailwind CSS](https://tailwindcss.com/) | Layout, gradients, responsive, movie-art bleed |
| Hosting | [Vercel](https://vercel.com/) | Deploy Next.js, serverless API, env for DB and admin password |
| Letterboxd | Stored URLs only | No API; store `letterboxdUrl` per movie; poster link to Letterboxd |
| TMDB | [TMDB API](https://developer.themoviedb.org/docs) | Free movie search, posters, overviews, trailers; auto-generates Letterboxd URLs |
| GIPHY | [GIPHY API](https://developers.giphy.com/docs/api) | Optional: set `GIPHY_API_KEY` for in-app GIF browser in winner comments |

---

## Environment variables

- **ADMIN_PASSWORD** — Admin panel password (default: `dabysmedia`).
- **TMDB_API_KEY** — Required for movie search autocomplete. Free from [TMDB Settings](https://www.themoviedb.org/settings/api). Provides poster art, overviews, trailers, and auto-generated Letterboxd URLs during submission.
- **GIPHY_API_KEY** — Optional. From [GIPHY Developer Dashboard](https://developers.giphy.com/dashboard/). Enables the full GIF browser (search + trending) in winner discussion. If unset, users can still paste a giphy.com link.

---

## Official documentation and manuals

### Next.js

- **Docs (App Router):** https://nextjs.org/docs  
- **API Routes:** https://nextjs.org/docs/app/building-your-application/routing/route-handlers  
- **Server Components:** https://nextjs.org/docs/app/building-your-application/rendering/server-components  
- **Data Fetching:** https://nextjs.org/docs/app/building-your-application/data-fetching  
- **Middleware:** https://nextjs.org/docs/app/building-your-application/routing/middleware  

### Database

**Turso (SQLite at the edge)**  
- **Overview:** https://docs.turso.tech/  
- **Quickstart:** https://docs.turso.tech/tutorials/get-started-turso-cli  
- **LibSQL client (JS/TS):** https://docs.turso.tech/reference/client-access  

**Vercel Postgres**  
- **Overview:** https://vercel.com/docs/storage/vercel-postgres  
- **Quickstart:** https://vercel.com/docs/storage/vercel-postgres/quickstart  

### ORM

**Drizzle ORM**  
- **Overview:** https://orm.drizzle.team/docs/overview  
- **Schema:** https://orm.drizzle.team/docs/sql-schema-declaration  
- **Queries:** https://orm.drizzle.team/docs/select  
- **Migrations:** https://orm.drizzle.team/docs/migrations  
- **Turso + Drizzle:** https://orm.drizzle.team/docs/get-started-sqlite#turso  

**Prisma**  
- **Docs:** https://www.prisma.io/docs  
- **Schema reference:** https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference  
- **Client API:** https://www.prisma.io/docs/reference/api-reference/prisma-client-reference  

### Session and auth

**iron-session**  
- **README / API:** https://github.com/vvo/iron-session  
- **Usage with Next.js:** https://github.com/vvo/iron-session#usage-nextjs  

**NextAuth.js**  
- **Docs:** https://next-auth.js.org/  
- **Configuration:** https://next-auth.js.org/configuration/options  
- **Credentials provider:** https://next-auth.js.org/providers/credentials  

### Styling

**Tailwind CSS**  
- **Docs:** https://tailwindcss.com/docs  
- **Installation (Next.js):** https://tailwindcss.com/docs/guides/nextjs  
- **Utility reference:** https://tailwindcss.com/docs/utility-first  
- **Gradients:** https://tailwindcss.com/docs/background-image#gradients  
- **Responsive design:** https://tailwindcss.com/docs/responsive-design  

### Hosting and deployment

**Vercel**  
- **Docs:** https://vercel.com/docs  
- **Next.js on Vercel:** https://vercel.com/docs/frameworks/nextjs  
- **Environment variables:** https://vercel.com/docs/projects/environment-variables  

### TMDB (The Movie Database)

- **Docs:** https://developer.themoviedb.org/docs  
- **Search movies:** https://developer.themoviedb.org/reference/search-movie  
- **Movie details:** https://developer.themoviedb.org/reference/movie-details  
- **Movie videos (trailers):** https://developer.themoviedb.org/reference/movie-videos  
- **Image basics:** https://developer.themoviedb.org/docs/image-basics  
- **API key signup:** https://www.themoviedb.org/settings/api  

### Letterboxd

- **Site:** https://letterboxd.com/  
- **Film URL pattern:** `https://letterboxd.com/film/{slug}/`  
- No official public API; use stored URLs and optional poster image URLs only.

---

## Sharing locally via tunnel

To share your locally running app with others over the internet (no router port forwarding):

1. **Start the app**: `npm run dev` (app runs on `http://localhost:3000`).
2. **Start a tunnel** in a second terminal:
   - **ngrok**: `npm run tunnel:ngrok` (or `ngrok http 3000`). Sign up at [ngrok.com](https://ngrok.com), install, then `ngrok config add-authtoken <token>`.
   - **Cloudflare Tunnel**: `npm run tunnel:cloudflare` (or `cloudflared tunnel --url http://localhost:3000`). No signup needed for the quick tunnel; install from [Cloudflare docs](https://developers.cloudflare.com/connections/connect-apps/install-and-setup/installation).
3. **Share** the HTTPS URL the tunnel prints. Keep both the app and the tunnel running while sharing.

Your app’s existing auth (login, admin) still applies; the tunnel only exposes the same app.

---

## Project concepts (for agents)

- **Phases:** `subs_open` → `subs_closed` → `vote_open` → `vote_closed` → `winner_published` → `reset_week`. Stored per week; admin-only transitions.
- **Weeks:** One row per week; "reset week" creates a new week; history is keyed by `weekId`.
- **Users:** Identified by name (list/create then session); no password for regular users.
- **Admin:** Single password from env; after login, admin session allows phase/theme changes, push winners, reset week, manual add to past winners.
- **Ratings:** Thumbs up/down, stars 1–5, optional comment; only for published winners; stored per winner and user.

---

## File and link quick reference

| Resource | URL |
|----------|-----|
| Next.js docs | https://nextjs.org/docs |
| Turso docs | https://docs.turso.tech/ |
| Vercel Postgres | https://vercel.com/docs/storage/vercel-postgres |
| Drizzle ORM | https://orm.drizzle.team/docs/overview |
| Prisma docs | https://www.prisma.io/docs |
| iron-session | https://github.com/vvo/iron-session |
| NextAuth.js | https://next-auth.js.org/ |
| Tailwind CSS docs | https://tailwindcss.com/docs |
| TMDB API docs | https://developer.themoviedb.org/docs |
| Vercel docs | https://vercel.com/docs |

Use this README and the linked manuals when implementing or modifying the movie site.
