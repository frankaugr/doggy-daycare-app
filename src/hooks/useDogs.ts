import { useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import type { Dog, SearchFilters, UseDogsReturn } from '../types';

export function useDogs(): UseDogsReturn {
  const { state, loadDogs, addDog, updateDog, deleteDog } = useAppContext();

  const searchDogs = useCallback((filters: SearchFilters): Dog[] => {
    let filteredDogs = [...state.dogs];

    // Apply search term filter
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchTerm = filters.searchTerm.toLowerCase().trim();
      filteredDogs = filteredDogs.filter(dog =>
        dog.name.toLowerCase().includes(searchTerm) ||
        dog.owner.toLowerCase().includes(searchTerm) ||
        dog.breed.toLowerCase().includes(searchTerm) ||
        dog.email.toLowerCase().includes(searchTerm) ||
        dog.phone.includes(searchTerm)
      );
    }

    // Apply breed filter
    if (filters.breed) {
      filteredDogs = filteredDogs.filter(dog =>
        dog.breed.toLowerCase().includes(filters.breed!.toLowerCase())
      );
    }

    // Apply active status filter
    if (filters.isActive !== undefined) {
      filteredDogs = filteredDogs.filter(dog => dog.is_active === filters.isActive);
    }

    // Apply vaccination filter
    if (filters.hasVaccination !== undefined) {
      if (filters.hasVaccination) {
        filteredDogs = filteredDogs.filter(dog => !!dog.vaccine_date);
      } else {
        filteredDogs = filteredDogs.filter(dog => !dog.vaccine_date);
      }
    }

    // Apply consent filter
    if (filters.hasConsent !== undefined) {
      if (filters.hasConsent) {
        filteredDogs = filteredDogs.filter(dog => !!dog.consent_last_signed);
      } else {
        filteredDogs = filteredDogs.filter(dog => !dog.consent_last_signed);
      }
    }

    // Apply date range filter
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [startDate, endDate] = filters.dateRange;
      filteredDogs = filteredDogs.filter(dog => {
        const createdDate = new Date(dog.created_at);
        return createdDate >= new Date(startDate) && createdDate <= new Date(endDate);
      });
    }

    return filteredDogs;
  }, [state.dogs]);

  const refreshDogs = useCallback(async () => {
    await loadDogs();
  }, [loadDogs]);

  return {
    dogs: state.dogs,
    loading: state.loading,
    error: state.error,
    addDog,
    updateDog,
    deleteDog,
    searchDogs,
    refreshDogs,
  };
}