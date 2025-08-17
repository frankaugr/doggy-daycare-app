import React from 'react';
import type { ValidationResult, FormErrors } from '../types';

// Validation rules
export const ValidationRules = {
  required: (value: any) => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    return null;
  },

  email: (value: string) => {
    if (!value) return null; // Allow empty if not required
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  phone: (value: string) => {
    if (!value) return null; // Allow empty if not required
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
      return 'Please enter a valid phone number';
    }
    return null;
  },

  minLength: (min: number) => (value: string) => {
    if (!value) return null;
    if (value.length < min) {
      return `Must be at least ${min} characters long`;
    }
    return null;
  },

  maxLength: (max: number) => (value: string) => {
    if (!value) return null;
    if (value.length > max) {
      return `Must be no more than ${max} characters long`;
    }
    return null;
  },

  date: (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Please enter a valid date';
    }
    return null;
  },

  pastDate: (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (date > today) {
      return 'Date cannot be in the future';
    }
    return null;
  },

  futureDate: (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    if (date < today) {
      return 'Date cannot be in the past';
    }
    return null;
  }
};

// Schema-based validation
export interface ValidationSchema {
  [fieldName: string]: Array<(value: any) => string | null>;
}

export function validateField(value: any, rules: Array<(value: any) => string | null>): string | null {
  for (const rule of rules) {
    const error = rule(value);
    if (error) {
      return error;
    }
  }
  return null;
}

export function validateSchema(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
  const errors: FormErrors = {};
  let isValid = true;

  for (const [fieldName, rules] of Object.entries(schema)) {
    const value = data[fieldName];
    const error = validateField(value, rules);
    
    if (error) {
      errors[fieldName] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
}

// Specific validation schemas
export const DogValidationSchema: ValidationSchema = {
  name: [ValidationRules.required, ValidationRules.maxLength(100)],
  owner: [ValidationRules.required, ValidationRules.maxLength(100)],
  phone: [ValidationRules.required, ValidationRules.phone],
  email: [ValidationRules.required, ValidationRules.email],
  breed: [ValidationRules.maxLength(50)],
  age: [ValidationRules.maxLength(20)],
  vaccine_date: [ValidationRules.date, ValidationRules.pastDate],
  emergency_contact: [ValidationRules.maxLength(100)],
  emergency_phone: [ValidationRules.phone],
  medical_conditions: [ValidationRules.maxLength(500)],
  dietary_restrictions: [ValidationRules.maxLength(500)],
  behavioral_notes: [ValidationRules.maxLength(500)]
};

export const SettingsValidationSchema: ValidationSchema = {
  business_name: [ValidationRules.required, ValidationRules.maxLength(100)],
  business_phone: [ValidationRules.phone],
  business_email: [ValidationRules.email],
  business_address: [ValidationRules.maxLength(200)]
};

// Validation hooks
export function useValidation<T extends Record<string, any>>(
  schema: ValidationSchema,
  initialData?: T
) {
  const [data, setData] = React.useState<T>(initialData || {} as T);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const validateField = React.useCallback((fieldName: string, value: any) => {
    const rules = schema[fieldName];
    if (!rules) return null;

    for (const rule of rules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  }, [schema]);

  const validateForm = React.useCallback(() => {
    const result = validateSchema(data, schema);
    setErrors(result.errors);
    return result;
  }, [data, schema]);

  const setValue = React.useCallback((fieldName: string, value: any) => {
    setData(prev => ({ ...prev, [fieldName]: value }));
    
    // Validate field if it has been touched
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({ ...prev, [fieldName]: error || undefined }));
    }
  }, [validateField, touched]);

  const setFieldTouched = React.useCallback((fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    
    // Validate when field is touched
    const error = validateField(fieldName, data[fieldName]);
    setErrors(prev => ({ ...prev, [fieldName]: error || undefined }));
  }, [validateField, data]);

  const reset = React.useCallback((newData?: T) => {
    setData(newData || {} as T);
    setErrors({});
    setTouched({});
  }, []);

  return {
    data,
    errors,
    touched,
    setValue,
    setTouched: setFieldTouched,
    validateForm,
    validateField,
    reset,
    isValid: Object.keys(errors).length === 0
  };
}

