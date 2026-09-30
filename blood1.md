MASTER BUILD PROMPT
Blood Donation & Emergency Donor Finder — Installable PWA

You are the lead software architect, senior full-stack engineer, UI/UX designer, QA engineer, security reviewer, and DevOps engineer for this project.

Your job is to build a complete, production-ready, mobile-first Blood Donation & Emergency Donor Finder Progressive Web App (PWA).

Do not treat this as a simple CRUD project.

The final product should feel like a real-world humanitarian blood donation platform that users can install on their phones from the browser and use like an app.

1. IMPORTANT WORKING RULE

Before changing code:

Inspect the entire existing repository.
Understand the current architecture, framework, database, routes, components, environment variables, and scripts.
Identify what already works.
Identify what is missing.
Create a clear implementation plan internally.
Then implement the project.

Do not blindly rewrite working code.

Preserve useful existing functionality unless there is a strong reason to replace it.

When a feature is required but missing, implement it.

When you discover a missing supporting feature required for another feature to work correctly, add it automatically.

Do not stop after implementing the obvious features.

After implementation:

Run the application.
Run lint/type checks.
Run tests.
Test important user flows.
Fix every error you encounter.
Re-run the tests.
Check mobile responsiveness.
Check PWA installation behavior.
Check authentication and authorization.
Check database operations.
Check loading, empty, error, and success states.
Perform a final security review.
Perform a final UX review.
Fix any issues discovered.
Only then consider the project complete.

Continue iterating until the project is in a stable, usable state.

Do not stop simply because the application compiles.

Do not ask me for confirmation for normal engineering decisions. Make sensible decisions and continue.

2. PRODUCT GOAL

Build a platform where someone can quickly find compatible blood donors in a particular area and request blood during normal or emergency situations.

The most important goals are:

Find donors quickly.
Make emergency requests easy.
Make donor availability clear.
Match blood group and location.
Protect donor privacy.
Make the interface extremely simple on mobile.
Allow installation as a PWA.
Provide clear request status.
Allow administrators to moderate the system.
Avoid unnecessary complexity.

The platform is not a hospital management system.

It is not a blood-selling marketplace.

It is not a medical diagnosis platform.

It is a voluntary donor coordination platform.

3. TARGET USERS

There are three main user roles.

A. Donor

A person willing to donate blood.

They should be able to:

Create an account
Create donor profile
Select blood group
Select location
Set donation availability
Enter last donation date
Receive donation requests
Accept or decline requests
View donation/request history
Control contact visibility
Turn availability on/off
B. Requester

A person looking for blood for a patient.

They should be able to:

Create a blood request
Specify required blood group
Specify amount/units if applicable
Specify hospital/location
Specify required date/time
Mark request as emergency
Search available donors
Send donation requests
Track request status
Contact an accepted donor
Close the request when no longer needed

A user may have both Donor and Requester capabilities.

C. Admin

Administrators should be able to:

View users
View donors
View blood requests
Approve/suspend users where appropriate
Review reports
Remove abusive/fake accounts
Manage emergency requests
View system statistics
Manage supported locations
Manage blood groups
Review suspicious activity
View audit logs
4. CORE FEATURES

Implement these features fully.

Authentication

Support a reliable authentication system.

Minimum:

Sign up
Login
Logout
Forgot password
Reset password
Protected routes
Role-based authorization

Structure the authentication layer so SMS OTP can be added later.

Do not hard-code an SMS provider into the application architecture.

For local development, use a practical authentication method.

5. USER PROFILE

Create a user profile system containing:

Full name
Profile photo/avatar
Blood group
Phone number
Email
Division
District
Upazila/Area
Optional organization/university
Date of birth or age where appropriate
Last donation date
Donation availability
Emergency availability
Short optional note

Privacy:

Never expose all personal information publicly.

Do not display:

Exact home address
Private email
Private phone number

unless the user explicitly allows contact sharing.

6. DONOR AVAILABILITY

Every donor should have:

Availability status
Available
Temporarily unavailable
Not available

The donor should be able to change this instantly.

Example:

AVAILABLE TO DONATE

This status must influence donor search and matching.

Add:

Last donation date
Optional next available date
Emergency donation availability

Do not claim that the application itself determines medical eligibility.

Use a clear disclaimer such as:

“Donation eligibility depends on medical screening by an authorized blood donation center or healthcare professional.”

7. BLOOD GROUP SYSTEM

Support exactly these standard blood groups:

A+
A-
B+
B-
O+
O-
AB+
AB-

Do not allow arbitrary blood group strings from users.

Use controlled values in the database.

8. LOCATION SYSTEM

Location should be hierarchical.

Example:

Division
→ District
→ Upazila/Area

Do not publicly expose a donor's exact GPS coordinates.

The donor search should primarily work using:

Blood group
Division
District
Upazila/Area
Availability
Emergency availability

Optional distance estimation may be added later.

Location must be privacy-conscious.

9. BLOOD SEARCH

Create a dedicated donor search page.

Filters:

Blood group
Division
District
Upazila/Area
Available now
Emergency available
Recently active

Results should show only necessary public information.

Example donor card:

Rahim Ahmed
O+ Blood
Sylhet, Sylhet Sadar

Available
Emergency Available

[Request Blood]

Do not display private phone numbers publicly.

10. BLOOD REQUEST

Create a dedicated request flow.

Fields:

Blood group required
Quantity / units
Patient name
Hospital name
Hospital area
Needed date
Needed time
Emergency level
Additional information
Requester's contact preference

Support request priority:

NORMAL
URGENT
EMERGENCY

Emergency requests should have stronger visual prominence and notification behavior.

11. REQUEST STATUS

Every request should have a lifecycle.

Example:

DRAFT
→ OPEN
→ MATCHING
→ DONOR CONTACTED
→ DONOR ACCEPTED
→ FULFILLED
→ CLOSED

Also support:

CANCELLED
EXPIRED

The requester must be able to see the current status.

Admin should also be able to see the lifecycle.

12. DONOR MATCHING

Build a matching system.

Start with deterministic matching rules.

Primary match:

Compatible blood group
Donor available
Same district
Same upazila/area if possible
Emergency availability when request is emergency

Then rank by relevance.

Do not use AI for the first version.

Do not over-engineer the matching engine.

Keep matching logic modular so it can be improved later.

Important:

Do not present the algorithm as a medical authority.

It only helps locate potentially relevant volunteers.

13. DONATION REQUEST TO DONOR

A requester can send a donation request to a donor.

The donor receives:

In-app notification
Push notification where available

Notification example:

“Emergency blood request:
O+ needed at XYZ Hospital.
Respond to this request.”

Donor actions:

[Accept]
[Decline]

After acceptance:

Reveal allowed contact information based on privacy settings.
Show hospital/request details.
Allow direct contact.
14. NOTIFICATION SYSTEM

Implement a notification architecture.

Support:

In-app notifications
Web push notifications
Request notifications
Acceptance notifications
Cancellation notifications
Emergency alerts

Create a proper notification table/model.

Notifications should have:

title
message
type
recipient
related request
read/unread
created_at

Add notification center UI.

15. EMERGENCY MODE

Emergency requests should be visually obvious.

For example:

“EMERGENCY BLOOD REQUEST”

Show:

Blood group
Hospital
Area
Required units
Needed time
Request status
Contact action

Do not use excessive animation.

Do not make the interface stressful or confusing.

The design should communicate urgency clearly without becoming visually chaotic.

16. PWA REQUIREMENTS

This is a major requirement.

The website must be installable as a PWA.

Implement:

Web app manifest
App name
Short name
App icons
Theme color
Background color
Standalone display
Service worker
Offline fallback
Installability
Mobile viewport optimization
Splash/loading experience where supported
Push notification support

The application should work like an installed mobile app.

Add an intelligent “Install App” prompt/banner where appropriate.

Do not constantly show the install banner after the user dismisses it.

17. MOBILE-FIRST DESIGN

Most users will probably access this through smartphones.

Design mobile-first.

Important UI goals:

Large touch targets
Simple navigation
Fast loading
Clear emergency actions
Easy blood group selection
Minimal typing
Clear typography
Good contrast
Accessible buttons
Responsive layout

Desktop should also work properly.

18. UI / UX

Create a modern humanitarian/healthcare visual identity.

Suggested design direction:

Clean white/light interface
Red accent representing blood/emergency
Neutral gray surfaces
Clear status colors
Rounded cards
Strong typography
Minimal unnecessary decoration

Do not make it look like an e-commerce site.

Do not overload the interface with red.

Possible main navigation:

Home
Find Donors
Request Blood
My Requests
Notifications
Profile

Admin gets a separate dashboard.

19. HOME PAGE

The homepage should immediately explain the purpose.

Possible hero:

“Find a Blood Donor When It Matters Most”

Actions:

[Find Blood]
[Donate Blood]

Emergency section:

“Need blood urgently?”

[Create Emergency Request]

Then show:

How it works
Become a donor
Safety information
Platform statistics
Recent emergency requests where appropriate

Do not expose sensitive patient information publicly.

20. DONOR DASHBOARD

Create a donor dashboard containing:

Donation availability
Blood group
Current location
Last donation date
Requests received
Accepted requests
Donation history
Profile completion
Privacy settings

Main CTA:

[Toggle Availability]

21. REQUESTER DASHBOARD

Show:

Active requests
Emergency requests
Matched donors
Accepted donors
Completed requests
Cancelled/expired requests

Include clear statuses.

22. ADMIN DASHBOARD

Create a polished admin dashboard.

Metrics:

Total users
Total donors
Active donors
Active requests
Emergency requests
Fulfilled requests
Pending reports

Admin sections:

Users
Donors
Requests
Reports
Notifications
Locations
Audit Logs
Settings

Add useful filters and search.

23. REPORTING / MODERATION

Users should be able to report:

Fake donor
Spam
Abuse
Fraud
Incorrect information
Inappropriate behavior

Reports should go to admin.

Admin actions:

Review
Warn
Suspend
Remove
Resolve

Keep an audit trail.

24. SECURITY

Treat this as a real application handling sensitive personal information.

Implement:

Secure authentication
Password hashing
Authorization checks
Input validation
Server-side validation
Rate limiting where appropriate
CSRF protection where applicable
Secure API endpoints
SQL injection prevention
XSS prevention
Safe file/image upload handling
Secure environment variables
No secrets committed to Git
Audit logs for administrative actions

Never trust frontend validation alone.

Every important permission check must also exist on the backend.

25. DATABASE

Use a relational database.

At minimum design entities similar to:

users
profiles
donor_profiles
blood_requests
donation_requests
notifications
reports
locations
audit_logs
sessions/auth data
application_settings

Use proper:

primary keys
foreign keys
indexes
timestamps
enums where appropriate
constraints

Optimize searches for blood group + location + availability.

26. API DESIGN

Create a clean API structure.

Possible API groups:

/auth
/users
/donors
/requests
/matches
/notifications
/reports
/admin
/locations

Use consistent:

request validation
error responses
status codes
authentication middleware
authorization middleware

Do not expose database internals directly to the client.

27. ERROR HANDLING

Every major operation needs:

Loading state
Success state
Empty state
Error state

Examples:

“No available O+ donors found in this area.”

“Your request was sent successfully.”

“We could not send the request. Please try again.”

Do not leave users staring at a blank page.

28. ACCESSIBILITY

Implement practical accessibility:

semantic HTML
keyboard accessibility
labels for inputs
focus states
good contrast
accessible buttons
meaningful error messages
alt text for meaningful images
29. MULTI-LANGUAGE

Build the application so localization is supported.

Initial languages:

English
Bangla

Do not hard-code every user-facing string directly inside components.

Create a translation structure.

Users should be able to switch language.

30. PRIVACY RULES

Privacy is extremely important.

Public donor search should show only necessary information.

Never expose:

password
email unless intended
exact home address
sensitive account information
exact private GPS location

Implement privacy settings.

Example:

“Allow requester to see my phone number after I accept a donation request.”

31. SAFETY / MEDICAL DISCLAIMER

Include a concise disclaimer.

The platform is for connecting voluntary blood donors and blood requesters.

It does not replace:

medical evaluation
hospital screening
blood-bank compatibility testing
professional medical advice

The final blood compatibility and donor eligibility decisions must be handled by qualified medical professionals/blood banks.

Do not create a system that falsely guarantees medical compatibility.

32. FEATURES TO EXCLUDE FROM MVP

Do NOT add these unless technically necessary:

Payment processing
Selling blood
Subscription plans
Public donor ranking
Gamification leaderboard
Real-time GPS tracking
Social media feed
Video calls
Complex AI chatbot
Crypto
Native Android application
Native iOS application
Hospital billing
Pharmacy management

Keep the MVP focused.

33. FUTURE-READY ARCHITECTURE

Although these are not MVP features, structure the code so future development is possible for:

Hospital accounts
Blood banks
NGO accounts
Verified donors
SMS OTP
WhatsApp integration
Telegram notifications
Advanced map search
Distance-based matching
Volunteer organizations
Donation reminders
Donation certificates
Analytics
Public emergency campaigns

Do not implement unnecessary future features now.

Just make the architecture extensible.

34. TECHNICAL STACK

Use the existing project's stack if it is already reasonable.

If starting from scratch, prefer a modern stable stack such as:

Frontend:

Next.js
TypeScript
Tailwind CSS
Component library where useful

Backend:

Next.js API/server functionality OR a separate backend if the repository already uses one.

Database:

PostgreSQL

ORM:

Prisma or the project's existing relational ORM

PWA:

Proper manifest + service worker + install support

Notifications:

Web Push where supported

Deployment:

Production-ready environment variable configuration

Do not introduce unnecessary infrastructure.

35. PERFORMANCE

Optimize for mobile internet.

Requirements:

Fast initial load
Optimized images
Lazy loading when useful
Pagination for large datasets
Database indexes
Efficient API queries
No unnecessary client-side requests
Good caching strategy

Avoid huge JavaScript bundles.

36. SEO

Implement sensible SEO for public pages.

Include:

title
description
Open Graph metadata
favicon
sitemap where appropriate
robots configuration where appropriate

Do not index private dashboard pages.

37. TESTING

Create tests for important logic.

At minimum test:

Authentication
Authorization
Blood group validation
Donor search
Location filtering
Availability filtering
Blood request creation
Donor request acceptance
Request cancellation
Notification creation
Admin permissions

Also test critical UI flows.

38. DEMO / SEED DATA

Create safe demo/seed data for development.

Include example:

donors
blood groups
locations
requests
notifications

Do not use real people's private information.

Clearly label development/demo data.

39. DOCUMENTATION

Create/update:

README.md
SETUP.md
ARCHITECTURE.md
DATABASE.md
API.md
SECURITY.md
TODO.md

README should explain:

What the project does
Features
Tech stack
Installation
Environment variables
Database setup
Development commands
Production deployment
PWA installation
Testing
40. ENVIRONMENT VARIABLES

Create a proper example environment file.

For example:

.env.example

Never commit secrets.

Document every required variable.

Use placeholders for:

database
auth
web push
storage
email
future SMS provider
41. ADMIN SECURITY

Admin accounts must not be created simply by changing a frontend field.

Role changes must be protected on the backend.

Make sure normal users cannot call admin APIs.

Add authorization checks to every admin endpoint.

42. USER EXPERIENCE DETAILS

Always provide clear feedback.

For buttons such as:

Find Donors
Request Blood
Accept Request
Decline
Cancel
Mark Fulfilled

show:

loading state
disabled state while submitting
success feedback
failure feedback

Avoid duplicate submissions.

43. EDGE CASES

Handle:

No donors found
Donor becomes unavailable
Request expires
Donor declines
Requester cancels
Multiple donors accept
Request fulfilled early
User deletes account
Invalid request
Duplicate requests
Notification already read
Unverified account
Missing location
Missing blood group

Make status transitions predictable.

44. FINAL QUALITY CHECK

Before declaring completion, verify all of these:

[ ] Application starts correctly
[ ] Database works
[ ] Authentication works
[ ] Authorization works
[ ] Donor registration works
[ ] Blood group selection works
[ ] Location selection works
[ ] Donor search works
[ ] Blood request works
[ ] Emergency request works
[ ] Donor acceptance works
[ ] Request status works
[ ] Notifications work
[ ] Admin works
[ ] Reporting works
[ ] Privacy controls work
[ ] PWA manifest works
[ ] Service worker works
[ ] Install flow works
[ ] Mobile UI works
[ ] Desktop UI works
[ ] Bangla/English switching works
[ ] Error handling works
[ ] Empty states work
[ ] Database indexes are appropriate
[ ] No obvious security vulnerabilities remain
[ ] No secrets are committed
[ ] Production environment configuration is documented
[ ] README is complete
[ ] Tests pass
[ ] Lint passes
[ ] Type checking passes
[ ] Build succeeds

45. IMPORTANT ENGINEERING BEHAVIOR

Work autonomously.

If you find bugs, fix them.

If you find missing supporting functionality, implement it.

If a feature requires another component to function correctly, implement that component.

Do not leave obvious TODOs for functionality that is required for the application to work.

Do not repeatedly ask for confirmation.

Do not stop after the first successful build.

Think through the complete user journey.

Test the product as both:

a donor
a person urgently requesting blood

Then test it as an admin.

46. FINAL OUTPUT

When the implementation is complete, provide a final report containing:

Project overview
Features implemented
Architecture
Database structure
Authentication design
PWA functionality
Notification system
Security measures
Testing performed
Known limitations
Production deployment steps
Environment variables required
Future recommended features

Most importantly:

Do not merely tell me what should be built.

BUILD IT.

Inspect → Plan → Implement → Run → Test → Fix → Re-test → Polish → Final review.

Continue until the application is genuinely usable.