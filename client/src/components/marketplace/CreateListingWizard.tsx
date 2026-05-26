import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ProductCategory, ProductCondition, ListingType, DeliveryOption } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import MultiImageUploader from "@/components/shared/MultiImageUploader";
import {
  Camera, Tag, Info, Truck, Sparkles, CheckCircle,
  ArrowLeft, ArrowRight, Loader2, MapPin, Package,
  ShoppingBag, AlertCircle, Star, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "photos", label: "Photos", icon: Camera },
  { id: "details", label: "Details", icon: Info },
  { id: "pricing", label: "Pricing", icon: Tag },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "review", label: "Review", icon: CheckCircle },
];

const CATEGORIES = [
  { value: ProductCategory.CLOTHING, label: "Clothing", emoji: "👕" },
  { value: ProductCategory.SHOES, label: "Shoes", emoji: "👟" },
  { value: ProductCategory.ACCESSORIES, label: "Accessories", emoji: "🧢" },
  { value: ProductCategory.ARTWORK, label: "Artwork", emoji: "🎨" },
  { value: ProductCategory.VINYL_MUSIC, label: "Vinyl & Music", emoji: "🎵" },
  { value: ProductCategory.EQUIPMENT, label: "Equipment", emoji: "🛹" },
  { value: ProductCategory.BOOKS, label: "Books", emoji: "📚" },
  { value: ProductCategory.COLLECTIBLES, label: "Collectibles", emoji: "✨" },
  { value: ProductCategory.OTHER, label: "Other", emoji: "📦" },
];

const CONDITIONS = [
  { value: ProductCondition.NEW, label: "New", description: "Never used, with original tags/packaging", color: "bg-green-100 text-green-800 border-green-300" },
  { value: ProductCondition.LIKE_NEW, label: "Like New", description: "Used once or twice, no visible wear", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: ProductCondition.GOOD, label: "Good", description: "Light use, minor wear, works perfectly", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: ProductCondition.FAIR, label: "Fair", description: "Visible wear, some flaws but functional", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: ProductCondition.POOR, label: "Poor", description: "Heavy use, significant wear or damage", color: "bg-red-100 text-red-800 border-red-300" },
];

const wizardSchema = z.object({
  name: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().min(20, "Description must be at least 20 characters").max(2000),
  category: z.string().min(1, "Please select a category"),
  condition: z.string().min(1, "Please select a condition"),
  listingType: z.string().min(1, "Please select listing type"),
  brand: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  price: z.string().min(1, "Please enter a price"),
  stock: z.coerce.number().min(1).default(1),
  deliveryOption: z.string().min(1, "Please select delivery option"),
  pickupCity: z.string().optional(),
  pickupAddress: z.string().optional(),
  shippingCost: z.string().optional(),
});

type WizardFormValues = z.infer<typeof wizardSchema>;

interface CreateListingWizardProps {
  onSuccess?: () => void;
}

export default function CreateListingWizard({ onSuccess }: CreateListingWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ title?: string; description?: string; price?: string } | null>(null);

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      condition: ProductCondition.GOOD,
      listingType: ListingType.SECONDHAND,
      brand: "",
      size: "",
      color: "",
      price: "",
      stock: 1,
      deliveryOption: DeliveryOption.SHIPPING,
      pickupCity: "",
      pickupAddress: "",
      shippingCost: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: WizardFormValues) => {
      const payload = {
        ...data,
        images,
        sellerId: user?.id,
        isDigital: false,
        status: "active",
        price: parseFloat(data.price).toFixed(2),
        shippingCost: data.shippingCost ? parseFloat(data.shippingCost).toFixed(2) : "0.00",
        stock: data.stock || 1,
      };
      const res = await apiRequest("/api/products", "POST", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create listing");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Listing created!", description: "Your item is now live on the marketplace." });
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const getAiSuggestions = async () => {
    const category = form.getValues("category");
    const condition = form.getValues("condition");
    const brand = form.getValues("brand");
    const name = form.getValues("name");

    if (!category) {
      toast({ title: "Select a category first", variant: "destructive" });
      return;
    }

    setAiLoading(true);
    try {
      const res = await apiRequest("/api/marketplace/ai/improve-listing", "POST", {
        name, category, condition, brand,
        currentDescription: form.getValues("description"),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestion(data);
      }
    } catch (e) {
      toast({ title: "AI assistance unavailable", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.title) form.setValue("name", aiSuggestion.title);
    if (aiSuggestion.description) form.setValue("description", aiSuggestion.description);
    if (aiSuggestion.price) form.setValue("price", aiSuggestion.price);
    setAiSuggestion(null);
    toast({ title: "AI suggestions applied!" });
  };

  const canGoNext = () => {
    const values = form.getValues();
    if (step === 0) return images.length > 0;
    if (step === 1) return values.name.length >= 3 && values.description.length >= 20 && values.category;
    if (step === 2) return values.price && parseFloat(values.price) >= 0;
    if (step === 3) {
      if (values.deliveryOption === DeliveryOption.PICKUP || values.deliveryOption === DeliveryOption.BOTH) {
        return !!values.pickupCity;
      }
      return true;
    }
    return true;
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  const progress = ((step + 1) / STEPS.length) * 100;
  const watchedValues = form.watch();
  const selectedCategory = CATEGORIES.find(c => c.value === watchedValues.category);
  const selectedCondition = CONDITIONS.find(c => c.value === watchedValues.condition);

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                  i < step ? "bg-primary border-primary text-white" :
                  i === step ? "border-primary text-primary bg-primary/10" :
                  "border-muted-foreground/30 text-muted-foreground/40"
                )}>
                  {i < step ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={cn(
                  "text-[10px] font-medium hidden sm:block",
                  i === step ? "text-primary" : "text-muted-foreground/60"
                )}>{s.label}</span>
              </div>
            );
          })}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step Content */}
      <Form {...form}>
        <form className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* STEP 0: Photos */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">Add photos</h2>
                <p className="text-sm text-muted-foreground">Great photos make listings sell faster. Add at least one photo.</p>
              </div>
              <MultiImageUploader
                images={images}
                onImagesChange={setImages}
                maxImages={8}
              />
              {images.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>At least one photo is required to continue.</span>
                </div>
              )}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tips for great photos:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• Use good natural lighting</li>
                  <li>• Show the item from multiple angles</li>
                  <li>• Include photos of any defects or wear</li>
                  <li>• Use a clean, neutral background</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 1: Details */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">Item details</h2>
                  <p className="text-sm text-muted-foreground">Tell buyers what you're selling.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={getAiSuggestions}
                  disabled={aiLoading}
                  className="text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  AI Assist
                </Button>
              </div>

              {aiSuggestion && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Sparkles className="h-4 w-4" />
                    AI Suggestions Ready
                  </div>
                  {aiSuggestion.title && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Suggested title:</p>
                      <p className="text-sm font-medium">"{aiSuggestion.title}"</p>
                    </div>
                  )}
                  {aiSuggestion.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Suggested description:</p>
                      <p className="text-xs line-clamp-3">{aiSuggestion.description}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={applyAiSuggestion} className="text-xs h-7">Apply suggestions</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAiSuggestion(null)} className="text-xs h-7">Dismiss</Button>
                  </div>
                </div>
              )}

              {/* Listing Type */}
              <FormField
                control={form.control}
                name="listingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Listing type</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: ListingType.SECONDHAND, label: "Secondhand", icon: "♻️", desc: "Pre-owned item" },
                        { value: ListingType.NEW, label: "New", icon: "✨", desc: "Brand new item" },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={cn(
                            "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                            field.value === opt.value ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"
                          )}
                        >
                          <span className="text-lg mb-1">{opt.icon}</span>
                          <span className="text-sm font-semibold">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Nike Air Max 90 – Size 42, Good Condition" {...field} />
                    </FormControl>
                    <FormDescription>Be specific: brand, type, size, condition</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => field.onChange(cat.value)}
                          className={cn(
                            "flex flex-col items-center p-2 rounded-lg border-2 transition-all text-center",
                            field.value === cat.value ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"
                          )}
                        >
                          <span className="text-xl mb-0.5">{cat.emoji}</span>
                          <span className="text-xs font-medium leading-tight">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Condition */}
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <div className="space-y-2">
                      {CONDITIONS.map(cond => (
                        <button
                          key={cond.value}
                          type="button"
                          onClick={() => field.onChange(cond.value)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                            field.value === cond.value ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"
                          )}
                        >
                          <div className={cn("px-2 py-0.5 rounded text-xs font-bold border", cond.color)}>
                            {cond.label}
                          </div>
                          <span className="text-xs text-muted-foreground">{cond.description}</span>
                          {field.value === cond.value && <CheckCircle className="h-4 w-4 text-primary ml-auto shrink-0" />}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your item honestly. Include any defects, history, measurements, or other relevant details buyers would want to know."
                        className="min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex justify-between">
                      <FormMessage />
                      <span className={cn("text-xs ml-auto", field.value?.length < 20 ? "text-amber-500" : "text-muted-foreground")}>
                        {field.value?.length || 0}/2000
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              {/* Optional fields */}
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="Nike, Adidas…" className="text-sm" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Size</FormLabel>
                      <FormControl>
                        <Input placeholder="M, 42, XL…" className="text-sm" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Color</FormLabel>
                      <FormControl>
                        <Input placeholder="Black, Red…" className="text-sm" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Pricing */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold">Set your price</h2>
                <p className="text-sm text-muted-foreground">Price it fairly to attract buyers quickly.</p>
              </div>

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asking price</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-8 text-xl font-semibold h-14"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>Enter 0 for free items</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity available</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="1" {...field} />
                    </FormControl>
                    <FormDescription>How many of this item do you have?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                  <Zap className="h-4 w-4" />
                  Pricing tips for the Netherlands
                </div>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <li>• Price 20-30% below retail for secondhand items in good condition</li>
                  <li>• Vinted, Marktplaats, and Depop are your pricing benchmarks</li>
                  <li>• Items under €25 sell fastest in the urban community</li>
                  <li>• Consider negotiation room when setting your price</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 3: Delivery */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold">Delivery options</h2>
                <p className="text-sm text-muted-foreground">How will buyers receive this item?</p>
              </div>

              <FormField
                control={form.control}
                name="deliveryOption"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-2">
                      {[
                        {
                          value: DeliveryOption.SHIPPING,
                          label: "Shipping only",
                          desc: "Ship via PostNL, DHL, or DPD",
                          icon: Package,
                        },
                        {
                          value: DeliveryOption.PICKUP,
                          label: "Local pickup only",
                          desc: "Buyer collects from you in person",
                          icon: MapPin,
                        },
                        {
                          value: DeliveryOption.BOTH,
                          label: "Shipping & Pickup",
                          desc: "Offer both options to buyers",
                          icon: Truck,
                        },
                      ].map(opt => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => field.onChange(opt.value)}
                            className={cn(
                              "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                              field.value === opt.value ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"
                            )}
                          >
                            <Icon className={cn("h-5 w-5 shrink-0", field.value === opt.value ? "text-primary" : "text-muted-foreground")} />
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                            {field.value === opt.value && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(watchedValues.deliveryOption === DeliveryOption.SHIPPING || watchedValues.deliveryOption === DeliveryOption.BOTH) && (
                <FormField
                  control={form.control}
                  name="shippingCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping cost</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                          <Input type="number" step="0.01" min="0" placeholder="0.00" className="pl-7" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>Enter 0 for free shipping. PostNL standard is ~€4.50–€7.00</FormDescription>
                    </FormItem>
                  )}
                />
              )}

              {(watchedValues.deliveryOption === DeliveryOption.PICKUP || watchedValues.deliveryOption === DeliveryOption.BOTH) && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="pickupCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup city <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Amsterdam, Rotterdam, Utrecht…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pickupAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup area <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Near Amsterdam Centraal" {...field} />
                        </FormControl>
                        <FormDescription>A general area — don't share your exact address publicly</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold">Review your listing</h2>
                <p className="text-sm text-muted-foreground">Make sure everything looks right before publishing.</p>
              </div>

              {/* Photo preview */}
              {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.slice(0, 5).map((img, i) => (
                    <img key={i} src={img} alt="" className="h-20 w-20 rounded-lg object-cover shrink-0 border" />
                  ))}
                  {images.length > 5 && (
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                      +{images.length - 5}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border divide-y">
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Title</p>
                  <p className="font-semibold">{watchedValues.name || "—"}</p>
                </div>
                <div className="p-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="text-sm font-medium">{selectedCategory ? `${selectedCategory.emoji} ${selectedCategory.label}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Condition</p>
                    {selectedCondition && (
                      <Badge className={cn("text-xs", selectedCondition.color)}>{selectedCondition.label}</Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Type</p>
                    <Badge variant="outline" className="text-xs capitalize">{watchedValues.listingType}</Badge>
                  </div>
                </div>
                {(watchedValues.brand || watchedValues.size || watchedValues.color) && (
                  <div className="p-4 flex gap-4">
                    {watchedValues.brand && <div><p className="text-xs text-muted-foreground mb-1">Brand</p><p className="text-sm">{watchedValues.brand}</p></div>}
                    {watchedValues.size && <div><p className="text-xs text-muted-foreground mb-1">Size</p><p className="text-sm">{watchedValues.size}</p></div>}
                    {watchedValues.color && <div><p className="text-xs text-muted-foreground mb-1">Color</p><p className="text-sm">{watchedValues.color}</p></div>}
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm line-clamp-3">{watchedValues.description || "—"}</p>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Price</p>
                    <p className="text-xl font-bold text-primary">€{watchedValues.price || "0.00"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Delivery</p>
                    <p className="text-sm font-medium capitalize">{watchedValues.deliveryOption?.replace("_", " ")}</p>
                    {watchedValues.pickupCity && <p className="text-xs text-muted-foreground">{watchedValues.pickupCity}</p>}
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Ready to publish</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Your listing will be visible to the community immediately.</p>
                </div>
              </div>
            </div>
          )}
        </form>
      </Form>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t bg-background">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </div>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext()}
            className="gap-2"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="gap-2 bg-primary"
          >
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Publishing…</>
            ) : (
              <><ShoppingBag className="h-4 w-4" />Publish listing</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
