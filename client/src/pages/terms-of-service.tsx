import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { Download, FileText, ChevronRight, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

/* ─── section titles ─────────────────────────────────────────────────────── */

const SECTIONS_EN = [
  { id: "t1",  title: "Acceptance of Terms" },
  { id: "t2",  title: "Operator Details" },
  { id: "t3",  title: "Eligibility" },
  { id: "t4",  title: "Description of Service" },
  { id: "t5",  title: "User Accounts" },
  { id: "t6",  title: "User-Generated Content" },
  { id: "t7",  title: "Prohibited Content" },
  { id: "t8",  title: "Reels & Video" },
  { id: "t9",  title: "AI Features" },
  { id: "t10", title: "Instagram Integration" },
  { id: "t11", title: "Anti-Scraping & API Abuse" },
  { id: "t12", title: "Marketplace" },
  { id: "t13", title: "Intellectual Property" },
  { id: "t14", title: "Privacy" },
  { id: "t15", title: "Limitation of Liability" },
  { id: "t16", title: "Indemnification" },
  { id: "t17", title: "Disclaimer of Warranties" },
  { id: "t18", title: "Suspension & Termination" },
  { id: "t19", title: "Force Majeure" },
  { id: "t20", title: "Apple & Google Platform" },
  { id: "t21", title: "No Waiver & Severability" },
  { id: "t22", title: "Entire Agreement" },
  { id: "t23", title: "Amendments" },
  { id: "t24", title: "Governing Law & Disputes" },
  { id: "t25", title: "Contact" },
];

const SECTIONS_NL = [
  { id: "t1",  title: "Aanvaarding van de voorwaarden" },
  { id: "t2",  title: "Gegevens van de aanbieder" },
  { id: "t3",  title: "Leeftijdsvereiste" },
  { id: "t4",  title: "Beschrijving van de dienst" },
  { id: "t5",  title: "Gebruikersaccounts" },
  { id: "t6",  title: "Door gebruikers gegenereerde inhoud" },
  { id: "t7",  title: "Verboden inhoud" },
  { id: "t8",  title: "Reels & Video" },
  { id: "t9",  title: "AI-functies" },
  { id: "t10", title: "Instagram-integratie" },
  { id: "t11", title: "Anti-scraping & API-misbruik" },
  { id: "t12", title: "Marktplaats" },
  { id: "t13", title: "Intellectuele eigendom" },
  { id: "t14", title: "Privacy" },
  { id: "t15", title: "Aansprakelijkheidsbeperking" },
  { id: "t16", title: "Vrijwaring" },
  { id: "t17", title: "Garantiedisclaimer" },
  { id: "t18", title: "Schorsing & Beëindiging" },
  { id: "t19", title: "Overmacht" },
  { id: "t20", title: "App Store Terms" },
  { id: "t21", title: "Geen verklaring van afstand & Scheidbaarheid" },
  { id: "t22", title: "Volledige overeenkomst" },
  { id: "t23", title: "Wijzigingen" },
  { id: "t24", title: "Toepasselijk recht & Geschillen" },
  { id: "t25", title: "Contact" },
];

/* ─── English content ────────────────────────────────────────────────────── */

const TOS_CONTENT_EN = `
<section id="t1">
<h2>1. Acceptance of Terms</h2>
<p>By registering for, downloading, or using the Urban Culture platform — including the website at urbanculturehub.nl, the iOS application (App Store ID: 6743952291), the Android application, and any related services (collectively, the "Platform") — you agree to be legally bound by these Terms of Service ("Terms"), effective as of 1 January 2026. These Terms constitute a legally binding agreement between you ("User", "you") and Urban Culture ("Urban Culture", "we", "us", or "our").</p>
<p>If you do not agree with any part of these Terms, you must immediately discontinue your use of the Platform and, if applicable, delete the application from your device.</p>
</section>

<section id="t2">
<h2>2. Operator Details</h2>
<p><strong>Urban Culture</strong><br/>
Herenstraat 32, Zaandam, The Netherlands<br/>
Email: riki@dancehealthy.net | Tel: +31 6 841 86452<br/>
Website: urbanculturehub.nl</p>
</section>

<section id="t3">
<h2>3. Eligibility</h2>
<p>You must be at least 16 years of age to use the Platform. If you are between 16 and 18, you represent that you have obtained parental or guardian consent. By accepting these Terms, you confirm that you meet these age requirements in accordance with the Algemene Verordening Gegevensbescherming (AVG / GDPR) and applicable Dutch law (Uitvoeringswet AVG). Urban Culture reserves the right to terminate accounts where age requirements cannot be verified.</p>
</section>

<section id="t4">
<h2>4. Description of Service</h2>
<p>Urban Culture is a community platform for hip-hop, breakdancing, b-boying/b-girling, graffiti, skateboarding, and urban street culture, connecting artists, athletes, event organizers, and enthusiasts across the Netherlands and beyond. The Platform includes:</p>
<ul>
  <li><strong>Community feed:</strong> posts, comments, likes, and social interaction</li>
  <li><strong>Events:</strong> event creation, discovery, booking, and ticket management</li>
  <li><strong>Map:</strong> location-based discovery of urban spots, events, and community members</li>
  <li><strong>Marketplace:</strong> buying and selling of products, services, and gear</li>
  <li><strong>Reels:</strong> short-form video upload and sharing</li>
  <li><strong>Chat:</strong> private messaging between users</li>
  <li><strong>AI tools:</strong> optional AI-assisted content creation and suggestions</li>
  <li><strong>Instagram integration:</strong> optional publishing to connected Instagram Business accounts</li>
</ul>
<p>The Platform is provided "as is" and may be modified, expanded, or discontinued at any time. We do not guarantee uninterrupted or error-free availability.</p>
</section>

<section id="t5">
<h2>5. User Accounts</h2>
<p>To access certain features, you must register for an account. You agree to provide truthful, accurate, and complete information and to keep your details up to date. You are solely responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account. You must notify us immediately at riki@dancehealthy.net of any suspected unauthorized access. Urban Culture is not liable for any loss or damage arising from your failure to protect your account credentials.</p>
<p>You may not create multiple accounts, share accounts, or transfer your account to another person without our written consent.</p>
</section>

<section id="t6">
<h2>6. User-Generated Content</h2>
<p>You retain ownership of content you post on the Platform ("User Content"), including posts, photos, videos, Reels, event listings, marketplace listings, comments, and spot suggestions. By posting User Content, you grant Urban Culture a non-exclusive, worldwide, royalty-free, sublicensable, transferable license to use, store, display, reproduce, transcode, modify, distribute, and promote that content solely in connection with operating and improving the Platform. This license expires when you delete the content or close your account, subject to legal retention obligations.</p>
<p>You represent and warrant that: (a) you own or have the necessary rights to your User Content; (b) it does not infringe any third-party intellectual property, privacy, or personality rights; and (c) it complies with these Terms and all applicable law.</p>
<p>Urban Culture acts as a hosting provider within the meaning of Artikel 6:196c Burgerlijk Wetboek and the EU Digital Services Act (DSA) (EU) 2022/2065. We are not responsible for User Content but reserve the right to remove content that violates these Terms or applicable law.</p>
</section>

<section id="t7">
<h2>7. Prohibited Content &amp; Zero-Tolerance Policy</h2>
<p>The following types of content and conduct are strictly prohibited on the Platform. Violations may result in immediate content removal, account suspension, permanent termination, and referral to law enforcement authorities:</p>
<ul>
  <li>Hate speech, discrimination, or incitement to violence based on race, ethnicity, religion, gender, sexual orientation, disability, or any other characteristic protected under Dutch law (Artikel 137c–137g Wetboek van Strafrecht)</li>
  <li>Sexually explicit, pornographic, or obscene material — in particular any content involving minors (which will be reported to the relevant authorities without delay, including the Dutch National Police and the Internet Watch Foundation)</li>
  <li>Content that promotes, glorifies, or facilitates illegal activities, including drug sales, weapons trafficking, or money laundering</li>
  <li>Harassment, bullying, threats, stalking, intimidation, or doxxing (publishing another person's private information without consent)</li>
  <li>Violations of intellectual property rights (copyright, trademark, trade secrets)</li>
  <li>Defamation or unlawful disclosure of another person's personal information</li>
  <li>Spam, phishing, unsolicited commercial messages, or fraudulent listings</li>
  <li>Misinformation that poses a risk to public health, safety, or the integrity of elections</li>
  <li>AI-generated deepfakes designed to deceive or harm individuals</li>
  <li>Impersonation of other individuals, organisations, or public figures</li>
  <li>Content that violates the Apple App Store Review Guidelines</li>
</ul>
<p>All reported content is reviewed by our moderation team. We aim to respond within 72 hours. You may appeal a moderation decision by emailing riki@dancehealthy.net with the subject "Content Appeal" within 14 days of the action taken.</p>
</section>

<section id="t8">
<h2>8. Reels &amp; Video Content</h2>
<p>The Reels feature allows you to upload, share, and view short-form video content. When using Reels:</p>
<ul>
  <li>You may only upload video content that you have the right to share. This includes owning the copyright in the video and any music, images, or other elements within it</li>
  <li>You may not upload content containing copyrighted music without a licence, as this may violate the rights of third parties and applicable Dutch copyright law (Auteurswet)</li>
  <li>Videos are stored via Cloudinary and may be transcoded to optimise delivery. Your original upload is not permanently retained in its original format</li>
  <li>Public Reels are visible to all Platform users. You may set visibility to community-only or private at any time</li>
  <li>Urban Culture reserves the right to remove Reels that violate these Terms, contain prohibited content, or infringe third-party rights</li>
  <li>You may delete your Reels at any time. CDN-cached copies may persist for up to 72 hours following deletion</li>
</ul>
</section>

<section id="t9">
<h2>9. AI-Assisted Features</h2>
<p>Urban Culture offers optional AI-assisted features, including event marketing copy generation, content suggestions, and community tools powered by OpenAI and Anthropic. By using these features, you agree to the following:</p>
<ul>
  <li><strong>Input responsibility:</strong> You are responsible for the accuracy and appropriateness of any input you provide to AI features. Do not enter personal data of third parties, confidential information, or content that violates these Terms</li>
  <li><strong>Output review:</strong> AI-generated content is a suggestion only. You must review, edit, and take responsibility for any content you publish — Urban Culture does not guarantee the accuracy, completeness, or appropriateness of AI-generated outputs</li>
  <li><strong>No harmful use:</strong> You may not use AI features to generate hate speech, illegal content, deepfakes, disinformation, or any content prohibited by Section 7</li>
  <li><strong>No AI training misuse:</strong> You may not use the Platform or its AI features to collect data for training competing AI systems</li>
  <li><strong>Third-party AI terms:</strong> Use of AI features is also subject to the terms of the underlying AI provider (OpenAI: openai.com/policies; Anthropic: anthropic.com/legal)</li>
  <li><strong>Data minimisation:</strong> We strip identifying personal data from AI prompts before they are transmitted to third-party AI providers</li>
</ul>
</section>

<section id="t10">
<h2>10. Instagram Business Integration</h2>
<p>Urban Culture provides an optional Instagram Business Login integration allowing event organisers and creators to publish content directly to their connected Instagram Business account from within the Platform.</p>
<ul>
  <li>This integration is entirely optional and requires your active consent to connect your Instagram Business account</li>
  <li>We request only the minimum required Instagram permissions: <code>instagram_business_basic</code>, <code>instagram_business_content_publish</code>, <code>instagram_business_manage_comments</code>, and <code>instagram_business_manage_insights</code></li>
  <li>We will never post to your Instagram account without your explicit action within the Platform</li>
  <li>You represent that you are the lawful owner or authorised administrator of any Instagram Business account you connect</li>
  <li>You must comply with Meta's Platform Terms and Instagram's Community Guidelines when using this integration</li>
  <li>You may disconnect your Instagram account at any time via Settings → Integrations. We will immediately delete your stored access token upon disconnection</li>
  <li>Urban Culture is not responsible for any content published to Instagram via this integration that you initiated</li>
</ul>
</section>

<section id="t11">
<h2>11. Anti-Scraping, Automation &amp; API Abuse</h2>
<p>You may not use automated tools, bots, crawlers, spiders, scripts, or any form of automated access to scrape, extract, index, or harvest data from the Platform without our express prior written consent. Unauthorised access to or use of our systems or data may constitute a criminal offence under the Wet Computercriminaliteit III (Netherlands) and applicable EU law.</p>
<p>Specifically, you must not:</p>
<ul>
  <li>Use automated means to create accounts, post content, or interact with the Platform in bulk</li>
  <li>Attempt to reverse engineer, decompile, or disassemble any part of the Platform</li>
  <li>Access the Platform through unofficial interfaces or APIs not documented by Urban Culture</li>
  <li>Attempt to bypass, circumvent, or disable any security features, access controls, or rate limits</li>
  <li>Use the Platform's data or content to train AI or machine learning models without express written permission</li>
</ul>
<p>Urban Culture reserves the right to block or restrict access for any user, IP address, or device engaged in such activities, and to seek damages for any harm caused.</p>
</section>

<section id="t12">
<h2>12. Marketplace</h2>
<p>Urban Culture provides a marketplace feature through which users may buy and sell products, equipment, and services. Urban Culture acts solely as an intermediary and is not a party to any transaction between buyers and sellers.</p>
<p>As a <strong>seller</strong>, you are responsible for: the accuracy of your listings, timely fulfilment, compliance with Dutch consumer law (Wet koop op afstand, Boek 7 Burgerlijk Wetboek), and applicable EU law. You must not list counterfeit, stolen, prohibited, or illegal items.</p>
<p>As a <strong>buyer</strong>, you have a statutory 14-calendar-day cooling-off period for distance purchases under Richtlijn 2011/83/EU as implemented in the Netherlands, unless an exception applies (e.g., digital goods, event tickets, perishable items, or custom-made items).</p>
<p>Urban Culture is not liable for any disputes, fraud, defective products, or non-delivery arising from marketplace transactions. If a dispute arises, contact us and we may at our discretion assist in mediation, but we are under no obligation to do so. Payments processed through the Platform are handled by Stripe. Marketplace fees, if applicable, are clearly disclosed prior to listing.</p>
</section>

<section id="t13">
<h2>13. Intellectual Property</h2>
<p>All intellectual property rights in the Platform — including software, design, trademarks, logos, the "Urban Culture Hub" name and branding, and proprietary content — belong to Urban Culture or its licensors and are protected by Dutch and international intellectual property law (Auteurswet, Merkenrecht). Nothing in these Terms grants you any licence to use our trademarks, trade name, or intellectual property without prior written consent.</p>
<p>If you believe that your copyright has been infringed on the Platform, please submit a takedown notice to riki@dancehealthy.net including: (a) identification of the copyrighted work; (b) identification of the infringing material and its location; (c) your contact information; and (d) a good-faith statement that the use is not authorised. We will respond within 14 business days.</p>
</section>

<section id="t14">
<h2>14. Privacy</h2>
<p>Your use of the Platform is governed by our Privacy Policy (AVG/GDPR compliant, Version 2026.2), which is incorporated into these Terms by reference. By using the Platform, you confirm that you have read and accept the Privacy Policy. The Privacy Policy is available at urbanculturehub.nl/privacy-policy and within the Platform's Legal Hub.</p>
</section>

<section id="t15">
<h2>15. Limitation of Liability</h2>
<p>To the maximum extent permitted by Dutch law (Boek 6 Burgerlijk Wetboek), Urban Culture's total aggregate liability to you for any claim arising out of or relating to these Terms or the Platform — whether based in contract, tort, or otherwise — shall not exceed the greater of: (a) the total amounts paid by you to Urban Culture in the 12 months preceding the claim; or (b) €100.</p>
<p>Urban Culture is not liable for:</p>
<ul>
  <li>Indirect, incidental, special, punitive, or consequential damages</li>
  <li>Loss of profits, revenue, data, goodwill, or business opportunities</li>
  <li>Damages arising from third-party conduct, marketplace disputes, or User Content</li>
  <li>Service interruptions, security breaches, or technical failures beyond our reasonable control</li>
  <li>Outcomes or losses resulting from AI-generated content you publish</li>
  <li>Content published to your Instagram account via the integration that you explicitly initiated</li>
</ul>
<p>This limitation does not apply to liability arising from intent (opzet) or gross negligence (grove nalatigheid) on our part, nor does it affect any statutory consumer rights you may have under Dutch or EU law.</p>
</section>

<section id="t16">
<h2>16. Indemnification</h2>
<p>To the fullest extent permitted by applicable law, you agree to defend, indemnify, and hold harmless Urban Culture and its directors, officers, employees, contractors, partners, licensors, and agents (collectively, "Urban Culture Parties") from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable legal fees) arising from or related to:</p>
<ul>
  <li>Your use of or access to the Platform</li>
  <li>Your violation of these Terms or any applicable law or regulation</li>
  <li>Your User Content, including any Reels or marketplace listings you submit</li>
  <li>Your use of AI features, including the publishing of AI-generated content</li>
  <li>Your use of the Instagram integration and any content published to Instagram via the Platform</li>
  <li>Your violation of any third party's rights, including intellectual property, privacy, or publicity rights</li>
  <li>Any dispute between you and another user or third party in connection with the Platform</li>
</ul>
</section>

<section id="t17">
<h2>17. Disclaimer of Warranties</h2>
<p>The Platform and all content, features, and functionality thereof are provided on an <strong>"AS IS" and "AS AVAILABLE"</strong> basis, without warranties of any kind, either express or implied. To the maximum extent permitted by Dutch law, Urban Culture expressly disclaims all warranties, including implied warranties of merchantability, fitness for a particular purpose, non-infringement, and accuracy.</p>
<p>Urban Culture does not warrant that the Platform will be uninterrupted, timely, secure, or error-free; that results obtained will be accurate or reliable; that errors will be corrected; that AI-generated content will be accurate, appropriate, or fit for any purpose; or that the Platform is free of viruses or other harmful components.</p>
<p>This disclaimer does not affect any statutory rights you may have as a consumer under Dutch or EU law.</p>
</section>

<section id="t18">
<h2>18. Suspension &amp; Termination</h2>
<p>Urban Culture may immediately suspend, restrict, or permanently terminate your access to the Platform, with or without notice, if you violate these Terms, engage in prohibited conduct, or if required by law. Grounds include but are not limited to: posting prohibited content, marketplace fraud, account fraud, harassment of other users, or misuse of AI or Instagram integration features.</p>
<p>You may close your account at any time via Settings → Account → Delete Account. Upon termination, your right to use the Platform ceases immediately. Sections 6, 13, 15, 16, 17, 21, 22, and 24 survive termination.</p>
<p>You may appeal a suspension or termination decision by emailing riki@dancehealthy.net with the subject "Account Appeal" within 30 days.</p>
</section>

<section id="t19">
<h2>19. Force Majeure</h2>
<p>Urban Culture shall not be liable for any delay or failure to perform its obligations where such delay or failure results from circumstances beyond our reasonable control, including: acts of God, natural disasters, war, terrorism, civil unrest, government actions, power outages, internet or telecommunications failures, pandemics, or third-party service outages (including those of Stripe, Firebase, Cloudinary, or AI providers). In such circumstances, our obligations will be suspended for the duration of the event.</p>
</section>

<section id="t20">
<h2>20. App Store Terms</h2>
<p>If you download the Urban Culture application from the Apple App Store, the following additional terms apply:</p>
<ul>
  <li><strong>Apple Inc.:</strong> These Terms are between you and Urban Culture only, not Apple. Apple is not responsible for the Platform or its content, maintenance, support, warranties, or claims relating to the Platform. In the event of any third-party claim that the Platform or your possession and use of it infringes a third party's intellectual property rights, Urban Culture, not Apple, will be solely responsible. Apple has no obligation whatsoever to provide any maintenance or support services for the Platform. Apple is a third-party beneficiary of these Terms and, upon your acceptance, Apple will have the right to enforce these Terms against you as a third-party beneficiary</li>
  <li><strong>In-app purchases:</strong> Any purchases made through the Apple App Store are subject to Apple's payment terms. Urban Culture does not have access to your payment credentials used within the App Store</li>
  <li><strong>Platform compliance:</strong> Urban Culture maintains compliance with Apple's App Store Review Guidelines. If our Platform is found to be in violation of any App Store policy, we will take corrective action promptly</li>
</ul>
</section>

<section id="t21">
<h2>21. No Waiver &amp; Severability</h2>
<p><strong>No waiver:</strong> Our failure to enforce any provision of these Terms shall not constitute a waiver of our right to enforce such provision in the future. A waiver of any breach shall not be construed as a waiver of any subsequent breach.</p>
<p><strong>Severability:</strong> If any provision of these Terms is found to be invalid, illegal, or unenforceable under applicable law, that provision shall be deemed severed, and the remaining provisions shall continue in full force and effect.</p>
</section>

<section id="t22">
<h2>22. Entire Agreement</h2>
<p>These Terms, together with our Privacy Policy and any other policies or guidelines incorporated by reference, constitute the entire agreement between you and Urban Culture regarding the Platform, and supersede all prior agreements, representations, and understandings. In the event of any conflict between these Terms and any other Urban Culture policy, these Terms shall prevail.</p>
</section>

<section id="t23">
<h2>23. Amendments</h2>
<p>We may update these Terms from time to time to reflect changes in our services, features (including new AI tools or platform integrations), business, or applicable law. Material changes will be communicated via email and in-app notification at least 30 days before they take effect. The version number and effective date at the top indicate the most recent revision. Your continued use of the Platform after the effective date constitutes acceptance of the updated Terms. If you do not accept, you must stop using the Platform and delete your account.</p>
</section>

<section id="t24">
<h2>24. Governing Law &amp; Dispute Resolution</h2>
<p>These Terms are governed by and construed in accordance with the laws of the Netherlands, without regard to its conflict of law provisions. Any disputes arising out of or in connection with these Terms or the Platform that cannot be resolved amicably shall be submitted to the exclusive jurisdiction of the <strong>Rechtbank Noord-Holland</strong>.</p>
<p>EU consumers may also use the European Commission's Online Dispute Resolution (ODR) platform at <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>, or contact the Dutch Consumer Authority: <strong>ACM Consumentenloket</strong> at <a href="https://www.consuwijzer.nl" target="_blank" rel="noopener noreferrer">consuwijzer.nl</a>.</p>
</section>

<section id="t25">
<h2>25. Contact</h2>
<p><strong>Urban Culture</strong><br/>
Herenstraat 32, Zaandam, The Netherlands<br/>
Email: riki@dancehealthy.net | Tel: +31 6 841 86452<br/>
Website: urbanculturehub.nl</p>
</section>
`;

/* ─── Dutch content ───────────────────────────────────────────────────────── */

const TOS_CONTENT_NL = `
<section id="t1">
<h2>1. Aanvaarding van de voorwaarden</h2>
<p>Door u te registreren voor, te downloaden of gebruik te maken van het Urban Culture-platform — inclusief de website urbanculturehub.nl, de iOS-applicatie (App Store ID: 6743952291), de Android-applicatie en alle gerelateerde diensten (gezamenlijk het "Platform") — gaat u akkoord met deze Algemene Voorwaarden ("Voorwaarden"), van kracht per 1 januari 2026. Deze Voorwaarden vormen een juridisch bindende overeenkomst tussen u ("Gebruiker", "u") en Urban Culture ("Urban Culture", "wij", "ons", of "onze").</p>
<p>Als u niet akkoord gaat met enig onderdeel van deze Voorwaarden, dient u het gebruik van het Platform onmiddellijk te staken en, indien van toepassing, de applicatie van uw apparaat te verwijderen.</p>
</section>

<section id="t2">
<h2>2. Gegevens van de aanbieder</h2>
<p><strong>Urban Culture</strong><br/>
Herenstraat 32, Zaandam, Nederland<br/>
E-mail: riki@dancehealthy.net | Tel: +31 6 841 86452<br/>
Website: urbanculturehub.nl</p>
</section>

<section id="t3">
<h2>3. Leeftijdsvereiste</h2>
<p>U dient minimaal 16 jaar oud te zijn om het Platform te gebruiken. Bent u tussen de 16 en 18 jaar, dan verklaart u toestemming van een ouder of voogd te hebben verkregen. Door deze Voorwaarden te accepteren bevestigt u te voldoen aan deze leeftijdsvereisten conform de Algemene Verordening Gegevensbescherming (AVG/GDPR) en het toepasselijke Nederlandse recht (Uitvoeringswet AVG). Urban Culture behoudt zich het recht voor accounts te beëindigen waarbij de leeftijdsvereiste niet aantoonbaar is.</p>
</section>

<section id="t4">
<h2>4. Beschrijving van de dienst</h2>
<p>Urban Culture is een communityplatform voor hip-hop, breakdance, b-boying/b-girling, graffiti, skateboarden en stedelijke straatcultuur, dat artiesten, atleten, evenementenorganisatoren en liefhebbers in heel Nederland en daarbuiten verbindt. Het Platform omvat:</p>
<ul>
  <li><strong>Community-feed:</strong> berichten, reacties, likes en sociale interactie</li>
  <li><strong>Evenementen:</strong> aanmaken, ontdekken en boeken van evenementen en ticketbeheer</li>
  <li><strong>Kaart:</strong> locatiegebaseerde ontdekking van stedelijke spots, evenementen en communityleden</li>
  <li><strong>Marktplaats:</strong> kopen en verkopen van producten, diensten en materiaal</li>
  <li><strong>Reels:</strong> uploaden en delen van korte video's</li>
  <li><strong>Chat:</strong> privéberichten tussen gebruikers</li>
  <li><strong>AI-tools:</strong> optionele door AI ondersteunde contentcreatie en suggesties</li>
  <li><strong>Instagram-integratie:</strong> optioneel publiceren op gekoppelde Instagram Business-accounts</li>
</ul>
<p>Het Platform wordt aangeboden "zoals het is" en kan op elk moment worden gewijzigd, uitgebreid of stopgezet. Wij garanderen geen ononderbroken of foutloze beschikbaarheid.</p>
</section>

<section id="t5">
<h2>5. Gebruikersaccounts</h2>
<p>Om toegang te krijgen tot bepaalde functies moet u een account aanmaken. U stemt ermee in waarheidsgetrouwe, nauwkeurige en volledige informatie te verstrekken en uw gegevens actueel te houden. U bent als enige verantwoordelijk voor het vertrouwelijk houden van uw inloggegevens en voor alle activiteiten die onder uw account plaatsvinden. U dient ons onmiddellijk op de hoogte te stellen van eventueel ongeautoriseerd gebruik via riki@dancehealthy.net. Urban Culture is niet aansprakelijk voor verlies of schade als gevolg van uw nalatigheid bij het beschermen van uw accountgegevens.</p>
<p>U mag zonder onze schriftelijke toestemming geen meerdere accounts aanmaken, accounts delen of uw account overdragen aan een andere persoon.</p>
</section>

<section id="t6">
<h2>6. Door gebruikers gegenereerde inhoud</h2>
<p>U behoudt het eigendom van de inhoud die u op het Platform plaatst ("Gebruikersinhoud"), inclusief berichten, foto's, video's, Reels, evenementadvertenties, marktplaatsadvertenties, reacties en spot-suggesties. Door Gebruikersinhoud te plaatsen verleent u Urban Culture een niet-exclusieve, wereldwijde, royaltyvrije, sublicentieerbare, overdraagbare licentie om die inhoud uitsluitend in verband met de exploitatie en verbetering van het Platform te gebruiken, op te slaan, weer te geven, te reproduceren, te transcoderen, te wijzigen, te distribueren en te promoten. Deze licentie eindigt wanneer u de inhoud verwijdert of uw account sluit, met inachtneming van wettelijke bewaarverplichtingen.</p>
<p>U verklaart en garandeert dat: (a) u de inhoud bezit of de benodigde rechten heeft; (b) het geen inbreuk maakt op intellectuele eigendomsrechten, privacyrechten of persoonlijkheidsrechten van derden; en (c) het voldoet aan deze Voorwaarden en het toepasselijke recht.</p>
<p>Urban Culture treedt op als hostingdienstverlener in de zin van Artikel 6:196c Burgerlijk Wetboek en de EU Digital Services Act (DSA) (EU) 2022/2065. Wij zijn niet verantwoordelijk voor Gebruikersinhoud, maar behouden ons het recht voor inhoud te verwijderen die in strijd is met deze Voorwaarden of het toepasselijke recht.</p>
</section>

<section id="t7">
<h2>7. Verboden inhoud &amp; Zero-tolerantiebeleid</h2>
<p>De volgende soorten inhoud en gedrag zijn strikt verboden op het Platform. Overtredingen kunnen leiden tot onmiddellijke verwijdering van inhoud, opschorting van het account, permanente beëindiging en aangifte bij de bevoegde autoriteiten:</p>
<ul>
  <li>Haatzaaiende uitlatingen, discriminatie of aanzetting tot geweld op basis van ras, etniciteit, religie, geslacht, seksuele geaardheid, handicap of enig ander beschermd kenmerk (Artikel 137c–137g Wetboek van Strafrecht)</li>
  <li>Seksueel expliciet, pornografisch of obsceen materiaal — met name inhoud met minderjarigen (dit wordt onverwijld gemeld aan de bevoegde autoriteiten, waaronder de Nederlandse politie en de Internet Watch Foundation)</li>
  <li>Inhoud die illegale activiteiten promoot, verheerlijkt of vergemakkelijkt, waaronder drugsverkoop, wapenhandel of witwassen</li>
  <li>Intimidatie, pesten, bedreigingen, stalken, belaging of doxxen (het publiceren van persoonlijke informatie van anderen zonder toestemming)</li>
  <li>Schending van intellectuele eigendomsrechten (auteursrecht, merkrecht, bedrijfsgeheimen)</li>
  <li>Laster of onrechtmatige openbaarmaking van persoonlijke gegevens van anderen</li>
  <li>Spam, phishing, ongewenste commerciële berichten of frauduleuze advertenties</li>
  <li>Desinformatie die een risico vormt voor de volksgezondheid, veiligheid of de integriteit van verkiezingen</li>
  <li>Door AI gegenereerde deepfakes bedoeld om individuen te misleiden of te schaden</li>
  <li>Zich voordoen als andere personen, organisaties of publieke figuren</li>
  <li>Inhoud die in strijd is met de App Store Review Guidelines van Apple</li>
</ul>
<p>Alle gemelde inhoud wordt beoordeeld door ons moderatieteam. Wij streven ernaar binnen 72 uur te reageren. U kunt een moderatiebeslissing aanvechten door een e-mail te sturen naar riki@dancehealthy.net met het onderwerp "Inhoud bezwaar" binnen 14 dagen na de genomen maatregel.</p>
</section>

<section id="t8">
<h2>8. Reels &amp; Video-inhoud</h2>
<p>Met de Reels-functie kunt u korte video-inhoud uploaden, delen en bekijken. Bij gebruik van Reels:</p>
<ul>
  <li>U mag uitsluitend video-inhoud uploaden waarvoor u de rechten bezit. Dit omvat het auteursrecht op de video en alle muziek, afbeeldingen of andere elementen daarin</li>
  <li>U mag geen inhoud uploaden met auteursrechtelijk beschermde muziek zonder licentie, want dit kan in strijd zijn met de rechten van derden en de Nederlandse Auteurswet</li>
  <li>Video's worden opgeslagen via Cloudinary en kunnen worden getranscodeerd voor optimale levering</li>
  <li>Openbare Reels zijn zichtbaar voor alle Platformgebruikers. U kunt de zichtbaarheid op elk moment instellen op uitsluitend community of privé</li>
  <li>Urban Culture behoudt zich het recht voor Reels te verwijderen die in strijd zijn met deze Voorwaarden, verboden inhoud bevatten of inbreuk maken op rechten van derden</li>
  <li>U kunt uw Reels op elk moment verwijderen. CDN-cachereplica's kunnen tot 72 uur na verwijdering nog bestaan</li>
</ul>
</section>

<section id="t9">
<h2>9. AI-functies</h2>
<p>Urban Culture biedt optionele door AI ondersteunde functies, waaronder het genereren van marketingteksten voor evenementen, contentvoorstellen en community-tools aangedreven door OpenAI en Anthropic. Door gebruik te maken van deze functies gaat u akkoord met het volgende:</p>
<ul>
  <li><strong>Verantwoordelijkheid voor invoer:</strong> U bent verantwoordelijk voor de nauwkeurigheid en gepastheid van alle invoer die u aan AI-functies verstrekt. Voer geen persoonsgegevens van derden, vertrouwelijke informatie of inhoud in die in strijd is met deze Voorwaarden</li>
  <li><strong>Beoordeling van uitvoer:</strong> Door AI gegenereerde inhoud is uitsluitend een suggestie. U moet alle AI-uitvoer beoordelen, bewerken en verantwoordelijkheid nemen voor alle inhoud die u publiceert</li>
  <li><strong>Geen schadelijk gebruik:</strong> U mag AI-functies niet gebruiken om haatzaaiende uitlatingen, illegale inhoud, deepfakes, desinformatie of andere verboden inhoud te genereren</li>
  <li><strong>Geen misbruik voor AI-training:</strong> U mag de Platform-AI-functies niet gebruiken om gegevens te verzamelen voor het trainen van concurrerende AI-systemen</li>
  <li><strong>Voorwaarden van derden:</strong> Het gebruik van AI-functies is ook onderworpen aan de voorwaarden van de onderliggende AI-provider (OpenAI: openai.com/policies; Anthropic: anthropic.com/legal)</li>
  <li><strong>Dataminimalisatie:</strong> Wij verwijderen identificerende persoonsgegevens uit AI-prompts voordat deze naar externe AI-providers worden verzonden</li>
</ul>
</section>

<section id="t10">
<h2>10. Instagram Business-integratie</h2>
<p>Urban Culture biedt een optionele Instagram Business Login-integratie waarmee evenementenorganisatoren en creators content rechtstreeks vanuit het Platform op hun gekoppelde Instagram Business-account kunnen publiceren.</p>
<ul>
  <li>Deze integratie is volledig optioneel en vereist uw actieve toestemming om uw Instagram Business-account te koppelen</li>
  <li>Wij vragen alleen de minimaal vereiste Instagram-rechten aan: <code>instagram_business_basic</code>, <code>instagram_business_content_publish</code>, <code>instagram_business_manage_comments</code> en <code>instagram_business_manage_insights</code></li>
  <li>Wij plaatsen nooit iets op uw Instagram-account zonder uw expliciete actie binnen het Platform</li>
  <li>U verklaart de rechtmatige eigenaar of bevoegde beheerder te zijn van elk Instagram Business-account dat u koppelt</li>
  <li>U dient bij het gebruik van deze integratie te voldoen aan de Platformvoorwaarden van Meta en de Community Guidelines van Instagram</li>
  <li>U kunt uw Instagram-account op elk moment loskoppelen via Instellingen → Integraties. Wij verwijderen uw opgeslagen toegangstoken onmiddellijk bij loskoppeling</li>
  <li>Urban Culture is niet verantwoordelijk voor inhoud die u via deze integratie op Instagram heeft gepubliceerd</li>
</ul>
</section>

<section id="t11">
<h2>11. Anti-scraping, automatisering &amp; API-misbruik</h2>
<p>U mag geen geautomatiseerde tools, bots, crawlers, spiders, scripts of enige andere vorm van geautomatiseerde toegang gebruiken om gegevens van het Platform te scrapen, extraheren, indexeren of verzamelen zonder onze uitdrukkelijke voorafgaande schriftelijke toestemming. Ongeautoriseerde toegang tot of gebruik van onze systemen of gegevens kan een strafbaar feit vormen op grond van de Wet Computercriminaliteit III en het toepasselijke EU-recht.</p>
<p>Het is u in het bijzonder verboden om:</p>
<ul>
  <li>Geautomatiseerde middelen te gebruiken om in bulk accounts aan te maken, inhoud te plaatsen of te interageren met het Platform</li>
  <li>Enig deel van het Platform te proberen te reverse-engineeren, decompileren of te demonteren</li>
  <li>Het Platform te benaderen via niet-officiële interfaces of niet door Urban Culture gedocumenteerde API's</li>
  <li>Te proberen beveiligingsfuncties, toegangscontroles of snelheidsbegrenzing te omzeilen, uit te schakelen of te bypass</li>
  <li>De gegevens of inhoud van het Platform te gebruiken voor het trainen van AI- of machine-learningmodellen zonder uitdrukkelijke schriftelijke toestemming</li>
</ul>
</section>

<section id="t12">
<h2>12. Marktplaats</h2>
<p>Urban Culture biedt een marktplaatsfunctie via welke gebruikers producten, materiaal en diensten kunnen kopen en verkopen. Urban Culture treedt uitsluitend op als tussenpersoon en is geen partij bij transacties tussen kopers en verkopers.</p>
<p>Als <strong>verkoper</strong> bent u verantwoordelijk voor: de nauwkeurigheid van uw advertenties, tijdige levering, naleving van het Nederlandse consumentenrecht (Wet koop op afstand, Boek 7 Burgerlijk Wetboek) en toepasselijk EU-recht. Het is verboden namaak, gestolen, verboden of illegale artikelen te adverteren.</p>
<p>Als <strong>koper</strong> heeft u een wettelijk herroepingsrecht van 14 kalenderdagen voor aankopen op afstand op grond van Richtlijn 2011/83/EU zoals geïmplementeerd in Nederland, tenzij een uitzondering van toepassing is (bijv. digitale goederen, evenementtickets, bederfelijke artikelen of op maat gemaakte artikelen).</p>
<p>Urban Culture is niet aansprakelijk voor geschillen, fraude, gebrekkige producten of niet-levering die voortvloeien uit marktplaattransacties. Wij kunnen naar eigen goeddunken bemiddelen, maar zijn hiertoe niet verplicht.</p>
</section>

<section id="t13">
<h2>13. Intellectuele eigendom</h2>
<p>Alle intellectuele eigendomsrechten in het Platform — inclusief software, design, handelsmerken, logo's, de naam en branding "Urban Culture Hub" en eigen inhoud — behoren toe aan Urban Culture of haar licentiegevers en zijn beschermd door het Nederlandse en internationale recht (Auteurswet, Merkenrecht). Niets in deze Voorwaarden geeft u een licentie om onze handelsmerken, handelsnaam of intellectueel eigendom te gebruiken zonder voorafgaande schriftelijke toestemming.</p>
<p>Als u van mening bent dat uw auteursrecht op het Platform is geschonden, stuurt u een verwijderingsverzoek naar riki@dancehealthy.net met: (a) identificatie van het auteursrechtelijk beschermde werk; (b) locatie van het inbreuk makende materiaal; (c) uw contactgegevens; en (d) een verklaring dat u te goeder trouw gelooft dat het gebruik niet is geautoriseerd. Wij reageren binnen 14 werkdagen.</p>
</section>

<section id="t14">
<h2>14. Privacy</h2>
<p>Uw gebruik van het Platform wordt geregeld door ons Privacybeleid (AVG/GDPR-conform, versie 2026.2), dat door verwijzing in deze Voorwaarden is opgenomen. Door het Platform te gebruiken bevestigt u ons Privacybeleid te hebben gelezen en geaccepteerd. Het Privacybeleid is beschikbaar op urbanculturehub.nl/privacy-policy en in het Legal Center van het Platform.</p>
</section>

<section id="t15">
<h2>15. Aansprakelijkheidsbeperking</h2>
<p>Voor zover toegestaan door het Nederlandse recht (Boek 6 Burgerlijk Wetboek) is de totale aansprakelijkheid van Urban Culture jegens u beperkt tot het hoogste van: (a) het totaalbedrag dat u in de 12 maanden voorafgaand aan de aanspraak aan Urban Culture heeft betaald; of (b) €100.</p>
<p>Urban Culture is niet aansprakelijk voor:</p>
<ul>
  <li>Indirecte, incidentele, bijzondere, punitieve of gevolgschade</li>
  <li>Gederfde winst, omzet, gegevens, goodwill of zakelijke kansen</li>
  <li>Schade als gevolg van gedragingen van derden, marktplaatsgeschillen of Gebruikersinhoud</li>
  <li>Serviceonderbrekingen, beveiligingsinbreuken of technische storingen buiten onze redelijke controle</li>
  <li>Resultaten of verliezen die voortvloeien uit door AI gegenereerde inhoud die u publiceert</li>
  <li>Inhoud die u via de Instagram-integratie op uw Instagram-account heeft gepubliceerd</li>
</ul>
<p>Deze beperking geldt niet voor aansprakelijkheid als gevolg van opzet of grove nalatigheid aan onze kant, en doet geen afbreuk aan eventuele wettelijke consumentenrechten die u heeft op grond van het Nederlandse of EU-recht.</p>
</section>

<section id="t16">
<h2>16. Vrijwaring</h2>
<p>Voor zover maximaal toegestaan door het toepasselijke recht stemt u ermee in Urban Culture en haar bestuurders, functionarissen, medewerkers, aannemers, partners, licentiegevers en agenten te verdedigen, te vrijwaren en schadeloos te stellen van en tegen alle aanspraken, schade, verplichtingen, verliezen, aansprakelijkheden, kosten en uitgaven (inclusief redelijke advocaatkosten) die voortvloeien uit of verband houden met:</p>
<ul>
  <li>Uw gebruik van of toegang tot het Platform</li>
  <li>Uw schending van deze Voorwaarden of enige toepasselijke wet of regelgeving</li>
  <li>Uw Gebruikersinhoud, inclusief Reels of marktplaatsadvertenties die u indient</li>
  <li>Uw gebruik van AI-functies, inclusief het publiceren van door AI gegenereerde inhoud</li>
  <li>Uw gebruik van de Instagram-integratie en inhoud die via het Platform op Instagram is gepubliceerd</li>
  <li>Uw schending van rechten van derden, inclusief intellectuele eigendoms-, privacy- of publiciteitsrechten</li>
</ul>
</section>

<section id="t17">
<h2>17. Garantiedisclaimer</h2>
<p>Het Platform en alle inhoud, functies en functionaliteit worden aangeboden op een <strong>"zoals het is" en "zoals beschikbaar"</strong>-basis, zonder garanties van welke aard dan ook, hetzij uitdrukkelijk of impliciet. Voor zover toegestaan door het Nederlandse recht wijst Urban Culture uitdrukkelijk alle garanties af, inclusief impliciete garanties van verkoopbaarheid, geschiktheid voor een bepaald doel, niet-inbreuk en nauwkeurigheid.</p>
<p>Urban Culture garandeert niet dat het Platform ononderbroken, tijdig, veilig of foutloos zal zijn; dat resultaten nauwkeurig of betrouwbaar zijn; dat fouten worden gecorrigeerd; dat door AI gegenereerde inhoud nauwkeurig, passend of geschikt is voor enig doel; of dat het Platform vrij is van virussen of andere schadelijke componenten.</p>
<p>Deze disclaimer doet geen afbreuk aan eventuele wettelijke rechten die u als consument heeft op grond van het Nederlandse of EU-recht.</p>
</section>

<section id="t18">
<h2>18. Schorsing &amp; Beëindiging</h2>
<p>Urban Culture kan uw toegang tot het Platform onmiddellijk schorsen, beperken of permanent beëindigen, met of zonder kennisgeving, als u deze Voorwaarden schendt, verboden gedrag vertoont, of als dit wettelijk vereist is. Gronden zijn onder meer: het plaatsen van verboden inhoud, marktplaatsfraude, accountfraude, intimidatie van andere gebruikers, of misbruik van AI- of Instagram-integratiefuncties.</p>
<p>U kunt uw account op elk moment sluiten via Instellingen → Account → Account verwijderen. Na beëindiging eindigt uw recht om het Platform te gebruiken onmiddellijk. Artikelen 6, 13, 15, 16, 17, 21, 22 en 24 blijven na beëindiging van kracht.</p>
<p>U kunt een schorsings- of beëindigingsbeslissing aanvechten door een e-mail te sturen naar riki@dancehealthy.net met het onderwerp "Account bezwaar" binnen 30 dagen.</p>
</section>

<section id="t19">
<h2>19. Overmacht</h2>
<p>Urban Culture is niet aansprakelijk voor enige vertraging of niet-nakoming van haar verplichtingen als gevolg van omstandigheden buiten haar redelijke controle, waaronder: overmacht, natuurrampen, oorlog, terrorisme, burgerlijke onrust, overheidsmaatregelen, stroomuitval, internet- of telecommunicatiestoringen, pandemieën of storingen bij externe dienstverleners (waaronder Stripe, Firebase, Cloudinary of AI-providers). In dergelijke omstandigheden worden onze verplichtingen voor de duur van de situatie opgeschort.</p>
</section>

<section id="t20">
<h2>20. App Store Voorwaarden</h2>
<p>Als u de Urban Culture-applicatie downloadt via de Apple App Store, gelden de volgende aanvullende voorwaarden:</p>
<ul>
  <li><strong>Apple Inc.:</strong> Deze Voorwaarden gelden uitsluitend tussen u en Urban Culture, niet Apple. Apple is niet verantwoordelijk voor het Platform of de inhoud, het onderhoud, de ondersteuning, de garanties of aanspraken met betrekking tot het Platform. Bij een aanspraak van een derde dat het Platform of uw bezit en gebruik ervan inbreuk maakt op intellectuele eigendomsrechten van een derde, zal Urban Culture, niet Apple, als enige verantwoordelijk zijn. Apple is een derde begunstigde van deze Voorwaarden en heeft het recht om deze Voorwaarden jegens u als derde begunstigde te handhaven</li>
  <li><strong>In-app aankopen:</strong> Aankopen via de Apple App Store zijn onderworpen aan de betalingsvoorwaarden van Apple. Urban Culture heeft geen toegang tot uw betalingsgegevens die in de App Store worden gebruikt</li>
  <li><strong>Platformnaleving:</strong> Urban Culture handhaaft naleving van de App Store Review Guidelines van Apple. Als ons Platform in strijd wordt bevonden met een App Store-beleid, zullen wij onmiddellijk corrigerende maatregelen nemen</li>
</ul>
</section>

<section id="t21">
<h2>21. Geen verklaring van afstand &amp; Scheidbaarheid</h2>
<p><strong>Geen afstand van recht:</strong> Ons nalaten om enige bepaling van deze Voorwaarden te handhaven vormt geen afstand van ons recht om die bepaling in de toekomst te handhaven. Een afstand van een schending mag niet worden uitgelegd als afstand van een latere schending.</p>
<p><strong>Scheidbaarheid:</strong> Als een bepaling van deze Voorwaarden ongeldig, onwettig of niet-afdwingbaar wordt bevonden, wordt die bepaling als gescheiden beschouwd en blijven de overige bepalingen volledig van kracht.</p>
</section>

<section id="t22">
<h2>22. Volledige overeenkomst</h2>
<p>Deze Voorwaarden vormen, samen met ons Privacybeleid en eventuele andere beleidsregels waarnaar door verwijzing is opgenomen, de volledige overeenkomst tussen u en Urban Culture met betrekking tot het Platform, en vervangen alle eerdere overeenkomsten, verklaringen en afspraken. In geval van strijdigheid tussen deze Voorwaarden en enig ander Urban Culture-beleid prevaleren deze Voorwaarden.</p>
</section>

<section id="t23">
<h2>23. Wijzigingen</h2>
<p>Wij kunnen deze Voorwaarden van tijd tot tijd bijwerken om wijzigingen in onze diensten, functies (inclusief nieuwe AI-tools of platformintegraties), bedrijfsvoering of toepasselijk recht te weerspiegelen. Materiële wijzigingen worden via e-mail en in-app-melding bekendgemaakt ten minste 30 dagen voordat ze van kracht worden. Het versienummer en de ingangsdatum bovenaan geven de meest recente revisie aan. Voortgezet gebruik van het Platform na de ingangsdatum houdt aanvaarding van de bijgewerkte Voorwaarden in. Als u niet akkoord gaat, dient u het gebruik van het Platform te staken en uw account te verwijderen.</p>
</section>

<section id="t24">
<h2>24. Toepasselijk recht &amp; Geschilbeslechting</h2>
<p>Op deze Voorwaarden is Nederlands recht van toepassing, zonder rekening te houden met bepalingen inzake conflicten van wetten. Geschillen die voortvloeien uit of verband houden met deze Voorwaarden of het Platform die niet in der minne kunnen worden opgelost, worden voorgelegd aan de exclusieve bevoegdheid van de <strong>Rechtbank Noord-Holland</strong>.</p>
<p>EU-consumenten kunnen ook gebruikmaken van het platform voor onlinegeschillenbeslechting (ODR) van de Europese Commissie op <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>, of contact opnemen met het ACM Consumentenloket via <a href="https://www.consuwijzer.nl" target="_blank" rel="noopener noreferrer">consuwijzer.nl</a>.</p>
</section>

<section id="t25">
<h2>25. Contact</h2>
<p><strong>Urban Culture</strong><br/>
Herenstraat 32, Zaandam, Nederland<br/>
E-mail: riki@dancehealthy.net | Tel: +31 6 841 86452<br/>
Website: urbanculturehub.nl</p>
</section>
`;

/* ─── component ──────────────────────────────────────────────────────────── */

export default function TermsOfServicePage() {
  const [termsContent, setTermsContent] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [hasAccepted, setHasAccepted] = useState(false);
  const [acceptedDate, setAcceptedDate] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState("t1");
  const { toast } = useToast();
  const { user, getToken } = useAuth();
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTermsContent = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/legal/terms-of-service?language=${selectedLanguage}`);
        const data = await response.json();
        if (data?.content) setTermsContent(data);
        else throw new Error("No content");
      } catch {
        setTermsContent({
          id: 1, type: "terms_of_service", language: selectedLanguage,
          title: selectedLanguage === "nl" ? "Algemene Voorwaarden" : "Terms of Service",
          content: selectedLanguage === "nl" ? TOS_CONTENT_NL : TOS_CONTENT_EN,
          version: "2026.2", effectiveDate: "2026-01-01T00:00:00.000Z",
          lastUpdated: "2026-03-01T00:00:00.000Z", isActive: true,
        });
      } finally { setIsLoading(false); }
    };

    const checkUserConsent = async () => {
      if (!user) return;
      try {
        const currentToken = await getToken();
        const headers: Record<string, string> = {};
        if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;
        if (user.id) headers["x-user-id"] = String(user.id);
        const response = await fetch("/api/legal/user-consent", { headers });
        const data = await response.json();
        setHasAccepted(!!data.termsAccepted);
        if (data.termsAcceptedAt) setAcceptedDate(new Date(data.termsAcceptedAt));
      } catch { setHasAccepted(false); }
    };

    fetchTermsContent();
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

  const handleAcceptTerms = async () => {
    if (!user) {
      toast({ title: selectedLanguage === "nl" ? "Inloggen vereist" : "Sign in required", description: selectedLanguage === "nl" ? "Log in om de Voorwaarden te accepteren." : "Please sign in to accept the Terms of Service.", variant: "destructive" });
      return;
    }
    try {
      const currentToken = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;
      if (user.id) headers["x-user-id"] = String(user.id);
      await fetch("/api/legal/accept-terms", { method: "POST", headers, body: JSON.stringify({ userId: user.id }) });
      setHasAccepted(true);
      setAcceptedDate(new Date());
      await queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consent"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consents"] });
      toast({ title: selectedLanguage === "nl" ? "Voorwaarden geaccepteerd" : "Terms accepted", description: selectedLanguage === "nl" ? "Uw acceptatie is vastgelegd." : "Your acceptance has been recorded." });
    } catch { toast({ title: "Error", description: "Failed to record acceptance. Please try again.", variant: "destructive" }); }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/legal/terms-of-service/pdf?language=${selectedLanguage}`, "_blank");
    toast({ title: selectedLanguage === "nl" ? "Download gestart" : "Download started" });
  };

  // Only use server content if it contains proper section IDs (id="t1"), otherwise
  // fall back to the hardcoded full content which has the correct <section id> structure
  const serverContentHasSections = termsContent.content && termsContent.content.includes('id="t1"');
  const displayContent = serverContentHasSections
    ? termsContent.content
    : (selectedLanguage === "nl" ? TOS_CONTENT_NL : TOS_CONTENT_EN);
  const effectiveDate = termsContent.lastUpdated || termsContent.effectiveDate || "2026-03-01T00:00:00.000Z";
  const sections = selectedLanguage === "en" ? SECTIONS_EN : SECTIONS_NL;

  return (
    <div className="max-w-6xl mx-auto py-8 px-0">

      {/* ── Hero banner ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-blue-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
        <div className="relative px-6 py-10 sm:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/10 border border-white/20">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-white">
                  {selectedLanguage === "nl" ? "Algemene Voorwaarden" : "Terms of Service"}
                </h1>
                <Badge className="bg-white/15 text-white border-white/20 text-xs">v{termsContent.version || "2026.2"}</Badge>
                <Badge className="bg-white/15 text-white border-white/20 text-xs">BW / Dutch Law</Badge>
                <Badge className="bg-white/15 text-white border-white/20 text-xs">🍎 🤖 App Store</Badge>
              </div>
              <p className="text-blue-200 text-sm">
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
                <Button size="sm" className="w-full text-xs" onClick={handleAcceptTerms} data-testid="button-accept-terms">
                  {selectedLanguage === "nl" ? "Accepteren" : "Accept Terms"}
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
                <Button onClick={handleAcceptTerms} data-testid="button-accept-terms-footer">
                  {selectedLanguage === "nl" ? "Algemene Voorwaarden accepteren" : "Accept Terms of Service"}
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
