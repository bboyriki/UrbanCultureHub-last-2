import { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpWithEmail } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { AlertCircle, LocateFixed, Loader2, Info, ChevronRight, ChevronLeft, Check, ShoppingBag, Calendar, MapPin, Sparkles, Palette, Zap, Users, Trophy, LayoutDashboard, Shield, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import SignupTermsModal from "@/components/auth/SignupTermsModal";

type Lang = "nl" | "en";

// ─── Translations ──────────────────────────────────────────────────────────────
const T = {
  nl: {
    langToggle: "EN",
    email: { label: "E-mailadres", placeholder: "jouw.email@voorbeeld.com" },
    password: {
      label: "Wachtwoord", placeholder: "••••••••",
      hint: "Min. 6 tekens met hoofdletter, kleine letter en een cijfer",
    },
    displayName: { label: "Weergavenaam", placeholder: "Jouw naam of crewnaam" },
    role: { label: "Ik ben een:" },
    artType: { label: "Wat is jouw belangrijkste kunstvorm?" },
    sportType: { label: "Welke urbane sport beoefen jij?" },
    spotOwnerType: { label: "Welk type spot of locatie heb jij?" },
    municipalityType: { label: "Welk type gemeente ben jij?" },
    schoolType: { label: "Welk type school of academie ben jij?" },
    spotOwnerInfo: "Na het aanmelden beoordeelt een beheerder jouw aanvraag. Na goedkeuring krijg je toegang tot de programmakalender om lessen, evenementen en sessies te plannen.",
    location: {
      label: "Jouw stad of regio",
      hint: "optioneel — voor ontdekking in de buurt",
      placeholder: "bijv. Amsterdam, Rotterdam...",
    },
    legal: {
      title: "Juridische overeenkomsten",
      terms: "Ik accepteer de ",
      termsLink: "Servicevoorwaarden",
      privacy: "Ik accepteer het ",
      privacyLink: "Privacybeleid",
      dataProcessing: "Ik stem in met de ",
      dataProcessingLink: "gegevensverwerkingsactiviteiten",
      dataProcessingEnd: " beschreven in het Privacybeleid",
      communication: "Ik wil updates ontvangen over nieuwe functies, evenementen en kansen",
      optional: "(optioneel)",
    },
    submit: { idle: "Aanmelden", loading: "Account aanmaken…" },
    errors: {
      email: "Voer een geldig e-mailadres in",
      passwordMin: "Wachtwoord moet minimaal 6 tekens bevatten",
      passwordLower: "Wachtwoord moet minimaal één kleine letter bevatten",
      passwordUpper: "Wachtwoord moet minimaal één hoofdletter bevatten",
      passwordNumber: "Wachtwoord moet minimaal één cijfer bevatten",
      displayName: "Weergavenaam moet minimaal 2 tekens bevatten",
      role: "Selecteer een rol",
      terms: "Je moet de Servicevoorwaarden accepteren om door te gaan",
      privacy: "Je moet het Privacybeleid accepteren om door te gaan",
      dataProcessing: "Je moet toestemming geven voor gegevensverwerking om door te gaan",
    },
    toast: {
      successTitle: "Account aangemaakt!",
      successDesc: "Controleer je e-mail voor verificatie",
      emailExists: "E-mail al geregistreerd",
      emailExistsDesc: "Dit e-mailadres is al gekoppeld aan een account. Log in of gebruik een ander e-mailadres.",
      weakPassword: "Zwak wachtwoord",
      invalidEmail: "Ongeldig e-mailadres",
      networkError: "Verbindingsfout",
      networkErrorDesc: "Controleer je internetverbinding en probeer het opnieuw.",
      signupFailed: "Aanmelden mislukt",
      signupFailedDesc: "Er is een fout opgetreden. Probeer het opnieuw.",
      gpsNotSupported: "GPS niet ondersteund",
      gpsNotSupportedDesc: "Jouw browser ondersteunt geen GPS-locatie.",
      locationFound: "Locatie gevonden",
      locationSet: "Locatie ingesteld",
      locationDenied: "Locatietoegang geweigerd. Sta het toe in de browserinstellingen.",
      locationError: "Locatie niet beschikbaar. Typ je stad hieronder.",
      couldNotGetLocation: "Locatie niet beschikbaar",
    },
  },
  en: {
    langToggle: "NL",
    email: { label: "Email", placeholder: "your.email@example.com" },
    password: {
      label: "Password", placeholder: "••••••••",
      hint: "Min. 6 characters with uppercase, lowercase and a number",
    },
    displayName: { label: "Display Name", placeholder: "Your name or crew name" },
    role: { label: "I am a:" },
    artType: { label: "What is your main art form?" },
    sportType: { label: "Which urban sport do you practice?" },
    spotOwnerType: { label: "What type of spot or venue do you own?" },
    municipalityType: { label: "What type of municipality are you?" },
    schoolType: { label: "What type of school or academy are you?" },
    spotOwnerInfo: "After signing up, an admin will review and activate your spot. Once approved, you'll get access to the programme calendar to schedule classes, events, and sessions.",
    location: {
      label: "Your city or area",
      hint: "optional — for nearby discovery",
      placeholder: "e.g. Amsterdam, Rotterdam...",
    },
    legal: {
      title: "Legal Agreements",
      terms: "I accept the ",
      termsLink: "Terms of Service",
      privacy: "I accept the ",
      privacyLink: "Privacy Policy",
      dataProcessing: "I consent to the ",
      dataProcessingLink: "data processing activities",
      dataProcessingEnd: " described in the Privacy Policy",
      communication: "I would like to receive updates about new features, events, and relevant opportunities",
      optional: "(optional)",
    },
    submit: { idle: "Sign Up", loading: "Creating Account…" },
    errors: {
      email: "Please enter a valid email address",
      passwordMin: "Password must be at least 6 characters",
      passwordLower: "Password must include at least one lowercase letter",
      passwordUpper: "Password must include at least one uppercase letter",
      passwordNumber: "Password must include at least one number",
      displayName: "Display name must be at least 2 characters",
      role: "Please select a role",
      terms: "You must accept the Terms of Service to continue",
      privacy: "You must accept the Privacy Policy to continue",
      dataProcessing: "You must consent to data processing to continue",
    },
    toast: {
      successTitle: "Account created!",
      successDesc: "Please check your email for verification",
      emailExists: "Email already registered",
      emailExistsDesc: "This email is already associated with an account. Please sign in or use a different email.",
      weakPassword: "Weak password",
      invalidEmail: "Invalid email",
      networkError: "Connection error",
      networkErrorDesc: "Please check your internet connection and try again.",
      signupFailed: "Signup failed",
      signupFailedDesc: "An error occurred during signup. Please try again.",
      gpsNotSupported: "GPS not supported",
      gpsNotSupportedDesc: "Your browser doesn't support GPS location.",
      locationFound: "Location found",
      locationSet: "Location set",
      locationDenied: "Location access denied. Please allow it in your browser settings.",
      locationError: "Could not get your location. Please type your city instead.",
      couldNotGetLocation: "Could not get location",
    },
  },
};

// ─── Role data ─────────────────────────────────────────────────────────────────
const ROLES = {
  nl: [
    { value: "artist",       emoji: "🎨", label: "Artiest",               desc: "Graffiti, dans, muziek, rap…" },
    { value: "athlete",      emoji: "🛹", label: "Atleet",                desc: "Skateboarden, parkour, BMX…" },
    { value: "enthusiast",   emoji: "🌆", label: "Stadsliefhebber",       desc: "Fan & supporter van urbane cultuur" },
    { value: "spot_owner",   emoji: "🏟️", label: "Spot / Locatie-eigenaar", desc: "Sportschool, studio, skatepark…" },
    { value: "municipality", emoji: "🏛️", label: "Gemeente",              desc: "Stad, district, afdeling…" },
    { value: "school",       emoji: "🏫", label: "School / Academie",     desc: "Educatief of trainingsinstituut" },
  ],
  en: [
    { value: "artist",       emoji: "🎨", label: "Artist",                desc: "Graffiti, dance, music, rap…" },
    { value: "athlete",      emoji: "🛹", label: "Athlete",               desc: "Skateboarding, parkour, BMX…" },
    { value: "enthusiast",   emoji: "🌆", label: "Urban Enthusiast",      desc: "Fan & supporter of urban culture" },
    { value: "spot_owner",   emoji: "🏟️", label: "Spot / Venue Owner",   desc: "Gym, studio, skate park…" },
    { value: "municipality", emoji: "🏛️", label: "Municipality",          desc: "City, district, department…" },
    { value: "school",       emoji: "🏫", label: "School / Academy",      desc: "Educational or training institute" },
  ],
};

const ARTIST_TYPES = {
  nl: [
    { value: "B-Boy / B-Girl",                   emoji: "🕺", label: "B-Boy / B-Girl" },
    { value: "Graffiti Artist",                   emoji: "🖌️", label: "Graffiti" },
    { value: "Street Artist / Muralist",          emoji: "🧱", label: "Straatkunst / Muurkunst" },
    { value: "Dancer",                            emoji: "💃", label: "Danser (overig)" },
    { value: "DJ / Producer",                     emoji: "🎛️", label: "DJ / Producer" },
    { value: "Rapper / MC",                       emoji: "🎤", label: "Rapper / MC" },
    { value: "Beatboxer",                         emoji: "🥁", label: "Beatboxer" },
    { value: "Photographer / Videographer",       emoji: "📷", label: "Fotografie / Film" },
  ],
  en: [
    { value: "B-Boy / B-Girl",                   emoji: "🕺", label: "B-Boy / B-Girl" },
    { value: "Graffiti Artist",                   emoji: "🖌️", label: "Graffiti" },
    { value: "Street Artist / Muralist",          emoji: "🧱", label: "Street Art / Mural" },
    { value: "Dancer",                            emoji: "💃", label: "Dancer (other)" },
    { value: "DJ / Producer",                     emoji: "🎛️", label: "DJ / Producer" },
    { value: "Rapper / MC",                       emoji: "🎤", label: "Rapper / MC" },
    { value: "Beatboxer",                         emoji: "🥁", label: "Beatboxer" },
    { value: "Photographer / Videographer",       emoji: "📷", label: "Photography / Film" },
  ],
};

const ATHLETE_TYPES = {
  nl: [
    { value: "Skateboarder",               emoji: "🛹", label: "Skateboarden" },
    { value: "Parkour / Freerunning",      emoji: "🏃", label: "Parkour / Freerunning" },
    { value: "BMX Rider",                  emoji: "🚴", label: "BMX" },
    { value: "Street Basketball",          emoji: "🏀", label: "Straatbasketbal" },
    { value: "Street Workout",             emoji: "💪", label: "Straattraining / Calisthenics" },
    { value: "Bouldering / Climbing",      emoji: "🧗", label: "Boulderen / Klimmen" },
    { value: "Padel",                      emoji: "🎾", label: "Padel" },
    { value: "Martial Arts",               emoji: "🥋", label: "Vechtsporten" },
    { value: "Other",                      emoji: "⚡", label: "Andere sport" },
  ],
  en: [
    { value: "Skateboarder",               emoji: "🛹", label: "Skateboarding" },
    { value: "Parkour / Freerunning",      emoji: "🏃", label: "Parkour / Freerunning" },
    { value: "BMX Rider",                  emoji: "🚴", label: "BMX" },
    { value: "Street Basketball",          emoji: "🏀", label: "Street Basketball" },
    { value: "Street Workout",             emoji: "💪", label: "Street Workout / Calisthenics" },
    { value: "Bouldering / Climbing",      emoji: "🧗", label: "Bouldering / Climbing" },
    { value: "Padel",                      emoji: "🎾", label: "Padel" },
    { value: "Martial Arts",               emoji: "🥋", label: "Martial Arts" },
    { value: "Other",                      emoji: "⚡", label: "Other Sport" },
  ],
};

const MUNICIPALITY_TYPES = {
  nl: [
    { value: "City Council",       emoji: "🏙️", label: "Gemeenteraad" },
    { value: "District / Borough", emoji: "🗺️", label: "District / Stadsdeel" },
    { value: "Town / Village",     emoji: "🏘️", label: "Stad / Dorp" },
    { value: "Youth Department",   emoji: "🧒", label: "Jeugdafdeling" },
    { value: "Sports Department",  emoji: "⚽", label: "Sportafdeling" },
    { value: "Culture Department", emoji: "🎭", label: "Cultuuraldeling" },
    { value: "Other",              emoji: "🏛️", label: "Overig" },
  ],
  en: [
    { value: "City Council",       emoji: "🏙️", label: "City Council" },
    { value: "District / Borough", emoji: "🗺️", label: "District / Borough" },
    { value: "Town / Village",     emoji: "🏘️", label: "Town / Village" },
    { value: "Youth Department",   emoji: "🧒", label: "Youth Department" },
    { value: "Sports Department",  emoji: "⚽", label: "Sports Department" },
    { value: "Culture Department", emoji: "🎭", label: "Culture Department" },
    { value: "Other",              emoji: "🏛️", label: "Other" },
  ],
};

const SCHOOL_TYPES = {
  nl: [
    { value: "Primary School",      emoji: "📚", label: "Basisschool" },
    { value: "Secondary School",    emoji: "🏫", label: "Middelbare School" },
    { value: "College / MBO",       emoji: "🎓", label: "MBO / College" },
    { value: "University / HBO",    emoji: "🏛️", label: "Universiteit / HBO" },
    { value: "Dance Academy",       emoji: "💃", label: "Dansacademie" },
    { value: "Sports Academy",      emoji: "🏋️", label: "Sportacademie" },
    { value: "Martial Arts School", emoji: "🥋", label: "Vechtsporten School" },
    { value: "Other",               emoji: "📖", label: "Overig" },
  ],
  en: [
    { value: "Primary School",      emoji: "📚", label: "Primary School" },
    { value: "Secondary School",    emoji: "🏫", label: "Secondary School" },
    { value: "College / MBO",       emoji: "🎓", label: "College / MBO" },
    { value: "University / HBO",    emoji: "🏛️", label: "University / HBO" },
    { value: "Dance Academy",       emoji: "💃", label: "Dance Academy" },
    { value: "Sports Academy",      emoji: "🏋️", label: "Sports Academy" },
    { value: "Martial Arts School", emoji: "🥋", label: "Martial Arts School" },
    { value: "Other",               emoji: "📖", label: "Other" },
  ],
};

const SPOT_OWNER_TYPES = {
  nl: [
    { value: "Gym / Fitness Center",  emoji: "🏋️", label: "Sportschool / Fitness" },
    { value: "Dance Studio",          emoji: "💃", label: "Dansstudio" },
    { value: "Skate Park / Spot",     emoji: "🛹", label: "Skatepark / Spot" },
    { value: "Art Gallery / Studio",  emoji: "🖼️", label: "Kunstgalerie / Studio" },
    { value: "Music Venue / Studio",  emoji: "🎵", label: "Muziekzaal / Studio" },
    { value: "Community Center",      emoji: "🏘️", label: "Buurtcentrum" },
    { value: "Sports Facility",       emoji: "⚽", label: "Sportlocatie" },
    { value: "Martial Arts Dojo",     emoji: "🥋", label: "Vechtsport Dojo" },
    { value: "Other",                 emoji: "📍", label: "Overig" },
  ],
  en: [
    { value: "Gym / Fitness Center",  emoji: "🏋️", label: "Gym / Fitness Center" },
    { value: "Dance Studio",          emoji: "💃", label: "Dance Studio" },
    { value: "Skate Park / Spot",     emoji: "🛹", label: "Skate Park / Spot" },
    { value: "Art Gallery / Studio",  emoji: "🖼️", label: "Art Gallery / Studio" },
    { value: "Music Venue / Studio",  emoji: "🎵", label: "Music Venue / Studio" },
    { value: "Community Center",      emoji: "🏘️", label: "Community Center" },
    { value: "Sports Facility",       emoji: "⚽", label: "Sports Facility" },
    { value: "Martial Arts Dojo",     emoji: "🥋", label: "Martial Arts Dojo" },
    { value: "Other",                 emoji: "📍", label: "Other" },
  ],
};

// ─── Schema factory ────────────────────────────────────────────────────────────
function buildSchema(lang: Lang) {
  const e = T[lang].errors;
  return z.object({
    email: z.string().email({ message: e.email }),
    password: z.string()
      .min(6, { message: e.passwordMin })
      .regex(/(?=.*[a-z])/, { message: e.passwordLower })
      .regex(/(?=.*[A-Z])/, { message: e.passwordUpper })
      .regex(/(?=.*\d)/, { message: e.passwordNumber }),
    displayName: z.string().min(2, { message: e.displayName }),
    role: z.enum(["artist", "athlete", "enthusiast", "municipality", "school", "spot_owner"], {
      required_error: e.role,
    }),
    artType: z.string().optional(),
    sportType: z.string().optional(),
    municipalityType: z.string().optional(),
    schoolType: z.string().optional(),
    spotOwnerType: z.string().optional(),
    termsAccepted: z.boolean().refine(val => val === true, { message: e.terms }),
    privacyAccepted: z.boolean().refine(val => val === true, { message: e.privacy }),
    dataProcessingAccepted: z.boolean().refine(val => val === true, { message: e.dataProcessing }),
    communicationAccepted: z.boolean(),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;
type LocationData = { lat: number; lng: number; city: string; displayName: string };

// ─── OptionGrid sub-component ──────────────────────────────────────────────────
function OptionGrid({
  options, value, onChange, isDarkMode, testIdPrefix,
}: {
  options: { value: string; emoji: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
  isDarkMode: boolean;
  testIdPrefix: string;
}) {
  return (
    <RadioGroup onValueChange={onChange} value={value} className="mt-2">
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <Label
            key={opt.value}
            htmlFor={`${testIdPrefix}-${opt.value}`}
            className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
              value === opt.value
                ? `border-primary bg-primary/10 ${isDarkMode ? "text-white" : ""}`
                : `${isDarkMode ? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"}`
            }`}
            data-testid={`label-${testIdPrefix}-${opt.value.toLowerCase().replace(/\W+/g, "-")}`}
          >
            <RadioGroupItem value={opt.value} id={`${testIdPrefix}-${opt.value}`} className="sr-only" />
            <span className="text-base leading-none">{opt.emoji}</span>
            <span className="text-sm font-medium leading-tight">{opt.label}</span>
          </Label>
        ))}
      </div>
    </RadioGroup>
  );
}

// ─── Main form ─────────────────────────────────────────────────────────────────
const SignupForm = () => {
  const { language: globalLang } = useLanguage();
  const lang: Lang = globalLang === "nl" ? "nl" : "en";
  const [isLoading, setIsLoading] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGettingGPS, setIsGettingGPS] = useState(false);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const { isDarkMode } = useTheme();
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const t = T[lang];

  // Dynamic resolver via ref — lang can switch without losing form values
  const resolverRef = useRef(zodResolver(buildSchema(lang)));

  const form = useForm<FormValues>({
    resolver: (...args) => resolverRef.current(...args),
    defaultValues: {
      email: "", password: "", displayName: "",
      role: "enthusiast",
      artType: "", sportType: "", municipalityType: "", schoolType: "", spotOwnerType: "",
      termsAccepted: false, privacyAccepted: false,
      dataProcessingAccepted: false, communicationAccepted: false,
    },
    mode: "onChange",
  });

  useEffect(() => { if (emailInputRef.current) emailInputRef.current.focus(); }, []);

  // Update resolver when language changes so validation messages switch language
  useEffect(() => {
    resolverRef.current = zodResolver(buildSchema(lang));
    form.clearErrors();
  }, [lang]);

  const currentRole = form.watch("role");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const ROLE_ACCESS: Record<string, { features: string[]; badge: string; color: string }> = {
    enthusiast: { badge: "Fan Pass", color: "bg-blue-500/10 border-blue-500/20 text-blue-400", features: ["Browse events & battles", "Follow artists & spots", "Community feed access", "Culture map explorer", "Basic marketplace"] },
    artist: { badge: "Artist Pass", color: "bg-purple-500/10 border-purple-500/20 text-purple-400", features: ["Artist profile & portfolio", "Sell in marketplace", "Event participation", "Culture AI tools (unlimited)", "Featured spots on map", "Style DNA & Match"] },
    athlete: { badge: "Athlete Pass", color: "bg-orange-500/10 border-orange-500/20 text-orange-400", features: ["Athlete profile & ranking", "Battle & competition entry", "Training spot discovery", "Event management", "Performance analytics", "Cred score system"] },
    spot_owner: { badge: "Spot Pass", color: "bg-green-500/10 border-green-500/20 text-green-400", features: ["Spot listing & management", "Event hosting tools", "Community booking system", "Spot analytics dashboard", "Verified spot badge", "Revenue tracking"] },
    municipality: { badge: "Gov Pass", color: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400", features: ["Official city representation", "Policy engagement tools", "Event co-hosting", "Community reports", "Urban culture mapping", "Priority verification"] },
    school: { badge: "Edu Pass", color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", features: ["School/academy profile", "Class & workshop hosting", "Student community features", "Educational resources", "Curriculum tools", "Batch registrations"] },
  };

  const ROLE_FEATURE_ICONS = [ShoppingBag, Calendar, MapPin, Sparkles, Users, Trophy];

  const stepTitles = lang === "nl"
    ? ["Basis info", "Jouw rol", "Afronden"]
    : ["Basic info", "Your role", "Finish up"];

  const goNext = async () => {
    let valid = true;
    if (step === 1) {
      valid = await form.trigger(["email", "password", "displayName"]);
    } else if (step === 2) {
      valid = await form.trigger(["role"]);
    }
    if (valid) setStep(s => (s === 1 ? 2 : 3) as 1 | 2 | 3);
  };

  const searchLocation = (query: string) => {
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    if (!query.trim()) { setLocationSuggestions([]); return; }
    locationTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": lang === "nl" ? "nl,en" : "en", "User-Agent": "UrbanCultureConnect/1.0" } }
        );
        setLocationSuggestions(await res.json());
        setShowSuggestions(true);
      } catch { setLocationSuggestions([]); }
    }, 400);
  };

  const selectLocation = (item: any) => {
    const city = item.address?.city || item.address?.town || item.address?.village || item.address?.county || item.display_name.split(",")[0];
    setLocationData({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), city, displayName: item.display_name });
    setLocationQuery(item.display_name.split(",").slice(0, 2).join(", "));
    setLocationSuggestions([]);
    setShowSuggestions(false);
  };

  const getGPSLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t.toast.gpsNotSupported, description: t.toast.gpsNotSupportedDesc, variant: "destructive" });
      return;
    }
    setIsGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { "Accept-Language": lang === "nl" ? "nl,en" : "en", "User-Agent": "UrbanCultureConnect/1.0" } }
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || data.display_name?.split(",")[0] || "Mijn locatie";
          const displayLabel = [city, data.address?.country].filter(Boolean).join(", ");
          setLocationData({ lat: latitude, lng: longitude, city, displayName: data.display_name || displayLabel });
          setLocationQuery(displayLabel);
          toast({ title: t.toast.locationFound, description: `${lang === "nl" ? "Locatie: " : "Using "}${city}` });
        } catch {
          const fallback = lang === "nl" ? "Mijn locatie" : "My location";
          setLocationData({ lat: latitude, lng: longitude, city: fallback, displayName: fallback });
          setLocationQuery(fallback);
          toast({ title: t.toast.locationSet });
        }
        setIsGettingGPS(false);
      },
      (err) => {
        setIsGettingGPS(false);
        const msg = err.code === 1 ? t.toast.locationDenied : t.toast.locationError;
        toast({ title: t.toast.couldNotGetLocation, description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      let typeValue = "";
      if (values.role === "artist") typeValue = values.artType || "";
      else if (values.role === "athlete") typeValue = values.sportType || "";
      else if (values.role === "municipality") typeValue = values.municipalityType || "";
      else if (values.role === "school") typeValue = values.schoolType || "";
      else if (values.role === "spot_owner") typeValue = values.spotOwnerType || "";

      const firebaseUser = await signUpWithEmail(values.email, values.password, values.displayName, values.role, typeValue);

      await apiRequest("/api/users", "POST", {
        email: values.email,
        displayName: values.displayName,
        role: values.role,
        artType: typeValue || null,
        firebaseUid: firebaseUser.uid,
        ...(locationData ? { homeLat: locationData.lat, homeLng: locationData.lng, homeCity: locationData.city } : {}),
      });

      try {
        await apiRequest("/api/signup/legal-consent", "POST", {
          termsAccepted: values.termsAccepted,
          privacyAccepted: values.privacyAccepted,
          dataProcessingAccepted: values.dataProcessingAccepted,
          communicationAccepted: values.communicationAccepted,
          consentVersion: "1.0",
          consentTimestamp: new Date().toISOString(),
        });
      } catch {}

      try {
        const { reportConversion } = await import("@/lib/adsTracking");
        reportConversion(undefined, "signup");
      } catch {}

      toast({ title: t.toast.successTitle, description: t.toast.successDesc });
      form.reset();
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("already exists")) {
        toast({ title: t.toast.emailExists, description: t.toast.emailExistsDesc, variant: "destructive" });
      } else if (msg.includes("weak password") || msg.includes("Password")) {
        toast({ title: t.toast.weakPassword, description: msg, variant: "destructive" });
      } else if (msg.includes("email") || msg.includes("Email")) {
        toast({ title: t.toast.invalidEmail, description: msg, variant: "destructive" });
      } else if (msg.includes("network") || msg.includes("Network")) {
        toast({ title: t.toast.networkError, description: t.toast.networkErrorDesc, variant: "destructive" });
      } else {
        toast({ title: t.toast.signupFailed, description: msg || t.toast.signupFailedDesc, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };

  const inputClass = `h-11 rounded-xl ${isDarkMode ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" : ""}`;
  const labelClass = `font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"}`;

  return (
    <Form {...form}>
      {/* Step indicator */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          {stepTitles.map((title, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center gap-1.5 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${done ? "bg-primary text-white" : active ? "bg-primary/20 border-2 border-primary text-primary" : isDarkMode ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"}`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : n}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? "text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/50"}`}>{title}</span>
                {n < 3 && <div className={`flex-1 h-px mx-2 ${step > n ? "bg-primary" : isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDarkMode ? "#374151" : "#e5e7eb" }}>
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }} />
        </div>
      </div>

      <motion.form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── STEP 1: Basic Info ── */}
        {step === 1 && <>
        {/* Email */}
        <motion.div variants={itemVariants}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>{t.email.label}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.email.placeholder}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={isLoading}
                    className={`${inputClass} h-12 text-base`}
                    data-testid="input-email"
                    {...field}
                    ref={(e) => { field.ref(e); if (e) emailInputRef.current = e; }}
                  />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </motion.div>

        {/* Password */}
        <motion.div variants={itemVariants}>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>{t.password.label}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder={t.password.placeholder}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={isLoading}
                      className={`${inputClass} h-12 text-base pr-11`}
                      data-testid="input-password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <div className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {t.password.hint}
                </div>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </motion.div>

        {/* Display Name */}
        <motion.div variants={itemVariants}>
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>{t.displayName.label}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.displayName.placeholder}
                    disabled={isLoading}
                    className={inputClass}
                    data-testid="input-display-name"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </motion.div>
        </>}

        {/* ── STEP 2: Role + Access Preview ── */}
        {step === 2 && <>
        {/* Role */}
        <motion.div variants={itemVariants}>
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>{t.role.label}</FormLabel>
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("artType", "");
                    form.setValue("sportType", "");
                    form.setValue("municipalityType", "");
                    form.setValue("schoolType", "");
                    form.setValue("spotOwnerType", "");
                  }}
                  defaultValue={field.value}
                  className="mt-2"
                  data-testid="radio-role"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES[lang].map(role => (
                      <Label
                        key={role.value}
                        htmlFor={`role-${role.value}`}
                        className={`flex flex-col gap-0.5 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                          field.value === role.value
                            ? `border-primary bg-primary/10 ${isDarkMode ? "text-white" : ""}`
                            : `${isDarkMode ? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"}`
                        }`}
                        data-testid={`label-role-${role.value}`}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={role.value} id={`role-${role.value}`} className="sr-only" />
                          <span className="text-base">{role.emoji}</span>
                          <span className="text-sm font-semibold leading-tight">{role.label}</span>
                        </div>
                        <span className={`text-xs pl-6 leading-tight ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {role.desc}
                        </span>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </motion.div>

        {/* Artist sub-type */}
        {currentRole === "artist" && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <FormField
              control={form.control}
              name="artType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>{t.artType.label}</FormLabel>
                  <OptionGrid
                    options={ARTIST_TYPES[lang]}
                    value={field.value}
                    onChange={field.onChange}
                    isDarkMode={isDarkMode}
                    testIdPrefix="art"
                  />
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
          </motion.div>
        )}

        {/* Athlete sub-type */}
        {currentRole === "athlete" && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <FormField
              control={form.control}
              name="sportType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>{t.sportType.label}</FormLabel>
                  <OptionGrid
                    options={ATHLETE_TYPES[lang]}
                    value={field.value}
                    onChange={field.onChange}
                    isDarkMode={isDarkMode}
                    testIdPrefix="sport"
                  />
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
          </motion.div>
        )}

        {/* Spot Owner sub-type */}
        {currentRole === "spot_owner" && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible" className="space-y-3">
            <FormField
              control={form.control}
              name="spotOwnerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>{t.spotOwnerType.label}</FormLabel>
                  <OptionGrid
                    options={SPOT_OWNER_TYPES[lang]}
                    value={field.value}
                    onChange={field.onChange}
                    isDarkMode={isDarkMode}
                    testIdPrefix="spot"
                  />
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            <div className={`flex gap-2 p-3 rounded-xl border text-xs ${isDarkMode ? "bg-blue-900/20 border-blue-700/40 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{t.spotOwnerInfo}</p>
            </div>
          </motion.div>
        )}

        {/* Municipality sub-type */}
        {currentRole === "municipality" && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <FormField
              control={form.control}
              name="municipalityType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>{t.municipalityType.label}</FormLabel>
                  <OptionGrid
                    options={MUNICIPALITY_TYPES[lang]}
                    value={field.value}
                    onChange={field.onChange}
                    isDarkMode={isDarkMode}
                    testIdPrefix="municipality"
                  />
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
          </motion.div>
        )}

        {/* School sub-type */}
        {currentRole === "school" && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <FormField
              control={form.control}
              name="schoolType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>{t.schoolType.label}</FormLabel>
                  <OptionGrid
                    options={SCHOOL_TYPES[lang]}
                    value={field.value}
                    onChange={field.onChange}
                    isDarkMode={isDarkMode}
                    testIdPrefix="school"
                  />
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
          </motion.div>
        )}

        {/* Role Access Preview */}
        {currentRole && ROLE_ACCESS[currentRole] && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <div className={`rounded-xl border p-3 ${ROLE_ACCESS[currentRole].color}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase tracking-wide">Your Access</span>
                </div>
                <Badge className={`text-[10px] px-2 py-0.5 ${ROLE_ACCESS[currentRole].color}`}>
                  {ROLE_ACCESS[currentRole].badge}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ROLE_ACCESS[currentRole].features.map((feat, i) => {
                  const Icon = ROLE_FEATURE_ICONS[i % ROLE_FEATURE_ICONS.length];
                  return (
                    <div key={feat} className="flex items-center gap-1.5 text-xs opacity-90">
                      <Check className="w-3 h-3 shrink-0 opacity-70" />
                      <span>{feat}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
        </>}

        {/* ── STEP 3: Location + Legal ── */}
        {step === 3 && <>
        {/* Location */}
        <motion.div variants={itemVariants} className="space-y-1">
          <label className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}>
            {t.location.label}{" "}
            <span className={`font-normal text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              ({t.location.hint})
            </span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={locationQuery}
                onChange={e => { setLocationQuery(e.target.value); setLocationData(null); searchLocation(e.target.value); }}
                onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={t.location.placeholder}
                disabled={isLoading || isGettingGPS}
                data-testid="input-location"
                className={`w-full h-11 px-3 pr-8 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                } ${locationData ? "border-green-500" : ""}`}
              />
              {locationData && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
              )}
              {showSuggestions && locationSuggestions.length > 0 && (
                <ul className={`absolute z-50 left-0 right-0 top-12 rounded-xl border shadow-lg max-h-48 overflow-y-auto ${isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200"}`}>
                  {locationSuggestions.map((item, i) => (
                    <li
                      key={i}
                      onMouseDown={() => selectLocation(item)}
                      className={`px-3 py-2 text-xs cursor-pointer hover:bg-primary/10 ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}
                    >
                      📍 {item.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={getGPSLocation}
              disabled={isLoading || isGettingGPS}
              data-testid="button-gps-location"
              title={lang === "nl" ? "Gebruik mijn GPS-locatie" : "Use my GPS location"}
              className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border transition-colors ${
                isGettingGPS
                  ? "border-primary/40 bg-primary/10 text-primary cursor-wait"
                  : isDarkMode
                  ? "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "border-gray-300 bg-white text-gray-500 hover:bg-primary/5 hover:border-primary hover:text-primary"
              }`}
            >
              {isGettingGPS ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>

        {/* Legal Agreements */}
        <motion.div variants={itemVariants} className="mt-4 space-y-3">
          <div className={`p-4 rounded-xl border ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? "text-gray-100" : "text-gray-800"}`}>
              {t.legal.title}
            </h3>
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                        id="termsAccepted"
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label htmlFor="termsAccepted" className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"} cursor-pointer`}>
                        {t.legal.terms}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setTermsModalOpen(true); }}
                          className="text-primary underline hover:text-primary/80 font-medium focus:outline-none"
                          data-testid="button-open-terms"
                        >
                          {t.legal.termsLink}
                        </button>
                      </label>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="privacyAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                        id="privacyAccepted"
                        data-testid="checkbox-privacy"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label htmlFor="privacyAccepted" className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"} cursor-pointer`}>
                        {t.legal.privacy}
                        <Link to="/privacy-policy" className="text-primary underline hover:text-primary/80">
                          {t.legal.privacyLink}
                        </Link>
                      </label>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataProcessingAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                        id="dataProcessingAccepted"
                        data-testid="checkbox-data-processing"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label htmlFor="dataProcessingAccepted" className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"} cursor-pointer`}>
                        {t.legal.dataProcessing}
                        <Link to="/app-permissions" className="text-primary underline hover:text-primary/80">
                          {t.legal.dataProcessingLink}
                        </Link>
                        {t.legal.dataProcessingEnd}
                      </label>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="communicationAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                        id="communicationAccepted"
                        data-testid="checkbox-communication"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label htmlFor="communicationAccepted" className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"} cursor-pointer`}>
                        {t.legal.communication}{" "}
                        <span className={isDarkMode ? "text-gray-400" : "text-gray-500"}>{t.legal.optional}</span>
                      </label>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </motion.div>

        </>}

        {/* Navigation Buttons */}
        <motion.div variants={itemVariants} className="mt-4 pt-2 flex gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl font-semibold"
              onClick={() => setStep(s => (s === 2 ? 1 : 2) as 1 | 2 | 3)}
              disabled={isLoading}
              data-testid="button-back-step"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {lang === "nl" ? "Terug" : "Back"}
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              className="flex-1 h-12 font-semibold text-base rounded-xl"
              onClick={goNext}
              disabled={isLoading}
              data-testid="button-next-step"
            >
              {lang === "nl" ? "Volgende" : "Continue"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="submit"
              className="flex-1 h-12 font-semibold text-base rounded-xl"
              disabled={isLoading}
              data-testid="button-submit-signup"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.submit.loading}
                </div>
              ) : (
                t.submit.idle
              )}
            </Button>
          )}
        </motion.div>
      </motion.form>

      <SignupTermsModal
        open={termsModalOpen}
        onOpenChange={setTermsModalOpen}
        onAccept={() => form.setValue("termsAccepted", true)}
      />
    </Form>
  );
};

export default SignupForm;
