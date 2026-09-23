# Putting the Lead Engine online for your team

Plain-English guide. No prior experience assumed. Read it once before you start;
the whole thing takes about 30 minutes.

---

## Why this is needed

Until now the Lead Engine ran on one Mac. Sharing it meant giving people an
address like `http://192.168.1.47:3000`. That address is **private to your own
WiFi** — it does not exist anywhere else in the world, so a colleague at home,
on mobile data, or in another office can never reach it. That is how those
addresses work; there is no setting that changes it.

There was a second problem. The app had no password. Anyone who could reach the
address could read and edit everything, including 209 named people's work email
addresses — most of them in the EU, which makes them personal data with real
legal weight.

This guide fixes both. When you are done:

- the engine lives on the internet at a proper web address, reachable from
  anywhere;
- every person signs in with their own email and password;
- you control who has access and can cut someone off in one click;
- the Mac can be closed, asleep, or switched off. It no longer matters.

---

## What you need

1. Your GitHub account (you already have one — the code lives there).
2. A card for the hosting bill. Expect roughly **$5–10 a month**. Check the
   current prices on the host's own pricing page before you commit.
3. About 30 minutes.

---

## Step 1 — Create the hosting account

Go to **railway.com** and sign up **with GitHub**. Signing up with GitHub rather
than email matters: it is what lets the host see your code.

> Railway is the recommendation because its screens are the least technical.
> Render (render.com) works the same way if you prefer it — create a **Web
> Service**, choose **Docker**, and add a **Disk** instead of a Volume. Every
> other step below is identical.

## Step 2 — Point it at your code

1. Click **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Give it permission to see your repositories when asked.
4. Pick **`lead-gen-tool-`**.

It starts building immediately. This first build takes about five minutes
because it is installing everything from scratch. Later ones are much quicker.

**Ignore any error you see during this first build.** The app has nowhere to
keep its data yet — that is the next step, and it will fix itself.

## Step 3 — Give it a disk that remembers things

This is the step people skip, and skipping it means losing all your data every
time the app restarts. Do not skip it.

1. Open your service and find **Settings**.
2. Find **Volumes** and click **Add Volume** (on Render this is called a **Disk**).
3. Set the **mount path** to exactly:

   ```
   /data
   ```

4. Size: **1 GB** is plenty. Your whole database is a few megabytes.

Think of this as a USB stick the app keeps its file on. Without it, the app
starts with an empty notebook every morning.

## Step 4 — Add two settings

Find the **Variables** tab and add these two.

| Name | Value |
|---|---|
| `DATABASE_PATH` | `/data/app.db` |
| `SETUP_TOKEN` | a phrase only you know — see below |

`DATABASE_PATH` tells the app to keep its file on the disk you just added.

`SETUP_TOKEN` is a one-time lock. Between the moment the site goes live and the
moment you create your account, the "create the first account" page is open to
anyone who happens to find the address. This code closes that window. Invent
something nobody would guess — `veeglow-sacvin-first-run-9931` is the right
shape. Write it down; you need it exactly once, in Step 6.

## Step 5 — Get your web address

1. Still in **Settings**, find **Networking**.
2. Click **Generate Domain**.

You get an address like `lead-gen-tool-production.up.railway.app`. That is your
dashboard, reachable from anywhere in the world. It is served over HTTPS, so
passwords travel encrypted.

Wait for the build to go green, then open the address.

## Step 6 — Create your account (do this immediately)

You will see **Create the first account**. Fill in:

- the setup code from Step 4,
- your full name (it gets recorded against every score and note you enter),
- your email,
- a password of at least 12 characters.

**Pick a phrase, not a word.** `lagos plastics export 26` is far stronger than
`P@ssw0rd!` and far easier to remember.

Submit, and you are in — as the administrator. The setup page now closes
permanently. Anyone else who visits gets a login screen.

## Step 7 — Load your data

The 195 markets and all the scoring settings are already there — the app loaded
them from the source workbook the first time it started. Check **Markets**; you
should see them.

Your companies and contacts need importing. Go to **Companies → Import** and
upload the CSVs in this order. **Order matters**: if a company is already in the
database, the whole row is skipped — contact included — so the buyer lists must
go in before the contact lists.

1. `sacvin-buyers-21countries-IMPORT.csv` (1,100 rows)
2. `sacvin-buyers-europe-part2-IMPORT.csv` (886)
3. `sacvin-buyers-uk-IMPORT.csv` (213)
4. `sacvin-buyers-southamerica-IMPORT.csv` (813)
5. `sacvin-tierA-purchasing-contacts-IMPORT.csv` (72)
6. `sacvin-europe-part2-contacts-IMPORT.csv` (51)
7. `sacvin-uk-contacts-IMPORT.csv` (29)
8. `sacvin-southamerica-contacts-IMPORT.csv` (55)

Each import shows you exactly what it took, what it skipped and why. Read that
summary rather than assuming it worked.

> **If you already did work on the Mac** — scored some markets, wrote notes,
> imported CSVs — that work is in the laptop's file and will not come up here by
> itself. Say so before you start entering things twice; the laptop database can
> be copied up instead.

## Step 8 — Add your team

Go to **Team** in the top bar (only administrators see it).

For each person: name, email, and a starting password you choose. **Send them
the password by phone or message — not in the same email as the web address.**
Two things in one email means one leaked inbox gives away both.

They are forced to replace your starting password the first time they sign in,
so you never end up knowing their real one.

**Access level:**

- **Team member** — can use everything: markets, companies, leads, outreach,
  reports.
- **Administrator** — all of that, plus adding and removing people. Give this to
  one or two people, not everyone.

---

## Running it from then on

**Removing someone's access.** Team → **Remove access**. They are signed out of
every browser immediately. Their name stays on the scores and notes they
entered, so the record of who did what is never lost. Do this the day someone
leaves, not the month after.

**Forgotten password.** Any administrator can reset it from the Team page. Nobody
can read an existing password — not you, not the host, not me. They are stored
scrambled in a way that cannot be reversed. A reset is the only route.

**Backups.** The host keeps the disk alive across restarts, but that is not a
backup — it does not protect you from someone deleting rows by mistake. Once a
week, from the dashboard, use the export links to download Markets, Companies,
Contacts and Leads, and keep them in a dated folder. It takes two minutes.

**Cost.** Around $5–10 a month. It scales with how much the app is used, and a
tool used by a handful of people sits at the bottom of that range.

**Changes to the code.** Push to the repository and the host rebuilds and
redeploys on its own. Your data is on the disk, not in the code, so it is
untouched by a redeploy.

---

## When something goes wrong

**"Application failed to respond"** — the build failed, or the disk is missing.
Open the **Deployments** tab and read the log from the bottom up; the real error
is usually the last few lines. The most common cause is a missing volume at
`/data`.

**"The Dockerfile failed validation"** — Railway checked the file and refused it
before running anything, so this is never a problem with your data or settings.
Railway rejects a `VOLUME` instruction outright, because it manages disks itself.
Do not add one back to the `Dockerfile`; attach the disk in **Settings → Volumes**
instead.

**Markets page is empty** — the first-boot data load did not run. Check the
deploy log for a line beginning `[startup]`. It tells you either how many
markets it found or that it was loading them.

**"That setup code is not correct"** — the `SETUP_TOKEN` variable does not match
what you typed. Check it in Variables; a trailing space is the usual culprit.

**You get a login page and your password does not work** — try the reset route
via another administrator. If you are the only administrator and are locked out,
that is recoverable but needs a hand; ask.

---

## Running it on your own Mac as well

Still works, and is worth keeping for offline work:

```bash
cd ~/Downloads/sacvin-lead-engine
git pull
npm install
npm run dev
```

Then open `http://localhost:3000`. The laptop copy now asks you to create an
account too, the first time. It has **its own separate database** — the laptop
and the hosted site do not talk to each other. Decide which one is the real one
and stick to it, or you will end up with two diverging versions of the truth.
The hosted one should be the real one.
