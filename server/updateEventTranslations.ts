import { db } from "./db";
import { events } from "../shared/schema";
import { eq } from "drizzle-orm";

const translations: Array<{ title: string; titleEn: string; descriptionEn: string }> = [
  {
    title: "Amsterdam Hip-Hop Festival 2026",
    titleEn: "Amsterdam Hip-Hop Festival 2026",
    descriptionEn: `The biggest hip-hop festival in the Netherlands returns to Westergasfabriek! With over 30 national and international artists, DJs, b-boys/b-girls, graffiti artists and spoken word performers. This is THE event for the entire urban culture community.\n\n🎟️ TICKETS:\nAvailable via Ticketmaster.nl. Early bird tickets €20, regular €25. VIP combo packages including backstage access for €65 via the official website. Tickets also at the Westergasfabriek box office.`,
  },
  {
    title: "Red Bull BC One Netherlands Qualifier",
    titleEn: "Red Bull BC One Netherlands Qualifier",
    descriptionEn: `The Dutch qualifying round for the world's most prestigious breaking competition — Red Bull BC One! The best B-Boys and B-Girls in the Netherlands compete for a spot in the World Final. Guaranteed spectacle.\n\n🎟️ TICKETS:\nOpen to everyone — FREE entry for spectators! Competitor registration via the official Red Bull BC One website. Register before May 1st at redbull.com/bcone.`,
  },
  {
    title: "NDSM Street Art Festival",
    titleEn: "NDSM Street Art Festival",
    descriptionEn: `The NDSM shipyard in Amsterdam North transforms into an open-air museum of world-class street art. International and Dutch graffiti artists, murals, live painting sessions, workshops and installations. A unique experience for art lovers of all ages.\n\n🎟️ TICKETS:\nFREE entry — the entire grounds are accessible. Want to join the exclusive Live Painting Workshop? Register via Eventbrite for €15 per person.`,
  },
  {
    title: "Groove Sessions Amsterdam — Paradiso",
    titleEn: "Groove Sessions Amsterdam — Paradiso",
    descriptionEn: `Groove Sessions is Amsterdam's most beloved dance night, now in the iconic halls of Paradiso! A night full of breaking, popping, locking, hip-hop and house battles featuring top names from the national scene. DJ lineup with the best urban beats.\n\n🎟️ TICKETS:\nTickets exclusively via Paradiso.nl — €18 for members, €22 for non-members. Online purchase recommended as the event sells out fast! Box office open on the night if tickets remain.`,
  },
  {
    title: "Rotterdam Dance Festival — Urban Edition",
    titleEn: "Rotterdam Dance Festival — Urban Edition",
    descriptionEn: `Rotterdam Dance Festival Urban brings the power of street dance to Rotterdam Ahoy. Battles in breaking, waacking, voguing, dancehall and krump. Guest judges from the international scene and live musicians accompany the battles.\n\n🎟️ TICKETS:\nTickets via Ahoy.nl — Day ticket €15, Weekend €25. Early bird discount available until March 1st. Group discount (10+) via info@ahoy.nl.`,
  },
  {
    title: "Afrobeats Night — Melkweg Amsterdam",
    titleEn: "Afrobeats Night — Melkweg Amsterdam",
    descriptionEn: `Amsterdam's most exciting night out! Afrobeats, Afro-house, Amapiano and dancehall in the historic halls of Melkweg. DJs from the Netherlands, Ghana and Nigeria and dancers setting the floor on fire.\n\n🎟️ TICKETS:\nTickets via Melkweg.nl — €22 regular, €18 for Melkweg members. Doors open at 22:00, music starts at 22:30. Drink tokens also available online to skip bar queues.`,
  },
  {
    title: "Breaking the Boundaries — TivoliVredenburg",
    titleEn: "Breaking the Boundaries — TivoliVredenburg",
    descriptionEn: `Breaking the Boundaries is a spectacular dance show featuring 40 professional dancers pushing the limits of urban dance. Choreographed shows combined with spontaneous battles, live music and a DJ. A must-see for anyone who loves urban dance.\n\n🎟️ TICKETS:\nTickets via TivoliVredenburg.nl — Regular €18, Students €14 with valid student ID. 20% early bird discount via the newsletter. Group tickets (8+) via groepen@tivolivredenburg.nl.`,
  },
  {
    title: "Beats & Rhymes Festival — 013 Tilburg",
    titleEn: "Beats & Rhymes Festival — 013 Tilburg",
    descriptionEn: `The best of Dutch hip-hop and rap in one night at venue 013 in Tilburg! Performances from the biggest names in the Dutch rap scene, open mic rounds, cypher battles and a showcase for upcoming artists.\n\n🎟️ TICKETS:\nTickets via 013.nl or at the door — €22 pre-sale, €27 at the door. 10% early bird discount with code URBAN26. 013 members always pay less — join via 013.nl for €30/year.`,
  },
  {
    title: "Breaking for Gold — Den Haag",
    titleEn: "Breaking for Gold — The Hague",
    descriptionEn: `One of the most respected breaking battles in the Netherlands! Breaking for Gold brings the best B-Boys and B-Girls from across the Netherlands to Paard in The Hague. Format: 1v1, 2v2, and crew battles with international guest judges. Live DJs spinning the freshest beats.\n\n🎟️ TICKETS:\nTickets via Paard.nl — Spectators €12, competitors register via bfg.nl. Early bird spectator ticket €8 (valid until April 20th). Entry fee: €10 per category.`,
  },
  {
    title: "Hip-Hop in het Park — Vondelpark",
    titleEn: "Hip-Hop in the Park — Vondelpark",
    descriptionEn: `Amsterdam's most enjoyable free hip-hop day! In the heart of Vondelpark, hip-hop beats play all day long, with breakdance demos, freestyle circles, beatbox battles and art installations. Come with the whole family and enjoy urban culture in a green setting.\n\n🎟️ TICKETS:\nCOMPLETELY FREE! Just show up at the Vondelpark open-air theatre. No registration needed. Donations for the artists are appreciated.`,
  },
  {
    title: "Rotterdam Skate Jam",
    titleEn: "Rotterdam Skate Jam",
    descriptionEn: `Rotterdam's biggest skateboard jam! At the iconic Westblaak square, the best skaters from South Holland gather for a day of tricks, lines and good vibes. Beginners welcome — demos and try-out sessions available for newcomers.\n\n🎟️ TICKETS:\nFREE for all spectators! Participating? Register via skaterdamroterdam.nl. Bring your own board, or rent one for €5 on site. Participants under 12 must wear protection.`,
  },
  {
    title: "Parkour Jam Amsterdam",
    titleEn: "Parkour Jam Amsterdam",
    descriptionEn: `Amsterdam's parkour and freerunning enthusiasts gather for a day of movement, creativity and urban exploration. Beginner and advanced sessions, clinics from professionals, and a photo session through the city. All levels welcome!\n\n🎟️ TICKETS:\nFREE participation. Register via Eventbrite to secure your spot (limited places). Wear comfortable sportswear. Gloves recommended for beginners.`,
  },
  {
    title: "Urban Kids Festival — Familiedag",
    titleEn: "Urban Kids Festival — Family Day",
    descriptionEn: `A fantastic day full of urban culture for the whole family! Breakdance workshops for kids (7-14), graffiti drawing workshops (eco-friendly paint), beatbox lessons, skateboard intro and live music. A safe environment where children discover the rich world of urban culture.\n\n🎟️ TICKETS:\nTickets via Eventbrite.nl — Child (4-12) €8, Adult €10, Family package (2 adults + 2 children) €28. Children under 4 FREE. Book in advance as workshops fill up fast!`,
  },
  {
    title: "Graffiti Workshop voor Kinderen",
    titleEn: "Graffiti Workshop for Kids",
    descriptionEn: `Learn the basics of graffiti art in a safe and controlled environment. Professional graffiti artists teach kids (8-16) how to style their name, work with spray paint and create their own design. All materials included.\n\n🎟️ TICKETS:\nTickets via Eventbrite — €15 per child, all materials included. Maximum 20 participants per session. Book quickly, spots are limited! Parents may watch for free.`,
  },
  {
    title: "Red Bull Soundclash NL",
    titleEn: "Red Bull Soundclash NL",
    descriptionEn: `Red Bull Soundclash is a legendary music battle where two artists face off to win over the crowd. The Dutch edition brings the richest artists from the NL hip-hop and dancehall scene to AFAS Live.\n\n🎟️ TICKETS:\nTickets via Ticketmaster.nl — €28 regular, €45 VIP (includes pre-party access). Students with valid ID pay €22. Maximum 4 tickets per account. Doors open at 19:00.`,
  },
  {
    title: "Utrecht Breaking Battles 2026",
    titleEn: "Utrecht Breaking Battles 2026",
    descriptionEn: `TivoliVredenburg in Utrecht hosts the annual Breaking Battles — a must-see for anyone who loves breaking. Categories for juniors (under 18), adults and masters. Jury consists of national champions and international B-Boy legends.\n\n🎟️ TICKETS:\nTickets via TivoliVredenburg.nl — Spectator ticket €12, Combo ticket (competitor + spectator) €18. Juniors compete for €5 per category. Online registration required.`,
  },
  {
    title: "Conscious Vibes Festival Amsterdam",
    titleEn: "Conscious Vibes Festival Amsterdam",
    descriptionEn: `A festival bringing urban culture and conscious living together on the beautiful NDSM shipyard. Music (neo-soul, afrobeats, jazz-hop), dance workshops, yoga, vegan street food, local artisans and inspiring speakers. A festival for the soul.\n\n🎟️ TICKETS:\nTickets via Eventbrite.nl — Day ticket €25, Weekend €40. Early bird (until May 1st) €18/day. Children (0-12) free. Food and drinks not included.`,
  },
  {
    title: "HipHop Academy Showcase 2026",
    titleEn: "HipHop Academy Showcase 2026",
    descriptionEn: `The best students from Amsterdam's most renowned hip-hop dance schools take to the stage! A spectacular evening of choreography in breaking, popping, locking, hip-hop and waacking. Students aged 8 to 28 perform for friends, family and the whole community.\n\n🎟️ TICKETS:\nTickets via Eventbrite.nl — €12 regular, €8 students. Students from participating schools get a discount with their school pass. Tickets also at the door while available.`,
  },
  {
    title: "Street Dance Battle Haarlem",
    titleEn: "Street Dance Battle Haarlem",
    descriptionEn: `Patronaat in Haarlem hosts the most enjoyable regional street dance battle in North Holland. Open battle format — sign up on the spot! Categories: Locking, Popping, Hip-Hop Freestyle, Kids (under 16). Guest judges from the Amsterdam and Rotterdam scene.\n\n🎟️ TICKETS:\nSpectator ticket €10 via Patronaat.nl. Competitors pay €5 registration at the door. Arrive early — competitor spots are limited. Free drink included for competitors.`,
  },
  {
    title: "Zomercarnaval Rotterdam",
    titleEn: "Summer Carnival Rotterdam",
    descriptionEn: `The biggest Caribbean parade in the Netherlands draws hundreds of thousands of visitors to the streets of Rotterdam every year. Samba, salsa, zouk, dancehall, soca and merengue fill the entire city. Featuring the biggest turnout of cultural associations ever!\n\n🎟️ TICKETS:\nThe parade is FREE to watch along the route. For indoor festival venues, tickets range from €5 to €15 depending on the stage. See all locations at zomercarnaval.nl.`,
  },
  {
    title: "Amsterdam Dance Event — Urban Nights",
    titleEn: "Amsterdam Dance Event — Urban Nights",
    descriptionEn: `ADE Urban Nights is the urban culture arm of the world-famous Amsterdam Dance Event. Featuring the best urban DJs and producers from the Netherlands and the world, exclusive showcases, afterparties and industry panels on the future of urban music.\n\n🎟️ TICKETS:\nTickets via ADE.nl — Day pass €35, 5-day Festival Pass €120. VIP Experience (including panels & lounge access) €195. Early bird until August 1st with 20% off.`,
  },
  {
    title: "Tilburg Urban Festival — 013",
    titleEn: "Tilburg Urban Festival — 013",
    descriptionEn: `013 Tilburg presents the Urban Festival with performances from the strongest names in the Brabant and national hip-hop and R&B scene. Three stages, over 20 acts, food trucks, merchandise and an open mic session to spot new talent.\n\n🎟️ TICKETS:\nTickets via 013.nl — Early bird €20 (limited), Regular €25, Door €30. 013 Members: 15% discount with membership card. Group discount for 10+ via info@013.nl.`,
  },
  {
    title: "Street Culture Night — Paard Den Haag",
    titleEn: "Street Culture Night — Paard The Hague",
    descriptionEn: `A night full of urban culture at the historic Paard in The Hague. Hip-hop, dancehall, grime and afrobeats alternate across two stages. Rising DJs from The Hague and Rotterdam, plus live graffiti artwork by local artists.\n\n🎟️ TICKETS:\nTickets via Paard.nl — €15 advance, €18 at the door. Students €12 with valid student card. Doors open 22:00. Dress code: Urban & Streetwear.`,
  },
  {
    title: "Breakdance World Cup Qualifier — Rotterdam",
    titleEn: "Breakdance World Cup Qualifier — Rotterdam",
    descriptionEn: `The Dutch qualifying round for the Breakdance World Cup! The top 32 B-Boys and B-Girls in the Netherlands battle for a spot in the international final. Live battles, jury from Paris and a crowd award. The winner flies to the World Cup final!\n\n🎟️ TICKETS:\nSpectator tickets via Ahoy.nl — €18 regular, €12 students. Competitors must register via bwc-nederland.nl. Entry fee: €15. Registrations close June 1st.`,
  },
  {
    title: "Family Dance Workshop — Haarlem",
    titleEn: "Family Dance Workshop — Haarlem",
    descriptionEn: `A fun afternoon of dance for the whole family! Parents and children learn the basics of hip-hop, funk and disco together. No experience needed — our instructors guide everyone step by step. Includes drinks and a small snack.\n\n🎟️ TICKETS:\nTickets via Eventbrite.nl — €12 per adult, €8 per child (4-12), children under 4 free. Family package (2 adults + 2 kids) €32. Book before April 20th for a 10% discount.`,
  },
  {
    title: "Lowlands Urban Stage 2026",
    titleEn: "Lowlands Urban Stage 2026",
    descriptionEn: `The iconic Lowlands Festival has a special Urban Stage for three days of pure urban culture. Hip-hop, trap, drill, afrobeats, grime and dancehall from the best national and international acts. This is the festival you can't miss this year!\n\n🎟️ TICKETS:\nTickets via Lowlands.nl — Weekend €225 (including camping), Day ticket €95. Early bird sold out, but waitlist available. Check Ticketswap for resale. Parking €20/day booked separately.`,
  },
  {
    title: "Eindhoven Urban Beats",
    titleEn: "Eindhoven Urban Beats",
    descriptionEn: `Eindhoven pulses with the best urban beats! At Effenaar — Brabant's most innovative music venue — three rooms fill with hip-hop, grime, drill and R&B. Spotlight on local Eindhoven acts alongside regional headliners.\n\n🎟️ TICKETS:\nTickets via Effenaar.nl — €20 advance, €25 at the door. TU/e and Fontys students: €15 with campus card. Early bird ticket (until April 1st) for €16. Free parking at P+R sites, 10 min walk.`,
  },
  {
    title: "Krump Battle NL — Zuiderparktheater",
    titleEn: "Krump Battle NL — Zuiderparktheater",
    descriptionEn: `The Netherlands' most intense dance battle: Krump Battle NL! Krump is an expressive, powerful dance style rooted in the African-American community. The best krumpers in the Netherlands compete for the national title at Zuiderparktheater in Rotterdam.\n\n🎟️ TICKETS:\nSpectator tickets €12 via Eventbrite.nl. Competitors register via krumpnl.nl — €8 entry fee. Categories: Junior (up to 17), Adult. Battles start on time — arrive early.`,
  },
  {
    title: "Graffiti & Street Art Tour Amsterdam",
    titleEn: "Graffiti & Street Art Tour Amsterdam",
    descriptionEn: `Discover Amsterdam's hidden graffiti gems on a guided walking tour! A professional guide takes you past the city's most beautiful murals, tags and street art installations. Learn about the artists, the meaning behind the works and the history of Amsterdam's street culture.\n\n🎟️ TICKETS:\nTickets via Airbnb Experiences or directly via graffitiamsterdam.nl — €18 per person. Small groups (max 12 people). Private tour for groups €150. Every Saturday at 14:00 and 16:00. Booking required.`,
  },
  {
    title: "Awakenings Festival 2026 – Gashouder Amsterdam",
    titleEn: "Awakenings Festival 2026 – Gashouder Amsterdam",
    descriptionEn: `Awakenings Festival returns to the iconic Gashouder at Westergasfabriek Amsterdam. This international techno festival brings the world's best electronic music acts together for an unforgettable weekend.\n\nArtist lineup: Charlotte de Witte, Reinier Zonneveld, Amelie Lens, Boris Brejcha, Monika Kruse, Paula Temple, and many more.\n\n🎟️ TICKETS: Available via awakenings.com. Day tickets €45-€55, weekend combo €85. Early bird discount for members.`,
  },
  {
    title: "DGTL Amsterdam 2026 – Elektronisch Festival",
    titleEn: "DGTL Amsterdam 2026 – Electronic Festival",
    descriptionEn: `DGTL Festival is back at NDSM Wharf in Amsterdam North. The Netherlands' most sustainable electronic festival with an impressive arts programme, culinary experiences and the best electronic music.\n\nArtist lineup: Maceo Plex, Peggy Gou, DJ Tennis, Mathew Jonson, Yotto, Âme live.\n\n🌱 SUSTAINABILITY: DGTL aims for 100% circular production. Vegan food zone, bioplastic-free.\n\n🎟️ TICKETS: Day €69, weekend €120 via dgtl.nl`,
  },
  {
    title: "Dekmantel Festival 2026 – Amsterdamse Bos",
    titleEn: "Dekmantel Festival 2026 – Amsterdam Forest",
    descriptionEn: `Dekmantel Festival takes you on a musical journey through the Amsterdam Forest. House, techno, jazz and experimental electronic music come together on five stages surrounded by beautiful nature.\n\nDekmantel is known for its carefully curated lineups and unique atmosphere — a weekend of musical discovery.\n\n🎟️ TICKETS: via dekmantel.com. Tickets sell out within minutes of release.`,
  },
  {
    title: "Amsterdam Dance Event (ADE) 2026 – Conferentie & Festival",
    titleEn: "Amsterdam Dance Event (ADE) 2026 – Conference & Festival",
    descriptionEn: `Amsterdam Dance Event is the world's biggest club festival and most influential conference for electronic music. Over five days, more than 600 artists fill hundreds of Amsterdam venues.\n\nADE includes a professional conference for the music industry, dozens of showcases, panel discussions and networking events.\n\n🎵 GENRES: Techno, House, Ambient, Experimental, Deep House, Minimal\n\n🎟️ TICKETS: Some events free, others up to €25 via ade.nl`,
  },
  {
    title: "Shelter Amsterdam – Techno Nacht met Reinier Zonneveld",
    titleEn: "Shelter Amsterdam – Techno Night with Reinier Zonneveld",
    descriptionEn: `Shelter Amsterdam — the iconic underground club beneath the A'DAM Tower — presents a special techno night with Reinier Zonneveld. The Amsterdam producer and DJ is known for his stunning live sets playing his own productions.\n\nOpeners: Alignment, Lilly Palmer.\n\n🎟️ TICKETS: €22.50 via Shelter Amsterdam. Doors open 23:00.`,
  },
  {
    title: "Amsterdam Hip-Hop Summit 2026 – Melkweg",
    titleEn: "Amsterdam Hip-Hop Summit 2026 – Melkweg",
    descriptionEn: `The annual Amsterdam Hip-Hop Summit brings national and international hip-hop artists together on the stage of Melkweg. With workshops, battles, cyphers and live performances, this is THE event for the hip-hop community.\n\nLineup: Sevn Alias, Donnie, Bizzey, Mula B, Boef, and international guests.\n\n🎤 ACTIVITIES: Freestyle battle, graffiti live art, b-boy showcase, DJ workshop\n\n🎟️ TICKETS: €25 via ticketmaster.nl`,
  },
  {
    title: "Sevn Alias & Gasten – Sold Out Tour 2026, AFAS Live",
    titleEn: "Sevn Alias & Guests – Sold Out Tour 2026, AFAS Live",
    descriptionEn: `Sevn Alias brings his successful 2026 tour to AFAS Live in Amsterdam. After his sold-out shows across the Netherlands, he delivers an unforgettable evening of Dutch street music and urban hip-hop with special guests.\n\nSpecial guests to be announced. Previous editions featured: Bizzey, Lijpe, Yung Felix.\n\n🎟️ TICKETS: €35-45 via ticketmaster.nl – Limited seated options available.`,
  },
  {
    title: "Gratis Hip-Hop Cypher – Vondelpark Amsterdam",
    titleEn: "Free Hip-Hop Cypher – Vondelpark Amsterdam",
    descriptionEn: `Every Sunday, rappers, beatboxers and b-boys gather in Vondelpark for an open-air cypher. Everyone is welcome to join in or just listen and enjoy the spontaneous urban culture.\n\nDJ sets from local DJs, freestyle rap, and occasional surprise appearances from well-known Dutch artists.\n\n🎤 PARTICIPATION: Free, just show up!\n🌤️ Continues in dry weather`,
  },
  {
    title: "Rotterdam Hip-Hop Festival – Wilhelminapier",
    titleEn: "Rotterdam Hip-Hop Festival – Wilhelminapier",
    descriptionEn: `Rotterdam Hip-Hop Festival on the Wilhelminapier brings the best of local and national hip-hop, rap and urban culture to Rotterdam's harbour. With 3 stages, graffiti live art, streetwear market and food trucks.\n\nLineup: Boef, Yung Nnelg, Frenna, 3robi, and many more.\n\n🎟️ TICKETS: €20 advance / €25 door – via Eventbrite Rotterdam`,
  },
  {
    title: "Soul & R&B Night – Paradiso Amsterdam",
    titleEn: "Soul & R&B Night – Paradiso Amsterdam",
    descriptionEn: `Paradiso presents an exclusive Soul & R&B evening with international headliners and local talent. From neo-soul to classic R&B, from funk to contemporary urban soul — an evening for true music lovers.\n\nHeadliner: Lucky Daye (US). Support: Alina Baraz, Masego. Opening: Amsterdam's finest R&B talent.\n\n🎟️ TICKETS: €32.50 via paradiso.nl. Doors open 20:00, show 21:00.`,
  },
  {
    title: "R&B Vibes Rotterdam – Rotown",
    titleEn: "R&B Vibes Rotterdam – Rotown",
    descriptionEn: `R&B Vibes is a monthly club night at the cosy Rotown in Rotterdam. Specialising in the best R&B, soul and neo-soul from the past 30 years, combined with current urban R&B.\n\nResidency DJs: DJ Soulful, Mx. Aaralyn. Featured artists change monthly.\n\n🎟️ TICKETS: €12.50 online / €15 at the door via rotown.nl`,
  },
  {
    title: "Smooth Sunday – Gratis R&B Brunch, De Pijp Amsterdam",
    titleEn: "Smooth Sunday – Free R&B Brunch, De Pijp Amsterdam",
    descriptionEn: `Every last Sunday of the month, Café Louie in De Pijp hosts a free R&B brunch. Live DJ sets with smooth R&B and soul while you enjoy an extensive brunch menu.\n\nBrunch: 10:00-14:00 | DJ set: 11:00-15:00\n\n🥞 Includes a free fresh orange juice on arrival\n🎵 Music: Classic R&B, Neo-Soul, Lo-fi Hip-Hop\n\n🆓 FREE – Reserve a table via the website`,
  },
  {
    title: "North Sea Jazz Festival 2026 – Rotterdam Ahoy",
    titleEn: "North Sea Jazz Festival 2026 – Rotterdam Ahoy",
    descriptionEn: `The world's largest indoor jazz festival returns to Rotterdam Ahoy. Over three days, more than 1,000 artists perform across 15 stages. From traditional jazz to fusion, from blues to soul, from afrobeat to electronic jazz.\n\nHeadliners: Kendrick Lamar, Janelle Monáe, Gregory Porter, Cory Henry.\n\n🎟️ TICKETS: Day €95, 3-day €265 via northseajazz.com. Limited tickets — book early!`,
  },
  {
    title: "Bimhuis Jazz Sessions – Open Podium Amsterdam",
    titleEn: "Bimhuis Jazz Sessions – Open Stage Amsterdam",
    descriptionEn: `Every Tuesday, Bimhuis opens its stage to up-and-coming jazz musicians for an open stage night. Listen to fresh talent in an intimate setting, directly on the IJ waterfront.\n\nPerformers: Students and recent graduates from the Amsterdam Conservatory plus local jazz talent.\n\n🎟️ TICKETS: €5 at the door or free for Bimhuis members. Doors open at 19:30.`,
  },
  {
    title: "Gratis Jazz in het Park – Westerpark Amsterdam",
    titleEn: "Free Jazz in the Park – Westerpark Amsterdam",
    descriptionEn: `Every summer Saturday, a jazz band plays in the outdoor area of Westerpark. Bring a picnic blanket and enjoy a relaxed afternoon of live jazz in the open air.\n\nVaries weekly: Swing, Bebop, Latin Jazz, Modern Jazz, Jazz Standards.\n\n🆓 FREE – Just turn up and enjoy!`,
  },
  {
    title: "Afrovibes Festival 2026 – Theater Zuidplein Rotterdam",
    titleEn: "Afrovibes Festival 2026 – Theater Zuidplein Rotterdam",
    descriptionEn: `Afrovibes Festival is the biggest African cultural festival in the Netherlands. From Afrobeats to highlife, from ndombolo to amapiano — an explosive mix of African music, dance, fashion and art.\n\nArtists: Afrobeats DJs from across Europe and Africa, live bands from Nigeria, Ghana, Senegal and Congo.\n\n🌍 ACTIVITIES: African fashion show, street food market, workshops, children's atelier\n\n🎟️ TICKETS: €15 online / €18 door via afrovibes.nl`,
  },
  {
    title: "Amapiano Night – Club Shelter Amsterdam",
    titleEn: "Amapiano Night – Club Shelter Amsterdam",
    descriptionEn: `South Africa's fastest-growing music style has reached Amsterdam. Club Shelter hosts a special Amapiano night with DJs straight from Johannesburg, combined with the best Amsterdam-based African DJs.\n\nGuest DJs: Uncle Waffles (ZA), Kabza de Small (ZA)\nLocal support: DJ Nomad, Afro Brothers NL\n\n🎟️ TICKETS: €18 via shelteramsterdam.nl. 21+ only.`,
  },
  {
    title: "Reggae Weekend Amsterdam – Bob Marley Tribute",
    titleEn: "Reggae Weekend Amsterdam – Bob Marley Tribute",
    descriptionEn: `A weekend full of reggae, dancehall and ska in honour of Bob Marley's legacy. With live bands, DJ sets, Jamaican food, handmade art and a relaxed, positive atmosphere for everyone.\n\nMonday February 6th – Bob Marley's birthday tribute\n\nBands: The Wailers NL, Jah Division, Amsterdam Ska Orchestra\n\n🌿 ROOTS & CULTURE – For the whole family\n🎟️ TICKETS: €18 via Paradiso. Children under 12 free`,
  },
  {
    title: "Salsa Festival Den Haag – Congresgebouw",
    titleEn: "Salsa Festival The Hague – Convention Centre",
    descriptionEn: `The Hague Salsa Festival is the biggest Latin American dance festival in the Netherlands. With workshops, social dancing, live bands and shows from internationally renowned salsa dancers and musicians.\n\nWorkshops: Cuban Salsa, On2 Salsa, Bachata, Kizomba, Reggaeton\nLive bands: La Sonora de Ricardo, Mayito Rivera y su Orquesta\nDJs: DJ Salsa NL, DJ Mambo Mike\n\n🎟️ TICKETS: Weekend pass €65, day €30 via salsafestivaldenhaag.nl`,
  },
  {
    title: "Bachata Gratis Workshop – Utrecht Social Dancing",
    titleEn: "Free Bachata Workshop – Utrecht Social Dancing",
    descriptionEn: `Every Monday evening, the Latin Dance Club Utrecht hosts a free bachata workshop for beginners, followed by social dancing for all levels. Perfect for anyone wanting to discover Latin dance culture!\n\nProgramme:\n20:00 - Free beginners workshop (1 hour)\n21:00 - Social dancing for everyone\n23:00 - Close\n\n🆓 FREE WORKSHOP – Social dancing €5 contribution`,
  },
  {
    title: "Appelsap Festival 2026 – Flevopark Amsterdam",
    titleEn: "Appelsap Festival 2026 – Flevopark Amsterdam",
    descriptionEn: `Appelsap Festival, Amsterdam's oldest and most beloved urban outdoor festival, returns to Flevopark. Free entry with a lineup of the best Dutch and international urban music: hip-hop, neo-soul, funk, R&B and more.\n\nLineup TBA — always a mix of established names and emerging talent.\n\nActivities: Live art, breakdance, sports tournaments, food trucks\n\n🆓 FREE – No tickets needed`,
  },
  {
    title: "Pitch Festival 2026 – Westerpark Amsterdam",
    titleEn: "Pitch Festival 2026 – Westerpark Amsterdam",
    descriptionEn: `Pitch Festival takes place in Westerpark Amsterdam and brings a mix of Dutch and international pop acts, singer-songwriters and indie acts. Small, intimate and stylish.\n\nLineup: Still Woozy, Phoebe Bridgers, Lianne La Havas, Jungle.\n\n🎟️ TICKETS: €39 day / €69 weekend via pitchfestival.nl`,
  },
  {
    title: "Concertgebouw – Gratis Lunchconcert Amsterdam",
    titleEn: "Concertgebouw – Free Lunch Concert Amsterdam",
    descriptionEn: `The Concertgebouw opens its doors every Wednesday for a free lunch concert. Young, talented musicians from the Conservatory and internationally renowned soloists perform in the intimate Recital Hall.\n\nProgramme varies: string quartets, piano solo, song recital, chamber music.\n\n🆓 FREE – Doors open 12:15, concert 12:30-13:30\n📍 Recital Hall – Limited seats, arrive early!`,
  },
  {
    title: "Danstheater AGA ZIV – Spoken Word & Soul, Utrecht",
    titleEn: "Dance Theater AGA ZIV – Spoken Word & Soul, Utrecht",
    descriptionEn: `Dance Theater AGA ZIV presents an evening of spoken word, urban poetry and live soul music. Poets, musicians and performers from diverse backgrounds come together for an intimate and powerful evening.\n\nFrom 20:30 open mic for sign-ups (max 5 min per act)\nHeadliner: Lisette Lombé (BE) – award-winning spoken word artist\n\n🎟️ TICKETS: €12 via the website`,
  },
  {
    title: "Mystery Land 2026 – Electronisch Muziekfestival, Haarlemmermeer",
    titleEn: "Mysteryland 2026 – Electronic Music Festival, Haarlemmermeer",
    descriptionEn: `Mysteryland is the world's oldest dance festival and returns to its festival grounds in Haarlemmermeer. With over 20 stages, the festival brings together house, techno, hardstyle, drum & bass, trance and experimental sounds.\n\nOver 200 acts across 3 days. Camping available.\n\n🎟️ TICKETS: Day €75, weekend €160, camping €30 extra. Via mysteryland.com`,
  },
  {
    title: "World Music Festival – Oosterpark Amsterdam",
    titleEn: "World Music Festival – Oosterpark Amsterdam",
    descriptionEn: `The World Music Festival in Oosterpark is an annual free celebration of Amsterdam's musical diversity. From Caribbean rhythms to East African drumming, from flamenco to gamelan — a true journey around the world.\n\nArtists from more than 20 countries\nChildren's workshops: 11:00-14:00\nFood village with dishes from around the globe\n\n🆓 FREE – For everyone`,
  },
];

async function updateTranslations() {
  console.log(`🌍 Updating English translations for ${translations.length} events...`);
  let updated = 0;
  let notFound = 0;

  for (const t of translations) {
    const existing = await db.query.events.findFirst({
      where: (e, { eq }) => eq(e.title, t.title),
    });
    if (!existing) {
      console.warn(`⚠️  Not found: "${t.title}"`);
      notFound++;
      continue;
    }
    await db
      .update(events)
      .set({ titleEn: t.titleEn, descriptionEn: t.descriptionEn })
      .where(eq(events.title, t.title));
    updated++;
  }

  console.log(`✅ Done: ${updated} updated, ${notFound} not found`);
}

updateTranslations().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
