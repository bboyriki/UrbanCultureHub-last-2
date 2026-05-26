import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useExploreImageUpdates } from "@/hooks/use-explore-image-updates";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  ImageIcon, 
  CheckCircle, 
  XCircle, 
  Info as InfoIcon,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Star,
  RefreshCw,
  LayoutGrid,
  List
} from "lucide-react";

type ExplorePageImage = {
  id: number;
  section: string;
  imageUrl: string;
  imagePublicId: string;
  title: string;
  description: string;
  sortOrder: number | null;
  isActive: boolean | null;
  isCoverImage: boolean | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const imageFormSchema = z.object({
  section: z.string().min(1, { message: "Section is required" }),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  sortOrder: z.coerce.number().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
  isCoverImage: z.boolean().optional().nullable(),
  image: z.instanceof(FileList).optional(),
});

type ImageFormValues = z.infer<typeof imageFormSchema>;

const IMAGE_SECTIONS = [
  { value: "map", label: "Map", color: "bg-blue-500" },
  { value: "events", label: "Events", color: "bg-purple-500" },
  { value: "marketplace", label: "Marketplace", color: "bg-green-500" },
  { value: "community", label: "Community", color: "bg-orange-500" },
  { value: "services", label: "Services", color: "bg-cyan-500" },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export default function ExploreImagesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<ExplorePageImage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useExploreImageUpdates();

  useEffect(() => {
    if (!loading && (!user || !["admin", "super_admin"].includes(user.role))) {
      navigate("/admin-login");
    }
  }, [user, loading, navigate]);

  const {
    data: images,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/explore-images"],
    enabled: true,
    staleTime: 3000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  const form = useForm<ImageFormValues>({
    resolver: zodResolver(imageFormSchema),
    defaultValues: {
      section: "",
      title: "",
      description: "",
      sortOrder: 0,
      isActive: true,
      isCoverImage: false,
      image: undefined,
    },
  });

  useEffect(() => {
    if (currentImage) {
      form.reset({
        section: currentImage.section,
        title: currentImage.title,
        description: currentImage.description,
        sortOrder: currentImage.sortOrder,
        isActive: currentImage.isActive,
        isCoverImage: currentImage.isCoverImage,
      });
    } else {
      form.reset({
        section: "",
        title: "",
        description: "",
        sortOrder: 0,
        isActive: true,
        isCoverImage: false,
        image: undefined,
      });
    }
  }, [currentImage, form, isCreateModalOpen, isEditModalOpen]);

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/explore-images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create image");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/explore-images"] });
      setIsCreateModalOpen(false);
      setUploadProgress(null);
      form.reset();
      toast({
        title: "Image created",
        description: "The explore page image has been added successfully.",
      });
    },
    onError: (error: Error) => {
      setUploadProgress(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
      const response = await fetch(`/api/explore-images/${id}`, {
        method: "PUT",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update image");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/explore-images"] });
      setIsEditModalOpen(false);
      setCurrentImage(null);
      setUploadProgress(null);
      toast({
        title: "Image updated",
        description: "The explore page image has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      setUploadProgress(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/explore-images/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/explore-images"] });
      setIsDeleteModalOpen(false);
      setCurrentImage(null);
      toast({
        title: "Image deleted",
        description: "The explore page image has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSectionOrderMutation = useMutation({
    mutationFn: async ({ section, position, imageId }: { section: string; position: number; imageId: number }) => {
      return apiRequest(`/api/explore-images/${imageId}/order`, "PUT", { section, position });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/explore-images"] });
      toast({
        title: "Order updated",
        description: "Image position has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update image order",
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (values: ImageFormValues) => {
    const formData = new FormData();
    formData.append("section", values.section);
    formData.append("title", values.title);
    formData.append("description", values.description);
    if (values.sortOrder !== undefined && values.sortOrder !== null) {
      formData.append("sortOrder", String(values.sortOrder));
    }
    formData.append("isActive", values.isActive ? "true" : "false");
    formData.append("isCoverImage", values.isCoverImage ? "true" : "false");

    if (values.image && values.image.length > 0) {
      formData.append("image", values.image[0]);
      setUploadProgress(0);
      const fakeProgress = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev !== null && prev < 90) return prev + 10;
          clearInterval(fakeProgress);
          return 90;
        });
      }, 200);
    } else {
      toast({
        title: "Image required",
        description: "Please select an image to upload.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const onUpdateSubmit = (values: ImageFormValues) => {
    if (!currentImage) return;

    const formData = new FormData();
    formData.append("section", values.section);
    formData.append("title", values.title);
    formData.append("description", values.description);
    if (values.sortOrder !== undefined && values.sortOrder !== null) {
      formData.append("sortOrder", String(values.sortOrder));
    }
    formData.append("isActive", values.isActive ? "true" : "false");
    formData.append("isCoverImage", values.isCoverImage ? "true" : "false");

    if (values.image && values.image.length > 0) {
      formData.append("image", values.image[0]);
      setUploadProgress(0);
      const fakeProgress = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev !== null && prev < 90) return prev + 10;
          clearInterval(fakeProgress);
          return 90;
        });
      }, 200);
    }

    updateMutation.mutate({ id: currentImage.id, formData });
  };

  const handleEditImage = (image: ExplorePageImage) => {
    setCurrentImage(image);
    setIsEditModalOpen(true);
  };

  const handleDeleteImage = (image: ExplorePageImage) => {
    setCurrentImage(image);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (currentImage) {
      deleteMutation.mutate(currentImage.id);
    }
  };

  const handleSectionOrder = (image: ExplorePageImage, newPosition: number) => {
    updateSectionOrderMutation.mutate({
      section: image.section,
      position: newPosition,
      imageId: image.id,
    });
  };

  const hasImages = Array.isArray(images) && images.length > 0;

  const imagesBySection = hasImages
    ? IMAGE_SECTIONS.map((section) => ({
        ...section,
        sectionName: section.label,
        sectionKey: section.value,
        images: images
          .filter((img: ExplorePageImage) => img.section === section.value)
          .sort((a: ExplorePageImage, b: ExplorePageImage) => {
            const aOrder = a.sortOrder || 0;
            const bOrder = b.sortOrder || 0;
            return aOrder - bOrder;
          }),
      }))
    : IMAGE_SECTIONS.map((section) => ({
        ...section,
        sectionName: section.label,
        sectionKey: section.value,
        images: [],
      }));

  const filteredSections = activeSection
    ? imagesBySection.filter((s) => s.sectionKey === activeSection)
    : imagesBySection;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    );
  }

  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="shrink-0"
                data-testid="button-back-admin"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Explore Images</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Manage images for the Explore page sections
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                className="shrink-0"
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <div className="hidden sm:flex border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8"
                  data-testid="button-view-grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8"
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex-1 sm:flex-none"
                data-testid="button-add-image"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-6"
        >
          <Button
            variant={activeSection === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection(null)}
            className="transition-all duration-200"
            data-testid="button-filter-all"
          >
            All Sections
          </Button>
          {IMAGE_SECTIONS.map((section) => (
            <Button
              key={section.value}
              variant={activeSection === section.value ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSection(section.value)}
              className="transition-all duration-200"
              data-testid={`button-filter-${section.value}`}
            >
              <span className={`w-2 h-2 rounded-full ${section.color} mr-2`} />
              {section.label}
            </Button>
          ))}
        </motion.div>

        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading images...</p>
          </motion.div>
        ) : error ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Error Loading Images
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Failed to load explore page images. Please try again.
                </p>
                <Button onClick={() => refetch()} variant="outline" data-testid="button-retry">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : !hasImages ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="text-center pb-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <ImageIcon className="h-16 w-16 mx-auto text-primary/40 mb-4" />
                </motion.div>
                <CardTitle className="text-xl">Get Started with Explore Images</CardTitle>
                <CardDescription className="max-w-md mx-auto">
                  Add images to showcase different features of your platform on the Explore page.
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-center pt-4">
                <Button onClick={() => setIsCreateModalOpen(true)} size="lg" data-testid="button-add-first-image">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Your First Image
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredSections.map((section, sectionIndex) => (
                <motion.div
                  key={section.sectionKey}
                  variants={fadeInUp}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ delay: sectionIndex * 0.1 }}
                  layout
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-3 h-3 rounded-full ${section.color}`} />
                          <div>
                            <CardTitle className="text-lg">{section.sectionName}</CardTitle>
                            <CardDescription className="text-sm">
                              {section.images.length} image{section.images.length !== 1 ? "s" : ""}
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            form.setValue("section", section.sectionKey);
                            setIsCreateModalOpen(true);
                          }}
                          data-testid={`button-add-${section.sectionKey}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add to {section.sectionName}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {section.images.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="py-12 text-center"
                        >
                          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                          <p className="text-muted-foreground mb-4">
                            No images in this section yet
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              form.setValue("section", section.sectionKey);
                              setIsCreateModalOpen(true);
                            }}
                            data-testid={`button-add-first-${section.sectionKey}`}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Image
                          </Button>
                        </motion.div>
                      ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          <AnimatePresence mode="popLayout">
                            {section.images.map((image: ExplorePageImage, imageIndex: number) => (
                              <motion.div
                                key={image.id}
                                variants={scaleIn}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ delay: imageIndex * 0.05 }}
                                layout
                                className="group relative rounded-lg border overflow-hidden bg-card"
                              >
                                <div className="aspect-video relative overflow-hidden bg-muted">
                                  <img
                                    src={image.imageUrl}
                                    alt={image.title}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                  <div className="absolute top-2 left-2 flex gap-1">
                                    {image.isCoverImage && (
                                      <Badge className="bg-amber-500 text-white text-xs">
                                        <Star className="h-3 w-3 mr-1" />
                                        Cover
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="absolute top-2 right-2">
                                    <Badge
                                      variant={image.isActive ? "default" : "secondary"}
                                      className={image.isActive ? "bg-green-500" : "bg-gray-500"}
                                    >
                                      {image.isActive ? (
                                        <Eye className="h-3 w-3 mr-1" />
                                      ) : (
                                        <EyeOff className="h-3 w-3 mr-1" />
                                      )}
                                      {image.isActive ? "Active" : "Hidden"}
                                    </Badge>
                                  </div>
                                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="h-8 w-8"
                                      onClick={() => handleEditImage(image)}
                                      data-testid={`button-edit-${image.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="destructive"
                                      className="h-8 w-8"
                                      onClick={() => handleDeleteImage(image)}
                                      data-testid={`button-delete-${image.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="p-3">
                                  <h4 className="font-medium text-sm truncate mb-1">
                                    {image.title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {image.description}
                                  </p>
                                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                                    <span className="text-xs text-muted-foreground">
                                      Position: {image.sortOrder || 0}
                                    </span>
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => handleSectionOrder(image, Math.max(0, (image.sortOrder || 0) - 1))}
                                        disabled={!image.sortOrder || image.sortOrder <= 0}
                                        data-testid={`button-move-up-${image.id}`}
                                      >
                                        <ChevronUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => handleSectionOrder(image, (image.sortOrder || 0) + 1)}
                                        data-testid={`button-move-down-${image.id}`}
                                      >
                                        <ChevronDown className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <AnimatePresence mode="popLayout">
                            {section.images.map((image: ExplorePageImage, imageIndex: number) => (
                              <motion.div
                                key={image.id}
                                variants={fadeInUp}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ delay: imageIndex * 0.05 }}
                                layout
                                className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                              >
                                <div className="w-20 h-14 rounded overflow-hidden shrink-0 bg-muted">
                                  <img
                                    src={image.imageUrl}
                                    alt={image.title}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-sm truncate">{image.title}</h4>
                                    {image.isCoverImage && (
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        <Star className="h-3 w-3 mr-1" />
                                        Cover
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {image.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant={image.isActive ? "default" : "secondary"}>
                                    {image.isActive ? "Active" : "Hidden"}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => handleEditImage(image)}
                                      data-testid={`button-list-edit-${image.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteImage(image)}
                                      data-testid={`button-list-delete-${image.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Image</DialogTitle>
            <DialogDescription>
              Upload an image to display in the Explore page sections.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {IMAGE_SECTIONS.map((section) => (
                          <SelectItem key={section.value} value={section.value}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${section.color}`} />
                              {section.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter image title" {...field} />
                    </FormControl>
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
                        placeholder="Enter image description"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Active</FormLabel>
                        <FormDescription className="text-xs">
                          Show on explore page
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isCoverImage"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Cover</FormLabel>
                        <FormDescription className="text-xs">
                          Use as cover image
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="image"
                render={({ field: { onChange, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>Image File</FormLabel>
                    <FormControl>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        <Input
                          type="file"
                          accept="image/*"
                          className="cursor-pointer"
                          onChange={(e) => onChange(e.target.files)}
                          {...field}
                        />
                        {value && value[0] && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Selected: {value[0].name}
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {uploadProgress !== null && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button type="button" variant="outline" data-testid="button-cancel-create">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending || uploadProgress !== null} data-testid="button-submit-create">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Image
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
            <DialogDescription>Update the image details.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateSubmit)} className="space-y-4">
              {currentImage && (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-4">
                  <img
                    src={currentImage.imageUrl}
                    alt={currentImage.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {IMAGE_SECTIONS.map((section) => (
                          <SelectItem key={section.value} value={section.value}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${section.color}`} />
                              {section.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter image title" {...field} />
                    </FormControl>
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
                        placeholder="Enter image description"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Active</FormLabel>
                        <FormDescription className="text-xs">
                          Show on explore page
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isCoverImage"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Cover</FormLabel>
                        <FormDescription className="text-xs">
                          Use as cover image
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="image"
                render={({ field: { onChange, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>Replace Image (Optional)</FormLabel>
                    <FormControl>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                        <Input
                          type="file"
                          accept="image/*"
                          className="cursor-pointer"
                          onChange={(e) => onChange(e.target.files)}
                          {...field}
                        />
                        {value && value[0] && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            New image: {value[0].name}
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Only upload if you want to replace the current image.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {uploadProgress !== null && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button type="button" variant="outline" data-testid="button-cancel-edit">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={updateMutation.isPending || uploadProgress !== null} data-testid="button-submit-edit">
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Image
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Image
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {currentImage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-4 rounded-lg bg-muted"
            >
              <div className="w-20 h-14 rounded overflow-hidden shrink-0">
                <img
                  src={currentImage.imageUrl}
                  alt={currentImage.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium truncate">{currentImage.title}</h4>
                <p className="text-sm text-muted-foreground capitalize">{currentImage.section}</p>
              </div>
            </motion.div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" data-testid="button-cancel-delete">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
