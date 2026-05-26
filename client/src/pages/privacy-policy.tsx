import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Shield, ChevronRight, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

/* ─── section titles ─────────────────────────────────────────────────────── */

const SECTIONS_EN = [
  { id: "s1",  title: "Data Controller" },
  { id: "s2",  title: "Data We Collect" },
  { id: "s3",  title: "Legal Basis (AVG Art. 6)" },
  { id: "s4",  title: "Purposes of Processing" },
  { id: "s5",  title: "Data Retention" },
  { id: "s6",  title: "Sub-Processors & Third Parties" },
  { id: "s7",  title: "International Transfers" },
  { id: "s8",  title: "Mobile App & iOS Data" },
  { id: "s9",  title: "AI Features & Profiling" },
  { id: "s10", title: "Reels & Video Content" },
  { id: "s11", title: "Instagram Integration" },
  { id: "s12", title: "Cookies" },
  { id: "s13", title: "Your Rights (AVG Art. 15–22)" },
  { id: "s14", title: "Data Security" },
  { id: "s15", title: "Data Breach Notification" },
  { id: "s16", title: "Children's Privacy" },
  { id: "s17", title: "Changes to this Policy" },
  { id: "s18", title: "Complaints" },
  { id: "s19", title: "Contact" },
];

const SECTIONS_NL = [
  { id: "s1",  title: "Verwerkingsverantwoordelijke" },
  { id: "s2",  title: "Persoonsgegevens die wij verzamelen" },
  { id: "s3",  title: "Rechtsgrondslag (AVG Art. 6)" },
  { id: "s4",  title: "Doeleinden van verwerking" },
  { id: "s5",  title: "Bewaartermijnen" },
  { id: "s6",  title: "Subverwerkers & Derden" },
  { id: "s7",  title: "Internationale doorgifte" },
  { id: "s8",  title: "Mobiele app & iOS-gegevens" },
  { id: "s9",  title: "AI-functies & Profilering" },
  { id: "s10", title: "Reels & Video-inhoud" },
  { id: "s11", title: "Instagram-integratie" },
  { id: "s12", title: "Cookies" },
  { id: "s13", title: "Uw rechten (AVG Art. 15–22)" },
  { id: "s14", title: "Gegevensbeveiliging" },
  { id: "s15", title: "Melding datalekken" },
  { id: "s16", title: "Privacy van kinderen" },
  { id: "s17", title: "Wijzigingen in dit beleid" },
  { id: "s18", title: "Klachten" },
  { id: "s19", title: "Contact" },
];

/* ─── English content ────────────────────────────────────────────────────── */

const PRIVACY_CONTENT_EN = `
<section id="s1">
<h2>1. Data Controller</h2>
<p>Urban Culture ("Urban Culture", "we", "us", or "our"), Herenstraat 32, Zaandam, The Netherlands, is the controller responsible for the processing of your personal data as defined in the Algemene Verordening Gegevensbescherming (AVG) / General Data Protection Regulation (GDPR) (EU) 2016/679.</p>
<p><strong>Contact:</strong> riki@dancehealthy.net | Tel: +31 6 841 86452</p>
</section>

<section id="s2">
<h2>2. Personal Data We Collect</h2>
<p>We collect the following categories of personal data:</p>
<ul>
  <li><strong>Account data:</strong> name, email address, phone number, profile picture, username, password (bcrypt-hashed — never stored in plain text)</li>
  <li><strong>Profile data:</strong> bio, city, artistic role (b-boy/b-girl, artist, organiser, etc.), social media links</li>
  <li><strong>Content data:</strong> posts, comments, events you create, marketplace listings, spots you add to the map, and Reels videos you upload</li>
  <li><strong>Location data:</strong> approximate GPS coordinates — only collected with your explicit consent and auto-deleted after 24 hours; precise coordinates are never stored</li>
  <li><strong>Technical data:</strong> IP address, browser type, device type, operating system, session logs</li>
  <li><strong>Payment data:</strong> transaction references and amounts. Raw card details are processed exclusively by Stripe (PCI-DSS Level 1) — we never store or access them</li>
  <li><strong>Communication data:</strong> messages exchanged via the in-platform chat feature</li>
  <li><strong>Consent records:</strong> timestamps, IP address, and browser user agent recorded when you accept our Terms of Service or Privacy Policy, as required by AVG Art. 7(1)</li>
  <li><strong>Push notification tokens:</strong> device tokens used to deliver push notifications (iOS APNs / Android FCM); stored until you disable notifications or delete your account</li>
  <li><strong>Video data:</strong> Reels and video content you upload, including associated metadata (duration, format, upload timestamp)</li>
  <li><strong>Instagram data:</strong> if you connect your Instagram Business account, we access your Instagram username, profile info, and content you choose to publish via our platform, pursuant to Instagram's Business Login permissions</li>
</ul>
</section>

<section id="s3">
<h2>3. Legal Basis for Processing (AVG Art. 6)</h2>
<ul>
  <li><strong>Performance of contract (Art. 6(1)(b)):</strong> Account management, service delivery, event booking, marketplace transactions, and all core platform functionality</li>
  <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> Security monitoring, fraud prevention, platform analytics, and service improvement — always balanced against your interests and rights</li>
  <li><strong>Consent (Art. 6(1)(a)):</strong> Location sharing for nearby discovery, marketing emails, optional analytics cookies, Instagram integration, and AI-assisted features — you may withdraw consent at any time via Settings</li>
  <li><strong>Legal obligation (Art. 6(1)(c)):</strong> Financial record-keeping (7 years under Artikel 52 AWR), anti-money-laundering compliance, and compliance with court orders or regulatory authorities</li>
</ul>
</section>

<section id="s4">
<h2>4. Purposes of Processing</h2>
<ul>
  <li>Providing, operating, and improving the Platform and all its features (community, events, map, marketplace, Reels, AI tools, chat)</li>
  <li>Processing payments and managing marketplace transactions via Stripe</li>
  <li>Sending service-related communications (account verification, booking confirmations, ticket delivery)</li>
  <li>Delivering push notifications when you opt in</li>
  <li>Enabling AI-assisted features such as content suggestions and event marketing copy</li>
  <li>Enabling Reels and video sharing across the community</li>
  <li>Enabling Instagram Business publishing if you connect your account</li>
  <li>Detecting and preventing fraud, abuse, and security threats</li>
  <li>Complying with legal obligations under Dutch and EU law</li>
  <li>Sending marketing communications — only with your explicit prior consent, withdrawable at any time via Settings → Notifications</li>
</ul>
</section>

<section id="s5">
<h2>5. Data Retention Periods</h2>
<ul>
  <li><strong>Account data:</strong> Retained for the duration of your account plus 2 years after closure (for legal claims)</li>
  <li><strong>Financial / transaction data:</strong> 7 years (Dutch fiscal retention obligation under Artikel 52 AWR)</li>
  <li><strong>Legal consent records:</strong> 5 years from the date of acceptance (required to demonstrate compliance)</li>
  <li><strong>Location data:</strong> Maximum 24 hours after sharing (proximity features only)</li>
  <li><strong>Chat messages:</strong> Until you or the other party deletes them, or your account is closed</li>
  <li><strong>Server / access logs:</strong> 90 days</li>
  <li><strong>Push notification tokens:</strong> Until you disable notifications or delete your account</li>
  <li><strong>Deletion request records:</strong> 3 years (to demonstrate compliance with AVG Art. 17)</li>
  <li><strong>Video / Reels content:</strong> Until you delete the content or close your account</li>
  <li><strong>AI session data:</strong> Not retained beyond the active request; prompts are not stored on our infrastructure after processing</li>
</ul>
</section>

<section id="s6">
<h2>6. Sub-Processors &amp; Third Parties</h2>
<p>We use the following sub-processors under AVG Art. 28 data processing agreements (DPAs). Each processor is contractually bound to protect your data:</p>
<ul>
  <li><strong>Firebase / Google LLC</strong> — Authentication, push notifications (FCM), crash reporting (EU data processing where available)</li>
  <li><strong>Neon Inc.</strong> — PostgreSQL database hosting (EU region)</li>
  <li><strong>Stripe Inc.</strong> — Payment processing (PCI-DSS Level 1 certified)</li>
  <li><strong>Cloudinary Ltd.</strong> — Image, video, and media storage and transformation (including Reels)</li>
  <li><strong>Mailgun Technologies (Sinch)</strong> — Transactional email delivery</li>
  <li><strong>OpenAI LLC</strong> — Optional AI content-generation features. Prompts do not contain identifying personal data. OpenAI does not retain prompts beyond the active API call (when opted out of training via the API)</li>
  <li><strong>Anthropic PBC</strong> — Optional AI features (alternative to OpenAI). Same data minimisation principles apply</li>
  <li><strong>Apple Inc. (APNs)</strong> — iOS push notification delivery</li>
  <li><strong>Meta Platforms Inc. (Instagram)</strong> — Instagram Business API, only if you explicitly connect your Instagram account. Data shared is limited to what you authorise via Instagram's Business Login</li>
  <li><strong>Kamer van Koophandel (KVK)</strong> — Business verification for the Netherlands</li>
</ul>
<p><strong>We do not sell, rent, or trade your personal data with any third party for commercial purposes.</strong></p>
</section>

<section id="s7">
<h2>7. International Data Transfers</h2>
<p>Some sub-processors are based outside the EU/EEA (primarily the United States). We ensure adequate safeguards via Standard Contractual Clauses (SCC) as approved by the European Commission under AVG Art. 46(2)(c), and — where applicable — through the EU-U.S. Data Privacy Framework. A list of relevant SCCs is available on request by emailing riki@dancehealthy.net.</p>
</section>

<section id="s8">
<h2>8. Mobile App &amp; iOS Data</h2>
<p>When you use the Urban Culture iOS or Android application, the following additional data may be collected:</p>
<ul>
  <li><strong>Device push token (APNs / FCM):</strong> Used to deliver push notifications. Stored until you disable notifications or delete your account</li>
  <li><strong>Crash reports:</strong> Collected via Firebase Crashlytics to diagnose stability issues. Crash data does not include personal content</li>
  <li><strong>App usage analytics:</strong> Aggregated, anonymous session data (screen views, feature usage) — collected only with your consent</li>
  <li><strong>Camera / microphone / photo library:</strong> Accessed only when you explicitly use features that require it (uploading a profile picture, posting a Reel, etc.). We do not access these without your active permission</li>
  <li><strong>Location:</strong> Used for the "Nearby" discovery feature only when you opt in. Precise location is never stored; only an approximate radius is used</li>
</ul>
<p>Urban Culture complies with Apple's App Store Review Guidelines (§5 — Privacy, §2.5 — Software Requirements) and App Privacy nutrition label disclosures for all data collected through iOS.</p>
</section>

<section id="s9">
<h2>9. AI Features &amp; Profiling</h2>
<p>Urban Culture includes optional AI-assisted features, including event marketing copy generation, content suggestions, and community discovery tools. When you use these features:</p>
<ul>
  <li>Your input (e.g., an event description you type) is sent to OpenAI or Anthropic for processing. We strip identifying information (name, email, user ID) from all AI prompts before transmission</li>
  <li>AI providers process prompts via API and do not retain your inputs beyond the active request (Urban Culture uses the API in non-training mode)</li>
  <li>We do not engage in fully automated decision-making that produces legal or similarly significant effects on you, within the meaning of AVG Art. 22</li>
  <li>Platform recommendations (suggested events, nearby users, trending content) are based on your stated preferences and opt-in location data — you may disable these at any time in Settings → Privacy</li>
  <li>AI-generated content suggestions are always displayed as suggestions for you to review and edit — they are never published without your explicit confirmation</li>
  <li>We do not use AI to generate, alter, or attribute content to other users without their explicit consent</li>
</ul>
</section>

<section id="s10">
<h2>10. Reels &amp; Video Content</h2>
<p>The Reels feature allows users to upload and share short-form video content within the Urban Culture community. When you use Reels:</p>
<ul>
  <li><strong>Video files</strong> are uploaded and stored via Cloudinary (EU-region storage where available). Your video is associated with your account</li>
  <li><strong>Metadata</strong> such as upload timestamp, duration, and resolution is stored in our database</li>
  <li><strong>Engagement data</strong> (likes, comments, views) is stored and associated with your account and the content</li>
  <li><strong>Public Reels</strong> are visible to all platform users. Private or community-restricted Reels are visible only to the audience you choose</li>
  <li>You retain full ownership of your video content. You grant Urban Culture a limited, non-exclusive licence to host, transcode, display, and distribute the video within the Platform as described in our Terms of Service</li>
  <li>You may delete your Reels at any time. Deletion removes the content from the platform; CDN cache copies may persist for up to 72 hours</li>
</ul>
</section>

<section id="s11">
<h2>11. Instagram Business Integration</h2>
<p>Urban Culture offers an optional Instagram Business Login integration that allows event organisers and creators to publish content directly to their Instagram Business account from our platform. This integration is entirely optional.</p>
<p>When you connect your Instagram Business account:</p>
<ul>
  <li>We request only the minimum required permissions: <code>instagram_business_basic</code>, <code>instagram_business_content_publish</code>, <code>instagram_business_manage_comments</code>, and <code>instagram_business_manage_insights</code></li>
  <li>Your Instagram access token is stored securely and encrypted; it is used solely to perform actions you explicitly initiate within the Platform</li>
  <li>We do not post to your Instagram without your explicit action (e.g., clicking "Publish to Instagram")</li>
  <li>We do not access your Instagram direct messages or personal account data beyond the permissions granted</li>
  <li>You may disconnect your Instagram account at any time via Settings → Integrations. Upon disconnection, we delete your stored Instagram access token immediately</li>
  <li>Your use of Instagram through our Platform is also subject to <a href="https://help.instagram.com/581066165581870" target="_blank" rel="noopener noreferrer">Meta's Platform Terms</a> and <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer">Instagram's Privacy Policy</a></li>
</ul>
</section>

<section id="s12">
<h2>12. Cookies</h2>
<p>We use cookies and similar tracking technologies. Full details:</p>
<ul>
  <li><strong>Essential cookies (no consent required):</strong> Session management, security (CSRF protection), authentication state. These cannot be disabled as they are strictly necessary for Platform operation</li>
  <li><strong>Analytics cookies (consent required):</strong> Aggregated usage statistics to understand how the Platform is used. Collected only after you explicitly accept. You may withdraw consent in Settings → Privacy at any time</li>
  <li><strong>Marketing cookies:</strong> We do not use third-party advertising networks, retargeting cookies, or behavioural advertising</li>
</ul>
<p>You can withdraw cookie consent and manage preferences at any time via Settings → Privacy.</p>
</section>

<section id="s13">
<h2>13. Your Rights Under the AVG (Art. 15–22)</h2>
<p>To exercise any right, email riki@dancehealthy.net with the subject "AVG Rights Request". We will verify your identity and respond within one calendar month (AVG Art. 12). The deadline may be extended by a further two months for complex or numerous requests, with notice to you.</p>
<ul>
  <li><strong>Art. 15 — Right of access (inzagerecht):</strong> Request a copy of all personal data we hold about you</li>
  <li><strong>Art. 16 — Right to rectification (recht op rectificatie):</strong> Correct inaccurate or incomplete data</li>
  <li><strong>Art. 17 — Right to erasure / "right to be forgotten" (recht op vergetelheid):</strong> Request deletion of your data, subject to legal retention obligations</li>
  <li><strong>Art. 18 — Right to restriction of processing (recht op beperking):</strong> Restrict how we use your data in certain circumstances</li>
  <li><strong>Art. 20 — Right to data portability (dataportabiliteit):</strong> Receive your data in a structured, machine-readable format (JSON or CSV)</li>
  <li><strong>Art. 21 — Right to object (recht van bezwaar):</strong> Object to processing based on legitimate interests, or to direct marketing at any time</li>
  <li><strong>Art. 22 — Rights related to automated decision-making:</strong> Not to be subject to solely automated decisions with significant legal or similarly significant effects</li>
</ul>
</section>

<section id="s14">
<h2>14. Data Security</h2>
<p>We implement appropriate technical and organisational measures (TOMs) to protect your personal data, in accordance with AVG Art. 32:</p>
<ul>
  <li>Encryption in transit (TLS 1.2+) for all data exchanged between your device and our servers</li>
  <li>Passwords stored using bcrypt hashing — never in plain text</li>
  <li>Instagram access tokens encrypted at rest using AES-256</li>
  <li>Role-based access controls restricting staff access to personal data on a need-to-know basis</li>
  <li>Regular security assessments and vulnerability monitoring</li>
  <li>Database encryption at rest (Neon PostgreSQL)</li>
  <li>Rate limiting and abuse detection on all API endpoints</li>
</ul>
</section>

<section id="s15">
<h2>15. Data Breach Notification</h2>
<p>In the event of a personal data breach that poses a risk to your rights and freedoms, we will notify the Autoriteit Persoonsgegevens (AP) within 72 hours as required by AVG Art. 33. We will notify affected individuals without undue delay pursuant to AVG Art. 34, including: the nature of the breach, approximate number of affected individuals, likely consequences, and measures taken or proposed.</p>
</section>

<section id="s16">
<h2>16. Children's Privacy</h2>
<p>The Platform is not intended for children under 16. We do not knowingly collect personal data from children under 16. If we discover that we have collected data from a child under 16 without verified parental consent, we will delete it promptly. If you believe a child's data has been collected in error, contact us immediately at riki@dancehealthy.net. This age threshold complies with Artikel 16 AVG as implemented in the Netherlands (Uitvoeringswet AVG).</p>
</section>

<section id="s17">
<h2>17. Changes to this Policy</h2>
<p>We may update this Privacy Policy to reflect changes in our practices or applicable law. Material changes will be communicated via email and in-app notification at least 30 days before they take effect. The version number and effective date at the top of this document indicate the most recent revision. Continued use of the Platform after the effective date of a revision constitutes acceptance of the updated Policy.</p>
</section>

<section id="s18">
<h2>18. Complaints</h2>
<p>You have the right to lodge a complaint with the Dutch supervisory authority:</p>
<p><strong>Autoriteit Persoonsgegevens (AP)</strong><br/>
Postbus 93374, 2509 AJ Den Haag<br/>
Website: <a href="https://www.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">www.autoriteitpersoonsgegevens.nl</a></p>
<p>We encourage you to contact us first at riki@dancehealthy.net so we can try to resolve your concern directly and promptly.</p>
</section>

<section id="s19">
<h2>19. Contact</h2>
<p><strong>Urban Culture</strong><br/>
Herenstraat 32, Zaandam, The Netherlands<br/>
Email: riki@dancehealthy.net | Tel: +31 6 841 86452</p>
</section>
`;

/* ─── Dutch content ───────────────────────────────────────────────────────── */

const PRIVACY_CONTENT_NL = `
<section id="s1">
<h2>1. Verwerkingsverantwoordelijke</h2>
<p>Urban Culture, Herenstraat 32, Zaandam, Nederland, is de verwerkingsverantwoordelijke voor uw persoonsgegevens conform de Algemene Verordening Gegevensbescherming (AVG) / GDPR (EU) 2016/679.</p>
<p><strong>Contact:</strong> riki@dancehealthy.net | Tel: +31 6 841 86452</p>
</section>

<section id="s2">
<h2>2. Persoonsgegevens die wij verzamelen</h2>
<p>Wij verzamelen de volgende categorieën persoonsgegevens:</p>
<ul>
  <li><strong>Accountgegevens:</strong> naam, e-mailadres, telefoonnummer, profielafbeelding, gebruikersnaam, wachtwoord (bcrypt-gehasht — nooit opgeslagen als leesbare tekst)</li>
  <li><strong>Profielgegevens:</strong> biografie, woonplaats, artistieke rol (b-boy/b-girl, artiest, organisator, etc.), socialemedialinks</li>
  <li><strong>Inhoudsgegevens:</strong> berichten, reacties, evenementen die u aanmaakt, marktplaatsadvertenties, spots die u aan de kaart toevoegt, en Reels-video's die u uploadt</li>
  <li><strong>Locatiegegevens:</strong> globale GPS-coördinaten — alleen met uw expliciete toestemming, automatisch verwijderd na 24 uur; precieze coördinaten worden nooit opgeslagen</li>
  <li><strong>Technische gegevens:</strong> IP-adres, browsertype, apparaattype, besturingssysteem, sessielogboeken</li>
  <li><strong>Betalingsgegevens:</strong> transactiereferenties en bedragen. Kaartgegevens worden uitsluitend verwerkt door Stripe (PCI-DSS Level 1) — wij slaan deze nooit op</li>
  <li><strong>Communicatiegegevens:</strong> berichten uitgewisseld via de chat-functie van het Platform</li>
  <li><strong>Toestemmingsregistraties:</strong> tijdstempel, IP-adres en user agent bij acceptatie van onze juridische documenten, conform AVG Art. 7(1)</li>
  <li><strong>Push notificatie-tokens:</strong> apparaattokens voor het bezorgen van pushberichten (iOS APNs / Android FCM); opgeslagen totdat u meldingen uitschakelt of uw account verwijdert</li>
  <li><strong>Videogegevens:</strong> Reels en videocontent die u uploadt, inclusief bijbehorende metadata (duur, formaat, uploadtijdstempel)</li>
  <li><strong>Instagram-gegevens:</strong> als u uw Instagram Business-account koppelt, krijgen wij toegang tot uw Instagram-gebruikersnaam, profielinformatie en content die u via ons Platform wilt publiceren, conform de Instagram Business Login-rechten</li>
</ul>
</section>

<section id="s3">
<h2>3. Rechtsgrondslag voor verwerking (AVG Art. 6)</h2>
<ul>
  <li><strong>Uitvoering van een overeenkomst (Art. 6(1)(b)):</strong> Accountbeheer, dienstverlening, evenementboeking, markttransacties en alle kernfunctionaliteit van het Platform</li>
  <li><strong>Gerechtvaardigd belang (Art. 6(1)(f)):</strong> Beveiliging, fraudepreventie, platformanalyse en serviceverbetering — altijd afgewogen tegen uw belangen en rechten</li>
  <li><strong>Toestemming (Art. 6(1)(a)):</strong> Locatiedeling, marketing-e-mails, analytische cookies, Instagram-integratie en AI-functies — intrekbaar op elk moment via Instellingen</li>
  <li><strong>Wettelijke verplichting (Art. 6(1)(c)):</strong> Fiscale bewaarplicht (7 jaar, art. 52 AWR), anti-witwasverplichtingen en naleving van rechtelijke bevelen</li>
</ul>
</section>

<section id="s4">
<h2>4. Doeleinden van verwerking</h2>
<ul>
  <li>Aanbieden, exploiteren en verbeteren van het Platform en alle functies (community, evenementen, kaart, marktplaats, Reels, AI-tools, chat)</li>
  <li>Verwerken van betalingen en beheren van markttransacties via Stripe</li>
  <li>Versturen van servicegerelateerde communicatie (accountverificatie, boekingsbevestigingen, ticketaflevering)</li>
  <li>Bezorgen van pushmeldingen wanneer u hiervoor kiest</li>
  <li>Inschakelen van AI-functies zoals contentvoorstellen en marketingteksten voor evenementen</li>
  <li>Inschakelen van Reels en video-deling binnen de community</li>
  <li>Publiceren op Instagram Business als u uw account koppelt</li>
  <li>Opsporen en voorkomen van fraude, misbruik en beveiligingsdreigingen</li>
  <li>Nakomen van wettelijke verplichtingen op grond van Nederlands en EU-recht</li>
  <li>Versturen van marketingcommunicatie — uitsluitend met uw expliciete toestemming, intrekbaar via Instellingen → Meldingen</li>
</ul>
</section>

<section id="s5">
<h2>5. Bewaartermijnen</h2>
<ul>
  <li><strong>Accountgegevens:</strong> Gedurende de looptijd van uw account plus 2 jaar na sluiting (voor juridische aanspraken)</li>
  <li><strong>Financiële gegevens / transactiegegevens:</strong> 7 jaar (fiscale bewaarplicht op grond van Artikel 52 AWR)</li>
  <li><strong>Toestemmingsregistraties:</strong> 5 jaar vanaf de datum van acceptatie (vereist voor het aantonen van naleving)</li>
  <li><strong>Locatiegegevens:</strong> Maximaal 24 uur na het delen (uitsluitend voor nabijheidsfuncties)</li>
  <li><strong>Chatberichten:</strong> Tot u of de andere partij ze verwijdert, of uw account wordt gesloten</li>
  <li><strong>Server-/toegangslogboeken:</strong> 90 dagen</li>
  <li><strong>Push notificatie-tokens:</strong> Tot u meldingen uitschakelt of uw account verwijdert</li>
  <li><strong>Verwijderingsverzoekregistraties:</strong> 3 jaar (ter aantoning van naleving van AVG Art. 17)</li>
  <li><strong>Video-/Reels-content:</strong> Tot u de content verwijdert of uw account sluit</li>
  <li><strong>AI-sessiegegevens:</strong> Niet bewaard na de actieve aanvraag; prompts worden na verwerking niet opgeslagen op onze infrastructuur</li>
</ul>
</section>

<section id="s6">
<h2>6. Subverwerkers &amp; Derden</h2>
<p>Wij maken gebruik van de volgende subverwerkers op grond van AVG Art. 28-verwerkersovereenkomsten. Elke verwerker is contractueel verplicht uw gegevens te beschermen:</p>
<ul>
  <li><strong>Firebase / Google LLC</strong> — Authenticatie, pushmeldingen (FCM), crashrapportage (EU-dataverwerking waar beschikbaar)</li>
  <li><strong>Neon Inc.</strong> — PostgreSQL-databasehosting (EU-regio)</li>
  <li><strong>Stripe Inc.</strong> — Betalingsverwerking (PCI-DSS Level 1 gecertificeerd)</li>
  <li><strong>Cloudinary Ltd.</strong> — Opslag en transformatie van afbeeldingen, video's en media (inclusief Reels)</li>
  <li><strong>Mailgun Technologies (Sinch)</strong> — Transactionele e-mailbezorging</li>
  <li><strong>OpenAI LLC</strong> — Optionele AI-functies. Prompts bevatten geen identificerende persoonsgegevens. OpenAI bewaart prompts niet na de actieve API-aanroep (via de API in niet-trainingsmodus)</li>
  <li><strong>Anthropic PBC</strong> — Optionele AI-functies (alternatief voor OpenAI). Dezelfde principes van dataminimalisatie zijn van toepassing</li>
  <li><strong>Apple Inc. (APNs)</strong> — Bezorging van iOS-pushmeldingen</li>
  <li><strong>Meta Platforms Inc. (Instagram)</strong> — Instagram Business API, uitsluitend als u uw Instagram-account expliciet koppelt. Gedeelde gegevens zijn beperkt tot wat u autoriseert via Instagram Business Login</li>
  <li><strong>Kamer van Koophandel (KVK)</strong> — Bedrijfsverificatie voor Nederland</li>
</ul>
<p><strong>Wij verkopen, verhuren of verhandelen uw persoonsgegevens niet aan derden voor commerciële doeleinden.</strong></p>
</section>

<section id="s7">
<h2>7. Internationale doorgifte</h2>
<p>Sommige subverwerkers zijn gevestigd buiten de EU/EER (voornamelijk de Verenigde Staten). Wij waarborgen passende bescherming via Standaard Contractuele Clausules (SCC's) zoals goedgekeurd door de Europese Commissie op grond van AVG Art. 46(2)(c), en — waar van toepassing — via het EU-VS Data Privacy Framework. Een overzicht van relevante SCC's is op verzoek beschikbaar via riki@dancehealthy.net.</p>
</section>

<section id="s8">
<h2>8. Mobiele app &amp; iOS-gegevens</h2>
<p>Wanneer u de Urban Culture iOS- of Android-applicatie gebruikt, kunnen de volgende aanvullende gegevens worden verzameld:</p>
<ul>
  <li><strong>Apparaat push-token (APNs / FCM):</strong> Gebruikt voor het bezorgen van pushmeldingen. Opgeslagen tot u meldingen uitschakelt of uw account verwijdert</li>
  <li><strong>Crashrapporten:</strong> Verzameld via Firebase Crashlytics voor het diagnosticeren van stabiliteitsproblemen. Crashdata bevat geen persoonlijke inhoud</li>
  <li><strong>App-gebruiksanalyses:</strong> Geaggregeerde, anonieme sessiegegevens (schermweergaven, functiegebruik) — uitsluitend verzameld met uw toestemming</li>
  <li><strong>Camera / microfoon / fotobibliotheek:</strong> Alleen gebruikt wanneer u expliciet functies gebruikt die dit vereisen (bijv. uploaden van een profielafbeelding of Reel). Wij hebben geen toegang zonder uw actieve toestemming</li>
  <li><strong>Locatie:</strong> Uitsluitend gebruikt voor de "Nearby"-ontdekkingsfunctie wanneer u hiervoor kiest. Precieze locatie wordt nooit opgeslagen; alleen een globale straal wordt gebruikt</li>
</ul>
<p>Urban Culture voldoet aan de App Store Review Guidelines van Apple (§5 — Privacy, §2.5 — Softwarevereisten) en de privacylabelverplichtingen voor alle gegevens die via iOS worden verzameld.</p>
</section>

<section id="s9">
<h2>9. AI-functies &amp; Profilering</h2>
<p>Urban Culture biedt optionele AI-functies, waaronder het genereren van marketingteksten voor evenementen, contentvoorstellen en community-ontdekkingstools. Wanneer u deze functies gebruikt:</p>
<ul>
  <li>Uw invoer (bijv. een evenementomschrijving die u typt) wordt doorgestuurd naar OpenAI of Anthropic. Wij verwijderen identificerende informatie (naam, e-mail, gebruikers-ID) uit alle AI-prompts vóór verzending</li>
  <li>AI-providers verwerken prompts via de API en bewaren uw invoer niet na de actieve aanvraag (Urban Culture gebruikt de API in niet-trainingsmodus)</li>
  <li>Wij nemen geen volledig geautomatiseerde beslissingen die rechtsgevolgen of vergelijkbaar significante gevolgen voor u hebben, in de zin van AVG Art. 22</li>
  <li>Platformaanbevelingen (voorgestelde evenementen, gebruikers in de buurt, trending content) zijn gebaseerd op uw opgegeven voorkeuren en opt-in locatiegegevens — u kunt deze op elk moment uitschakelen via Instellingen → Privacy</li>
  <li>AI-gegenereerde contentvoorstellen worden altijd als suggesties weergegeven die u kunt beoordelen en bewerken — ze worden nooit zonder uw expliciete bevestiging gepubliceerd</li>
  <li>Wij gebruiken AI niet om content te genereren, te wijzigen of toe te schrijven aan andere gebruikers zonder hun expliciete toestemming</li>
</ul>
</section>

<section id="s10">
<h2>10. Reels &amp; Video-inhoud</h2>
<p>Met de Reels-functie kunnen gebruikers korte videocontent uploaden en delen binnen de Urban Culture-community. Wanneer u Reels gebruikt:</p>
<ul>
  <li><strong>Videobestanden</strong> worden geüpload en opgeslagen via Cloudinary (EU-regio opslag waar beschikbaar). Uw video is gekoppeld aan uw account</li>
  <li><strong>Metadata</strong> zoals uploadtijdstempel, duur en resolutie wordt opgeslagen in onze database</li>
  <li><strong>Interactiegegevens</strong> (likes, reacties, weergaven) worden opgeslagen en gekoppeld aan uw account en de content</li>
  <li><strong>Openbare Reels</strong> zijn zichtbaar voor alle platformgebruikers. Privé- of community-beperkte Reels zijn alleen zichtbaar voor het publiek dat u kiest</li>
  <li>U behoudt het volledige eigendom van uw videocontent. U verleent Urban Culture een beperkte, niet-exclusieve licentie om de video te hosten, te transcoderen, te tonen en te distribueren binnen het Platform</li>
  <li>U kunt uw Reels op elk moment verwijderen. Verwijdering verwijdert de content van het Platform; CDN-cachereplica's kunnen tot 72 uur na verwijdering nog bestaan</li>
</ul>
</section>

<section id="s11">
<h2>11. Instagram Business-integratie</h2>
<p>Urban Culture biedt een optionele Instagram Business Login-integratie waarmee evenementenorganisatoren en creators content rechtstreeks vanuit ons Platform op hun Instagram Business-account kunnen publiceren. Deze integratie is volledig optioneel.</p>
<p>Wanneer u uw Instagram Business-account koppelt:</p>
<ul>
  <li>Wij vragen alleen de minimaal benodigde rechten aan: <code>instagram_business_basic</code>, <code>instagram_business_content_publish</code>, <code>instagram_business_manage_comments</code> en <code>instagram_business_manage_insights</code></li>
  <li>Uw Instagram-toegangstoken wordt veilig en versleuteld opgeslagen; het wordt uitsluitend gebruikt voor acties die u expliciet initieert binnen het Platform</li>
  <li>Wij plaatsen niets op uw Instagram zonder uw expliciete actie (bijv. klikken op "Publiceer naar Instagram")</li>
  <li>Wij hebben geen toegang tot uw Instagram-directe berichten of persoonlijke accountgegevens buiten de verleende rechten</li>
  <li>U kunt uw Instagram-account op elk moment loskoppelen via Instellingen → Integraties. Bij het loskoppelen verwijderen wij uw opgeslagen Instagram-toegangstoken onmiddellijk</li>
  <li>Uw gebruik van Instagram via ons Platform is tevens onderworpen aan de <a href="https://help.instagram.com/581066165581870" target="_blank" rel="noopener noreferrer">Platformvoorwaarden van Meta</a> en het <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer">Privacybeleid van Instagram</a></li>
</ul>
</section>

<section id="s12">
<h2>12. Cookies</h2>
<p>Wij gebruiken cookies en vergelijkbare trackingtechnologieën. Uitgebreide informatie:</p>
<ul>
  <li><strong>Essentiële cookies (geen toestemming vereist):</strong> Sessiebeheer, beveiliging (CSRF-bescherming), authenticatiestatus. Deze kunnen niet worden uitgeschakeld omdat ze strikt noodzakelijk zijn voor de werking van het Platform</li>
  <li><strong>Analytische cookies (toestemming vereist):</strong> Geaggregeerde gebruiksstatistieken om te begrijpen hoe het Platform wordt gebruikt. Uitsluitend verzameld nadat u expliciet akkoord gaat. U kunt uw toestemming op elk moment intrekken via Instellingen → Privacy</li>
  <li><strong>Marketingcookies:</strong> Wij gebruiken geen externe advertentienetwerken, retargetingcookies of gedragsgerichte reclame</li>
</ul>
<p>U kunt uw cookietoestemming beheren en op elk moment intrekken via Instellingen → Privacy.</p>
</section>

<section id="s13">
<h2>13. Uw rechten onder de AVG (Art. 15–22)</h2>
<p>Om een recht uit te oefenen, stuurt u een e-mail naar riki@dancehealthy.net met het onderwerp "AVG-rechtenverzoek". Wij verifiëren uw identiteit en reageren binnen één kalendermaand (AVG Art. 12). De termijn kan met twee maanden worden verlengd voor complexe verzoeken, met kennisgeving aan u.</p>
<ul>
  <li><strong>Art. 15 — Recht op inzage (inzagerecht):</strong> Verzoek om een kopie van alle persoonsgegevens die wij over u bewaren</li>
  <li><strong>Art. 16 — Recht op rectificatie (recht op rectificatie):</strong> Onjuiste of onvolledige gegevens corrigeren</li>
  <li><strong>Art. 17 — Recht op verwijdering / "recht op vergetelheid":</strong> Verzoek om verwijdering van uw gegevens, met inachtneming van wettelijke bewaarverplichtingen</li>
  <li><strong>Art. 18 — Recht op beperking van de verwerking:</strong> Beperking van de manier waarop wij uw gegevens gebruiken in bepaalde omstandigheden</li>
  <li><strong>Art. 20 — Recht op dataportabiliteit:</strong> Ontvang uw gegevens in een gestructureerd, machineleesbaar formaat (JSON of CSV)</li>
  <li><strong>Art. 21 — Recht van bezwaar:</strong> Bezwaar maken tegen verwerking op basis van gerechtvaardigd belang, of tegen direct marketing op elk moment</li>
  <li><strong>Art. 22 — Rechten met betrekking tot geautomatiseerde besluitvorming:</strong> Niet onderworpen zijn aan uitsluitend geautomatiseerde beslissingen met significante rechtsgevolgen</li>
</ul>
</section>

<section id="s14">
<h2>14. Gegevensbeveiliging</h2>
<p>Wij implementeren passende technische en organisatorische maatregelen (TOMs) ter bescherming van uw persoonsgegevens, conform AVG Art. 32:</p>
<ul>
  <li>Versleuteling tijdens verzending (TLS 1.2+) voor alle gegevensuitwisseling tussen uw apparaat en onze servers</li>
  <li>Wachtwoorden opgeslagen met bcrypt-hashing — nooit als leesbare tekst</li>
  <li>Instagram-toegangstokens versleuteld in rust met AES-256</li>
  <li>Rolgebaseerde toegangscontroles die de toegang van medewerkers tot persoonsgegevens beperken op basis van need-to-know</li>
  <li>Regelmatige beveiligingsbeoordelingen en kwetsbaarheidsbewaking</li>
  <li>Databaseversleuteling in rust (Neon PostgreSQL)</li>
  <li>Snelheidsbegrenzing en misbruikdetectie op alle API-eindpunten</li>
</ul>
</section>

<section id="s15">
<h2>15. Melding datalekken</h2>
<p>In geval van een persoonsdatalek dat een risico vormt voor uw rechten en vrijheden, informeren wij de Autoriteit Persoonsgegevens (AP) binnen 72 uur conform AVG Art. 33. Wij informeren getroffen personen zonder onnodige vertraging conform AVG Art. 34, inclusief: de aard van het lek, het geschatte aantal getroffen personen, de waarschijnlijke gevolgen en de genomen of voorgestelde maatregelen.</p>
</section>

<section id="s16">
<h2>16. Privacy van kinderen</h2>
<p>Het Platform is niet bedoeld voor kinderen jonger dan 16 jaar. Wij verzamelen niet bewust persoonsgegevens van kinderen jonger dan 16 jaar. Indien wij ontdekken dat wij gegevens van een kind jonger dan 16 jaar hebben verzameld zonder geverifieerde toestemming van ouders of voogd, verwijderen wij deze onmiddellijk. Als u denkt dat de gegevens van een kind per ongeluk zijn verzameld, neem dan onmiddellijk contact met ons op via riki@dancehealthy.net. Deze leeftijdsdrempel voldoet aan Artikel 16 AVG zoals geïmplementeerd in Nederland (Uitvoeringswet AVG).</p>
</section>

<section id="s17">
<h2>17. Wijzigingen in dit beleid</h2>
<p>Wij kunnen dit Privacybeleid bijwerken om wijzigingen in onze praktijken of het toepasselijke recht te weerspiegelen. Materiële wijzigingen worden via e-mail en in-app-melding bekendgemaakt ten minste 30 dagen voordat ze van kracht worden. Het versienummer en de ingangsdatum bovenaan dit document geven de meest recente revisie aan. Voortgezet gebruik van het Platform na de ingangsdatum van een revisie houdt aanvaarding van het bijgewerkte beleid in.</p>
</section>

<section id="s18">
<h2>18. Klachten</h2>
<p>U heeft het recht een klacht in te dienen bij de Nederlandse toezichthoudende autoriteit:</p>
<p><strong>Autoriteit Persoonsgegevens (AP)</strong><br/>
Postbus 93374, 2509 AJ Den Haag<br/>
Website: <a href="https://www.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">www.autoriteitpersoonsgegevens.nl</a></p>
<p>Wij moedigen u aan om eerst contact met ons op te nemen via riki@dancehealthy.net zodat wij uw bezwaar direct en snel kunnen proberen op te lossen.</p>
</section>

<section id="s19">
<h2>19. Contact</h2>
<p><strong>Urban Culture</strong><br/>
Herenstraat 32, Zaandam, Nederland<br/>
E-mail: riki@dancehealthy.net | Tel: +31 6 841 86452</p>
</section>
`;

/* ─── component ──────────────────────────────────────────────────────────── */

export default function PrivacyPolicyPage() {
  const [privacyContent, setPrivacyContent] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [hasAccepted, setHasAccepted] = useState(false);
  const [acceptedDate, setAcceptedDate] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState("s1");
  const { toast } = useToast();
  const { user, getToken } = useAuth();
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPrivacyContent = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/legal/privacy-policy?language=${selectedLanguage}`);
        const data = await response.json();
        if (data?.content) setPrivacyContent(data);
        else throw new Error("No content");
      } catch {
        setPrivacyContent({
          id: 2, type: "privacy_policy", language: selectedLanguage,
          title: selectedLanguage === "nl" ? "Privacybeleid" : "Privacy Policy",
          content: selectedLanguage === "nl" ? PRIVACY_CONTENT_NL : PRIVACY_CONTENT_EN,
          version: "2026.2", effectiveDate: "2026-01-01T00:00:00.000Z",
          lastUpdated: "2026-03-01T00:00:00.000Z", isActive: true,
        });
      } finally { setIsLoading(false); }
    };

    const checkUserConsent = async () => {
      if (!user) return;
      try {
        const authToken = await getToken();
        const headers: Record<string, string> = {};
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        if (user.id) headers["x-user-id"] = String(user.id);
        const response = await fetch("/api/legal/user-consent", { headers });
        const data = await response.json();
        setHasAccepted(!!data.privacyAccepted);
        if (data.privacyAcceptedAt) setAcceptedDate(new Date(data.privacyAcceptedAt));
      } catch { setHasAccepted(false); }
    };

    fetchPrivacyContent();
    if (user) checkUserConsent();
  }, [selectedLanguage, user]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    contentRef.current.querySelectorAll("section[id]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [isLoading, selectedLanguage]);

  const handleAcceptPrivacy = async () => {
    if (!user) {
      toast({ title: selectedLanguage === "nl" ? "Inloggen vereist" : "Sign in required", description: selectedLanguage === "nl" ? "Log in om het Privacybeleid te accepteren." : "Please sign in to accept the Privacy Policy.", variant: "destructive" });
      return;
    }
    try {
      const authToken = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      if (user.id) headers["x-user-id"] = String(user.id);
      await fetch("/api/legal/accept-privacy", { method: "POST", headers, body: JSON.stringify({ userId: user.id }) });
      setHasAccepted(true);
      setAcceptedDate(new Date());
      await queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consent"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consents"] });
      toast({ title: selectedLanguage === "nl" ? "Privacybeleid geaccepteerd" : "Privacy Policy accepted", description: selectedLanguage === "nl" ? "Uw acceptatie is vastgelegd." : "Your acceptance has been recorded." });
    } catch { toast({ title: "Error", description: "Failed to record acceptance. Please try again.", variant: "destructive" }); }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/legal/privacy-policy/pdf?language=${selectedLanguage}`, "_blank");
    toast({ title: selectedLanguage === "nl" ? "Download gestart" : "Download started" });
  };

  // Only use server content if it contains proper section IDs (id="s1"), otherwise
  // fall back to the hardcoded full content which has the correct <section id> structure
  const serverContentHasSections = privacyContent.content && privacyContent.content.includes('id="s1"');
  const displayContent = serverContentHasSections
    ? privacyContent.content
    : (selectedLanguage === "nl" ? PRIVACY_CONTENT_NL : PRIVACY_CONTENT_EN);
  const effectiveDate = privacyContent.lastUpdated || privacyContent.effectiveDate || "2026-03-01T00:00:00.000Z";
  const sections = selectedLanguage === "en" ? SECTIONS_EN : SECTIONS_NL;

  return (
    <div className="max-w-6xl mx-auto py-8 px-0">

      {/* ── Hero banner ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-violet-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/20 via-transparent to-transparent" />
        <div className="relative px-6 py-10 sm:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/10 border border-white/20">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-white">
                  {selectedLanguage === "nl" ? "Privacybeleid" : "Privacy Policy"}
                </h1>
                <Badge className="bg-white/15 text-white border-white/20 text-xs">v{privacyContent.version || "2026.2"}</Badge>
                <Badge className="bg-white/15 text-white border-white/20 text-xs">AVG / GDPR</Badge>
                <Badge className="bg-white/15 text-white border-white/20 text-xs">🍎 App Store</Badge>
              </div>
              <p className="text-violet-200 text-sm">
                {selectedLanguage === "nl" ? "Ingangsdatum:" : "Effective:"}{" "}
                {isLoading ? "…" : (() => { try { return format(new Date(effectiveDate), "d MMMM yyyy"); } catch { return "1 March 2026"; } })()}
                {" · "}{selectedLanguage === "nl" ? "Nederland & EU-conform" : "Netherlands & EU Compliant"}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <TabsList className="bg-white/10 border border-white/20">
                <TabsTrigger value="en" className="text-white data-[state=active]:bg-white data-[state=active]:text-slate-900">🇬🇧 English</TabsTrigger>
                <TabsTrigger value="nl" className="text-white data-[state=active]:bg-white data-[state=active]:text-slate-900">🇳🇱 Nederlands</TabsTrigger>
              </TabsList>
            </Tabs>
            <button onClick={handleDownloadPDF} className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Accepted banner ── */}
      {hasAccepted && acceptedDate && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm text-green-700 dark:text-green-400">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>
            {selectedLanguage === "nl"
              ? `Geaccepteerd op ${format(acceptedDate, "d MMMM yyyy 'om' HH:mm")}`
              : `Accepted on ${format(acceptedDate, "d MMMM yyyy 'at' HH:mm")}`}
          </span>
        </div>
      )}

      <div className="flex gap-8 items-start">
        {/* ── TOC sidebar (desktop) — both languages ── */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="sticky top-4 rounded-xl border border-border/60 bg-card p-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {selectedLanguage === "nl" ? "Inhoudsopgave" : "Contents"}
            </p>
            <nav className="space-y-0.5">
              {sections.map(s => (
                <button key={s.id}
                  onClick={() => {
                    const el = document.getElementById(s.id);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                      setActiveSection(s.id);
                    }
                  }}
                  className={`w-full text-left flex items-center gap-1.5 text-xs py-1.5 px-2 rounded-lg transition-colors cursor-pointer
                    ${activeSection === s.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                  {activeSection === s.id && <ChevronRight className="w-3 h-3 shrink-0" />}
                  <span className={activeSection === s.id ? "" : "ml-4"}>{s.title}</span>
                </button>
              ))}
            </nav>
            {!hasAccepted && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button size="sm" className="w-full text-xs" onClick={handleAcceptPrivacy} data-testid="button-accept-privacy">
                  {selectedLanguage === "nl" ? "Accepteren" : "Accept Policy"}
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <div
              ref={contentRef}
              className="prose prose-sm dark:prose-invert max-w-none
                prose-h2:text-lg prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/60
                prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-3
                prose-ul:text-muted-foreground prose-ul:space-y-1.5 prose-li:leading-relaxed
                prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs"
              dangerouslySetInnerHTML={{ __html: displayContent }}
            />
          )}

          {/* ── Accept / nav footer ── */}
          <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <Link href="/legal-hub" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← {selectedLanguage === "nl" ? "Terug naar Legal Center" : "Back to Legal Center"}
            </Link>
            <div className="flex gap-3">
              {!hasAccepted ? (
                <Button onClick={handleAcceptPrivacy} data-testid="button-accept-privacy-footer">
                  {selectedLanguage === "nl" ? "Privacybeleid accepteren" : "Accept Privacy Policy"}
                </Button>
              ) : (
                <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle className="w-4 h-4" /> {selectedLanguage === "nl" ? "Geaccepteerd" : "Accepted"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
