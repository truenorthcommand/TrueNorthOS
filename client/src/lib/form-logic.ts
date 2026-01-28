import type { FormField, FieldCondition, ConditionalLogic } from "@shared/schema";

export type FormValues = Record<string, any>;

export function evaluateCondition(condition: FieldCondition, values: FormValues): boolean {
  const fieldValue = values[condition.field];
  
  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "not_equals":
      return fieldValue !== condition.value;
    case "contains":
      if (typeof fieldValue === "string" && typeof condition.value === "string") {
        return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value);
      }
      return false;
    case "not_contains":
      if (typeof fieldValue === "string" && typeof condition.value === "string") {
        return !fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(condition.value);
      }
      return true;
    case "greater_than":
      return Number(fieldValue) > Number(condition.value);
    case "less_than":
      return Number(fieldValue) < Number(condition.value);
    case "is_empty":
      return fieldValue === undefined || fieldValue === null || fieldValue === "" || 
             (Array.isArray(fieldValue) && fieldValue.length === 0);
    case "is_not_empty":
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== "" &&
             !(Array.isArray(fieldValue) && fieldValue.length === 0);
    default:
      return false;
  }
}

export function evaluateConditionalLogic(logic: ConditionalLogic, values: FormValues): boolean {
  if (logic.conditions.length === 0) return false;
  
  const results = logic.conditions.map(condition => evaluateCondition(condition, values));
  
  if (logic.logic === "and") {
    return results.every(Boolean);
  } else {
    return results.some(Boolean);
  }
}

export interface FieldVisibility {
  visible: boolean;
  required: boolean;
  setValue?: string;
}

export function getFieldVisibility(
  field: FormField, 
  values: FormValues
): FieldVisibility {
  let visible = true;
  let required = field.required ?? false;
  let setValue: string | undefined;

  if (!field.conditionalLogic || field.conditionalLogic.length === 0) {
    return { visible, required };
  }

  for (const logic of field.conditionalLogic) {
    const conditionMet = evaluateConditionalLogic(logic, values);
    
    if (conditionMet) {
      switch (logic.action) {
        case "show":
          visible = true;
          break;
        case "hide":
          visible = false;
          break;
        case "require":
          required = true;
          break;
        case "not_require":
          required = false;
          break;
        case "set_value":
          setValue = logic.setValue;
          break;
      }
    }
  }

  return { visible, required, setValue };
}

export function evaluateFormula(formula: string, values: FormValues): number | string {
  if (!formula) return 0;
  
  let expression = formula;
  const fieldPattern = /\{([^}]+)\}/g;
  let match;
  
  while ((match = fieldPattern.exec(formula)) !== null) {
    const fieldKey = match[1];
    const fieldValue = values[fieldKey];
    const numericValue = typeof fieldValue === "number" ? fieldValue : parseFloat(fieldValue) || 0;
    expression = expression.replace(match[0], String(numericValue));
  }

  try {
    expression = expression.replace(/[^0-9+\-*/().%\s]/g, "");
    
    if (!expression.trim()) return 0;
    
    const result = Function(`"use strict"; return (${expression})`)();
    
    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function processFormFields(
  fields: FormField[],
  values: FormValues
): { visibleFields: FormField[]; computedValues: FormValues } {
  const computedValues = { ...values };
  const visibleFields: FormField[] = [];

  for (const field of fields) {
    const visibility = getFieldVisibility(field, computedValues);
    
    if (visibility.setValue !== undefined) {
      computedValues[field.key] = visibility.setValue;
    }
    
    if (field.type === "calculated" && field.formula) {
      computedValues[field.key] = evaluateFormula(field.formula, computedValues);
    }

    if (visibility.visible) {
      visibleFields.push({
        ...field,
        required: visibility.required,
      });
    }
  }

  return { visibleFields, computedValues };
}

export function validateField(
  field: FormField,
  value: any
): { valid: boolean; error?: string } {
  if (field.required) {
    if (value === undefined || value === null || value === "") {
      return { valid: false, error: `${field.label} is required` };
    }
    if (Array.isArray(value) && value.length === 0) {
      return { valid: false, error: `${field.label} is required` };
    }
  }

  if (value && field.type === "number") {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: `${field.label} must be a valid number` };
    }
    if (field.minValue !== undefined && num < field.minValue) {
      return { valid: false, error: `${field.label} must be at least ${field.minValue}` };
    }
    if (field.maxValue !== undefined && num > field.maxValue) {
      return { valid: false, error: `${field.label} must be at most ${field.maxValue}` };
    }
  }

  if (value && typeof value === "string") {
    if (field.minLength !== undefined && value.length < field.minLength) {
      return { valid: false, error: `${field.label} must be at least ${field.minLength} characters` };
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      return { valid: false, error: `${field.label} must be at most ${field.maxLength} characters` };
    }
    if (field.pattern) {
      try {
        const regex = new RegExp(field.pattern);
        if (!regex.test(value)) {
          return { valid: false, error: `${field.label} format is invalid` };
        }
      } catch {
      }
    }
  }

  return { valid: true };
}

export function validateForm(
  fields: FormField[],
  values: FormValues
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const { visibleFields, computedValues } = processFormFields(fields, values);

  for (const field of visibleFields) {
    const value = computedValues[field.key];
    const result = validateField(field, value);
    if (!result.valid && result.error) {
      errors[field.key] = result.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
