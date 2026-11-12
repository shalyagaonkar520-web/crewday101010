Written for: the person filling in the Google Play Console for CrewDay.

# Play Console: store listing (paste-ready)

For the answer to every other Play Console task (app access, content rating, data safety, financial features, and so on) see [`docs/play-console.md`](../docs/play-console.md), which is the more detailed source. If the two ever disagree, fix both.

**App name (30 chars max):** CrewDay

**Short description (80 chars max):**
Discover people, hobbies, events and activities happening around you.

**Full description (4000 chars max):**
CrewDay helps you find your crew and make your day.

Discover events, activities and hobby groups happening near you in Bengaluru. Browse what is on, search by what you like, and see what is on in your area.

JOIN AS A PARTICIPANT
- Register for events you want to attend and get your ticket code.
- Build a profile with your city, area and interests.
- See who else is going before you commit.

ORGANISER TOOLS
- Event organisers can see who registered and check guests in on the day.

YOUR PRIVACY
- Your email and phone number are never shown publicly.
- Organisers see your name, email, phone number and check-in status only for events you register for.
- You can delete your account at any time from Settings.
- Read our Privacy Policy: https://crewday101010mm.vercel.app/privacy

**Category:** Events
**Tags (optional):** Events, Social, Hobbies
**Contact email:** use the support address you set on the Play Console (required)
**Website:** https://crewday101010mm.vercel.app
**Privacy policy URL:** https://crewday101010mm.vercel.app/privacy
**Terms (for reference):** https://crewday101010mm.vercel.app/terms

## Graphics
- App icon (512×512 PNG): `public/icons/icon-512.png`
- Feature graphic (1024×500): `playstore/feature-graphic-1024x500.png`
- Phone screenshots (min 2): `playstore/screenshots/` (add real phone screenshots; only one sample exists)

## Data safety form (answers that match the in-app privacy policy)
- Data collected: Name, Email address, Phone number, Photos (optional profile photo), Interests and city/area (profile), Event registrations and check-in status.
- Data shared with third parties: No (service providers only, Google Firebase, to run the app).
- Encrypted in transit: Yes.
- Users can request deletion: Yes (Settings → Delete account).
- Analytics: anonymous product counts only (no name, email or phone).
- Location: not collected. The app never reads device location (no location permission, and the site policy blocks geolocation); the "Nearby" wording is just the launch-area label. The user types a city and area, so declare approximate location as optional user-entered data.

## Content rating
- Social / user-generated interaction: Yes (users can register for and join events). Answer the IARC questionnaire honestly; no violence or sexual content in the app.

## Target audience
- Age 18+ (events and meeting people). Do not select "children".

## App access
- Provide a test account: create one in the app and give its email and password under App access, since reviewers cannot sign up without it.

## Ads
- Contains ads: No.

## Government apps / Financial features / Health: No.
