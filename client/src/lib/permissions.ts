/**
 * Permission utilities for checking if a user can perform certain actions
 */

import { User } from "@shared/schema";

/**
 * Check if the current user can manage (edit/delete) a post
 * @param currentUser The currently logged in user
 * @param postAuthorId The ID of the post author
 * @returns boolean indicating if user can manage the post
 */
export function canManagePost(currentUser: User | null, postAuthorId: number | null | undefined): boolean {
  if (!currentUser) return false;

  // Admin can manage any post
  if (currentUser.role === "admin") return true;

  // Users can manage their own posts
  return currentUser.id === postAuthorId;
}

/**
 * Check if the current user can manage (edit/delete) a comment
 * @param currentUser The currently logged in user
 * @param commentAuthorId The ID of the comment author
 * @returns boolean indicating if user can manage the comment
 */
export function canManageComment(currentUser: User | null, commentAuthorId: number | null | undefined): boolean {
  if (!currentUser) return false;

  // Admin can manage any comment
  if (currentUser.role === "admin") return true;

  // Users can manage their own comments
  return currentUser.id === commentAuthorId;
}

/**
 * Check if the current user can manage (edit/delete) an event
 * @param currentUser The currently logged in user
 * @param eventOrganizerId The ID of the event organizer
 * @returns boolean indicating if user can manage the event
 */
export function canManageEvent(currentUser: User | null, eventOrganizerId: number | null | undefined): boolean {
  if (!currentUser) return false;

  // Admin can manage any event
  if (currentUser.role === "admin") return true;

  // Users can manage their own events
  return currentUser.id === eventOrganizerId;
}

/**
 * Check if the current user can manage (edit/delete) a location
 * @param currentUser The currently logged in user
 * @param locationCreatorId The ID of the location creator
 * @returns boolean indicating if user can manage the location
 */
export function canManageLocation(currentUser: User | null, locationCreatorId: number | null | undefined): boolean {
  if (!currentUser) return false;

  // Admin can manage any location
  if (currentUser.role === "admin") return true;

  // Users can manage locations they created
  return currentUser.id === locationCreatorId;
}

/**
 * Check if the current user can manage (edit/delete) a service
 * @param currentUser The currently logged in user
 * @param serviceProviderId The ID of the service provider
 * @returns boolean indicating if user can manage the service
 */
export function canManageService(currentUser: User | null, serviceProviderId: number | null | undefined): boolean {
  if (!currentUser) return false;

  // Admin can manage any service
  if (currentUser.role === "admin") return true;

  // Users can manage their own services
  return currentUser.id === serviceProviderId;
}

/**
 * Check if the current user can manage (edit/delete) a product
 * @param currentUser The currently logged in user
 * @param sellerId The ID of the product seller
 * @returns boolean indicating if user can manage the product
 */
export function canManageProduct(currentUser: User | null, sellerId: number | null | undefined): boolean {
  if (!currentUser) return false;

  // Admin can manage any product
  if (currentUser.role === "admin") return true;

  // Users can manage their own products
  return currentUser.id === sellerId;
}

/**
 * Check if the current user can view admin content
 * @param currentUser The currently logged in user
 * @returns boolean indicating if user can view admin content
 */
export function canViewAdminContent(currentUser: User | null): boolean {
  if (!currentUser) return false;
  return currentUser.role === "admin";
}

/**
 * Check if the current user has premium features
 * @param currentUser The currently logged in user
 * @returns boolean indicating if user has premium features
 */
export function hasPremiumFeatures(currentUser: User | null): boolean {
  if (!currentUser) return false;
  
  // Admin always has premium features
  if (currentUser.role === "admin") return true;
  
  // This would be connected to the membership system
  // For now we'll check if they have an active membership in the memberships table
  // This will be updated when we implement the membership system
  return false; // TODO: Implement membership check
}