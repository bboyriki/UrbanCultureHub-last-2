import React, { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Create a schema for form validation
const spotFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
  locationId: z.string(), // Convert to number in onSubmit
  categoryId: z.string(), // Convert to number in onSubmit
  // Latitude and longitude are not editable via form
});

type SpotFormValues = z.infer<typeof spotFormSchema>;

interface Spot {
  id: number;
  name: string;
  description: string;
  locationId: number;
  imageUrl: string;
  creatorId: number;
  latitude: number;
  longitude: number;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
  location?: {
    id: number;
    name: string;
  };
  category?: {
    id: number;
    name: string;
  };
}

interface Location {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

const SpotEditPage: React.FC = () => {
  const [, params] = useRoute<{ id: string }>('/map/spots/:id/edit');
  const spotId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch spot details
  const { data: spot, isLoading: isLoadingSpot } = useQuery({
    queryKey: ['/api/spots', spotId],
    queryFn: async () => {
      if (!spotId) return null;
      const response = await fetch(`/api/spots/${spotId}`);
      if (!response.ok) throw new Error('Failed to fetch spot');
      return response.json();
    },
    enabled: !!spotId
  });

  // Fetch locations for select dropdown
  const { data: locations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ['/api/locations'],
    queryFn: async () => {
      const response = await fetch('/api/locations');
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    }
  });

  // Fetch categories for select dropdown
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/spot-categories'],
    queryFn: async () => {
      const response = await fetch('/api/spot-categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    }
  });

  const form = useForm<SpotFormValues>({
    resolver: zodResolver(spotFormSchema),
    defaultValues: {
      name: '',
      description: '',
      locationId: '',
      categoryId: '',
    },
  });

  // Update form when spot data is loaded
  useEffect(() => {
    if (spot) {
      form.reset({
        name: spot.name,
        description: spot.description,
        locationId: spot.locationId.toString(),
        categoryId: spot.categoryId.toString(),
      });
    }
  }, [spot, form]);

  // Mutation for updating spot
  const updateSpotMutation = useMutation({
    mutationFn: async (values: SpotFormValues) => {
      if (!spotId) throw new Error('Spot ID is required');
      
      return apiRequest(`/api/spots/${spotId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...values,
          locationId: parseInt(values.locationId),
          categoryId: parseInt(values.categoryId),
        }),
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/spots', spotId] });
      queryClient.invalidateQueries({ queryKey: ['/api/spots'] });
      
      toast({
        title: 'Spot updated',
        description: 'Your spot has been updated successfully',
      });
      
      // Navigate back to the spot management page
      window.location.href = `/map/spots/${spotId}/manage`;
    },
    onError: (error) => {
      toast({
        title: 'Error updating spot',
        description: error.message || 'An error occurred while updating the spot',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: SpotFormValues) => {
    updateSpotMutation.mutate(values);
  };

  if (isLoadingSpot || isLoadingLocations || isLoadingCategories) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading spot data...</span>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <h2 className="text-lg font-semibold">Spot not found</h2>
          <p>The spot you're trying to edit doesn't exist or you don't have permission to edit it.</p>
          <Link to="/map">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Map
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6">
        <div>
          <Link to={`/map/spots/${spotId}/manage`}>
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Spot Management
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">Edit Spot</h1>
          <p className="text-muted-foreground mb-2">
            Update information for: {spot.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spot Details</CardTitle>
          <CardDescription>
            Edit the information for your urban culture spot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter spot name" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name of your urban culture spot
                    </FormDescription>
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
                        placeholder="Describe your spot"
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide details about this spot, its significance, and what visitors can expect
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations?.map((location: Location) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The general area or neighborhood
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((category: Category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The type of urban culture this spot represents
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateSpotMutation.isPending}
                >
                  {updateSpotMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpotEditPage;